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
import { Capacitor } from "@capacitor/core";

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

// ── Analytics + crash/error reporting (platform-aware) ───────────────────────────────────
// Native (iOS/Android via Capacitor): route to the real Firebase Analytics + Crashlytics
//   SDKs so we get native session/crash data and symbolicated stack traces.
// Web (browser): use the GA4 JS SDK behind isSupported() — analytics can't init in some
//   contexts (SSR, cookie-blocked), and there's no web Crashlytics, so uncaught errors are
//   logged as GA4 events instead.
// track() safely no-ops when unavailable, so callers never need to check. Firebase auto-events
// (page_view/screen_view, session_start, first_open) come for free once analytics initializes;
// we add custom events for the actions that tell the usage story.
const isNative = Capacitor.isNativePlatform();

let _analytics = null;          // web GA4 instance
let _nativeAnalytics = null;    // @capacitor-firebase/analytics
let _nativeCrashlytics = null;  // @capacitor-firebase/crashlytics

if (isNative) {
  Promise.all([
    import("@capacitor-firebase/analytics").then((m) => { _nativeAnalytics = m.FirebaseAnalytics; }),
    import("@capacitor-firebase/crashlytics").then((m) => { _nativeCrashlytics = m.FirebaseCrashlytics; }),
  ]).then(() => {
    try { _nativeAnalytics?.setEnabled({ enabled: true }); } catch { /* noop */ }
    try { _nativeCrashlytics?.setEnabled({ enabled: true }); } catch { /* noop */ }
  }).catch(() => {});
} else {
  analyticsSupported().then((ok) => {
    if (ok) { try { _analytics = getAnalytics(app); } catch { /* unsupported env */ } }
  }).catch(() => {});
}

// GA4 event/param names must be alphanumeric+underscore; native rejects other keys silently.
export function track(event, params) {
  try {
    if (isNative) {
      _nativeAnalytics?.logEvent({ name: event, params: params || {} });
    } else if (_analytics) {
      fbLogEvent(_analytics, event, params || {});
    }
  } catch { /* noop */ }
}

// Report a caught/handled error. On native it becomes a non-fatal Crashlytics record (with a
// real stack when available); on web it's a GA4 event.
export function reportError(err, context) {
  const message = String(err?.message || err || "").slice(0, 300);
  try {
    if (isNative) {
      _nativeCrashlytics?.recordException({ message, stacktrace: err?.stack ? [{ fileName: "js", lineNumber: 0, methodName: err.stack.slice(0, 500) }] : undefined });
    } else {
      track("js_exception", { message, source: String(context || "").slice(0, 80) });
    }
  } catch { /* noop */ }
}

// Global handlers: surface uncaught errors + promise rejections. On native these feed
// Crashlytics as non-fatals (JS errors don't crash the native shell but we still want them);
// on web they become GA4 events.
if (typeof window !== "undefined") {
  window.addEventListener("error", (e) => {
    if (isNative) reportError(e?.error || e?.message, e?.filename);
    else track("js_exception", { message: String(e?.message || e?.error || "").slice(0, 200), source: String(e?.filename || "").slice(-80) });
  });
  window.addEventListener("unhandledrejection", (e) => {
    if (isNative) reportError(e?.reason, "unhandledrejection");
    else track("unhandled_rejection", { reason: String(e?.reason?.message || e?.reason || "").slice(0, 200) });
  });
}
