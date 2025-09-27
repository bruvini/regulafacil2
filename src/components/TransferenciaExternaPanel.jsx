import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { ClipboardList, CheckCircle, XCircle } from "lucide-react";
import { intervalToDuration } from 'date-fns';
import {
  getPacientesCollection,
  getSetoresCollection,
  getLeitosCollection,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
  arrayUnion,
  deleteField,
  writeBatch,
  db
} from '@/lib/firebase';
import TransferenciaExternaModal from '@/components/modals/TransferenciaExternaModal';
import GerenciarStatusTransferenciaModal from '@/components/modals/GerenciarStatusTransferenciaModal';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { logAction } from '@/lib/auditoria';

const toDateSafe = (d) => {
  if (!d) return null;
  if (typeof d?.toDate === 'function') return d.toDate();
  return new Date(d);
};

const formatDurationShort = (start) => {
  const s = toDateSafe(start);
  if (!s || isNaN(s.getTime())) return '';
  const now = new Date();
  const dur = intervalToDuration({ start: s, end: now });
  if (dur.days && dur.days > 0) return `${dur.days}d ${dur.hours || 0}h`;
  if (dur.hours && dur.hours > 0) return `${dur.hours}h ${dur.minutes || 0}m`;
  return `${dur.minutes || 0}m`;
};

