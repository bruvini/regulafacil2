// Definições dos Indicadores para serem inseridas no Firestore
// Este arquivo serve como backup e referência das definições

export const definicoesIndicadores = {
  mediaPermanencia: {
    nome: "Média de Permanência",
    unidadeMedida: "Dias",
    meta: "< 7 dias",
    direcao: "Quanto menos, melhor",
    definicao: "Avalia o tempo médio, em dias, que os pacientes permanecem internados em um determinado setor ou no hospital como um todo.",
    fonte: "Coleção 'historicoOcupacoes' no Firestore.",
    numerador: "Somatório do tempo de permanência de todos os pacientes que tiveram alta no período.",
    denominador: "Número total de pacientes que tiveram alta no período.",
    criteriosInclusao: "Pacientes com data de entrada e saída registradas no período de análise.",
    criteriosExclusao: "Pacientes ainda internados.",
    formula: "(Σ (Data da Saída - Data da Entrada)) / (Nº de Saídas)",
    resultado: "Um valor numérico representando a média de dias."
  },

  giroLeitos: {
    nome: "Giro de Leitos",
    unidadeMedida: "Pacientes/Leito",
    meta: "> 1,2",
    direcao: "Quanto mais, melhor",
    definicao: "Indica quantos pacientes foram atendidos por leito em um determinado período, refletindo a eficiência na utilização da capacidade instalada.",
    fonte: "Coleções 'historicoOcupacoes' e 'leitos' no Firestore.",
    numerador: "Número total de pacientes que tiveram alta no período.",
    denominador: "Número médio de leitos disponíveis no período.",
    criteriosInclusao: "Todos os pacientes com alta no período e leitos operacionais.",
    criteriosExclusao: "Leitos bloqueados ou em manutenção.",
    formula: "(Nº de Altas no Período) / (Nº Médio de Leitos Disponíveis)",
    resultado: "Um valor numérico representando pacientes por leito."
  },

  taxaOcupacao: {
    nome: "Taxa de Ocupação",
    unidadeMedida: "%",
    meta: "85% - 95%",
    direcao: "Ideal entre 85% e 95%",
    definicao: "Percentual de leitos ocupados em relação ao total de leitos disponíveis, considerando leitos com pacientes, regulados e reservados.",
    fonte: "Coleções 'leitos' e 'pacientes' em tempo real no Firestore.",
    numerador: "Número de leitos ocupados (pacientes + regulados + reservados).",
    denominador: "Número total de leitos operacionais (total - bloqueados).",
    criteriosInclusao: "Leitos operacionais e em funcionamento.",
    criteriosExclusao: "Leitos bloqueados, em manutenção ou higienização.",
    formula: "((Ocupados + Regulados + Reservados) / (Total - Bloqueados)) × 100",
    resultado: "Percentual de ocupação dos leitos."
  },

  permanenciaAtualEspecialidade: {
    nome: "Tempo Médio de Permanência por Especialidade",
    unidadeMedida: "Dias",
    meta: "Varia por especialidade",
    direcao: "Monitoramento contínuo",
    definicao: "Tempo médio que os pacientes atualmente internados têm permanecido no hospital, agrupado por especialidade médica.",
    fonte: "Coleção 'pacientes' com dados de internação em tempo real.",
    numerador: "Somatório dos dias de internação dos pacientes ativos por especialidade.",
    denominador: "Número de pacientes internados por especialidade.",
    criteriosInclusao: "Pacientes atualmente internados com data de internação registrada.",
    criteriosExclusao: "Pacientes sem especialidade definida ou data de internação.",
    formula: "(Σ (Data Atual - Data da Internação)) / (Nº Pacientes por Especialidade)",
    resultado: "Tempo médio em dias por especialidade."
  },

  internacoesHorario: {
    nome: "Internações por Horário e Dia da Semana",
    unidadeMedida: "Contagem",
    meta: "Distribuição equilibrada",
    direcao: "Análise de padrões",
    definicao: "Distribuição das internações ao longo dos dias da semana e faixas horárias, permitindo identificar picos de demanda.",
    fonte: "Coleções 'historicoOcupacoes' e 'pacientes' (dados históricos e atuais).",
    numerador: "Número de internações por dia da semana e faixa horária.",
    denominador: "Total de internações no período analisado.",
    criteriosInclusao: "Todas as internações com data e hora registradas.",
    criteriosExclusao: "Registros sem informação de data/hora.",
    formula: "Contagem de internações agrupadas por [Dia da Semana, Faixa Horária]",
    resultado: "Matriz de distribuição temporal das internações."
  },

  statusRegulacoes: {
    nome: "Status das Regulações",
    unidadeMedida: "Contagem",
    meta: "Alta taxa de conclusão",
    direcao: "Mais conclusões, menos cancelamentos",
    definicao: "Distribuição das regulações por status final: concluídas, canceladas, alteradas e pendentes.",
    fonte: "Coleção 'auditoria' para eventos históricos e dados em tempo real para pendentes.",
    numerador: "Número de regulações por status.",
    denominador: "Total de regulações no período.",
    criteriosInclusao: "Todas as regulações iniciadas no período de análise.",
    criteriosExclusao: "Registros incompletos ou corrompidos.",
    formula: "Contagem por status / Total de regulações × 100",
    resultado: "Percentual de regulações por status."
  },

  fluxoRegulacoes: {
    nome: "Volume de Regulações por Origem e Destino",
    unidadeMedida: "Contagem",
    meta: "Fluxos equilibrados",
    direcao: "Análise de padrões de transferência",
    definicao: "Visualização dos fluxos de regulação entre setores, mostrando origem e destino das transferências internas.",
    fonte: "Coleção 'auditoria' com logs de regulações e transferências.",
    numerador: "Número de regulações entre cada par origem-destino.",
    denominador: "Total de regulações no período.",
    criteriosInclusao: "Regulações com setores de origem e destino identificados.",
    criteriosExclusao: "Regulações sem informação completa de origem/destino.",
    formula: "Contagem por par [Origem, Destino]",
    resultado: "Matriz de fluxos entre setores."
  },

  tempoRegulacao: {
    nome: "Tempo Médio de Regulação por Horário",
    unidadeMedida: "Minutos",
    meta: "< 30 minutos",
    direcao: "Quanto menos, melhor",
    definicao: "Tempo médio necessário para concluir uma regulação, desde o início até a finalização, analisado por faixa horária.",
    fonte: "Coleção 'auditoria' com timestamps de início e conclusão das regulações.",
    numerador: "Somatório do tempo de regulação por faixa horária.",
    denominador: "Número de regulações concluídas por faixa horária.",
    criteriosInclusao: "Regulações concluídas com timestamps de início e fim.",
    criteriosExclusao: "Regulações canceladas ou ainda pendentes.",
    formula: "(Σ (Tempo Fim - Tempo Início)) / (Nº Regulações por Horário)",
    resultado: "Tempo médio em minutos por faixa horária."
  }
};