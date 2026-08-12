import { initializeApp } from '@firebase/app';
import { getFirestore, doc, getDoc, setDoc, onSnapshot, writeBatch } from '@firebase/firestore';

export function initApp(firebaseConfig) {
  return initializeApp(firebaseConfig);
}

export function getDb(app) {
  return getFirestore(app);
}

export { doc, getDoc, setDoc, onSnapshot, writeBatch };
