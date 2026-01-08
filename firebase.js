// firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import {
  getAuth,
  signInAnonymously,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBLaJCXn7aFr1oMN_e8yJV-RN3mz6mMnGA",
  authDomain: "cutecleansoaps.firebaseapp.com",
  projectId: "cutecleansoaps",
  storageBucket: "cutecleansoaps.firebasestorage.app",
  messagingSenderId: "1080768063004",
  appId: "1:1080768063004:web:4cea9e19ccaf875cd0e1d9",
  measurementId: "G-K06F2PEBKC"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// anonymous (optional)
export function ensureAnonAuth() {
  if (auth.currentUser) return;
  signInAnonymously(auth).catch((e) => {
    console.error("Anonymous auth failed (enable it in Firebase Console):", e);
  });
}

// email/password helpers
export async function emailSignIn(email, password) {
  return await signInWithEmailAndPassword(auth, email, password);
}

export async function emailSignUp(email, password) {
  return await createUserWithEmailAndPassword(auth, email, password);
}

export async function doSignOut() {
  return await signOut(auth);
}
