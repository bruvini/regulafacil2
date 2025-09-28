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
  const pacienteProcessado = { ...paciente };

  const sexoUpper = (paciente.sexo || '').trim().toUpperCase();
  pacienteProcessado.sexo = (sexoUpper === 'M' || sexoUpper === 'F') ? sexoUpper : null;

  if (paciente.leitoId && typeof paciente.leitoId === 'object') {
    pacienteProcessado.leitoId = paciente.leitoId.id || null;
  }

  if (Array.isArray(paciente.isolamentos)) {
    pacienteProcessado.isolamentos = paciente.isolamentos
      .map(iso => {
        if (!iso || !iso.infeccaoId) return null;

        const infeccaoId = (typeof iso.infeccaoId === 'object') ? iso.infeccaoId.id : iso.infeccaoId;
        const dadosInfeccao = infeccoesMap.get(infeccaoId);

        if (!dadosInfeccao) {
          return {
            ...iso,
            statusConsideradoAtivo: ['CONFIRMADO', 'SUSPEITO'].includes((iso.status || '').toUpperCase()),
          };
        }

        return {
          ...iso,
          ...dadosInfeccao,
          statusConsideradoAtivo: ['CONFIRMADO', 'SUSPEITO'].includes((iso.status || '').toUpperCase()),
        };
      })
      .filter(Boolean);
  } else {
    pacienteProcessado.isolamentos = [];
  }

  return pacienteProcessado;
};

export const getHospitalData = async () => {
  console.log('[HospitalData] Iniciando pipeline completo: Busca > Enriquecimento > Estruturação de Coorte');

  const [pacientesCrus, leitos, setores, quartos, infeccoes] = await Promise.all([
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
          acc[chave] = { id: `quarto-dinamico-${chave}`, nomeQuarto: `Quarto ${chave}`, leitos: [] };
        }
        acc[chave].leitos.push(leito);
        return acc;
      }, {});
      quartosDoSetor = Object.values(gruposQuarto);
    } else {
      quartosDoSetor = quartos
        .filter(q => q.setorId === setor.id)
        .map(quarto => ({
          ...quarto,
          leitos: leitosDoSetor.filter(l => (quarto.leitosIds || []).includes(l.id)),
        }));
    }

    quartosDoSetor.forEach(quarto => {
      const ocupantes = quarto.leitos.map(l => l.paciente).filter(Boolean);
      let restricao = null;

      if (ocupantes.length > 0) {
        const sexosOcupantes = new Set(ocupantes.map(o => o.sexo).filter(Boolean));
        const chavesIsolamento = new Set();
        ocupantes.forEach(o => {
          (o.isolamentos || []).filter(iso => iso.statusConsideradoAtivo).forEach(iso => {
            const chave = (iso.siglaInfeccao || iso.sigla || '').toLowerCase();
            if (chave) {
              chavesIsolamento.add(chave);
            }
          });
        });

        if (sexosOcupantes.size === 1) {
          restricao = {
            sexo: [...sexosOcupantes][0],
            isolamentos: [...chavesIsolamento].filter(Boolean),
          };
        }
      }

      quarto.leitos.forEach(leito => {
        const status = (leito.status || '').toUpperCase();
        if ((status === 'VAGO' || status === 'HIGIENIZAÇÃO') && restricao) {
          leito.restricaoCoorte = restricao;
        } else {
          delete leito.restricaoCoorte;
        }
      });
    });

    return { ...setor, quartos: quartosDoSetor };
  });

  console.log('[HospitalData] Pipeline com ESTRUTURA HIERÁRQUICA e COORTES concluído.');
  return {
    estrutura: estruturaFinal,
    pacientes: pacientesProcessados,
  };
};

export { fetchCollection, processarPaciente };
