import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  BarChart,
} from 'recharts';
import {
  Info,
  TrendingUp,
  ArrowDownRight,
  ArrowUpRight,
  GitBranch,
} from 'lucide-react';
import { format, subDays, startOfDay, eachDayOfInterval, isAfter } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  onSnapshot,
  query,
  where,
  orderBy,
  getHistoricoOcupacoesCollection,
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
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();

const resolverSetorLabel = (registro, chave, setoresMap) => {
  const id =
    registro?.[`${chave}Id`] ||
    (typeof registro?.[chave] === 'object' ? registro[chave]?.id : null);
  const setor = id ? setoresMap.get(id) : null;
  return (
    setor?.siglaSetor ||
    setor?.nomeSetor ||
    registro?.[`${chave}Sigla`] ||
    registro?.[`${chave}Nome`] ||
    (typeof registro?.[chave] === 'string' ? registro[chave] : null) ||
    'Não informado'
  );
};

const TendenciasGargalosPanel = () => {
  const [historicoOcupacoes, setHistoricoOcupacoes] = useState(null);
  const [historicoRegulacoes, setHistoricoRegulacoes] = useState(null);
  const [setores, setSetores] = useState([]);
  const [janela, setJanela] = useState(7); // 7 ou 30 dias
  const [modalIndicador, setModalIndicador] = useState({ open: false, indicadorId: null });

  // Snapshots com cleanup
  useEffect(() => {
    const dataLimite = startOfDay(subDays(new Date(), 30));

    const unsubOcupacoes = onSnapshot(
      query(
        getHistoricoOcupacoesCollection(),
        where('dataSaida', '>=', dataLimite),
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

    const unsubRegulacoes = onSnapshot(
      query(
        getHistoricoRegulacoesCollection(),
        where('dataInicio', '>=', dataLimite),
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
      unsubOcupacoes();
      unsubRegulacoes();
      unsubSetores();
    };
  }, []);

  const setoresMap = useMemo(
    () => new Map(setores.map((s) => [s.id, s])),
    [setores]
  );

  const loading = historicoOcupacoes === null || historicoRegulacoes === null;

  const dataInicioJanela = useMemo(
    () => startOfDay(subDays(new Date(), janela - 1)),
    [janela]
  );

  // === Tendência: Altas e Regulações por dia ===
  const dadosTendencia = useMemo(() => {
    const dias = eachDayOfInterval({
      start: dataInicioJanela,
      end: new Date(),
    });

    const base = dias.map((dia) => ({
      data: format(dia, 'dd/MM', { locale: ptBR }),
      dataCompleta: dia,
      altas: 0,
      regulacoes: 0,
    }));

    const indexPorDia = new Map(
      base.map((b, idx) => [format(b.dataCompleta, 'yyyy-MM-dd'), idx])
    );

    (historicoOcupacoes || []).forEach((reg) => {
      const dataSaida = parseDate(reg?.dataSaida);
      if (!dataSaida || !isAfter(dataSaida, dataInicioJanela)) return;
      const chave = format(dataSaida, 'yyyy-MM-dd');
      const idx = indexPorDia.get(chave);
      if (idx !== undefined) base[idx].altas += 1;
    });

    (historicoRegulacoes || []).forEach((reg) => {
      const dataInicio = parseDate(reg?.dataInicio);
      if (!dataInicio || !isAfter(dataInicio, dataInicioJanela)) return;
      const chave = format(dataInicio, 'yyyy-MM-dd');
      const idx = indexPorDia.get(chave);
      if (idx !== undefined) base[idx].regulacoes += 1;
    });

    return base;
  }, [historicoOcupacoes, historicoRegulacoes, dataInicioJanela]);

  // === Gargalos: setores emissores (origem) e receptores (destino) ===
  const dadosGargalos = useMemo(() => {
    const emissores = new Map();
    const receptores = new Map();

    (historicoRegulacoes || []).forEach((reg) => {
      const dataInicio = parseDate(reg?.dataInicio);
      if (!dataInicio || !isAfter(dataInicio, dataInicioJanela)) return;

      const origem = resolverSetorLabel(reg, 'setorOrigem', setoresMap);
      const destino = resolverSetorLabel(reg, 'setorDestino', setoresMap);

      emissores.set(origem, (emissores.get(origem) || 0) + 1);
      receptores.set(destino, (receptores.get(destino) || 0) + 1);
    });

    const top = (mapa) =>
      Array.from(mapa.entries())
        .map(([setor, total]) => ({ setor, total }))
        .filter((item) => item.setor && item.setor !== 'Não informado')
        .sort((a, b) => b.total - a.total)
        .slice(0, 8);

    return {
      emissores: top(emissores),
      receptores: top(receptores),
    };
  }, [historicoRegulacoes, dataInicioJanela, setoresMap]);

  // === Eficiência: Giro de leito + Tempo médio de permanência ===
  const dadosEficiencia = useMemo(() => {
    const altasNaJanela = (historicoOcupacoes || []).filter((reg) => {
      const dataSaida = parseDate(reg?.dataSaida);
      return dataSaida && isAfter(dataSaida, dataInicioJanela);
    });

    const totalAltas = altasNaJanela.length;

    const permanencias = altasNaJanela
      .map((reg) => {
        const entrada = parseDate(reg?.dataEntrada);
        const saida = parseDate(reg?.dataSaida);
        if (!entrada || !saida) return null;
        return (saida.getTime() - entrada.getTime()) / (1000 * 60 * 60 * 24);
      })
      .filter((d) => Number.isFinite(d) && d >= 0);

    const tempoMedio =
      permanencias.length > 0
        ? permanencias.reduce((a, b) => a + b, 0) / permanencias.length
        : null;

    return {
      totalAltas,
      tempoMedio,
      mediaDiaria: totalAltas / janela,
    };
  }, [historicoOcupacoes, dataInicioJanela, janela]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
        <Skeleton className="h-80 w-full" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-72 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho com toggle 7/30d */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Tendências e Gargalos</h2>
          <p className="text-sm text-muted-foreground">
            O "filme" da operação: como altas, regulações e fluxos evoluem nos últimos dias.
          </p>
        </div>
        <div className="inline-flex rounded-md border bg-background p-1 text-sm">
          <button
            type="button"
            onClick={() => setJanela(7)}
            className={`rounded px-3 py-1 transition ${
              janela === 7 ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Últimos 7 dias
          </button>
          <button
            type="button"
            onClick={() => setJanela(30)}
            className={`rounded px-3 py-1 transition ${
              janela === 30 ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Últimos 30 dias
          </button>
        </div>
      </div>

      {/* KPIs de eficiência */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Altas no período
              </CardTitle>
              <p className="mt-2 text-3xl font-bold">{dadosEficiencia.totalAltas}</p>
              <p className="text-xs text-muted-foreground">
                ~{dadosEficiencia.mediaDiaria.toFixed(1)} altas/dia
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setModalIndicador({ open: true, indicadorId: 'giroLeitos' })}
            >
              <Info className="h-4 w-4" />
            </Button>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Tempo médio de permanência
              </CardTitle>
              <p className="mt-2 text-3xl font-bold">
                {dadosEficiencia.tempoMedio !== null
                  ? `${dadosEficiencia.tempoMedio.toFixed(1)}d`
                  : '—'}
              </p>
              <p className="text-xs text-muted-foreground">
                Média entre as altas do período
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setModalIndicador({ open: true, indicadorId: 'mediaPermanencia' })}
            >
              <Info className="h-4 w-4" />
            </Button>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Regulações no período
              </CardTitle>
              <p className="mt-2 text-3xl font-bold">
                {(historicoRegulacoes || []).filter((r) => {
                  const d = parseDate(r?.dataInicio);
                  return d && isAfter(d, dataInicioJanela);
                }).length}
              </p>
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
              Tendência: Altas e Regulações por dia
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
                  <linearGradient id="gradAltas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#059669" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradRegs" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
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
                  dataKey="altas"
                  name="Altas"
                  stroke="#059669"
                  strokeWidth={2}
                  fill="url(#gradAltas)"
                />
                <Area
                  type="monotone"
                  dataKey="regulacoes"
                  name="Regulações"
                  stroke="#2563eb"
                  strokeWidth={2}
                  fill="url(#gradRegs)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Gargalos: emissores e receptores */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <ArrowUpRight className="h-5 w-5 text-orange-600" />
                Top Setores Emissores
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Setores que mais originaram regulações (pacientes saindo).
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setModalIndicador({ open: true, indicadorId: 'fluxoRegulacoes' })}
            >
              <Info className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {dadosGargalos.emissores.length ? (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={dadosGargalos.emissores}
                    layout="vertical"
                    margin={{ left: 12, right: 24 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="setor" width={140} tick={{ fontSize: 11 }} />
                    <RechartsTooltip
                      formatter={(value) => [`${value} regulações`, 'Total']}
                      contentStyle={{
                        background: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="total" fill="#ea580c" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
                Sem regulações no período.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <ArrowDownRight className="h-5 w-5 text-blue-600" />
                Top Setores Receptores
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Setores que mais receberam pacientes regulados (gargalos de admissão).
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setModalIndicador({ open: true, indicadorId: 'fluxoRegulacoes' })}
            >
              <Info className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {dadosGargalos.receptores.length ? (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={dadosGargalos.receptores}
                    layout="vertical"
                    margin={{ left: 12, right: 24 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="setor" width={140} tick={{ fontSize: 11 }} />
                    <RechartsTooltip
                      formatter={(value) => [`${value} regulações`, 'Total']}
                      contentStyle={{
                        background: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="total" fill="#2563eb" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
                Sem regulações no período.
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

export default TendenciasGargalosPanel;
