import { auth, db, storage, googleProvider, appleProvider } from "@/lib/firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithCredential,
  signOut,
  updateProfile,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  GoogleAuthProvider,
  OAuthProvider,
  confirmPasswordReset,
} from "firebase/auth";
import { doc, getDocFromServer } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getFunctions, httpsCallable } from "firebase/functions";
import { createEntity } from "@/lib/firestoreEntity";
import { Capacitor } from "@capacitor/core";
import { FirebaseAuthentication } from "@capacitor-firebase/authentication";

const functions = getFunctions(auth.app);

function shimUser(fbUser) {
  if (!fbUser) return null;
  const nameParts = (fbUser.displayName || "").trim().split(" ").filter(Boolean);
  return {
    id: fbUser.uid,
    uid: fbUser.uid,
    email: fbUser.email,
    emailVerified: fbUser.emailVerified,
    full_name: fbUser.displayName || "",
    first_name: nameParts[0] || "",
    last_name: nameParts.slice(1).join(" ") || "",
  };
}

// auth.authStateReady() can hang indefinitely in some WKWebView contexts (observed in the
// Capacitor iOS wrapper) instead of resolving once the persisted session check completes.
// Racing it against a timeout means a slow/stuck persistence check degrades to "not logged
// in" (worst case: re-prompt for sign-in) instead of freezing the app on the loading screen.
function authStateReadyWithTimeout(ms = 4000) {
  return Promise.race([
    auth.authStateReady(),
    new Promise((resolve) => setTimeout(resolve, ms)),
  ]);
}

async function currentChurchId() {
  if (!auth.currentUser) throw new Error("Not authenticated");
  const memberSnap = await getDocFromServer(doc(db, "churchMembers", auth.currentUser.uid));
  if (!memberSnap.exists()) throw new Error("No church membership found for this account");
  return memberSnap.data().church_id;
}

export const base44 = {
  entities: {
    Song: createEntity("songs"),
    GlobalSong: createEntity("globalSongs"),
    Church: createEntity("churches"),
    // Doc ID == the member's own auth uid (see firestore.rules) — one membership doc per user.
    ChurchMember: createEntity("churchMembers", { idField: "user_id" }),
    Service: createEntity("services"),
    ServiceAssignment: createEntity("serviceAssignments"),
    TeamInvite: createEntity("teamInvites"),
    Channel: createEntity("channels"),
    Message: createEntity("messages"),
    MyLibrarySong: createEntity("myLibrarySongs"),
    Notification: createEntity("notifications"),
  },

  auth: {
    async isAuthenticated() {
      await authStateReadyWithTimeout();
      return !!auth.currentUser;
    },

    async me() {
      await authStateReadyWithTimeout();
      if (!auth.currentUser) throw new Error("Not authenticated");
      return shimUser(auth.currentUser);
    },

    async register({ email, password }) {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await httpsCallable(functions, "sendAuthEmail")({ type: "verify", email });
      return { user: shimUser(cred.user) };
    },

    async sendVerificationEmail() {
      if (!auth.currentUser) throw new Error("Not authenticated");
      await httpsCallable(functions, "sendAuthEmail")({ type: "verify", email: auth.currentUser.email });
    },

    async checkEmailVerified() {
      if (!auth.currentUser) throw new Error("Not authenticated");
      await auth.currentUser.reload();
      return auth.currentUser.emailVerified;
    },

    async loginViaEmailPassword(email, password) {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      return { user: shimUser(cred.user) };
    },

    // Native platforms use the native Google/Apple sign-in sheets via @capacitor-firebase/authentication
    // instead of signInWithPopup — popup-based OAuth doesn't work reliably inside Capacitor's WKWebView.
    // skipNativeAuth:false only signs into the native (Keychain-based) Firebase Auth SDK — that's a
    // completely separate session from the JS SDK's own (IndexedDB-based) one that the rest of this
    // app actually uses for Firestore, so it never syncs on its own. Explicitly sign into the JS SDK
    // too, using the credential the native sign-in already produced.
    async signInWithGoogle() {
      if (Capacitor.isNativePlatform()) {
        const result = await FirebaseAuthentication.signInWithGoogle();
        const credential = GoogleAuthProvider.credential(
          result.credential?.idToken,
          result.credential?.accessToken
        );
        const cred = await signInWithCredential(auth, credential);
        return { user: shimUser(cred.user) };
      }
      const cred = await signInWithPopup(auth, googleProvider);
      return { user: shimUser(cred.user) };
    },

    async signInWithApple() {
      if (Capacitor.isNativePlatform()) {
        const result = await FirebaseAuthentication.signInWithApple();
        const provider = new OAuthProvider("apple.com");
        const credential = provider.credential({
          idToken: result.credential?.idToken,
          rawNonce: result.credential?.nonce,
        });
        const cred = await signInWithCredential(auth, credential);
        return { user: shimUser(cred.user) };
      }
      const cred = await signInWithPopup(auth, appleProvider);
      return { user: shimUser(cred.user) };
    },

    async logout() {
      // On native, signing out only the native SDK leaves the JS SDK's own persisted session
      // (IndexedDB) intact until the plugin's async listener bridge syncs it over — a race that
      // can lose to an immediate page reload, making a signed-out user look signed back in.
      // Always sign out the JS SDK too so its persistence is cleared before we reload.
      if (Capacitor.isNativePlatform()) {
        await FirebaseAuthentication.signOut();
      }
      await signOut(auth);
    },

    async updateMe({ full_name }) {
      if (!auth.currentUser) throw new Error("Not authenticated");
      await updateProfile(auth.currentUser, { displayName: full_name });
    },

    async changePassword(currentPassword, newPassword) {
      const user = auth.currentUser;
      if (!user) throw new Error("Not authenticated");
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
    },

    async resetPasswordRequest(email) {
      await httpsCallable(functions, "sendAuthEmail")({ type: "reset", email });
    },

    async resetPassword({ oobCode, newPassword }) {
      await confirmPasswordReset(auth, oobCode, newPassword);
    },

    redirectToLogin() {
      // Legacy no-op — kept only because the unused AuthContext/ProtectedRoute boilerplate calls it.
    },
  },

  integrations: {
    Core: {
      async UploadFile({ file }) {
        const churchId = await currentChurchId();
        const path = `uploads/${churchId}/${Date.now()}_${file.name}`;
        const fileRef = ref(storage, path);
        await uploadBytes(fileRef, file);
        const file_url = await getDownloadURL(fileRef);
        return { file_url };
      },

      async InvokeLLM(payload) {
        const call = httpsCallable(functions, "invokeLLM");
        const res = await call(payload);
        return res.data;
      },
    },
  },

  functions: {
    async invoke(name, payload) {
      const call = httpsCallable(functions, name);
      const res = await call(payload);
      return { data: res.data };
    },
  },
};
