import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from 'lucide-react';
import {
  doc,
  getDoc,
  getHistoricoRegulacoesCollection,
  getLeitosCollection,
  getSetoresCollection,
} from '@/lib/firebase';
import { differenceInDays, differenceInHours, differenceInYears, format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const normalizarData = (valor) => {
  if (!valor) return null;

  try {
    if (typeof valor?.toDate === 'function') {
      const date = valor.toDate();
      return Number.isNaN(date?.getTime?.()) ? null : date;
    }

    if (valor instanceof Date) {
      return Number.isNaN(valor.getTime()) ? null : valor;
    }

    if (typeof valor === 'number') {
      const date = new Date(valor);
      return Number.isNaN(date.getTime()) ? null : date;
    }

    if (typeof valor === 'string') {
      const trimmed = valor.trim();
      if (!trimmed) return null;

      if (trimmed.includes('/')) {
        const [day, month, year] = trimmed.split(/[\/]/).map((part) => Number(part));
        if (!day || !month || !year) return null;
        const date = new Date(year, month - 1, day);
        return Number.isNaN(date.getTime()) ? null : date;
      }

      const parsed = parseISO(trimmed);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
  } catch (error) {
    console.warn('Não foi possível converter o valor em data:', error);
  }

  return null;
};

const formatarData = (valor) => {
  const data = normalizarData(valor);
  return data ? format(data, 'dd/MM/yyyy', { locale: ptBR }) : 'Não informado';
};

const formatarDataHora = (valor) => {
  const data = normalizarData(valor);
  return data ? format(data, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : 'Não informado';
};

const calcularIdade = (valor) => {
  const dataNascimento = normalizarData(valor);
  if (!dataNascimento) return null;
  return differenceInYears(new Date(), dataNascimento);
};

const calcularTempoInternacao = (valor) => {
  const dataInternacao = normalizarData(valor);
  if (!dataInternacao) return null;

  const agora = new Date();
  if (agora < dataInternacao) return null;

  const dias = differenceInDays(agora, dataInternacao);
  const horasTotais = differenceInHours(agora, dataInternacao);
  const horasRestantes = Math.max(horasTotais - dias * 24, 0);

  const partes = [];
  if (dias > 0) {
    partes.push(`${dias} dia${dias > 1 ? 's' : ''}`);
  }
  if (horasRestantes > 0) {
    partes.push(`${horasRestantes} hora${horasRestantes > 1 ? 's' : ''}`);
  }

  if (!partes.length) {
    return 'Menos de 1 hora';
  }

  return partes.join(' e ');
};

const formatarDuracaoMinutos = (minutos) => {
  if (typeof minutos !== 'number' || Number.isNaN(minutos)) return null;
  const horas = Math.floor(minutos / 60);
  const minutosRestantes = Math.round(minutos % 60);

  const partes = [];
  if (horas > 0) partes.push(`${horas}h`);
  partes.push(`${minutosRestantes}min`);

  return partes.join(' ');
};

const VisualizarPacienteModal = ({ isOpen, onClose, paciente }) => {
  const [localizacao, setLocalizacao] = useState({
    loading: false,
    setor: null,
    setorNome: null,
    leito: null,
    status: null,
    error: null,
  });
  const [historico, setHistorico] = useState({
    loading: false,
    dados: null,
    error: null,
  });

  useEffect(() => {
    if (!isOpen) return;

    if (!paciente) {
      setLocalizacao({
        loading: false,
        setor: null,
        setorNome: null,
        leito: null,
        status: null,
        error: null,
      });
      return;
    }

    if (!paciente.leitoId) {
      setLocalizacao({
        loading: false,
        setor: paciente.siglaSetor || paciente.nomeSetor || null,
        setorNome: paciente.nomeSetor || null,
        leito: paciente.codigoLeito || null,
        status: null,
        error: null,
      });
      return;
    }

    let ativo = true;

    const carregarLocalizacao = async () => {
      setLocalizacao((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const leitoRef = doc(getLeitosCollection(), paciente.leitoId);
        const leitoSnap = await getDoc(leitoRef);

        if (!ativo) return;

        if (!leitoSnap.exists()) {
          setLocalizacao({
            loading: false,
            setor: null,
            setorNome: null,
            leito: null,
            status: null,
            error: null,
          });
          return;
        }

        const leitoData = leitoSnap.data();
        let setorData = null;

        if (leitoData?.setorId) {
          const setorRef = doc(getSetoresCollection(), leitoData.setorId);
          const setorSnap = await getDoc(setorRef);
          if (!ativo) return;
          if (setorSnap.exists()) {
            setorData = setorSnap.data();
          }
        }

        setLocalizacao({
          loading: false,
          setor: setorData?.siglaSetor || setorData?.nomeSetor || null,
          setorNome: setorData?.nomeSetor || null,
          leito: leitoData?.codigoLeito || leitoData?.codigo || null,
          status: leitoData?.statusLeito || leitoData?.status || null,
          error: null,
        });
      } catch (error) {
        console.error('Erro ao carregar localização do paciente:', error);
        if (!ativo) return;
        setLocalizacao({
          loading: false,
          setor: null,
          setorNome: null,
          leito: null,
          status: null,
          error,
        });
      }
    };

    carregarLocalizacao();

    return () => {
      ativo = false;
    };
  }, [isOpen, paciente]);

  useEffect(() => {
    if (!isOpen || !paciente?.id) {
      setHistorico({ loading: false, dados: null, error: null });
      return;
    }

    let ativo = true;

    const carregarHistorico = async () => {
      setHistorico({ loading: true, dados: null, error: null });

      try {
        const historicoRef = doc(getHistoricoRegulacoesCollection(), paciente.id);
        const historicoSnap = await getDoc(historicoRef);

        if (!ativo) return;

        if (historicoSnap.exists()) {
          setHistorico({
            loading: false,
            dados: { id: historicoSnap.id, ...historicoSnap.data() },
            error: null,
          });
        } else {
          setHistorico({ loading: false, dados: null, error: null });
        }
      } catch (error) {
        console.error('Erro ao carregar histórico de regulações do paciente:', error);
        if (!ativo) return;
        setHistorico({ loading: false, dados: null, error });
      }
    };

    carregarHistorico();

    return () => {
      ativo = false;
    };
  }, [isOpen, paciente?.id]);

  const descricaoLocalizacao = useMemo(() => {
    if (localizacao.loading) return 'Carregando localização...';
    if (localizacao.error) return 'Não foi possível obter a localização atual do leito.';

    const setor = localizacao.setor || paciente?.siglaSetor || paciente?.nomeSetor;
    const leito = localizacao.leito || paciente?.codigoLeito;

    if (!setor && !leito) {
      return 'Sem leito vinculado.';
    }

    return `${setor || 'Setor não informado'}${leito ? ` - ${leito}` : ''}`;
  }, [localizacao, paciente]);

  const badgesStatus = useMemo(() => {
    if (!paciente) return [];

    const badges = [];

    if (Array.isArray(paciente.isolamentos) && paciente.isolamentos.length > 0) {
      badges.push({
        key: 'isolamentos',
        label: `Isolamentos: ${paciente.isolamentos.map((iso) => iso?.sigla || iso).join(', ')}`,
        variant: 'destructive',
        className: '',
      });
    }

    if (paciente.pedidoUTI) {
      badges.push({
        key: 'pedidoUTI',
        label: 'Pedido de UTI',
        variant: 'outline',
        className: 'border-amber-300 bg-amber-50 text-amber-700',
      });
    }

    if (paciente.pedidoRemanejamento) {
      badges.push({
        key: 'pedidoRemanejamento',
        label: 'Remanejamento Solicitado',
        variant: 'outline',
        className: 'border-sky-300 bg-sky-50 text-sky-700',
      });
    }

    if (paciente.transferenciaExterna) {
      badges.push({
        key: 'transferenciaExterna',
        label: 'Transferência Externa',
        variant: 'outline',
        className: 'border-purple-300 bg-purple-50 text-purple-700',
      });
    }

    return badges;
  }, [paciente]);

  const historicoEventos = useMemo(() => {
    if (!historico.dados) return [];

    const eventos = [];
    const dados = historico.dados;

    const adicionarEvento = (titulo, dataValor, detalhes) => {
      const dataNormalizada = normalizarData(dataValor);
      if (!dataNormalizada) return;

      eventos.push({
        titulo,
        data: dataNormalizada,
        detalhes: detalhes?.filter(Boolean).join(' • ') || null,
      });
    };

    adicionarEvento('Início da Regulação', dados.dataInicio, [
      dados.userNameInicio ? `Responsável: ${dados.userNameInicio}` : null,
      dados.modo ? `Modo: ${dados.modo}` : null,
    ]);

    adicionarEvento('Conclusão da Regulação', dados.dataConclusao, [
      dados.userNameConclusao ? `Responsável: ${dados.userNameConclusao}` : null,
      dados.statusFinal ? `Status: ${dados.statusFinal}` : null,
      dados.leitoDestinoFinalId ? `Leito destino: ${dados.leitoDestinoFinalId}` : null,
    ]);

    adicionarEvento('Cancelamento da Regulação', dados.dataCancelamento, [
      dados.userNameCancelamento ? `Responsável: ${dados.userNameCancelamento}` : null,
      dados.motivoCancelamento ? `Motivo: ${dados.motivoCancelamento}` : null,
    ]);

    if (Array.isArray(dados.registros)) {
      dados.registros.forEach((registro, index) => {
        adicionarEvento(
          registro.titulo || registro.status || `Registro ${index + 1}`,
          registro.data || registro.dataHora || registro.timestamp,
          [registro.descricao || registro.mensagem || null]
        );
      });
    }

    if (Array.isArray(dados.historico)) {
      dados.historico.forEach((registro, index) => {
        adicionarEvento(
          registro.titulo || registro.status || `Histórico ${index + 1}`,
          registro.data || registro.dataHora || registro.timestamp,
          [registro.descricao || registro.mensagem || null]
        );
      });
    }

    return eventos.sort((a, b) => a.data.getTime() - b.data.getTime());
  }, [historico]);

  if (!paciente) return null;

  const idade = calcularIdade(paciente.dataNascimento);
  const tempoInternacao = calcularTempoInternacao(paciente.dataInternacao);
  const tempoRegulacao = formatarDuracaoMinutos(historico.dados?.tempoRegulacaoMinutos);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl sm:max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{paciente.nomePaciente || paciente.nomeCompleto || 'Paciente'}</DialogTitle>
          <DialogDescription>
            {descricaoLocalizacao}
            {localizacao.status && !localizacao.loading && (
              <span className="block text-xs text-muted-foreground">
                Status do leito: {localizacao.status}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[60vh] pr-4">
          <div className="space-y-4 py-2">
            <Card>
              <CardHeader>
                <CardTitle>Informações Principais</CardTitle>
                <CardDescription>Dados clínicos e administrativos do paciente.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Especialidade</p>
                  <p className="font-semibold text-foreground">{paciente.especialidade || 'Não informada'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Sexo</p>
                  <p className="font-semibold text-foreground">{paciente.sexo || 'Não informado'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Data de Nascimento</p>
                  <p className="font-semibold text-foreground">
                    {formatarData(paciente.dataNascimento)}
                    {idade !== null && (
                      <span className="ml-2 text-sm font-normal text-muted-foreground">({idade} anos)</span>
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Data de Internação</p>
                  <p className="font-semibold text-foreground">
                    {formatarDataHora(paciente.dataInternacao)}
                    {tempoInternacao && (
                      <span className="ml-2 text-sm font-normal text-muted-foreground">({tempoInternacao})</span>
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Prontuário</p>
                  <p className="font-semibold text-foreground">{paciente.numeroProntuario || 'Não informado'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Carteirinha</p>
                  <p className="font-semibold text-foreground">{paciente.numeroCarteirinha || 'Não informado'}</p>
                </div>
                {paciente.medicoResponsavel && (
                  <div className="sm:col-span-2">
                    <p className="text-sm font-medium text-muted-foreground">Médico Responsável</p>
                    <p className="font-semibold text-foreground">{paciente.medicoResponsavel}</p>
                  </div>
                )}
                {paciente.observacoes && (
                  <div className="sm:col-span-2">
                    <p className="text-sm font-medium text-muted-foreground">Observações</p>
                    <p className="text-sm text-foreground">{paciente.observacoes}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Status e Pendências</CardTitle>
                <CardDescription>Acompanhamento das solicitações e alertas ativos.</CardDescription>
              </CardHeader>
              <CardContent>
                {badgesStatus.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {badgesStatus.map((badge) => (
                      <Badge key={badge.key} variant={badge.variant} className={badge.className}>
                        {badge.label}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhuma pendência registrada.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Histórico de Regulações</CardTitle>
                  <CardDescription>Principais eventos de regulação associados ao paciente.</CardDescription>
                </div>
                {historico.dados?.status && (
                  <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
                    {historico.dados.status}
                  </Badge>
                )}
              </CardHeader>
              <CardContent>
                {historico.loading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Carregando histórico...
                  </div>
                ) : historico.error ? (
                  <p className="text-sm text-destructive">Não foi possível carregar o histórico de regulações.</p>
                ) : historicoEventos.length > 0 ? (
                  <div className="space-y-4">
                    {tempoRegulacao && (
                      <p className="text-sm font-medium text-muted-foreground">
                        Tempo total de regulação: <span className="font-semibold text-foreground">{tempoRegulacao}</span>
                      </p>
                    )}

                    {historicoEventos.map((evento, index) => (
                      <div key={`${evento.titulo}-${evento.data.toISOString()}`} className="space-y-2">
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                          <p className="font-semibold text-foreground">{evento.titulo}</p>
                          <span className="text-sm text-muted-foreground">{formatarDataHora(evento.data)}</span>
                        </div>
                        {evento.detalhes && (
                          <p className="text-sm text-muted-foreground">{evento.detalhes}</p>
                        )}
                        {index < historicoEventos.length - 1 && <Separator className="pt-2" />}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhum registro de regulação disponível para este paciente.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </ScrollArea>

        <DialogFooter className="pt-4">
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default VisualizarPacienteModal;
