const normalizarTexto = (valor) => {
  if (valor === null || valor === undefined) return '';
  return String(valor)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase();
};

const normalizarSexo = (valor) => {
  const texto = normalizarTexto(valor);
  if (texto.startsWith('m')) return 'M';
  if (texto.startsWith('f')) return 'F';
  return '';
};

const calcularIdade = (dataNascimento) => {
  if (!dataNascimento) return 0;

  let dataObj;

  if (typeof dataNascimento === 'string' && dataNascimento.includes('/')) {
    const [dia, mes, ano] = dataNascimento.split('/');
    dataObj = new Date(parseInt(ano, 10), parseInt(mes, 10) - 1, parseInt(dia, 10));
  } else if (dataNascimento && typeof dataNascimento.toDate === 'function') {
    dataObj = dataNascimento.toDate();
  } else {
    dataObj = new Date(dataNascimento);
  }

  if (Number.isNaN(dataObj?.getTime?.())) return 0;

  const hoje = new Date();
  let idade = hoje.getFullYear() - dataObj.getFullYear();
  const mes = hoje.getMonth() - dataObj.getMonth();

  if (mes < 0 || (mes === 0 && hoje.getDate() < dataObj.getDate())) {
    idade -= 1;
  }

  return idade;
};

const isIsolamentoAtivo = (isolamento) => {
  if (isolamento === null || isolamento === undefined) return false;

  if (typeof isolamento === 'string' || typeof isolamento === 'number') {
    return String(isolamento).trim() !== '';
  }

  if (typeof isolamento !== 'object') return false;

  if (Object.prototype.hasOwnProperty.call(isolamento, 'ativo')) {
    return Boolean(isolamento.ativo);
  }

  if (isolamento.status) {
    const statusNormalizado = normalizarTexto(isolamento.status);
    if (!statusNormalizado) return true;
    if (['confirmado', 'suspeito', 'ativo', 'positivo'].includes(statusNormalizado)) {
      return true;
    }
    if (['encerrado', 'cancelado', 'descartado', 'negativo', 'inativo', 'liberado'].includes(statusNormalizado)) {
      return false;
    }
  }

  return true;
};

const extrairInformacoesIsolamento = (isolamento) => {
  if (isolamento === null || isolamento === undefined) return null;

  if (typeof isolamento === 'string' || typeof isolamento === 'number') {
    const valor = String(isolamento).trim();
    if (!valor) return null;
    const chave = normalizarTexto(valor);
    return {
      sigla: valor,
      nome: valor,
      chave,
    };
  }

  if (typeof isolamento === 'object') {
    const sigla =
      isolamento.sigla ||
      isolamento.siglaInfeccao ||
      isolamento.codigo ||
      isolamento.tipo ||
      isolamento.nome ||
      '';

    const nome =
      isolamento.nome ||
      isolamento.nomeInfeccao ||
      isolamento.descricao ||
      sigla ||
      'Isolamento';

    const infeccaoRef = isolamento.infeccaoId ?? isolamento.infecaoId;
    const infeccaoId =
      typeof infeccaoRef === 'string'
        ? infeccaoRef
        : typeof infeccaoRef === 'object' && infeccaoRef
          ? infeccaoRef.id || infeccaoRef?.path?.split?.('/')?.pop?.()
          : '';

    const identificador =
      sigla ||
      isolamento.siglaInfeccao ||
      isolamento.codigo ||
      isolamento.tipo ||
      isolamento.id ||
      infeccaoId ||
      nome ||
      '';

    const chaveBase = normalizarTexto(identificador || sigla || nome);
    if (!chaveBase && !sigla && !nome) {
      return null;
    }

    return {
      sigla: sigla || nome || 'N/A',
      nome: nome || sigla || 'Isolamento',
      chave: chaveBase,
    };
  }

  return null;
};

const extrairIsolamentosAtivosInterno = (lista) => {
  const valores = Array.isArray(lista) ? lista : (lista ? [lista] : []);
  const detalhes = [];
  const chavesSet = new Set();

  valores.forEach((item) => {
    if (!isIsolamentoAtivo(item)) return;
    const info = extrairInformacoesIsolamento(item);
    if (!info || !info.chave) return;
    if (chavesSet.has(info.chave)) return;
    chavesSet.add(info.chave);
    detalhes.push(info);
  });

  detalhes.sort((a, b) => a.sigla.localeCompare(b.sigla, 'pt-BR', { sensitivity: 'base' }));
  const chave = Array.from(chavesSet).sort().join('|');

  return { detalhes, chave };
};

