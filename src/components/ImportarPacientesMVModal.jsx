import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Upload, 
  FileSpreadsheet, 
  CheckCircle, 
  AlertTriangle, 
  Loader2,
  ExternalLink,
  Database,
  ArrowRightLeft,
  UserPlus,
  UserMinus,
  Copy,
  RefreshCw
} from 'lucide-react';
import {
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  arrayUnion,
  db,
  deleteField
} from '@/lib/firebase';
import { 
  getSetoresCollection, 
  getLeitosCollection, 
  getPacientesCollection 
} from '@/lib/firebase';
import { 
  PATIENTS_COLLECTION_PATH,
  BEDS_COLLECTION_PATH
} from '@/lib/firebase-constants';
import { writeBatch } from 'firebase/firestore';
import { logAction } from '@/lib/auditoria';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { adicionarConclusaoRegulacaoAoBatch } from '@/lib/regulacao';

const ImportarPacientesMVModal = ({ isOpen, onClose }) => {
  const [currentStep, setCurrentStep] = useState('instructions'); // instructions, processing, validation, confirmation, completed
  const [selectedFile, setSelectedFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedData, setProcessedData] = useState(null);
  const [syncSummary, setSyncSummary] = useState({
    altas: 0,
    movimentacoes: 0,
    internacoes: 0,
    novosSetores: 0,
    novosLeitos: 0
  });

  const { currentUser } = useAuth();

  // Novos estados para validação
  const [setoresFaltantes, setSetoresFaltantes] = useState([]);
  const [leitosFaltantes, setLeitosFaltantes] = useState([]);
  const [parsedFileData, setParsedFileData] = useState(null); // Para armazenar dados do arquivo já processado

  const normalizarCodigoLeito = (codigo) => {
    if (!codigo) return '';

    return codigo
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    setSelectedFile(file);
  };

  const parseExcelFile = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          
          // Pular as primeiras 3 linhas (cabeçalho) e processar a partir da linha 4
          const pacientesData = jsonData.slice(3).filter(row => row[0]).map(row => ({
            nomePaciente: (row[0] || '').toString().toUpperCase().trim(),
            dataNascimento: (row[1] || '').toString(),
            sexo: (row[2] || '').toString().toUpperCase(),
            dataInternacao: (row[3] || '').toString(),
            nomeSetor: (row[4] || '').toString().trim().toUpperCase(),
            codigoLeito: (row[6] || '').toString().trim().toUpperCase(),
            especialidade: (row[7] || '').toString().toUpperCase().trim()
          })).filter(p => p.nomePaciente && p.codigoLeito);
          
          resolve(pacientesData);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  const parseDataHoraMV = (dataString) => {
    if (!dataString || typeof dataString !== 'string') return null;

    const trimmed = dataString.trim();
    if (!trimmed) return null;

    const [dataPart, timePart] = trimmed.split(' ').filter(Boolean);
    if (!dataPart) return null;

    const [diaStr, mesStr, anoStr] = dataPart.split('/');
    const dia = parseInt(diaStr, 10);
    const mes = parseInt(mesStr, 10);
    const ano = parseInt(anoStr, 10);

    if (Number.isNaN(dia) || Number.isNaN(mes) || Number.isNaN(ano)) return null;

    let hora = 0;
    let minuto = 0;
    let segundo = 0;

    if (timePart && timePart.includes(':')) {
      const [horaStr, minutoStr, segundoStr] = timePart.split(':');
      hora = parseInt(horaStr, 10) || 0;
      minuto = parseInt(minutoStr, 10) || 0;
      segundo = parseInt(segundoStr, 10) || 0;
    }

    return new Date(ano, mes - 1, dia, hora, minuto, segundo);
  };

  const loadFirestoreData = async () => {
    const [setoresSnapshot, leitosSnapshot, pacientesSnapshot] = await Promise.all([
      getDocs(getSetoresCollection()),
      getDocs(getLeitosCollection()),
      getDocs(getPacientesCollection())
    ]);

    const setores = {};
    const leitos = {};
    const pacientes = {};

    setoresSnapshot.forEach(docSnap => {
      const data = docSnap.data();
      const key = (data.nomeSetor || '').toString().trim().toUpperCase();
      setores[key] = { id: docSnap.id, ...data };
    });

    leitosSnapshot.forEach(docSnap => {
      const data = docSnap.data();
      const codigoNormalizado = normalizarCodigoLeito(data.codigoLeito);
      const leito = { id: docSnap.id, ...data, codigoLeitoNormalizado: codigoNormalizado };

      if (codigoNormalizado) {
        leitos[codigoNormalizado] = leito;
      }

      leitos[`__ID__${leito.id}`] = leito;
    });

    pacientesSnapshot.forEach(docSnap => {
      const data = docSnap.data();
      const key = (data.nomePaciente || '').toString().trim().toUpperCase();
      pacientes[key] = { id: docSnap.id, ...data };
    });

    // Diagnóstico: visualizar dados buscados do Firestore
    try {
      console.log('--- DADOS BUSCADOS DO FIRESTORE (SETORES) ---');
      console.table(Object.entries(setores).map(([k, v]) => ({ key: k, id: v.id, nome: (v.nomeSetor || '').toString(), sigla: v.sigla || '' })));
      console.log('--- DADOS BUSCADOS DO FIRESTORE (LEITOS) ---');
      console.table(
        Object.entries(leitos)
          .filter(([key]) => !key.startsWith('__ID__'))
          .map(([k, v]) => ({ key: k, id: v.id, codigo: (v.codigoLeito || '').toString(), setorId: v.setorId || '' }))
      );
    } catch (_) { /* noop for environments without console.table */ }

    return { setores, leitos, pacientes };
  };

  const processFile = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setCurrentStep('processing');

    try {
      // Parse do arquivo Excel
      const pacientesArquivo = await parseExcelFile(selectedFile);
      setParsedFileData(pacientesArquivo); // Armazenar dados do arquivo

      // Diagnóstico: visualizar dados processados do arquivo
      try {
        console.log('--- DADOS PROCESSADOS DO ARQUIVO XLS ---');
        console.table(pacientesArquivo);
      } catch (_) { /* noop */ }
      
      // Carregamento dos dados do Firestore
      const { setores, leitos, pacientes } = await loadFirestoreData();

      // Diagnóstico: visualizar dados buscados do Firestore
      try {
        console.log('--- DADOS BUSCADOS DO FIRESTORE (SETORES) ---');
        console.table(Object.entries(setores).map(([key, v]) => ({ key, id: v.id, nome: (v.nome || '').toString() })));
        console.log('--- DADOS BUSCADOS DO FIRESTORE (LEITOS) ---');
        console.table(
          Object.entries(leitos)
            .filter(([key]) => !key.startsWith('__ID__'))
            .map(([key, v]) => ({ key, id: v.id, codigo: (v.codigo || '').toString() }))
        );
      } catch (_) { /* noop */ }
      // Identificar setores e leitos faltantes
      const setoresParaCriar = new Set();
      const leitosParaCriar = [];

      for (const paciente of pacientesArquivo) {
        const codigoLeitoNormalizado = normalizarCodigoLeito(paciente.codigoLeito);
        // Diagnóstico: mostrar exatamente o que está sendo comparado
        try {
          console.log(`Comparando Setor: [ARQ] '${paciente.nomeSetor}' vs [DB] exists=${!!setores[paciente.nomeSetor]}`);
          console.log(`Comparando Leito: [ARQ] '${paciente.codigoLeito}' vs [DB] exists=${!!leitos[codigoLeitoNormalizado]}`);
        } catch (_) { /* noop */ }
        if (!setores[paciente.nomeSetor]) {
          setoresParaCriar.add(paciente.nomeSetor);
        }
        if (!leitos[codigoLeitoNormalizado]) {
          leitosParaCriar.push({
            codigo: paciente.codigoLeito,
            nomeSetor: paciente.nomeSetor
          });
        }
      }

      // Verificar se há pendências
      if (setoresParaCriar.size > 0 || leitosParaCriar.length > 0) {
        // Há pendências - pausar processo e mostrar validação
        setSetoresFaltantes(Array.from(setoresParaCriar));
        
        // Organizar leitos faltantes por setor
        const leitosPorSetor = {};
        leitosParaCriar.forEach(leito => {
          if (!leitosPorSetor[leito.nomeSetor]) {
            leitosPorSetor[leito.nomeSetor] = [];
          }
          leitosPorSetor[leito.nomeSetor].push(leito.codigo);
        });
        setLeitosFaltantes(leitosPorSetor);
        
        // Diagnóstico: resultado da validação
        try {
          console.log('--- RESULTADO DA VALIDAÇÃO ---');
          console.log('Setores Faltantes Identificados:', Array.from(setoresParaCriar));
          console.log('Leitos Faltantes Identificados:', leitosPorSetor);
        } catch (_) { /* noop */ }
        
        setCurrentStep('validation');
        setIsProcessing(false);
        return; // Parar aqui - não prosseguir
      }

      // Se chegou aqui, não há pendências - prosseguir com análise
      await analyzeAndProceed(pacientesArquivo, setores, leitos, pacientes);

    } catch (error) {
      console.error('Erro ao processar arquivo:', error);
      toast.error('Erro ao processar arquivo: ' + error.message);
      setIsProcessing(false);
    }
  };

  // Nova função para análise após validação
  const analyzeAndProceed = async (pacientesArquivo, setores, leitos, pacientes) => {
  // MOVER DECLARAÇÃO DO pacientesArquivoMap PARA O INÍCIO (FIX DO BUG)
  const pacientesArquivoMap = {};
  pacientesArquivo.forEach(p => {
    pacientesArquivoMap[p.nomePaciente] = {
      ...p,
      codigoLeitoNormalizado: normalizarCodigoLeito(p.codigoLeito)
    };
  });

  // PARTE 1: SINCRONIZAÇÃO INTELIGENTE DE REGULAÇÕES
  const regulacoesProcessadas = {
    concluidas: [],
    conflitos: []
  };

  // Buscar pacientes com regulação ativa
  const pacientesComRegulacao = Object.values(pacientes).filter(p => p.regulacaoAtiva);
  
  for (const pacienteDB of pacientesComRegulacao) {
    const pacienteArquivo = pacientesArquivoMap[pacienteDB.nomePaciente];
    
    if (!pacienteArquivo) {
      // Paciente com regulação não encontrado na planilha - pode ter tido alta
      continue;
    }

    const { regulacaoAtiva } = pacienteDB;
    const leitoOrigemId = regulacaoAtiva.leitoOrigemId;
    const leitoDestinoId = regulacaoAtiva.leitoDestinoId;
    const leitoAtualArquivo = leitos[pacienteArquivo.codigoLeitoNormalizado];

    if (!leitoAtualArquivo) continue;

    // Cenário A: Paciente ainda na origem - continua pendente
    if (leitoAtualArquivo.id === leitoOrigemId) {
      continue; // Nenhuma ação necessária
    }

    // Cenário B: Regulação concluída com sucesso (destino exato)
    if (leitoAtualArquivo.id === leitoDestinoId) {
      regulacoesProcessadas.concluidas.push({
        paciente: pacienteDB,
        leitoDestino: leitoAtualArquivo,
        tipo: 'exato'
      });
      continue;
    }

    // Cenário C: Regulação por aproximação (mesmo setor do destino)
    const leitoDestinoDB = leitos[Object.keys(leitos).find(k => leitos[k].id === leitoDestinoId)];
    const setorDestinoId = leitoDestinoDB?.setorId;

    if (setorDestinoId && leitoAtualArquivo.setorId === setorDestinoId) {
      // Verificar conflitos: o leito atual já está ocupado por outro paciente?
      const outrosPacientesNesteLeito = Object.values(pacientesArquivoMap).filter(p => 
        p.nomePaciente !== pacienteDB.nomePaciente && 
        leitos[p.codigoLeitoNormalizado]?.id === leitoAtualArquivo.id
      );

      if (outrosPacientesNesteLeito.length > 0) {
        // CONFLITO: Leito ocupado por outro paciente
        regulacoesProcessadas.conflitos.push({
          pacienteRegulado: pacienteDB.nomePaciente,
          leitoConflito: pacienteArquivo.codigoLeito,
          pacienteConflitante: outrosPacientesNesteLeito[0].nomePaciente
        });
        continue;
      }

      // Sem conflito - marcar para conclusão por aproximação
      regulacoesProcessadas.concluidas.push({
        paciente: pacienteDB,
        leitoDestino: leitoAtualArquivo,
        leitoOriginalmente: leitoDestinoDB,
        tipo: 'aproximacao'
      });
    }
  }

  // PARTE 2: ANÁLISE TRADICIONAL DE RECONCILIAÇÃO
  const altas = [];
  const movimentacoes = [];
  const internacoes = [];

    // Regra 1: Altas (no Firestore mas não no arquivo)
    Object.keys(pacientes).forEach(nomePaciente => {
      if (!pacientesArquivoMap[nomePaciente]) {
        altas.push(pacientes[nomePaciente]);
      }
    });

    // Regra 2 e 3: Movimentações e Internações
    Object.keys(pacientesArquivoMap).forEach(nomePaciente => {
      const pacienteArquivo = pacientesArquivoMap[nomePaciente];
      const pacienteFirestore = pacientes[nomePaciente];

      if (pacienteFirestore) {
        // Verificar se mudou de leito
        const leitoAtualId = pacienteFirestore.leitoId;
        const leitoNovoId = leitos[pacienteArquivo.codigoLeitoNormalizado]?.id;
        
        if (leitoAtualId !== leitoNovoId) {
          movimentacoes.push({
            paciente: pacienteFirestore,
            dadosNovos: {
              ...pacienteArquivo,
              leitoId: leitoNovoId,
              setorId: setores[pacienteArquivo.nomeSetor].id
            }
          });
        }
      } else {
        // Nova internação
        internacoes.push({
          ...pacienteArquivo,
          leitoId: leitos[pacienteArquivo.codigoLeitoNormalizado].id,
          setorId: setores[pacienteArquivo.nomeSetor].id
        });
      }
    });

    setProcessedData({
      altas,
      movimentacoes,
      internacoes,
      novosSetores: [],
      novosLeitos: [],
      setores,
      leitos,
      regulacoesProcessadas // Adicionar dados de regulações
    });

    setSyncSummary({
      altas: altas.length,
      movimentacoes: movimentacoes.length,
      internacoes: internacoes.length,
      novosSetores: 0,
      novosLeitos: 0,
      regulacoesConcluidas: regulacoesProcessadas.concluidas.length,
      regulacoesConflitos: regulacoesProcessadas.conflitos.length
    });

    setCurrentStep('confirmation');
    setIsProcessing(false);
  };

  const executeSynchronization = async () => {
    if (!processedData) {
      toast.error('Nenhum dado processado para sincronizar.');
      return;
    }

    setIsProcessing(true);

    const leitosIdSet = new Set(Object.values(processedData.leitos || {}).map(leito => leito.id));
    const leitosMap = Object.values(processedData.leitos || {}).reduce((acc, leito) => {
      const codigo = leito?.codigoLeitoNormalizado || normalizarCodigoLeito(leito?.codigoLeito);
      if (codigo) {
        acc[codigo] = leito;
      }
      return acc;
    }, {});

    const setoresPorId = Object.values(processedData.setores || {}).reduce((acc, setorAtual) => {
      if (setorAtual?.id) {
        acc[setorAtual.id] = setorAtual;
      }
      return acc;
    }, {});

    const errosLeitosMap = new Map();
    const registrarErroLeito = (nome, codigo) => {
      const nomeFormatado = (nome || 'Paciente sem nome').toString().trim();
      const codigoNormalizado = normalizarCodigoLeito(codigo);
      const codigoFormatado = (codigo || 'Não informado').toString().trim() || 'Não informado';
      const key = `${nomeFormatado.toUpperCase()}|${(codigoNormalizado || codigoFormatado.toUpperCase() || 'NÃO INFORMADO')}`;

      if (!errosLeitosMap.has(key)) {
        errosLeitosMap.set(key, {
          nomePaciente: nomeFormatado || 'Paciente sem nome',
          codigoLeito: codigoFormatado || 'Não informado'
        });
      }
    };

    const pacientesDaPlanilha = parsedFileData || [];
    const pacientesValidosPlanilha = new Set();

    pacientesDaPlanilha.forEach(pacientePlanilha => {
      const codigoNormalizado = normalizarCodigoLeito(pacientePlanilha.codigoLeito);
      const nome = (pacientePlanilha.nomePaciente || '').toString().trim().toUpperCase();

      if (codigoNormalizado && leitosMap[codigoNormalizado]) {
        pacientesValidosPlanilha.add(`${nome}|${codigoNormalizado}`);
      } else {
        registrarErroLeito(pacientePlanilha.nomePaciente, pacientePlanilha.codigoLeito);
      }
    });

    const movimentacoesValidas = [];
    (processedData.movimentacoes || []).forEach(({ paciente, dadosNovos }) => {
      const codigoOriginal = dadosNovos?.codigoLeito ?? paciente?.codigoLeito;
      const codigoNormalizado = dadosNovos?.codigoLeitoNormalizado || normalizarCodigoLeito(codigoOriginal);
      const nomeDadosNovos = (dadosNovos?.nomePaciente || '').toString().trim().toUpperCase();
      const nomePaciente = nomeDadosNovos || (paciente?.nomePaciente || '').toString().trim().toUpperCase();
      const chaveValidacao = `${nomePaciente}|${codigoNormalizado}`;

      if (!codigoNormalizado || !leitosMap[codigoNormalizado]) {
        registrarErroLeito(dadosNovos?.nomePaciente || paciente?.nomePaciente, codigoOriginal);
        return;
      }

      if (pacientesValidosPlanilha.size > 0 && !pacientesValidosPlanilha.has(chaveValidacao)) {
        registrarErroLeito(dadosNovos?.nomePaciente || paciente?.nomePaciente, codigoOriginal);
        return;
      }

      movimentacoesValidas.push({
        paciente,
        dadosNovos: {
          ...dadosNovos,
          leitoId: leitosMap[codigoNormalizado].id
        }
      });
    });

    const internacoesValidas = [];
    (processedData.internacoes || []).forEach(paciente => {
      const codigoOriginal = paciente.codigoLeito;
      const codigoNormalizado = paciente.codigoLeitoNormalizado || normalizarCodigoLeito(codigoOriginal);
      const chaveValidacao = `${(paciente.nomePaciente || '').toString().trim().toUpperCase()}|${codigoNormalizado}`;

      if (!codigoNormalizado || !leitosMap[codigoNormalizado]) {
        registrarErroLeito(paciente.nomePaciente, codigoOriginal);
        return;
      }

      if (pacientesValidosPlanilha.size > 0 && !pacientesValidosPlanilha.has(chaveValidacao)) {
        registrarErroLeito(paciente.nomePaciente, codigoOriginal);
        return;
      }

      internacoesValidas.push({
        ...paciente,
        leitoId: leitosMap[codigoNormalizado].id
      });
    });

    const leitosNaoEncontrados = Array.from(errosLeitosMap.values());
    const logsRegulacoes = [];

    const totalOperacoes =
      (processedData.altas?.length || 0) +
      movimentacoesValidas.length +
      internacoesValidas.length +
      (processedData.regulacoesProcessadas?.concluidas?.length || 0);

    if (totalOperacoes === 0) {
      setIsProcessing(false);
      toast.error('Nenhuma operação válida encontrada. Verifique os leitos informados na planilha.');
      return;
    }

    try {
      const batch = writeBatch(db);
      const leitosParaAtualizar = new Set();
      const pacientesFinais = {};
      const leitosComStatusPersonalizado = new Map();

      // Executar altas (deletar pacientes)
      processedData.altas.forEach(paciente => {
        const pacienteRef = doc(db, PATIENTS_COLLECTION_PATH, paciente.id);
        batch.delete(pacienteRef);
        if (paciente.leitoId && leitosIdSet.has(paciente.leitoId)) {
          leitosParaAtualizar.add(paciente.leitoId);
        }
      });

      // Executar movimentações
      movimentacoesValidas.forEach(({ paciente, dadosNovos }) => {
        const pacienteRef = doc(db, PATIENTS_COLLECTION_PATH, paciente.id);
        const setorDestino = setoresPorId[dadosNovos.setorId];
        const updates = {
          leitoId: dadosNovos.leitoId,
          setorId: dadosNovos.setorId,
          especialidade: dadosNovos.especialidade
        };

        if (setorDestino?.tipoSetor === 'UTI') {
          updates.pedidoUTI = deleteField();
        }

        batch.update(pacienteRef, updates);
        leitosParaAtualizar.add(paciente.leitoId); // Leito antigo
        leitosParaAtualizar.add(dadosNovos.leitoId); // Leito novo
      });

      // Executar internações
      internacoesValidas.forEach(paciente => {
        const pacienteRef = doc(getPacientesCollection());
        batch.set(pacienteRef, {
          nomePaciente: paciente.nomePaciente,
          dataNascimento: paciente.dataNascimento,
          sexo: paciente.sexo,
          dataInternacao: parseDataHoraMV(paciente.dataInternacao) || serverTimestamp(),
          especialidade: paciente.especialidade,
          leitoId: paciente.leitoId,
          setorId: paciente.setorId
        });
        leitosParaAtualizar.add(paciente.leitoId);
      });

      // EXECUTAR CONCLUSÕES AUTOMÁTICAS DE REGULAÇÕES
      if (processedData.regulacoesProcessadas && processedData.regulacoesProcessadas.concluidas) {
        const montarInfoLeito = (leitoDoc) => {
          if (!leitoDoc) return null;
          const setorLeito = setoresPorId[leitoDoc.setorId] || null;

          return {
            id: leitoDoc.id,
            codigo: leitoDoc.codigoLeito || leitoDoc.codigo,
            codigoLeito: leitoDoc.codigoLeito || leitoDoc.codigo,
            siglaSetor: setorLeito?.siglaSetor,
            nomeSetor: setorLeito?.nomeSetor,
            setorId: leitoDoc.setorId || setorLeito?.id
          };
        };

        processedData.regulacoesProcessadas.concluidas.forEach(({ paciente, leitoDestino, leitoOriginalmente }) => {
          const leitoOrigemDoc = processedData.leitos[`__ID__${paciente.regulacaoAtiva.leitoOrigemId}`];
          const infoLeitoOrigem = montarInfoLeito(leitoOrigemDoc);
          const infoLeitoDestino = montarInfoLeito(leitoDestino);
          const infoLeitoOriginal = leitoOriginalmente ? montarInfoLeito(leitoOriginalmente) : null;
          const setorDestinoInfo = infoLeitoDestino?.setorId ? setoresPorId[infoLeitoDestino.setorId] : null;

          const resultado = adicionarConclusaoRegulacaoAoBatch({
            batch,
            paciente,
            currentUser,
            leitoOrigem: infoLeitoOrigem,
            leitoDestino: infoLeitoDestino,
            setorDestino: setorDestinoInfo,
            liberarLeitosAdicionais: infoLeitoOriginal && infoLeitoOriginal.id !== infoLeitoDestino?.id
              ? [infoLeitoOriginal]
              : []
          });

          if (resultado.destinoLeitoId) {
            pacientesFinais[resultado.destinoLeitoId] = true;
          }

          const leitoOrigemId = paciente.regulacaoAtiva?.leitoOrigemId || infoLeitoOrigem?.id;
          if (leitoOrigemId) {
            pacientesFinais[leitoOrigemId] = false;
            leitosComStatusPersonalizado.set(leitoOrigemId, 'Higienização');
          }

          if (infoLeitoOriginal && infoLeitoOriginal.id !== resultado.destinoLeitoId) {
            pacientesFinais[infoLeitoOriginal.id] = false;
          }

          resultado.leitosEnvolvidos.forEach((leitoId) => {
            if (leitoId && leitosIdSet.has(leitoId)) {
              leitosParaAtualizar.add(leitoId);
            }
          });

          logsRegulacoes.push(...resultado.logEntries);
        });
      }

      movimentacoesValidas.forEach(({ dadosNovos }) => {
        pacientesFinais[dadosNovos.leitoId] = true;
      });

      internacoesValidas.forEach(paciente => {
        pacientesFinais[paciente.leitoId] = true;
      });

      // Atualizar status de todos os leitos afetados
      leitosParaAtualizar.forEach(leitoId => {
        if (!leitosIdSet.has(leitoId)) {
          return;
        }
        if (leitosComStatusPersonalizado.has(leitoId)) {
          return;
        }

        const leitoRef = doc(db, BEDS_COLLECTION_PATH, leitoId);
        const novoStatus = pacientesFinais[leitoId] ? 'Ocupado' : 'Vago';
        batch.update(leitoRef, {
          status: novoStatus,
          historico: arrayUnion({
            status: novoStatus,
            timestamp: new Date()
          })
        });
      });

      // Executar batch
      await batch.commit();

      if (logsRegulacoes.length > 0) {
        for (const message of logsRegulacoes) {
          await logAction('Regulação de Leitos', message, currentUser);
        }
      }

      // Log de auditoria
      let logMessage = `Sincronização via MV concluída: ${syncSummary.altas} altas, ${syncSummary.movimentacoes} movimentações, ${syncSummary.internacoes} internações`;

      if (syncSummary.regulacoesConcluidas > 0) {
        logMessage += `, ${syncSummary.regulacoesConcluidas} regulações concluídas automaticamente`;
      }

      if (syncSummary.regulacoesConflitos > 0) {
        logMessage += `, ${syncSummary.regulacoesConflitos} conflitos de regulação detectados`;
      }

      logMessage += '.';

      await logAction('Regulação de Leitos', logMessage, currentUser);

      setCurrentStep('completed');

      const conclusoesAutomaticas = syncSummary.regulacoesConcluidas || 0;
      const conclusoesTexto = conclusoesAutomaticas > 0
        ? ` ${conclusoesAutomaticas} regulação${conclusoesAutomaticas > 1 ? 'es' : ''} concluída${conclusoesAutomaticas > 1 ? 's' : ''} automaticamente.`
        : '';

      if (leitosNaoEncontrados.length > 0) {
        const detalhes = leitosNaoEncontrados
          .map(({ nomePaciente, codigoLeito }) => `${nomePaciente} (Leito ${codigoLeito || 'não informado'})`)
          .join(', ');

        toast.success(
          `Sincronização concluída.${conclusoesTexto} Atenção: Os seguintes pacientes não foram importados pois seus leitos não foram encontrados: ${detalhes}.`
        );
      } else {
        toast.success(`Sincronização concluída com sucesso!${conclusoesTexto}`);
      }

    } catch (error) {
      console.error('Erro na sincronização:', error);
      toast.error('Erro na sincronização: ' + error.message);
    }

    setIsProcessing(false);
  };

  // Nova função para revalidar cadastros
  const revalidarCadastros = async () => {
    if (!parsedFileData) return;

    setIsProcessing(true);

    try {
      // Carregamento dos dados atualizados do Firestore
      const { setores, leitos, pacientes } = await loadFirestoreData();

      // Diagnóstico: visualizar dados buscados do Firestore (revalidação)
      try {
        console.log('--- (REVALIDAÇÃO) DADOS BUSCADOS DO FIRESTORE (SETORES) ---');
        console.table(Object.entries(setores).map(([key, v]) => ({ key, id: v.id, nome: (v.nome || '').toString() })));
        console.log('--- (REVALIDAÇÃO) DADOS BUSCADOS DO FIRESTORE (LEITOS) ---');
        console.table(
          Object.entries(leitos)
            .filter(([key]) => !key.startsWith('__ID__'))
            .map(([key, v]) => ({ key, id: v.id, codigo: (v.codigo || '').toString() }))
        );
      } catch (_) { /* noop */ }

      // Verificar novamente se ainda há pendências
      const setoresParaCriar = new Set();
      const leitosParaCriar = [];

      for (const paciente of parsedFileData) {
        const codigoLeitoNormalizado = normalizarCodigoLeito(paciente.codigoLeito);
        // Diagnóstico: mostrar exatamente o que está sendo comparado (revalidação)
        try {
          console.log(`(REVALIDAÇÃO) Comparando Setor: [ARQ] '${paciente.nomeSetor}' vs [DB] exists=${!!setores[paciente.nomeSetor]}`);
          console.log(`(REVALIDAÇÃO) Comparando Leito: [ARQ] '${paciente.codigoLeito}' vs [DB] exists=${!!leitos[codigoLeitoNormalizado]}`);
        } catch (_) { /* noop */ }
        if (!setores[paciente.nomeSetor]) {
          setoresParaCriar.add(paciente.nomeSetor);
        }
        if (!leitos[codigoLeitoNormalizado]) {
          leitosParaCriar.push({
            codigo: paciente.codigoLeito,
            nomeSetor: paciente.nomeSetor
          });
        }
      }

      if (setoresParaCriar.size > 0 || leitosParaCriar.length > 0) {
        // Ainda há pendências - atualizar listas
        setSetoresFaltantes(Array.from(setoresParaCriar));
        
        const leitosPorSetor = {};
        leitosParaCriar.forEach(leito => {
          if (!leitosPorSetor[leito.nomeSetor]) {
            leitosPorSetor[leito.nomeSetor] = [];
          }
          leitosPorSetor[leito.nomeSetor].push(leito.codigo);
        });
        setLeitosFaltantes(leitosPorSetor);
        
        // Diagnóstico: resultado da validação (revalidação)
        try {
          console.log('--- (REVALIDAÇÃO) RESULTADO DA VALIDAÇÃO ---');
          console.log('Setores Faltantes Identificados:', Array.from(setoresParaCriar));
          console.log('Leitos Faltantes Identificados:', leitosPorSetor);
        } catch (_) { /* noop */ }
        
        toast.info('Ainda há pendências. Continue o cadastro.');
      } else {
        // Todas as pendências foram resolvidas!
        setSetoresFaltantes([]);
        setLeitosFaltantes([]);
        
        // Prosseguir com análise
        await analyzeAndProceed(parsedFileData, setores, leitos, pacientes);
        toast.success('Todas as pendências foram resolvidas! Prosseguindo...');
      }

    } catch (error) {
      console.error('Erro ao revalidar:', error);
      toast.error('Erro ao revalidar: ' + error.message);
    }

    setIsProcessing(false);
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copiado para a área de transferência!');
    } catch (error) {
      toast.error('Erro ao copiar');
    }
  };

  const resetModal = () => {
    setCurrentStep('instructions');
    setSelectedFile(null);
    setProcessedData(null);
    setSyncSummary({ altas: 0, movimentacoes: 0, internacoes: 0, novosSetores: 0, novosLeitos: 0 });
    setIsProcessing(false);
    setSetoresFaltantes([]);
    setLeitosFaltantes([]);
    setParsedFileData(null);
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  const renderInstructions = () => (
    <div className="space-y-6">
      <Alert>
        <FileSpreadsheet className="h-4 w-4" />
        <AlertDescription>
          <div className="space-y-3">
            <p className="font-semibold">Orientações: Como Obter o Arquivo</p>
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li>
                Acesse o painel do Soul MV:{' '}
                <a 
                  href="http://1495prd.cloudmv.com.br/Painel/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  Acessar Painel <ExternalLink className="h-3 w-3" />
                </a>
              </li>
              <li><strong>Login:</strong> <code>nir</code>, <strong>Senha:</strong> <code>nir</code></li>
              <li>Em "Indicadores", localize o painel <strong>"NIR - Ocupação Setores"</strong></li>
              <li>Clique no ícone de banco de dados, depois em <strong>"Exportar"</strong></li>
              <li>Selecione o formato <strong>"XLS"</strong> e clique no ícone de disquete para salvar</li>
              <li>Volte para esta tela e selecione o arquivo salvo abaixo</li>
            </ol>
          </div>
        </AlertDescription>
      </Alert>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">
            Selecionar Arquivo XLS
          </label>
          <Input
            type="file"
            accept=".xls,.xlsx"
            onChange={handleFileChange}
            className="cursor-pointer"
          />
        </div>

        <Button 
          onClick={processFile}
          disabled={!selectedFile || isProcessing}
          className="w-full"
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Processando Arquivo...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Processar Arquivo
            </>
          )}
        </Button>
      </div>
    </div>
  );

  const renderValidation = () => (
    <div className="space-y-6">
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <p className="font-semibold mb-2">Pré-requisitos pendentes</p>
          <p>
            Foram encontrados setores e/ou leitos no arquivo que não existem no sistema. 
            Por favor, realize o cadastro manual no "Gerenciamento de Leitos" para prosseguir com a sincronização.
          </p>
        </AlertDescription>
      </Alert>

      <div className="max-h-[40vh] overflow-y-auto space-y-4">
        {setoresFaltantes.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Setores que precisam ser cadastrados:</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="p-3 bg-muted rounded-md">
                <code className="text-sm">{setoresFaltantes.join(', ')}</code>
              </div>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => copyToClipboard(setoresFaltantes.join(', '))}
                className="w-full"
              >
                <Copy className="h-4 w-4 mr-2" />
                Copiar Lista de Setores
              </Button>
            </CardContent>
          </Card>
        )}

        {Object.keys(leitosFaltantes).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Leitos que precisam ser cadastrados:</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(leitosFaltantes).map(([setor, leitos]) => (
                <div key={setor} className="space-y-2">
                  <p className="text-sm font-medium">{setor}:</p>
                  <div className="p-3 bg-muted rounded-md">
                    <code className="text-sm">{leitos.join(', ')}</code>
                  </div>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => copyToClipboard(leitos.join(', '))}
                    className="w-full"
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copiar Leitos do {setor}
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      <div className="flex gap-3">
        <Button onClick={handleClose} variant="outline" className="flex-1">
          Cancelar
        </Button>
        <Button 
          onClick={revalidarCadastros}
          disabled={isProcessing}
          className="flex-1"
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Verificando...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Verificar Cadastros Novamente
            </>
          )}
        </Button>
      </div>
    </div>
  );

  const renderConfirmation = () => (
    <div className="space-y-6">

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <UserMinus className="h-4 w-4 text-red-500" />
              Altas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{syncSummary.altas}</p>
            <p className="text-xs text-muted-foreground">Leitos a serem liberados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4 text-orange-500" />
              Movimentações
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{syncSummary.movimentacoes}</p>
            <p className="text-xs text-muted-foreground">Pacientes mudando de leito</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-green-500" />
              Internações
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{syncSummary.internacoes}</p>
            <p className="text-xs text-muted-foreground">Novas internações</p>
          </CardContent>
        </Card>

        {/* Regulações Concluídas */}
        {syncSummary.regulacoesConcluidas > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-blue-500" />
                Regulações Automáticas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{syncSummary.regulacoesConcluidas}</p>
              <p className="text-xs text-muted-foreground">Concluídas automaticamente</p>
            </CardContent>
          </Card>
        )}

        {/* Conflitos de Regulação */}
        {syncSummary.regulacoesConflitos > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                Conflitos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{syncSummary.regulacoesConflitos}</p>
              <p className="text-xs text-muted-foreground">Regulações com conflito</p>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="flex gap-3">
        <Button onClick={handleClose} variant="outline" className="flex-1">
          Cancelar
        </Button>
        <Button 
          onClick={executeSynchronization}
          disabled={isProcessing}
          className="flex-1"
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Sincronizando...
            </>
          ) : (
            <>
              <Database className="h-4 w-4 mr-2" />
              Confirmar e Sincronizar
            </>
          )}
        </Button>
      </div>
    </div>
  );

  const renderCompleted = () => (
    <div className="text-center space-y-4">
      <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
      <div>
        <h3 className="text-lg font-semibold">Sincronização Concluída!</h3>
        <p className="text-muted-foreground">
          Os dados foram sincronizados com sucesso.
        </p>
      </div>
      <Button onClick={handleClose} className="w-full">
        Fechar
      </Button>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar e Sincronizar Pacientes do Soul MV</DialogTitle>
          <DialogDescription>
            {currentStep === 'instructions' && 'Siga as orientações para obter e processar o arquivo de ocupação dos leitos.'}
            {currentStep === 'processing' && 'Processando arquivo e analisando diferenças...'}
            {currentStep === 'validation' && 'É necessário cadastrar alguns setores e leitos antes de prosseguir.'}
            {currentStep === 'confirmation' && 'Revise as alterações antes de confirmar a sincronização.'}
            {currentStep === 'completed' && 'Processo concluído com sucesso.'}
          </DialogDescription>
        </DialogHeader>

        {currentStep === 'instructions' && renderInstructions()}
        {currentStep === 'processing' && (
          <div className="text-center py-8">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p>Processando arquivo e comparando com dados atuais...</p>
          </div>
        )}
        {currentStep === 'validation' && renderValidation()}
        {currentStep === 'confirmation' && renderConfirmation()}
        {currentStep === 'completed' && renderCompleted()}
      </DialogContent>
    </Dialog>
  );
};

export default ImportarPacientesMVModal;