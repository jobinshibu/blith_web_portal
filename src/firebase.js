import { initializeApp } from "firebase/app";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, persistentSingleTabManager, memoryLocalCache } from "firebase/firestore";
import { initializeAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";


const firebaseConfig = {
  apiKey: "AIzaSyBhWxm7Jx0HNqTuEBS8LEcLtkYhkAwDdac",
  authDomain: "blith-2963e.firebaseapp.com",
  projectId: "blith-2963e",
  storageBucket: "blith-2963e.appspot.com",
  messagingSenderId: "1005246694726",
  appId: "1:1005246694726:web:cc34c219fc3dc1c8085147",
  measurementId: "G-GZTJXH7BGC"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);


// Ensure Google Analytics is active for development testing and DebugView
if (typeof window !== 'undefined') {
  window['ga-disable-G-GZTJXH7BGC'] = false;
}

// Asynchronous non-blocking analytics initialization
let analyticsInstance = null;
if (typeof window !== 'undefined') {
  try {
    analyticsInstance = initializeAnalytics(app);
  } catch (err) {
    console.warn('[Firebase] Analytics initialization deferred or failed:', err);
  }
}
export const analytics = analyticsInstance;

// WebKit/iOS detection: Safari and iOS browsers have known IndexedDB cross-tab locking delays
const isWebKit = typeof navigator !== 'undefined' && (
  /iP(hone|od|ad)/.test(navigator.userAgent) ||
  (/^((?!chrome|android).)*safari/i.test(navigator.userAgent))
);

let localCacheConfig;
try {
  localCacheConfig = isWebKit
    ? persistentLocalCache({ tabManager: persistentSingleTabManager({ forceOwnership: false }) })
    : persistentLocalCache({ tabManager: persistentMultipleTabManager() });
} catch (e) {
  localCacheConfig = memoryLocalCache();
}

export const db = initializeFirestore(app, {
  localCache: localCacheConfig
});

// App Check Attestation & Security (Monitoring / Enforced Mode)
let appCheckInstance = null;
const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY || "";

if (typeof window !== "undefined") {
  // Automatically activate debug token in local development environment
  if (import.meta.env.DEV || window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }

  if (recaptchaSiteKey) {
    try {
      appCheckInstance = initializeAppCheck(app, {
        provider: new ReCaptchaEnterpriseProvider(recaptchaSiteKey),
        isTokenAutoRefreshEnabled: true
      });
      console.log("[Firebase App Check] Initialized successfully.");
    } catch (err) {
      console.warn("[Firebase App Check] Initialization deferred or failed:", err);
    }
  } else {
    console.info(
      "[Firebase App Check] Setup pending: Provide VITE_RECAPTCHA_SITE_KEY in .env to send attestation tokens."
    );
  }
}

export const appCheck = appCheckInstance;








