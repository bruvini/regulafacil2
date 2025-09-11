import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, TrendingUp, Users, Activity } from 'lucide-react';
import { toast } from 'sonner';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip as RechartsTooltip
} from 'recharts';
import { getPacientesCollection, onSnapshot } from '@/lib/firebase';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Mapeamento de especialidades para agrupamento
const mapeamentoEspecialidades = {
  'INTENSIVISTA': 'CLINICA GERAL',
  'RESIDENTE': 'CLINICA GERAL',
  'BUCOMAXILO': 'ODONTOLOGIA C.TRAUM.B.M.F.'
};

// Cores para o gráfico de pizza
const COLORS = [
  '#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', 
  '#82CA9D', '#FFC658', '#FF7C7C', '#8DD1E1', '#D084D0',
  '#87CEEB', '#DDA0DD', '#98FB98', '#F0E68C', '#FFB6C1'
];

const MapaLeitosDashboard = () => {
  const [pacientes, setPacientes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Buscar dados dos pacientes
  useEffect(() => {
    const unsubscribe = onSnapshot(getPacientesCollection(), (snapshot) => {
      const pacientesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setPacientes(pacientesData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Processar dados para o gráfico
  const dadosGrafico = useMemo(() => {
    if (!pacientes.length) return [];

    // Contar especialidades com mapeamento
    const contagemEspecialidades = {};

    pacientes.forEach(paciente => {
      if (paciente.especialidade) {
        // Aplicar mapeamento se existir
        const especialidadeFinal = mapeamentoEspecialidades[paciente.especialidade] || paciente.especialidade;
        
        contagemEspecialidades[especialidadeFinal] = (contagemEspecialidades[especialidadeFinal] || 0) + 1;
      }
    });

    // Converter para array e ordenar por valor decrescente
    const dadosArray = Object.entries(contagemEspecialidades).map(([name, value]) => ({
      name,
      value
    }));

    return dadosArray.sort((a, b) => b.value - a.value);
  }, [pacientes]);

  // Função para copiar relatório
  const copiarRelatorio = async () => {
    const dataHoraAtual = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    
    let relatorio = `INTERNAÇÕES POR ESPECIALIDADE\n${dataHoraAtual}\n\n`;
    
    dadosGrafico.forEach(item => {
      relatorio += `${item.name}: ${item.value}\n`;
    });

    try {
      await navigator.clipboard.writeText(relatorio);
      toast.success('Relatório copiado para a área de transferência!');
    } catch (err) {
      toast.error('Erro ao copiar relatório');
      console.error('Erro ao copiar:', err);
    }
  };

  // Tooltip customizado
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      const total = dadosGrafico.reduce((sum, item) => sum + item.value, 0);
      const porcentagem = total > 0 ? ((data.value / total) * 100).toFixed(1) : 0;
      
      return (
        <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium text-foreground">{data.payload.name}</p>
          <p className="text-sm text-muted-foreground">
            Internações: <span className="font-medium text-foreground">{data.value}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            Porcentagem: <span className="font-medium text-foreground">{porcentagem}%</span>
          </p>
        </div>
      );
    }
    return null;
  };

  // Label customizado para as fatias
  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
    if (percent < 0.05) return null; // Não mostrar label para fatias menores que 5%
    
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
        className="text-xs font-medium"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  const totalInternacoes = dadosGrafico.reduce((sum, item) => sum + item.value, 0);
  const especialidadesUnicas = dadosGrafico.length;

  if (loading) {
    return (
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="xl:col-span-2">
          <CardContent className="p-8 text-center">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-muted-foreground">Carregando dados...</p>
          </CardContent>
        </Card>
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse">
                  <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                  <div className="h-8 bg-muted rounded w-1/2"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com estatísticas gerais */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total de Internações</p>
                <p className="text-3xl font-bold text-foreground">{totalInternacoes}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Especialidades Ativas</p>
                <p className="text-3xl font-bold text-foreground">{especialidadesUnicas}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <Activity className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Especialidade Principal</p>
                <p className="text-lg font-bold text-foreground">
                  {dadosGrafico.length > 0 ? dadosGrafico[0].name : 'N/A'}
                </p>
                <Badge variant="secondary" className="mt-1">
                  {dadosGrafico.length > 0 ? `${dadosGrafico[0].value} internações` : '0 internações'}
                </Badge>
              </div>
              <div className="p-3 bg-purple-100 rounded-full">
                <TrendingUp className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico principal e listagem */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Gráfico de Pizza */}
        <Card className="xl:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-bold">Distribuição por Especialidade</CardTitle>
              <Button 
                variant="outline" 
                size="sm"
                onClick={copiarRelatorio}
                className="gap-2"
              >
                <Copy className="h-4 w-4" />
                Copiar Relatório
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-96">
              {dadosGrafico.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={dadosGrafico}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={renderCustomizedLabel}
                      outerRadius={120}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {dadosGrafico.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={COLORS[index % COLORS.length]} 
                        />
                      ))}
                    </Pie>
                    <RechartsTooltip content={<CustomTooltip />} />
                    <Legend 
                      verticalAlign="bottom" 
                      height={36}
                      formatter={(value, entry) => (
                        <span className="text-sm text-foreground">{value}</span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">Nenhuma internação encontrada</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Ranking das especialidades */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Ranking de Especialidades</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {dadosGrafico.map((item, index) => {
                const porcentagem = totalInternacoes > 0 ? ((item.value / totalInternacoes) * 100).toFixed(1) : 0;
                
                return (
                  <div key={item.name} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <div>
                        <p className="font-medium text-sm text-foreground">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{porcentagem}% do total</p>
                      </div>
                    </div>
                    <Badge variant="secondary">
                      {item.value}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MapaLeitosDashboard;