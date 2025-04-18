import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCfdsrJBVYqSzXfN1nm9P5kFpE7iSRSS9I",
  authDomain: "test1-mana-sell.firebaseapp.com",
  projectId: "test1-mana-sell",
  storageBucket: "test1-mana-sell.firebasestorage.app",
  messagingSenderId: "958535958278",
  appId: "1:958535958278:web:a6a745d201fbf3066e2887",
  measurementId: "G-TPRFDY5H1F"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);