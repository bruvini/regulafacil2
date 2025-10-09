import React, { useEffect, useMemo, useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  Tooltip as RechartsTooltip,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Bar,
  LineChart,
  Line,
} from 'recharts';
import {
  getHistoricoRegulacoesCollection,
  getSetoresCollection,
  getDocs,
  query,
  orderBy,
} from '@/lib/firebase';
import { onSnapshot } from 'firebase/firestore';
import { endOfDay, format, isWithinInterval, startOfDay, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const PERIOD_OPTIONS = [
  { value: '24h', label: 'Últimas 24h' },
  { value: '7d', label: 'Últimos 7 dias' },
  { value: '15d', label: 'Últimos 15 dias' },
  { value: '30d', label: 'Últimos 30 dias' },
  { value: 'all', label: 'Todo o período' },
];

const PIE_COLORS = ['#2563eb', '#7c3aed', '#ea580c', '#059669', '#0ea5e9', '#facc15', '#14b8a6', '#f97316'];

const SHIFT_CONFIG = {
  manha: { label: 'Manhã', color: '#2563eb' },
  tarde: { label: 'Tarde', color: '#f97316' },
  noite: { label: 'Noite', color: '#7c3aed' },
};

const parseFirestoreDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === 'function') {
    return value.toDate();
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const normalizarStatus = (status) => {
  if (!status) return '';
  return String(status)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
};

const formatMinutes = (minutes) => {
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return '—';
  }
  if (minutes < 60) {
    return `${Math.round(minutes)} min`;
  }
  const horas = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (mins === 0) {
    return `${horas}h`;
  }
  return `${horas}h ${mins}min`;
};

const getTurnoFromHour = (hour) => {
  if (hour >= 6 && hour < 12) return 'manha';
  if (hour >= 12 && hour < 18) return 'tarde';
  return 'noite';
};

const getTurnoFromDate = (date) => {
  if (!(date instanceof Date)) return 'noite';
  return getTurnoFromHour(date.getHours());
};

const resolveSetorInfo = (registro, chave, setoresMap) => {
  const idDireto = registro?.[`${chave}Id`] || null;
  const objeto = registro?.[chave] || null;
  const idDoObjeto =
    typeof objeto === 'object' && objeto !== null
      ? objeto?.id || objeto?.setorId || objeto?.setorOrigemId || null
      : null;
  const id = idDireto || idDoObjeto || null;

  const fallbackSigla =
    registro?.[`${chave}Sigla`] ||
    (typeof objeto === 'object' && objeto ? objeto?.siglaSetor : null) ||
    null;
  const fallbackNome =
    registro?.[`${chave}Nome`] ||
    (typeof objeto === 'object' && objeto ? objeto?.nomeSetor : null) ||
    (typeof objeto === 'string' ? objeto : null) ||
    null;

  const setor = id ? setoresMap.get(id) : null;
  const label =
    setor?.siglaSetor ||
    setor?.nomeSetor ||
    fallbackSigla ||
    fallbackNome ||
    (id ? String(id) : 'Não informado');

  return { id, label };
};

