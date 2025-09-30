import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Copy, Loader2, AlertCircle, CalendarRange, Clock, MapPin, Users } from 'lucide-react';
import {
  getPacientesCollection,
  getLeitosCollection,
  getSetoresCollection,
  getHistoricoRegulacoesCollection,
  getDocs,
  query,
  where,
  orderBy,
} from '@/lib/firebase';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const parseDate = (value) => {
  if (!value) return null;
  if (typeof value.toDate === 'function') {
    return value.toDate();
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const normalizarTexto = (texto) => (texto || '').toString().trim().toLowerCase();

const formatDateTime = (date) => {
  if (!date) return 'Não informado';
  return format(date, 'dd/MM/yyyy HH:mm', { locale: ptBR });
};

const formatMillisecondsToHHMM = (ms) => {
  if (!Number.isFinite(ms) || ms <= 0) {
    return '00:00';
  }
  const totalMinutes = Math.floor(ms / 60000);
  const horas = Math.floor(totalMinutes / 60);
  const minutos = totalMinutes % 60;
  return `${horas.toString().padStart(2, '0')}:${minutos.toString().padStart(2, '0')}`;
};

const sanitizarTrecho = (valor) => {
  if (!valor) return null;
  return valor.replace(/^['"]|['"]$/g, '').trim();
};

const extrairNomePaciente = (texto = '') => {
  const padroes = [
    /paciente\s+['"]([^'"]+)['"]/i,
    /paciente\s+([^'"\(]+?)(?:\(|foi|que|\.|$)/i,
  ];

  for (const regex of padroes) {
    const resultado = texto.match(regex);
    if (resultado?.[1]) {
      return resultado[1].trim();
    }
  }
  return null;
};

const extrairOrigemDestino = (texto = '') => {
  const padroes = [
    /do leito\s+['"]([^'"]+)['"]\s+para o leito\s+['"]([^'"]+)['"]/i,
    /do leito\s+['"]([^'"]+)['"]\s+para\s+['"]([^'"]+)['"]/i,
    /do leito\s+([^\)]+?)\s+para\s+([^\)]+?)\)/i,
    /do leito\s+([^\.,]+?)\s+para\s+([^\.,]+?)(?:\.|$)/i,
  ];

  for (const regex of padroes) {
    const resultado = texto.match(regex);
    if (resultado?.[1] || resultado?.[2]) {
      return {
        origem: sanitizarTrecho(resultado[1]),
        destino: sanitizarTrecho(resultado[2]),
      };
    }
  }

  return { origem: null, destino: null };
};

const extrairMotivo = (texto = '') => {
  const resultado = texto.match(/Motivo:\s*['"]([^'"]+)['"]/i);
  return resultado?.[1] ? resultado[1].trim() : null;
};

const analisarLogRegulacao = (acao = '') => {
  const texto = acao || '';
  const lower = texto.toLowerCase();

  if (!lower.includes('regulação')) return null;

  let tipo = null;
  if (lower.includes('regulação iniciada')) {
    tipo = 'inicio';
  } else if (lower.includes('foi alterada') || lower.includes('regulação alterada')) {
    tipo = 'alteracao';
  } else if (lower.includes('foi concluída') || lower.includes('regulação concluída')) {
    tipo = 'conclusao';
  } else if (lower.includes('foi cancelada') || lower.includes('regulação cancelada')) {
    tipo = 'cancelamento';
  }

  if (!tipo) return null;

  const nomePaciente = extrairNomePaciente(texto);
  const { origem, destino } = extrairOrigemDestino(texto);
  const motivo = extrairMotivo(texto);

  return {
    tipo,
    nomePaciente,
    origem,
    destino,
    motivo,
  };
};

const identificarPacienteLog = (log, detalhes, pacientesPorId, pacientesPorNome) => {
  const possiveisIds = [
    log?.pacienteId,
    log?.paciente?.id,
    log?.contexto?.pacienteId,
    log?.context?.pacienteId,
    log?.dados?.pacienteId,
    log?.meta?.pacienteId,
  ].filter(Boolean);

  for (const id of possiveisIds) {
    if (pacientesPorId.has(id)) {
      const paciente = pacientesPorId.get(id);
      return {
        pacienteId: id,
        pacienteNome: paciente?.nomePaciente || detalhes?.nomePaciente || 'Paciente',
      };
    }
  }

  if (detalhes?.nomePaciente) {
    const chave = normalizarTexto(detalhes.nomePaciente);
    if (pacientesPorNome.has(chave)) {
      const paciente = pacientesPorNome.get(chave)[0];
      return {
        pacienteId: paciente.id,
        pacienteNome: paciente.nomePaciente || detalhes.nomePaciente,
      };
    }
    return {
      pacienteId: null,
      pacienteNome: detalhes.nomePaciente,
    };
  }

  return {
    pacienteId: null,
    pacienteNome: 'Paciente não identificado',
  };
};

const processarDadosRelatorio = (dados, periodo) => {
  if (!dados || dados.loading) {
    return {
      pendentes: [],
      pendentesPorOrigem: [],
      historicoRegulacoes: [],
      resumoPeriodo: {
        total: 0,
        concluidas: 0,
        canceladas: 0,
        pendentes: 0,
        alteradas: 0,
      },
    };
  }

  const periodoInicio = periodo?.inicio ? new Date(periodo.inicio) : null;
  const periodoFim = periodo?.fim ? new Date(periodo.fim) : null;

  const leitosMap = new Map(dados.leitos.map((leito) => [leito.id, leito]));
  const setoresMap = new Map(dados.setores.map((setor) => [setor.id, setor]));
  const pacientesPorId = new Map(dados.pacientes.map((paciente) => [paciente.id, paciente]));

  const pacientesPorNome = new Map();
  dados.pacientes.forEach((paciente) => {
    const chave = normalizarTexto(paciente.nomePaciente);
    if (!chave) return;
    if (!pacientesPorNome.has(chave)) {
      pacientesPorNome.set(chave, []);
    }
    pacientesPorNome.get(chave).push(paciente);
  });

  const pendentes = dados.pacientes
    .filter((paciente) => paciente.regulacaoAtiva)
    .map((paciente) => {
      const { regulacaoAtiva } = paciente;
      const leitoOrigem = regulacaoAtiva?.leitoOrigemId
        ? leitosMap.get(regulacaoAtiva.leitoOrigemId)
        : null;
      const leitoDestino = regulacaoAtiva?.leitoDestinoId
        ? leitosMap.get(regulacaoAtiva.leitoDestinoId)
        : null;
      const setorOrigem = leitoOrigem?.setorId ? setoresMap.get(leitoOrigem.setorId) : null;
      const setorDestino = regulacaoAtiva?.setorDestinoId
        ? setoresMap.get(regulacaoAtiva.setorDestinoId)
        : leitoDestino?.setorId
          ? setoresMap.get(leitoDestino.setorId)
          : null;
      const inicio = regulacaoAtiva?.iniciadoEm ? parseDate(regulacaoAtiva.iniciadoEm) : null;
      const tempoEsperaMs = inicio ? Math.max(Date.now() - inicio.getTime(), 0) : 0;

      return {
        paciente,
        regulacao: regulacaoAtiva,
        leitoOrigem,
        leitoDestino,
        setorOrigem,
        setorDestino,
        inicio,
        tempoEsperaMs,
        tempoEsperaTexto: formatMillisecondsToHHMM(tempoEsperaMs),
      };
    })
    .sort((a, b) => b.tempoEsperaMs - a.tempoEsperaMs);

  const pendentesPorOrigemMapa = new Map();
  pendentes.forEach((item) => {
    const setorId = item.setorOrigem?.id || 'sem-setor';
    if (!pendentesPorOrigemMapa.has(setorId)) {
      pendentesPorOrigemMapa.set(setorId, {
        setor: item.setorOrigem,
        regulacoes: [],
      });
    }
    pendentesPorOrigemMapa.get(setorId).regulacoes.push(item);
  });

  const historicoRegulacoes = (dados.historicoRegulacoes || [])
    .map((registro) => {
      // Garante a leitura do campo correto retornado pelo Firestore
      const dataInicio = parseDate(registro.dataInicio);
      const dataFim = registro.fim ? parseDate(registro.fim) : null;
      const pacienteRegistro = registro.paciente || null;
      const pacienteNome =
        pacienteRegistro?.nome ||
        pacienteRegistro?.nomePaciente ||
        registro.nomePaciente ||
        'Paciente não identificado';
      const leitoDestino = registro.leitoDestino || null;
      const leitoAnterior = registro.leitoAnterior || null;

      const leitoOrigemId =
        registro.leitoOrigemId ||
        registro.leitoAnteriorId ||
        leitoAnterior?.id ||
        null;
      const leitoDestinoId = registro.leitoDestinoId || leitoDestino?.id || null;
      const leitoDestinoFinalId = registro.leitoDestinoFinalId || registro.leitoDestinoFinal?.id || null;

      const setorOrigemId =
        registro.setorOrigemId ||
        leitosMap.get(leitoOrigemId || '')?.setorId ||
        registro.setorOrigem?.id ||
        null;
      const setorDestinoId =
        registro.setorDestinoId ||
        leitosMap.get(leitoDestinoId || '')?.setorId ||
        registro.setorDestino?.id ||
        null;
      const setorDestinoFinalId =
        registro.setorDestinoFinalId ||
        leitosMap.get(leitoDestinoFinalId || '')?.setorId ||
        registro.setorDestinoFinal?.id ||
        null;

      const leitoOrigemNome =
        (leitoOrigemId && (leitosMap.get(leitoOrigemId)?.codigoLeito || leitoOrigemId)) ||
        leitoAnterior?.codigoLeito ||
        registro.origemDescricao ||
        leitoOrigemId ||
        'Não informado';
      const leitoDestinoNome =
        (leitoDestinoId && (leitosMap.get(leitoDestinoId)?.codigoLeito || leitoDestinoId)) ||
        leitoDestino?.codigoLeito ||
        registro.destinoDescricao ||
        leitoDestinoId ||
        'Não informado';
      const leitoDestinoFinalNome =
        (leitoDestinoFinalId && (leitosMap.get(leitoDestinoFinalId)?.codigoLeito || leitoDestinoFinalId)) ||
        registro.leitoDestinoFinal?.codigoLeito ||
        leitoDestinoFinalId ||
        'Não informado';

      const setorOrigemSigla =
        (setorOrigemId &&
          (setoresMap.get(setorOrigemId)?.siglaSetor ||
            setoresMap.get(setorOrigemId)?.nomeSetor ||
            setorOrigemId)) ||
        registro.setorOrigem?.siglaSetor ||
        registro.setorOrigem?.nomeSetor ||
        setorOrigemId ||
        'Setor origem não informado';
      const setorDestinoSigla =
        (setorDestinoId &&
          (setoresMap.get(setorDestinoId)?.siglaSetor ||
            setoresMap.get(setorDestinoId)?.nomeSetor ||
            setorDestinoId)) ||
        registro.setorDestino?.siglaSetor ||
        registro.setorDestino?.nomeSetor ||
        setorDestinoId ||
        'Setor destino não informado';
      const setorDestinoFinalSigla =
        (setorDestinoFinalId &&
          (setoresMap.get(setorDestinoFinalId)?.siglaSetor ||
            setoresMap.get(setorDestinoFinalId)?.nomeSetor ||
            setorDestinoFinalId)) ||
        registro.setorDestinoFinal?.siglaSetor ||
        registro.setorDestinoFinal?.nomeSetor ||
        setorDestinoFinalId ||
        'Setor destino não informado';

      const usuarioRegistro = registro.usuario || {};
      const usuarioNome =
        usuarioRegistro.displayName ||
        usuarioRegistro.nome ||
        usuarioRegistro.nomeCompleto ||
        registro.usuarioNome ||
        'Usuário não informado';
      const statusFinal = registro.status || registro.statusFinal || registro.resultado || null;
      const tempoTotalMinutos = Number.isFinite(registro.tempoTotalMinutos)
        ? registro.tempoTotalMinutos
        : null;
      const alteracoes = Array.isArray(registro.alteracoes) ? registro.alteracoes : [];

      return {
        id: registro.id,
        paciente: pacienteRegistro,
        pacienteNome,
        dataInicio,
        dataFim,
        destinoDescricao: leitoDestinoNome,
        origemDescricao: leitoOrigemNome,
        leitoDestino,
        leitoAnterior,
        tipo: registro.tipo || 'Tipo não informado',
        usuario: usuarioRegistro,
        usuarioNome,
        statusFinal,
        tempoTotalMinutos,
        alteracoes,
        motivoCancelamento: registro.motivoCancelamento || registro.motivo || null,
        leitoOrigemId,
        leitoDestinoId,
        leitoDestinoFinalId,
        setorOrigemId,
        setorDestinoId,
        setorDestinoFinalId,
        leitoOrigemNome,
        setorOrigemSigla,
        leitoDestinoNome,
        setorDestinoSigla,
        leitoDestinoFinalNome,
        setorDestinoFinalSigla,
        tempoRegulacaoMinutos: Number.isFinite(tempoTotalMinutos)
          ? Math.round(tempoTotalMinutos)
          : dataInicio && dataFim
            ? Math.max(Math.round((dataFim.getTime() - dataInicio.getTime()) / 60000), 0)
            : null,
      };
    })
    .sort((a, b) => {
      const aTime = a.dataInicio ? a.dataInicio.getTime() : 0;
      const bTime = b.dataInicio ? b.dataInicio.getTime() : 0;
      return aTime - bTime;
    });

  const resumoPeriodo = {
    total: historicoRegulacoes.length,
    pendentes: historicoRegulacoes.filter(
      (item) => normalizarTexto(item.statusFinal) === 'pendente'
    ).length,
    concluidas: historicoRegulacoes.filter(
      (item) => normalizarTexto(item.statusFinal) === 'concluída'
    ).length,
    canceladas: historicoRegulacoes.filter(
      (item) => normalizarTexto(item.statusFinal) === 'cancelada'
    ).length,
    alteradas: historicoRegulacoes.filter(
      (item) => normalizarTexto(item.statusFinal) === 'alterada'
    ).length,
  };

  return {
    pendentes,
    pendentesPorOrigem: Array.from(pendentesPorOrigemMapa.values()),
    historicoRegulacoes,
    resumoPeriodo,
  };
};

const PanoramaRegulacoesModal = ({ isOpen, onClose, periodo }) => {
  const [dados, setDados] = useState({
    loading: false,
    historicoRegulacoes: [],
    pacientes: [],
    leitos: [],
    setores: [],
    error: null,
  });

  const { toast } = useToast();

  useEffect(() => {
    if (!isOpen || !periodo?.inicio || !periodo?.fim) return;

    let ativo = true;

    const carregarDados = async () => {
      try {
        setDados((prev) => ({ ...prev, loading: true, error: null }));

        const periodoInicio = periodo.inicio instanceof Date ? periodo.inicio : new Date(periodo.inicio);
        const periodoFim = periodo.fim instanceof Date ? periodo.fim : new Date(periodo.fim);

        const historicoQuery = query(
          getHistoricoRegulacoesCollection(),
          where('dataInicio', '>=', periodoInicio),
          where('dataInicio', '<=', periodoFim),
          // Manter 'desc' para pegar os mais recentes primeiro, a ordenação visual será feita depois.
          orderBy('dataInicio', 'desc'),
        );

        const [historicoSnapshot, pacientesSnapshot, leitosSnapshot, setoresSnapshot] = await Promise.all([
          getDocs(historicoQuery),
          getDocs(getPacientesCollection()),
          getDocs(getLeitosCollection()),
          getDocs(getSetoresCollection()),
        ]);

        if (!ativo) return;

        const historicoRegulacoes = historicoSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        const pacientes = pacientesSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        const leitos = leitosSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        const setores = setoresSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

        setDados({
          loading: false,
          historicoRegulacoes,
          pacientes,
          leitos,
          setores,
          error: null,
        });
      } catch (error) {
        console.error('Erro ao carregar panorama de regulações:', error);
        if (!ativo) return;
        setDados((prev) => ({ ...prev, loading: false, error }));
      }
    };

    carregarDados();

    return () => {
      ativo = false;
    };
  }, [isOpen, periodo]);

  const dadosProcessados = useMemo(
    () => processarDadosRelatorio(dados, periodo),
    [dados, periodo]
  );

  const periodoInicioFormatado = periodo?.inicio
    ? format(periodo.inicio, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
    : '-';
  const periodoFimFormatado = periodo?.fim
    ? format(periodo.fim, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
    : '-';

  const tipoBadgeVariant = (tipo) => {
    if (!tipo) return 'outline';
    const tipoNormalizado = normalizarTexto(tipo);
    if (tipoNormalizado.includes('intern')) return 'default';
    if (tipoNormalizado.includes('remanej')) return 'secondary';
    return 'outline';
  };

  const copiarPanorama = async () => {
    const { historicoRegulacoes, resumoPeriodo } = dadosProcessados;

    const periodoInicioTexto = formatDateTime(periodo?.inicio ? new Date(periodo.inicio) : null);
    const periodoFimTexto = formatDateTime(periodo?.fim ? new Date(periodo.fim) : null);

    const linhas = [
      'PANORAMA DE REGULAÇÕES',
      `Período: ${periodoInicioTexto} - ${periodoFimTexto}`,
      '',
      `Total de regulações: ${resumoPeriodo.total}`,
      '',
      `Pendentes: ${resumoPeriodo.pendentes}`,
      `Concluídas: ${resumoPeriodo.concluidas}`,
      `Canceladas: ${resumoPeriodo.canceladas}`,
      `Alteradas: ${resumoPeriodo.alteradas}`,
      '',
      'Histórico do período',
      '',
    ];

    if (historicoRegulacoes.length === 0) {
      linhas.push('Nenhum registro encontrado para o período.');
    } else {
      historicoRegulacoes.forEach((item, index) => {
        const statusNormalizado = normalizarTexto(item.statusFinal);
        const origemSigla = item.setorOrigemSigla || 'Setor origem não informado';
        const leitoOrigem = item.leitoOrigemNome || 'Leito origem não informado';
        const destinoSigla = item.setorDestinoSigla || 'Setor destino não informado';
        const leitoDestino = item.leitoDestinoNome || 'Leito destino não informado';
        const destinoFinalSigla = item.setorDestinoFinalSigla || destinoSigla;
        const leitoDestinoFinal = item.leitoDestinoFinalNome || leitoDestino;
        const destinoLinha =
          statusNormalizado === 'alterada'
            ? `${origemSigla} ${leitoOrigem} → ${destinoSigla} ${leitoDestino} → **${destinoFinalSigla} ${leitoDestinoFinal}**`
            : `${origemSigla} ${leitoOrigem} → ${destinoSigla} ${leitoDestino}`;
        const tempoTotalTexto = Number.isFinite(item.tempoRegulacaoMinutos)
          ? `${item.tempoRegulacaoMinutos} min`
          : 'Não informado';

        if (index > 0) {
          linhas.push('');
        }

        linhas.push(`${item.pacienteNome || 'Paciente não identificado'}`);
        linhas.push(destinoLinha);
        linhas.push(`Início: ${item.dataInicio ? formatDateTime(item.dataInicio) : 'Não informado'}`);
        linhas.push(`Status: ${item.statusFinal || 'Não informado'}`);
        linhas.push(`Tempo total: ${tempoTotalTexto}`);

        if (statusNormalizado === 'cancelada' && item.motivoCancelamento) {
          linhas.push(`Motivo do cancelamento: ${item.motivoCancelamento}`);
        }

        linhas.push('---');
      });
    }

    try {
      if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
        throw new Error('Clipboard API indisponível');
      }
      await navigator.clipboard.writeText(linhas.join('\n'));
      toast({
        title: 'Panorama copiado',
        description: 'Resumo copiado para a área de transferência.',
      });
    } catch (error) {
      toast({
        title: 'Erro ao copiar',
        description: 'Não foi possível copiar o panorama.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-7xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold">
            Panorama de Regulações
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Período selecionado: {periodoInicioFormatado} — {periodoFimFormatado}
          </p>
        </DialogHeader>

        {dados.loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="mb-3 h-8 w-8 animate-spin" />
            <p>Carregando informações do período...</p>
          </div>
        ) : dados.error ? (
          <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-destructive">
            <AlertCircle className="mt-1 h-5 w-5" />
            <div>
              <p className="font-medium">Não foi possível carregar o panorama.</p>
              <p className="text-sm opacity-90">Tente novamente em instantes.</p>
            </div>
          </div>
        ) : (
          <ScrollArea className="max-h-[80vh] pr-2">
            <div className="space-y-8">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CalendarRange className="h-4 w-4" />
                  <span>
                    {periodoInicioFormatado} até {periodoFimFormatado}
                  </span>
                </div>
                <Button variant="outline" onClick={copiarPanorama} className="flex items-center gap-2">
                  <Copy className="h-4 w-4" />
                  Copiar panorama
                </Button>
              </div>

              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold uppercase tracking-wide">
                    Regulações Pendentes
                  </h3>
                  {dadosProcessados.pendentesPorOrigem.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      Atualizado em {format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                    </div>
                  )}
                </div>

                {dadosProcessados.pendentes.length === 0 ? (
                  <p className="rounded-lg border border-dashed bg-muted/40 p-6 text-center text-sm text-muted-foreground">
                    Sem regulações pendentes.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-1 gap-4">
                    {dadosProcessados.pendentesPorOrigem.map((setorInfo, index) => {
                      const setor = setorInfo.setor;
                      const setorTitulo = setor?.siglaSetor || setor?.nomeSetor || 'Setor não identificado';

                      return (
                        <Card key={`${setorTitulo}-${index}`} className="border">
                          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <CardTitle className="text-base font-semibold">
                                {setorTitulo}
                              </CardTitle>
                              <p className="text-xs text-muted-foreground">
                                {setor?.nomeSetor && setor?.siglaSetor
                                  ? `${setor.siglaSetor} · ${setor.nomeSetor}`
                                  : setor?.nomeSetor || 'Origem não informada'}
                              </p>
                            </div>
                            <Badge variant="secondary">{setorInfo.regulacoes.length}</Badge>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            {setorInfo.regulacoes.map((item) => {
                              const destino = item.setorDestino?.siglaSetor || item.setorDestino?.nomeSetor || 'Destino não informado';
                              const origem = item.setorOrigem?.siglaSetor || item.setorOrigem?.nomeSetor || 'Origem não informada';
                              const leitoOrigem = item.leitoOrigem?.codigoLeito || 'Leito origem?';
                              const leitoDestino = item.leitoDestino?.codigoLeito || 'Leito destino?';
                              return (
                                <div
                                  key={item.paciente?.id || `${origem}-${destino}-${leitoOrigem}`}
                                  className="rounded-lg border bg-muted/30 p-3 text-sm"
                                >
                                  <div className="flex flex-col gap-1">
                                    <span className="font-semibold">{item.paciente?.nomePaciente || 'Paciente'}</span>
                                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                      <MapPin className="h-3 w-3" />
                                      <span>{origem} · {leitoOrigem}</span>
                                      <span className="text-muted-foreground">→</span>
                                      <span>{destino} · {leitoDestino}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                      <Clock className="h-3 w-3" />
                                      <span>Tempo de espera: {item.tempoEsperaTexto}</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </section>

              <Separator />

              <section className="space-y-4">
                <h3 className="text-lg font-semibold uppercase tracking-wide">Resumo do Período</h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-lg border bg-muted/40 p-4">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Total</p>
                    <p className="text-2xl font-semibold">{dadosProcessados.resumoPeriodo.total}</p>
                  </div>
                  <div className="rounded-lg border bg-muted/40 p-4">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Concluídas</p>
                    <p className="text-2xl font-semibold text-emerald-600">
                      {dadosProcessados.resumoPeriodo.concluidas}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-muted/40 p-4">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Canceladas</p>
                    <p className="text-2xl font-semibold text-destructive">
                      {dadosProcessados.resumoPeriodo.canceladas}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-muted/40 p-4">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Pendentes</p>
                    <p className="text-2xl font-semibold text-amber-600">
                      {dadosProcessados.resumoPeriodo.pendentes}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-muted/40 p-4 sm:col-span-2 lg:col-span-4">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Alteradas</p>
                    <p className="text-2xl font-semibold">
                      {dadosProcessados.resumoPeriodo.alteradas}
                    </p>
                  </div>
                </div>
              </section>

              <Separator />

              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold uppercase tracking-wide">Detalhamento do Período</h3>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>{dadosProcessados.historicoRegulacoes.length} registros encontrados</span>
                  </div>
                </div>

                {dadosProcessados.historicoRegulacoes.length === 0 ? (
                  <p className="rounded-lg border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                    Nenhuma regulação registrada neste período.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {dadosProcessados.historicoRegulacoes.map((item) => {
                      const statusNormalizado = normalizarTexto(item.statusFinal);
                      const origemSigla = item.setorOrigemSigla || 'Setor origem não informado';
                      const leitoOrigem = item.leitoOrigemNome || 'Leito origem não informado';
                      const destinoSigla = item.setorDestinoSigla || 'Setor destino não informado';
                      const leitoDestino = item.leitoDestinoNome || 'Leito destino não informado';
                      const destinoFinalSigla = item.setorDestinoFinalSigla || destinoSigla;
                      const leitoDestinoFinal = item.leitoDestinoFinalNome || leitoDestino;
                      const destinoLinha =
                        statusNormalizado === 'alterada' ? (
                          <>
                            <span>
                              {origemSigla} {leitoOrigem}
                            </span>
                            <span className="text-muted-foreground">→</span>
                            <span>
                              {destinoSigla} {leitoDestino}
                            </span>
                            <span className="text-muted-foreground">→</span>
                            <span className="font-semibold text-foreground">
                              {destinoFinalSigla} {leitoDestinoFinal}
                            </span>
                          </>
                        ) : (
                          <>
                            <span>
                              {origemSigla} {leitoOrigem}
                            </span>
                            <span className="text-muted-foreground">→</span>
                            <span>
                              {destinoSigla} {leitoDestino}
                            </span>
                          </>
                        );
                      const tempoTotalTexto = Number.isFinite(item.tempoRegulacaoMinutos)
                        ? `${item.tempoRegulacaoMinutos} min`
                        : 'Não informado';

                      return (
                        <Card key={item.id} className="border">
                          <CardHeader className="space-y-1">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              <CardTitle className="text-base font-semibold">
                                {item.pacienteNome}
                              </CardTitle>
                              <Badge variant={tipoBadgeVariant(item.tipo)}>
                                {item.tipo || 'Tipo não informado'}
                              </Badge>
                            </div>
                            <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                              {item.paciente?.nomeSocial && (
                                <span>Nome social: {item.paciente.nomeSocial}</span>
                              )}
                              <span>Responsável: {item.usuarioNome}</span>
                              {item.statusFinal && <span>Status: {item.statusFinal}</span>}
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-3 text-sm">
                            <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
                              <MapPin className="h-4 w-4" />
                              {destinoLinha}
                            </div>
                            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                              <div className="flex items-center gap-2">
                                <CalendarRange className="h-4 w-4" />
                                <span>
                                  Início:{' '}
                                  {item.dataInicio ? formatDateTime(item.dataInicio) : 'Não informado'}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4" />
                                <span>Tempo total: {tempoTotalTexto}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Users className="h-4 w-4" />
                                <span>Registrado por: {item.usuarioNome}</span>
                              </div>
                            </div>
                            {statusNormalizado === 'cancelada' && item.motivoCancelamento && (
                              <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                                Motivo do cancelamento: {item.motivoCancelamento}
                              </div>
                            )}
                            {item.alteracoes.length > 0 && (
                              <div className="space-y-2 rounded-md border bg-muted/30 p-3 text-xs">
                                <p className="font-semibold uppercase text-muted-foreground">Alterações registradas</p>
                                {item.alteracoes.map((alteracao, index) => (
                                  <div key={index} className="space-y-1">
                                    <p className="font-medium text-foreground">
                                      {alteracao.destinoDescricao || 'Destino não informado'}
                                    </p>
                                    <div className="flex flex-wrap gap-2 text-muted-foreground">
                                      <span>{alteracao.timestamp ? formatDateTime(alteracao.timestamp) : 'Data não informada'}</span>
                                      {alteracao.motivo && <span>· Motivo: {alteracao.motivo}</span>}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PanoramaRegulacoesModal;
