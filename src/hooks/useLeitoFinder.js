import { useMemo } from 'react';

// Funções puras de cálculo e normalização
const calcularIdade = (dataNascimento) => {
  if (!dataNascimento) return 0;

  let dataObj = null;

  if (typeof dataNascimento?.toDate === 'function') {
    dataObj = dataNascimento.toDate();
  } else if (
    typeof dataNascimento === 'object' &&
    dataNascimento !== null &&
    typeof dataNascimento.seconds === 'number'
  ) {
    dataObj = new Date(dataNascimento.seconds * 1000);
  } else if (typeof dataNascimento === 'string' && dataNascimento.includes('/')) {
    const [dia, mes, ano] = dataNascimento.split('/').map((parte) => parseInt(parte, 10));
    if (!Number.isNaN(dia) && !Number.isNaN(mes) && !Number.isNaN(ano)) {
      dataObj = new Date(ano, mes - 1, dia);
    }
  } else {
    dataObj = new Date(dataNascimento);
  }

  if (!(dataObj instanceof Date) || Number.isNaN(dataObj.getTime())) {
    return 0;
  }

  const hoje = new Date();
  let idade = hoje.getFullYear() - dataObj.getFullYear();
  const mes = hoje.getMonth() - dataObj.getMonth();

  if (mes < 0 || (mes === 0 && hoje.getDate() < dataObj.getDate())) {
    idade -= 1;
  }

  return idade;
};

const normalizarTexto = (texto) =>
  (texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const getChavesIsolamentoAtivo = (paciente, infeccoesMap) => {
  const statusAtivos = new Set(['confirmado', 'suspeito']);
  if (!paciente || !Array.isArray(paciente.isolamentos)) return new Set();

  const chaves = paciente.isolamentos
    .filter((iso) => statusAtivos.has(normalizarTexto(iso.status)))
    .map((iso) => {
      const infeccaoId = typeof iso.infeccaoId === 'object' ? iso.infeccaoId.id : iso.infeccaoId;
      const infeccao = infeccoesMap.get(infeccaoId);
      return normalizarTexto(infeccao?.siglaInfeccao || infeccao?.sigla || '');
    })
    .filter(Boolean);

  return new Set(chaves);
};

export const useLeitoFinder = (pacientes, leitos, setores, infeccoes) => {
  const infeccoesMap = useMemo(
    () => new Map((infeccoes || []).map((i) => [i.id, i])),
    [infeccoes]
  );
  const setoresMap = useMemo(
    () => new Map((setores || []).map((s) => [s.id, s])),
    [setores]
  );
  const pacientesPorLeitoId = useMemo(
    () =>
      new Map(
        (pacientes || [])
          .filter((p) => p?.leitoId)
          .map((p) => [p.leitoId, p])
      ),
    [pacientes]
  );

  const encontrarLeitosCompativeis = (pacienteAlvo, modo = 'enfermaria') => {
    if (!pacienteAlvo) return [];

    const tipoSetorAlvo = modo === 'uti' ? 'UTI' : 'ENFERMARIA';
    const leitosDisponiveis = (leitos || []).filter((l) =>
      ['Vago', 'Higienização'].includes(l?.status)
    );

    const compativeis = leitosDisponiveis.filter((leito) => {
      const setor = setoresMap.get(leito?.setorId);
      if (!setor) return false;
      if (normalizarTexto(setor?.tipoSetor) !== normalizarTexto(tipoSetorAlvo)) return false;

      if (modo === 'uti') return true; // UTI não tem restrições adicionais

      const idade = calcularIdade(pacienteAlvo.dataNascimento);
      const chavesPaciente = getChavesIsolamentoAtivo(pacienteAlvo, infeccoesMap);

      // Regra PCP
      if (leito?.isPCP) {
        const setorOrigemNormalizado = normalizarTexto(pacienteAlvo?.setorOrigem);
        if (
          idade < 18 ||
          idade > 60 ||
          chavesPaciente.size > 0 ||
          setorOrigemNormalizado === 'cc - recuperacao' ||
          setorOrigemNormalizado === 'cc - recuperação'
        ) {
          return false;
        }
      }

      // Regras de Quarto
      const chaveQuarto = (leito?.codigoLeito || '').substring(0, 3);
      const outrosLeitosNoQuarto = (leitos || []).filter(
        (l) => l?.id !== leito?.id && (l?.codigoLeito || '').startsWith(chaveQuarto)
      );
      const ocupantes = outrosLeitosNoQuarto
        .map((l) => pacientesPorLeitoId.get(l?.id))
        .filter(Boolean);

      if (ocupantes.length > 0) {
        const sexosOcupantes = new Set(ocupantes.map((o) => o?.sexo).filter(Boolean));
        const chavesOcupantes = new Set();
        ocupantes.forEach((o) =>
          getChavesIsolamentoAtivo(o, infeccoesMap).forEach((chave) =>
            chavesOcupantes.add(chave)
          )
        );

        // Sexo
        if (sexosOcupantes.size === 1 && !sexosOcupantes.has(pacienteAlvo?.sexo)) {
          return false;
        }

        // Isolamento
        const quartoIsolado = chavesOcupantes.size > 0;
        const pacienteIsolado = chavesPaciente.size > 0;

        if (quartoIsolado) {
          if (!pacienteIsolado) return false;
          if (
            chavesPaciente.size !== chavesOcupantes.size ||
            ![...chavesPaciente].every((c) => chavesOcupantes.has(c))
          ) {
            return false;
          }
        } else if (pacienteIsolado) {
          return false;
        }
      }

      return true; // Passou em todas as regras
    });

    return compativeis;
  };

  return { encontrarLeitosCompativeis };
};

export default useLeitoFinder;
