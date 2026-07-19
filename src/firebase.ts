import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  projectId: "wise-artifact-t2t1j",
  appId: "1:857595399959:web:202ee2e6f563611d10b152",
  apiKey: "AIzaSyCOj5qVcbPlSJ2agp_tHEIqyrY4zXn9tNI",
  authDomain: "wise-artifact-t2t1j.firebaseapp.com",
  storageBucket: "wise-artifact-t2t1j.firebasestorage.app",
  messagingSenderId: "857595399959"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore with specific database ID
const db = getFirestore(app, "ai-studio-textcostcalculat-dad082fc-fefc-4fa0-8d92-8a5547279069");

// Initialize Auth
const auth = getAuth(app);

export { app, db, auth };
