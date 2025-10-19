import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { Copy, Loader2, AlertCircle, CalendarRange, Clock, MapPin, Users, ClipboardList } from 'lucide-react';
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
import { differenceInMinutes, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const STATUS_CONFIG = {
  concluida: {
    label: 'Concluída',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  },
  cancelada: {
    label: 'Cancelada',
    className: 'border-destructive/40 bg-destructive/10 text-destructive',
  },
  em_andamento: {
    label: 'Em andamento',
    className: 'border-amber-200 bg-amber-50 text-amber-700',
  },
  alterada: {
    label: 'Alterada',
    className: 'border-sky-200 bg-sky-50 text-sky-700',
  },
};

const formatMinutesToHours = (minutes) => {
  if (!Number.isFinite(minutes) || minutes < 0) return null;
  if (minutes === 0) return '0 min';
  const horas = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  const partes = [];
  if (horas > 0) partes.push(`${horas}h`);
  if (mins > 0) partes.push(`${mins}min`);
  return partes.join(' ');
};

const parseDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === 'function') {
    return value.toDate();
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDateTime = (date) => {
  if (!date) return 'Não informado';
  return format(date, 'dd/MM/yyyy HH:mm', { locale: ptBR });
};

const normalizarStatus = (valor) => {
  if (!valor) return '';
  return String(valor)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
};

const normalizarPeriodo = (periodo) => {
  if (!periodo) return { inicio: null, fim: null };
  const inicio = periodo.inicio instanceof Date ? periodo.inicio : periodo?.inicio ? new Date(periodo.inicio) : null;
  const fim = periodo.fim instanceof Date ? periodo.fim : periodo?.fim ? new Date(periodo.fim) : null;
  return { inicio, fim };
};

const estaNoPeriodo = (periodo, datas) => {
  if (!periodo?.inicio && !periodo?.fim) return true;
  const inicioMs = periodo?.inicio?.getTime() ?? null;
  const fimMs = periodo?.fim?.getTime() ?? null;

  return datas.some((data) => {
    if (!data) return false;
    const time = data.getTime();
    if (inicioMs && time < inicioMs) return false;
    if (fimMs && time > fimMs) return false;
    return true;
  });
};

const resolveLocal = ({
  leitosMap,
  setoresMap,
  leitoId,
  setorId,
  fallbackLeito,
  fallbackSetorSigla,
  fallbackSetorNome,
}) => {
  const leito = leitoId ? leitosMap.get(leitoId) : null;
  const setorFromLeito = leito?.setorId ? setoresMap.get(leito.setorId) : null;
  const setor = setorId ? setoresMap.get(setorId) || setorFromLeito : setorFromLeito;

  const setorDescricao =
    setor?.siglaSetor ||
    setor?.nomeSetor ||
    fallbackSetorSigla ||
    fallbackSetorNome ||
    (setorId ? String(setorId) : null) ||
    'Setor não informado';

  const leitoDescricao =
    leito?.codigoLeito ||
    leito?.codigo ||
    fallbackLeito ||
    (leitoId ? String(leitoId) : null) ||
    'Leito não informado';

  return {
    setor: setorDescricao,
    leito: leitoDescricao,
    setorId: setor?.id || setorId || null,
    leitoId: leito?.id || leitoId || null,
  };
};

const mapAlteracoes = (alteracoes, { leitosMap, setoresMap }) => {
  if (!Array.isArray(alteracoes)) return [];

  return alteracoes
    .map((alteracao, index) => {
      const timestamp = parseDate(
        alteracao?.timestamp || alteracao?.data || alteracao?.ocorreuEm || alteracao?.atualizadoEm
      );

      const origem = resolveLocal({
        leitosMap,
        setoresMap,
        leitoId:
          alteracao?.deLeitoId ||
          alteracao?.leitoAnteriorId ||
          alteracao?.leitoOrigemId ||
          alteracao?.leitoAnterior?.id ||
          null,
        setorId: alteracao?.deSetorId || alteracao?.setorAnteriorId || alteracao?.setorOrigemId || null,
        fallbackLeito:
          alteracao?.deLeitoCodigo ||
          alteracao?.leitoAnteriorCodigo ||
          alteracao?.leitoAnterior ||
          alteracao?.origemDescricao ||
          null,
        fallbackSetorSigla: alteracao?.deSetorSigla || alteracao?.setorAnteriorSigla || null,
        fallbackSetorNome: alteracao?.deSetorNome || alteracao?.setorAnteriorNome || null,
      });

      const destino = resolveLocal({
        leitosMap,
        setoresMap,
        leitoId:
          alteracao?.paraLeitoId ||
          alteracao?.leitoDestinoId ||
          alteracao?.leitoDestino?.id ||
          null,
        setorId: alteracao?.paraSetorId || alteracao?.setorDestinoId || alteracao?.setorDestino?.id || null,
        fallbackLeito:
          alteracao?.paraLeitoCodigo ||
          alteracao?.leitoDestinoCodigo ||
          alteracao?.leitoDestino ||
          alteracao?.destinoDescricao ||
          null,
        fallbackSetorSigla: alteracao?.paraSetorSigla || null,
        fallbackSetorNome: alteracao?.paraSetorNome || null,
      });

      return {
        id: `${index}-${timestamp?.getTime() ?? 'sem-data'}`,
        timestamp,
        justificativa: alteracao?.justificativa || alteracao?.motivo || alteracao?.motivoAlteracao || null,
        realizadoPor: alteracao?.realizadoPor || alteracao?.usuario || alteracao?.usuarioNome || null,
        origem,
        destino,
      };
    })
    .sort((a, b) => (a.timestamp?.getTime() ?? 0) - (b.timestamp?.getTime() ?? 0));
};

const criarChaveRegulacao = (registro) => {
  const pacienteRef = registro?.pacienteId || registro?.pacienteNome || 'paciente';
  const inicio = registro?.dataInicio ? registro.dataInicio.toISOString() : 'sem-inicio';
  return `${pacienteRef}-${inicio}`;
};

const construirEventosLinhaTempo = (registro) => {
  const eventos = [];

  if (registro.dataInicio) {
    eventos.push({
      tipo: 'inicio',
      titulo: 'Regulação iniciada',
      data: registro.dataInicio,
      descricao: `${registro.origem.setor} · ${registro.origem.leito} → ${registro.destino.setor} · ${registro.destino.leito}`,
    });
  }

  registro.alteracoes.forEach((alteracao) => {
    eventos.push({
      tipo: 'alteracao',
      titulo: 'Alteração de destino',
      data: alteracao.timestamp,
      descricao: `De ${alteracao.origem.setor} · ${alteracao.origem.leito} para ${alteracao.destino.setor} · ${alteracao.destino.leito}`,
      justificativa: alteracao.justificativa || null,
      realizadoPor: alteracao.realizadoPor || null,
    });
  });

  if (registro.status === 'concluida' && registro.dataConclusao) {
    eventos.push({
      tipo: 'conclusao',
      titulo: 'Regulação concluída',
      data: registro.dataConclusao,
      descricao: `Tempo total: ${registro.tempoTotalFormatado || 'Não informado'}. Destino final: ${registro.destinoFinal.setor} · ${registro.destinoFinal.leito}`,
    });
  }

  if (registro.status === 'cancelada' && registro.dataCancelamento) {
    eventos.push({
      tipo: 'cancelamento',
      titulo: 'Regulação cancelada',
      data: registro.dataCancelamento,
      descricao: registro.motivoCancelamento
        ? `Motivo: ${registro.motivoCancelamento}`
        : 'Motivo não informado',
    });
  }

  return eventos.sort((a, b) => (a.data?.getTime() ?? 0) - (b.data?.getTime() ?? 0));
};

const montarPanoramaRegulacoes = (dados, periodo) => {
  if (!dados || dados.loading) {
    return {
      registros: [],
      resumo: {
        total: 0,
        concluidas: 0,
        canceladas: 0,
        emAndamento: 0,
        comAlteracao: 0,
      },
    };
  }

  const periodoNormalizado = normalizarPeriodo(periodo);

  const leitosMap = new Map(dados.leitos.map((item) => [item.id, item]));
  const setoresMap = new Map(dados.setores.map((item) => [item.id, item]));
  const pacientesMap = new Map(dados.pacientes.map((item) => [item.id, item]));

  const registros = [];
  const chavesRegistradas = new Set();

  (dados.historicoRegulacoes || []).forEach((registro) => {
    const dataInicio = parseDate(
      registro?.dataInicio || registro?.iniciadoEm || registro?.criadoEm || registro?.createdAt
    );
    const dataConclusao = parseDate(
      registro?.dataConclusao || registro?.concluidoEm || registro?.finalizadoEm || registro?.finalizadoEm
    );
    const dataCancelamento = parseDate(registro?.dataCancelamento || registro?.canceladoEm);

    if (!estaNoPeriodo(periodoNormalizado, [dataInicio, dataConclusao, dataCancelamento])) {
      return;
    }

    const paciente = registro?.pacienteId ? pacientesMap.get(registro.pacienteId) : null;
    const pacienteNome =
      registro?.pacienteNome ||
      paciente?.nomePaciente ||
      paciente?.nomeCompleto ||
      paciente?.nome ||
      'Paciente não identificado';

    const origem = resolveLocal({
      leitosMap,
      setoresMap,
      leitoId:
        registro?.leitoOrigemId ||
        registro?.leitoAnteriorId ||
        registro?.leitoOrigem?.id ||
        registro?.leitoAnterior?.id ||
        null,
      setorId: registro?.setorOrigemId || registro?.setorOrigem?.id || null,
      fallbackLeito:
        registro?.origemDescricao ||
        registro?.leitoOrigem?.codigoLeito ||
        registro?.leitoAnterior?.codigoLeito ||
        registro?.leitoOrigemNome ||
        null,
      fallbackSetorSigla: registro?.setorOrigem?.siglaSetor || null,
      fallbackSetorNome: registro?.setorOrigem?.nomeSetor || null,
    });

    const destinoPrimario = resolveLocal({
      leitosMap,
      setoresMap,
      leitoId: registro?.leitoDestinoId || registro?.leitoDestino?.id || null,
      setorId: registro?.setorDestinoId || registro?.setorDestino?.id || null,
      fallbackLeito:
        registro?.destinoDescricao ||
        registro?.leitoDestino?.codigoLeito ||
        registro?.leitoDestinoNome ||
        null,
      fallbackSetorSigla: registro?.setorDestino?.siglaSetor || null,
      fallbackSetorNome: registro?.setorDestino?.nomeSetor || null,
    });

    const destinoFinal = resolveLocal({
      leitosMap,
      setoresMap,
      leitoId:
        registro?.leitoDestinoFinalId ||
        registro?.leitoDestinoFinal?.id ||
        registro?.leitoDestinoId ||
        registro?.leitoDestino?.id ||
        null,
      setorId:
        registro?.setorDestinoFinalId ||
        registro?.setorDestinoFinal?.id ||
        registro?.setorDestinoId ||
        registro?.setorDestino?.id ||
        null,
      fallbackLeito:
        registro?.leitoDestinoFinal?.codigoLeito ||
        registro?.leitoDestinoFinalNome ||
        registro?.leitoDestino?.codigoLeito ||
        registro?.destinoDescricao ||
        null,
      fallbackSetorSigla:
        registro?.setorDestinoFinal?.siglaSetor ||
        registro?.setorDestino?.siglaSetor ||
        null,
      fallbackSetorNome:
        registro?.setorDestinoFinal?.nomeSetor ||
        registro?.setorDestino?.nomeSetor ||
        null,
    });

    const alteracoes = mapAlteracoes(registro?.alteracoes, { leitosMap, setoresMap });
    const temAlteracao = alteracoes.length > 0;

    const statusNormalizado = normalizarStatus(
      registro?.statusFinal || registro?.status || registro?.resultado || registro?.statusAtual
    );

    let status = 'em_andamento';
    if (dataCancelamento || statusNormalizado.includes('cancel')) {
      status = 'cancelada';
    } else if (dataConclusao || statusNormalizado.includes('conclu')) {
      status = 'concluida';
    } else if (statusNormalizado.includes('alter')) {
      status = temAlteracao ? 'alterada' : 'em_andamento';
    }

    if (status === 'alterada' && (dataConclusao || statusNormalizado.includes('conclu'))) {
      status = 'concluida';
    }

    const tempoTotalMinutos =
      status === 'concluida' && dataInicio && dataConclusao
        ? Math.max(Math.round((dataConclusao.getTime() - dataInicio.getTime()) / 60000), 0)
        : null;

    const tempoDecorridoMinutos =
      status === 'em_andamento' && dataInicio
        ? Math.max(Math.round((Date.now() - dataInicio.getTime()) / 60000), 0)
        : null;

    const registroPanorama = {
      id: registro?.id || `${registro?.pacienteId || 'sem-id'}-${dataInicio?.getTime() || 'sem-data'}`,
      chave: `${registro?.id || registro?.pacienteId || 'sem-id'}-${dataInicio?.getTime() || 'sem-data'}`,
      pacienteId: registro?.pacienteId || paciente?.id || null,
      pacienteNome,
      nomeSocial: paciente?.nomeSocial || registro?.pacienteNomeSocial || null,
      status,
      statusLabel: STATUS_CONFIG[status]?.label || (registro?.statusFinal || 'Status não informado'),
      statusBadgeClass: STATUS_CONFIG[status]?.className || STATUS_CONFIG.em_andamento.className,
      dataInicio,
      dataConclusao,
      dataCancelamento,
      tempoTotalMinutos,
      tempoTotalFormatado: tempoTotalMinutos != null ? formatMinutesToHours(tempoTotalMinutos) : null,
      tempoDecorridoMinutos,
      tempoDecorridoFormatado: tempoDecorridoMinutos != null ? formatMinutesToHours(tempoDecorridoMinutos) : null,
      origem,
      destino: destinoPrimario,
      destinoFinal,
      alteracoes,
      temAlteracao,
      motivoCancelamento:
        registro?.motivoCancelamento || registro?.motivo || registro?.justificativaCancelamento || null,
      usuarioResponsavel:
        registro?.usuarioNome ||
        registro?.usuario?.displayName ||
        registro?.usuario?.nome ||
        registro?.usuario?.nomeCompleto ||
        registro?.usuarioResponsavel ||
        null,
    };

    registroPanorama.eventos = construirEventosLinhaTempo(registroPanorama);

    const chave = criarChaveRegulacao(registroPanorama);
    chavesRegistradas.add(chave);
    registros.push(registroPanorama);
  });

  (dados.pacientes || [])
    .filter((paciente) => paciente?.regulacaoAtiva)
    .forEach((paciente) => {
      const regulacao = paciente.regulacaoAtiva;
      const dataInicio = parseDate(regulacao?.iniciadoEm || regulacao?.criadoEm);

      if (!estaNoPeriodo(periodoNormalizado, [dataInicio])) {
        return;
      }

      const origem = resolveLocal({
        leitosMap,
        setoresMap,
        leitoId: regulacao?.leitoOrigemId || null,
        setorId: regulacao?.setorOrigemId || null,
        fallbackLeito: regulacao?.leitoOrigemCodigo || regulacao?.leitoOrigemNome || null,
        fallbackSetorSigla: regulacao?.setorOrigemSigla || null,
        fallbackSetorNome: regulacao?.setorOrigemNome || null,
      });

      const destino = resolveLocal({
        leitosMap,
        setoresMap,
        leitoId: regulacao?.leitoDestinoId || null,
        setorId: regulacao?.setorDestinoId || null,
        fallbackLeito: regulacao?.leitoDestinoCodigo || regulacao?.leitoDestinoNome || null,
        fallbackSetorSigla: regulacao?.setorDestinoSigla || null,
        fallbackSetorNome: regulacao?.setorDestinoNome || null,
      });

      const tempoDecorridoMinutos = dataInicio
        ? Math.max(Math.round((Date.now() - dataInicio.getTime()) / 60000), 0)
        : null;

      const registroPanorama = {
        id: `ativo-${paciente.id}`,
        chave: `${paciente.id}-${dataInicio?.getTime() || 'sem-data'}`,
        pacienteId: paciente.id,
        pacienteNome: paciente?.nomePaciente || paciente?.nomeCompleto || paciente?.nome || 'Paciente',
        nomeSocial: paciente?.nomeSocial || null,
        status: 'em_andamento',
        statusLabel: STATUS_CONFIG.em_andamento.label,
        statusBadgeClass: STATUS_CONFIG.em_andamento.className,
        dataInicio,
        dataConclusao: null,
        dataCancelamento: null,
        tempoTotalMinutos: null,
        tempoTotalFormatado: null,
        tempoDecorridoMinutos,
        tempoDecorridoFormatado: tempoDecorridoMinutos != null ? formatMinutesToHours(tempoDecorridoMinutos) : null,
        origem,
        destino,
        destinoFinal: destino,
        alteracoes: [],
        temAlteracao: false,
        motivoCancelamento: null,
        usuarioResponsavel: regulacao?.usuarioResponsavel || regulacao?.registradoPor || null,
      };

      registroPanorama.eventos = construirEventosLinhaTempo(registroPanorama);

      const chave = criarChaveRegulacao(registroPanorama);
      if (chave && !chavesRegistradas.has(chave)) {
        registros.push(registroPanorama);
      }
    });

  const registrosOrdenados = registros.sort((a, b) => {
    const aTime = a.dataInicio ? a.dataInicio.getTime() : 0;
    const bTime = b.dataInicio ? b.dataInicio.getTime() : 0;
    if (aTime === bTime) {
      const aFinal = a.dataConclusao || a.dataCancelamento || null;
      const bFinal = b.dataConclusao || b.dataCancelamento || null;
      return (bFinal?.getTime() ?? 0) - (aFinal?.getTime() ?? 0);
    }
    return bTime - aTime;
  });

  const resumo = {
    total: registrosOrdenados.length,
    concluidas: registrosOrdenados.filter((item) => item.status === 'concluida').length,
    canceladas: registrosOrdenados.filter((item) => item.status === 'cancelada').length,
    emAndamento: registrosOrdenados.filter((item) => item.status === 'em_andamento').length,
    comAlteracao: registrosOrdenados.filter((item) => item.temAlteracao).length,
  };

  return {
    registros: registrosOrdenados,
    resumo,
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

        const historicoCollection = getHistoricoRegulacoesCollection();

        const historicoPorInicioQuery = query(
          historicoCollection,
          where('dataInicio', '>=', periodoInicio),
          where('dataInicio', '<=', periodoFim),
          orderBy('dataInicio', 'asc')
        );

        const historicoPorConclusaoQuery = query(
          historicoCollection,
          where('dataConclusao', '>=', periodoInicio),
          where('dataConclusao', '<=', periodoFim),
          orderBy('dataConclusao', 'asc')
        );

        const historicoPorCancelamentoQuery = query(
          historicoCollection,
          where('dataCancelamento', '>=', periodoInicio),
          where('dataCancelamento', '<=', periodoFim),
          orderBy('dataCancelamento', 'asc')
        );

        const [
          historicoInicioSnapshot,
          historicoConclusaoSnapshot,
          historicoCancelamentoSnapshot,
          pacientesSnapshot,
          leitosSnapshot,
          setoresSnapshot,
        ] = await Promise.all([
          getDocs(historicoPorInicioQuery),
          getDocs(historicoPorConclusaoQuery),
          getDocs(historicoPorCancelamentoQuery),
          getDocs(getPacientesCollection()),
          getDocs(getLeitosCollection()),
          getDocs(getSetoresCollection()),
        ]);

        if (!ativo) return;

        const historicoMap = new Map();

        [historicoInicioSnapshot, historicoConclusaoSnapshot, historicoCancelamentoSnapshot].forEach((snapshot) => {
          snapshot?.docs?.forEach((doc) => {
            historicoMap.set(doc.id, { id: doc.id, ...doc.data() });
          });
        });

        const pacientes = pacientesSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        const leitos = leitosSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        const setores = setoresSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

        setDados({
          loading: false,
          historicoRegulacoes: Array.from(historicoMap.values()),
          pacientes,
          leitos,
          setores,
          error: null,
        });
      } catch (error) {
        console.error('Erro ao carregar panorama de regulações:', error);
        if (!ativo) return;
        setDados({
          loading: false,
          historicoRegulacoes: [],
          pacientes: [],
          leitos: [],
          setores: [],
          error,
        });
      }
    };

    carregarDados();

    return () => {
      ativo = false;
    };
  }, [isOpen, periodo]);

  const panorama = useMemo(() => montarPanoramaRegulacoes(dados, periodo), [dados, periodo]);

  const periodoInicioFormatado = periodo?.inicio
    ? format(periodo.inicio instanceof Date ? periodo.inicio : new Date(periodo.inicio), "dd/MM/yyyy 'às' HH:mm", {
        locale: ptBR,
      })
    : '-';

  const periodoFimFormatado = periodo?.fim
    ? format(periodo.fim instanceof Date ? periodo.fim : new Date(periodo.fim), "dd/MM/yyyy 'às' HH:mm", {
        locale: ptBR,
      })
    : '-';

  const normalizarData = useCallback((valor) => {
    if (!valor) return null;
    if (valor instanceof Date) return valor;
    if (typeof valor.toDate === 'function') {
      return valor.toDate();
    }
    const data = new Date(valor);
    return Number.isNaN(data.getTime()) ? null : data;
  }, []);

  const formatarDataHoraCompleta = useCallback(
    (data) => (data ? format(data, 'dd/MM/yyyy HH:mm', { locale: ptBR }) : 'Não informado'),
    []
  );

  const formatarDataCurta = useCallback(
    (data) => (data ? format(data, 'dd/MM HH:mm', { locale: ptBR }) : 'N/A'),
    []
  );

  const regulacoesOrdenadas = useMemo(() => {
    const registros = Array.isArray(panorama?.registros) ? panorama.registros : [];

    return registros
      .slice()
      .sort((a, b) => {
        const dataA = normalizarData(a.dataInicio);
        const dataB = normalizarData(b.dataInicio);
        return (dataB?.getTime() ?? 0) - (dataA?.getTime() ?? 0);
      });
  }, [normalizarData, panorama?.registros]);

  const regulacoesPendentes = useMemo(
    () =>
      regulacoesOrdenadas.filter(
        (reg) => !reg.status || reg.status === 'em_andamento' || reg.status === 'alterada'
      ),
    [regulacoesOrdenadas]
  );

  const emAndamentoCount = regulacoesPendentes.length;

  const formatarRegulacaoDetalhada = useCallback(
    (reg, index) => {
      const dataInicio = normalizarData(reg.dataInicio);
      const dataConclusao = normalizarData(reg.dataConclusao);
      const dataCancelamento = normalizarData(reg.dataCancelamento);

      const nomePaciente = reg.pacienteNome ? reg.pacienteNome.toUpperCase() : 'N/A';
      const statusLabel = STATUS_CONFIG[reg.status]?.label || reg.statusLabel || 'Em andamento';
      const inicioTexto = formatarDataHoraCompleta(dataInicio);

      let detalhesFim = '';
      let dataFinal = null;
      if (reg.status === 'concluida' && dataConclusao) {
        dataFinal = dataConclusao;
        detalhesFim = `\n   Conclusão: ${formatarDataHoraCompleta(dataConclusao)}`;
      } else if (reg.status === 'cancelada' && dataCancelamento) {
        dataFinal = dataCancelamento;
        detalhesFim = `\n   Cancelamento: ${formatarDataHoraCompleta(dataCancelamento)}`;
        if (reg.motivoCancelamento) {
          detalhesFim += `\n   Motivo: ${reg.motivoCancelamento}`;
        }
      }

      let duracaoStr = '';
      if (dataFinal && dataInicio) {
        const duracaoMin = differenceInMinutes(dataFinal, dataInicio);
        if (Number.isFinite(duracaoMin) && duracaoMin >= 0) {
          const horas = Math.floor(duracaoMin / 60);
          const minutos = duracaoMin % 60;
          duracaoStr = `\n   Duração: ${horas}h ${minutos}min`;
        }
      }

      const origemSetor = reg.origem?.setor || 'N/A';
      const origemLeito = reg.origem?.leito || 'N/A';
      const destinoAtualSetor = reg.destinoFinal?.setor || reg.destino?.setor || 'N/A';
      const destinoAtualLeito = reg.destinoFinal?.leito || reg.destino?.leito || 'N/A';

      let alteracoesStr = '';
      if (Array.isArray(reg.alteracoes) && reg.alteracoes.length > 0) {
        alteracoesStr = reg.alteracoes
          .map((alteracao) => {
            const dataAlteracao = formatarDataCurta(normalizarData(alteracao.timestamp));
            const destinoAlteracaoSetor = alteracao?.destino?.setor || 'N/A';
            const destinoAlteracaoLeito = alteracao?.destino?.leito || 'N/A';
            const responsavelAlteracao = alteracao?.realizadoPor || 'N/A';
            return `\n   ↳ Alterado em ${dataAlteracao} para ${destinoAlteracaoSetor} · ${destinoAlteracaoLeito} por ${responsavelAlteracao}`;
          })
          .join('');
      }

      return (
        `${index + 1}. ${nomePaciente} — ${statusLabel}` +
        `\n   Início: ${inicioTexto}` +
        `${detalhesFim}${duracaoStr}` +
        `\n   Origem: ${origemSetor} · ${origemLeito}` +
        `\n   Destino atual: ${destinoAtualSetor} · ${destinoAtualLeito}` +
        `${alteracoesStr}`
      );
    },
    [formatarDataCurta, formatarDataHoraCompleta, normalizarData]
  );

  const copiarPanorama = async () => {
    const gerarTextoPanorama = () => {
      const registrosOrdenados = regulacoesOrdenadas;

      const periodoInicio = normalizarData(periodo?.inicio);
      const periodoFim = normalizarData(periodo?.fim);

      const concluidas = registrosOrdenados.filter((r) => r.status === 'concluida').length;
      const canceladas = registrosOrdenados.filter((r) => r.status === 'cancelada').length;
      const emAndamentoRegistros = regulacoesPendentes;
      const emAndamento = emAndamentoRegistros.length;

      const cabecalho = `*PANORAMA DE REGULAÇÕES*\nPeríodo: ${formatarDataHoraCompleta(periodoInicio)} - ${formatarDataHoraCompleta(periodoFim)}\n`;

      const resumo =
        `*RESUMO DO PERÍODO*` +
        `\nTotal de regulações: ${registrosOrdenados.length}` +
        `\nConcluídas: ${concluidas}` +
        `\nCanceladas: ${canceladas}` +
        `\nEm andamento: ${emAndamento}`;

      const regulacoesEmAndamento = emAndamentoRegistros
        .map((reg, index) => formatarRegulacaoDetalhada(reg, index))
        .join('\n\n');

      const secaoAndamento =
        `*REGULAÇÕES EM ANDAMENTO*\n` +
        (regulacoesEmAndamento || 'Nenhuma regulação em andamento no período.');

      const demaisRegulacoes = registrosOrdenados
        .filter((r) => r.status === 'concluida' || r.status === 'cancelada')
        .map((reg, index) => formatarRegulacaoDetalhada(reg, index))
        .join('\n\n');

      const secaoDemais =
        `*DEMAIS REGULAÇÕES*\n` +
        (demaisRegulacoes || 'Nenhuma regulação concluída ou cancelada no período.');

      return `${cabecalho}\n${resumo}\n\n${secaoAndamento}\n\n${secaoDemais}`;
    };

    const texto = gerarTextoPanorama();

    try {
      if (!navigator?.clipboard?.writeText) {
        throw new Error('Clipboard API não disponível');
      }
      await navigator.clipboard.writeText(texto);
      toast({ title: 'Panorama copiado para a área de transferência.' });
    } catch (error) {
      console.error('Erro ao copiar panorama de regulações:', error);
      toast({
        title: 'Não foi possível copiar o panorama.',
        description: 'Copie manualmente as informações exibidas.',
        variant: 'destructive',
      });
    }
  };

  const handleCopiarPendentes = async () => {
    if (emAndamentoCount === 0) {
      return;
    }

    const listaTexto = regulacoesPendentes
      .map((reg, index) => formatarRegulacaoDetalhada(reg, index))
      .join('\n\n');

    const textoFinal = `*REGULAÇÕES PENDENTES*\n\n${listaTexto}`;

    try {
      if (!navigator?.clipboard?.writeText) {
        throw new Error('Clipboard API não disponível');
      }
      await navigator.clipboard.writeText(textoFinal);
      toast({
        title: 'Pendências copiadas!',
        description: 'A lista de regulações pendentes foi copiada para a área de transferência.',
      });
    } catch (error) {
      console.error('Falha ao copiar texto: ', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível copiar o texto.',
        variant: 'destructive',
      });
    }
  };

  const renderConteudo = () => {
    if (dados.loading) {
      return (
        <div className="flex h-[60vh] flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          Carregando panorama de regulações...
        </div>
      );
    }

    if (dados.error) {
      return (
        <div className="flex h-[60vh] flex-col items-center justify-center gap-3 text-center text-sm text-destructive">
          <AlertCircle className="h-6 w-6" />
          <p>Não foi possível carregar as informações de regulação no período selecionado.</p>
        </div>
      );
    }

    return (
      <ScrollArea className="h-[70vh] pr-4">
        <div className="space-y-6">
          <section className="space-y-2">
            <h3 className="text-lg font-semibold uppercase tracking-wide">Resumo do Período</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <div className="rounded-lg border bg-muted/40 p-4">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Total</p>
                <p className="text-2xl font-semibold">{panorama.resumo.total}</p>
              </div>
              <div className="rounded-lg border bg-muted/40 p-4">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Concluídas</p>
                <p className="text-2xl font-semibold text-emerald-600">{panorama.resumo.concluidas}</p>
              </div>
              <div className="rounded-lg border bg-muted/40 p-4">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Canceladas</p>
                <p className="text-2xl font-semibold text-destructive">{panorama.resumo.canceladas}</p>
              </div>
              <div className="rounded-lg border bg-muted/40 p-4">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Em andamento</p>
                <p className="text-2xl font-semibold text-amber-600">{panorama.resumo.emAndamento}</p>
              </div>
              <div className="rounded-lg border bg-muted/40 p-4">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Com alteração</p>
                <p className="text-2xl font-semibold text-sky-600">{panorama.resumo.comAlteracao}</p>
              </div>
            </div>
          </section>

          <Separator />

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold uppercase tracking-wide">Detalhamento do Período</h3>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Users className="h-4 w-4" />
                <span>{panorama.registros.length} registros encontrados</span>
              </div>
            </div>

            {panorama.registros.length === 0 ? (
              <p className="rounded-lg border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                Nenhuma regulação registrada neste período.
              </p>
            ) : (
              <div className="space-y-4">
                {panorama.registros.map((registro) => (
                  <Card key={registro.chave} className="border">
                    <CardHeader className="space-y-2">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <CardTitle className="text-base font-semibold">{registro.pacienteNome}</CardTitle>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className={registro.statusBadgeClass}>
                            {registro.statusLabel}
                          </Badge>
                          {registro.temAlteracao && registro.status === 'concluida' && (
                            <Badge variant="outline" className={STATUS_CONFIG.alterada.className}>
                              Alterada durante o processo
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="space-y-1 text-xs text-muted-foreground">
                        {registro.nomeSocial && <p>Nome social: {registro.nomeSocial}</p>}
                        {registro.usuarioResponsavel && <p>Responsável: {registro.usuarioResponsavel}</p>}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm">
                      <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        <span>
                          {registro.origem.setor} · {registro.origem.leito}
                        </span>
                        <span className="text-muted-foreground">→</span>
                        <span>
                          {registro.destinoFinal.setor} · {registro.destinoFinal.leito}
                        </span>
                      </div>

                      <div className="grid gap-3 text-muted-foreground sm:grid-cols-2">
                        <div className="flex items-center gap-2">
                          <CalendarRange className="h-4 w-4" />
                          <span>Início: {registro.dataInicio ? formatDateTime(registro.dataInicio) : 'Não informado'}</span>
                        </div>
                        {registro.status === 'concluida' && registro.dataConclusao && (
                          <div className="flex items-center gap-2">
                            <CalendarRange className="h-4 w-4" />
                            <span>Conclusão: {formatDateTime(registro.dataConclusao)}</span>
                          </div>
                        )}
                        {registro.status === 'cancelada' && registro.dataCancelamento && (
                          <div className="flex items-center gap-2">
                            <CalendarRange className="h-4 w-4" />
                            <span>Cancelamento: {formatDateTime(registro.dataCancelamento)}</span>
                          </div>
                        )}
                        {registro.status === 'em_andamento' && registro.tempoDecorridoFormatado && (
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            <span>Em andamento há {registro.tempoDecorridoFormatado}</span>
                          </div>
                        )}
                      </div>

                      {registro.status === 'concluida' && registro.tempoTotalFormatado && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          <span>Tempo total: {registro.tempoTotalFormatado}</span>
                        </div>
                      )}

                      {registro.status === 'cancelada' && registro.motivoCancelamento && (
                        <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-destructive">
                          Motivo do cancelamento: {registro.motivoCancelamento}
                        </div>
                      )}

                      {registro.eventos.length > 0 && (
                        <div className="space-y-2 rounded-md border bg-muted/30 p-3">
                          <p className="text-xs font-semibold uppercase text-muted-foreground">Linha do tempo</p>
                          <div className="space-y-3">
                            {registro.eventos.map((evento, index) => (
                              <div key={`${registro.chave}-${evento.tipo}-${index}`} className="space-y-1 text-muted-foreground">
                                <p className="font-medium text-foreground">
                                  {evento.titulo}
                                  {evento.data ? ` — ${formatDateTime(evento.data)}` : ''}
                                </p>
                                {evento.descricao && <p>{evento.descricao}</p>}
                                {evento.justificativa && <p>Justificativa: {evento.justificativa}</p>}
                                {evento.realizadoPor && <p>Responsável: {evento.realizadoPor}</p>}
                              </div>
                            ))}
                          </div>
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
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[85vh] max-w-5xl">
        <DialogHeader className="space-y-2">
          <DialogTitle className="flex flex-col gap-2 text-2xl font-semibold sm:flex-row sm:items-center sm:justify-between">
            <span>Panorama de Regulações</span>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={copiarPanorama} disabled={dados.loading}>
                <Copy className="mr-2 h-4 w-4" /> Copiar resumo
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleCopiarPendentes}
                disabled={dados.loading || emAndamentoCount === 0}
              >
                <ClipboardList className="mr-2 h-4 w-4" /> Copiar Pendentes ({emAndamentoCount})
              </Button>
            </div>
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Período selecionado: {periodoInicioFormatado} - {periodoFimFormatado}
          </p>
        </DialogHeader>

        {renderConteudo()}
      </DialogContent>
    </Dialog>
  );
};

export default PanoramaRegulacoesModal;
