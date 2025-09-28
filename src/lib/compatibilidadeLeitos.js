// src/lib/compatibilidadeLeitos.js

// === FUNÇÕES AUXILIARES DE LÓGICA PURA ===

/**
 * REGRA 1: Verifica se o status de um leito permite que ele seja ocupado.
 * Conforme definido, 'Vago' e 'Higienização' são os únicos status disponíveis.
 * @param {Object} leito O objeto do leito.
 * @returns {Boolean} Verdadeiro se o leito está disponível.
 */
const isLeitoDisponivel = (leito) => {
  const statusDisponiveis = new Set(['VAGO', 'HIGIENIZAÇÃO']);
  const statusLeito = (leito.status || '').trim().toUpperCase();
  return statusDisponiveis.has(statusLeito);
};

/**
 * REGRA 2: Verifica se um paciente atende às restrições de um leito PCP.
 * Regra: Idade entre 18 e 60 anos E sem isolamentos ativos.
 * @param {Object} paciente O objeto do paciente enriquecido.
 * @param {Object} leito O objeto do leito.
 * @returns {Boolean} Verdadeiro se o paciente pode ocupar um leito PCP.
 */
const atendeRestricaoDePCP = (paciente, leito) => {
  if (!leito.isPCP) {
    return true; // Se o leito não é PCP, a regra não se aplica.
  }
  const idade = paciente.idade || 0; // Supondo que a idade seja pré-calculada.
  const temIsolamentoAtivo = paciente.isolamentos.some(iso => iso.statusConsideradoAtivo);
  
  return idade >= 18 && idade <= 60 && !temIsolamentoAtivo;
};

/**
 * Extrai um conjunto de chaves de isolamento ativas de um paciente.
 * Ex: ['kpc', 'mrsa']
 * @param {Object} paciente O objeto do paciente enriquecido.
 * @returns {Set<string>} Um Set com as siglas normalizadas dos isolamentos ativos.
 */
const getChavesIsolamentoAtivo = (paciente) => {
  if (!paciente || !Array.isArray(paciente.isolamentos)) {
    return new Set();
  }
  const chaves = paciente.isolamentos
    .filter(iso => iso.statusConsideradoAtivo)
    .map(iso => (iso.siglaInfeccao || iso.sigla || '').toLowerCase())
    .filter(Boolean);
  return new Set(chaves);
};

/**
 * REGRA 3 E 4: Verifica compatibilidade de Sexo e Isolamento em um quarto.
 * Esta é a regra mais complexa e crítica.
 * @param {Object} paciente O paciente a ser alocado.
 * @param {Array<Object>} ocupantes Lista de pacientes que já estão no quarto.
 * @returns {{compativel: boolean, motivo: string}} Objeto com o resultado da verificação.
 */
