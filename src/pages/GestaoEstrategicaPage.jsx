import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import {
  Activity,
  AlignLeft,
  BarChart3,
  Calendar,
  Info,
  Layers,
  PieChart as PieChartIcon,
  Stethoscope,
  Users,
  Copy
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  Legend,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Bar
} from 'recharts';
import IndicadorInfoModal from '@/components/modals/IndicadorInfoModal';
import { onSnapshot } from '@/lib/firebase';
import {
  getPacientesCollection,
  getHistoricoOcupacoesCollection,
  getLeitosCollection,
  getSetoresCollection
} from '@/lib/firebase';
import { calcularPermanenciaAtual } from '@/lib/historicoOcupacoes';
import { getDay, getHours } from 'date-fns';
import ListaPacientesPorSetorModal from '@/components/modals/ListaPacientesPorSetorModal';
import IndicadoresRegulacao from '@/components/IndicadoresRegulacao';

const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const FAIXAS_HORARIO = ['0-6h', '6-12h', '12-18h', '18-24h'];

const GRUPOS_CLINICOS = {
  'Clínica Médica': ['CLINICA GERAL', 'OTORRINOLARINGOLOGIA', 'PROCTOLOGIA', 'INTENSIVISTA', 'RESIDENTE', 'HEPATOLOGISTA'],
  'Cirúrgico': ['CIRURGIA GERAL', 'CIRURGIA TORACICA', 'CIRURGIA PLASTICA', 'CIRURGIA CABECA E PESCOCO', 'CIRURGIA VASCULAR'],
  'Oncologia': ['HEMATOLOGIA', 'ONCOLOGIA CLINICA/CANCEROLOGIA', 'ONCOLOGIA CIRURGICA', 'MASTOLOGIA'],
  'Nefrologia': ['NEFROLOGIA', 'UROLOGIA'],
  'Neurologia': ['NEUROLOGIA', 'NEUROCIRURGIA'],
  'Ortopedia': ['ORTOPEDIA/TRAUMATOLOGIA', 'ODONTOLOGIA C.TRAUM.B.M.F.', 'BUCOMAXILO']
};

const GRUPO_CORES = {
  'Clínica Médica': '#2563eb',
  'Cirúrgico': '#7c3aed',
  'Oncologia': '#ea580c',
  'Nefrologia': '#059669',
  'Neurologia': '#0ea5e9',
  'Ortopedia': '#facc15',
  'Outras Especialidades': '#6b7280'
};

const PIE_COLORS = ['#2563eb', '#7c3aed', '#ea580c', '#059669', '#0ea5e9', '#facc15', '#14b8a6'];

const KPI_CONFIG = [
  {
    id: 'internacoesAtivas',
    title: 'Internações Ativas',
    description: 'Pacientes atualmente internados ou em acompanhamento ativo.',
    icon: Activity
  },
  {
    id: 'especialidadesAtivas',
    title: 'Especialidades Ativas',
    description: 'Diversidade de especialidades com pacientes internados.',
    icon: Stethoscope
  },
  {
    id: 'especialidadePrincipal',
    title: 'Especialidade Principal',
    description: 'Maior concentração de pacientes em acompanhamento.',
    icon: PieChartIcon
  },
  {
    id: 'taxaMediaOcupacaoGeral',
    title: 'Taxa Média de Ocupação',
    description: 'Média da ocupação entre os tipos de setor monitorados.',
    icon: BarChart3
  }
];

const GRUPO_LABELS = [...Object.keys(GRUPOS_CLINICOS), 'Outras Especialidades'];

const isStatusBloqueado = (status) => {
  if (!status) return false;
  const normalized = String(status).toLowerCase();
  return normalized.includes('bloque');
};

const isStatusOcupado = (status) => {
  if (!status) return false;
  const normalized = String(status).toLowerCase();
  return ['ocupado', 'regulado', 'reservado'].some((valor) => normalized.includes(valor));
};

