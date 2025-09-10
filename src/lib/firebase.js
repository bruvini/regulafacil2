// Firebase configuration and initialization
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  addDoc, 
  setDoc, 
  deleteDoc, 
  updateDoc, 
  onSnapshot, 
  query, 
  getDocs, 
  getDoc,
  serverTimestamp, 
  arrayUnion, 
  deleteField, 
  where, 
  orderBy, 
  limit,
  increment
} from 'firebase/firestore';
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  deleteUser, 
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updatePassword
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyBvgWppRYjPIP22U9-vu-J2dwrhJ2Klvpc",
  authDomain: "pmj-hmsj.firebaseapp.com",
  projectId: "pmj-hmsj",
  storageBucket: "pmj-hmsj.appspot.com",
  messagingSenderId: "226296836721",
  appId: "1:226296836721:web:b2429cd730ef22b4e6e1d0",
  measurementId: "G-ZCS2BWPBE7"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Import centralized path constants
import { 
  SECTORS_COLLECTION_PATH,
  BEDS_COLLECTION_PATH,
  ROOMS_COLLECTION_PATH,
  AUDIT_COLLECTION_PATH,
  PATIENTS_COLLECTION_PATH,
  INFECTIONS_COLLECTION_PATH,
  USERS_COLLECTION_PATH
} from './firebase-constants';

// Collection references using centralized constants
export const getSetoresCollection = () => collection(db, SECTORS_COLLECTION_PATH);
export const getLeitosCollection = () => collection(db, BEDS_COLLECTION_PATH);
export const getQuartosCollection = () => collection(db, ROOMS_COLLECTION_PATH);
export const getAuditoriaCollection = () => collection(db, AUDIT_COLLECTION_PATH);
export const getPacientesCollection = () => collection(db, PATIENTS_COLLECTION_PATH);
export const getInfeccoesCollection = () => collection(db, INFECTIONS_COLLECTION_PATH);
export const getUsuariosCollection = () => collection(db, USERS_COLLECTION_PATH);

// Export Firebase utilities
export { 
  db, 
  auth,
  collection, 
  doc, 
  addDoc, 
  setDoc, 
  deleteDoc, 
  updateDoc,
  onSnapshot, 
  query, 
  getDocs,
  getDoc,
  serverTimestamp,
  arrayUnion,
  deleteField,
  where,
  orderBy,
  limit,
  increment,
  createUserWithEmailAndPassword,
  deleteUser,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updatePassword
};
