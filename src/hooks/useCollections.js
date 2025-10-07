// src/hooks/useCollections.js
import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

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

export const usePacientes = () => useCollection('artifacts/regulafacil/public/data/pacientes');
export const useLeitos = () => useCollection('artifacts/regulafacil/public/data/leitos');
export const useSetores = () => useCollection('artifacts/regulafacil/public/data/setores');
export const useInfeccoes = () => useCollection('artifacts/regulafacil/public/data/infeccoes');
