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
import { getAnalytics, logEvent as fbLogEvent, isSupported as analyticsSupported } from "firebase/analytics";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-L4EBJC9D02",
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

// ── Analytics (web/GA4) + lightweight error tracking ─────────────────────────────────────
// Guarded by isSupported() — analytics can't init in some contexts (SSR, certain
// WKWebView/Capacitor, cookie-blocked). track() safely no-ops when unavailable, so callers
// never need to check. Auto-events (page_view, session_start, first_open) come for free once
// analytics initializes; we add custom events for the actions that tell the usage story.
let _analytics = null;
analyticsSupported().then((ok) => {
  if (ok) { try { _analytics = getAnalytics(app); } catch { /* unsupported env */ } }
}).catch(() => {});

export function track(event, params) {
  try { if (_analytics) fbLogEvent(_analytics, event, params || {}); } catch { /* noop */ }
}

// Poor-man's web crash reporting until native Crashlytics is added: surface uncaught errors
// and promise rejections as analytics events so they show up in GA4.
if (typeof window !== "undefined") {
  window.addEventListener("error", (e) => {
    track("js_exception", { message: String(e?.message || e?.error || "").slice(0, 200), source: String(e?.filename || "").slice(-80) });
  });
  window.addEventListener("unhandledrejection", (e) => {
    track("unhandled_rejection", { reason: String(e?.reason?.message || e?.reason || "").slice(0, 200) });
  });
}
