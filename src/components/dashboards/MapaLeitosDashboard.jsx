import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "@/components/ui/tooltip";
import {
  Copy,
  Users,
  Info,
  Activity,
  Calendar,
  Clock,
  BedDouble,
  Bed,
  ShieldAlert,
  Broom,
  Lock
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip as RechartsTooltip, 
  Legend,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  BarChart
} from 'recharts';
import { onSnapshot } from '@/lib/firebase';
import {
  getPacientesCollection,
  getHistoricoOcupacoesCollection,
  getLeitosCollection,
  getSetoresCollection,
  getQuartosCollection
} from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from "@/components/ui/skeleton";
import { format, getDay, getHours, startOfYear, endOfYear, eachMonthOfInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { calcularPermanenciaAtual, calcularPermanenciaEmDias } from '@/lib/historicoOcupacoes';
import IndicadorInfoModal from '@/components/modals/IndicadorInfoModal';

// Mapeamento de especialidades para agregação
const mapeamentoEspecialidades = {
  'INTENSIVISTA': 'CLINICA GERAL',
  'RESIDENTE': 'CLINICA GERAL',
  'BUCOMAXILO': 'ODONTOLOGIA C.TRAUM.B.M.F.'
};

// Cores para os gráficos
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#FF7C7C'];

const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const FAIXAS_HORARIO = ['0-6h', '6-12h', '12-18h', '18-24h'];

const MapaLeitosDashboard = () => {
  // Estados para dados
  const [pacientes, setPacientes] = useState([]);
  const [historicoOcupacoes, setHistoricoOcupacoes] = useState([]);
  const [leitos, setLeitos] = useState([]);
  const [setores, setSetores] = useState([]);
  const [quartos, setQuartos] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Estado para modal de informações
  const [modalIndicador, setModalIndicador] = useState({ open: false, indicadorId: null });
  
  const { toast } = useToast();

  // Buscar dados em tempo real
  useEffect(() => {
    const unsubscribePacientes = onSnapshot(getPacientesCollection(), (snapshot) => {
      const pacientesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setPacientes(pacientesData);
    });

    const unsubscribeHistorico = onSnapshot(getHistoricoOcupacoesCollection(), (snapshot) => {
      const historicoData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setHistoricoOcupacoes(historicoData);
    });

    const unsubscribeLeitos = onSnapshot(getLeitosCollection(), (snapshot) => {
      const leitosData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setLeitos(leitosData);
    });

    const unsubscribeQuartos = onSnapshot(getQuartosCollection(), (snapshot) => {
      const quartosData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setQuartos(quartosData);
    });

    const unsubscribeSetores = onSnapshot(getSetoresCollection(), (snapshot) => {
      const setoresData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setSetores(setoresData);
      setLoading(false);
    });

    return () => {
      unsubscribePacientes();
      unsubscribeHistorico();
      unsubscribeLeitos();
      unsubscribeQuartos();
      unsubscribeSetores();
    };
  }, []);

  // Dados processados para o gráfico de pizza (especialidades)
  const dadosEspecialidades = useMemo(() => {
    if (!pacientes?.length) return [];

    const contagem = {};

    pacientes.forEach(paciente => {
      if (paciente.especialidade) {
        const especialidadeFinal = mapeamentoEspecialidades[paciente.especialidade] || paciente.especialidade;
        contagem[especialidadeFinal] = (contagem[especialidadeFinal] || 0) + 1;
      }
    });

    return Object.entries(contagem)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [pacientes]);

  const indicadoresPrincipais = useMemo(() => {
    const normalizarTexto = (valor) => {
      if (!valor) return '';
      return String(valor)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
    };

    const pacientesAtivos = (pacientes || []).filter(paciente => {
      const status = normalizarTexto(paciente.statusInternacao || paciente.status || '');
      if (['alta', 'transferido', 'transferencia', 'encerrada', 'encerrado', 'obito', 'óbito'].includes(status)) {
        return false;
      }
      if (paciente.dataAlta || paciente.dataSaida) {
        return false;
      }
      return true;
    });

    const pacientesComDataInternacao = pacientesAtivos.filter(paciente => paciente.dataInternacao);
    const permanencias = pacientesComDataInternacao
      .map(paciente => calcularPermanenciaAtual(paciente.dataInternacao))
      .filter(valor => Number.isFinite(valor));

    const tempoMedioBase = permanencias.length > 0
      ? permanencias.reduce((acc, dias) => acc + dias, 0) / permanencias.length
      : null;

    if (!setores.length || !leitos.length) {
      return {
        taxaOcupacao: 0,
        ocupadosAssistenciais: 0,
        totalAssistenciais: 0,
        pacientesAtivos: pacientesAtivos.length,
        tempoMedioPermanencia: tempoMedioBase,
        statusPCP: {
          label: 'Rotina Diária',
          toneClass: 'text-sky-600',
          badgeClass: 'bg-sky-100 text-sky-700',
          ocupados: 0
        },
        vagosRegulaveis: 0,
        vagosCoorte: 0,
        higienizacaoTotal: 0,
        bloqueadosTotal: 0
      };
    }

    const setoresPorId = new Map(setores.map(setor => [setor.id, setor]));
    const setoresAssistenciais = new Set(['enfermaria', 'uti', 'emergencia']);
    const setoresRegulaveis = new Set(['enfermaria', 'uti']);
    const setoresHigienizacao = new Set(['centro cirurgico', 'emergencia', 'enfermaria', 'uti']);

    const pacientesPorLeito = new Map(
      pacientesAtivos
        .filter(paciente => paciente.leitoId)
        .map(paciente => [paciente.leitoId, paciente])
    );

    const leitosPorSetor = new Map();
    leitos.forEach(leito => {
      if (!leito.setorId) return;
      if (!leitosPorSetor.has(leito.setorId)) {
        leitosPorSetor.set(leito.setorId, []);
      }
      leitosPorSetor.get(leito.setorId).push(leito);
    });

    const quartosPorSetor = new Map();
    (quartos || []).forEach(quarto => {
      if (!quarto.setorId) return;
      if (!quartosPorSetor.has(quarto.setorId)) {
        quartosPorSetor.set(quarto.setorId, []);
      }
      quartosPorSetor.get(quarto.setorId).push(quarto);
    });

    const leitosComCoorte = new Set();

    setores.forEach(setor => {
      const tipoNorm = normalizarTexto(setor.tipoSetor);
      if (!['enfermaria', 'uti'].includes(tipoNorm)) {
        return;
      }

      const leitosDoSetor = leitosPorSetor.get(setor.id) || [];
      if (!leitosDoSetor.length) return;

      let grupos = [];

      if (tipoNorm === 'enfermaria') {
        const gruposMap = {};
        leitosDoSetor.forEach(leito => {
          const codigo = String(leito.codigoLeito || '').trim();
          const chave = (codigo.substring(0, 3) || '').toUpperCase();
          if (!gruposMap[chave]) {
            gruposMap[chave] = [];
          }
          gruposMap[chave].push(leito);
        });
        grupos = Object.values(gruposMap);
      } else {
        const quartosSetor = quartosPorSetor.get(setor.id) || [];
        if (quartosSetor.length > 0) {
          grupos = quartosSetor
            .map(quarto => {
              const ids = Array.isArray(quarto.leitosIds) ? quarto.leitosIds : [];
              return ids
                .map(id => leitosDoSetor.find(leito => leito.id === id))
                .filter(Boolean);
            })
            .filter(grupo => grupo.length > 0);
        }

        if (!grupos.length) {
          grupos = leitosDoSetor.map(leito => [leito]);
        }
      }

      grupos.forEach(grupo => {
        const ocupantes = grupo
          .map(leito => pacientesPorLeito.get(leito.id))
          .filter(Boolean);

        if (!ocupantes.length) return;

        grupo.forEach(leito => {
          const status = normalizarTexto(leito.status || leito.statusLeito);
          if (!pacientesPorLeito.get(leito.id) && (status === 'vago' || status === 'higienizacao')) {
            leitosComCoorte.add(leito.id);
          }
        });
      });
    });

    let totalAssistenciais = 0;
    let ocupadosAssistenciais = 0;
    let vagosRegulaveis = 0;
    let vagosCoorte = 0;
    let higienizacaoTotal = 0;
    let bloqueadosTotal = 0;

    leitos.forEach(leito => {
      const setor = setoresPorId.get(leito.setorId);
      const tipoNorm = normalizarTexto(setor?.tipoSetor);
      const status = normalizarTexto(leito.status || leito.statusLeito);
      const statusAssistencialAtivo = status === 'ocupado' || status === 'vago' || status === 'higienizacao';

      if (setoresAssistenciais.has(tipoNorm) && statusAssistencialAtivo) {
        totalAssistenciais += 1;
        if (status === 'ocupado') {
          ocupadosAssistenciais += 1;
        }
      }

      if (setoresRegulaveis.has(tipoNorm) && (status === 'vago' || status === 'higienizacao')) {
        const hasCoorte = leitosComCoorte.has(leito.id);
        if (!hasCoorte) {
          vagosRegulaveis += 1;
        }
        if (tipoNorm === 'enfermaria' && hasCoorte) {
          vagosCoorte += 1;
        }
      }

      if (setoresHigienizacao.has(tipoNorm)) {
        if (status === 'higienizacao') {
          higienizacaoTotal += 1;
        }
        if (status === 'bloqueado') {
          bloqueadosTotal += 1;
        }
      }
    });

    const setoresPCPIds = setores
      .filter(setor => {
        const nomeNorm = normalizarTexto(setor.nomeSetor || setor.nome);
        return nomeNorm === 'ps decisao cirurgica' || nomeNorm === 'ps decisao clinica';
      })
      .map(setor => setor.id);

    const setoresPCPSet = new Set(setoresPCPIds);
    const totalPcpOcupado = leitos.filter(leito => {
      return setoresPCPSet.has(leito.setorId) && normalizarTexto(leito.status || leito.statusLeito) === 'ocupado';
    }).length;

    let statusPCP = {
      label: 'Rotina Diária',
      toneClass: 'text-sky-600',
      badgeClass: 'bg-sky-100 text-sky-700',
      ocupados: totalPcpOcupado
    };

    if (totalPcpOcupado >= 23 && totalPcpOcupado <= 28) {
      statusPCP = {
        label: 'Nível 1',
        toneClass: 'text-green-600',
        badgeClass: 'bg-green-100 text-green-700',
        ocupados: totalPcpOcupado
      };
    } else if (totalPcpOcupado >= 29 && totalPcpOcupado <= 32) {
      statusPCP = {
        label: 'Nível 2',
        toneClass: 'text-yellow-600',
        badgeClass: 'bg-yellow-100 text-yellow-700',
        ocupados: totalPcpOcupado
      };
    } else if (totalPcpOcupado > 32) {
      statusPCP = {
        label: 'Nível 3',
        toneClass: 'text-red-600',
        badgeClass: 'bg-red-100 text-red-700',
        ocupados: totalPcpOcupado
      };
    }

    return {
      taxaOcupacao: totalAssistenciais > 0 ? (ocupadosAssistenciais / totalAssistenciais) * 100 : 0,
      ocupadosAssistenciais,
      totalAssistenciais,
      pacientesAtivos: pacientesAtivos.length,
      tempoMedioPermanencia: tempoMedioBase,
      statusPCP,
      vagosRegulaveis,
      vagosCoorte,
      higienizacaoTotal,
      bloqueadosTotal
    };
  }, [leitos, setores, pacientes, quartos]);

  // Dados para Média de Permanência e Giro de Leitos por Mês
  const dadosGiroPermanencia = useMemo(() => {
    if (!historicoOcupacoes?.length || !leitos?.length) return [];

    const anoAtual = new Date().getFullYear();
    const meses = eachMonthOfInterval({
      start: startOfYear(new Date(anoAtual, 0)),
      end: endOfYear(new Date(anoAtual, 0))
    });

    return meses.map(mes => {
      const mesNome = format(mes, 'MMM', { locale: ptBR });
      
      // Histórico do mês
      const historicoMes = historicoOcupacoes.filter(ocupacao => {
        if (!ocupacao.dataSaida) return false;
        const dataSaida = ocupacao.dataSaida.toDate ? ocupacao.dataSaida.toDate() : new Date(ocupacao.dataSaida);
        return dataSaida.getMonth() === mes.getMonth() && dataSaida.getFullYear() === anoAtual;
      });

      // Média de permanência
      const mediaPermanencia = historicoMes.length > 0
        ? historicoMes.reduce((acc, ocupacao) => {
            const permanencia = calcularPermanenciaEmDias(ocupacao.dataEntrada, ocupacao.dataSaida);
            return acc + permanencia;
          }, 0) / historicoMes.length
        : 0;

      // Giro de leitos (aproximado)
      const totalLeitos = leitos.filter(l => l.status !== 'BLOQUEADO').length || 1;
      const giroLeitos = historicoMes.length / totalLeitos;

      return {
        mes: mesNome,
        mediaPermanencia: Math.round(mediaPermanencia * 10) / 10,
        giroLeitos: Math.round(giroLeitos * 100) / 100
      };
    });
  }, [historicoOcupacoes, leitos]);

  // Taxa de Ocupação por Tipo de Setor
  const dadosTaxaOcupacao = useMemo(() => {
    if (!leitos?.length || !setores?.length) return [];

    const tiposSetor = ['Enfermaria', 'UTI', 'Emergência'];
    
    return tiposSetor.map(tipo => {
      const setoresTipo = setores.filter(s => s.tipoSetor === tipo);
      const leitosTipo = leitos.filter(l => 
        setoresTipo.some(s => s.id === l.setorId)
      );

      const totalLeitos = leitosTipo.length;
      const leitosDisponiveis = leitosTipo.filter(l => l.status !== 'BLOQUEADO').length;
      const leitosOcupados = leitosTipo.filter(l => 
        l.status === 'OCUPADO' || l.status === 'REGULADO' || l.status === 'RESERVADO'
      ).length;

      const taxaOcupacao = leitosDisponiveis > 0 
        ? Math.round((leitosOcupados / leitosDisponiveis) * 100)
        : 0;

      return {
        tipo,
        taxaOcupacao,
        ocupados: leitosOcupados,
        disponiveis: leitosDisponiveis,
        total: totalLeitos
      };
    });
  }, [leitos, setores]);

  // Dados para Heatmap de Internações por Horário
  const dadosHeatmap = useMemo(() => {
    const todasInternacoes = [
      ...pacientes.map(p => p.dataInternacao).filter(Boolean),
      ...historicoOcupacoes.map(h => h.dataEntrada).filter(Boolean)
    ];

    const matriz = {};
    
    DIAS_SEMANA.forEach(dia => {
      matriz[dia] = {};
      FAIXAS_HORARIO.forEach(faixa => {
        matriz[dia][faixa] = 0;
      });
    });

    todasInternacoes.forEach(data => {
      const dataObj = data.toDate ? data.toDate() : new Date(data);
      const diaSemana = DIAS_SEMANA[getDay(dataObj)];
      const hora = getHours(dataObj);
      
      let faixaHorario;
      if (hora >= 0 && hora < 6) faixaHorario = '0-6h';
      else if (hora >= 6 && hora < 12) faixaHorario = '6-12h';
      else if (hora >= 12 && hora < 18) faixaHorario = '12-18h';
      else faixaHorario = '18-24h';

      matriz[diaSemana][faixaHorario]++;
    });

    return matriz;
  }, [pacientes, historicoOcupacoes]);

  // Permanência por Especialidade (Pacientes Atuais)
  const dadosPermanenciaEspecialidade = useMemo(() => {
    if (!pacientes?.length) return [];

    const grupos = {};
    
    pacientes.forEach(paciente => {
      if (paciente.especialidade && paciente.dataInternacao) {
        const especialidadeFinal = mapeamentoEspecialidades[paciente.especialidade] || paciente.especialidade;
        
        if (!grupos[especialidadeFinal]) {
          grupos[especialidadeFinal] = { total: 0, count: 0 };
        }
        
        const permanencia = calcularPermanenciaAtual(paciente.dataInternacao);
        grupos[especialidadeFinal].total += permanencia;
        grupos[especialidadeFinal].count++;
      }
    });

    return Object.entries(grupos)
      .map(([especialidade, dados]) => ({
        especialidade,
        mediaPermanencia: Math.round((dados.total / dados.count) * 10) / 10,
        pacientes: dados.count
      }))
      .sort((a, b) => b.mediaPermanencia - a.mediaPermanencia)
      .slice(0, 8); // Top 8
  }, [pacientes]);

  // Função para copiar relatório
  const copiarRelatorio = () => {
    const agora = new Date();
    const dataHora = format(agora, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    
    let relatorio = `MAPA DE LEITOS - INDICADORES ESTRATÉGICOS\n${dataHora}\n\n`;
    
    relatorio += `INTERNAÇÕES POR ESPECIALIDADE:\n`;
    dadosEspecialidades.forEach(item => {
      relatorio += `${item.name}: ${item.value}\n`;
    });
    
    relatorio += `\nTAXA DE OCUPAÇÃO POR SETOR:\n`;
    dadosTaxaOcupacao.forEach(item => {
      relatorio += `${item.tipo}: ${item.taxaOcupacao}% (${item.ocupados}/${item.disponiveis})\n`;
    });
    
    navigator.clipboard.writeText(relatorio);
    toast({
      title: "Relatório copiado!",
      description: "Relatório foi copiado para a área de transferência.",
    });
  };

  // Tooltip customizado para pizza
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      const total = dadosEspecialidades.reduce((sum, item) => sum + item.value, 0);
      const percentage = ((data.value / total) * 100).toFixed(1);
      
      return (
        <div className="bg-white p-3 border rounded shadow-lg">
          <p className="font-medium">{data.payload.name}</p>
          <p className="text-sm text-gray-600">
            {data.value} pacientes ({percentage}%)
          </p>
        </div>
      );
    }
    return null;
  };

  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
    if (percent < 0.05) return null; // Não mostrar labels muito pequenos
    
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text 
        x={x} 
        y={y} 
        fill="white" 
        textAnchor={x > cx ? 'start' : 'end'} 
        dominantBaseline="central"
        fontSize="12"
        fontWeight="bold"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  const {
    taxaOcupacao,
    ocupadosAssistenciais,
    totalAssistenciais,
    pacientesAtivos,
    tempoMedioPermanencia,
    statusPCP,
    vagosRegulaveis,
    vagosCoorte,
    higienizacaoTotal,
    bloqueadosTotal
  } = indicadoresPrincipais;

  const taxaOcupacaoFormatada = Number.isFinite(taxaOcupacao) ? Math.max(0, Math.min(100, taxaOcupacao)) : 0;
  const tempoMedioTexto = tempoMedioPermanencia != null
    ? `${tempoMedioPermanencia.toFixed(1)} dia${tempoMedioPermanencia.toFixed(1) === '1.0' ? '' : 's'}`
    : 'N/A';

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Activity className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Mapa de Leitos</h1>
            <p className="text-muted-foreground">Indicadores estratégicos de ocupação e permanência</p>
          </div>
        </div>
        <Button onClick={copiarRelatorio} variant="outline" className="flex items-center gap-2">
          <Copy className="h-4 w-4" />
          Copiar Relatório
        </Button>
      </div>

      {/* Indicadores principais */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Taxa de Ocupação Geral</CardTitle>
            <p className="text-sm text-muted-foreground">Enfermaria, UTI e Emergência</p>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-3xl font-bold text-foreground">{taxaOcupacaoFormatada.toFixed(1)}%</p>
                <p className="text-sm text-muted-foreground">
                  {ocupadosAssistenciais}/{totalAssistenciais} leitos ocupados
                </p>
              </div>
            </div>
            <Progress value={taxaOcupacaoFormatada} className="mt-4" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Status PCP</CardTitle>
            <p className="text-sm text-muted-foreground">PS Decisão Clínica e Cirúrgica</p>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className={`text-2xl font-bold ${statusPCP.toneClass}`}>{statusPCP.label}</p>
                <p className="text-sm text-muted-foreground">{statusPCP.ocupados} leitos ocupados</p>
              </div>
              <div className={`rounded-full px-3 py-1 text-sm font-semibold ${statusPCP.badgeClass}`}>
                PCP
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <TooltipProvider>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <Card className="cursor-help">
                <CardContent className="p-5 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">Pacientes</p>
                    <Users className="h-5 w-5 text-blue-600" />
                  </div>
                  <p className="text-2xl font-bold text-foreground">{pacientesAtivos}</p>
                  <p className="text-xs text-muted-foreground">Tempo médio: {tempoMedioTexto}</p>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-sm">
              Número total de pacientes internados. O tempo médio é calculado desde a admissão até o momento atual.
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Card className="cursor-help">
                <CardContent className="p-5 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">Ocupados</p>
                    <BedDouble className="h-5 w-5 text-amber-500" />
                  </div>
                  <p className="text-2xl font-bold text-foreground">{ocupadosAssistenciais}</p>
                  <p className="text-xs text-muted-foreground">Emergência, Enfermaria e UTI</p>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-sm">
              Total de leitos ocupados nos setores assistenciais de Emergência, Enfermaria e UTI.
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Card className="cursor-help">
                <CardContent className="p-5 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">Vagos (Reguláveis)</p>
                    <Bed className="h-5 w-5 text-emerald-500" />
                  </div>
                  <p className="text-2xl font-bold text-foreground">{vagosRegulaveis}</p>
                  <p className="text-xs text-muted-foreground">Sem coorte ativa</p>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-sm">
              Leitos vagos ou em higienização em Enfermarias e UTIs que não possuem restrição de coorte, aptos para regulação geral.
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Card className="cursor-help">
                <CardContent className="p-5 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">Vagos (Coorte)</p>
                    <ShieldAlert className="h-5 w-5 text-blue-600" />
                  </div>
                  <p className="text-2xl font-bold text-foreground">{vagosCoorte}</p>
                  <p className="text-xs text-muted-foreground">Quartos com restrição</p>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-sm">
              Leitos vagos ou em higienização em Enfermarias que estão em quartos já ocupados, indicando restrição para alocação (coorte de sexo e/ou isolamento).
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Card className="cursor-help">
                <CardContent className="p-5 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">Higienização</p>
                    <Broom className="h-5 w-5 text-purple-500" />
                  </div>
                  <p className="text-2xl font-bold text-foreground">{higienizacaoTotal}</p>
                  <p className="text-xs text-muted-foreground">CC, Emergência, Enfermaria e UTI</p>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-sm">
              Total de leitos em processo de higienização nos setores de Centro Cirúrgico, Emergência, Enfermaria e UTI.
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Card className="cursor-help">
                <CardContent className="p-5 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">Bloqueados</p>
                    <Lock className="h-5 w-5 text-rose-500" />
                  </div>
                  <p className="text-2xl font-bold text-foreground">{bloqueadosTotal}</p>
                  <p className="text-xs text-muted-foreground">Setores assistenciais principais</p>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-sm">
              Total de leitos bloqueados por manutenção ou outra razão administrativa nos principais setores.
            </TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>

      {/* Gráficos Principais */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico de Pizza - Especialidades */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                Distribuição por Especialidade
              </CardTitle>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setModalIndicador({ open: true, indicadorId: 'distribuicaoEspecialidades' })}
              >
                <Info className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {dadosEspecialidades.length > 0 ? (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={dadosEspecialidades}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={renderCustomizedLabel}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {dadosEspecialidades.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip content={<CustomTooltip />} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-80 flex items-center justify-center text-muted-foreground">
                Nenhum dado disponível
              </div>
            )}
          </CardContent>
        </Card>

        {/* Gráfico Combinado - Permanência e Giro */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                Permanência e Giro por Mês
              </CardTitle>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setModalIndicador({ open: true, indicadorId: 'mediaPermanencia' })}
              >
                <Info className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={dadosGiroPermanencia}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mes" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <RechartsTooltip />
                  <Legend />
                  <Bar yAxisId="left" dataKey="mediaPermanencia" fill="#8884d8" name="Média Permanência (dias)" />
                  <Line yAxisId="right" type="monotone" dataKey="giroLeitos" stroke="#82ca9d" name="Giro de Leitos" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Segunda Linha de Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Taxa de Ocupação por Setor */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle>Taxa de Ocupação por Tipo de Setor</CardTitle>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setModalIndicador({ open: true, indicadorId: 'taxaOcupacao' })}
              >
                <Info className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dadosTaxaOcupacao}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="tipo" />
                  <YAxis />
                  <RechartsTooltip 
                    formatter={(value, name) => [`${value}%`, 'Taxa de Ocupação']}
                    labelFormatter={(label) => `Setor: ${label}`}
                  />
                  <Bar dataKey="taxaOcupacao" fill="#ffc658" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Permanência por Especialidade */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle>Permanência Atual por Especialidade</CardTitle>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setModalIndicador({ open: true, indicadorId: 'permanenciaAtualEspecialidade' })}
              >
                <Info className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {dadosPermanenciaEspecialidade.map((item, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <span className="text-sm font-medium truncate flex-1">{item.especialidade}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{item.pacientes} pac.</Badge>
                    <Badge variant="secondary">{item.mediaPermanencia} dias</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Heatmap de Internações */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Padrão de Internações por Dia e Horário
            </CardTitle>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setModalIndicador({ open: true, indicadorId: 'internacoesHorario' })}
            >
              <Info className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <div className="grid grid-cols-8 gap-2 min-w-[600px]">
              <div></div> {/* Espaço vazio para header */}
              {DIAS_SEMANA.map(dia => (
                <div key={dia} className="text-center text-xs font-medium p-2 bg-muted rounded">
                  {dia}
                </div>
              ))}
              
              {FAIXAS_HORARIO.map(faixa => (
                <React.Fragment key={faixa}>
                  <div className="text-xs font-medium p-2 bg-muted rounded flex items-center">
                    <Clock className="h-3 w-3 mr-1" />
                    {faixa}
                  </div>
                  {DIAS_SEMANA.map(dia => {
                    const valor = dadosHeatmap[dia]?.[faixa] || 0;
                    const maxValor = Math.max(...DIAS_SEMANA.flatMap(d => 
                      FAIXAS_HORARIO.map(f => dadosHeatmap[d]?.[f] || 0)
                    ));
                    const intensidade = maxValor > 0 ? valor / maxValor : 0;
                    
                    return (
                      <div 
                        key={`${dia}-${faixa}`} 
                        className="p-2 rounded text-center text-xs font-medium"
                        style={{
                          backgroundColor: `hsl(210, 100%, ${100 - (intensidade * 30)}%)`,
                          color: intensidade > 0.5 ? 'white' : 'black'
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

      {/* Modal de Informações do Indicador */}
      <IndicadorInfoModal 
        isOpen={modalIndicador.open}
        onClose={() => setModalIndicador({ open: false, indicadorId: null })}
        indicadorId={modalIndicador.indicadorId}
      />
    </div>
  );
};

export default MapaLeitosDashboard;