const isQuartoCompativel = (paciente, ocupantes) => {
  // Se não há ocupantes, o quarto é sempre compatível.
  if (ocupantes.length === 0) {
    return { compativel: true, motivo: '' };
  }

  // --- Verificação de Sexo ---
  const sexosOcupantes = new Set(ocupantes.map(o => o.sexo).filter(Boolean));
  // Se o quarto já tem mais de um sexo (dado inconsistente), bloqueia.
  if (sexosOcupantes.size > 1) {
    return { compativel: false, motivo: 'Sexo inconsistente entre ocupantes' };
  }
  const [sexoQuarto] = [...sexosOcupantes];
  // Se o quarto tem um sexo definido...
  if (sexoQuarto) {
    // ...e o paciente tem sexo diferente, bloqueia.
    if (paciente.sexo && paciente.sexo !== sexoQuarto) {
      return { compativel: false, motivo: `Incompatibilidade de Sexo (Paciente ${paciente.sexo} vs Quarto ${sexoQuarto})` };
    }
    // ...e o paciente não tem sexo definido, bloqueia.
    if (!paciente.sexo) {
      return { compativel: false, motivo: 'Paciente com sexo indefinido' };
    }
  }

  // --- Verificação de Isolamento ---
  const chavesPaciente = getChavesIsolamentoAtivo(paciente);
  const chavesOcupantes = new Set();
  ocupantes.forEach(o => {
    getChavesIsolamentoAtivo(o).forEach(chave => chavesOcupantes.add(chave));
  });

  const pacienteTemIsolamento = chavesPaciente.size > 0;
  const quartoTemIsolamento = chavesOcupantes.size > 0;

  // Cenário 1: Quarto está isolado.
  if (quartoTemIsolamento) {
    if (!pacienteTemIsolamento) {
      return { compativel: false, motivo: 'Paciente sem isolamento em quarto isolado' };
    }
    // Compara se os conjuntos de isolamentos são idênticos.
    if (chavesPaciente.size !== chavesOcupantes.size || ![...chavesPaciente].every(chave => chavesOcupantes.has(chave))) {
       const motivo = `Isolamentos Incompatíveis ([${[...chavesPaciente]}] vs [${[...chavesOcupantes]}])`;
       return { compativel: false, motivo };
    }
  } 
  // Cenário 2: Quarto NÃO está isolado, mas paciente está.
  else if (pacienteTemIsolamento) {
    return { compativel: false, motivo: 'Paciente com isolamento em quarto não isolado' };
  }

  // Se passou por todas as regras, o quarto é compatível.
  return { compativel: true, motivo: '' };
};


// === FUNÇÃO PRINCIPAL ORQUESTRADORA ===

/**
 * Filtra uma lista de leitos para encontrar os que são compatíveis com um dado paciente.
 * Retorna um relatório detalhado de leitos compatíveis e rejeitados.
 * @param {Object} pacienteAlvo - O paciente para o qual buscamos um leito.
 * @param {Object} hospitalData - O objeto de dados completo retornado pelo pipeline.
 * @returns {{compativeis: Array, rejeitados: Array}}
 */
export const getLeitosCompativeis = (pacienteAlvo, hospitalData) => {
  const { leitos, pacientes, quartos } = hospitalData;
  const compativeis = [];
  const rejeitados = [];

  // Criar um mapa de pacientes por ID de leito para encontrar ocupantes rapidamente.
  const pacientesPorLeitoId = new Map(
    pacientes.filter(p => p.leitoId).map(p => [p.leitoId, p])
  );

  for (const leito of leitos) {
    // REGRA 1: O leito está disponível?
    if (!isLeitoDisponivel(leito)) {
      rejeitados.push({ leito, motivo: `Status Inválido (${leito.status})` });
      continue; // Pula para o próximo leito
    }

    // REGRA 2: O paciente atende às restrições de PCP?
    if (!atendeRestricaoDePCP(pacienteAlvo, leito)) {
      rejeitados.push({ leito, motivo: 'Regra de PCP não atendida' });
      continue;
    }

    // REGRAS 3 e 4: O quarto é compatível (Sexo e Isolamento)?
    const quartoDoLeito = quartos.find(q => q.id === leito.quartoId);
    if (quartoDoLeito) {
      // Encontra todos os leitos do mesmo quarto, exceto o atual.
      const outrosLeitosNoQuarto = leitos.filter(l => l.quartoId === leito.quartoId && l.id !== leito.id);
      // Encontra os pacientes que ocupam esses outros leitos.
      const ocupantes = outrosLeitosNoQuarto
        .map(l => pacientesPorLeitoId.get(l.id))
        .filter(Boolean);

      const { compativel, motivo } = isQuartoCompativel(pacienteAlvo, ocupantes);
      if (!compativel) {
        rejeitados.push({ leito, motivo });
        continue;
      }
    }
    
    // Se passou por todas as regras, o leito é compatível!
    compativeis.push(leito);
  }

  return { compativeis, rejeitados };
};
