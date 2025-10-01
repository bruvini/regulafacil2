// src/hooks/useCollections.js
import React, { useState, useEffect } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { 
  getPacientesCollection, 
  getLeitosCollection, 
  getSetoresCollection, 
  getInfeccoesCollection 
} from '@/lib/firebase';

const useCollection = (getCollectionRef) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const collectionRef = getCollectionRef();
    const unsubscribe = onSnapshot(collectionRef, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setData(list);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [getCollectionRef]);
  
  return { data, loading };
};

export const usePacientes = () => useCollection(getPacientesCollection);
export const useLeitos = () => useCollection(getLeitosCollection);
export const useSetores = () => useCollection(getSetoresCollection);
export const useInfeccoes = () => useCollection(getInfeccoesCollection);
