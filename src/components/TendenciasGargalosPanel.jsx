import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
} from 'recharts';
import { Info, TrendingUp } from 'lucide-react';
import { format, eachDayOfInterval, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  onSnapshot,
  query,
  where,
  orderBy,
  getHistoricoRegulacoesCollection,
  getSetoresCollection,
} from '@/lib/firebase';
import IndicadorInfoModal from '@/components/modals/IndicadorInfoModal';

const parseDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === 'function') return value.toDate();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const normalizar = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const TendenciasGargalosPanel = ({ dateRange }) => {
  const [historicoRegulacoes, setHistoricoRegulacoes] = useState(null);
  const [, setSetores] = useState([]);
  const [modalIndicador, setModalIndicador] = useState({ open: false, indicadorId: null });

  const inicioPeriodo = useMemo(
    () => (dateRange?.from ? startOfDay(dateRange.from) : startOfDay(new Date())),
    [dateRange?.from]
  );
  const fimPeriodo = useMemo(
    () => (dateRange?.to ? endOfDay(dateRange.to) : endOfDay(new Date())),
    [dateRange?.to]
  );

  // Snapshot com filtro de data baseado no período global
  useEffect(() => {
    const unsubRegulacoes = onSnapshot(
      query(
        getHistoricoRegulacoesCollection(),
        where('dataInicio', '>=', inicioPeriodo),
        orderBy('dataInicio', 'desc')
      ),
      (snap) => {
        setHistoricoRegulacoes(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (err) => {
        console.error('Erro ao carregar histórico de regulações:', err);
        setHistoricoRegulacoes([]);
      }
    );

    const unsubSetores = onSnapshot(getSetoresCollection(), (snap) => {
      setSetores(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubRegulacoes();
      unsubSetores();
    };
  }, [inicioPeriodo]);

  const loading = historicoRegulacoes === null;

  // === Tendência: Regulações Iniciadas vs Concluídas por dia ===
  const dadosTendencia = useMemo(() => {
    const dias = eachDayOfInterval({ start: inicioPeriodo, end: fimPeriodo });

    const base = dias.map((dia) => ({
      data: format(dia, 'dd/MM', { locale: ptBR }),
      dataCompleta: dia,
      regulacoesIniciadas: 0,
      regulacoesConcluidas: 0,
    }));

    const indexPorDia = new Map(
      base.map((b, idx) => [format(b.dataCompleta, 'yyyy-MM-dd'), idx])
    );

    (historicoRegulacoes || []).forEach((reg) => {
      const dataInicio = parseDate(reg?.dataInicio);
      if (dataInicio && dataInicio >= inicioPeriodo && dataInicio <= fimPeriodo) {
        const chave = format(dataInicio, 'yyyy-MM-dd');
        const idx = indexPorDia.get(chave);
        if (idx !== undefined) base[idx].regulacoesIniciadas += 1;
      }

      // Correção: priorizar dataConclusao (campo real), com fallback legado para dataFim
      const dataConclusao = parseDate(reg?.dataConclusao || reg?.dataFim);
      if (
        dataConclusao &&
        normalizar(reg?.statusFinal || reg?.status) === 'concluida' &&
        dataConclusao >= inicioPeriodo &&
        dataConclusao <= fimPeriodo
      ) {
        const chave = format(dataConclusao, 'yyyy-MM-dd');
        const idx = indexPorDia.get(chave);
        if (idx !== undefined) base[idx].regulacoesConcluidas += 1;
      }
    });

    return base;
  }, [historicoRegulacoes, inicioPeriodo, fimPeriodo]);

  const totalIniciadas = useMemo(
    () => dadosTendencia.reduce((acc, d) => acc + d.regulacoesIniciadas, 0),
    [dadosTendencia]
  );

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
        <h2 className="text-xl font-semibold text-foreground">Tendências e Gargalos</h2>
        <p className="text-sm text-muted-foreground">
          O "filme" da operação: como regulações e fluxos evoluem no período selecionado.
        </p>
      </div>

      {/* KPI de volume */}
      <div className="grid gap-4 md:grid-cols-1">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Regulações no período
              </CardTitle>
              <p className="mt-2 text-3xl font-bold">{totalIniciadas}</p>
              <p className="text-xs text-muted-foreground">Movimentações internas iniciadas</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setModalIndicador({ open: true, indicadorId: 'historicoTotalRegulacoes' })}
            >
              <Info className="h-4 w-4" />
            </Button>
          </CardHeader>
        </Card>
      </div>

      {/* Gráfico de tendência */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-5 w-5 text-primary" />
              Tendência: Regulações Iniciadas vs Concluídas por dia
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Áreas suavizadas mostram o ritmo da operação no período selecionado.
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dadosTendencia} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradIniciadas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ea580c" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#ea580c" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradConcluidas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#059669" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                <XAxis dataKey="data" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <RechartsTooltip
                  contentStyle={{
                    background: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area
                  type="monotone"
                  dataKey="regulacoesIniciadas"
                  name="Regulações Iniciadas"
                  stroke="#ea580c"
                  strokeWidth={2}
                  fill="url(#gradIniciadas)"
                />
                <Area
                  type="monotone"
                  dataKey="regulacoesConcluidas"
                  name="Regulações Concluídas"
                  stroke="#059669"
                  strokeWidth={2}
                  fill="url(#gradConcluidas)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <IndicadorInfoModal
        isOpen={modalIndicador.open}
        onClose={() => setModalIndicador({ open: false, indicadorId: null })}
        indicadorId={modalIndicador.indicadorId}
      />
    </div>
  );
};

export default TendenciasGargalosPanel;