const identificarGrupoClinico = (especialidade) => {
  if (!especialidade) return 'Outras Especialidades';

  const normalizado = String(especialidade).trim().toUpperCase();
  if (!normalizado) {
    return 'Outras Especialidades';
  }

  const entrada = Object.entries(GRUPOS_CLINICOS).find(([, especialidades]) =>
    especialidades.includes(normalizado)
  );

  if (entrada) {
    return entrada[0];
  }

  return 'Outras Especialidades';
};

const GestaoEstrategicaPage = () => {
  const { toast } = useToast();
  const [pacientes, setPacientes] = useState(null);
  const [historicoOcupacoes, setHistoricoOcupacoes] = useState(null);
  const [leitos, setLeitos] = useState(null);
  const [setores, setSetores] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modalIndicador, setModalIndicador] = useState({ open: false, indicadorId: null });
  const [modalPacientes, setModalPacientes] = useState({ open: false, setor: null, grupo: null });

  useEffect(() => {
    const unsubscribePacientes = onSnapshot(getPacientesCollection(), (snapshot) => {
      setPacientes(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))); 
    });

    const unsubscribeHistorico = onSnapshot(getHistoricoOcupacoesCollection(), (snapshot) => {
      setHistoricoOcupacoes(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });

    const unsubscribeLeitos = onSnapshot(getLeitosCollection(), (snapshot) => {
      setLeitos(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });

    const unsubscribeSetores = onSnapshot(getSetoresCollection(), (snapshot) => {
      setSetores(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubscribePacientes();
      unsubscribeHistorico();
      unsubscribeLeitos();
      unsubscribeSetores();
    };
  }, []);

  useEffect(() => {
    if (pacientes && historicoOcupacoes && leitos && setores) {
      setLoading(false);
    }
  }, [pacientes, historicoOcupacoes, leitos, setores]);

  const pacientesList = pacientes || [];
  const leitosList = leitos || [];
  const setoresList = setores || [];
  const historicoList = historicoOcupacoes || [];

  const pacientesAtivos = useMemo(() => {
    return pacientesList.filter((paciente) => {
      const status = (paciente?.status || paciente?.statusInternacao || paciente?.situacao || '').toString().toLowerCase();
      if (status) {
        if (['alta', 'óbito', 'obito', 'transfer', 'cancel'].some((palavra) => status.includes(palavra))) {
          return false;
        }
        if (status.includes('intern') || status.includes('ativo')) {
          return true;
        }
      }

      if (paciente?.dataAlta || paciente?.dataSaida) {
        return false;
      }

      return true;
    });
  }, [pacientesList]);

  const leitosPorId = useMemo(() => new Map(leitosList.map((leito) => [leito.id, leito])), [leitosList]);
  const setoresPorId = useMemo(() => new Map(setoresList.map((setor) => [setor.id, setor])), [setoresList]);

  const pacientesAtivosEnriquecidos = useMemo(() => {
    if (!pacientesAtivos.length) {
      return [];
    }

    return pacientesAtivos.map((paciente) => {
      const leito = paciente?.leitoId ? leitosPorId.get(paciente.leitoId) : null;
      const setorId = paciente?.setorId || leito?.setorId || null;
      const setor = setorId ? setoresPorId.get(setorId) : null;
      const nomeSetor = setor?.siglaSetor || setor?.nomeSetor || setor?.nome || 'Setor não identificado';
      const grupoClinico = identificarGrupoClinico(paciente?.especialidade);
      const especialidadeFormatada = paciente?.especialidade
        ? String(paciente.especialidade).trim().toUpperCase()
        : 'ESPECIALIDADE NÃO INFORMADA';

      return {
        ...paciente,
        setorId,
        nomeSetor,
        codigoLeito: leito?.codigoLeito || paciente?.codigoLeito || paciente?.leitoCodigo || '—',
        grupoClinico,
        especialidadeFormatada,
      };
    });
  }, [pacientesAtivos, leitosPorId, setoresPorId]);

  const dadosTaxaOcupacao = useMemo(() => {
    if (!leitosList.length || !setoresList.length) {
      return [];
    }

    const tiposSetorUnicos = Array.from(
      new Set(setoresList.map((setor) => setor?.tipoSetor || 'Não classificado'))
    );

    return tiposSetorUnicos.map((tipo) => {
      const setoresDoTipo = setoresList.filter((setor) => (setor?.tipoSetor || 'Não classificado') === tipo);
      const setorIds = new Set(setoresDoTipo.map((setor) => setor.id));
      const leitosDoTipo = leitosList.filter((leito) => setorIds.has(leito.setorId));

      const totalLeitos = leitosDoTipo.length;
      const leitosOperacionais = leitosDoTipo.filter((leito) => !isStatusBloqueado(leito.status)).length;
      const leitosOcupados = leitosDoTipo.filter((leito) => isStatusOcupado(leito.status)).length;

      const taxaOcupacao = leitosOperacionais > 0
        ? Math.round((leitosOcupados / leitosOperacionais) * 100)
        : 0;

      return {
        tipo: tipo || 'Não classificado',
        taxaOcupacao,
        ocupados: leitosOcupados,
        disponiveis: leitosOperacionais,
        total: totalLeitos
      };
    }).sort((a, b) => b.taxaOcupacao - a.taxaOcupacao);
  }, [leitosList, setoresList]);

  const taxaMediaOcupacao = useMemo(() => {
    if (!dadosTaxaOcupacao.length) {
      return 0;
    }
    const soma = dadosTaxaOcupacao.reduce((acc, item) => acc + item.taxaOcupacao, 0);
    return Math.round(soma / dadosTaxaOcupacao.length);
  }, [dadosTaxaOcupacao]);

  const especialidadesAtivas = useMemo(() => {
    const contagem = new Map();

    pacientesAtivos.forEach((paciente) => {
      const especialidade = paciente?.especialidade;
      if (!especialidade) {
        return;
      }

      const chave = String(especialidade).trim();
      if (!chave) {
        return;
      }

      contagem.set(chave, (contagem.get(chave) || 0) + 1);
    });

    const lista = Array.from(contagem.entries()).sort((a, b) => b[1] - a[1]);

    return {
      total: contagem.size,
      principal: lista.length ? lista[0][0] : 'Sem especialidade definida'
    };
  }, [pacientesAtivos]);

  const dadosDistribuicaoClinicasDetalhados = useMemo(() => {
    if (!pacientesAtivosEnriquecidos.length) {
      return [];
    }

    const contagemPorGrupo = new Map();

    pacientesAtivosEnriquecidos.forEach((paciente) => {
      const grupo = paciente.grupoClinico || 'Outras Especialidades';
      const especialidade = paciente.especialidadeFormatada || 'ESPECIALIDADE NÃO INFORMADA';

      if (!contagemPorGrupo.has(grupo)) {
        contagemPorGrupo.set(grupo, {
          grupo,
          total: 0,
          especialidades: new Map(),
        });
      }

      const registroGrupo = contagemPorGrupo.get(grupo);
      registroGrupo.total += 1;
      registroGrupo.especialidades.set(
        especialidade,
        (registroGrupo.especialidades.get(especialidade) || 0) + 1
      );
    });

    return Array.from(contagemPorGrupo.values())
      .map((item) => ({
        ...item,
        especialidades: Array.from(item.especialidades.entries())
          .sort((a, b) => b[1] - a[1])
          .map(([nome, quantidade]) => ({ nome, quantidade })),
      }))
      .sort((a, b) => b.total - a.total);
  }, [pacientesAtivosEnriquecidos]);

  const dadosDistribuicaoClinicas = useMemo(() => {
    return dadosDistribuicaoClinicasDetalhados.map(({ grupo, total }) => ({
      name: grupo,
      value: total,
    }));
  }, [dadosDistribuicaoClinicasDetalhados]);

  const dadosEspecialidadesPorSetor = useMemo(() => {
    if (!pacientesAtivosEnriquecidos.length) {
      return [];
    }

    const agregados = new Map();

    pacientesAtivosEnriquecidos.forEach((paciente) => {
      const nomeSetor = paciente.nomeSetor || 'Setor não identificado';
      const grupo = paciente.grupoClinico || 'Outras Especialidades';

      if (!agregados.has(nomeSetor)) {
        const estrutura = { setor: nomeSetor, total: 0 };
        GRUPO_LABELS.forEach((grupoNome) => {
          estrutura[grupoNome] = 0;
        });
        agregados.set(nomeSetor, estrutura);
      }

      const entrada = agregados.get(nomeSetor);
      entrada[grupo] = (entrada[grupo] || 0) + 1;
      entrada.total += 1;
    });

    return Array.from(agregados.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [pacientesAtivosEnriquecidos]);

  const gruposAtivosNoSetor = useMemo(() => {
    const ativos = new Set();
    dadosEspecialidadesPorSetor.forEach((entrada) => {
      GRUPO_LABELS.forEach((grupo) => {
        if ((entrada[grupo] || 0) > 0) {
          ativos.add(grupo);
        }
      });
    });

    return GRUPO_LABELS.filter((grupo) => ativos.has(grupo));
  }, [dadosEspecialidadesPorSetor]);

  const relatorioDistribuicaoClinicasTexto = useMemo(() => {
    if (!dadosDistribuicaoClinicasDetalhados.length) {
      return '*RELATÓRIO DE DISTRIBUIÇÃO POR CLÍNICAS*\n\nNenhum paciente ativo encontrado.';
    }

    const linhas = ['*RELATÓRIO DE DISTRIBUIÇÃO POR CLÍNICAS*', ''];

    dadosDistribuicaoClinicasDetalhados.forEach(({ grupo, total, especialidades }) => {
      linhas.push(`*Grupo ${grupo}: ${total} paciente(s)*`);
      especialidades.forEach(({ nome, quantidade }) => {
        linhas.push(`- ${nome}: ${quantidade}`);
      });
      linhas.push('');
    });

    return linhas.join('\n').trim();
  }, [dadosDistribuicaoClinicasDetalhados]);

  const handleCopiarRelatorioClinicas = useCallback(async () => {
    if (!dadosDistribuicaoClinicasDetalhados.length) {
      toast({
        title: 'Nenhum dado disponível',
        description: 'Não há pacientes ativos para gerar o relatório detalhado no momento.',
        variant: 'destructive',
      });
      return;
    }

    if (!navigator?.clipboard?.writeText) {
      toast({
        title: 'Copiador indisponível',
        description: 'Não foi possível acessar a área de transferência neste dispositivo.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await navigator.clipboard.writeText(relatorioDistribuicaoClinicasTexto);
      toast({
        title: 'Relatório copiado com sucesso!',
        description: 'Os dados de distribuição por clínicas foram enviados para a sua área de transferência.',
      });
    } catch (error) {
      console.error('Erro ao copiar relatório de distribuição por clínicas:', error);
      toast({
        title: 'Erro ao copiar relatório.',
        description: 'Tente novamente ou copie manualmente as informações exibidas.',
        variant: 'destructive',
      });
    }
  }, [dadosDistribuicaoClinicasDetalhados.length, relatorioDistribuicaoClinicasTexto, toast]);

  const handleAbrirModalPacientesPorSetor = useCallback((grupo, data) => {
    const setorNome = data?.payload?.setor;
    if (!setorNome) {
      return;
    }

    setModalPacientes({ open: true, setor: setorNome, grupo });
  }, [setModalPacientes]);

  const fecharModalPacientes = useCallback(() => {
    setModalPacientes({ open: false, setor: null, grupo: null });
  }, [setModalPacientes]);

  const dadosHeatmap = useMemo(() => {
    const todasInternacoes = [
      ...pacientesList.map((paciente) => paciente.dataInternacao).filter(Boolean),
      ...historicoList.map((registro) => registro.dataEntrada).filter(Boolean)
    ];

    const matriz = {};
    DIAS_SEMANA.forEach((dia) => {
      matriz[dia] = {};
      FAIXAS_HORARIO.forEach((faixa) => {
        matriz[dia][faixa] = 0;
      });
    });

    todasInternacoes.forEach((data) => {
      const dataObj = data?.toDate ? data.toDate() : new Date(data);
      if (Number.isNaN(dataObj.getTime())) {
        return;
      }

      const diaSemana = DIAS_SEMANA[getDay(dataObj)];
      const hora = getHours(dataObj);

      let faixaHorario = '18-24h';
      if (hora >= 0 && hora < 6) faixaHorario = '0-6h';
      else if (hora < 12) faixaHorario = '6-12h';
      else if (hora < 18) faixaHorario = '12-18h';

      matriz[diaSemana][faixaHorario] += 1;
    });

    return matriz;
  }, [pacientesList, historicoList]);

  const dadosPermanenciaEspecialidade = useMemo(() => {
    if (!pacientesAtivos.length) {
      return [];
    }

    const grupos = {};

    pacientesAtivos.forEach((paciente) => {
      if (paciente?.especialidade && paciente?.dataInternacao) {
        const grupo = identificarGrupoClinico(paciente.especialidade);
        if (!grupos[grupo]) {
          grupos[grupo] = { total: 0, count: 0 };
        }

        grupos[grupo].total += calcularPermanenciaAtual(paciente.dataInternacao);
        grupos[grupo].count += 1;
      }
    });

    return Object.entries(grupos)
      .map(([grupo, valores]) => ({
        especialidade: grupo,
        mediaPermanencia: Math.round((valores.total / valores.count) * 10) / 10,
        pacientes: valores.count
      }))
      .sort((a, b) => b.mediaPermanencia - a.mediaPermanencia)
      .slice(0, 8);
  }, [pacientesAtivos]);

  const abrirModalIndicador = (indicadorId) => {
    setModalIndicador({ open: true, indicadorId });
  };

  const fecharModalIndicador = () => {
    setModalIndicador({ open: false, indicadorId: null });
  };

  const renderTooltipDistribuicao = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const total = dadosDistribuicaoClinicas.reduce((acc, item) => acc + item.value, 0);
      const valor = payload[0].value;
      const percentual = total > 0 ? ((valor / total) * 100).toFixed(1) : 0;

      return (
        <div className="rounded-lg border bg-background p-3 shadow-sm">
          <p className="font-medium text-sm">{payload[0].payload.name}</p>
          <p className="text-xs text-muted-foreground">{valor} pacientes ({percentual}%)</p>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-muted/40">
        <div className="mx-auto max-w-7xl space-y-8 p-6">
          <div className="space-y-4">
            <Skeleton className="h-10 w-72" />
            <Skeleton className="h-5 w-96" />
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-40 w-full" />
            ))}
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Skeleton className="h-96 w-full" />
            <Skeleton className="h-96 w-full" />
          </div>
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  const kpiValues = {
    internacoesAtivas: pacientesAtivos.length,
    especialidadesAtivas: especialidadesAtivas.total,
    especialidadePrincipal: especialidadesAtivas.principal,
    taxaMediaOcupacaoGeral: `${taxaMediaOcupacao}%`
  };

  return (
    <div className="min-h-screen bg-muted/40">
      <div className="mx-auto max-w-7xl space-y-12 p-6">
        <header className="space-y-2">
          <Badge variant="outline">Gestão Estratégica</Badge>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Visão Estratégica da Capacidade Assistencial
          </h1>
          <p className="text-sm text-muted-foreground max-w-3xl">
            Acompanhe a jornada do paciente e da infraestrutura hospitalar desde o panorama macro de ocupação até as nuances de
            perfil assistencial e eficiência operacional.
          </p>
        </header>

        {/* Nível 1 */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-foreground">Panorama Geral</h2>
              <p className="text-sm text-muted-foreground">
                Indicadores críticos para o status atual das internações e da capacidade.
              </p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {KPI_CONFIG.map(({ id, title, description, icon: Icon }) => (
              <Card key={id} className="border-muted">
                <CardHeader className="flex items-start justify-between space-y-0 pb-4">
                  <div>
                    <CardTitle className="text-sm font-semibold text-muted-foreground">{title}</CardTitle>
                    <div className="mt-3 text-3xl font-bold text-foreground">
                      {kpiValues[id] ?? '—'}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{description}</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="rounded-full bg-primary/10 p-2 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => abrirModalIndicador(id)}
                    >
                      <Info className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>

        {/* Nível 2 */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-foreground">Capacidade e Ocupação</h2>
              <p className="text-sm text-muted-foreground">
                Avalie gargalos e oportunidades de expansão por tipo de setor assistencial.
              </p>
            </div>
          </div>
          <Card className="border-muted">
            <CardHeader className="flex items-start justify-between space-y-0 pb-4">
              <div>
                <CardTitle className="flex items-center gap-2 text-foreground">
                  <Layers className="h-5 w-5 text-primary" />
                  Taxa de Ocupação por Tipo de Setor
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Visualize como os diferentes tipos de setor estão utilizando sua capacidade instalada.
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => abrirModalIndicador('taxaOcupacao')}
              >
                <Info className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dadosTaxaOcupacao}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="tipo" />
                    <YAxis />
                    <RechartsTooltip
                      formatter={(value) => [`${value}%`, 'Taxa de Ocupação']}
                      labelFormatter={(label) => `Tipo de Setor: ${label}`}
                    />
                    <Legend />
                    <Bar dataKey="taxaOcupacao" name="Taxa de Ocupação" fill="#2563eb" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Nível 3 */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-foreground">Perfil do Paciente</h2>
              <p className="text-sm text-muted-foreground">
                Entenda quais grupos clínicos dominam a ocupação e como eles se distribuem pelos setores.
              </p>
            </div>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border-muted">
              <CardHeader className="flex items-start justify-between space-y-0 pb-4">
                <div>
                  <CardTitle className="flex items-center gap-2 text-foreground">
                    <PieChartIcon className="h-5 w-5 text-primary" />
                    Distribuição por Clínicas Maiores
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Pacientes agrupados em macrocategorias assistenciais para avaliar especialidades predominantes.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={handleCopiarRelatorioClinicas}
                    disabled={!dadosDistribuicaoClinicasDetalhados.length}
                    aria-label="Copiar relatório detalhado da distribuição por clínicas"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => abrirModalIndicador('distribuicaoGruposClinicos')}
                    aria-label="Ver detalhes do indicador de distribuição por clínicas"
                  >
                    <Info className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {dadosDistribuicaoClinicas.length ? (
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={dadosDistribuicaoClinicas}
                          cx="50%"
                          cy="50%"
                          outerRadius={110}
                          dataKey="value"
                          labelLine={false}
                          label={({ percent }) => (percent > 0.05 ? `${Math.round(percent * 100)}%` : '')}
                        >
                          {dadosDistribuicaoClinicas.map((entrada, index) => (
                            <Cell
                              key={entrada.name}
                              fill={GRUPO_CORES[entrada.name] || PIE_COLORS[index % PIE_COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <RechartsTooltip content={renderTooltipDistribuicao} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="flex h-80 items-center justify-center text-sm text-muted-foreground">
                    Nenhum dado de pacientes ativos disponível.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-muted">
              <CardHeader className="flex items-start justify-between space-y-0 pb-4">
                <div>
                  <CardTitle className="flex items-center gap-2 text-foreground">
                    <AlignLeft className="h-5 w-5 text-primary" />
                    Especialidades por Setor
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Distribuição dos grupos clínicos predominantes em cada setor assistencial.
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => abrirModalIndicador('especialidadesPorSetor')}
                >
                  <Info className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent>
                {dadosEspecialidadesPorSetor.length ? (
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dadosEspecialidadesPorSetor} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="setor" tick={{ fontSize: 12 }} interval={0} angle={-15} textAnchor="end" height={70} />
                        <YAxis allowDecimals={false} />
                        <RechartsTooltip />
                        <Legend />
                        {gruposAtivosNoSetor.map((grupo) => (
                          <Bar
                            key={grupo}
                            dataKey={grupo}
                            stackId="a"
                            name={grupo}
                            fill={GRUPO_CORES[grupo] || '#94a3b8'}
                            cursor="pointer"
                            onClick={(data) => handleAbrirModalPacientesPorSetor(grupo, data)}
                          />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="flex h-80 items-center justify-center text-sm text-muted-foreground">
                    Nenhuma combinação de setor e especialidade encontrada.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Nível 4 */}
        <section className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Fluxo e Eficiência</h2>
            <p className="text-sm text-muted-foreground">
              Identifique padrões de entrada e permanência para otimizar o uso dos leitos.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border-muted">
              <CardHeader className="flex items-start justify-between space-y-0 pb-4">
                <div>
                  <CardTitle className="flex items-center gap-2 text-foreground">
                    <Calendar className="h-5 w-5 text-primary" />
                    Padrão de Internações por Dia e Horário
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Concentre esforços assistenciais nos períodos de maior demanda de admissões.
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => abrirModalIndicador('internacoesHorario')}
                >
                  <Info className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <div className="grid min-w-[640px] grid-cols-[120px_repeat(7,1fr)] gap-2">
                    <div />
                    {DIAS_SEMANA.map((dia) => (
                      <div key={dia} className="rounded bg-muted p-2 text-center text-xs font-medium">
                        {dia}
                      </div>
                    ))}
                    {FAIXAS_HORARIO.map((faixa) => (
                      <React.Fragment key={faixa}>
                        <div className="flex items-center rounded bg-muted p-2 text-xs font-medium">
                          {faixa}
                        </div>
                        {DIAS_SEMANA.map((dia) => {
                          const valor = dadosHeatmap[dia]?.[faixa] || 0;
                          const maxValor = Math.max(
                            ...DIAS_SEMANA.flatMap((diaSemana) =>
                              FAIXAS_HORARIO.map((faixaHorario) => dadosHeatmap[diaSemana]?.[faixaHorario] || 0)
                            )
                          );
                          const intensidade = maxValor > 0 ? valor / maxValor : 0;

                          return (
                            <div
                              key={`${dia}-${faixa}`}
                              className="rounded p-2 text-center text-xs font-medium"
                              style={{
                                backgroundColor: `hsl(211, 96%, ${95 - intensidade * 35}%)`,
                                color: intensidade > 0.6 ? '#fff' : '#0f172a'
                              }}
                            >
                              {valor}
                            </div>
                          );
                        })}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-muted">
              <CardHeader className="flex items-start justify-between space-y-0 pb-4">
                <div>
                  <CardTitle className="flex items-center gap-2 text-foreground">
                    <Users className="h-5 w-5 text-primary" />
                    Permanência Atual por Grupo Clínico
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Monitore o tempo médio de permanência dos pacientes ativos em cada grupo clínico.
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => abrirModalIndicador('permanenciaAtualEspecialidade')}
                >
                  <Info className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {dadosPermanenciaEspecialidade.map((item) => (
                    <div
                      key={item.especialidade}
                      className="flex items-center justify-between rounded-lg bg-muted/60 p-3"
                    >
                      <span className="text-sm font-medium text-foreground">{item.especialidade}</span>
                      <div className="flex items-center gap-2 text-xs">
                        <Badge variant="outline">{item.pacientes} pac.</Badge>
                        <Badge variant="secondary">{item.mediaPermanencia} dias</Badge>
                      </div>
                    </div>
                  ))}
                  {!dadosPermanenciaEspecialidade.length && (
                    <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                      Não há pacientes com dados suficientes para calcular a permanência.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Análise do Processo de Regulação */}
        <section className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Análise do Processo de Regulação</h2>
            <p className="text-sm text-muted-foreground max-w-3xl">
              Aprofunde-se nos indicadores de volume, eficiência e fluxo do histórico de regulações para identificar padrões,
              gargalos e oportunidades de melhoria operacional.
            </p>
          </div>

          <IndicadoresRegulacao />
        </section>
      </div>

      <ListaPacientesPorSetorModal
        isOpen={modalPacientes.open}
        onClose={fecharModalPacientes}
        setor={modalPacientes.setor}
        grupo={modalPacientes.grupo}
        pacientes={pacientesAtivosEnriquecidos}
      />

      <IndicadorInfoModal
        isOpen={modalIndicador.open}
        onClose={fecharModalIndicador}
        indicadorId={modalIndicador.indicadorId}
      />
    </div>
  );
};

export default GestaoEstrategicaPage;
