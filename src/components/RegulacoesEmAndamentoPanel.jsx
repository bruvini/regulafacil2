import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader, ClipboardCopy, CheckCircle, Pencil, XCircle } from "lucide-react";
import { intervalToDuration, formatISO9075, differenceInMinutes } from 'date-fns';
import { 
  getSetoresCollection, 
  getLeitosCollection,
  getPacientesCollection,
  getInfeccoesCollection,
  onSnapshot,
  doc,
  updateDoc,
  deleteField,
  writeBatch,
  arrayUnion,
  serverTimestamp,
  db
} from '@/lib/firebase';
import { logAction } from '@/lib/auditoria';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import ConcluirRegulacaoModal from './modals/ConcluirRegulacaoModal';
import CancelarRegulacaoModal from './modals/CancelarRegulacaoModal';
import AlterarRegulacaoModal from './modals/AlterarRegulacaoModal';
const RegulacoesEmAndamentoPanel = () => {
  const [setores, setSetores] = useState([]);
  const [leitos, setLeitos] = useState([]);
  const [infeccoes, setInfeccoes] = useState([]);
  const [regulacoes, setRegulacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Estados dos modais
  const [modalConcluir, setModalConcluir] = useState({ open: false, paciente: null });
  const [modalCancelar, setModalCancelar] = useState({ open: false, paciente: null });
  const [modalAlterar, setModalAlterar] = useState({ isOpen: false, regulacao: null });
  
  const { toast } = useToast();
  const { currentUser } = useAuth();

  useEffect(() => {
    const unsubscribeSetores = onSnapshot(getSetoresCollection(), (snapshot) => {
      const setoresData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setSetores(setoresData);
    });

    const unsubscribeLeitos = onSnapshot(getLeitosCollection(), (snapshot) => {
      const leitosData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setLeitos(leitosData);
    });

    const unsubscribeInfeccoes = onSnapshot(getInfeccoesCollection(), (snapshot) => {
      const infeccoesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setInfeccoes(infeccoesData);
    });

    const unsubscribePacientes = onSnapshot(getPacientesCollection(), (snapshot) => {
      const pacientesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Filtrar apenas pacientes com regulação ativa
      const pacientesComRegulacao = pacientesData.filter(p => 
        p.regulacaoAtiva && 
        p.regulacaoAtiva.leitoOrigemId && 
        p.regulacaoAtiva.leitoDestinoId
      );
      
      setRegulacoes(pacientesComRegulacao);
      setLoading(false);
    });

    return () => {
      unsubscribeSetores();
      unsubscribeLeitos();
      unsubscribeInfeccoes();
      unsubscribePacientes();
    };
  }, []);

  // Função para calcular tempo desde o início da regulação
  const calcularTempoRegulacao = (iniciadoEm) => {
    if (!iniciadoEm) return 'Tempo não definido';
    
    let dataObj;
    
    // Se for um timestamp do Firebase
    if (iniciadoEm && typeof iniciadoEm.toDate === 'function') {
      dataObj = iniciadoEm.toDate();
    }
    // Se for já um objeto Date ou string de data
    else {
      dataObj = new Date(iniciadoEm);
    }
    
    // Verificar se a data é válida
    if (isNaN(dataObj.getTime())) {
      return 'Tempo inválido';
    }
    
    const agora = new Date();
    const duracao = intervalToDuration({ start: dataObj, end: agora });
    
    if (duracao.hours > 0) {
      return `Ativa há ${duracao.hours}h ${duracao.minutes || 0}m`;
    } else {
      return `Ativa há ${duracao.minutes || 0}m`;
    }
  };

  // Função para obter informações do leito
  const obterInfoLeito = (leitoId) => {
    const leito = leitos.find(l => l.id === leitoId);
    if (!leito) return { codigo: 'N/A', siglaSetor: 'N/A' };
    
    const setor = setores.find(s => s.id === leito.setorId);
    return {
      codigo: leito.codigoLeito || 'N/A',
      siglaSetor: setor?.siglaSetor || 'N/A'
    };
  };

  // Função para copiar texto personalizado
  const handleCopiarTexto = async (paciente) => {
    const { regulacaoAtiva } = paciente;
    const leitoOrigem = obterInfoLeito(regulacaoAtiva.leitoOrigemId);
    const leitoDestino = obterInfoLeito(regulacaoAtiva.leitoDestinoId);

    // Mapear nomes das infecções (se disponíveis)
    const nomesInfeccoes = (paciente.isolamentos || [])
      .map((iso) => infeccoes.find((inf) => inf.id === iso.infecaoId)?.nomeInfeccao)
      .filter(Boolean)
      .join(', ');

    const observacoes = paciente.observacoesNIR || paciente.observacoes || '';
    
    let texto = `*REGULAÇÃO EM ANDAMENTO*\n\n` +
      `*Paciente:* _${paciente.nomePaciente}_\n` +
      `*De:* _${leitoOrigem.siglaSetor} - ${leitoOrigem.codigo}_\n` +
      `*Para:* _${leitoDestino.siglaSetor} - ${leitoDestino.codigo}_`;

    if (nomesInfeccoes) {
      texto += `\n*Isolamento:* _${nomesInfeccoes}_`;
    }
    if (observacoes.trim()) {
      texto += `\n*Observações NIR:* _${observacoes.trim()}_`;
    }

    texto += `\n\n_Regulação iniciada há ${calcularTempoRegulacao(regulacaoAtiva.iniciadoEm).replace('Ativa há ', '')}_`;

    try {
      await navigator.clipboard.writeText(texto);
      toast({
        title: "Texto copiado",
        description: "Informações da regulação copiadas para a área de transferência.",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível copiar o texto.",
        variant: "destructive",
      });
    }
  };

  // Função para concluir regulação
  const handleConcluirRegulacao = async (paciente) => {
    const { regulacaoAtiva } = paciente;
    const leitoOrigem = obterInfoLeito(regulacaoAtiva.leitoOrigemId);
    const leitoDestino = obterInfoLeito(regulacaoAtiva.leitoDestinoId);
    
    try {
      const batch = writeBatch(db);
      
      // 1. Atualizar documento do paciente
      const pacienteRef = doc(getPacientesCollection(), paciente.id);
      const destinoSetorId = regulacaoAtiva.setorDestinoId || leitos.find(l => l.id === regulacaoAtiva.leitoDestinoId)?.setorId;
      const updatesPaciente = {
        regulacaoAtiva: deleteField(),
        leitoId: regulacaoAtiva.leitoDestinoId,
        setorId: destinoSetorId
      };
      
      // Verificar se é UTI e remover pedidoUTI se necessário
      const setorDestino = setores.find(s => s.id === destinoSetorId);
      if (setorDestino?.tipoSetor === 'UTI' && paciente.pedidoUTI) {
        updatesPaciente.pedidoUTI = deleteField();
      }
      
      // Remover pedidoRemanejamento se existir (parte do requisito)
      if (paciente.pedidoRemanejamento) {
        updatesPaciente.pedidoRemanejamento = deleteField();
      }
      
      batch.update(pacienteRef, updatesPaciente);
      
      // 2. Atualizar leito de origem
      const leitoOrigemRef = doc(getLeitosCollection(), regulacaoAtiva.leitoOrigemId);
      batch.update(leitoOrigemRef, {
        regulacaoEmAndamento: deleteField(),
        status: 'Higienização',
        historico: arrayUnion({
          status: 'Higienização',
          timestamp: new Date()
        })
      });
      
      // 3. Atualizar leito de destino
      const leitoDestinoRef = doc(getLeitosCollection(), regulacaoAtiva.leitoDestinoId);
      batch.update(leitoDestinoRef, {
        regulacaoEmAndamento: deleteField(),
        status: 'Ocupado',
        historico: arrayUnion({
          status: 'Ocupado',
          timestamp: new Date()
        })
      });
      
      // Executar transação
      await batch.commit();
      
      // Calcular tempo de regulação
      const inicioRegulacao = regulacaoAtiva.iniciadoEm?.toDate?.() || new Date(regulacaoAtiva.iniciadoEm);
      const tempoRegulacao = differenceInMinutes(new Date(), inicioRegulacao);
      
      // Auditoria detalhada
      const nomeUsuario = currentUser?.nomeCompleto || 'Usuário do Sistema';
      await logAction(
        'Regulação de Leitos', 
        `Regulação para o paciente '${paciente.nomePaciente}' (do leito ${leitoOrigem.siglaSetor} - ${leitoOrigem.codigo} para ${leitoDestino.siglaSetor} - ${leitoDestino.codigo}) foi concluída por ${nomeUsuario} em ${tempoRegulacao} minutos.`
      );
      
      // Log condicional de UTI
      if (setorDestino?.tipoSetor === 'UTI' && paciente.pedidoUTI) {
        const inicioUTI = paciente.pedidoUTI.solicitadoEm?.toDate?.() || new Date(paciente.pedidoUTI.solicitadoEm);
        const tempoEspera = differenceInMinutes(new Date(), inicioUTI);
        await logAction(
          'Regulação de Leitos',
          `Pedido de UTI do paciente '${paciente.nomePaciente}' foi atendido. Tempo de espera: ${tempoEspera} minutos.`
        );
      }
      
      toast({
        title: "Regulação concluída",
        description: `Paciente ${paciente.nomePaciente} transferido com sucesso.`,
      });
      
      setModalConcluir({ open: false, paciente: null });
      
    } catch (error) {
      console.error('Erro ao concluir regulação:', error);
      toast({
        title: "Erro",
        description: "Erro ao concluir a regulação. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  // Função para cancelar regulação
  const handleCancelarRegulacao = async (paciente, justificativa, mensagemCancelamento) => {
    const { regulacaoAtiva } = paciente;
    const leitoOrigem = obterInfoLeito(regulacaoAtiva.leitoOrigemId);
    const leitoDestino = obterInfoLeito(regulacaoAtiva.leitoDestinoId);
    
    try {
      const batch = writeBatch(db);
      
      // 1. Atualizar documento do paciente
      const pacienteRef = doc(getPacientesCollection(), paciente.id);
      batch.update(pacienteRef, {
        regulacaoAtiva: deleteField()
      });
      
      // 2. Atualizar leito de origem
      const leitoOrigemRef = doc(getLeitosCollection(), regulacaoAtiva.leitoOrigemId);
      batch.update(leitoOrigemRef, {
        regulacaoEmAndamento: deleteField()
      });
      
      // 3. Atualizar leito de destino
      const leitoDestinoRef = doc(getLeitosCollection(), regulacaoAtiva.leitoDestinoId);
      batch.update(leitoDestinoRef, {
        regulacaoEmAndamento: deleteField(),
        status: 'Vago',
        historico: arrayUnion({
          status: 'Vago',
          timestamp: new Date()
        })
      });
      
      // Executar transação
      await batch.commit();
      
      // Copiar mensagem para área de transferência
      await navigator.clipboard.writeText(mensagemCancelamento);
      
      // Auditoria
      const nomeUsuario = currentUser?.nomeCompleto || 'Usuário do Sistema';
      await logAction(
        'Regulação de Leitos',
        `Regulação para o paciente '${paciente.nomePaciente}' (do leito ${leitoOrigem.siglaSetor} - ${leitoOrigem.codigo} para ${leitoDestino.siglaSetor} - ${leitoDestino.codigo}) foi CANCELADA por ${nomeUsuario}. Motivo: '${justificativa}'.`
      );
      
      toast({
        title: "Regulação cancelada",
        description: "Regulação cancelada e mensagem copiada para área de transferência.",
      });
      
      setModalCancelar({ open: false, paciente: null });
      
    } catch (error) {
      console.error('Erro ao cancelar regulação:', error);
      toast({
        title: "Erro",
        description: "Erro ao cancelar a regulação. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const RegulacaoCard = ({ paciente }) => {
    const { regulacaoAtiva } = paciente;
    const leitoOrigem = obterInfoLeito(regulacaoAtiva.leitoOrigemId);
    const leitoDestino = obterInfoLeito(regulacaoAtiva.leitoDestinoId);
    const tempoRegulacao = calcularTempoRegulacao(regulacaoAtiva.iniciadoEm);

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
            <Badge variant="outline" className="text-xs font-medium bg-orange-100 text-orange-800 border-orange-300">
              Em Regulação
            </Badge>
          </div>

          {/* Origem e Destino */}
          <div className="text-xs text-muted-foreground space-y-1">
            <div>
              <span className="font-medium">DE: </span>
              <span className="font-semibold">{leitoOrigem.siglaSetor} - {leitoOrigem.codigo}</span>
            </div>
            <div>
              <span className="font-medium">PARA: </span>
              <span className="font-semibold">{leitoDestino.siglaSetor} - {leitoDestino.codigo}</span>
            </div>
          </div>

          {/* Tempo da Regulação */}
          <div className="text-xs text-muted-foreground">
            <span className="font-medium">{tempoRegulacao}</span>
          </div>

          {/* Ações */}
          <div className="flex justify-end gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button 
                    className="p-1.5 hover:bg-muted rounded-md transition-colors"
                    onClick={() => handleCopiarTexto(paciente)}
                  >
                    <ClipboardCopy className="h-4 w-4 text-muted-foreground" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Copiar Texto Personalizado</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button 
                    className="p-1.5 hover:bg-muted rounded-md transition-colors"
                    onClick={() => setModalConcluir({ open: true, paciente })}
                  >
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Concluir Regulação</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button 
                    className="p-1.5 hover:bg-muted rounded-md transition-colors"
                    onClick={() => setModalAlterar({ isOpen: true, regulacao: paciente })}
                  >
                    <Pencil className="h-4 w-4 text-blue-600" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Alterar Regulação</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button 
                    className="p-1.5 hover:bg-muted rounded-md transition-colors"
                    onClick={() => setModalCancelar({ open: true, paciente })}
                  >
                    <XCircle className="h-4 w-4 text-destructive" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Cancelar Regulação</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </Card>
    );
  };

  return (
    <>
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Loader className="h-5 w-5 text-orange-600" />
            Regulações em Andamento
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader className="h-6 w-6 animate-spin mr-2" />
              <span>Carregando regulações...</span>
            </div>
          ) : regulacoes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Loader className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Nenhuma regulação em andamento</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {regulacoes.map((paciente) => (
                <RegulacaoCard key={paciente.id} paciente={paciente} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modais */}
      {modalConcluir.paciente && (
        <ConcluirRegulacaoModal
          open={modalConcluir.open}
          onOpenChange={(open) => setModalConcluir({ open, paciente: open ? modalConcluir.paciente : null })}
          paciente={modalConcluir.paciente}
          leitoOrigem={obterInfoLeito(modalConcluir.paciente.regulacaoAtiva.leitoOrigemId)}
          leitoDestino={obterInfoLeito(modalConcluir.paciente.regulacaoAtiva.leitoDestinoId)}
          onConfirmar={handleConcluirRegulacao}
        />
      )}

      {modalCancelar.paciente && (
        <CancelarRegulacaoModal
          open={modalCancelar.open}
          onOpenChange={(open) => setModalCancelar({ open, paciente: open ? modalCancelar.paciente : null })}
          paciente={modalCancelar.paciente}
          leitoOrigem={obterInfoLeito(modalCancelar.paciente.regulacaoAtiva.leitoOrigemId)}
          leitoDestino={obterInfoLeito(modalCancelar.paciente.regulacaoAtiva.leitoDestinoId)}
          onConfirmar={handleCancelarRegulacao}
        />
      )}

      {modalAlterar.regulacao && (
        <AlterarRegulacaoModal
          isOpen={modalAlterar.isOpen}
          onClose={() => setModalAlterar({ isOpen: false, regulacao: null })}
          regulacao={modalAlterar.regulacao}
        />
      )}
    </>
  );
};

export default RegulacoesEmAndamentoPanel;