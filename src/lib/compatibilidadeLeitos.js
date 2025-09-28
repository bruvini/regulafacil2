// src/lib/compatibilidadeLeitos.js

// === FUNÇÕES AUXILIARES DE LÓGICA PURA ===

/**
 * Extrai um conjunto de chaves de isolamento ativas de um paciente.
 * Ex: ['kpc', 'mrsa']
 * @param {Object} paciente O objeto do paciente enriquecido.
 * @returns {Set<string>} Um Set com as siglas normalizadas dos isolamentos ativos.
 */
export const getChavesIsolamentoAtivo = (paciente) => {
  if (!paciente || !Array.isArray(paciente.isolamentos)) {
    return new Set();
  }
  const chaves = paciente.isolamentos
    .filter(iso => iso.statusConsideradoAtivo)
    .map(iso => (iso.siglaInfeccao || iso.sigla || '').toLowerCase())
    .filter(Boolean);
  return new Set(chaves);
};

// === FUNÇÃO PRINCIPAL ORQUESTRADORA ===

/**
 * Gera um relatório detalhado de compatibilidade de leitos para um paciente,
 * consumindo a estrutura hierárquica pré-processada pelo pipeline.
 * @param {Object} pacienteAlvo - O paciente enriquecido (com idade).
 * @param {Object} hospitalData - O objeto de dados completo do pipeline.
 * @param {string} modo - 'enfermaria' ou 'uti'.
 * @returns {Object} Um relatório estruturado com os resultados de cada regra.
 */
export const getRelatorioCompatibilidade = (pacienteAlvo, hospitalData, modo = 'enfermaria') => {
  const { leitos, setores = [] } = hospitalData;

  const leitosDisponiveis = leitos.filter(leito => {
    const status = (leito.status || '').trim().toUpperCase();
    return status === 'VAGO' || status === 'HIGIENIZAÇÃO';
  });

  if (modo === 'uti') {
    const setoresPorId = new Map(setores.map(setor => [setor.id, setor]));
    const leitosDeUTI = leitosDisponiveis.filter(leito => {
      const setor = setoresPorId.get(leito.setorId);
      return (setor?.tipoSetor || '').toUpperCase() === 'UTI';
    });
    return {
      modo,
      compativeisFinais: leitosDeUTI,
      regras: {
        porTipoSetor: {
          mensagem: 'Modo UTI: Exibindo apenas leitos de setores do tipo UTI.',
          leitos: leitosDeUTI,
        },
      },
    };
  }

  const relatorio = {};
  const chavesPaciente = getChavesIsolamentoAtivo(pacienteAlvo);

  const elegivelPCP = (
    (pacienteAlvo.idade ?? 0) >= 18 &&
    (pacienteAlvo.idade ?? 0) <= 60 &&
    chavesPaciente.size === 0 &&
    (pacienteAlvo.setorOrigem || '').toUpperCase() !== 'CC - RECUPERAÇÃO'
  );
  relatorio.porPCP = {
    elegivel: elegivelPCP,
    mensagem: elegivelPCP
      ? `Elegível para leitos PCP (idade ${pacienteAlvo.idade}, sem isolamento).`
      : `NÃO elegível para leitos PCP (idade ${pacienteAlvo.idade}, isolamento ou origem CC).`,
    leitos: elegivelPCP ? leitosDisponiveis.filter(l => l.isPCP) : [],
  };

  const leitosPorSexo = [];
  const leitosPorIsolamento = [];

  for (const leito of leitosDisponiveis) {
    if (leito.isPCP && !elegivelPCP) continue;

    const coorte = leito.restricaoCoorte;

    if (!coorte) {
      leitosPorSexo.push(leito);
      if (chavesPaciente.size === 0) {
        leitosPorIsolamento.push(leito);
      }
      continue;
    }

    if (pacienteAlvo.sexo && pacienteAlvo.sexo === coorte.sexo) {
      leitosPorSexo.push(leito);
    }

    const isolamentosCoorte = Array.isArray(coorte.isolamentos) ? coorte.isolamentos : [];
    if (
      chavesPaciente.size === isolamentosCoorte.length &&
      [...chavesPaciente].every(chave => isolamentosCoorte.includes(chave))
    ) {
      leitosPorIsolamento.push(leito);
    }
  }

  relatorio.porSexo = {
    mensagem: `Compatível com quartos do sexo '${pacienteAlvo.sexo}' ou vazios.`,
    leitos: leitosPorSexo,
  };
  relatorio.porIsolamento = {
    mensagem: `Compatível com quartos de coorte [${[...chavesPaciente]}] ou vazios.`,
    leitos: leitosPorIsolamento,
  };

  const idLeitosPorSexo = new Set(leitosPorSexo.map(l => l.id));
  const idLeitosPorIsolamento = new Set(leitosPorIsolamento.map(l => l.id));

  const compativeisFinais = leitosDisponiveis.filter(leito => {
    if (leito.isPCP && !elegivelPCP) return false;
    return idLeitosPorSexo.has(leito.id) && idLeitosPorIsolamento.has(leito.id);
  });

  return { modo, compativeisFinais, regras: relatorio };
};
