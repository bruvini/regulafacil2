// src/lib/compatibilidadeUtils.js

const removerAcentos = (texto = '') =>
  texto
    .toString()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');

const normalizarData = (valor) => {
  if (!valor) return null;

  if (valor instanceof Date) {
    return Number.isNaN(valor.getTime()) ? null : valor;
  }

  if (typeof valor === 'string') {
    const texto = valor.trim();
    if (!texto) return null;

    if (/^\d{2}\/\d{2}\/\d{4}/.test(texto)) {
      const [dataParte, horaParte] = texto.split(' ');
      const [dia, mes, ano] = dataParte.split('/').map((parte) => parseInt(parte, 10));
      if (Number.isNaN(dia) || Number.isNaN(mes) || Number.isNaN(ano)) return null;

      if (horaParte && /^\d{2}:\d{2}/.test(horaParte)) {
        const [hora, minuto] = horaParte.split(':').map((parte) => parseInt(parte, 10));
        const data = new Date(ano, (mes || 1) - 1, dia, hora || 0, minuto || 0);
        return Number.isNaN(data.getTime()) ? null : data;
      }

      const data = new Date(ano, (mes || 1) - 1, dia);
      return Number.isNaN(data.getTime()) ? null : data;
    }

    const parsed = new Date(texto);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (typeof valor === 'number' && Number.isFinite(valor)) {
    const data = new Date(valor);
    return Number.isNaN(data.getTime()) ? null : data;
  }

  if (typeof valor === 'object') {
    if (typeof valor.toDate === 'function') {
      const data = valor.toDate();
      return data instanceof Date && !Number.isNaN(data.getTime()) ? data : null;
    }

    const segundos =
      typeof valor.seconds === 'number'
        ? valor.seconds
        : typeof valor._seconds === 'number'
          ? valor._seconds
          : null;

    if (segundos !== null) {
      const nanos =
        typeof valor.nanoseconds === 'number'
          ? valor.nanoseconds
          : typeof valor._nanoseconds === 'number'
            ? valor._nanoseconds
            : 0;
      const data = new Date(segundos * 1000 + nanos / 1e6);
      return Number.isNaN(data.getTime()) ? null : data;
    }
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

const normalizarPrimeiroNome = (nome) => {
  if (!nome) return '';
  const texto = nome.toString().trim();
  if (!texto) return '';

  const [primeiroNome] = texto.split(/\s+/);
  if (!primeiroNome) return '';

  return removerAcentos(primeiroNome).toUpperCase();
};

const extrairIdInfeccao = (iso) => {
  if (!iso) return null;

  const infeccaoId = iso.infeccaoId;
  if (typeof infeccaoId === 'object' && infeccaoId !== null) {
    if (typeof infeccaoId.id !== 'undefined' && infeccaoId.id !== null) {
      return infeccaoId.id;
    }
  } else if (typeof infeccaoId !== 'undefined' && infeccaoId !== null) {
    return infeccaoId;
  }

  if (iso.infeccao && typeof iso.infeccao.id !== 'undefined' && iso.infeccao.id !== null) {
    return iso.infeccao.id;
  }

  if (typeof iso.idInfeccao !== 'undefined' && iso.idInfeccao !== null) {
    return iso.idInfeccao;
  }

  if (typeof iso.id !== 'undefined' && iso.id !== null) {
    return iso.id;
  }

  return null;
};

const getChavesIsolamentoAtivo = (paciente) => {
  if (!paciente || !Array.isArray(paciente.isolamentos)) return new Set();
  const ids = new Set();

  paciente.isolamentos
    .filter(iso => iso.statusConsideradoAtivo)
    .forEach(iso => {
      const id = extrairIdInfeccao(iso);
      if (id !== null && id !== undefined) {
        ids.add(String(id));
      }
    });

  return ids;
};

const SETORES_PS_ABERTOS = new Set([
  'PS DECISÃO CLINICA',
  'PS DECISÃO CIRURGICA',
].map(nome => nome.toUpperCase()));

const normalizarTexto = (valor) => (valor || '').toString().trim();

const textoUpper = (valor) => removerAcentos(normalizarTexto(valor)).toUpperCase();

const normalizarParaComparacao = (texto) =>
  removerAcentos(String(texto || ''))
    .trim()
    .toLowerCase();

const conjuntosIguais = (setA, setB) => {
  if (setA.size !== setB.size) return false;
  for (const valor of setA) {
    if (!setB.has(valor)) return false;
  }
  return true;
};

export const SETORES_CRITICOS_CONTRA_FLUXO = [
  'SALA DE EMERGENCIA',
  'SALA LARANJA',
  'UNID. AVC AGUDO',
];

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

export const encontrarLeitosCompativeis = (
  pacienteAlvo,
  hospitalData,
  modo = 'enfermaria',
  opcoesEspeciais = {},
) => {
  const { estrutura } = hospitalData;
  if (!pacienteAlvo || !estrutura) return [];

  const { filtroSetoresEspecial } = opcoesEspeciais || {};

  const setoresIterableBase = Array.isArray(estrutura)
    ? estrutura
    : Object.values(estrutura).flat();

  const filtroSetoresUpper = Array.isArray(filtroSetoresEspecial) && filtroSetoresEspecial.length > 0
    ? new Set(filtroSetoresEspecial.map((nome) => textoUpper(nome)))
    : null;

  const modoContraFluxoAtivo = Boolean(filtroSetoresUpper);

  const setoresIterable = filtroSetoresUpper
    ? setoresIterableBase.filter((setor) => {
        const nomeSetor = textoUpper(setor?.nomeSetor || setor?.nome || setor?.siglaSetor);
        return filtroSetoresUpper.has(nomeSetor);
      })
    : setoresIterableBase;

  const tipoSetorAlvo = (modo === 'uti' ? 'UTI' : 'ENFERMARIA');
  const idade = calcularIdade(pacienteAlvo.dataNascimento);
  const chavesPaciente = getChavesIsolamentoAtivo(pacienteAlvo);

  const leitosCompativeis = [];

  const statusLivre = new Set(['vago', 'higienizacao']);

  const avaliarLeito = (leito, leitosDoQuarto = [leito], contextoLocal = {}) => {
    if (!statusLivre.has(normalizarParaComparacao(leito.status))) return;

    if (modoContraFluxoAtivo) {
      leitosCompativeis.push(leito);
      return;
    }

    const setorNomeUpper = textoUpper(
      contextoLocal?.setorNome
        || contextoLocal?.setor?.nomeSetor
        || contextoLocal?.setor?.nome
        || contextoLocal?.setor?.siglaSetor
        || leito?.setorNome
        || '',
    );

    const quartoNomeBruto = normalizarTexto(
      contextoLocal?.quartoNome
        || contextoLocal?.quarto?.nomeQuarto
        || leito?.quartoNome
        || '',
    );

    const quartoIdentificador = normalizarTexto(quartoNomeBruto.replace(/^quarto\s+/i, ''));
    const quartoIdentificadorUpper = textoUpper(quartoIdentificador);

    const isQuarto504Especial =
      setorNomeUpper === 'UNID. CLINICA MEDICA'
      && quartoIdentificadorUpper === '504';

    if (isQuarto504Especial) {
      leitosCompativeis.push(leito);
      return;
    }

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
      const origemNormalizada = [
        pacienteAlvo.setorOrigemNome,
        pacienteAlvo.setorOrigem,
        pacienteAlvo.origemSetorNome,
        pacienteAlvo.origem,
        pacienteAlvo.setorNome,
        pacienteAlvo.localizacaoAtual,
      ]
        .map((valor) => removerAcentos(textoUpper(valor)))
        .find((texto) => texto);
      const isOriginOk = origemNormalizada !== 'CC - RECUPERACAO';

      // O paciente só é elegível se TODAS as condições forem verdadeiras.
      const isPcpEligible = isAgeOk && hasNoIsolation && isOriginOk;

      // Se o paciente NÃO for elegível para PCP, este leito não é compatível.
      if (!isPcpEligible) {
        return; // Rejeita o leito
      }
      // Se for elegível, a função continua para as próximas verificações (coorte, sexo, etc.).
    }

    const outrosLeitosDoQuarto = (leitosDoQuarto || []).filter((outro) => outro?.id !== leito.id);
    const todosLivres = outrosLeitosDoQuarto.every((outro) =>
      statusLivre.has(normalizarParaComparacao(outro?.status)) || !outro?.paciente,
    );

    if (todosLivres) {
      leitosCompativeis.push(leito);
      return;
    }

    const ocupantes = outrosLeitosDoQuarto
      .map(outro => outro?.paciente)
      .filter(Boolean);

    if (!ocupantes.length) {
      // Existem leitos não livres, mas sem paciente registrado: rejeitar por segurança.
      return;
    }

    if (!pacienteAlvo?.sexo) {
      return;
    }

    const sexosCompativeis = ocupantes.every(ocupante => (ocupante?.sexo || null) === pacienteAlvo.sexo);
    if (!sexosCompativeis) {
      return;
    }

    const isolamentosPaciente = chavesPaciente;
    const coorteValida = ocupantes.every(ocupante => {
      const isolamentosOcupante = getChavesIsolamentoAtivo(ocupante);
      return conjuntosIguais(isolamentosOcupante, isolamentosPaciente);
    });

    if (!coorteValida) {
      return;
    }

    const primeiroNomePaciente = normalizarPrimeiroNome(pacienteAlvo?.nomePaciente || pacienteAlvo?.nome);
    if (primeiroNomePaciente) {
      const primeirosNomesOcupantes = new Set(
        ocupantes
          .map(ocupante => normalizarPrimeiroNome(ocupante?.nomePaciente || ocupante?.nome))
          .filter(Boolean),
      );

      if (primeirosNomesOcupantes.has(primeiroNomePaciente)) {
        return;
      }
    }

    leitosCompativeis.push(leito);
  };

  setoresIterable.forEach(setor => {
    if (!modoContraFluxoAtivo && (setor.tipoSetor || '').toUpperCase() !== tipoSetorAlvo) return;

    (setor.quartos || []).forEach(quarto => {
      const leitosQuarto = quarto.leitos || [];
      const contextoBase = {
        setorNome: setor?.nomeSetor || setor?.nome || setor?.siglaSetor || '',
        setor,
        quartoNome: quarto?.nomeQuarto || quarto?.nome || '',
        quarto,
      };
      leitosQuarto.forEach(leitoQuarto => avaliarLeito(leitoQuarto, leitosQuarto, contextoBase));
    });

    (setor.leitosSemQuarto || []).forEach(leitoIsolado => {
      const contextoBase = {
        setorNome: setor?.nomeSetor || setor?.nome || setor?.siglaSetor || '',
        setor,
      };
      avaliarLeito(leitoIsolado, [leitoIsolado], contextoBase);
    });
  });

  return leitosCompativeis;
};

export { calcularIdade, getChavesIsolamentoAtivo };
