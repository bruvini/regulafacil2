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
} from 'recharts';
import {
  getHistoricoRegulacoesCollection,
  getSetoresCollection,
  getDocs,
  query,
  where,
  orderBy,
} from '@/lib/firebase';
import { Timestamp, onSnapshot } from 'firebase/firestore';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const PERIOD_OPTIONS = [
  { value: '7d', label: 'Últimos 7 dias' },
  { value: '30d', label: 'Últimos 30 dias' },
  { value: 'month', label: 'Mês Atual' },
];

const PIE_COLORS = ['#2563eb', '#7c3aed', '#ea580c', '#059669', '#0ea5e9', '#facc15', '#14b8a6', '#f97316'];

const parseFirestoreDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === 'function') {
    return value.toDate();
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getDateRange = (periodValue) => {
  const end = new Date();
  const endDate = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999);

  if (periodValue === '7d') {
    const start = new Date(endDate);
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    return { start, end: endDate };
  }

  if (periodValue === '30d') {
    const start = new Date(endDate);
    start.setDate(start.getDate() - 29);
    start.setHours(0, 0, 0, 0);
    return { start, end: endDate };
  }

  const start = new Date(endDate.getFullYear(), endDate.getMonth(), 1, 0, 0, 0, 0);
  return { start, end: endDate };
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
  const [period, setPeriod] = useState(PERIOD_OPTIONS[0].value);
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
        const { start, end } = getDateRange(period);
        const startTimestamp = Timestamp.fromDate(start);
        const endTimestamp = Timestamp.fromDate(end);
        const collectionRef = getHistoricoRegulacoesCollection();

        const registrosMap = new Map();

        const queryInicio = query(
          collectionRef,
          where('dataInicio', '>=', startTimestamp),
          where('dataInicio', '<=', endTimestamp),
          orderBy('dataInicio', 'desc')
        );

        const queryConclusao = query(
          collectionRef,
          where('dataConclusao', '>=', startTimestamp),
          where('dataConclusao', '<=', endTimestamp),
          orderBy('dataConclusao', 'desc')
        );

        const [snapshotInicio, snapshotConclusao] = await Promise.all([
          getDocs(queryInicio),
          getDocs(queryConclusao),
        ]);

        snapshotInicio.forEach((doc) => {
          registrosMap.set(doc.id, { id: doc.id, ...doc.data() });
        });

        snapshotConclusao.forEach((doc) => {
          registrosMap.set(doc.id, { id: doc.id, ...doc.data() });
        });

        if (isMounted) {
          const registros = Array.from(registrosMap.values()).sort((a, b) => {
            const dataA = parseFirestoreDate(a.dataInicio) || parseFirestoreDate(a.dataConclusao) || new Date(0);
            const dataB = parseFirestoreDate(b.dataInicio) || parseFirestoreDate(b.dataConclusao) || new Date(0);
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
  }, [period]);

  const setoresMap = useMemo(() => new Map(setores.map((setor) => [setor.id, setor])), [setores]);

  const metricasGerais = useMemo(() => {
    if (!regulacoes.length) {
      return {
        total: 0,
        concluidas: 0,
        tempoMedio: null,
        taxaSucesso: null,
      };
    }

    const total = regulacoes.length;
    const concluidas = regulacoes.filter(
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
  }, [regulacoes]);

  const dadosDesfecho = useMemo(() => {
    if (!regulacoes.length) return [];

    const contagem = new Map();
    regulacoes.forEach((item) => {
      const status = item?.statusFinal || 'Sem status';
      contagem.set(status, (contagem.get(status) || 0) + 1);
    });

    return Array.from(contagem.entries()).map(([name, value]) => ({ name, value }));
  }, [regulacoes]);

  const dadosPorHora = useMemo(() => {
    const base = Array.from({ length: 24 }, (_, index) => ({
      hora: `${String(index).padStart(2, '0')}h`,
      total: 0,
    }));

    if (!regulacoes.length) {
      return base;
    }

    regulacoes.forEach((item) => {
      const dataInicio = parseFirestoreDate(item?.dataInicio);
      if (!dataInicio) return;
      const hora = dataInicio.getHours();
      base[hora].total += 1;
    });

    return base;
  }, [regulacoes]);

  const dadosFluxo = useMemo(() => {
    if (!regulacoes.length) return [];

    const contagem = new Map();

    regulacoes.forEach((item) => {
      const origem = resolveSetorInfo(item, 'setorOrigem', setoresMap);
      const destino = resolveSetorInfo(item, 'setorDestino', setoresMap);

      const chave = `${origem.label}→${destino.label}`;
      if (!contagem.has(chave)) {
        contagem.set(chave, {
          origem: origem.label,
          destino: destino.label,
          total: 0,
        });
      }

      contagem.get(chave).total += 1;
    });

    return Array.from(contagem.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [regulacoes, setoresMap]);

  const dadosTempoPorOrigem = useMemo(() => {
    if (!regulacoes.length) return [];

    const acumulado = new Map();

    regulacoes.forEach((item) => {
      const tempo = Number(item?.tempoRegulacaoMinutos ?? item?.tempoTotalMinutos ?? NaN);
      if (!Number.isFinite(tempo) || tempo <= 0) return;

      const status = normalizarStatus(item.statusFinal);
      if (status && status !== 'concluida') return;

      const origem = resolveSetorInfo(item, 'setorOrigem', setoresMap);
      const chave = origem.label;

      if (!acumulado.has(chave)) {
        acumulado.set(chave, { setor: chave, totalTempo: 0, quantidade: 0 });
      }

      const registro = acumulado.get(chave);
      registro.totalTempo += tempo;
      registro.quantidade += 1;
    });

    return Array.from(acumulado.values())
      .map((item) => ({
        setor: item.setor,
        tempoMedio: item.totalTempo / item.quantidade,
        quantidade: item.quantidade,
      }))
      .sort((a, b) => a.tempoMedio - b.tempoMedio);
  }, [regulacoes, setoresMap]);

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
      ) : regulacoes.length === 0 ? (
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
                          formatter={(value) => [`${value} regulações`, 'Inícios']}
                        />
                        <Bar dataKey="total" name="Regulações" fill="#2563eb" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>

          <section>
            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="border-muted">
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
                        </tr>
                      </thead>
                      <tbody>
                        {dadosFluxo.map((fluxo) => (
                          <tr key={`${fluxo.origem}-${fluxo.destino}`} className="border-t">
                            <td className="py-2 pr-3 font-medium text-foreground">{fluxo.origem}</td>
                            <td className="py-2 pr-3 text-foreground">{fluxo.destino}</td>
                            <td className="py-2 text-right font-semibold text-foreground">{fluxo.total}</td>
                          </tr>
                        ))}
                        {!dadosFluxo.length && (
                          <tr>
                            <td colSpan={3} className="py-6 text-center text-muted-foreground">
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

              <Card className="border-muted">
                <CardHeader>
                  <CardTitle className="text-base font-semibold text-foreground">
                    Eficiência por Setor de Origem
                  </CardTitle>
                  <CardDescription>
                    Tempo médio de conclusão das regulações originadas em cada setor.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dadosTempoPorOrigem} layout="vertical" margin={{ left: 80 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" tickFormatter={(value) => `${Math.round(value)} min`} />
                        <YAxis
                          type="category"
                          dataKey="setor"
                          width={120}
                          tick={{ fontSize: 12 }}
                        />
                        <RechartsTooltip
                          formatter={(value, _name, { payload }) => [
                            formatMinutes(value),
                            `${payload.quantidade} regulações`,
                          ]}
                          labelFormatter={(label) => label}
                        />
                        <Bar dataKey="tempoMedio" name="Tempo médio" fill="#059669" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

export default IndicadoresRegulacao;
