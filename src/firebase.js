// ==================== CHANGED: PERFORMANCE OPTIMIZATION ====================
import { initializeApp } from "firebase/app";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, persistentSingleTabManager, memoryLocalCache } from "firebase/firestore";
import { initializeAnalytics } from "firebase/analytics";
import { getFunctions } from "firebase/functions";

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
const app = initializeApp(firebaseConfig);

const isDevelopment = typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

if (isDevelopment && typeof window !== 'undefined') {
  window['ga-disable-G-GZTJXH7BGC'] = true;
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


// Initialize Cloud Functions
export const functions = getFunctions(app);


