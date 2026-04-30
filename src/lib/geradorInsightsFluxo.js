// Motor de regras de negócio para gerar insights sobre fluxos de regulação.
// Cada insight: { tipo: 'alerta' | 'positivo' | 'negativo' | 'info', texto: string }

const norm = (v) =>
  String(v || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
    .trim();

// Conjuntos de classificação de setores
const SET_UTI_CRITICO = ['UTI', 'CEDUG'];
const SET_RPA_CIRURGICO = ['CC RECU', 'CC - RECUPERACAO', 'SALA CX', 'SALA CIRURGICA'];
const SET_PS_RETAGUARDA = ['CEDUG', 'SL LARANJA', 'SALA LARANJA', 'DCX', 'DCL'];
const SET_PS_CIRURGICO = ['DCX'];
const SET_PS_CLINICO = ['DCL'];
const SET_ENF_CLINICA = ['UCM', 'UIG', 'ONCO'];
const SET_ENF_CIRURGICA = ['UCX', 'JS'];

const matchAny = (valor, lista) => {
  const v = norm(valor);
  return lista.some((alvo) => v.includes(norm(alvo)));
};

/**
 * Gera insights para um fluxo (linha da tabela Origem→Destino).
 *
 * @param {Object} fluxo - { origem, destino, total, tempoMedio (min) }
 * @param {Array}  todosFluxos - lista completa para cálculos comparativos
 * @param {Array|null} periodoAnterior - mesma estrutura, opcional
 * @returns {Array<{tipo:string,texto:string}>}
 */
export function gerarInsightsFluxo(fluxo, todosFluxos = [], periodoAnterior = null) {
  if (!fluxo) return [];
  const insights = [];
  const { origem, destino, total = 0, tempoMedio = 0 } = fluxo;

  // -------- Pré-cálculos comparativos --------
  const fluxosMesmaOrigem = todosFluxos.filter(
    (f) => norm(f.origem) === norm(origem) && norm(f.destino) !== norm(destino),
  );
  const mediaOrigem =
    fluxosMesmaOrigem.length > 0
      ? fluxosMesmaOrigem.reduce((acc, f) => acc + (f.tempoMedio || 0), 0) /
        fluxosMesmaOrigem.length
      : 0;

  const mediaGlobal =
    todosFluxos.length > 0
      ? todosFluxos.reduce((acc, f) => acc + (f.tempoMedio || 0), 0) / todosFluxos.length
      : 0;

  const top3Volume = [...todosFluxos]
    .sort((a, b) => (b.total || 0) - (a.total || 0))
    .slice(0, 3)
    .map((f) => `${norm(f.origem)}|${norm(f.destino)}`);

  // -------- Regra 1: UTI/CEDUG > 2h --------
  if (matchAny(destino, SET_UTI_CRITICO) && tempoMedio > 120) {
    insights.push({
      tipo: 'alerta',
      texto:
        'Acesso crítico lentificado: regulações para UTI/CEDUG acima de 2h elevam o risco de deterioração clínica na origem.',
    });
  }

  // -------- Regra 2: RPA/CC > 3h --------
  if (matchAny(origem, SET_RPA_CIRURGICO) && tempoMedio > 180) {
    insights.push({
      tipo: 'alerta',
      texto:
        'Gargalo cirúrgico: retenção prolongada em RPA/CC atrasa a liberação de salas e pode suspender cirurgias.',
    });
  }

  // -------- Regra 3: PS Boarding > 6h --------
  if (matchAny(origem, SET_PS_RETAGUARDA) && tempoMedio > 360) {
    insights.push({
      tipo: 'negativo',
      texto:
        'Superlotação no PS: pacientes aguardando mais de 6h para internação em leito de retaguarda.',
    });
  }

  // -------- Regra 4: Cirúrgico → Clínico --------
  if (matchAny(origem, SET_PS_CIRURGICO) && matchAny(destino, SET_ENF_CLINICA)) {
    insights.push({
      tipo: 'info',
      texto: 'Alocação fora do perfil: paciente de origem cirúrgica regulado para enfermaria clínica.',
    });
  }

  // -------- Regra 5: Clínico → Cirúrgico --------
  if (matchAny(origem, SET_PS_CLINICO) && matchAny(destino, SET_ENF_CIRURGICA)) {
    insights.push({
      tipo: 'info',
      texto: 'Alocação fora do perfil: paciente de origem clínica regulado para enfermaria cirúrgica.',
    });
  }

  // -------- Regra 6: Remanejamento interno lento --------
  if (norm(origem) === norm(destino) && tempoMedio > 120) {
    insights.push({
      tipo: 'negativo',
      texto:
        'Remanejamento interno lento: trocar pacientes de leito dentro do mesmo setor está consumindo muito tempo da equipe.',
    });
  }

  // -------- Regra 7: Lentidão relativa do destino (>30% acima da média da origem) --------
  if (mediaOrigem > 0 && tempoMedio > mediaOrigem * 1.3) {
    const z = Math.round(((tempoMedio - mediaOrigem) / mediaOrigem) * 100);
    insights.push({
      tipo: 'negativo',
      texto: `Este destino (${destino}) é ${z}% mais lento para receber pacientes do que a média de outros setores que recebem pacientes de ${origem}.`,
    });
  }

  // -------- Regra 8: Top 3 volume + acima da média global --------
  const chave = `${norm(origem)}|${norm(destino)}`;
  if (top3Volume.includes(chave) && mediaGlobal > 0 && tempoMedio > mediaGlobal) {
    insights.push({
      tipo: 'alerta',
      texto:
        'Prioridade de otimização: este é um dos trajetos de maior volume do hospital e está operando acima da média de tempo aceitável.',
    });
  }

  // -------- Regra 9: Eficiência operacional (positivo) --------
  if (total > 5 && tempoMedio < 120 && !matchAny(destino, ['UTI'])) {
    insights.push({
      tipo: 'positivo',
      texto:
        'Fluxo eficiente: alto volume de transferências sendo realizado com excelente tempo de resposta.',
    });
  }

  // -------- Regra 10: Comparativo de período (±20%) --------
  if (Array.isArray(periodoAnterior) && periodoAnterior.length > 0) {
    const anterior = periodoAnterior.find(
      (f) => norm(f.origem) === norm(origem) && norm(f.destino) === norm(destino),
    );
    if (anterior && anterior.tempoMedio > 0) {
      const delta = (tempoMedio - anterior.tempoMedio) / anterior.tempoMedio;
      if (Math.abs(delta) >= 0.2) {
        const z = Math.round(Math.abs(delta) * 100);
        const piorou = delta > 0;
        insights.push({
          tipo: piorou ? 'negativo' : 'positivo',
          texto: `O tempo de resposta deste trajeto ${piorou ? 'piorou' : 'melhorou'} ${z}% em relação ao período anterior.`,
        });
      }
    }
  }

  return insights;
}

export function resumoIcone(insights = []) {
  if (!insights.length) return null;
  const temNegativo = insights.some((i) => i.tipo === 'alerta' || i.tipo === 'negativo');
  if (temNegativo) return 'alerta';
  const apenasPositivos = insights.every((i) => i.tipo === 'positivo');
  if (apenasPositivos) return 'positivo';
  return 'info';
}
