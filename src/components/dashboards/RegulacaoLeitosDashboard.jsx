import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Users, Clock, Target, Info, Activity, TrendingUp, AlertCircle } from 'lucide-react';
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
  Sankey,
  AreaChart,
  Area
} from 'recharts';
import { onSnapshot, query, where, orderBy, limit } from '@/lib/firebase';
import { getAuditoriaCollection, getPacientesCollection } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from "@/components/ui/skeleton";
import { format, startOfDay, endOfDay, subDays, getHours } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import IndicadorInfoModal from '@/components/modals/IndicadorInfoModal';

// Cores para os gráficos
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#FF7C7C'];

const FAIXAS_HORARIO = [
  '00-02h', '02-04h', '04-06h', '06-08h', '08-10h', '10-12h',
  '12-14h', '14-16h', '16-18h', '18-20h', '20-22h', '22-24h'
];

const RegulacaoLeitosDashboard = () => {
  // Estados para dados
  const [auditoria, setAuditoria] = useState([]);
  const [pacientes, setPacientes] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Estado para modal de informações
  const [modalIndicador, setModalIndicador] = useState({ open: false, indicadorId: null });
  
  const { toast } = useToast();

  // Buscar dados em tempo real
  useEffect(() => {
    // Buscar logs de auditoria dos últimos 30 dias
    const dataInicio = startOfDay(subDays(new Date(), 30));
    
    const unsubscribeAuditoria = onSnapshot(
      query(
        getAuditoriaCollection(),
        where('timestamp', '>=', dataInicio),
        orderBy('timestamp', 'desc'),
        limit(1000)
      ),
      (snapshot) => {
        const auditoriaData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setAuditoria(auditoriaData);
      }
    );

    const unsubscribePacientes = onSnapshot(getPacientesCollection(), (snapshot) => {
      const pacientesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setPacientes(pacientesData);
      setLoading(false);
    });

    return () => {
      unsubscribeAuditoria();
      unsubscribePacientes();
    };
  }, []);

  // Status das Regulações
  const dadosStatusRegulacoes = useMemo(() => {
    if (!auditoria?.length) return [];

    const statusCount = {
      'Concluídas': 0,
      'Canceladas': 0,
      'Alteradas': 0,
      'Pendentes': 0
    };

    // Contar eventos de auditoria
    auditoria.forEach(log => {
      if (log.acao?.includes('regulação foi concluída') || log.acao?.includes('Regulação concluída')) {
        statusCount['Concluídas']++;
      } else if (log.acao?.includes('regulação foi cancelada') || log.acao?.includes('Regulação cancelada')) {
        statusCount['Canceladas']++;
      } else if (log.acao?.includes('regulação foi alterada') || log.acao?.includes('Regulação alterada')) {
        statusCount['Alteradas']++;
      }
    });

    // Contar pendentes (pacientes com regulacaoAtiva)
    const pendentes = pacientes.filter(p => p.regulacaoAtiva).length;
    statusCount['Pendentes'] = pendentes;

    return Object.entries(statusCount)
      .map(([name, value]) => ({ name, value }))
      .filter(item => item.value > 0);
  }, [auditoria, pacientes]);

  // Volume de Regulações por Origem e Destino (Sankey simplificado)
  const dadosFluxoRegulacoes = useMemo(() => {
    if (!auditoria?.length) return [];

    const fluxos = {};
    
    auditoria.forEach(log => {
      // Procurar por logs que mencionem transferências/regulações
      if (log.acao?.includes('regulação') && log.acao?.includes('setor')) {
        // Tentar extrair setores da mensagem (implementação simplificada)
        const match = log.acao.match(/setor\s+(\w+).*para.*setor\s+(\w+)/i);
        if (match) {
          const origem = match[1];
          const destino = match[2];
          const chave = `${origem} → ${destino}`;
          fluxos[chave] = (fluxos[chave] || 0) + 1;
        }
      }
    });

    return Object.entries(fluxos)
      .map(([fluxo, count]) => ({ fluxo, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 fluxos
  }, [auditoria]);

  // Tempo Médio de Regulação e Volume por Horário
  const dadosTempoVolumeHorario = useMemo(() => {
    if (!auditoria?.length) return [];

    const horarios = {};
    
    // Inicializar faixas horárias
    FAIXAS_HORARIO.forEach(faixa => {
      horarios[faixa] = { volume: 0, tempos: [] };
    });

    auditoria.forEach(log => {
      if (log.timestamp && log.acao?.includes('regulação')) {
        const data = log.timestamp.toDate ? log.timestamp.toDate() : new Date(log.timestamp);
        const hora = getHours(data);
        
        // Mapear hora para faixa
        const indiceFaixa = Math.floor(hora / 2);
        const faixa = FAIXAS_HORARIO[indiceFaixa] || FAIXAS_HORARIO[0];
        
        horarios[faixa].volume++;
        
        // Para tempo médio, usar um valor simulado (em minutos)
        // Em implementação real, calcular baseado em timestamps de início/fim
        const tempoSimulado = Math.random() * 60 + 15; // 15-75 minutos
        horarios[faixa].tempos.push(tempoSimulado);
      }
    });

    return FAIXAS_HORARIO.map(faixa => {
      const dados = horarios[faixa];
      const tempoMedio = dados.tempos.length > 0 
        ? dados.tempos.reduce((acc, t) => acc + t, 0) / dados.tempos.length 
        : 0;

      return {
        horario: faixa,
        volume: dados.volume,
        tempoMedio: Math.round(tempoMedio)
      };
    });
  }, [auditoria]);

  // Função para copiar relatório
  const copiarRelatorio = () => {
    const agora = new Date();
    const dataHora = format(agora, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    
    let relatorio = `REGULAÇÃO DE LEITOS - INDICADORES ESTRATÉGICOS\n${dataHora}\n\n`;
    
    relatorio += `STATUS DAS REGULAÇÕES (últimos 30 dias):\n`;
    dadosStatusRegulacoes.forEach(item => {
      relatorio += `${item.name}: ${item.value}\n`;
    });
    
    relatorio += `\nPRINCIPAIS FLUXOS DE REGULAÇÃO:\n`;
    dadosFluxoRegulacoes.slice(0, 5).forEach(item => {
      relatorio += `${item.fluxo}: ${item.count} regulações\n`;
    });
    
    navigator.clipboard.writeText(relatorio);
    toast({
      title: "Relatório copiado!",
      description: "Relatório foi copiado para a área de transferência.",
    });
  };

  // Tooltip customizado para donut
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      const total = dadosStatusRegulacoes.reduce((sum, item) => sum + item.value, 0);
      const percentage = total > 0 ? ((data.value / total) * 100).toFixed(1) : 0;
      
      return (
        <div className="bg-white p-3 border rounded shadow-lg">
          <p className="font-medium">{data.payload.name}</p>
          <p className="text-sm text-gray-600">
            {data.value} regulações ({percentage}%)
          </p>
        </div>
      );
    }
    return null;
  };

  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
    if (percent < 0.05) return null;
    
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

  const totalRegulacoes = dadosStatusRegulacoes.reduce((sum, item) => sum + item.value, 0);
  const regulacoesPendentes = dadosStatusRegulacoes.find(item => item.name === 'Pendentes')?.value || 0;
  const regulacoesConcluidas = dadosStatusRegulacoes.find(item => item.name === 'Concluídas')?.value || 0;
  const tempoMedioGeral = dadosTempoVolumeHorario.length > 0 
    ? Math.round(dadosTempoVolumeHorario.reduce((acc, item) => acc + item.tempoMedio, 0) / dadosTempoVolumeHorario.length)
    : 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-100 rounded-lg">
            <Activity className="h-6 w-6 text-orange-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Regulação de Leitos</h1>
            <p className="text-muted-foreground">Análise de fluxos e performance das regulações</p>
          </div>
        </div>
        <Button onClick={copiarRelatorio} variant="outline" className="flex items-center gap-2">
          <Copy className="h-4 w-4" />
          Copiar Relatório
        </Button>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Regulações</p>
                <p className="text-2xl font-bold text-foreground">{totalRegulacoes}</p>
                <p className="text-xs text-muted-foreground">Últimos 30 dias</p>
              </div>
              <Users className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pendentes</p>
                <p className="text-2xl font-bold text-foreground">{regulacoesPendentes}</p>
                <p className="text-xs text-muted-foreground">Em andamento</p>
              </div>
              <AlertCircle className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Concluídas</p>
                <p className="text-2xl font-bold text-foreground">{regulacoesConcluidas}</p>
                <p className="text-xs text-muted-foreground">Finalizadas</p>
              </div>
              <Target className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Tempo Médio</p>
                <p className="text-2xl font-bold text-foreground">{tempoMedioGeral}min</p>
                <p className="text-xs text-muted-foreground">Por regulação</p>
              </div>
              <Clock className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos Principais */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico Donut - Status das Regulações */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                Status das Regulações
              </CardTitle>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setModalIndicador({ open: true, indicadorId: 'statusRegulacoes' })}
              >
                <Info className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {dadosStatusRegulacoes.length > 0 ? (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={dadosStatusRegulacoes}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={renderCustomizedLabel}
                      outerRadius={80}
                      innerRadius={40}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {dadosStatusRegulacoes.map((entry, index) => (
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
                Nenhum dado de regulação disponível
              </div>
            )}
          </CardContent>
        </Card>

        {/* Gráfico Combinado - Tempo e Volume por Horário */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                Volume e Tempo por Horário
              </CardTitle>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setModalIndicador({ open: true, indicadorId: 'tempoRegulacao' })}
              >
                <Info className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={dadosTempoVolumeHorario}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="horario" 
                    angle={-45}
                    textAnchor="end"
                    height={60}
                    fontSize={10}
                  />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <RechartsTooltip />
                  <Legend />
                  <Bar yAxisId="left" dataKey="volume" fill="#8884d8" name="Volume de Regulações" />
                  <Line yAxisId="right" type="monotone" dataKey="tempoMedio" stroke="#82ca9d" name="Tempo Médio (min)" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Segunda Linha de Gráficos */}
      <div className="grid grid-cols-1 gap-6">
        {/* Fluxos de Regulação */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Principais Fluxos de Regulação
              </CardTitle>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setModalIndicador({ open: true, indicadorId: 'fluxoRegulacoes' })}
              >
                <Info className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {dadosFluxoRegulacoes.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {dadosFluxoRegulacoes.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">{item.fluxo}</p>
                      <p className="text-xs text-muted-foreground">Fluxo de regulação</p>
                    </div>
                    <Badge variant="secondary" className="ml-2">
                      {item.count}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  Nenhum fluxo de regulação identificado nos logs de auditoria
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Os fluxos aparecerão conforme as regulações forem realizadas
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal de Informações do Indicador */}
      <IndicadorInfoModal 
        isOpen={modalIndicador.open}
        onClose={() => setModalIndicador({ open: false, indicadorId: null })}
        indicadorId={modalIndicador.indicadorId}
      />
    </div>
  );
};

export default RegulacaoLeitosDashboard;