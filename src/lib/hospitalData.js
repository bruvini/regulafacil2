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
 * Função principal do pipeline. Agora ela enriquece E estrutura os dados do hospital
 * em uma hierarquia de Setores > Quartos > Leitos, aplicando as regras de coorte.
 */
export const getHospitalData = async () => {
  console.log('[HospitalData] Iniciando busca, enriquecimento e ESTRUTURAÇÃO de dados...');

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

  const infeccoesMap = new Map(infeccoes.map(inf => [inf.id, inf]));
  const pacientesProcessados = pacientesCrus.map(p => processarPaciente(p, infeccoesMap));
  const pacientesPorLeitoId = new Map(
    pacientesProcessados
      .filter(p => p.leitoId)
      .map(p => [p.leitoId, p]),
  );

  // Vincula pacientes já processados aos leitos correspondentes
  const leitosComPacientes = leitos.map(leito => ({
    ...leito,
    paciente: pacientesPorLeitoId.get(leito.id) || null,
  }));

  const estruturaFinal = setores.map(setor => {
    const leitosDoSetor = leitosComPacientes.filter(l => l.setorId === setor.id);
    let quartosDoSetor = [];

    if ((setor.tipoSetor || '').toUpperCase() === 'ENFERMARIA') {
      const gruposQuarto = leitosDoSetor.reduce((acc, leito) => {
        const chave = (leito.codigoLeito || 'SEM-CODIGO').substring(0, 3);
        if (!acc[chave]) {
          acc[chave] = {
            id: `quarto-dinamico-${setor.id}-${chave}`,
            nomeQuarto: `Quarto ${chave}`,
            setorId: setor.id,
            leitos: [],
          };
        }
        const leitoAssociado = leito;
        leitoAssociado.quartoId = acc[chave].id;
        acc[chave].leitos.push(leitoAssociado);
        return acc;
      }, {});
      quartosDoSetor = Object.values(gruposQuarto);
    } else {
      const quartosOficiais = quartos.filter(q => q.setorId === setor.id);
      quartosDoSetor = quartosOficiais.map(quarto => {
        const idsPermitidos = new Set(quarto.leitosIds || []);
        const leitosDoQuarto = leitosDoSetor.filter(l => idsPermitidos.has(l.id) || l.quartoId === quarto.id);
        leitosDoQuarto.forEach(leito => {
          leito.quartoId = quarto.id;
        });
        return {
          ...quarto,
          leitos: leitosDoQuarto,
        };
      });

      const leitosSemQuarto = leitosDoSetor.filter(leito => !quartosDoSetor.some(quarto => quarto.leitos.includes(leito)));
      if (leitosSemQuarto.length > 0) {
        const quartoGenericoId = `quarto-generico-${setor.id}`;
        leitosSemQuarto.forEach(leito => {
          leito.quartoId = quartoGenericoId;
        });
        quartosDoSetor.push({
          id: quartoGenericoId,
          nomeQuarto: 'Quarto Não Definido',
          setorId: setor.id,
          leitos: leitosSemQuarto,
        });
      }
    }

    for (const quarto of quartosDoSetor) {
      const ocupantes = quarto.leitos.map(l => l.paciente).filter(Boolean);
      let restricao = null;

      if (ocupantes.length > 0) {
        const sexosOcupantes = new Set(ocupantes.map(o => o.sexo).filter(Boolean));
        const chavesIsolamento = new Set();
        ocupantes.forEach(o => {
          (o.isolamentos || [])
            .filter(iso => iso.statusConsideradoAtivo)
            .forEach(iso => {
              const chave = (iso.siglaInfeccao || iso.sigla || '').toLowerCase();
              if (chave) {
                chavesIsolamento.add(chave);
              }
            });
        });

        if (sexosOcupantes.size === 1) {
          restricao = {
            sexo: [...sexosOcupantes][0],
            isolamentos: [...chavesIsolamento],
          };
        }
      }

      for (const leito of quarto.leitos) {
        const status = (leito.status || '').toUpperCase();
        if ((status === 'VAGO' || status === 'HIGIENIZAÇÃO') && restricao) {
          leito.restricaoCoorte = restricao;
        }
      }
    }

    return { ...setor, quartos: quartosDoSetor };
  });

  const hospitalData = {
    estrutura: estruturaFinal,
    pacientes: pacientesProcessados,
    leitos: leitosComPacientes,
    setores,
    quartos,
    infeccoes,
  };

  console.log('[HospitalData] Pipeline com ESTRUTURA HIERÁRQUICA concluído.', hospitalData);
  return hospitalData;
};
