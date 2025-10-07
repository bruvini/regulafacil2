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

const SETORES_PS_ABERTOS = new Set([
  'PS DECISÃO CLINICA',
  'PS DECISÃO CIRURGICA',
].map(nome => nome.toUpperCase()));

const normalizarTexto = (valor) => (valor || '').toString().trim();

const textoUpper = (valor) => normalizarTexto(valor).toUpperCase();

const conjuntosIguais = (setA, setB) => {
  if (setA.size !== setB.size) return false;
  for (const valor of setA) {
    if (!setB.has(valor)) return false;
  }
  return true;
};

export const TIPOS_RISCO_CONTAMINACAO = {
  SETOR_ABERTO: 'setor_aberto',
  FALTA_COHORTE: 'falta_coorte',
  COORTE_INCOMPATIVEL: 'coorte_incompativel',
};

const criarMensagemRisco = (tipo, contexto = {}) => {
  const { setorNome, quartoNome } = contexto;
  switch (tipo) {
    case TIPOS_RISCO_CONTAMINACAO.SETOR_ABERTO:
      return `Paciente com isolamento em setor aberto (${setorNome || 'Setor não identificado'})`;
    case TIPOS_RISCO_CONTAMINACAO.FALTA_COHORTE:
      return `Paciente isolado compartilhando quarto com paciente não isolado (${setorNome || 'Setor'}, ${quartoNome || 'Quarto'})`;
    case TIPOS_RISCO_CONTAMINACAO.COORTE_INCOMPATIVEL:
      return `Pacientes com isolamentos diferentes no mesmo quarto (${setorNome || 'Setor'}, ${quartoNome || 'Quarto'})`;
    default:
      return 'Risco de contaminação cruzada identificado';
  }
};

const adicionarRisco = (mapa, paciente, tipo, contexto = {}, contextoId = null) => {
  if (!paciente?.id) return;
  const listaAtual = mapa.get(paciente.id) || [];
  const chaveContexto = contextoId || `${tipo}-${contexto?.setorId || ''}-${contexto?.quartoId || ''}`;
  if (listaAtual.some(item => item.tipo === tipo && item.chaveContexto === chaveContexto)) {
    return;
  }

  const entrada = {
    tipo,
    mensagem: criarMensagemRisco(tipo, contexto),
    contexto,
    chaveContexto,
  };

  mapa.set(paciente.id, [...listaAtual, entrada]);
};

export const identificarRiscosContaminacao = (hospitalData = {}) => {
  const riscosPorPaciente = new Map();
  const { estrutura = {}, pacientesEnriquecidos = [] } = hospitalData;

  if (!estrutura || !pacientesEnriquecidos.length) {
    return riscosPorPaciente;
  }

  const setores = Array.isArray(estrutura)
    ? estrutura
    : Object.values(estrutura).flat().filter(Boolean);

  const obterContextoLeito = (setor, quarto, leito) => ({
    setorId: setor?.id || null,
    setorNome: normalizarTexto(setor?.nomeSetor || setor?.nome || setor?.siglaSetor || ''),
    setorTipo: textoUpper(setor?.tipoSetor),
    quartoId: quarto?.id || null,
    quartoNome: normalizarTexto(quarto?.nomeQuarto || ''),
    leitoId: leito?.id || null,
    leitoCodigo: normalizarTexto(leito?.codigoLeito || ''),
  });

  setores.forEach(setor => {
    const setorNomeUpper = textoUpper(setor?.nomeSetor || setor?.nome || setor?.siglaSetor);
    const tipoSetorUpper = textoUpper(setor?.tipoSetor);

    const processarLeitos = (leitos, quarto = null) => {
      (leitos || []).forEach(leito => {
        const paciente = leito?.paciente;
        if (!paciente) return;
        const chavesPaciente = getChavesIsolamentoAtivo(paciente);
        if (!chavesPaciente.size) return;

        if (SETORES_PS_ABERTOS.has(setorNomeUpper)) {
          adicionarRisco(
            riscosPorPaciente,
            paciente,
            TIPOS_RISCO_CONTAMINACAO.SETOR_ABERTO,
            obterContextoLeito(setor, quarto, leito),
            `ps-${paciente.id}-${setor?.id || setorNomeUpper}`,
          );
        }
      });
    };

    (setor?.quartos || []).forEach(quarto => {
      processarLeitos(quarto?.leitos || [], quarto);
    });

    processarLeitos(setor?.leitosSemQuarto || [], null);

    if (tipoSetorUpper !== 'ENFERMARIA') {
      return;
    }

    (setor?.quartos || []).forEach(quarto => {
      const leitosQuarto = quarto?.leitos || [];
      if (!leitosQuarto.length) return;

      const ocupantes = leitosQuarto
        .map(leito => leito?.paciente)
        .filter(Boolean);

      if (ocupantes.length <= 1) {
        return;
      }

      const ocupantesInfo = ocupantes.map(paciente => ({
        paciente,
        chaves: getChavesIsolamentoAtivo(paciente),
      }));

      const isolados = ocupantesInfo.filter(info => info.chaves.size > 0);
      if (!isolados.length) {
        return;
      }

      const existeNaoIsolado = ocupantesInfo.some(info => info.chaves.size === 0);
      if (existeNaoIsolado) {
        isolados.forEach(info => {
          adicionarRisco(
            riscosPorPaciente,
            info.paciente,
            TIPOS_RISCO_CONTAMINACAO.FALTA_COHORTE,
            obterContextoLeito(setor, quarto, leitosQuarto.find(l => l?.paciente?.id === info.paciente.id)),
            `falta-coorte-${quarto?.id || quarto?.nomeQuarto || ''}`,
          );
        });
      }

      if (isolados.length >= 2) {
        const chavesReferencia = isolados[0].chaves;
        const todosIguais = isolados.every(info => conjuntosIguais(info.chaves, chavesReferencia));
        if (!todosIguais) {
          ocupantesInfo.forEach(info => {
            adicionarRisco(
              riscosPorPaciente,
              info.paciente,
              TIPOS_RISCO_CONTAMINACAO.COORTE_INCOMPATIVEL,
              obterContextoLeito(setor, quarto, leitosQuarto.find(l => l?.paciente?.id === info.paciente.id)),
              `coorte-incompativel-${quarto?.id || quarto?.nomeQuarto || ''}`,
            );
          });
        }
      }
    });
  });

  return riscosPorPaciente;
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
