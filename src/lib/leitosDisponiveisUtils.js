const normalizarTexto = (valor) => {
  if (valor === null || valor === undefined) return '';
  return String(valor).trim();
};

const normalizarStatusLeito = (status) => {
  const texto = normalizarTexto(status);
  if (!texto) return '';

  const base = texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  if (base === 'vago') return 'Vago';
  if (base === 'higienizacao' || base === 'higienização') return 'Higienização';

  return texto;
};

const normalizarCodigoLeito = (codigo, fallback) => {
  const texto = normalizarTexto(codigo);
  if (texto) return texto;
  return fallback ? normalizarTexto(fallback) : '';
};

const extrairSiglaInfeccao = (infeccao) => {
  if (!infeccao) return '';
  return (
    infeccao.siglaInfeccao ||
    infeccao.sigla ||
    infeccao.nome ||
    infeccao.codigo ||
    ''
  )
    .toString()
    .trim()
    .toUpperCase();
};

const extrairPacientesPorLeito = (pacientes) => {
  const mapa = new Map();
  (pacientes || []).forEach((paciente) => {
    const leitoId = paciente?.leitoId;
    if (!leitoId) return;
    mapa.set(leitoId, paciente);
  });
  return mapa;
};

const normalizarSexo = (sexoBruto) => {
  const texto = normalizarTexto(sexoBruto);
  if (!texto) return '';

  const base = texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  if (['m', 'masc', 'masculino'].includes(base)) return 'Masculino';
  if (['f', 'fem', 'feminino'].includes(base)) return 'Feminino';
  if (['i', 'intersexo', 'intersex'].includes(base)) return 'Intersexo';
  if (['outro', 'outros'].includes(base)) return 'Outro';

  return texto;
};

const criarBadgeSexo = (sexo) => {
  if (!sexo) return null;
  const texto = normalizarSexo(sexo);
  if (!texto) return null;
  return { text: texto, variant: 'secondary' };
};

const criarBadgesIsolamento = (isolamentos) => {
  if (!Array.isArray(isolamentos) || isolamentos.length === 0) return [];
  return Array.from(
    new Set(
      isolamentos
        .map((iso) => (iso || '').toString().trim().toUpperCase())
        .filter(Boolean),
    ),
  ).map((rotulo) => ({ text: rotulo, variant: 'destructive' }));
};

export const getLeitoCompatibilityInfo = (leito = {}) => {
  const restricao = leito.restricaoCoorte || null;

  if (!restricao) {
    return {
      label: 'Livre',
      badges: [],
    };
  }

  const badgeSexo = criarBadgeSexo(restricao.sexo);
  const badgesIsolamentos = criarBadgesIsolamento(restricao.isolamentos);
  const badges = [];
  if (badgeSexo) badges.push(badgeSexo);
  badges.push(...badgesIsolamentos);

  if (badges.length === 0) {
    return {
      label: 'Livre',
      badges,
    };
  }

  const sexoTexto = badgeSexo?.text || 'indefinido';
  const isolamentosTexto = badgesIsolamentos.map((badge) => badge.text);

  let label = `Permitido apenas pacientes do sexo ${sexoTexto}`;
  if (isolamentosTexto.length > 0) {
    label = `${label} com isolamento de ${isolamentosTexto.join(', ')}`;
  }

  return {
    label,
    badges,
  };
};

const aplicarRestricoesCoorte = (quartos, pacientesMap, infeccoesMap) => {
  if (!Array.isArray(quartos) || !pacientesMap || !infeccoesMap) return;

  quartos.forEach((quarto) => {
    const leitos = quarto?.leitos || [];
    if (!leitos.length) return;

    const leitosOcupados = leitos.filter(
      (leito) =>
        ['Ocupado', 'Regulado'].includes(leito?.status) &&
        (leito?.pacienteId || leito?.paciente?.id),
    );

    if (leitosOcupados.length === 0) return;

    let coorteSexo = null;
    const coorteIsolamentos = new Set();
    let sexoConflitante = false;

    leitosOcupados.forEach((leitoOcupado) => {
      const pacienteId =
        leitoOcupado?.pacienteId || leitoOcupado?.paciente?.id || null;
      if (!pacienteId) return;

      const paciente = pacientesMap.get(pacienteId);
      if (!paciente) return;

      if (coorteSexo === null) {
        coorteSexo = paciente.sexo || null;
      } else if (paciente.sexo && coorteSexo && paciente.sexo !== coorteSexo) {
        sexoConflitante = true;
      }

      (paciente.isolamentos || []).forEach((iso) => {
        const infeccaoId = iso?.infeccaoId?.id || iso?.infeccaoId || iso?.idInfeccao || iso?.id;
        const infeccao = infeccoesMap.get(infeccaoId);
        const rotulo = extrairSiglaInfeccao(infeccao) || (iso?.siglaInfeccao || iso?.sigla || '')?.toString().toUpperCase();
        if (rotulo) {
          coorteIsolamentos.add(rotulo);
        }
      });
    });

    if (sexoConflitante || !coorteSexo) {
      return;
    }

    const restricao = {
      sexo: coorteSexo,
      isolamentos: Array.from(coorteIsolamentos),
    };

    leitos.forEach((leito) => {
      if (['Vago', 'Higienização'].includes(leito?.status)) {
        leito.restricaoCoorte = restricao;
      }
    });
  });
};