const normalizarRestricaoIsolamentos = (lista) => {
  if (!Array.isArray(lista)) return [];
  const set = new Set();

  lista.forEach((item) => {
    if (!item) return;
    if (typeof item === 'string' || typeof item === 'number') {
      const chave = normalizarTexto(item);
      if (chave) set.add(chave);
      return;
    }

    if (typeof item === 'object') {
      const chave = normalizarTexto(
        item.sigla ??
        item.siglaInfeccao ??
        item.infeccaoId ??
        item.infecaoId ??
        item.id ??
        item.codigo ??
        item.nome ??
        item.tipo ??
        ''
      );
      if (chave) set.add(chave);
    }
  });

  return Array.from(set);
};

const obterLeitosDoQuarto = (leito, { quartosPorId, leitosPorId, todosOsLeitos }) => {
  if (!leito?.quartoId) return [];

  const quarto = quartosPorId.get(leito.quartoId);
  if (quarto && Array.isArray(quarto.leitosIds) && quarto.leitosIds.length > 0) {
    return quarto.leitosIds
      .map((leitoId) => leitosPorId.get(leitoId))
      .filter(Boolean);
  }

  return todosOsLeitos.filter((item) => item.quartoId === leito.quartoId);
};

export const getIsolamentosAtivosDetalhados = (lista) =>
  extrairIsolamentosAtivosInterno(lista).detalhes;

export const getChaveIsolamentosAtivos = (lista) =>
  extrairIsolamentosAtivosInterno(lista).chave;

const statusElegiveis = new Set(['vago', 'higienizacao', 'higienização']);

const obterStatusNormalizado = (leito) => {
  const status = leito?.status ?? leito?.statusLeito ?? '';
  return normalizarTexto(status);
};

const possuiReservaOuRegulacao = (leito) => {
  const temValor = (valor) => {
    if (!valor) return false;
    if (typeof valor === 'object') {
      return Object.keys(valor).length > 0;
    }
    return Boolean(valor);
  };

  return temValor(leito?.regulacaoEmAndamento) ||
    temValor(leito?.reservaExterna) ||
    temValor(leito?.regulacaoReserva);
};

