import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowRightCircle, Truck, XCircle } from "lucide-react";
import { intervalToDuration } from 'date-fns';
import { 
  getPacientesCollection, 
  getSetoresCollection, 
  getLeitosCollection,
  getInfeccoesCollection,
  onSnapshot 
} from '@/lib/firebase';
import RegularPacienteModal from '@/components/modals/RegularPacienteModal';

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

const FilaEsperaUTIPanel = () => {
  const [pacientes, setPacientes] = useState([]);
  const [setores, setSetores] = useState([]);
  const [leitos, setLeitos] = useState([]);
  const [infeccoes, setInfeccoes] = useState([]);
  const [modalRegularAberto, setModalRegularAberto] = useState(false);
  const [pacienteSelecionado, setPacienteSelecionado] = useState(null);

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
    const unsubInf = onSnapshot(getInfeccoesCollection(), (snap) => {
      setInfeccoes(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => {
      unsubPac();
      unsubSet();
      unsubLei();
      unsubInf();
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

  // Filtrar pacientes que têm pedido UTI, não estão em regulação ativa e não estão em UTI
  const pedidos = pacientes.filter((p) => {
    if (!p?.pedidoUTI) return false;
    if (p?.regulacaoAtiva) return false;
    
    // Verificar se o paciente já está em UTI
    const leitoAtual = leitos.find(l => l.id === p.leitoId);
    if (leitoAtual) {
      const setorAtual = setores.find(s => s.id === leitoAtual.setorId);
      if (setorAtual?.tipoSetor === 'UTI') return false;
    }
    
    return true;
  });

  const handleIniciarRegulacao = (paciente) => {
    setPacienteSelecionado(paciente);
    setModalRegularAberto(true);
  };

  const fecharModal = () => {
    setModalRegularAberto(false);
    setPacienteSelecionado(null);
  };

  return (
    <Card className="shadow-card card-interactive">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          Fila de Espera - UTI
        </CardTitle>
      </CardHeader>
      <CardContent>
        {pedidos.length === 0 ? (
          <div className="text-muted-foreground text-sm">Nenhum paciente aguardando UTI</div>
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
                      Aguardando há {formatDurationShort(p?.pedidoUTI?.solicitadoEm)}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button 
                            className="p-1.5 hover:bg-muted rounded-md"
                            onClick={() => handleIniciarRegulacao(p)}
                          >
                            <ArrowRightCircle className="h-4 w-4 text-primary" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent><p>Regular Paciente</p></TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button className="p-1.5 hover:bg-muted rounded-md"><Truck className="h-4 w-4 text-blue-600" /></button>
                        </TooltipTrigger>
                        <TooltipContent><p>Transferência Externa</p></TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button className="p-1.5 hover:bg-muted rounded-md"><XCircle className="h-4 w-4 text-destructive" /></button>
                        </TooltipTrigger>
                        <TooltipContent><p>Cancelar Pedido de UTI</p></TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Modal de Regulação */}
      <RegularPacienteModal
        isOpen={modalRegularAberto}
        onClose={fecharModal}
        paciente={pacienteSelecionado}
        modo="uti"
        infeccoes={infeccoes}
      />
    </Card>
  );
};

export default FilaEsperaUTIPanel;
