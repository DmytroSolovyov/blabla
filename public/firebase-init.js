import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  projectId: "ai-studio-applet-webapp-a3cb3",
  appId: "1:28327553312:web:87b917ca020d55dc378f45",
  apiKey: "AIzaSyBCaGt95OpEfXuoDGASn0gwxFfuGdGuXLY",
  authDomain: "ai-studio-applet-webapp-a3cb3.firebaseapp.com",
  storageBucket: "ai-studio-applet-webapp-a3cb3.firebasestorage.app",
  messagingSenderId: "28327553312"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, "ai-studio-22089c49-5947-40dc-9129-f46d2a05fea2");
export const provider = new GoogleAuthProvider();

export { signInWithPopup, signOut, onAuthStateChanged, collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, onSnapshot };
