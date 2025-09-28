import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// Hook genérico para buscar uma coleção
const useCollection = (collectionName) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, collectionName),
      (snapshot) => {
        const list = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setData(list);
        setLoading(false);
      },
      (error) => {
        console.error(`Erro ao buscar ${collectionName}:`, error);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [collectionName]);

  return { data, loading };
};

// Hooks específicos para cada coleção
export const usePacientes = () => useCollection('artifacts/regulacil/public/data/pacientes');
export const useLeitos = () => useCollection('artifacts/regulacil/public/data/leitos');
export const useSetores = () => useCollection('artifacts/regulacil/public/data/setores');
export const useInfeccoes = () => useCollection('artifacts/regulacil/public/data/infeccoes');
