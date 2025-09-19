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
  getAuditoriaCollection,
  getPacientesCollection,
  getLeitosCollection,
  getSetoresCollection,
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

const formatMinutesToLabel = (minutes) => {
  if (!Number.isFinite(minutes) || minutes < 0) return '-';
  const horas = Math.floor(minutes / 60);
  const mins = Math.floor(minutes % 60);
  const partes = [];
  if (horas > 0) partes.push(`${horas}h`);
  partes.push(`${mins.toString().padStart(2, '0')}min`);
  return partes.join(' ');
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

  const leitosPorId = new Map(dados.leitos.map((leito) => [leito.id, leito]));
  const setoresPorId = new Map(dados.setores.map((setor) => [setor.id, setor]));
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
        ? leitosPorId.get(regulacaoAtiva.leitoOrigemId)
        : null;
      const leitoDestino = regulacaoAtiva?.leitoDestinoId
        ? leitosPorId.get(regulacaoAtiva.leitoDestinoId)
        : null;
      const setorOrigem = leitoOrigem?.setorId ? setoresPorId.get(leitoOrigem.setorId) : null;
      const setorDestino = regulacaoAtiva?.setorDestinoId
        ? setoresPorId.get(regulacaoAtiva.setorDestinoId)
        : leitoDestino?.setorId
          ? setoresPorId.get(leitoDestino.setorId)
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

  const logsOrdenados = [...dados.logs]
    .filter((log) => log.timestamp)
    .sort((a, b) => {
      const aTime = a.timestamp ? a.timestamp.getTime() : 0;
      const bTime = b.timestamp ? b.timestamp.getTime() : 0;
      return aTime - bTime;
    });

  const historicoPorPaciente = {};

  logsOrdenados.forEach((log) => {
    const detalhes = analisarLogRegulacao(log.acao);
    if (!detalhes) return;

    const pacienteInfo = identificarPacienteLog(log, detalhes, pacientesPorId, pacientesPorNome);
    const chave = pacienteInfo.pacienteId
      ? `id:${pacienteInfo.pacienteId}`
      : `nome:${normalizarTexto(pacienteInfo.pacienteNome)}`;

    if (!historicoPorPaciente[chave]) {
      historicoPorPaciente[chave] = {
        pacienteId: pacienteInfo.pacienteId,
        pacienteNome: pacienteInfo.pacienteNome,
        regulacoes: [],
      };
    }

    const lista = historicoPorPaciente[chave].regulacoes;
    let atual = lista[lista.length - 1];
    if (!atual || atual.statusFinal) {
      atual = null;
    }

    if (detalhes.tipo === 'inicio') {
      const nova = {
        id: `${chave}-${lista.length + 1}`,
        pacienteId: pacienteInfo.pacienteId,
        pacienteNome: pacienteInfo.pacienteNome,
        inicio: log.timestamp || null,
        origemDescricao: detalhes.origem,
        destinoDescricao: detalhes.destino,
        alteracoes: [],
        statusFinal: null,
        fim: null,
        tempoTotalMinutos: null,
        motivoCancelamento: null,
      };
      lista.push(nova);
      return;
    }

    if (!atual) {
      atual = {
        id: `${chave}-${lista.length + 1}`,
        pacienteId: pacienteInfo.pacienteId,
        pacienteNome: pacienteInfo.pacienteNome,
        inicio: null,
        origemDescricao: detalhes.origem,
        destinoDescricao: detalhes.destino,
        alteracoes: [],
        statusFinal: null,
        fim: null,
        tempoTotalMinutos: null,
        motivoCancelamento: null,
      };
      lista.push(atual);
    }

    if (detalhes.tipo === 'alteracao') {
      if (detalhes.destino) {
        atual.destinoDescricao = detalhes.destino;
      }
      atual.alteracoes.push({
        timestamp: log.timestamp || null,
        destinoDescricao: detalhes.destino,
        motivo: detalhes.motivo,
      });
    } else if (detalhes.tipo === 'conclusao') {
      atual.statusFinal = 'Concluída';
      atual.fim = log.timestamp || null;
      if (!atual.inicio) {
        atual.inicio = log.timestamp || null;
      }
      if (atual.inicio && atual.fim) {
        const diff = atual.fim.getTime() - atual.inicio.getTime();
        if (Number.isFinite(diff) && diff >= 0) {
          atual.tempoTotalMinutos = Math.round(diff / 60000);
        }
      }
    } else if (detalhes.tipo === 'cancelamento') {
      atual.statusFinal = 'Cancelada';
      atual.fim = log.timestamp || null;
      atual.motivoCancelamento = detalhes.motivo;
      if (!atual.inicio) {
        atual.inicio = log.timestamp || null;
      }
      if (atual.inicio && atual.fim) {
        const diff = atual.fim.getTime() - atual.inicio.getTime();
        if (Number.isFinite(diff) && diff >= 0) {
          atual.tempoTotalMinutos = Math.round(diff / 60000);
        }
      }
    }
  });

  const historicoRegulacoes = Object.values(historicoPorPaciente).flatMap((item) =>
    item.regulacoes.map((regulacao) => {
      const paciente = regulacao.pacienteId ? pacientesPorId.get(regulacao.pacienteId) : null;
      const statusFinal = regulacao.statusFinal || 'Pendente';
      let tempoTotalMinutos = regulacao.tempoTotalMinutos;

      if (statusFinal === 'Pendente' && regulacao.inicio && periodoFim) {
        const diff = periodoFim.getTime() - regulacao.inicio.getTime();
        if (Number.isFinite(diff) && diff >= 0) {
          tempoTotalMinutos = Math.round(diff / 60000);
        }
      }

      return {
        ...regulacao,
        paciente,
        statusFinal,
        tempoTotalMinutos,
      };
    })
  );

  historicoRegulacoes.sort((a, b) => {
    const aTime = a.inicio ? a.inicio.getTime() : 0;
    const bTime = b.inicio ? b.inicio.getTime() : 0;
    return bTime - aTime;
  });

  const resumoPeriodo = {
    concluidas: historicoRegulacoes.filter((item) => item.statusFinal === 'Concluída').length,
    canceladas: historicoRegulacoes.filter((item) => item.statusFinal === 'Cancelada').length,
    pendentes: historicoRegulacoes.filter((item) => {
      if (item.statusFinal !== 'Pendente') return false;
      if (!periodoInicio || !periodoFim || !item.inicio) return false;
      const inicioTime = item.inicio.getTime();
      return inicioTime >= periodoInicio.getTime() && inicioTime <= periodoFim.getTime();
    }).length,
    alteradas: historicoRegulacoes.reduce((acc, item) => acc + (item.alteracoes?.length || 0), 0),
  };
  resumoPeriodo.total = resumoPeriodo.concluidas + resumoPeriodo.canceladas + resumoPeriodo.pendentes;

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
    logs: [],
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

        const auditoriaQuery = query(
          getAuditoriaCollection(),
          where('pagina', '==', 'Regulação de Leitos'),
          where('timestamp', '>=', periodoInicio),
          where('timestamp', '<=', periodoFim),
          orderBy('timestamp', 'asc'),
        );

        const [auditoriaSnapshot, pacientesSnapshot, leitosSnapshot, setoresSnapshot] = await Promise.all([
          getDocs(auditoriaQuery),
          getDocs(getPacientesCollection()),
          getDocs(getLeitosCollection()),
          getDocs(getSetoresCollection()),
        ]);

        if (!ativo) return;

        const logs = auditoriaSnapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            timestamp: data.timestamp ? parseDate(data.timestamp) : null,
          };
        });

        const pacientes = pacientesSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        const leitos = leitosSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        const setores = setoresSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

        setDados({
          loading: false,
          logs,
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

  const statusBadgeVariant = (status) => {
    if (status === 'Concluída') return 'default';
    if (status === 'Cancelada') return 'destructive';
    return 'outline';
  };

  const copiarPendentes = async (setorInfo) => {
    const setorNome = setorInfo?.setor?.nomeSetor || setorInfo?.setor?.siglaSetor || 'Setor não identificado';
    const sigla = setorInfo?.setor?.siglaSetor ? ` - ${setorInfo.setor.siglaSetor}` : '';
    const linhas = [`*REGULAÇÕES PENDENTES${sigla}*`, `_Período:_ ${periodoInicioFormatado} - ${periodoFimFormatado}`, ''];

    setorInfo.regulacoes.forEach((item, index) => {
      const destino = item.setorDestino?.siglaSetor || item.setorDestino?.nomeSetor || 'Destino não informado';
      const origem = item.setorOrigem?.siglaSetor || item.setorOrigem?.nomeSetor || 'Origem não informada';
      const leitoOrigem = item.leitoOrigem?.codigoLeito || 'Leito origem?';
      const leitoDestino = item.leitoDestino?.codigoLeito || 'Leito destino?';
      const pacienteNome = item.paciente?.nomePaciente || 'Paciente';

      linhas.push(`${index + 1}. *${pacienteNome}*`);
      linhas.push(`   _${origem}_ - ${leitoOrigem} → _${destino}_ - ${leitoDestino}`);
      linhas.push(`   Tempo de espera: _${item.tempoEsperaTexto}_`);
      linhas.push('');
    });

    linhas.push(`Total pendentes no setor ${setorNome}: ${setorInfo.regulacoes.length}`);

    try {
      if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
        throw new Error('Clipboard API indisponível');
      }
      await navigator.clipboard.writeText(linhas.join('\n'));
      toast({
        title: 'Resumo copiado',
        description: `Panorama de pendências do setor ${setorNome} copiado com sucesso.`,
      });
    } catch (error) {
      toast({
        title: 'Erro ao copiar',
        description: 'Não foi possível copiar as informações. Tente novamente.',
        variant: 'destructive',
      });
    }
  };

  const copiarRelatorioCompleto = async () => {
    const { pendentesPorOrigem, historicoRegulacoes, resumoPeriodo } = dadosProcessados;
    const linhas = [
      '*PANORAMA DE REGULAÇÕES*',
      `_Período:_ ${periodoInicioFormatado} - ${periodoFimFormatado}`,
      '',
      '*Resumo do período*',
      `- Total: ${resumoPeriodo.total}`,
      `- Concluídas: ${resumoPeriodo.concluidas}`,
      `- Canceladas: ${resumoPeriodo.canceladas}`,
      `- Pendentes: ${resumoPeriodo.pendentes}`,
      `- Alterações registradas: ${resumoPeriodo.alteradas}`,
      '',
      '*Regulações pendentes*',
    ];

    if (!pendentesPorOrigem.length) {
      linhas.push('Sem regulações pendentes no momento.');
    } else {
      pendentesPorOrigem.forEach((setorInfo) => {
        const setorNome = setorInfo?.setor?.siglaSetor || setorInfo?.setor?.nomeSetor || 'Setor não identificado';
        linhas.push(`• ${setorNome}: ${setorInfo.regulacoes.length} pendentes`);
        setorInfo.regulacoes.forEach((item) => {
          const destino = item.setorDestino?.siglaSetor || item.setorDestino?.nomeSetor || 'Destino não informado';
          const origem = item.setorOrigem?.siglaSetor || item.setorOrigem?.nomeSetor || 'Origem não informada';
          const leitoOrigem = item.leitoOrigem?.codigoLeito || 'Leito origem?';
          const leitoDestino = item.leitoDestino?.codigoLeito || 'Leito destino?';
          const pacienteNome = item.paciente?.nomePaciente || 'Paciente';

          linhas.push(`   - ${pacienteNome}: ${origem} - ${leitoOrigem} → ${destino} - ${leitoDestino} (_${item.tempoEsperaTexto}_ )`);
        });
      });
    }

    linhas.push('', '*Histórico do período*');

    if (!historicoRegulacoes.length) {
      linhas.push('Nenhum registro de regulação encontrado para o período.');
    } else {
      historicoRegulacoes.forEach((item, index) => {
        linhas.push(`${index + 1}. *${item.pacienteNome}*`);
        const origem = item.origemDescricao || 'Origem não informada';
        const destino = item.destinoDescricao || 'Destino não informado';
        linhas.push(`   ${origem} → ${destino}`);
        linhas.push(`   Início: ${item.inicio ? formatDateTime(item.inicio) : 'Não informado'}`);
        linhas.push(`   Status: ${item.statusFinal}`);
        linhas.push(`   Tempo total: ${formatMinutesToLabel(item.tempoTotalMinutos)}`);
        if (item.motivoCancelamento) {
          linhas.push(`   Motivo do cancelamento: ${item.motivoCancelamento}`);
        }
        if (item.alteracoes.length) {
          linhas.push('   Alterações:');
          item.alteracoes.forEach((alteracao, idx) => {
            linhas.push(`     ${idx + 1}) ${alteracao.destinoDescricao || 'Destino não informado'} - ${alteracao.timestamp ? formatDateTime(alteracao.timestamp) : 'Data não informada'}`);
            if (alteracao.motivo) {
              linhas.push(`        Motivo: ${alteracao.motivo}`);
            }
          });
        }
        linhas.push('');
      });
    }

    try {
      if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
        throw new Error('Clipboard API indisponível');
      }
      await navigator.clipboard.writeText(linhas.join('\n'));
      toast({
        title: 'Panorama copiado',
        description: 'Relatório completo copiado para a área de transferência.',
      });
    } catch (error) {
      toast({
        title: 'Erro ao copiar',
        description: 'Não foi possível copiar o relatório completo.',
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
                <Button variant="outline" onClick={copiarRelatorioCompleto} className="flex items-center gap-2">
                  <Copy className="h-4 w-4" />
                  Copiar relatório completo
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
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary">{setorInfo.regulacoes.length}</Badge>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => copiarPendentes(setorInfo)}
                                className="flex items-center gap-1"
                              >
                                <Copy className="h-3 w-3" />
                                Copiar
                              </Button>
                            </div>
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
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Alterações registradas</p>
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
                    {dadosProcessados.historicoRegulacoes.map((item) => (
                      <Card key={item.id} className="border">
                        <CardHeader className="space-y-1">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <CardTitle className="text-base font-semibold">
                              {item.pacienteNome}
                            </CardTitle>
                            <Badge variant={statusBadgeVariant(item.statusFinal)}>{item.statusFinal}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {item.paciente?.nomeSocial ? `Nome social: ${item.paciente.nomeSocial}` : ''}
                          </p>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm">
                          <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
                            <MapPin className="h-4 w-4" />
                            <span>{item.origemDescricao || 'Origem não informada'}</span>
                            <span className="text-muted-foreground">→</span>
                            <span>{item.destinoDescricao || 'Destino não informado'}</span>
                          </div>
                          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-2">
                              <CalendarRange className="h-4 w-4" />
                              <span>Início: {item.inicio ? formatDateTime(item.inicio) : 'Não informado'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4" />
                              <span>Tempo total: {formatMinutesToLabel(item.tempoTotalMinutos)}</span>
                            </div>
                          </div>
                          {item.motivoCancelamento && (
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
                    ))}
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
