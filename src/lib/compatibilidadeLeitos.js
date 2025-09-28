// src/lib/compatibilidadeLeitos.js

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

export const getRelatorioCompatibilidade = (pacienteAlvo, hospitalData, modo = 'enfermaria') => {
  const { estrutura = [] } = hospitalData || {};
  const tipoSetorAlvo = (modo === 'uti' ? 'UTI' : 'ENFERMARIA');
  const leitosDisponiveis = [];

  estrutura
    .filter(setor => (setor.tipoSetor || '').toUpperCase() === tipoSetorAlvo)
    .forEach(setor => {
      (setor.quartos || []).forEach(quarto => {
        (quarto.leitos || []).forEach(leito => {
          const status = (leito.status || '').trim().toUpperCase();
          if (status === 'VAGO' || status === 'HIGIENIZAÇÃO') {
            leitosDisponiveis.push(leito);
          }
        });
      });
    });

  if (modo === 'uti') {
    return {
      modo,
      compativeisFinais: leitosDisponiveis,
      regras: {
        porTipoSetor: {
          mensagem: 'Modo UTI: Exibindo apenas leitos de setores do tipo UTI.',
          leitos: leitosDisponiveis,
        },
      },
    };
  }

  const relatorio = {};
  const chavesPaciente = getChavesIsolamentoAtivo(pacienteAlvo);

  const idadePaciente = pacienteAlvo?.idade ?? 0;
  const origemPaciente = (pacienteAlvo?.setorOrigem || '').toUpperCase();
  const elegivelPCP = (
    idadePaciente >= 18 &&
    idadePaciente <= 60 &&
    chavesPaciente.size === 0 &&
    origemPaciente !== 'CC - RECUPERAÇÃO'
  );

  relatorio.porPCP = {
    elegivel: elegivelPCP,
    mensagem: elegivelPCP
      ? `Elegível para leitos PCP (idade ${idadePaciente}, sem isolamento).`
      : `NÃO elegível para leitos PCP (idade ${idadePaciente}, isolamento ou origem CC).`,
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

    const isolamentosCoorte = new Set(Array.isArray(coorte.isolamentos) ? coorte.isolamentos : []);
    if (
      chavesPaciente.size === isolamentosCoorte.size &&
      [...chavesPaciente].every(chave => isolamentosCoorte.has(chave))
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