const IndicadoresRegulacao = () => {
  const [period, setPeriod] = useState(PERIOD_OPTIONS[1].value);
  const [regulacoes, setRegulacoes] = useState([]);
  const [setores, setSetores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(getSetoresCollection(), (snapshot) => {
      setSetores(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const fetchRegulacoes = async () => {
      setLoading(true);
      setError(null);

      try {
        const collectionRef = getHistoricoRegulacoesCollection();
        const registrosMap = new Map();

        const [snapshotInicio, snapshotConclusao] = await Promise.all([
          getDocs(query(collectionRef, orderBy('dataInicio', 'desc'))),
          getDocs(query(collectionRef, orderBy('dataConclusao', 'desc'))),
        ]);

        snapshotInicio.forEach((doc) => {
          registrosMap.set(doc.id, { id: doc.id, ...doc.data() });
        });

        snapshotConclusao.forEach((doc) => {
          registrosMap.set(doc.id, { id: doc.id, ...doc.data() });
        });

        if (isMounted) {
          const registros = Array.from(registrosMap.values()).sort((a, b) => {
            const dataA =
              parseFirestoreDate(a.dataInicio) || parseFirestoreDate(a.dataConclusao) || new Date(0);
            const dataB =
              parseFirestoreDate(b.dataInicio) || parseFirestoreDate(b.dataConclusao) || new Date(0);
            return dataB.getTime() - dataA.getTime();
          });
          setRegulacoes(registros);
        }
      } catch (err) {
        if (isMounted) {
          console.error('Erro ao carregar histórico de regulações:', err);
          setError('Não foi possível carregar os dados de regulação.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchRegulacoes();

    return () => {
      isMounted = false;
    };
  }, []);

  const setoresMap = useMemo(() => new Map(setores.map((setor) => [setor.id, setor])), [setores]);

  const regulacoesFiltradas = useMemo(() => {
    if (!regulacoes.length) return [];
    if (period === 'all') return regulacoes;

    const agora = new Date();
    const endDate = period === '24h' ? agora : endOfDay(agora);

    let startDate;
    switch (period) {
      case '24h':
        startDate = subDays(endDate, 1);
        break;
      case '7d':
        startDate = startOfDay(subDays(endDate, 6));
        break;
      case '15d':
        startDate = startOfDay(subDays(endDate, 14));
        break;
      case '30d':
        startDate = startOfDay(subDays(endDate, 29));
        break;
      default:
        startDate = null;
        break;
    }

    if (!startDate) {
      return regulacoes;
    }

    return regulacoes.filter((item) => {
      const dataInicio = parseFirestoreDate(item?.dataInicio);
      const dataConclusao = parseFirestoreDate(item?.dataConclusao);
      const datasValidas = [dataInicio, dataConclusao].filter(Boolean);

      if (!datasValidas.length) {
        return false;
      }

      return datasValidas.some((data) =>
        isWithinInterval(data, {
          start: startDate,
          end: endDate,
        })
      );
    });
  }, [period, regulacoes]);

  const metricasGerais = useMemo(() => {
    if (!regulacoesFiltradas.length) {
      return {
        total: 0,
        concluidas: 0,
        tempoMedio: null,
        taxaSucesso: null,
      };
    }

    const total = regulacoesFiltradas.length;
    const concluidas = regulacoesFiltradas.filter(
      (item) => normalizarStatus(item.statusFinal) === 'concluida'
    );
    const tempos = concluidas
      .map((item) => Number(item?.tempoRegulacaoMinutos ?? item?.tempoTotalMinutos ?? NaN))
      .filter((tempo) => Number.isFinite(tempo) && tempo > 0);
    const tempoMedio = tempos.length
      ? tempos.reduce((acc, tempo) => acc + tempo, 0) / tempos.length
      : null;
    const taxaSucesso = total > 0 ? (concluidas.length / total) * 100 : null;

    return {
      total,
      concluidas: concluidas.length,
      tempoMedio,
      taxaSucesso,
    };
  }, [regulacoesFiltradas]);

  const dadosDesfecho = useMemo(() => {
    if (!regulacoesFiltradas.length) return [];

    const contagem = new Map();
    regulacoesFiltradas.forEach((item) => {
      const status = item?.statusFinal || 'Sem status';
      contagem.set(status, (contagem.get(status) || 0) + 1);
    });

    return Array.from(contagem.entries()).map(([name, value]) => ({ name, value }));
  }, [regulacoesFiltradas]);

  const dadosPorHora = useMemo(() => {
    const base = Array.from({ length: 24 }, (_, index) => ({
      hora: `${String(index).padStart(2, '0')}h`,
      total: 0,
      turno: getTurnoFromHour(index),
    }));

    if (!regulacoesFiltradas.length) {
      return base;
    }

    regulacoesFiltradas.forEach((item) => {
      const dataInicio = parseFirestoreDate(item?.dataInicio);
      if (!dataInicio) return;
      const hora = dataInicio.getHours();
      base[hora].total += 1;
    });

    return base;
  }, [regulacoesFiltradas]);

  const dadosFluxo = useMemo(() => {
    if (!regulacoesFiltradas.length) return [];

    const contagem = new Map();

    regulacoesFiltradas.forEach((item) => {
      const origem = resolveSetorInfo(item, 'setorOrigem', setoresMap);
      const destino = resolveSetorInfo(item, 'setorDestino', setoresMap);

      const chave = `${origem.label}→${destino.label}`;
      if (!contagem.has(chave)) {
        contagem.set(chave, {
          origem: origem.label,
          destino: destino.label,
          total: 0,
          tempoTotal: 0,
          quantidadeTempo: 0,
        });
      }

      const registro = contagem.get(chave);
      registro.total += 1;

      const tempo = Number(item?.tempoRegulacaoMinutos ?? NaN);
      if (Number.isFinite(tempo) && tempo > 0) {
        registro.tempoTotal += tempo;
        registro.quantidadeTempo += 1;
      }
    });

    return Array.from(contagem.values())
      .map((item) => ({
        ...item,
        tempoMedio:
          item.quantidadeTempo > 0 ? item.tempoTotal / item.quantidadeTempo : null,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [regulacoesFiltradas, setoresMap]);

  const dadosComparativoSetores = useMemo(() => {
    if (!regulacoesFiltradas.length) return [];

    const acumulado = new Map();

    regulacoesFiltradas.forEach((item) => {
      const tempo = Number(item?.tempoRegulacaoMinutos ?? NaN);
      if (!Number.isFinite(tempo) || tempo <= 0) return;

      const status = normalizarStatus(item.statusFinal);
      if (status && status !== 'concluida') return;

      const origem = resolveSetorInfo(item, 'setorOrigem', setoresMap);
      const destino = resolveSetorInfo(item, 'setorDestino', setoresMap);

      if (!acumulado.has(origem.label)) {
        acumulado.set(origem.label, {
          setor: origem.label,
          origemTempo: 0,
          origemQtd: 0,
          destinoTempo: 0,
          destinoQtd: 0,
        });
      }

      if (!acumulado.has(destino.label)) {
        acumulado.set(destino.label, {
          setor: destino.label,
          origemTempo: 0,
          origemQtd: 0,
          destinoTempo: 0,
          destinoQtd: 0,
        });
      }

      const registroOrigem = acumulado.get(origem.label);
      registroOrigem.origemTempo += tempo;
      registroOrigem.origemQtd += 1;

      const registroDestino = acumulado.get(destino.label);
      registroDestino.destinoTempo += tempo;
      registroDestino.destinoQtd += 1;
    });

    return Array.from(acumulado.values())
      .map((item) => {
        const origemMedio = item.origemQtd > 0 ? item.origemTempo / item.origemQtd : null;
        const destinoMedio = item.destinoQtd > 0 ? item.destinoTempo / item.destinoQtd : null;

        return {
          setor: item.setor,
          origemMedio,
          destinoMedio,
          origemQtd: item.origemQtd,
          destinoQtd: item.destinoQtd,
          barOrigem: origemMedio !== null ? -origemMedio : null,
          barDestino: destinoMedio !== null ? destinoMedio : null,
        };
      })
      .filter((item) => item.origemQtd > 0 || item.destinoQtd > 0)
      .sort((a, b) => {
        const maxA = Math.max(a.origemMedio || 0, a.destinoMedio || 0);
        const maxB = Math.max(b.origemMedio || 0, b.destinoMedio || 0);
        return maxB - maxA;
      });
  }, [regulacoesFiltradas, setoresMap]);

  const maiorTempoAbsoluto = useMemo(() => {
    if (!dadosComparativoSetores.length) return 0;

    return dadosComparativoSetores.reduce((maior, item) => {
      const valores = [item.barOrigem ?? 0, item.barDestino ?? 0];
      const maiorAtual = Math.max(...valores.map((valor) => Math.abs(valor || 0)));
      return Math.max(maior, maiorAtual);
    }, 0);
  }, [dadosComparativoSetores]);

  const dadosVolumePorDiaTurno = useMemo(() => {
    const diasSemanaOrdem = [1, 2, 3, 4, 5, 6, 0];
    const rotulosDias = {
      0: 'Domingo',
      1: 'Segunda',
      2: 'Terça',
      3: 'Quarta',
      4: 'Quinta',
      5: 'Sexta',
      6: 'Sábado',
    };

    const base = diasSemanaOrdem.map((dia) => ({
      diaValor: dia,
      dia: rotulosDias[dia],
      manha: 0,
      tarde: 0,
      noite: 0,
    }));

    if (!regulacoesFiltradas.length) {
      return base;
    }

    const baseMap = new Map(base.map((item) => [item.diaValor, item]));

    regulacoesFiltradas.forEach((item) => {
      const dataInicio = parseFirestoreDate(item?.dataInicio);
      if (!dataInicio) return;

      const dia = dataInicio.getDay();
      const turno = getTurnoFromDate(dataInicio);
      const registro = baseMap.get(dia);
      if (!registro) return;

      registro[turno] += 1;
    });

    return base;
  }, [regulacoesFiltradas]);

  const limiteEixoComparativo = maiorTempoAbsoluto ? Math.ceil(maiorTempoAbsoluto * 1.1) : 10;

  const renderLoadingState = () => (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Card key={`kpi-skeleton-${index}`} className="border-muted">
            <CardContent className="space-y-4 p-6">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-3 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={`chart-skeleton-${index}`} className="border-muted">
            <CardHeader>
              <Skeleton className="h-5 w-48" />
              <CardDescription>
                <Skeleton className="mt-2 h-3 w-full" />
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-foreground">Histórico analisado</h3>
          <p className="text-sm text-muted-foreground">
            Selecione o período para compreender como o volume e a eficiência de regulações evoluem.
          </p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-full md:w-56">
            <SelectValue placeholder="Selecione o período" />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && (
        <Card className="border-destructive/40 bg-destructive/10">
          <CardContent className="py-6 text-sm text-destructive">
            {error}
          </CardContent>
        </Card>
      )}

      {loading ? (
        renderLoadingState()
      ) : regulacoesFiltradas.length === 0 ? (
        <Card className="border-muted">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Nenhuma regulação encontrada no período selecionado.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <section>
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="border-muted">
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total de Regulações
                  </CardTitle>
                  <CardDescription>Volume total de movimentações no período.</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-semibold text-foreground">{metricasGerais.total}</p>
                </CardContent>
              </Card>

              <Card className="border-muted">
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Tempo Médio de Conclusão
                  </CardTitle>
                  <CardDescription>
                    Considera apenas regulações concluídas no período.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-semibold text-foreground">
                    {formatMinutes(metricasGerais.tempoMedio)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {metricasGerais.concluidas} regulações concluídas
                  </p>
                </CardContent>
              </Card>

              <Card className="border-muted">
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Taxa de Sucesso
                  </CardTitle>
                  <CardDescription>Percentual de regulações concluídas no período.</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-semibold text-foreground">
                    {metricasGerais.taxaSucesso === null
                      ? '—'
                      : `${Math.round(metricasGerais.taxaSucesso)}%`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {metricasGerais.total > 0
                      ? `${metricasGerais.concluidas} de ${metricasGerais.total} concluídas`
                      : 'Sem movimentações registradas'}
                  </p>
                </CardContent>
              </Card>
            </div>
          </section>

          <section>
            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="border-muted">
                <CardHeader>
                  <CardTitle className="text-base font-semibold text-foreground">
                    Desfecho das Regulações
                  </CardTitle>
                  <CardDescription>
                    Avalie o resultado final das movimentações do período.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={dadosDesfecho}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={110}
                          paddingAngle={4}
                          label={({ percent }) =>
                            percent >= 0.05 ? `${Math.round(percent * 100)}%` : ''
                          }
                        >
                          {dadosDesfecho.map((entry, index) => (
                            <Cell
                              key={`desfecho-${entry.name}`}
                              fill={PIE_COLORS[index % PIE_COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <RechartsTooltip
                          formatter={(value, _name, { payload }) => [
                            `${value} regulações`,
                            payload.name,
                          ]}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-muted">
                <CardHeader>
                  <CardTitle className="text-base font-semibold text-foreground">
                    Inícios por Hora do Dia
                  </CardTitle>
                  <CardDescription>
                    Identifique horários de pico para planejar a equipe assistencial.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dadosPorHora}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="hora" interval={1} tick={{ fontSize: 12 }} />
                        <YAxis allowDecimals={false} />
                        <RechartsTooltip
                          formatter={(value, _name, { payload }) => [
                            `${value} regulações`,
                            SHIFT_CONFIG[payload.turno]?.label || 'Turno',
                          ]}
                        />
                        <Legend
                          payload={Object.entries(SHIFT_CONFIG).map(([key, info]) => ({
                            id: key,
                            type: 'square',
                            value: info.label,
                            color: info.color,
                          }))}
                        />
                        <Bar dataKey="total" name="Regulações" radius={[4, 4, 0, 0]}>
                          {dadosPorHora.map((entry, index) => (
                            <Cell
                              key={`turno-${entry.hora}-${index}`}
                              fill={SHIFT_CONFIG[entry.turno]?.color || '#94a3b8'}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>

          <section>
            <div className="grid gap-4">
              <Card className="border-muted lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base font-semibold text-foreground">
                    Principais Fluxos de Regulação
                  </CardTitle>
                  <CardDescription>
                    Top 10 trajetos Origem → Destino com maior volume de pacientes.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="max-h-80 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                          <th className="pb-2">Origem</th>
                          <th className="pb-2">Destino</th>
                          <th className="pb-2 text-right">Regulações</th>
                          <th className="pb-2 text-right">Tempo Médio</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dadosFluxo.map((fluxo) => (
                          <tr key={`${fluxo.origem}-${fluxo.destino}`} className="border-t">
                            <td className="py-2 pr-3 font-medium text-foreground">{fluxo.origem}</td>
                            <td className="py-2 pr-3 text-foreground">{fluxo.destino}</td>
                            <td className="py-2 text-right font-semibold text-foreground">{fluxo.total}</td>
                            <td className="py-2 text-right text-foreground">
                              {formatMinutes(fluxo.tempoMedio)}
                            </td>
                          </tr>
                        ))}
                        {!dadosFluxo.length && (
                          <tr>
                            <td colSpan={4} className="py-6 text-center text-muted-foreground">
                              Nenhum fluxo relevante identificado.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Atualizado em {format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-muted lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base font-semibold text-foreground">
                    Eficiência por Setor: Origem vs. Destino
                  </CardTitle>
                  <CardDescription>
                    Compare o tempo médio para regular pacientes quando o setor é origem ou
                    destino.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[600px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={dadosComparativoSetores}
                        layout="vertical"
                        margin={{ left: 160, right: 40, top: 16, bottom: 16 }}
                        barCategoryGap={24}
                        barGap={8}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          type="number"
                          domain={[-limiteEixoComparativo, limiteEixoComparativo]}
                          tickFormatter={(value) => `${Math.round(Math.abs(value))} min`}
                        />
                        <YAxis
                          type="category"
                          dataKey="setor"
                          yAxisId="setores"
                          width={200}
                          tick={{ fontSize: 12 }}
                        />
                        <RechartsTooltip
                          formatter={(value, name, { payload }) => {
                            if (value === null || value === undefined) {
                              return ['—', name];
                            }
                            const tempo = Math.abs(value);
                            const quantidade =
                              name === 'Origem' ? payload.origemQtd : payload.destinoQtd;
                            const contexto =
                              name === 'Origem'
                                ? `${quantidade} regulações originadas`
                                : `${quantidade} regulações recebidas`;
                            return [formatMinutes(tempo), contexto];
                          }}
                          labelFormatter={(label) => label}
                        />
                        <Legend />
                        <Bar
                          dataKey="barOrigem"
                          name="Origem"
                          fill="#0ea5e9"
                          radius={[4, 4, 4, 4]}
                          isAnimationActive={false}
                          yAxisId="setores"
                        />
                        <Bar
                          dataKey="barDestino"
                          name="Destino"
                          fill="#059669"
                          radius={[4, 4, 4, 4]}
                          isAnimationActive={false}
                          yAxisId="setores"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>

          <section>
            <Card className="border-muted">
              <CardHeader>
                <CardTitle className="text-base font-semibold text-foreground">
                  Volume Semanal por Turno
                </CardTitle>
                <CardDescription>
                  Visualize como a demanda de regulações varia por dia da semana e turno.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dadosVolumePorDiaTurno} margin={{ left: 12, right: 12 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="dia" tick={{ fontSize: 12 }} />
                      <YAxis allowDecimals={false} />
                      <RechartsTooltip
                        formatter={(value, name) => [`${value} regulações`, name]}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="manha"
                        name={SHIFT_CONFIG.manha.label}
                        stroke={SHIFT_CONFIG.manha.color}
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="tarde"
                        name={SHIFT_CONFIG.tarde.label}
                        stroke={SHIFT_CONFIG.tarde.color}
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="noite"
                        name={SHIFT_CONFIG.noite.label}
                        stroke={SHIFT_CONFIG.noite.color}
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </section>
        </div>
      )}
    </div>
  );
};

export default IndicadoresRegulacao;
