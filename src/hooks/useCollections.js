// src/hooks/useCollections.js
import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ROOMS_COLLECTION_PATH, PATIENTS_COLLECTION_PATH, BEDS_COLLECTION_PATH, SECTORS_COLLECTION_PATH, INFECTIONS_COLLECTION_PATH } from '@/lib/firebase-constants';

const useCollection = (path) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, path), (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setData(list);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [path]);
  return { data, loading };
};

export const usePacientes = () => useCollection(PATIENTS_COLLECTION_PATH);
export const useLeitos = () => useCollection(BEDS_COLLECTION_PATH);
export const useSetores = () => useCollection(SECTORS_COLLECTION_PATH);
export const useInfeccoes = () => useCollection(INFECTIONS_COLLECTION_PATH);
export const useQuartos = () => useCollection(ROOMS_COLLECTION_PATH);
