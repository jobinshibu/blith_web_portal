import { initializeApp } from "firebase/app";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
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

export const analytics = initializeAnalytics(app);

// Initialize Cloud Firestore with modern persistent local cache to prevent deprecation warning
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});

// Initialize Cloud Functions
export const functions = getFunctions(app);
