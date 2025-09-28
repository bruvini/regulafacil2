// src/lib/hospitalData.js

import {
  getPacientesCollection,
  getLeitosCollection,
  getSetoresCollection,
  getQuartosCollection,
  getInfeccoesCollection,
  getDocs,
} from '@/lib/firebase';

/**
 * Busca todos os documentos de uma coleção específica.
 * @param {Function} getCollection - A função que retorna a referência da coleção.
 * @returns {Array} Uma lista de documentos, cada um com seu id.
 */
const fetchCollection = async (getCollection) => {
  const snapshot = await getDocs(getCollection());
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

/**
 * Processa um único paciente para limpar e enriquecer seus dados.
 * @param {Object} paciente - O objeto bruto do paciente do Firestore.
 * @param {Map} infeccoesMap - Um mapa de ID da infecção para o objeto da infecção.
 * @returns {Object} O objeto do paciente processado.
 */
const processarPaciente = (paciente, infeccoesMap) => {
  // 1. Normalização Estrutural Básica
  const pacienteProcessado = { ...paciente };

  // Garante que 'sexo' seja estritamente 'M' ou 'F'
  const sexoUpper = (paciente.sexo || '').trim().toUpperCase();
  pacienteProcessado.sexo = (sexoUpper === 'M' || sexoUpper === 'F') ? sexoUpper : null;

  // Garante que 'leitoId' seja uma string, se existir
  if (paciente.leitoId && typeof paciente.leitoId === 'object') {
    pacienteProcessado.leitoId = paciente.leitoId.id || null;
  }

  // 2. Enriquecimento dos Isolamentos
  if (Array.isArray(paciente.isolamentos)) {
    pacienteProcessado.isolamentos = paciente.isolamentos
      .map(iso => {
        if (!iso || !iso.infeccaoId) return null; // Ignora isolamentos malformados

        const infeccaoId = (typeof iso.infeccaoId === 'object') ? iso.infeccaoId.id : iso.infeccaoId;
        const dadosInfeccao = infeccoesMap.get(infeccaoId);

        // Se não encontrarmos a infecção no mapa, não podemos enriquecer, mas mantemos o que temos.
        if (!dadosInfeccao) {
          return {
            ...iso,
            statusConsideradoAtivo: ['CONFIRMADO', 'SUSPEITO'].includes((iso.status || '').toUpperCase()),
          };
        }

        // Retorna o isolamento original mesclado com os dados da infecção
        return {
          ...iso,
          ...dadosInfeccao, // Injeta siglaInfeccao, nomeInfeccao, etc.
          statusConsideradoAtivo: ['CONFIRMADO', 'SUSPEITO'].includes((iso.status || '').toUpperCase()),
        };
      })
      .filter(Boolean); // Remove quaisquer isolamentos nulos
  } else {
    pacienteProcessado.isolamentos = []; // Garante que seja sempre um array
  }

  return pacienteProcessado;
};

/**
 * Função principal do pipeline. Busca todos os dados do hospital, processa-os
 * e retorna uma estrutura de dados limpa e pronta para uso.
 */
export const getHospitalData = async () => {
  console.log('[HospitalData] Iniciando busca e processamento de dados...');

  // 1. Buscar todas as coleções em paralelo para otimizar o tempo de carregamento.
  const [
    pacientesCrus,
    leitos,
    setores,
    quartos,
    infeccoes,
  ] = await Promise.all([
    fetchCollection(getPacientesCollection),
    fetchCollection(getLeitosCollection),
    fetchCollection(getSetoresCollection),
    fetchCollection(getQuartosCollection),
    fetchCollection(getInfeccoesCollection),
  ]);

  // 2. Criar um mapa de infecções para consulta rápida (muito mais performático do que buscar a cada vez).
  const infeccoesMap = new Map(infeccoes.map(inf => [inf.id, inf]));
  console.log(`[HospitalData] Mapa de ${infeccoesMap.size} infecções criado.`);

  // 3. Processar cada paciente para enriquecer seus dados.
  const pacientesProcessados = pacientesCrus.map(p => processarPaciente(p, infeccoesMap));
  console.log(`[HospitalData] ${pacientesProcessados.length} pacientes processados e enriquecidos.`);

  // 4. Pré-processar dados em Mapas para acesso rápido e eficiente
  const pacientesPorLeitoId = new Map(
    pacientesProcessados
      .filter(p => p.leitoId)
      .map(p => [p.leitoId, p])
  );
  const quartosPorId = new Map(quartos.map(q => [q.id, q]));
  const setoresPorId = new Map(setores.map(s => [s.id, s]));

  // 5. Retornar um objeto único com todos os dados prontos para o aplicativo.
  const hospitalData = {
    pacientes: pacientesProcessados,
    leitos,
    setores,
    quartos,
    infeccoes,
    pacientesPorLeitoId,
    quartosPorId,
    setoresPorId,
  };

  console.log('[HospitalData] Pipeline concluído.', hospitalData);
  return hospitalData;
};
