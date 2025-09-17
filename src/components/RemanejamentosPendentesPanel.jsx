import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowRightLeft, Clock, User, MapPin } from "lucide-react";
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  getPacientesCollection,
  getLeitosCollection,
  getSetoresCollection,
  onSnapshot,
  doc,
  updateDoc,
  deleteField
} from '@/lib/firebase';
import { logAction } from '@/lib/auditoria';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import RegularPacienteModal from './modals/RegularPacienteModal';

const RemanejamentosPendentesPanel = () => {
  const [pacientes, setPacientes] = useState([]);
  const [leitos, setLeitos] = useState([]);
  const [setores, setSetores] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Estados para modais
  const [modalRegular, setModalRegular] = useState({ isOpen: false, paciente: null });
  const [modalCancelar, setModalCancelar] = useState({ isOpen: false, paciente: null });
  
  const { toast } = useToast();
  const { currentUser } = useAuth();

  // Buscar dados em tempo real
  useEffect(() => {
    const unsubscribePacientes = onSnapshot(getPacientesCollection(), (snapshot) => {
      const pacientesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setPacientes(pacientesData);
    });

    const unsubscribeLeitos = onSnapshot(getLeitosCollection(), (snapshot) => {
      const leitosData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setLeitos(leitosData);
    });

    const unsubscribeSetores = onSnapshot(getSetoresCollection(), (snapshot) => {
      const setoresData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setSetores(setoresData);
      setLoading(false);
    });

    return () => {
      unsubscribePacientes();
      unsubscribeLeitos();
      unsubscribeSetores();
    };
  }, []);

  // Filtrar e agrupar pacientes com pedido de remanejamento
  const remanejamentosAgrupados = useMemo(() => {
    // Filtrar pacientes com pedidoRemanejamento e SEM regulacaoAtiva
    const pacientesComRemanejamento = pacientes.filter(p => 
      p.pedidoRemanejamento && !p.regulacaoAtiva
    );

    // Agrupar por tipo de remanejamento
    const grupos = {};
    pacientesComRemanejamento.forEach(paciente => {
      const tipo = paciente.pedidoRemanejamento.tipo;
      if (!grupos[tipo]) {
        grupos[tipo] = [];
      }
      grupos[tipo].push(paciente);
    });

    return grupos;
  }, [pacientes]);

  // Função para obter informações do leito atual do paciente
  const obterLocalizacaoAtual = (paciente) => {
    const leito = leitos.find(l => l.id === paciente.leitoId);
    if (!leito) return { setor: 'N/A', leito: 'N/A' };
    
    const setor = setores.find(s => s.id === leito.setorId);
    return {
      setor: setor?.siglaSetor || 'N/A',
      leito: leito.codigoLeito || 'N/A'
    };
  };

  // Função para calcular tempo desde a solicitação
  const calcularTempoSolicitacao = (timestamp) => {
    if (!timestamp) return 'N/A';
    
    let data;
    if (timestamp && typeof timestamp.toDate === 'function') {
      data = timestamp.toDate();
    } else {
      data = new Date(timestamp);
    }
    
    if (isNaN(data.getTime())) return 'N/A';
    
    return formatDistanceToNow(data, { 
      addSuffix: true, 
      locale: ptBR 
    });
  };

  // Ação para cancelar remanejamento
  const handleCancelarRemanejamento = async (paciente) => {
    try {
      const pacienteRef = doc(getPacientesCollection(), paciente.id);
      await updateDoc(pacienteRef, {
        pedidoRemanejamento: deleteField()
      });

      const nomeUsuario = currentUser?.nomeCompleto || 'Usuário do Sistema';
      await logAction(
        'Regulação de Leitos',
        `Pedido de remanejamento para o paciente '${paciente.nomePaciente}' foi cancelado por ${nomeUsuario}.`
      );

      toast({
        title: "Remanejamento cancelado",
        description: `Pedido de remanejamento do paciente ${paciente.nomePaciente} foi cancelado.`,
      });

      setModalCancelar({ isOpen: false, paciente: null });
    } catch (error) {
      console.error('Erro ao cancelar remanejamento:', error);
      toast({
        title: "Erro",
        description: "Erro ao cancelar o remanejamento. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  // Ação para iniciar regulação
  const handleRemanejarPaciente = (paciente) => {
    setModalRegular({ isOpen: true, paciente });
  };

  // Componente do card do paciente
  const PacienteRemanejamentoCard = ({ paciente }) => {
    const localizacao = obterLocalizacaoAtual(paciente);
    const tempoSolicitacao = calcularTempoSolicitacao(paciente.pedidoRemanejamento.timestamp);
    const isCancelavel = paciente.pedidoRemanejamento?.tipo !== 'Risco de Contaminação Cruzada';

    return (
      <Card className="p-4 hover:shadow-md transition-shadow border border-muted">
        <div className="space-y-3">
          {/* Nome do Paciente */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-sm leading-tight truncate">
                {paciente.nomePaciente}
              </h4>
            </div>
            <Badge variant="outline" className="text-xs font-medium bg-blue-100 text-blue-800 border-blue-300">
              <ArrowRightLeft className="h-3 w-3 mr-1" />
              Pendente
            </Badge>
          </div>

          {/* Localização Atual */}
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            <span className="font-medium">Localização Atual: </span>
            <span className="font-semibold">{localizacao.setor} - {localizacao.leito}</span>
          </div>

          {/* Tempo de Solicitação */}
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span className="font-medium">Solicitado: </span>
            <span>{tempoSolicitacao}</span>
          </div>

          {/* Justificativa */}
          {paciente.pedidoRemanejamento?.descricao && (
            <div className="text-xs text-muted-foreground">
              <span className="font-medium">Justificativa: </span>
              <span className="italic">{paciente.pedidoRemanejamento.descricao}</span>
            </div>
          )}

          {/* Ações */}
          <div className="flex justify-end gap-2 pt-2 border-t">
            {isCancelavel && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setModalCancelar({ isOpen: true, paciente })}
              >
                Cancelar
              </Button>
            )}
            <Button
              variant="default"
              size="sm"
              onClick={() => handleRemanejarPaciente(paciente)}
            >
              Remanejar Paciente
            </Button>
          </div>
        </div>
      </Card>
    );
  };

  if (loading) {
    return (
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ArrowRightLeft className="h-5 w-5 text-teal-600" />
            Remanejamentos Pendentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mr-2"></div>
            <span>Carregando remanejamentos...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalRemanejamentos = Object.values(remanejamentosAgrupados).reduce((acc, grupo) => acc + grupo.length, 0);

  return (
    <>
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ArrowRightLeft className="h-5 w-5 text-teal-600" />
            Remanejamentos Pendentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {totalRemanejamentos === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ArrowRightLeft className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm font-medium">Não há remanejamentos pendentes</p>
              <p className="text-xs mt-1">
                Solicitar um remanejamento através do menu de ações no Mapa de Leitos
              </p>
            </div>
          ) : (
            <Accordion type="multiple" className="w-full">
              {Object.entries(remanejamentosAgrupados).map(([tipo, pacientesGrupo]) => (
                <AccordionItem key={tipo} value={tipo}>
                  <AccordionTrigger className="text-left">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{tipo}</span>
                      <Badge variant="secondary" className="text-xs">
                        {pacientesGrupo.length}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2">
                      {pacientesGrupo.map((paciente) => (
                        <PacienteRemanejamentoCard key={paciente.id} paciente={paciente} />
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>

      {/* Modal de Regulação */}
      {modalRegular.paciente && (
        <RegularPacienteModal
          isOpen={modalRegular.isOpen}
          onClose={() => setModalRegular({ isOpen: false, paciente: null })}
          paciente={modalRegular.paciente}
          modo="remanejamento"
          infeccoes={[]} // Infecções serão carregadas dentro do modal
        />
      )}

      {/* Modal de Confirmação de Cancelamento */}
      <AlertDialog open={modalCancelar.isOpen} onOpenChange={(open) => setModalCancelar({ isOpen: open, paciente: open ? modalCancelar.paciente : null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Remanejamento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar o pedido de remanejamento para o paciente{' '}
              <strong>{modalCancelar.paciente?.nomePaciente}</strong>?
              <br />
              <br />
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Não, manter</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => handleCancelarRemanejamento(modalCancelar.paciente)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Sim, cancelar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default RemanejamentosPendentesPanel;