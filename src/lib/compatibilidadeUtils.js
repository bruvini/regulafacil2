// src/lib/compatibilidadeUtils.js

const normalizarData = (valor) => {
  if (!valor) return null;
  if (valor instanceof Date) return valor;
  if (typeof valor === 'string' || typeof valor === 'number') {
    const parsed = new Date(valor);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  if (typeof valor === 'object' && typeof valor.seconds === 'number') {
    return new Date(valor.seconds * 1000);
  }
  return null;
};

const calcularIdade = (dataNascimento) => {
  const data = normalizarData(dataNascimento);
  if (!data) return null;

  const agora = new Date();
  let idade = agora.getFullYear() - data.getFullYear();
  const mes = agora.getMonth() - data.getMonth();
  if (mes < 0 || (mes === 0 && agora.getDate() < data.getDate())) {
    idade -= 1;
  }
  return idade;
};

const getChavesIsolamentoAtivo = (paciente) => {
  if (!paciente || !Array.isArray(paciente.isolamentos)) return new Set();
  return new Set(
    paciente.isolamentos
      .filter(iso => iso.statusConsideradoAtivo)
      .map(iso => (iso.siglaInfeccao || iso.sigla || '').toLowerCase())
      .filter(Boolean)
  );
};

export const encontrarLeitosCompativeis = (pacienteAlvo, hospitalData, modo = 'enfermaria') => {
  const { estrutura } = hospitalData;
  if (!pacienteAlvo || !estrutura) return [];

  const setoresIterable = Array.isArray(estrutura)
    ? estrutura
    : Object.values(estrutura).flat();

  const tipoSetorAlvo = (modo === 'uti' ? 'UTI' : 'ENFERMARIA');
  const idade = calcularIdade(pacienteAlvo.dataNascimento);
  const chavesPaciente = getChavesIsolamentoAtivo(pacienteAlvo);

  const leitosCompativeis = [];

  const avaliarLeito = (leito, leitosDoQuarto = [leito]) => {
    if (!['Vago', 'Higienização'].includes(leito.status)) return;

    if (modo === 'uti') {
      leitosCompativeis.push(leito);
      return;
    }

    // Regra PCP (Refatorada para maior clareza e correção)
    if (leito.isPCP) {
      // Para um leito PCP, o paciente DEVE ser elegível.
      // Vamos verificar todas as condições de elegibilidade.
      const isAgeOk = idade !== null && idade >= 18 && idade <= 60;
      const hasNoIsolation = chavesPaciente.size === 0;
      const isOriginOk = (pacienteAlvo.setorOrigem || '').toUpperCase() !== 'CC - RECUPERAÇÃO';

      // O paciente só é elegível se TODAS as condições forem verdadeiras.
      const isPcpEligible = isAgeOk && hasNoIsolation && isOriginOk;

      // Se o paciente NÃO for elegível para PCP, este leito não é compatível.
      if (!isPcpEligible) {
        return; // Rejeita o leito
      }
      // Se for elegível, a função continua para as próximas verificações (coorte, sexo, etc.).
    }

    // Regras de Coorte (Sexo e Isolamento)
    const coorte = leito.restricaoCoorte;
    const outrosLeitosDoQuarto = (leitosDoQuarto || []).filter((outro) => outro?.id !== leito.id);
    const quartoDisponivelParaIsolamento = outrosLeitosDoQuarto.every((outro) =>
      ['Vago', 'Higienização'].includes(outro?.status)
    );

    if (coorte) { // Quarto ocupado
      if (pacienteAlvo.sexo !== coorte.sexo) return; // Rejeita por sexo
      const isolamentosCoorte = new Set(coorte.isolamentos || []);

      if (chavesPaciente.size > 0) {
        const todosIsolamentosCompativeis = [...chavesPaciente].every((c) => isolamentosCoorte.has(c));
        if (!todosIsolamentosCompativeis) {
          return; // Rejeita por isolamento incompatível
        }
      } else if (isolamentosCoorte.size > 0) {
        return; // Paciente sem isolamento não pode entrar em quarto com isolamento ativo
      }
    } else if (chavesPaciente.size > 0 && !quartoDisponivelParaIsolamento) {
      return; // Rejeita se paciente tem isolamento e quarto não está completamente vazio
    }

    leitosCompativeis.push(leito);
  };

  setoresIterable.forEach(setor => {
    if ((setor.tipoSetor || '').toUpperCase() !== tipoSetorAlvo) return;

    (setor.quartos || []).forEach(quarto => {
      const leitosQuarto = quarto.leitos || [];
      leitosQuarto.forEach(leitoQuarto => avaliarLeito(leitoQuarto, leitosQuarto));
    });

    (setor.leitosSemQuarto || []).forEach(leitoIsolado => avaliarLeito(leitoIsolado, [leitoIsolado]));
  });

  return leitosCompativeis;
};

export { calcularIdade, getChavesIsolamentoAtivo };

const normalizarTexto = (valor) => (valor || '').toString().trim().toUpperCase();

const obterStatusIsolamentoAtivo = (isolamento) => {
  if (!isolamento) return false;
  if (typeof isolamento.statusConsideradoAtivo === 'boolean') {
    return isolamento.statusConsideradoAtivo;
  }
  const status = (isolamento.status || '').toLowerCase();
  return status === 'confirmado' || status === 'suspeito';
};

const extrairIdInfeccao = (isolamento) => {
  if (!isolamento) return null;
  const { infeccaoId } = isolamento;
  if (typeof infeccaoId === 'object' && infeccaoId !== null) {
    if (typeof infeccaoId.id !== 'undefined') {
      return String(infeccaoId.id);
    }
    if (typeof infeccaoId.value !== 'undefined') {
      return String(infeccaoId.value);
    }
  }
  if (typeof infeccaoId !== 'undefined') {
    return String(infeccaoId);
  }
  if (typeof isolamento.id !== 'undefined') {
    return String(isolamento.id);
  }
  return null;
};

const obterIsolamentosAtivosIds = (paciente) => {
  if (!paciente || !Array.isArray(paciente.isolamentos)) return [];
  const ids = paciente.isolamentos
    .filter(obterStatusIsolamentoAtivo)
    .map(extrairIdInfeccao)
    .filter(Boolean);
  return Array.from(new Set(ids)).sort();
};

const motivosRisco = {
  SETOR_ABERTO: 'setor_aberto',
  AUSENCIA_COORTE: 'ausencia_coorte',
  COORTE_INCOMPATIVEL: 'coorte_incompativel',
};

const registrarRisco = (mapa, pacienteId, motivo, contexto = {}) => {
  if (!pacienteId) return;
  const existente = mapa.get(pacienteId);
  if (!existente) {
    mapa.set(pacienteId, {
      risco: true,
      motivos: [motivo],
      detalhes: contexto ? [contexto] : [],
    });
    return;
  }

  if (!existente.motivos.includes(motivo)) {
    existente.motivos.push(motivo);
  }
  if (contexto && Object.keys(contexto).length) {
    existente.detalhes.push(contexto);
  }
};

export const identificarRiscosDeContaminacao = (
  pacientes = [],
  leitos = [],
  quartos = [],
  setores = [],
) => {
  const riscos = new Map();

  if (!Array.isArray(pacientes) || !Array.isArray(leitos)) {
    return riscos;
  }

  const leitosPorId = new Map(leitos.map(leito => [leito.id, leito]));
  const setoresPorId = new Map(setores.map(setor => [setor.id, setor]));
  const quartosPorId = new Map((Array.isArray(quartos) ? quartos : []).map(quarto => [quarto.id, quarto]));

  const pacientesEnriquecidos = pacientes.map(paciente => {
    const leito = leitosPorId.get(paciente.leitoId) || null;
    const setor = leito ? setoresPorId.get(leito.setorId) : setoresPorId.get(paciente.setorId) || null;
    const quarto = leito?.quartoId ? quartosPorId.get(leito.quartoId) || null : null;
    const isolamentosIds = obterIsolamentosAtivosIds(paciente);

    return {
      id: paciente.id,
      nome: paciente.nomePaciente || paciente.nome || '',
      leito,
      quarto,
      setor,
      setorTipo: normalizarTexto(setor?.tipoSetor),
      setorNome: normalizarTexto(setor?.nomeSetor || setor?.nome || setor?.siglaSetor),
      isolamentosIds,
      possuiIsolamentoAtivo: isolamentosIds.length > 0,
    };
  });

  // Risco por setor aberto (PS)
  pacientesEnriquecidos.forEach(paciente => {
    if (!paciente.possuiIsolamentoAtivo) return;
    if (['PS DECISÃO CLINICA', 'PS DECISÃO CIRURGICA'].includes(paciente.setorNome)) {
      registrarRisco(riscos, paciente.id, motivosRisco.SETOR_ABERTO, {
        tipo: 'setor',
        setorNome: paciente.setorNome,
      });
    }
  });

  // Agrupar por quarto para regras de enfermaria
  const pacientesPorQuarto = new Map();
  pacientesEnriquecidos.forEach(paciente => {
    const quartoId = paciente.leito?.quartoId;
    if (!quartoId) return;
    if (!pacientesPorQuarto.has(quartoId)) {
      pacientesPorQuarto.set(quartoId, []);
    }
    pacientesPorQuarto.get(quartoId).push(paciente);
  });

  pacientesPorQuarto.forEach((ocupantes, quartoId) => {
    if (!ocupantes || ocupantes.length <= 1) return;

    const setorTipo = ocupantes[0]?.setorTipo;
    if (setorTipo !== 'ENFERMARIA') return;

    const possuiSemIsolamento = ocupantes.some(ocupante => !ocupante.possuiIsolamentoAtivo);
    const comIsolamento = ocupantes.filter(ocupante => ocupante.possuiIsolamentoAtivo);

    if (!comIsolamento.length) return;

    if (possuiSemIsolamento) {
      comIsolamento.forEach(ocupante => {
        registrarRisco(riscos, ocupante.id, motivosRisco.AUSENCIA_COORTE, {
          tipo: 'ausencia_coorte',
          quartoId,
        });
      });
      return;
    }

    const chaveIsolamentos = comIsolamento.map(ocupante => ocupante.isolamentosIds.join('|'));
    const todasIguais = chaveIsolamentos.every((chave, index, arr) => chave === arr[0]);

    if (!todasIguais) {
      ocupantes.forEach(ocupante => {
        registrarRisco(riscos, ocupante.id, motivosRisco.COORTE_INCOMPATIVEL, {
          tipo: 'coorte_incompativel',
          quartoId,
        });
      });
    }
  });

  return riscos;
};
