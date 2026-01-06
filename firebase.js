// firebase.js  (ES Modules)

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

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

// anonymous login so anyone can review
await signInAnonymously(auth);

