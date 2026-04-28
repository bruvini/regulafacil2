import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Cell
} from 'recharts';
import { Info, Activity } from 'lucide-react';
import { startOfDay, endOfDay } from 'date-fns';
import {
  onSnapshot,
  query,
  where,
  orderBy,
  getHistoricoOcupacoesCollection,
  getSetoresCollection,
  getLeitosCollection,
} from '@/lib/firebase';
import IndicadorInfoModal from '@/components/modals/IndicadorInfoModal';

const parseDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === 'function') return value.toDate();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const formatMinutes = (minutes) => {
  if (!Number.isFinite(minutes) || minutes <= 0) return '—';
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const horas = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (mins === 0) return `${horas}h`;
  return `${horas}h ${mins}min`;
};

const STATUS_OPERACIONAIS = ['Vago', 'Ocupado', 'Higienização', 'Reservado', 'Regulado'];

const GiroEficienciaLeitosPanel = ({ dateRange }) => {
  const [historicoOcupacoes, setHistoricoOcupacoes] = useState(null);
  const [setores, setSetores] = useState([]);
  const [leitos, setLeitos] = useState([]);
  const [modalIndicador, setModalIndicador] = useState({ open: false, indicadorId: null });

  const dataInicioJanela = useMemo(
    () => (dateRange?.from ? startOfDay(dateRange.from) : startOfDay(new Date())),
    [dateRange?.from]
  );
  const dataFimJanela = useMemo(
    () => (dateRange?.to ? endOfDay(dateRange.to) : endOfDay(new Date())),
    [dateRange?.to]
  );

  useEffect(() => {
    const unsubOcupacoes = onSnapshot(
      query(
        getHistoricoOcupacoesCollection(),
        where('dataSaida', '>=', dataInicioJanela),
        orderBy('dataSaida', 'desc')
      ),
      (snap) => {
        setHistoricoOcupacoes(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (err) => {
        console.error('Erro ao carregar histórico de ocupações:', err);
        setHistoricoOcupacoes([]);
      }
    );

    const unsubSetores = onSnapshot(getSetoresCollection(), (snap) => {
      setSetores(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    const unsubLeitos = onSnapshot(getLeitosCollection(), (snap) => {
      setLeitos(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubOcupacoes();
      unsubSetores();
      unsubLeitos();
    };
  }, [dataInicioJanela]);

  const loading = historicoOcupacoes === null;

  const { tempoMedioSubstituicao, giroPorSetor } = useMemo(() => {
    if (!historicoOcupacoes || !leitos || !setores) {
      return { tempoMedioSubstituicao: 0, giroPorSetor: [] };
    }

    const ocupacoesValidas = historicoOcupacoes.filter(reg => {
      const dataSaida = parseDate(reg?.dataSaida);
      return dataSaida && dataSaida >= dataInicioJanela && dataSaida <= dataFimJanela;
    }).sort((a, b) => {
      const dateA = parseDate(a?.dataEntrada)?.getTime() || 0;
      const dateB = parseDate(b?.dataEntrada)?.getTime() || 0;
      return dateA - dateB;
    });

    // 1. Tempo de Substituição
    // Agrupar por leitoId e calcular diferença entre dataSaida_n e dataEntrada_{n+1}
    const historicoPorLeito = new Map();
    historicoOcupacoes.forEach(reg => {
       const leitoId = reg.leitoId;
       if (!leitoId) return;
       if (!historicoPorLeito.has(leitoId)) {
           historicoPorLeito.set(leitoId, []);
       }
       historicoPorLeito.get(leitoId).push(reg);
    });

    let somaTempoSubstituicao = 0;
    let totalSubstituicoes = 0;

    historicoPorLeito.forEach((regs) => {
      // Ordenar por dataEntrada
      regs.sort((a, b) => {
        const da = parseDate(a.dataEntrada)?.getTime() || 0;
        const db = parseDate(b.dataEntrada)?.getTime() || 0;
        return da - db;
      });

      for (let i = 0; i < regs.length - 1; i++) {
        const atual = regs[i];
        const proximo = regs[i + 1];

        const saidaAtual = parseDate(atual.dataSaida);
        const entradaProximo = parseDate(proximo.dataEntrada);

        if (saidaAtual && entradaProximo && isAfter(saidaAtual, dataInicioJanela)) {
           const diffMinutos = (entradaProximo.getTime() - saidaAtual.getTime()) / (1000 * 60);
           // Se for negativo (entrada antes da saída), ignoramos por ser provável erro de registro
           // Se for muito grande (> 7 dias), pode ser um leito inativado, também podemos ignorar ou capeá-lo, mas vamos aceitar se <= 48h
           if (diffMinutos >= 0 && diffMinutos <= (48 * 60)) {
               somaTempoSubstituicao += diffMinutos;
               totalSubstituicoes += 1;
           }
        }
      }
    });

    const tempoMedio = totalSubstituicoes > 0 ? (somaTempoSubstituicao / totalSubstituicoes) : 0;

    // 2. Giro de Leito por Setor
    // (Total de Saídas no setor) / (Leitos Operacionais do setor)
    const setoresMap = new Map(setores.map(s => [s.id, { ...s, leitosOperacionais: 0, totalSaidas: 0 }]));

    // Contar leitos operacionais (apenas status estritamente operacionais)
    leitos.forEach(leito => {
       if (
         leito.setorId &&
         setoresMap.has(leito.setorId) &&
         STATUS_OPERACIONAIS.includes(leito.status)
       ) {
           setoresMap.get(leito.setorId).leitosOperacionais += 1;
       }
    });

    ocupacoesValidas.forEach(reg => {
       const setorId = reg.setorId;
       if (setorId && setoresMap.has(setorId)) {
           setoresMap.get(setorId).totalSaidas += 1;
       }
    });

    const giro = Array.from(setoresMap.values())
      .filter(s => s.leitosOperacionais > 0 && s.totalSaidas > 0)
      .map(s => ({
        setor: s.siglaSetor || s.nomeSetor || 'Desconhecido',
        giro: Number((s.totalSaidas / s.leitosOperacionais).toFixed(2)),
        saidas: s.totalSaidas,
        operacionais: s.leitosOperacionais
      }))
      .sort((a, b) => b.giro - a.giro)
      .slice(0, 5); // Top 5

    return {
      tempoMedioSubstituicao: tempoMedio,
      giroPorSetor: giro
    };
  }, [historicoOcupacoes, leitos, setores, dataInicioJanela, dataFimJanela]);


  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Giro de Leito e Eficiência</h2>
        <p className="text-sm text-muted-foreground">
          Acompanhe o tempo de substituição (ociosidade) e a dinâmica (giro) dos leitos.
        </p>
      </div>

      {/* KPIs de eficiência */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Tempo Médio de Substituição
              </CardTitle>
              <p className="mt-2 text-3xl font-bold">
                {formatMinutes(tempoMedioSubstituicao)}
              </p>
              <p className="text-xs text-muted-foreground">Ociosidade entre altas e novas internações</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setModalIndicador({ open: true, indicadorId: 'tempoSubstituicao' })}
            >
              <Info className="h-4 w-4" />
            </Button>
          </CardHeader>
        </Card>

        {/* Mais KPIs futuros podem entrar aqui */}
      </div>

      <div className="grid gap-4">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-5 w-5 text-indigo-600" />
                Giro de Leito por Setor (Top 5)
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Setores mais dinâmicos (relação entre pacientes que saíram e leitos operacionais).
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setModalIndicador({ open: true, indicadorId: 'giroLeitosSetor' })}
            >
              <Info className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {giroPorSetor.length ? (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={giroPorSetor}
                    layout="vertical"
                    margin={{ left: 12, right: 24 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="setor" width={140} tick={{ fontSize: 11 }} />
                    <RechartsTooltip
                      formatter={(value, name, props) => [
                        `${value} pacientes/leito`,
                        'Giro de Leito'
                      ]}
                      contentStyle={{
                        background: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="giro" fill="#4f46e5" radius={[0, 4, 4, 0]}>
                       {giroPorSetor.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill="#4f46e5" />
                        ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
                Dados insuficientes para cálculo de giro no período.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <IndicadorInfoModal
        isOpen={modalIndicador.open}
        onClose={() => setModalIndicador({ open: false, indicadorId: null })}
        indicadorId={modalIndicador.indicadorId}
      />
    </div>
  );
};

export default GiroEficienciaLeitosPanel;
