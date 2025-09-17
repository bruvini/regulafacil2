import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ClipboardList, CheckCircle, XCircle } from "lucide-react";
import { intervalToDuration } from 'date-fns';
import {
  getPacientesCollection,
  getSetoresCollection,
  getLeitosCollection,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp
} from '@/lib/firebase';
import TransferenciaExternaModal from '@/components/modals/TransferenciaExternaModal';
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

const TransferenciaExternaPanel = () => {
  const [pacientes, setPacientes] = useState([]);
  const [setores, setSetores] = useState([]);
  const [leitos, setLeitos] = useState([]);
  const [modalTransferencia, setModalTransferencia] = useState({ isOpen: false, paciente: null });

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

  const pedidos = pacientes.filter((p) => !!p?.pedidoTransferenciaExterna);

  const handleAbrirTransferencia = (paciente) => {
    setModalTransferencia({ isOpen: true, paciente });
  };

  const handleFecharTransferenciaModal = () => {
    setModalTransferencia({ isOpen: false, paciente: null });
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
          solicitadoEm
        }
      });

      const nomeUsuario = currentUser?.nomeCompleto || 'Usuário do Sistema';
      const acao = pedidoAtual ? 'atualizada' : 'solicitada';

      await logAction(
        'Regulação de Leitos',
        `Transferência externa ${acao} para o paciente '${paciente.nomePaciente}' por ${nomeUsuario}. Motivo: ${dados.motivo}, Destino: ${dados.destino}`
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
                  <div className="flex gap-1 shrink-0">
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
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button className="p-1.5 hover:bg-muted rounded-md"><CheckCircle className="h-4 w-4 text-green-600" /></button>
                        </TooltipTrigger>
                        <TooltipContent><p>Concluir Transferência</p></TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button className="p-1.5 hover:bg-muted rounded-md"><XCircle className="h-4 w-4 text-destructive" /></button>
                        </TooltipTrigger>
                        <TooltipContent><p>Cancelar Transferência</p></TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
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
    </Card>
  );
};

export default TransferenciaExternaPanel;
