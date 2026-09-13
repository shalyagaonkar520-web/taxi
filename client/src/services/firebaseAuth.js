import { initializeApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

export const firebaseEnabled = Object.values(firebaseConfig).every(Boolean);
const firebaseAuth = firebaseEnabled ? getAuth(initializeApp(firebaseConfig)) : null;
const googleProvider = new GoogleAuthProvider();

export async function signInWithFirebase(email, password) {
  return signInWithEmailAndPassword(firebaseAuth, email, password);
}

export async function signUpWithFirebase(email, password) {
  return createUserWithEmailAndPassword(firebaseAuth, email, password);
}

export async function signInWithGoogle() {
  return signInWithPopup(firebaseAuth, googleProvider);
}

export async function sendFirebasePasswordReset(email) {
  return sendPasswordResetEmail(firebaseAuth, email);
}

export async function getFirebaseToken(user) {
  return user.getIdToken(true);
}
