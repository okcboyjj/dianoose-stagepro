import { initializeApp } from "firebase/app";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";
import {
  initializeAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  GoogleAuthProvider,
  OAuthProvider,
} from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const app = initializeApp(firebaseConfig);

// Offline-first: cached reads/writes survive no-wifi rehearsals and sync when back online.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  experimentalAutoDetectLongPolling: true,
});

// getAuth()'s default resolver lazy-loads Google's gapi.iframes helper (apis.google.com/js/api.js)
// for cross-tab/redirect auth events, on EVERY auth operation, not just popup sign-in. Under
// Capacitor's capacitor://localhost origin (not a real https origin) that iframe handshake never
// completes, and the SDK hangs waiting on it — confirmed on-device: signUp/signIn REST calls
// (accounts:signUp / accounts:lookup) complete in <1s, but the returned promise never resolves.
// Disabling the resolver here skips that iframe entirely, at the cost of signInWithPopup (Google/
// Apple) now failing fast with an error on native instead of hanging — acceptable since email/
// password + team-code join is the primary flow.
export const auth = initializeAuth(app, {
  persistence: [indexedDBLocalPersistence, browserLocalPersistence],
  popupRedirectResolver: undefined,
});

export const storage = getStorage(app);

export const googleProvider = new GoogleAuthProvider();
export const appleProvider = new OAuthProvider("apple.com");
