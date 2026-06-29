import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

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
export const analytics = getAnalytics(app);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);