const criarQuartosEnfermaria = (setorId, leitosDoSetor) => {
  const grupos = leitosDoSetor.reduce((acc, leitoAtual) => {
    const codigo = normalizarCodigoLeito(leitoAtual.codigoLeito);
    const chave = (codigo.substring(0, 3) || '---').toUpperCase();
    if (!acc[chave]) {
      acc[chave] = {
        id: `din-${setorId}-${chave}`,
        nomeQuarto: `Quarto ${chave}`,
        leitos: [],
      };
    }
    acc[chave].leitos.push(leitoAtual);
    return acc;
  }, {});

  return Object.values(grupos)
    .map((quarto) => ({
      ...quarto,
      leitos: quarto.leitos.sort((a, b) =>
        normalizarCodigoLeito(a.codigoLeito).localeCompare(normalizarCodigoLeito(b.codigoLeito)),
      ),
    }))
    .sort((a, b) => normalizarTexto(a.nomeQuarto).localeCompare(normalizarTexto(b.nomeQuarto)));
};

const criarQuartosPorSetor = (setorId, quartos, leitosDoSetor) => {
  const quartosDoSetor = (quartos || [])
    .filter((quarto) => quarto?.setorId === setorId)
    .sort((a, b) => normalizarTexto(a?.nomeQuarto).localeCompare(normalizarTexto(b?.nomeQuarto)));

  const leitosSemQuarto = [...leitosDoSetor];

  const quartosComLeitos = quartosDoSetor.map((quarto) => {
    const leitosDoQuarto = leitosDoSetor
      .filter((leito) => (quarto?.leitosIds || []).includes(leito.id))
      .sort((a, b) => normalizarCodigoLeito(a.codigoLeito).localeCompare(normalizarCodigoLeito(b.codigoLeito)));

    leitosDoQuarto.forEach((leito) => {
      const index = leitosSemQuarto.findIndex((item) => item.id === leito.id);
      if (index > -1) {
        leitosSemQuarto.splice(index, 1);
      }
    });

    return {
      ...quarto,
      leitos: leitosDoQuarto,
    };
  });

  return {
    quartosComLeitos,
    leitosSemQuarto: leitosSemQuarto.sort((a, b) =>
      normalizarCodigoLeito(a.codigoLeito).localeCompare(normalizarCodigoLeito(b.codigoLeito)),
    ),
  };
};

const prepararLeitosDoSetor = ({
  setor,
  leitos,
  pacientes,
}) => {
  const pacientesPorLeito = extrairPacientesPorLeito(pacientes);

  return leitos
    .filter((leito) => leito?.setorId === setor.id)
    .map((leito) => {
      const paciente = pacientesPorLeito.get(leito.id) || null;
      const pacienteId = leito?.pacienteId || paciente?.id || null;

      return {
        ...leito,
        status: normalizarStatusLeito(leito?.status || leito?.statusLeito || 'Desconhecido'),
        paciente,
        pacienteId,
        restricaoCoorte: null,
      };
    });
};

const filtrarLeitosDisponiveis = (leitos) =>
  (leitos || [])
    .filter((leito) =>
      ['Vago', 'Higienização'].includes(leito?.status) &&
      !leito?.paciente &&
      !leito?.reservaExterna &&
      !leito?.regulacaoEmAndamento &&
      leito?.statusLeito !== 'Reservado',
    )
    .sort((a, b) => normalizarCodigoLeito(a.codigoLeito).localeCompare(normalizarCodigoLeito(b.codigoLeito)))
    .map((leito) => {
      const compatibilidadeInfo = getLeitoCompatibilityInfo(leito);
      return {
        id: leito.id,
        codigoLeito: normalizarCodigoLeito(
          leito.codigoLeito,
          leito.nomeLeito || leito.nome || leito.id,
        ) || 'Leito sem código',
        status: leito.status,
        restricaoCoorte: leito.restricaoCoorte || null,
        compatibilidade: compatibilidadeInfo.label,
        compatibilidadeBadges: compatibilidadeInfo.badges,
      };
    });

export const getLeitosVagosPorSetor = ({
  setores = [],
  leitos = [],
  quartos = [],
  pacientes = [],
  infeccoes = [],
} = {}) => {
  if (!setores.length || !leitos.length) return [];

  const pacientesMap = new Map((pacientes || []).map((paciente) => [paciente.id, paciente]));
  const infeccoesMap = new Map((infeccoes || []).map((infeccao) => [infeccao.id, infeccao]));

  return setores
    .filter((setor) => ['Enfermaria', 'UTI'].includes(setor?.tipoSetor))
    .map((setor) => {
      const leitosDoSetor = prepararLeitosDoSetor({ setor, leitos, pacientes });
      if (leitosDoSetor.length === 0) return null;

      let quartosComLeitos = [];
      let leitosSemQuarto = [];

      if ((setor?.tipoSetor || '').toLowerCase() === 'enfermaria') {
        quartosComLeitos = criarQuartosEnfermaria(setor.id, leitosDoSetor);
        leitosSemQuarto = [];
      } else {
        const resultado = criarQuartosPorSetor(setor.id, quartos, leitosDoSetor);
        quartosComLeitos = resultado.quartosComLeitos;
        leitosSemQuarto = resultado.leitosSemQuarto;
      }

      aplicarRestricoesCoorte(quartosComLeitos, pacientesMap, infeccoesMap);

      const leitosDisponiveis = filtrarLeitosDisponiveis([
        ...quartosComLeitos.flatMap((quarto) => quarto.leitos || []),
        ...leitosSemQuarto,
      ]);

      if (leitosDisponiveis.length === 0) return null;

      return {
        id: setor.id,
        nomeSetor:
          setor?.nomeSetor || setor?.nome || setor?.siglaSetor || 'Setor sem nome',
        tipoSetor: setor?.tipoSetor || 'Outros',
        leitosVagos: leitosDisponiveis,
      };
    })
    .filter(Boolean)
    .sort((a, b) => normalizarTexto(a?.nomeSetor).localeCompare(normalizarTexto(b?.nomeSetor)));
};

