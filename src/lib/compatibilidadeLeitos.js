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
 * Gera um relatório detalhado de compatibilidade de leitos para um paciente.
 * @param {Object} pacienteAlvo - O paciente enriquecido (com idade).
 * @param {Object} hospitalData - O objeto de dados completo do pipeline.
 * @param {string} modo - 'enfermaria' ou 'uti'.
 * @returns {Object} Um relatório estruturado com os resultados de cada regra.
 */
export const getRelatorioCompatibilidade = (pacienteAlvo, hospitalData, modo = 'enfermaria') => {
  const { leitos, pacientesPorLeitoId, quartosPorId, setoresPorId } = hospitalData;

  // Filtro inicial: Apenas leitos com status 'Vago' ou 'Higienização'
  const leitosDisponiveis = leitos.filter(leito => {
    const status = (leito.status || '').trim().toUpperCase();
    return status === 'VAGO' || status === 'HIGIENIZAÇÃO';
  });

  // MODO UTI: Lógica simples e separada
  if (modo === 'uti') {
    const leitosDeUTI = leitosDisponiveis.filter(leito => {
      const setor = setoresPorId?.get?.(leito.setorId);
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

  // MODO ENFERMARIA: Aplica todas as regras
  const relatorio = {};

  const chavesIsolamentoPaciente = getChavesIsolamentoAtivo(pacienteAlvo);

  // --- Regra de PCP ---
  const elegivelPCP = (
    (pacienteAlvo.idade ?? 0) >= 18 &&
    (pacienteAlvo.idade ?? 0) <= 60 &&
    chavesIsolamentoPaciente.size === 0 &&
    pacienteAlvo.setorOrigem !== 'CC - RECUPERAÇÃO'
  );
  relatorio.porPCP = {
    elegivel: elegivelPCP,
    mensagem: elegivelPCP ? 'Paciente elegível para leitos PCP.' : 'Paciente NÃO elegível para leitos PCP.',
    leitos: elegivelPCP ? leitosDisponiveis.filter(l => l.isPCP) : [],
  };

  // --- Regras de Quarto (Sexo e Isolamento) ---
  const leitosPorSexo = [];
  const leitosPorIsolamento = [];

  for (const leito of leitosDisponiveis) {
    // Ignora leitos PCP se o paciente não for elegível
    if (leito.isPCP && !elegivelPCP) {
      continue;
    }

    const quarto = quartosPorId?.get?.(leito.quartoId);
    if (!quarto) continue; // Leito sem quarto não pode ser avaliado

    const outrosLeitosNoQuarto = hospitalData.leitos.filter(l => l.quartoId === leito.quartoId && l.id !== leito.id);
    const ocupantes = outrosLeitosNoQuarto
      .map(l => pacientesPorLeitoId?.get?.(l.id))
      .filter(Boolean);

    // Validação de Sexo
    const sexosOcupantes = new Set(ocupantes.map(o => o.sexo).filter(Boolean));
    if (sexosOcupantes.size <= 1) {
      const [sexoQuarto] = [...sexosOcupantes];
      if (!sexoQuarto || (pacienteAlvo.sexo && pacienteAlvo.sexo === sexoQuarto)) {
        leitosPorSexo.push(leito);
      }
    }

    // Validação de Isolamento
    const chavesOcupantes = new Set();
    ocupantes.forEach(o => getChavesIsolamentoAtivo(o).forEach(chave => chavesOcupantes.add(chave)));

    const quartoIsolado = chavesOcupantes.size > 0;
    const pacienteIsolado = chavesIsolamentoPaciente.size > 0;

    // Se o quarto está isolado, o paciente precisa ter o mesmo isolamento
    if (quartoIsolado) {
      if (
        pacienteIsolado &&
        chavesIsolamentoPaciente.size === chavesOcupantes.size &&
        [...chavesIsolamentoPaciente].every(c => chavesOcupantes.has(c))
      ) {
        leitosPorIsolamento.push(leito);
      }
    }
    // Se o quarto não está isolado, o paciente também não pode ter isolamento
    else if (!pacienteIsolado) {
      leitosPorIsolamento.push(leito);
    }
  }

  relatorio.porSexo = {
    mensagem: `Paciente do sexo '${pacienteAlvo.sexo}' é compatível com quartos femininos/masculinos ou vazios.`,
    leitos: leitosPorSexo,
  };
  relatorio.porIsolamento = {
    mensagem: `Paciente com isolamentos [${[...chavesIsolamentoPaciente]}] é compatível com quartos de mesma coorte ou vazios.`,
    leitos: leitosPorIsolamento,
  };

  // --- Resultado Final ---
  // A compatibilidade final é a interseção de todas as regras
  const idLeitosPorSexo = new Set(leitosPorSexo.map(l => l.id));
  const idLeitosPorIsolamento = new Set(leitosPorIsolamento.map(l => l.id));

  const compativeisFinais = leitosDisponiveis.filter(leito => {
    if (leito.isPCP && !elegivelPCP) return false;
    return idLeitosPorSexo.has(leito.id) && idLeitosPorIsolamento.has(leito.id);
  });

  return { modo, compativeisFinais, regras: relatorio };
};
