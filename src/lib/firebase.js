// Firebase configuration and initialization
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, addDoc, setDoc, deleteDoc, onSnapshot, query, getDocs, serverTimestamp } from 'firebase/firestore';

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

// App ID for collection paths
const appId = 'regulafacil';

// Collection references
export const getSetoresCollection = () => collection(db, 'artifacts', appId, 'public', 'data', 'setores');
export const getLeitosCollection = () => collection(db, 'artifacts', appId, 'public', 'data', 'leitos');
export const getQuartosCollection = () => collection(db, 'artifacts', appId, 'public', 'data', 'quartos');

// Export Firebase utilities
export { 
  db, 
  collection, 
  doc, 
  addDoc, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  getDocs,
  serverTimestamp 
};