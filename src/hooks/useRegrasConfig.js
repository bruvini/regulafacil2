// src/hooks/useRegrasConfig.js
// Hook responsável por buscar e persistir as regras dinâmicas de regulação no Firestore.
// As regras são armazenadas em: configuracoes/regras_regulacao
// Em caso de falha ou ausência de dados, o fallback garante o comportamento original do sistema.

import { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const COLECAO = 'configuracoes';
const DOCUMENTO = 'regras_regulacao';

// ============================================================
// REGRAS DEFAULT — Espelham exatamente o comportamento atual
// hardcoded em compatibilidadeUtils.js e SugestoesRegulacaoModal.jsx
// Servem como fallback caso o Firestore esteja vazio.
// ============================================================
export const REGRAS_DEFAULT = {
  perfisSetor: {
    "UNID. JS ORTOPEDIA": [
      "NEUROCIRURGIA",
      "ODONTOLOGIA C.TRAUM.B.M.F.",
      "ORTOPEDIA/TRAUMATOLOGIA",
      "BUCOMAXILO",
    ],
    "UNID. INT. GERAL - UIG": [
      "CLINICA GERAL",
      "INTENSIVISTA",
      "NEUROLOGIA",
      "PROCTOLOGIA",
      "UROLOGIA",
      "MASTOLOGIA",
    ],
    "UNID. CLINICA MEDICA": [
      "CLINICA GERAL",
      "INTENSIVISTA",
      "NEUROLOGIA",
      "PROCTOLOGIA",
      "UROLOGIA",
      "MASTOLOGIA",
    ],
    "UNID. ONCOLOGIA": [
      "HEMATOLOGIA",
      "ONCOLOGIA CIRURGICA",
      "ONCOLOGIA CLINICA/CANCEROLOGIA",
    ],
    "UNID. CIRURGICA": [
      "CIRURGIA CABECA E PESCOCO",
      "CIRURGIA GERAL",
      "CIRURGIA TORACICA",
      "CIRURGIA VASCULAR",
      "NEUROCIRURGIA",
      "PROCTOLOGIA",
      "UROLOGIA",
      "ONCOLOGIA CIRURGICA",
      "MASTOLOGIA",
    ],
    "UNID. NEFROLOGIA TRANSPLANTE": ["NEFROLOGIA", "HEPATOLOGISTA"],
  },
  pcp: {
    idadeMinima: 18,
    idadeMaxima: 60,
    // TODO (FHIR v3.0): Mapear origens para códigos HL7 ADT/EVN
    origensBloqueadas: ["RECUPERACAO", "RPA", " RECU"],
  },
  importacaoMV: {
    linkPainel: "http://1495prd.cloudmv.com.br/Painel/",
    login: "nir",
    senha: "nir",
    nomePainel: "NIR - Ocupação Setores",
  },
};

// ============================================================
// HOOK
// ============================================================
export const useRegrasConfig = () => {
  const [regras, setRegras] = useState(REGRAS_DEFAULT);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);

  // Busca as regras do Firestore na montagem do componente
  useEffect(() => {
    const buscarRegras = async () => {
      try {
        setLoading(true);
        const docRef = doc(db, COLECAO, DOCUMENTO);
        const snap = await getDoc(docRef);

        if (snap.exists()) {
          const dados = snap.data();
          // Merge profundo com o fallback para garantir que campos novos não quebrem
          setRegras({
            perfisSetor: dados.perfisSetor ?? REGRAS_DEFAULT.perfisSetor,
            pcp: {
              ...REGRAS_DEFAULT.pcp,
              ...(dados.pcp ?? {}),
            },
            importacaoMV: {
              ...REGRAS_DEFAULT.importacaoMV,
              ...(dados.importacaoMV ?? {}),
            },
          });
        } else {
          // Documento ainda não existe no Firestore — usa os defaults sem erros
          setRegras(REGRAS_DEFAULT);
        }
      } catch (err) {
        console.error('[useRegrasConfig] Erro ao buscar regras:', err);
        setErro(err.message);
        // Em caso de erro, mantém o fallback para não quebrar o fluxo clínico
        setRegras(REGRAS_DEFAULT);
      } finally {
        setLoading(false);
      }
    };

    buscarRegras();
  }, []);

  /**
   * Persiste as regras no Firestore (merge=true para não sobrescrever campos extras).
   * Apenas administradores devem poder chamar esta função (guarda na UI).
   */
  const salvarRegras = useCallback(async (novasRegras) => {
    try {
      setSalvando(true);
      setErro(null);
      const docRef = doc(db, COLECAO, DOCUMENTO);
      await setDoc(docRef, {
        ...novasRegras,
        atualizadoEm: serverTimestamp(),
      }, { merge: true });
      setRegras(novasRegras);
      return { sucesso: true };
    } catch (err) {
      console.error('[useRegrasConfig] Erro ao salvar regras:', err);
      setErro(err.message);
      return { sucesso: false, erro: err.message };
    } finally {
      setSalvando(false);
    }
  }, []);

  return { regras, loading, salvando, erro, salvarRegras };
};
