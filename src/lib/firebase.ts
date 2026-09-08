import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  deleteDoc, 
  updateDoc,
  onSnapshot,
  Firestore 
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Connect to the specific database ID configured for this project
export const db: Firestore = getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)');

export { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  deleteDoc, 
  updateDoc, 
  onSnapshot 
};

export const isFirebaseConfigured = (): boolean => {
  return Boolean(firebaseConfig && firebaseConfig.projectId && firebaseConfig.apiKey);
};
