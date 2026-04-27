// Definições dos Indicadores exibidos no módulo de Gestão Estratégica.
// Fonte única consultada pelo IndicadorInfoModal (Ficha do Indicador).
//
// Convenção dos campos:
//  - nome:               Título exibido no topo da ficha
//  - unidadeMedida:      Unidade do valor (ex.: %, Pacientes, Dias, Minutos)
//  - meta:               Faixa/alvo desejado para o indicador
//  - direcao:            Como interpretar variações ("Quanto mais, melhor", etc.)
//  - definicao:          Objetivo: o que o indicador mede
//  - fonte:              Coleções/Documentos do Firestore que alimentam o cálculo
//  - numerador / denominador: Componentes da fórmula
//  - criteriosInclusao / criteriosExclusao
//  - formula:            Fórmula matemática exata utilizada no código
//  - periodicidade:      "Tempo real" ou janela histórica considerada
//  - impactoGestao:      Como o gestor deve interpretar e agir
//  - resultado:          Saída esperada (texto livre)

export const definicoesIndicadores = {
  internacoesAtivas: {
    nome: "Internações Ativas",
    unidadeMedida: "Pacientes",
    meta: "Monitoramento contínuo",
    direcao: "Quanto mais alinhado ao planejamento assistencial, melhor",
    definicao: "Número total de pacientes com internação ativa, incluindo casos regulados ou aguardando acomodação definitiva.",
    fonte: "Coleção 'pacientes' em tempo real no Firestore.",
    numerador: "Contagem de pacientes com status de internação ativo ou sem data de alta registrada.",
    denominador: "—",
    criteriosInclusao: "Pacientes com internação vigente, independente do leito alocado.",
    criteriosExclusao: "Pacientes com alta, óbito, transferência externa concluída ou internação cancelada.",
    formula: "Contagem simples dos registros elegíveis",
    periodicidade: "Tempo real",
    impactoGestao: "Reflete a pressão assistencial atual. Quedas bruscas indicam alta de pacientes; picos sinalizam necessidade de revisar capacidade e escalas."
  },

  especialidadesAtivas: {
    nome: "Especialidades Ativas",
    unidadeMedida: "Especialidades",
    meta: "Diversidade assistencial equilibrada",
    direcao: "Monitoramento contínuo",
    definicao: "Quantidade de especialidades distintas atendendo pacientes internados atualmente.",
    fonte: "Coleção 'pacientes' em tempo real no Firestore.",
    numerador: "Número de especialidades únicas entre os pacientes internados.",
    denominador: "—",
    criteriosInclusao: "Pacientes ativos com especialidade clínica registrada.",
    criteriosExclusao: "Pacientes sem especialidade definida.",
    formula: "Contagem de valores únicos do campo 'especialidade' para pacientes ativos",
    periodicidade: "Tempo real",
    impactoGestao: "Indica diversidade do mix clínico. Use para validar se o hospital está respeitando sua vocação assistencial."
  },

  especialidadePrincipal: {
    nome: "Especialidade Principal",
    unidadeMedida: "Especialidade",
    meta: "Monitoramento contínuo",
    direcao: "Identificar concentração assistencial",
    definicao: "Especialidade com o maior número de pacientes internados no momento da análise.",
    fonte: "Coleção 'pacientes' em tempo real no Firestore.",
    numerador: "Especialidade com maior contagem de pacientes ativos.",
    denominador: "Total de pacientes ativos.",
    criteriosInclusao: "Pacientes ativos com especialidade clínica registrada.",
    criteriosExclusao: "Pacientes sem especialidade definida.",
    formula: "argmax(contagem_pacientes_ativos por especialidade)",
    periodicidade: "Tempo real",
    impactoGestao: "Sinaliza onde concentrar recursos clínicos (médicos, materiais, leitos)."
  },

  taxaMediaOcupacaoGeral: {
    nome: "Taxa Média de Ocupação",
    unidadeMedida: "%",
    meta: "85% – 95%",
    direcao: "Ideal entre 85% e 95%",
    definicao: "Média da taxa de ocupação entre os tipos de setor considerados operacionais.",
    fonte: "Coleções 'leitos' e 'setores' em tempo real no Firestore.",
    numerador: "Soma das taxas de ocupação calculadas por tipo de setor.",
    denominador: "Número de tipos de setor analisados.",
    criteriosInclusao: "Leitos operacionais (excluídos bloqueados) e setores ativos.",
    criteriosExclusao: "Leitos bloqueados ou desativados.",
    formula: "Σ(taxa_ocupacao_por_tipo_setor) / N(tipos_setor)",
    periodicidade: "Tempo real",
    impactoGestao: "Acima de 95% indica risco de saturação; abaixo de 80% sugere capacidade ociosa. Use para decisões de bloqueio/abertura de leitos."
  },

  mediaPermanencia: {
    nome: "Média de Permanência",
    unidadeMedida: "Dias",
    meta: "< 7 dias",
    direcao: "Quanto menos, melhor",
    definicao: "Tempo médio, em dias, que os pacientes permanecem internados em um setor ou no hospital como um todo.",
    fonte: "Coleção 'historicoOcupacoes' no Firestore.",
    numerador: "Somatório do tempo de permanência de todos os pacientes que tiveram alta no período.",
    denominador: "Número total de pacientes que tiveram alta no período.",
    criteriosInclusao: "Pacientes com data de entrada e saída registradas no período de análise.",
    criteriosExclusao: "Pacientes ainda internados.",
    formula: "Σ(dataSaida − dataEntrada) / N(saídas)",
    periodicidade: "Histórico (período selecionado)",
    impactoGestao: "Permanências longas comprometem o giro do leito e elevam custo. Investigue casos extremos por especialidade.",
    resultado: "Valor numérico em dias."
  },

  giroLeitos: {
    nome: "Giro de Leitos",
    unidadeMedida: "Pacientes/Leito",
    meta: "> 1,2",
    direcao: "Quanto mais, melhor",
    definicao: "Quantos pacientes foram atendidos por leito em um período, refletindo eficiência da capacidade instalada.",
    fonte: "Coleções 'historicoOcupacoes' e 'leitos' no Firestore.",
    numerador: "Número total de pacientes que tiveram alta no período.",
    denominador: "Número médio de leitos disponíveis no período.",
    criteriosInclusao: "Todos os pacientes com alta no período e leitos operacionais.",
    criteriosExclusao: "Leitos bloqueados ou em manutenção.",
    formula: "N(altas_no_periodo) / média(leitos_disponiveis_no_periodo)",
    periodicidade: "Histórico (período selecionado)",
    impactoGestao: "Giro baixo indica gargalos no fluxo de alta e higienização. Compare entre setores para identificar onde atuar.",
    resultado: "Pacientes atendidos por leito no período."
  },

  taxaOcupacao: {
    nome: "Taxa de Ocupação",
    unidadeMedida: "%",
    meta: "85% – 95%",
    direcao: "Ideal entre 85% e 95%",
    definicao: "Percentual de leitos ocupados em relação ao total de leitos operacionais (ocupados + regulados + reservados / total - bloqueados).",
    fonte: "Coleções 'leitos' e 'pacientes' em tempo real no Firestore.",
    numerador: "Leitos com status Ocupado, Regulado ou Reservado.",
    denominador: "Leitos operacionais (Vago + Ocupado + Regulado + Reservado + Higienização).",
    criteriosInclusao: "Leitos operacionais e em funcionamento.",
    criteriosExclusao: "Leitos bloqueados ou desativados.",
    formula: "((Ocupados + Regulados + Reservados) / (Total − Bloqueados)) × 100",
    periodicidade: "Tempo real",
    impactoGestao: "Acompanhe por setor: UTIs > 90% exigem ação imediata de fluxo; enfermarias > 95% sinalizam gargalo de altas.",
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
    formula: "Σ(hoje − dataInternacao) / N(pacientes_por_especialidade)",
    periodicidade: "Tempo real",
    impactoGestao: "Identifique especialidades com permanência muito acima da média histórica para acionar discussão clínica.",
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
    formula: "Contagem agrupada por [diaSemana, faixaHoraria]",
    periodicidade: "Histórico acumulado",
    impactoGestao: "Use para dimensionar plantões: turnos com pico recorrente devem ter reforço de equipe e logística.",
    resultado: "Matriz de distribuição temporal das internações."
  },

  distribuicaoGruposClinicos: {
    nome: "Distribuição por Clínicas Maiores",
    unidadeMedida: "Pacientes",
    meta: "Balanceamento conforme vocação assistencial",
    direcao: "Análise de mix de pacientes",
    definicao: "Proporção de pacientes internados agrupados em macrocategorias clínicas (Clínica Médica, Cirúrgico, Oncologia, etc.).",
    fonte: "Coleção 'pacientes' em tempo real no Firestore.",
    numerador: "Número de pacientes ativos dentro de cada grupo clínico agregado.",
    denominador: "Total de pacientes ativos no período.",
    criteriosInclusao: "Pacientes ativos com especialidade passível de mapeamento.",
    criteriosExclusao: "Pacientes sem especialidade registrada.",
    formula: "N(pacientes_por_grupo) / N(pacientes_ativos)",
    periodicidade: "Tempo real",
    impactoGestao: "Permite ver se o mix atual reflete o planejamento estratégico do hospital."
  },

  // Alias usado no MapaLeitosDashboard
  distribuicaoEspecialidades: {
    nome: "Distribuição por Especialidades",
    unidadeMedida: "Pacientes",
    meta: "Balanceamento conforme vocação assistencial",
    direcao: "Análise de mix de pacientes",
    definicao: "Distribuição dos pacientes internados por grupo clínico (Clínica Médica, Cirúrgico, Oncologia, etc.).",
    fonte: "Coleção 'pacientes' em tempo real no Firestore.",
    numerador: "Número de pacientes ativos por grupo clínico.",
    denominador: "Total de pacientes ativos.",
    criteriosInclusao: "Pacientes ativos com especialidade mapeada.",
    criteriosExclusao: "Pacientes sem especialidade.",
    formula: "Contagem agrupada por grupo clínico",
    periodicidade: "Tempo real",
    impactoGestao: "Avalia se a distribuição clínica condiz com a vocação do hospital."
  },

  especialidadesPorSetor: {
    nome: "Especialidades por Setor",
    unidadeMedida: "Pacientes",
    meta: "Aderência entre perfil clínico e vocação do setor",
    direcao: "Identificar desalinhamentos",
    definicao: "Distribuição de pacientes por grupo clínico dentro de cada setor assistencial.",
    fonte: "Coleções 'pacientes', 'leitos' e 'setores' em tempo real no Firestore.",
    numerador: "Número de pacientes ativos de cada grupo clínico em um setor.",
    denominador: "Total de pacientes ativos daquele setor.",
    criteriosInclusao: "Pacientes ativos com setor identificado.",
    criteriosExclusao: "Pacientes sem vínculo de setor ou especialidade.",
    formula: "Contagem por [setor, grupoClinico]",
    periodicidade: "Tempo real",
    impactoGestao: "Permite identificar setores recebendo perfis fora da sua vocação clínica e atuar na regulação."
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
    formula: "(Contagem por status / Total de regulações) × 100",
    periodicidade: "Histórico (período selecionado)",
    impactoGestao: "Cancelamentos altos exigem revisão dos critérios de regulação ou comunicação entre setores.",
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
    formula: "Contagem por par [origem, destino]",
    periodicidade: "Histórico (período selecionado)",
    impactoGestao: "Identifica setores 'emissores' (sobrecarregados) e 'receptores' (gargalos) para planejar capacidade.",
    resultado: "Matriz de fluxos entre setores."
  },

  tempoRegulacao: {
    nome: "Tempo Médio de Regulação por Horário",
    unidadeMedida: "Minutos",
    meta: "< 30 minutos",
    direcao: "Quanto menos, melhor",
    definicao: "Tempo médio para concluir uma regulação, do início à finalização, analisado por faixa horária.",
    fonte: "Coleção 'auditoria' com timestamps de início e conclusão das regulações.",
    numerador: "Somatório do tempo de regulação por faixa horária.",
    denominador: "Número de regulações concluídas por faixa horária.",
    criteriosInclusao: "Regulações concluídas com timestamps de início e fim.",
    criteriosExclusao: "Regulações canceladas ou ainda pendentes.",
    formula: "Σ(tempoFim − tempoInicio) / N(regulacoes_por_faixa)",
    periodicidade: "Histórico (período selecionado)",
    impactoGestao: "Tempos altos em determinadas faixas horárias indicam falta de equipe ou processos lentos nesses turnos.",
    resultado: "Tempo médio em minutos por faixa horária."
  },

  // ============================================================
  // Indicadores do bloco "Análise do Processo de Regulação"
  // (componente src/components/IndicadoresRegulacao.jsx)
  // ============================================================

  historicoTotalRegulacoes: {
    nome: "Total de Regulações (Período)",
    unidadeMedida: "Regulações",
    meta: "Acompanhamento contínuo",
    direcao: "Análise de volume",
    definicao: "Volume total de regulações de leito (movimentações internas) registradas no histórico durante o período selecionado.",
    fonte: "Coleção 'historicoRegulacoes' no Firestore.",
    numerador: "Contagem de documentos cuja dataInicio ou dataConclusao está dentro do intervalo selecionado.",
    denominador: "—",
    criteriosInclusao: "Regulações com pelo menos uma data válida (início ou conclusão) dentro do período.",
    criteriosExclusao: "Registros sem datas válidas.",
    formula: "Contagem de regulações no intervalo [from, to]",
    periodicidade: "Histórico — varia conforme o intervalo selecionado",
    impactoGestao: "Mostra o esforço total de regulação. Picos podem indicar surtos de demanda ou represamento; quedas podem indicar bloqueio de fluxo."
  },

  historicoTempoMedio: {
    nome: "Tempo Médio de Conclusão",
    unidadeMedida: "Minutos / Horas",
    meta: "Quanto menor, melhor (referência interna)",
    direcao: "Quanto menos, melhor",
    definicao: "Tempo médio entre o início e a conclusão das regulações finalizadas no período selecionado.",
    fonte: "Coleção 'historicoRegulacoes' (campo tempoRegulacaoMinutos).",
    numerador: "Somatório do tempo (em minutos) das regulações concluídas no período.",
    denominador: "Número de regulações concluídas no período.",
    criteriosInclusao: "Regulações com statusFinal = 'concluida' e tempoRegulacaoMinutos > 0.",
    criteriosExclusao: "Regulações canceladas, alteradas, em andamento ou sem tempo registrado.",
    formula: "Σ(tempoRegulacaoMinutos) / N(regulações concluídas)",
    periodicidade: "Histórico (período selecionado)",
    impactoGestao: "Tempo alto sugere gargalos no processo (autorização, higienização, transporte). Compare entre períodos para medir melhorias."
  },

  historicoTaxaSucesso: {
    nome: "Taxa de Sucesso das Regulações",
    unidadeMedida: "%",
    meta: "≥ 85%",
    direcao: "Quanto mais, melhor",
    definicao: "Percentual de regulações iniciadas no período que foram efetivamente concluídas (paciente acomodado).",
    fonte: "Coleção 'historicoRegulacoes' (campo statusFinal).",
    numerador: "Número de regulações com statusFinal = 'concluida'.",
    denominador: "Total de regulações no período.",
    criteriosInclusao: "Todas as regulações com pelo menos uma data dentro do período.",
    criteriosExclusao: "Registros corrompidos ou sem statusFinal.",
    formula: "(Concluídas / Total) × 100",
    periodicidade: "Histórico (período selecionado)",
    impactoGestao: "Taxa baixa indica muitos cancelamentos: revise critérios de regulação, comunicação entre setores e disponibilidade real do leito destino."
  },

  desfechoRegulacoes: {
    nome: "Desfecho das Regulações",
    unidadeMedida: "Contagem",
    meta: "Maximizar concluídas, minimizar canceladas",
    direcao: "Mais conclusões, menos cancelamentos",
    definicao: "Distribuição das regulações por desfecho final (concluída, cancelada, alterada, em andamento) no período selecionado.",
    fonte: "Coleções 'historicoRegulacoes' (statusFinal) e 'pacientes' (regulacaoAtiva, para 'Em Andamento').",
    numerador: "Contagem de regulações por statusFinal.",
    denominador: "Total de regulações no período.",
    criteriosInclusao: "Regulações no período + pacientes com regulação ativa (em andamento).",
    criteriosExclusao: "Registros sem statusFinal e sem regulacaoAtiva.",
    formula: "Contagem agrupada por statusFinal",
    periodicidade: "Histórico (período selecionado) + tempo real para 'Em Andamento'",
    impactoGestao: "Use para identificar padrões: muitas alterações sugerem instabilidade clínica; muitos cancelamentos sugerem falha de processo."
  },

  iniciosPorHora: {
    nome: "Inícios de Regulação por Hora do Dia",
    unidadeMedida: "Contagem",
    meta: "Distribuição alinhada à escala assistencial",
    direcao: "Análise de padrão",
    definicao: "Distribuição das regulações iniciadas por hora do dia (0–23h) no período selecionado, segmentada por turno (manhã/tarde/noite).",
    fonte: "Coleção 'historicoRegulacoes' (campo dataInicio).",
    numerador: "Contagem de regulações iniciadas em cada hora.",
    denominador: "Total de regulações no período.",
    criteriosInclusao: "Regulações com dataInicio válido dentro do período.",
    criteriosExclusao: "Regulações sem dataInicio.",
    formula: "Contagem agrupada por hora(dataInicio)",
    periodicidade: "Histórico (período selecionado)",
    impactoGestao: "Identifica picos para dimensionar plantão da regulação. Picos noturnos sugerem reforço de equipe nos turnos menos cobertos."
  },

  eficienciaSetorOrigemDestino: {
    nome: "Eficiência por Setor: Origem vs. Destino",
    unidadeMedida: "Minutos",
    meta: "Equilíbrio entre origem e destino",
    direcao: "Quanto menos, melhor",
    definicao: "Comparação do tempo médio de regulação quando o setor atua como origem (paciente saindo) vs. destino (paciente chegando).",
    fonte: "Coleção 'historicoRegulacoes' (tempoRegulacaoMinutos + setorOrigemId / setorDestinoId).",
    numerador: "Somatório do tempo de regulação concluída em que o setor figura como origem ou destino.",
    denominador: "Número de regulações concluídas com aquele setor como origem/destino.",
    criteriosInclusao: "Regulações concluídas com tempo > 0 e setores identificados.",
    criteriosExclusao: "Regulações canceladas, alteradas ou sem identificação de setor.",
    formula: "Para cada setor: Σ(tempo) / N(regulações) — separado por papel (origem ou destino)",
    periodicidade: "Histórico (período selecionado)",
    impactoGestao: "Setores que demoram para liberar (origem alta) indicam gargalo de alta. Setores que demoram para receber (destino alto) indicam gargalo de admissão/higienização."
  },

  volumeSemanalTurno: {
    nome: "Volume Semanal por Turno",
    unidadeMedida: "Regulações",
    meta: "Distribuição alinhada à escala",
    direcao: "Análise de padrão",
    definicao: "Volume de regulações iniciadas por dia da semana, segmentado por turno (manhã, tarde, noite).",
    fonte: "Coleção 'historicoRegulacoes' (campo dataInicio).",
    numerador: "Contagem de regulações iniciadas por [diaSemana, turno].",
    denominador: "Total de regulações no período.",
    criteriosInclusao: "Regulações com dataInicio válido.",
    criteriosExclusao: "Regulações sem dataInicio.",
    formula: "Contagem agrupada por [dayOfWeek(dataInicio), turno(dataInicio)]",
    periodicidade: "Histórico (período selecionado)",
    impactoGestao: "Permite alinhar escala de plantonistas e regulação aos picos semanais. Dias com volume alto + turno noturno fraco merecem reforço."
  }
};