export const getLeitosCompativeis = (
  paciente,
  todosOsLeitos = [],
  todosOsPacientes = [],
  {
    setores = [],
    quartos = [],
    tiposSetorPermitidos = null,
    setoresPermitidos = null,
  } = {}
) => {
  if (!paciente) return [];

  const setoresPorId = new Map((setores || []).map((setor) => [setor.id, setor]));
  const leitosPorId = new Map((todosOsLeitos || []).map((leito) => [leito.id, leito]));
  const quartosPorId = new Map((quartos || []).map((quarto) => [quarto.id, quarto]));

  const tiposSetorNormalizados = Array.isArray(tiposSetorPermitidos) && tiposSetorPermitidos.length > 0
    ? new Set(tiposSetorPermitidos.map((tipo) => normalizarTexto(tipo)))
    : null;

  const setoresPermitidosSet = setoresPermitidos && setoresPermitidos.size
    ? new Set(Array.from(setoresPermitidos).map((id) => String(id)))
    : null;

  const pacientesPorLeito = new Map();
  (todosOsPacientes || []).forEach((pacienteExistente) => {
    if (pacienteExistente?.leitoId) {
      pacientesPorLeito.set(pacienteExistente.leitoId, pacienteExistente);
    }
  });

  const sexoPaciente = normalizarSexo(paciente?.sexo);
  const { chave: chaveIsolamentoPaciente } = extrairIsolamentosAtivosInterno(paciente?.isolamentos);
  console.log('[Compatibilidade] Iniciando cálculo para paciente:', paciente?.nomePaciente, {
    sexo: paciente?.sexo,
    leitoId: paciente?.leitoId,
    isolamentos: paciente?.isolamentos,
  });
  console.log('[Compatibilidade] Isolamento paciente:', chaveIsolamentoPaciente);
  const idadePaciente = calcularIdade(paciente?.dataNascimento);
  const setorOrigemNormalizado = normalizarTexto(paciente?.setorOrigem);

  const leitosCompativeis = [];

  (todosOsLeitos || []).forEach((leito) => {
    if (!leito) return;

    const statusNormalizado = obterStatusNormalizado(leito);
    if (!statusElegiveis.has(statusNormalizado)) return;
    if (possuiReservaOuRegulacao(leito)) return;

    const setor = setoresPorId.get(leito.setorId);
    if (tiposSetorNormalizados) {
      const tipoSetor = normalizarTexto(setor?.tipoSetor);
      if (!tiposSetorNormalizados.has(tipoSetor)) return;
    }

    if (setoresPermitidosSet && leito?.setorId) {
      if (!setoresPermitidosSet.has(String(leito.setorId))) return;
    }

    if (leito.isPCP) {
      if (idadePaciente < 18 || idadePaciente > 60) return;
      if (chaveIsolamentoPaciente) return;
      if (setorOrigemNormalizado === normalizarTexto('CC - RECUPERAÇÃO')) return;
    }

    const restricao = leito.restricaoCoorte;
    if (restricao) {
      const sexoRestricao = normalizarSexo(restricao.sexo);
      if (sexoRestricao && sexoPaciente && sexoRestricao !== sexoPaciente) return;
      if (sexoRestricao && !sexoPaciente) return;

      const isolamentosRestritos = normalizarRestricaoIsolamentos(restricao.isolamentos);
      if (isolamentosRestritos.length > 0) {
        const { detalhes: isolamentosPacienteDetalhes } = extrairIsolamentosAtivosInterno(paciente?.isolamentos);
        const chavesPaciente = new Set(isolamentosPacienteDetalhes.map((item) => item.chave));
        const atendeRestricao = isolamentosRestritos.every((item) => chavesPaciente.has(item));
        if (!atendeRestricao) return;
      }
    }

    if (leito.quartoId) {
      const leitosDoQuarto = obterLeitosDoQuarto(leito, { quartosPorId, leitosPorId, todosOsLeitos });
      const ocupantes = leitosDoQuarto
        .filter((outroLeito) => outroLeito.id !== leito.id)
        .map((outroLeito) => pacientesPorLeito.get(outroLeito.id))
        .filter(Boolean);

      console.log('[Compatibilidade] Avaliando leito:', leito.codigoLeito, 'Quarto:', leito.quartoId);
      console.log('[Compatibilidade] Ocupantes do quarto:', ocupantes.map((o) => ({
        nome: o?.nomePaciente,
        sexo: o?.sexo,
        isolamentos: o?.isolamentos,
      })));

      if (ocupantes.length > 0) {
        const sexos = new Set(
          ocupantes
            .map((ocupante) => normalizarSexo(ocupante?.sexo))
            .filter(Boolean)
        );

        if (sexos.size > 1) {
          console.log('[Compatibilidade] REJEITADO por sexo inconsistente entre ocupantes:', {
            sexosOcupantes: Array.from(sexos),
          });
          return;
        }

        if (sexos.size === 1) {
          const [sexoQuarto] = Array.from(sexos);
          if (sexoQuarto && sexoPaciente && sexoQuarto !== sexoPaciente) {
            console.log('[Compatibilidade] REJEITADO por sexo:', {
              sexoPaciente,
              sexoQuarto,
            });
            return;
          }
          if (sexoQuarto && !sexoPaciente) {
            console.log('[Compatibilidade] REJEITADO por sexo indefinido do paciente.', {
              sexoQuarto,
            });
            return;
          }
        }

        const chavesOcupantes = new Set();
        let chaveReferencia = null;

        for (const ocupante of ocupantes) {
          const { chave } = extrairIsolamentosAtivosInterno(ocupante?.isolamentos);
          chavesOcupantes.add(chave);
          if (chaveReferencia === null) {
            chaveReferencia = chave;
          }
        }

        if (chavesOcupantes.size > 1) {
          console.log('[Compatibilidade] REJEITADO por múltiplos isolamentos entre ocupantes:', {
            chavesOcupantes: Array.from(chavesOcupantes),
          });
          return;
        }

        const [chaveOcupantes] = Array.from(chavesOcupantes);
        console.log('[Compatibilidade] Isolamento paciente:', chaveIsolamentoPaciente, 'Isolamento ocupantes:', chaveOcupantes);
        if (chaveOcupantes) {
          if (chaveOcupantes !== chaveIsolamentoPaciente) {
            console.log('[Compatibilidade] REJEITADO por isolamento incompatível:', {
              chavePaciente: chaveIsolamentoPaciente,
              chaveOcupantes,
            });
            return;
          }
        } else if (chaveIsolamentoPaciente) {
          console.log('[Compatibilidade] REJEITADO por isolamento do paciente sem correspondência no quarto:', {
            chavePaciente: chaveIsolamentoPaciente,
          });
          return;
        }
      }
    }

    console.log('[Compatibilidade] ACEITO leito:', leito.codigoLeito, 'para paciente:', paciente?.nomePaciente);
    leitosCompativeis.push(leito);
  });

  return leitosCompativeis;
};

export { normalizarSexo };