const normalizarTexto = (texto) =>
  String(texto || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

const normalizarSexo = (valor) => {
  const sexoNormalizado = normalizarTexto(valor);
  if (sexoNormalizado.startsWith('m')) return 'M';
  if (sexoNormalizado.startsWith('f')) return 'F';
  return '';
};

const TransferenciaExternaPanel = ({ filtros, sortConfig }) => {
  const [pacientes, setPacientes] = useState([]);
  const [setores, setSetores] = useState([]);
  const [leitos, setLeitos] = useState([]);
  const [modalTransferencia, setModalTransferencia] = useState({ isOpen: false, paciente: null });
  const [modalStatusTransferencia, setModalStatusTransferencia] = useState({ isOpen: false, paciente: null });
  const [processingAction, setProcessingAction] = useState(null);
  const [salvandoStatus, setSalvandoStatus] = useState(false);

  const { toast } = useToast();
  const { currentUser } = useAuth();

  useEffect(() => {
    const unsubPac = onSnapshot(getPacientesCollection(), (snap) => {
      setPacientes(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    const unsubSet = onSnapshot(getSetoresCollection(), (snap) => {
      setSetores(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    const unsubLei = onSnapshot(getLeitosCollection(), (snap) => {
      setLeitos(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => {
      unsubPac();
      unsubSet();
      unsubLei();
    };
  }, []);

  const getSiglaSetor = (paciente) => {
    // A única forma confiável de encontrar o setor é pelo ID.
    if (!paciente || !paciente.setorId || !setores || setores.length === 0) {
      return '—';
    }

    const setorEncontrado = setores.find(s => s.id === paciente.setorId);

    return setorEncontrado?.siglaSetor || '—';
  };

  const getCodigoLeito = (p) => {
    const code = p?.codigoLeito || p?.leito?.codigoLeito || p?.leito?.codigo;
    if (code) return code;
    const found = leitos.find((l) => l?.id === p?.leitoId || l?.codigoLeito === p?.codigoLeito);
    return found?.codigoLeito || '—';
  };

  const encontrarLeitoPaciente = (paciente) => {
    if (!paciente) return null;

    const possiveisIds = [
      paciente.leitoId,
      paciente?.leito?.id,
      paciente?.leito?.leitoId,
      paciente?.leito?.idLeito
    ].filter(Boolean);

    for (const id of possiveisIds) {
      const encontrado = leitos.find((leito) => leito.id === id);
      if (encontrado) return encontrado;
    }

    if (paciente.codigoLeito) {
      return leitos.find((leito) => leito.codigoLeito === paciente.codigoLeito);
    }

    return null;
  };

  const calcularIdade = (dataNascimento) => {
    if (!dataNascimento) return 0;

    let dataObj;

    if (typeof dataNascimento === 'string' && dataNascimento.includes('/')) {
      const [dia, mes, ano] = dataNascimento.split('/');
      dataObj = new Date(parseInt(ano, 10), parseInt(mes, 10) - 1, parseInt(dia, 10));
    } else if (dataNascimento && typeof dataNascimento.toDate === 'function') {
      dataObj = dataNascimento.toDate();
    } else {
      dataObj = new Date(dataNascimento);
    }

    if (isNaN(dataObj?.getTime?.())) {
      return 0;
    }

    const hoje = new Date();
    let idade = hoje.getFullYear() - dataObj.getFullYear();
    const m = hoje.getMonth() - dataObj.getMonth();

    if (m < 0 || (m === 0 && hoje.getDate() < dataObj.getDate())) {
      idade--;
    }

    return idade;
  };

  const parseData = (valor) => {
    if (!valor) return null;

    let dataObj;

    if (typeof valor === 'string' && valor.includes('/')) {
      const partes = valor.split(' ');
      const [dia, mes, ano] = partes[0].split('/');

      if (partes.length > 1 && partes[1].includes(':')) {
        const [hora, minuto] = partes[1].split(':');
        dataObj = new Date(
          parseInt(ano, 10),
          parseInt(mes, 10) - 1,
          parseInt(dia, 10),
          parseInt(hora, 10),
          parseInt(minuto, 10)
        );
      } else {
        dataObj = new Date(parseInt(ano, 10), parseInt(mes, 10) - 1, parseInt(dia, 10));
      }
    } else if (valor && typeof valor.toDate === 'function') {
      dataObj = valor.toDate();
    } else {
      dataObj = new Date(valor);
    }

    if (isNaN(dataObj?.getTime?.())) {
      return null;
    }

    return dataObj;
  };

  const calcularTempoInternacaoHoras = (dataInternacao) => {
    const dataObj = parseData(dataInternacao);
    if (!dataObj) return null;
    const diffMs = Date.now() - dataObj.getTime();
    return diffMs / (1000 * 60 * 60);
  };

  const pedidos = useMemo(() => {
    const base = pacientes.filter((p) => !!p?.pedidoTransferenciaExterna);

    const {
      searchTerm = '',
      especialidade = 'todos',
      sexo = 'todos',
      idadeMin = '',
      idadeMax = '',
      tempoInternacaoMin = '',
      tempoInternacaoMax = '',
      unidadeTempo = 'dias'
    } = filtros || {};

    const termoBuscaNormalizado = normalizarTexto(searchTerm);
    const especialidadeFiltro = normalizarTexto(especialidade);
    const sexoFiltro = sexo || 'todos';
    const idadeMinNumero = idadeMin !== '' ? Number(idadeMin) : null;
    const idadeMaxNumero = idadeMax !== '' ? Number(idadeMax) : null;
    const tempoMinNumero = tempoInternacaoMin !== '' ? Number(tempoInternacaoMin) : null;
    const tempoMaxNumero = tempoInternacaoMax !== '' ? Number(tempoInternacaoMax) : null;

    const filtrados = base.filter((paciente) => {
      if (termoBuscaNormalizado) {
        const nomeNormalizado = normalizarTexto(paciente.nomePaciente);
        if (!nomeNormalizado.includes(termoBuscaNormalizado)) {
          return false;
        }
      }

      if (especialidadeFiltro && especialidadeFiltro !== 'todos') {
        const especialidadePaciente = normalizarTexto(paciente.especialidade);
        if (!especialidadePaciente.includes(especialidadeFiltro)) {
          return false;
        }
      }

      if (sexoFiltro && sexoFiltro !== 'todos') {
        if (normalizarSexo(paciente.sexo) !== sexoFiltro) {
          return false;
        }
      }

      const idade = calcularIdade(paciente.dataNascimento);
      if (idadeMinNumero !== null && idade < idadeMinNumero) {
        return false;
      }
      if (idadeMaxNumero !== null && idade > idadeMaxNumero) {
        return false;
      }

      const tempoHoras = calcularTempoInternacaoHoras(paciente.dataInternacao);
      const tempoMinHoras =
        tempoMinNumero !== null
          ? unidadeTempo === 'dias'
            ? tempoMinNumero * 24
            : tempoMinNumero
          : null;
      const tempoMaxHoras =
        tempoMaxNumero !== null
          ? unidadeTempo === 'dias'
            ? tempoMaxNumero * 24
            : tempoMaxNumero
          : null;

      if (tempoMinHoras !== null) {
        if (tempoHoras === null || tempoHoras < tempoMinHoras) {
          return false;
        }
      }

      if (tempoMaxHoras !== null) {
        if (tempoHoras === null || tempoHoras > tempoMaxHoras) {
          return false;
        }
      }

      return true;
    });

    const direction = sortConfig?.direction === 'desc' ? -1 : 1;
    const key = sortConfig?.key || 'nome';

    return filtrados.sort((a, b) => {
      if (key === 'idade') {
        const idadeA = calcularIdade(a.dataNascimento);
        const idadeB = calcularIdade(b.dataNascimento);
        return direction * (idadeA - idadeB);
      }

      if (key === 'tempoInternacao') {
        const tempoA = calcularTempoInternacaoHoras(a.dataInternacao);
        const tempoB = calcularTempoInternacaoHoras(b.dataInternacao);
        const valorA =
          tempoA ?? (direction === 1 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY);
        const valorB =
          tempoB ?? (direction === 1 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY);
        return direction * (valorA - valorB);
      }

      const nomeA = normalizarTexto(a.nomePaciente);
      const nomeB = normalizarTexto(b.nomePaciente);
      return direction * nomeA.localeCompare(nomeB);
    });
  }, [pacientes, filtros, sortConfig]);

  const handleAbrirTransferencia = (paciente) => {
    setModalTransferencia({ isOpen: true, paciente });
  };

  const handleFecharTransferenciaModal = () => {
    setModalTransferencia({ isOpen: false, paciente: null });
  };

  const handleAbrirGerenciarStatus = (paciente) => {
    setModalStatusTransferencia({ isOpen: true, paciente });
  };

  const handleFecharGerenciarStatus = () => {
    setModalStatusTransferencia({ isOpen: false, paciente: null });
  };

  const handleSalvarTransferencia = async (dados) => {
    if (!modalTransferencia.paciente) return;

    try {
      const paciente = modalTransferencia.paciente;
      const pacienteRef = doc(getPacientesCollection(), paciente.id);

      const pedidoAtual = paciente.pedidoTransferenciaExterna;
      const solicitadoEm = pedidoAtual?.solicitadoEm || serverTimestamp();

      await updateDoc(pacienteRef, {
        pedidoTransferenciaExterna: {
          motivo: dados.motivo,
          outroMotivo: dados.outroMotivo,
          destino: dados.destino,
          solicitadoEm,
          historicoStatus: pedidoAtual?.historicoStatus || []
        }
      });

      const nomeUsuario = currentUser?.nomeCompleto || 'Usuário do Sistema';
      const acao = pedidoAtual ? 'atualizada' : 'solicitada';

      await logAction(
        'Regulação de Leitos',
        `Transferência externa ${acao} para o paciente '${paciente.nomePaciente}' por ${nomeUsuario}. Motivo: ${dados.motivo}, Destino: ${dados.destino}`,
        currentUser
      );

      toast({
        title: `Transferência ${acao}`,
        description: `Pedido de transferência externa para ${paciente.nomePaciente} foi ${acao}.`,
      });

      setModalTransferencia({ isOpen: false, paciente: null });
    } catch (error) {
      console.error('Erro ao salvar transferência externa:', error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar a transferência externa. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleSalvarAtualizacaoStatus = async (texto) => {
    const paciente = modalStatusTransferencia.paciente;
    if (!paciente) return false;

    setSalvandoStatus(true);
    try {
      const pacienteRef = doc(getPacientesCollection(), paciente.id);
      const nomeUsuario = currentUser?.nomeCompleto || 'Usuário do Sistema';
      const novaAtualizacao = {
        texto,
        userName: nomeUsuario,
        timestamp: new Date()
      };

      await updateDoc(pacienteRef, {
        'pedidoTransferenciaExterna.historicoStatus': arrayUnion(novaAtualizacao)
      });

      await logAction(
        'Status Transferência Atualizado',
        `Status da transferência externa do paciente '${paciente.nomePaciente}' atualizado por ${nomeUsuario}: ${texto}`,
        currentUser
      );

      toast({
        title: 'Status atualizado',
        description: `Nova atualização registrada para ${paciente.nomePaciente}.`
      });

      return true;
    } catch (error) {
      console.error('Erro ao salvar atualização de status da transferência:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível salvar a atualização de status. Tente novamente.',
        variant: 'destructive'
      });
      return false;
    } finally {
      setSalvandoStatus(false);
    }
  };

  const handleConcluirTransferencia = async (paciente) => {
    if (!paciente) return;

    setProcessingAction({ type: 'concluir', pacienteId: paciente.id });
    try {
      const leitoAtual = encontrarLeitoPaciente(paciente);
      if (!leitoAtual) {
        throw new Error('Leito do paciente não encontrado para atualização.');
      }

      const batch = writeBatch(db);
      const pacienteRef = doc(getPacientesCollection(), paciente.id);
      const leitoRef = doc(getLeitosCollection(), leitoAtual.id);
      const nomeUsuario = currentUser?.nomeCompleto || 'Usuário do Sistema';

      batch.delete(pacienteRef);
      batch.update(leitoRef, {
        status: 'Higienização',
        statusLeito: 'Higienização',
        pacienteId: deleteField(),
        pacienteNome: deleteField(),
        historico: arrayUnion({
          status: 'Higienização',
          timestamp: new Date(),
          origem: 'Transferência Externa Concluída'
        })
      });

      await batch.commit();

      await logAction(
        'Transferência Concluída',
        `Transferência externa do paciente '${paciente.nomePaciente}' concluída por ${nomeUsuario}. Leito ${leitoAtual.codigoLeito} atualizado para higienização.`,
        currentUser
      );

      toast({
        title: 'Transferência concluída',
        description: `Paciente ${paciente.nomePaciente} removido da lista e leito enviado para higienização.`
      });
    } catch (error) {
      console.error('Erro ao concluir transferência externa:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível concluir a transferência externa. Tente novamente.',
        variant: 'destructive'
      });
    } finally {
      setProcessingAction(null);
    }
  };

  const handleCancelarTransferencia = async (paciente) => {
    if (!paciente) return;

    setProcessingAction({ type: 'cancelar', pacienteId: paciente.id });
    try {
      const pacienteRef = doc(getPacientesCollection(), paciente.id);
      const nomeUsuario = currentUser?.nomeCompleto || 'Usuário do Sistema';

      await updateDoc(pacienteRef, {
        pedidoTransferenciaExterna: deleteField()
      });

      await logAction(
        'Transferência Cancelada',
        `Transferência externa do paciente '${paciente.nomePaciente}' cancelada por ${nomeUsuario}.`,
        currentUser
      );

      toast({
        title: 'Transferência cancelada',
        description: `Pedido de transferência externa de ${paciente.nomePaciente} foi cancelado.`,
      });
    } catch (error) {
      console.error('Erro ao cancelar transferência externa:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível cancelar a transferência externa. Tente novamente.',
        variant: 'destructive'
      });
    } finally {
      setProcessingAction(null);
    }
  };

  const pacienteStatusId = modalStatusTransferencia.paciente?.id;
  useEffect(() => {
    if (!modalStatusTransferencia.isOpen || !pacienteStatusId) return;

    const atualizado = pacientes.find((p) => p.id === pacienteStatusId);
    if (atualizado) {
      setModalStatusTransferencia((prev) => ({ ...prev, paciente: atualizado }));
    } else {
      setModalStatusTransferencia({ isOpen: false, paciente: null });
    }
  }, [pacientes, modalStatusTransferencia.isOpen, pacienteStatusId]);

  return (
    <Card className="shadow-card card-interactive">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          Aguardando Transferência Externa
        </CardTitle>
      </CardHeader>
      <CardContent>
        {pedidos.length === 0 ? (
          <div className="text-muted-foreground text-sm">Nenhum paciente aguardando transferência</div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {pedidos.map((p) => (
              <div key={p.id} className="border border-muted rounded-md p-3 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-sm truncate">{p?.nomePaciente || 'Sem nome'}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {getSiglaSetor(p)} - {getCodigoLeito(p)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Motivo: <span className="font-medium">{p?.pedidoTransferenciaExterna?.motivo || '—'}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Destino: <span className="font-medium">{p?.pedidoTransferenciaExterna?.destino || '—'}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Aguardando há {formatDurationShort(p?.pedidoTransferenciaExterna?.solicitadoEm)}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAbrirGerenciarStatus(p)}
                    >
                      Gerenciar Status
                    </Button>
                    <div className="flex gap-1">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              className="p-1.5 hover:bg-muted rounded-md"
                              onClick={() => handleAbrirTransferencia(p)}
                            >
                              <ClipboardList className="h-4 w-4 text-primary" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent><p>Editar Transferência</p></TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <AlertDialog>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <AlertDialogTrigger asChild>
                                <button
                                  type="button"
                                  className="p-1.5 hover:bg-muted rounded-md"
                                  disabled={processingAction?.type === 'concluir' && processingAction?.pacienteId === p.id}
                                >
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                </button>
                              </AlertDialogTrigger>
                            </TooltipTrigger>
                            <TooltipContent><p>Concluir Transferência</p></TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Concluir transferência externa</AlertDialogTitle>
                            <AlertDialogDescription>
                              Confirma a conclusão da transferência do paciente "{p.nomePaciente}"? Esta ação irá remover o paciente da lista e liberar o leito para higienização.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleConcluirTransferencia(p)}
                              disabled={processingAction?.type === 'concluir' && processingAction?.pacienteId === p.id}
                            >
                              Confirmar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                      <AlertDialog>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <AlertDialogTrigger asChild>
                                <button
                                  type="button"
                                  className="p-1.5 hover:bg-muted rounded-md"
                                  disabled={processingAction?.type === 'cancelar' && processingAction?.pacienteId === p.id}
                                >
                                  <XCircle className="h-4 w-4 text-destructive" />
                                </button>
                              </AlertDialogTrigger>
                            </TooltipTrigger>
                            <TooltipContent><p>Cancelar Transferência</p></TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Cancelar transferência externa</AlertDialogTitle>
                            <AlertDialogDescription>
                              Deseja cancelar o pedido de transferência externa para "{p.nomePaciente}"? O histórico permanecerá salvo para consulta.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Voltar</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground"
                              onClick={() => handleCancelarTransferencia(p)}
                              disabled={processingAction?.type === 'cancelar' && processingAction?.pacienteId === p.id}
                            >
                              Cancelar transferência
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <TransferenciaExternaModal
        isOpen={modalTransferencia.isOpen}
        onClose={handleFecharTransferenciaModal}
        onSave={handleSalvarTransferencia}
        paciente={modalTransferencia.paciente}
      />
      <GerenciarStatusTransferenciaModal
        isOpen={modalStatusTransferencia.isOpen}
        onClose={handleFecharGerenciarStatus}
        paciente={modalStatusTransferencia.paciente}
        onSalvarAtualizacao={handleSalvarAtualizacaoStatus}
        salvando={salvandoStatus}
      />
    </Card>
  );
};

export default TransferenciaExternaPanel;
