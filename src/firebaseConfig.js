import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAFqcmMilOw8qhR8O7GQgcwBh2iS2nyxIk",
  authDomain: "quandoc-123.firebaseapp.com",
  projectId: "quandoc-123",
  storageBucket: "quandoc-123.firebasestorage.app",
  messagingSenderId: "261938647721",
  appId: "1:261938647721:web:6232483eb683aed2110fb8"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);