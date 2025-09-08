import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { 
  ChevronDown, 
  MoreVertical, 
  Loader2, 
  Flame, 
  Star,
  MessageSquareQuote,
  BedDouble,
  ArrowRightLeft,
  Truck,
  UserCheck,
  Home,
  MoveUpRight,
  StickyNote,
  AlertTriangle,
  Calendar,
  LogOut,
  Search,
  Filter
} from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  getSetoresCollection, 
  getLeitosCollection, 
  getQuartosCollection,
  getPacientesCollection,
  onSnapshot,
  doc,
  updateDoc,
  arrayUnion,
  serverTimestamp,
  deleteField,
  deleteDoc
} from '@/lib/firebase';
import { logAction } from '@/lib/auditoria';
import { useToast } from '@/hooks/use-toast';
import LiberarLeitoModal from './modals/LiberarLeitoModal';
import ObservacoesModal from './modals/ObservacoesModal';
import MoverPacienteModal from './modals/MoverPacienteModal';
import RemanejamentoModal from './modals/RemanejamentoModal';
import TransferenciaExternaModal from './modals/TransferenciaExternaModal';

// Color mapping for sector types
const getSectorTypeColor = (tipoSetor) => {
  const colorMap = {
    'Emergência': 'border-t-4 border-red-500',
    'UTI': 'border-t-4 border-yellow-500', 
    'Enfermaria': 'border-t-4 border-green-500',
    'Centro Cirúrgico': 'border-t-4 border-purple-500'
  };
  return colorMap[tipoSetor] || 'border-t-4 border-gray-500';
};

// Componente LeitoCard Dinâmico
const LeitoCard = ({ 
  leito, 
  onBloquearLeito, 
  onSolicitarHigienizacao, 
  onDesbloquearLeito, 
  onFinalizarHigienizacao, 
  onPriorizarHigienizacao,
  onLiberarLeito,
  onMoverPaciente,
  onObservacoes,
  onSolicitarUTI,
  onSolicitarRemanejamento,
  onTransferenciaExterna,
  onProvavelAlta,
  onAltaNoLeito
}) => {
  const { toast } = useToast();

  const getTempoNoStatus = () => {
    if (!leito.historico || leito.historico.length === 0) {
      return 'sem histórico';
    }

    const ultimoRegistro = leito.historico[leito.historico.length - 1];
    if (!ultimoRegistro.timestamp) {
      return 'sem timestamp';
    }

    try {
      const timestamp = ultimoRegistro.timestamp.toDate 
        ? ultimoRegistro.timestamp.toDate() 
        : new Date(ultimoRegistro.timestamp);
      
      return formatDistanceToNow(timestamp, { 
        addSuffix: true, 
        locale: ptBR 
      });
    } catch (error) {
      return 'tempo indisponível';
    }
  };

  const calcularIdade = (dataNascimento) => {
    if (!dataNascimento) return 'N/A';
    try {
      const nascimento = dataNascimento.toDate ? dataNascimento.toDate() : new Date(dataNascimento);
      const hoje = new Date();
      const idade = hoje.getFullYear() - nascimento.getFullYear();
      const mesAtual = hoje.getMonth();
      const diaAtual = hoje.getDate();
      const mesNascimento = nascimento.getMonth();
      const diaNascimento = nascimento.getDate();
      
      if (mesAtual < mesNascimento || (mesAtual === mesNascimento && diaAtual < diaNascimento)) {
        return idade - 1;
      }
      return idade;
    } catch (error) {
      return 'N/A';
    }
  };

  const getCardStyle = () => {
    switch (leito.status) {
      case 'Ocupado':
        const genderBorder = leito.paciente?.sexo === 'M' ? 'border-blue-500' : 
                           leito.paciente?.sexo === 'F' ? 'border-pink-500' : 'border-red-500';
        return `bg-red-50 border-4 ${genderBorder} hover:shadow-lg transition-all shadow-sm`;
      case 'Vago':
        return "bg-white border-2 border-blue-200 hover:border-blue-300 transition-colors shadow-sm";
      case 'Bloqueado':
        return "bg-gray-50 border-2 border-gray-300 hover:border-gray-400 transition-colors shadow-sm";
      case 'Higienização':
        return "bg-yellow-50 border-2 border-yellow-300 hover:border-yellow-400 transition-colors shadow-sm";
      default:
        return "bg-white border-2 border-gray-200 hover:border-gray-300 transition-colors shadow-sm";
    }
  };

  const getBadgeStyle = () => {
    switch (leito.status) {
      case 'Ocupado':
        return "bg-red-100 text-red-800 border-red-200";
      case 'Vago':
        return "bg-green-100 text-green-800 border-green-200";
      case 'Bloqueado':
        return "bg-gray-100 text-gray-800 border-gray-200";
      case 'Higienização':
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const renderStatusBadges = () => {
    if (leito.status !== 'Ocupado' || !leito.paciente) return null;

    const badges = [];
    const paciente = leito.paciente;

    if (paciente.observacoes && paciente.observacoes.length > 0) {
      badges.push(
        <Badge key="obs" variant="outline" className="text-xs p-1">
          <MessageSquareQuote className="h-3 w-3" />
        </Badge>
      );
    }

    if (paciente.pedidoUTI) {
      badges.push(
        <Badge key="uti" variant="destructive" className="text-xs p-1">
          <BedDouble className="h-3 w-3" />
        </Badge>
      );
    }

    if (paciente.pedidoRemanejamento) {
      badges.push(
        <Badge key="rem" variant="outline" className="text-xs p-1">
          <ArrowRightLeft className="h-3 w-3" />
        </Badge>
      );
    }

    if (paciente.pedidoTransferenciaExterna) {
      badges.push(
        <Badge key="trans" variant="outline" className="text-xs p-1">
          <Truck className="h-3 w-3" />
        </Badge>
      );
    }

    if (paciente.provavelAlta) {
      badges.push(
        <Badge key="alta" variant="outline" className="text-xs p-1">
          <UserCheck className="h-3 w-3" />
        </Badge>
      );
    }

    if (paciente.altaNoLeito) {
      badges.push(
        <Badge key="altaleito" variant="outline" className="text-xs p-1">
          <Home className="h-3 w-3" />
        </Badge>
      );
    }

    return badges.length > 0 ? (
      <div className="flex flex-wrap gap-1 mt-2">
        {badges}
      </div>
    ) : null;
  };

  const renderActions = () => {
    switch (leito.status) {
      case 'Ocupado':
        return (
          <>
            <DropdownMenuItem onClick={() => onLiberarLeito(leito, leito.paciente)}>
              <LogOut className="h-4 w-4 mr-2" />
              LIBERAR LEITO
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onMoverPaciente(leito, leito.paciente)}>
              <MoveUpRight className="h-4 w-4 mr-2" />
              MOVER PACIENTE
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onObservacoes(leito.paciente)}>
              <StickyNote className="h-4 w-4 mr-2" />
              OBSERVAÇÕES
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSolicitarUTI(leito.paciente)}>
              <AlertTriangle className="h-4 w-4 mr-2" />
              {leito.paciente?.pedidoUTI ? 'REMOVER PEDIDO UTI' : 'SOLICITAR UTI'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSolicitarRemanejamento(leito.paciente)}>
              <ArrowRightLeft className="h-4 w-4 mr-2" />
              SOLICITAR REMANEJAMENTO
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onTransferenciaExterna(leito.paciente)}>
              <Truck className="h-4 w-4 mr-2" />
              TRANSFERÊNCIA EXTERNA
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onProvavelAlta(leito.paciente)}>
              <Calendar className="h-4 w-4 mr-2" />
              {leito.paciente?.provavelAlta ? 'REMOVER PROVÁVEL ALTA' : 'PROVÁVEL ALTA'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAltaNoLeito(leito.paciente)}>
              <Home className="h-4 w-4 mr-2" />
              {leito.paciente?.altaNoLeito ? 'REMOVER ALTA NO LEITO' : 'ALTA NO LEITO'}
            </DropdownMenuItem>
          </>
        );
      case 'Vago':
        return (
          <>
            <DropdownMenuItem disabled className="opacity-50">
              INTERNAR PACIENTE MANUALMENTE
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onBloquearLeito(leito)}>
              BLOQUEAR LEITO
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSolicitarHigienizacao(leito)}>
              SOLICITAR HIGIENIZAÇÃO
            </DropdownMenuItem>
          </>
        );
      case 'Bloqueado':
        return (
          <DropdownMenuItem onClick={() => onDesbloquearLeito(leito)}>
            DESBLOQUEAR LEITO
          </DropdownMenuItem>
        );
      case 'Higienização':
        return (
          <>
            <DropdownMenuItem onClick={() => onFinalizarHigienizacao(leito)}>
              FINALIZAR HIGIENIZAÇÃO
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onPriorizarHigienizacao(leito)}>
              {leito.higienizacaoPrioritaria ? 'REMOVER PRIORIDADE' : 'PRIORIZAR HIGIENIZAÇÃO'}
            </DropdownMenuItem>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <Card className={getCardStyle()}>
      <CardContent className="p-4 relative">
        {/* Dropdown de ações */}
        <div className="absolute top-2 right-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <MoreVertical className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {renderActions()}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Conteúdo do card */}
        <div className="space-y-3">
          <div>
            <h4 className="font-semibold text-sm text-gray-900">
              {leito.codigoLeito}
            </h4>
            <div className="flex items-center gap-1 mt-1">
              {leito.isPCP && (
                <Badge variant="secondary" className="text-xs">
                  PCP
                </Badge>
              )}
              {leito.status === 'Higienização' && leito.higienizacaoPrioritaria && (
                <Badge variant="destructive" className="text-xs flex items-center gap-1">
                  <Flame className="h-3 w-3" />
                  Prioridade
                </Badge>
              )}
            </div>
          </div>

          {/* Informações do paciente para leitos ocupados */}
          {leito.status === 'Ocupado' && leito.paciente && (
            <div className="space-y-2">
              <div>
                <p className="font-medium text-sm text-gray-900">
                  {leito.paciente.nomePaciente}
                </p>
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <span>{calcularIdade(leito.paciente.dataNascimento)} anos</span>
                  {leito.paciente.especialidade && (
                    <>
                      <span>•</span>
                      <span>{leito.paciente.especialidade}</span>
                    </>
                  )}
                </div>
              </div>
              {renderStatusBadges()}
            </div>
          )}

          <Badge variant="outline" className={getBadgeStyle()}>
            {leito.status}
          </Badge>

          {/* Informações específicas por status */}
          {leito.status === 'Bloqueado' && leito.motivoBloqueio && (
            <div className="text-xs text-gray-600 bg-gray-100 p-2 rounded">
              <strong>Motivo:</strong> {leito.motivoBloqueio}
            </div>
          )}

          <div className="text-xs text-muted-foreground">
            {getTempoNoStatus()}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Componente principal MapaLeitosPanel
const MapaLeitosPanel = () => {
  const [setores, setSetores] = useState([]);
  const [quartos, setQuartos] = useState([]);
  const [leitos, setLeitos] = useState([]);
  const [pacientes, setPacientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState({});
  const [expandedSetores, setExpandedSetores] = useState({});
  
  // Estado dos filtros
  const [filtros, setFiltros] = useState({
    busca: '',
    status: [],
    sexo: [],
    especialidade: '',
    isPCP: false,
    comPedidoUTI: false,
    comProvavelAlta: false,
    comAltaNoLeito: false,
    comSolicitacaoRemanejamento: false,
    comPedidoTransferenciaExterna: false
  });
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  
  // Estados dos modais
  const [modalBloquear, setModalBloquear] = useState({ open: false, leito: null });
  const [modalHigienizacao, setModalHigienizacao] = useState({ open: false, leito: null });
  const [modalDesbloquear, setModalDesbloquear] = useState({ open: false, leito: null });
  const [modalFinalizarHigienizacao, setModalFinalizarHigienizacao] = useState({ open: false, leito: null });
  const [modalLiberarLeito, setModalLiberarLeito] = useState({ open: false, leito: null, paciente: null });
  const [modalMoverPaciente, setModalMoverPaciente] = useState({ open: false, leito: null, paciente: null });
  const [modalObservacoes, setModalObservacoes] = useState({ open: false, paciente: null });
  const [modalRemanejamento, setModalRemanejamento] = useState({ open: false, paciente: null });
  const [modalTransferenciaExterna, setModalTransferenciaExterna] = useState({ open: false, paciente: null });
  const [motivoBloqueio, setMotivoBloqueio] = useState('');
  
  const { toast } = useToast();

  // Funções de ação dos leitos
  const handleBloquearLeito = async () => {
    if (!modalBloquear.leito || !motivoBloqueio.trim()) return;
    
    try {
      const leitoRef = doc(getLeitosCollection(), modalBloquear.leito.id);
      await updateDoc(leitoRef, {
        status: 'Bloqueado',
        motivoBloqueio: motivoBloqueio.trim(),
        historico: arrayUnion({
          status: 'Bloqueado',
          timestamp: new Date()
        })
      });
      await logAction('Mapa de Leitos', `Leito '${modalBloquear.leito.codigoLeito}' foi bloqueado. Motivo: '${motivoBloqueio.trim()}'.`);
      
      toast({
        title: "Leito bloqueado",
        description: `Leito ${modalBloquear.leito.codigoLeito} foi bloqueado com sucesso.`,
      });
      
      setModalBloquear({ open: false, leito: null });
      setMotivoBloqueio('');
    } catch (error) {
      console.error('Erro ao bloquear leito:', error);
      toast({
        title: "Erro",
        description: "Erro ao bloquear o leito. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleSolicitarHigienizacao = async (leito) => {
    try {
      const leitoRef = doc(getLeitosCollection(), leito.id);
      await updateDoc(leitoRef, {
        status: 'Higienização',
        higienizacaoPrioritaria: false,
        historico: arrayUnion({
          status: 'Higienização',
          timestamp: new Date()
        })
      });
      await logAction('Mapa de Leitos', `Solicitada higienização para o leito '${leito.codigoLeito}'.`);
      
      toast({
        title: "Higienização solicitada",
        description: `Higienização do leito ${leito.codigoLeito} foi solicitada.`,
      });
      
      setModalHigienizacao({ open: false, leito: null });
    } catch (error) {
      console.error('Erro ao solicitar higienização:', error);
      toast({
        title: "Erro",
        description: "Erro ao solicitar higienização. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleDesbloquearLeito = async (leito) => {
    try {
      const leitoRef = doc(getLeitosCollection(), leito.id);
      await updateDoc(leitoRef, {
        status: 'Vago',
        motivoBloqueio: deleteField(),
        historico: arrayUnion({
          status: 'Vago',
          timestamp: new Date()
        })
      });
      await logAction('Mapa de Leitos', `Leito '${leito.codigoLeito}' foi desbloqueado.`);
      
      toast({
        title: "Leito desbloqueado",
        description: `Leito ${leito.codigoLeito} foi desbloqueado com sucesso.`,
      });
      
      setModalDesbloquear({ open: false, leito: null });
    } catch (error) {
      console.error('Erro ao desbloquear leito:', error);
      toast({
        title: "Erro",
        description: "Erro ao desbloquear o leito. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleFinalizarHigienizacao = async (leito) => {
    try {
      const leitoRef = doc(getLeitosCollection(), leito.id);
      await updateDoc(leitoRef, {
        status: 'Vago',
        higienizacaoPrioritaria: deleteField(),
        historico: arrayUnion({
          status: 'Vago',
          timestamp: new Date()
        })
      });
      await logAction('Mapa de Leitos', `Higienização do leito '${leito.codigoLeito}' foi finalizada.`);
      
      toast({
        title: "Higienização finalizada",
        description: `Higienização do leito ${leito.codigoLeito} foi finalizada.`,
      });
      
      setModalFinalizarHigienizacao({ open: false, leito: null });
    } catch (error) {
      console.error('Erro ao finalizar higienização:', error);
      toast({
        title: "Erro",
        description: "Erro ao finalizar higienização. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handlePriorizarHigienizacao = async (leito) => {
    try {
      const leitoRef = doc(getLeitosCollection(), leito.id);
      await updateDoc(leitoRef, {
        higienizacaoPrioritaria: !leito.higienizacaoPrioritaria
      });
      await logAction('Mapa de Leitos', !leito.higienizacaoPrioritaria
        ? `Higienização do leito '${leito.codigoLeito}' foi marcada como prioritária.`
        : `Prioridade de higienização do leito '${leito.codigoLeito}' foi removida.`
      );
      
      toast({
        title: leito.higienizacaoPrioritaria ? "Prioridade removida" : "Higienização priorizada",
        description: `Leito ${leito.codigoLeito} ${leito.higienizacaoPrioritaria ? 'não é mais' : 'agora é'} prioritário.`,
      });
    } catch (error) {
      console.error('Erro ao alterar prioridade:', error);
      toast({
        title: "Erro",
        description: "Erro ao alterar prioridade. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  // Handlers para leitos ocupados
  const handleLiberarLeito = async (leito, paciente) => {
    try {
      // Excluir documento do paciente
      const pacienteRef = doc(getPacientesCollection(), paciente.id);
      await deleteDoc(pacienteRef);
      
      // Atualizar leito para higienização
      const leitoRef = doc(getLeitosCollection(), leito.id);
      await updateDoc(leitoRef, {
        status: 'Higienização',
        historico: arrayUnion({
          status: 'Higienização',
          timestamp: serverTimestamp()
        })
      });
      
      await logAction('Mapa de Leitos', `Leito '${leito.codigoLeito}' foi liberado. Paciente '${paciente.nomePaciente}' foi dado alta.`);
      
      toast({
        title: "Leito liberado",
        description: `Leito ${leito.codigoLeito} foi liberado com sucesso.`,
      });
    } catch (error) {
      console.error('Erro ao liberar leito:', error);
      toast({
        title: "Erro",
        description: "Erro ao liberar o leito. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleToggleUTI = async (paciente) => {
    try {
      const pacienteRef = doc(getPacientesCollection(), paciente.id);
      
      if (paciente.pedidoUTI) {
        // Remover pedido de UTI
        await updateDoc(pacienteRef, {
          pedidoUTI: deleteField()
        });
        
        toast({
          title: "Pedido removido",
          description: "Pedido de UTI foi removido.",
        });
        
        await logAction('Mapa de Leitos', `Pedido de UTI do paciente '${paciente.nomePaciente}' foi removido.`);
      } else {
        // Adicionar pedido de UTI
        await updateDoc(pacienteRef, {
          pedidoUTI: {
            solicitadoEm: serverTimestamp()
          }
        });
        
        toast({
          title: "UTI solicitada",
          description: "Pedido de UTI foi registrado.",
        });
        
        await logAction('Mapa de Leitos', `UTI solicitada para o paciente '${paciente.nomePaciente}'.`);
      }
    } catch (error) {
      console.error('Erro ao gerenciar pedido de UTI:', error);
      toast({
        title: "Erro",
        description: "Erro ao processar pedido de UTI. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleToggleProvavelAlta = async (paciente) => {
    try {
      const pacienteRef = doc(getPacientesCollection(), paciente.id);
      
      if (paciente.provavelAlta) {
        // Remover provável alta
        await updateDoc(pacienteRef, {
          provavelAlta: deleteField()
        });
        
        toast({
          title: "Provável alta removida",
          description: "Registro de provável alta foi removido.",
        });
        
        await logAction('Mapa de Leitos', `Provável alta do paciente '${paciente.nomePaciente}' foi removida.`);
      } else {
        // Adicionar provável alta
        await updateDoc(pacienteRef, {
          provavelAlta: {
            sinalizadoEm: serverTimestamp()
          }
        });
        
        toast({
          title: "Provável alta registrada",
          description: "Provável alta foi sinalizada.",
        });
        
        await logAction('Mapa de Leitos', `Provável alta sinalizada para o paciente '${paciente.nomePaciente}'.`);
      }
    } catch (error) {
      console.error('Erro ao gerenciar provável alta:', error);
      toast({
        title: "Erro",
        description: "Erro ao processar provável alta. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleToggleAltaNoLeito = async (paciente) => {
    try {
      const pacienteRef = doc(getPacientesCollection(), paciente.id);
      
      if (paciente.altaNoLeito) {
        // Remover alta no leito
        await updateDoc(pacienteRef, {
          altaNoLeito: deleteField()
        });
        
        toast({
          title: "Alta no leito removida",
          description: "Registro de alta no leito foi removido.",
        });
        
        await logAction('Mapa de Leitos', `Alta no leito do paciente '${paciente.nomePaciente}' foi removida.`);
      } else {
        // Adicionar alta no leito - aqui precisaria de um modal para coletar os dados
        // Por simplicidade, vou usar dados padrão
        await updateDoc(pacienteRef, {
          altaNoLeito: {
            motivo: "Alta administrativa",
            detalhe: "",
            sinalizadoEm: serverTimestamp()
          }
        });
        
        toast({
          title: "Alta no leito registrada",
          description: "Alta no leito foi sinalizada.",
        });
        
        await logAction('Mapa de Leitos', `Alta no leito sinalizada para o paciente '${paciente.nomePaciente}'.`);
      }
    } catch (error) {
      console.error('Erro ao gerenciar alta no leito:', error);
      toast({
        title: "Erro",
        description: "Erro ao processar alta no leito. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  // Handlers específicos dos modais
  const handleSalvarObservacao = async (texto) => {
    try {
      const pacienteRef = doc(getPacientesCollection(), modalObservacoes.paciente.id);
      
      await updateDoc(pacienteRef, {
        observacoes: arrayUnion({
          texto,
          timestamp: serverTimestamp()
        })
      });
      
      toast({
        title: "Observação salva",
        description: "Nova observação foi registrada.",
      });
      
      await logAction('Mapa de Leitos', `Nova observação adicionada para o paciente '${modalObservacoes.paciente.nomePaciente}'.`);
      
      setModalObservacoes({ open: false, paciente: null });
    } catch (error) {
      console.error('Erro ao salvar observação:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar observação. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleMoverPaciente = async (leitoDestino) => {
    try {
      const { leito: leitoOrigem, paciente } = modalMoverPaciente;
      
      // Atualizar leito de origem para Vago
      const leitoOrigemRef = doc(getLeitosCollection(), leitoOrigem.id);
      await updateDoc(leitoOrigemRef, {
        status: 'Vago',
        historico: arrayUnion({
          status: 'Vago',
          timestamp: serverTimestamp()
        })
      });
      
      // Atualizar leito de destino para Ocupado
      const leitoDestinoRef = doc(getLeitosCollection(), leitoDestino.id);
      await updateDoc(leitoDestinoRef, {
        status: 'Ocupado',
        historico: arrayUnion({
          status: 'Ocupado',
          timestamp: serverTimestamp()
        })
      });
      
      // Atualizar dados do paciente
      const pacienteRef = doc(getPacientesCollection(), paciente.id);
      await updateDoc(pacienteRef, {
        leitoId: leitoDestino.id,
        setorId: leitoDestino.setorId
      });
      
      toast({
        title: "Paciente movido",
        description: `Paciente ${paciente.nomePaciente} foi movido para o leito ${leitoDestino.codigoLeito}.`,
      });
      
      await logAction('Mapa de Leitos', 
        `Paciente '${paciente.nomePaciente}' foi movido do leito '${leitoOrigem.codigoLeito}' para o leito '${leitoDestino.codigoLeito}'.`
      );
      
      setModalMoverPaciente({ open: false, leito: null, paciente: null });
    } catch (error) {
      console.error('Erro ao mover paciente:', error);
      toast({
        title: "Erro",
        description: "Erro ao mover paciente. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleSalvarRemanejamento = async (dados) => {
    try {
      const pacienteRef = doc(getPacientesCollection(), modalRemanejamento.paciente.id);
      
      await updateDoc(pacienteRef, {
        pedidoRemanejamento: {
          tipo: dados.tipo,
          descricao: dados.descricao,
          solicitadoEm: serverTimestamp()
        }
      });
      
      toast({
        title: "Remanejamento solicitado",
        description: "Pedido de remanejamento foi registrado.",
      });
      
      await logAction('Mapa de Leitos', 
        `Remanejamento solicitado para o paciente '${modalRemanejamento.paciente.nomePaciente}'. Motivo: ${dados.tipo}`
      );
      
      setModalRemanejamento({ open: false, paciente: null });
    } catch (error) {
      console.error('Erro ao solicitar remanejamento:', error);
      toast({
        title: "Erro",
        description: "Erro ao solicitar remanejamento. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleSalvarTransferenciaExterna = async (dados) => {
    try {
      const pacienteRef = doc(getPacientesCollection(), modalTransferenciaExterna.paciente.id);
      
      await updateDoc(pacienteRef, {
        pedidoTransferenciaExterna: {
          motivo: dados.motivo,
          outroMotivo: dados.outroMotivo,
          destino: dados.destino,
          solicitadoEm: serverTimestamp()
        }
      });
      
      toast({
        title: "Transferência solicitada",
        description: "Pedido de transferência externa foi registrado.",
      });
      
      await logAction('Mapa de Leitos', 
        `Transferência externa solicitada para o paciente '${modalTransferenciaExterna.paciente.nomePaciente}'. Motivo: ${dados.motivo}, Destino: ${dados.destino}`
      );
      
      setModalTransferenciaExterna({ open: false, paciente: null });
    } catch (error) {
      console.error('Erro ao solicitar transferência externa:', error);
      toast({
        title: "Erro",
        description: "Erro ao solicitar transferência externa. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  // Buscar dados do Firestore em tempo real
  useEffect(() => {
    const unsubscribeSetores = onSnapshot(getSetoresCollection(), (snapshot) => {
      const setoresData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setSetores(setoresData);
    });

    const unsubscribeQuartos = onSnapshot(getQuartosCollection(), (snapshot) => {
      const quartosData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setQuartos(quartosData);
    });

    const unsubscribeLeitos = onSnapshot(getLeitosCollection(), (snapshot) => {
      const leitosData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setLeitos(leitosData);
    });

    const unsubscribePacientes = onSnapshot(getPacientesCollection(), (snapshot) => {
      const pacientesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setPacientes(pacientesData);
      setLoading(false);
    });

    return () => {
      unsubscribeSetores();
      unsubscribeQuartos();
      unsubscribeLeitos();
      unsubscribePacientes();
    };
  }, []);

  // Obter especialidades únicas para o filtro
  const especialidadesUnicas = useMemo(() => {
    const especialidades = new Set();
    pacientes.forEach(paciente => {
      if (paciente.especialidade) {
        especialidades.add(paciente.especialidade);
      }
    });
    return Array.from(especialidades).sort();
  }, [pacientes]);

  // Processar dados em estrutura hierárquica
  const dadosEstruturados = useMemo(() => {
    if (!setores.length || !leitos.length) return {};

    const estrutura = {};

    // Criar mapa de pacientes por leitoId para performance
    const pacientesPorLeito = {};
    pacientes.forEach(paciente => {
      if (paciente.leitoId) {
        pacientesPorLeito[paciente.leitoId] = paciente;
      }
    });

    // Agrupar por tipo de setor
    setores.forEach(setor => {
      const tipoSetor = setor.tipoSetor || 'Outros';
      
      if (!estrutura[tipoSetor]) {
        estrutura[tipoSetor] = [];
      }

      // Buscar quartos deste setor
      const quartosDoSetor = quartos
        .filter(quarto => quarto.setorId === setor.id)
        .sort((a, b) => {
          const nameA = a.nomeQuarto || '';
          const nameB = b.nomeQuarto || '';
          return nameA.localeCompare(nameB);
        });
      
      // Buscar leitos deste setor e vincular pacientes
      const leitosDoSetor = leitos
        .filter(leito => leito.setorId === setor.id)
        .map(leito => ({
          ...leito,
          paciente: pacientesPorLeito[leito.id] || null,
          status: pacientesPorLeito[leito.id] ? 'Ocupado' : leito.status
        }))
        .sort((a, b) => {
          const codeA = a.codigoLeito || '';
          const codeB = b.codigoLeito || '';
          return codeA.localeCompare(codeB);
        });

      // Separar leitos em quartos e sem quarto
      const leitosComQuarto = [];
      const leitosSemQuarto = [...leitosDoSetor];

      const quartosComLeitos = quartosDoSetor.map(quarto => {
        const leitosDoQuarto = leitosDoSetor
          .filter(leito => quarto.leitosIds && quarto.leitosIds.includes(leito.id))
          .sort((a, b) => {
            const codeA = a.codigoLeito || '';
            const codeB = b.codigoLeito || '';
            return codeA.localeCompare(codeB);
          });
        
        // Remover leitos que estão em quartos da lista de leitos sem quarto
        leitosDoQuarto.forEach(leito => {
          const index = leitosSemQuarto.findIndex(l => l.id === leito.id);
          if (index > -1) {
            leitosSemQuarto.splice(index, 1);
          }
        });

        return {
          ...quarto,
          leitos: leitosDoQuarto
        };
      });

      estrutura[tipoSetor].push({
        ...setor,
        quartos: quartosComLeitos,
        leitosSemQuarto: leitosSemQuarto
      });
    });

    return estrutura;
  }, [setores, quartos, leitos, pacientes]);

  // Aplicar filtros aos dados estruturados
  const dadosFiltrados = useMemo(() => {
    const estruturaFiltrada = {};
    
    Object.entries(dadosEstruturados).forEach(([tipoSetor, setoresDoTipo]) => {
      const setoresFiltrados = [];
      
      setoresDoTipo.forEach(setor => {
        const setorFiltrado = { ...setor };
        
        // Filtrar quartos e seus leitos
        const quartosFiltrados = setor.quartos.map(quarto => ({
          ...quarto,
          leitos: quarto.leitos.filter(leito => aplicarFiltrosAoLeito(leito))
        })).filter(quarto => quarto.leitos.length > 0);
        
        // Filtrar leitos sem quarto
        const leitosSemQuartoFiltrados = setor.leitosSemQuarto.filter(leito => aplicarFiltrosAoLeito(leito));
        
        setorFiltrado.quartos = quartosFiltrados;
        setorFiltrado.leitosSemQuarto = leitosSemQuartoFiltrados;
        
        // Só incluir setor se tiver leitos após filtragem
        if (quartosFiltrados.length > 0 || leitosSemQuartoFiltrados.length > 0) {
          setoresFiltrados.push(setorFiltrado);
        }
      });
      
      // Só incluir tipo de setor se tiver setores após filtragem
      if (setoresFiltrados.length > 0) {
        estruturaFiltrada[tipoSetor] = setoresFiltrados;
      }
    });
    
    return estruturaFiltrada;
  }, [dadosEstruturados, filtros]);

  function aplicarFiltrosAoLeito(leito) {
    // Filtro de busca rápida
    if (filtros.busca.trim()) {
      const termoBusca = filtros.busca.trim().toUpperCase();
      const codigoLeito = (leito.codigoLeito || '').toUpperCase();
      const nomePaciente = leito.paciente ? (leito.paciente.nomePaciente || '').toUpperCase() : '';
      
      if (!codigoLeito.includes(termoBusca) && !nomePaciente.includes(termoBusca)) {
        return false;
      }
    }
    
    // Filtro por status
    if (filtros.status.length > 0 && !filtros.status.includes(leito.status)) {
      return false;
    }
    
    // Filtros específicos de leitos ocupados
    if (leito.status === 'Ocupado' && leito.paciente) {
      const paciente = leito.paciente;
      
      // Filtro por sexo
      if (filtros.sexo.length > 0 && !filtros.sexo.includes(paciente.sexo)) {
        return false;
      }
      
      // Filtro por especialidade
      if (filtros.especialidade && paciente.especialidade !== filtros.especialidade) {
        return false;
      }
      
      // Filtros booleanos de indicadores
      if (filtros.comPedidoUTI && !paciente.pedidoUTI) return false;
      if (filtros.comProvavelAlta && !paciente.provavelAlta) return false;
      if (filtros.comAltaNoLeito && !paciente.altaNoLeito) return false;
      if (filtros.comSolicitacaoRemanejamento && !paciente.pedidoRemanejamento) return false;
      if (filtros.comPedidoTransferenciaExterna && !paciente.pedidoTransferenciaExterna) return false;
    }
    
    // Filtro PCP
    if (filtros.isPCP && !leito.isPCP) {
      return false;
    }
    
    return true;
  }

  const limparFiltros = () => {
    setFiltros({
      busca: '',
      status: [],
      sexo: [],
      especialidade: '',
      isPCP: false,
      comPedidoUTI: false,
      comProvavelAlta: false,
      comAltaNoLeito: false,
      comSolicitacaoRemanejamento: false,
      comPedidoTransferenciaExterna: false
    });
  };

  const toggleSection = (tipoSetor) => {
    setExpandedSections(prev => ({
      ...prev,
      [tipoSetor]: !prev[tipoSetor]
    }));
  };

  const toggleSetor = (setorId) => {
    setExpandedSetores(prev => ({
      ...prev,
      [setorId]: !prev[setorId]
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Carregando mapa de leitos...</span>
        </div>
      </div>
    );
  }

  if (Object.keys(dadosEstruturados).length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">
          Nenhum setor ou leito encontrado. Configure os setores e leitos primeiro.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Painel de Filtros */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        {/* Busca Rápida */}
        <div className="flex items-center gap-4 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Pesquisar por nome do paciente ou código do leito..."
              value={filtros.busca}
              onChange={(e) => setFiltros(prev => ({ ...prev, busca: e.target.value }))}
              className="pl-10"
            />
          </div>
          <Button
            variant="outline"
            onClick={() => setFiltrosAbertos(!filtrosAbertos)}
            className="flex items-center gap-2"
          >
            <Filter className="h-4 w-4" />
            Filtros Avançados
            <ChevronDown className={`h-4 w-4 transition-transform ${filtrosAbertos ? 'rotate-180' : ''}`} />
          </Button>
        </div>

        {/* Filtros Avançados */}
        <Collapsible open={filtrosAbertos} onOpenChange={setFiltrosAbertos}>
          <CollapsibleContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-4 border-t">
              {/* Status do Leito */}
              <div>
                <h4 className="font-medium mb-3">Status do Leito</h4>
                <div className="space-y-2">
                  {['Vago', 'Ocupado', 'Higienização', 'Bloqueado'].map(status => (
                    <div key={status} className="flex items-center space-x-2">
                      <Checkbox
                        id={`status-${status}`}
                        checked={filtros.status.includes(status)}
                        onCheckedChange={(checked) => {
                          setFiltros(prev => ({
                            ...prev,
                            status: checked
                              ? [...prev.status, status]
                              : prev.status.filter(s => s !== status)
                          }));
                        }}
                      />
                      <label htmlFor={`status-${status}`} className="text-sm">
                        {status}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sexo do Paciente */}
              <div>
                <h4 className="font-medium mb-3">Sexo do Paciente</h4>
                <div className="space-y-2">
                  {[{ value: 'M', label: 'Masculino' }, { value: 'F', label: 'Feminino' }].map(sexo => (
                    <div key={sexo.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`sexo-${sexo.value}`}
                        checked={filtros.sexo.includes(sexo.value)}
                        onCheckedChange={(checked) => {
                          setFiltros(prev => ({
                            ...prev,
                            sexo: checked
                              ? [...prev.sexo, sexo.value]
                              : prev.sexo.filter(s => s !== sexo.value)
                          }));
                        }}
                      />
                      <label htmlFor={`sexo-${sexo.value}`} className="text-sm">
                        {sexo.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Especialidade */}
              <div>
                <h4 className="font-medium mb-3">Especialidade</h4>
                <Select 
                  value={filtros.especialidade} 
                  onValueChange={(value) => setFiltros(prev => ({ ...prev, especialidade: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma especialidade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todas</SelectItem>
                    {especialidadesUnicas.map(especialidade => (
                      <SelectItem key={especialidade} value={especialidade}>
                        {especialidade}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Indicadores de Paciente */}
              <div className="md:col-span-2 lg:col-span-3">
                <h4 className="font-medium mb-3">Indicadores de Paciente</h4>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                  {[
                    { key: 'isPCP', label: 'Leito PCP' },
                    { key: 'comPedidoUTI', label: 'Com Pedido de UTI' },
                    { key: 'comProvavelAlta', label: 'Com Provável Alta' },
                    { key: 'comAltaNoLeito', label: 'Com Alta no Leito' },
                    { key: 'comSolicitacaoRemanejamento', label: 'Com Solicitação de Remanejamento' },
                    { key: 'comPedidoTransferenciaExterna', label: 'Com Pedido de Transferência Externa' }
                  ].map(filtro => (
                    <div key={filtro.key} className="flex items-center space-x-2">
                      <Checkbox
                        id={filtro.key}
                        checked={filtros[filtro.key]}
                        onCheckedChange={(checked) => {
                          setFiltros(prev => ({ ...prev, [filtro.key]: checked }));
                        }}
                      />
                      <label htmlFor={filtro.key} className="text-sm">
                        {filtro.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Botão Limpar Filtros */}
            <div className="flex justify-end pt-4 border-t">
              <Button variant="outline" onClick={limparFiltros}>
                Limpar Filtros
              </Button>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {Object.keys(dadosFiltrados).length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            Nenhum leito encontrado com os filtros aplicados.
          </p>
        </div>
      ) : (
        Object.entries(dadosFiltrados).map(([tipoSetor, setoresDoTipo]) => (
          <div key={tipoSetor} className={`border border-gray-200 rounded-lg ${getSectorTypeColor(tipoSetor)}`}>
            <Collapsible 
              open={expandedSections[tipoSetor] !== false} 
              onOpenChange={() => toggleSection(tipoSetor)}
            >
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full justify-between p-4 h-auto text-left hover:bg-gray-50"
                >
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">
                      {tipoSetor}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {setoresDoTipo.length} setor(es)
                    </p>
                  </div>
                  <ChevronDown className="h-5 w-5 transition-transform duration-200" />
                </Button>
              </CollapsibleTrigger>
              
              <CollapsibleContent className="p-4 pt-0 space-y-6">
                {setoresDoTipo.map(setor => (
                  <div key={setor.id} className="border border-gray-100 rounded-lg">
                    <Collapsible 
                      open={expandedSetores[setor.id] !== false} 
                      onOpenChange={() => toggleSetor(setor.id)}
                    >
                      <CollapsibleTrigger asChild>
                        <Button
                          variant="ghost"
                          className="w-full justify-between p-3 h-auto text-left hover:bg-gray-50"
                        >
                          <div>
                            <h3 className="text-lg font-medium text-gray-800">
                              {setor.nomeSetor} ({setor.siglaSetor})
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              {(setor.quartos.length > 0 ? setor.quartos.length + " quarto(s), " : "") + 
                               (setor.leitosSemQuarto.length + setor.quartos.reduce((acc, q) => acc + q.leitos.length, 0)) + " leito(s)"}
                            </p>
                          </div>
                          <ChevronDown className="h-4 w-4 transition-transform duration-200" />
                        </Button>
                      </CollapsibleTrigger>
                      
                      <CollapsibleContent className="p-3 pt-0 space-y-4">
                        {/* Renderizar quartos (não são acordeões, apenas containers) */}
                        {setor.quartos.map(quarto => (
                          <div key={quarto.id} className="bg-gray-50 rounded-lg p-4">
                            <h4 className="text-md font-medium text-gray-700 mb-3 flex items-center gap-2">
                              📋 {quarto.nomeQuarto}
                              <Badge variant="outline" className="text-xs">
                                {quarto.leitos.length} leito(s)
                              </Badge>
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                              {quarto.leitos.map(leito => (
                                <LeitoCard 
                                  key={leito.id} 
                                  leito={leito}
                                  onBloquearLeito={(leito) => setModalBloquear({ open: true, leito })}
                                  onSolicitarHigienizacao={(leito) => setModalHigienizacao({ open: true, leito })}
                                  onDesbloquearLeito={(leito) => setModalDesbloquear({ open: true, leito })}
                                  onFinalizarHigienizacao={(leito) => setModalFinalizarHigienizacao({ open: true, leito })}
                                  onPriorizarHigienizacao={handlePriorizarHigienizacao}
                                  onLiberarLeito={(leito, paciente) => setModalLiberarLeito({ open: true, leito, paciente })}
                                  onMoverPaciente={(leito, paciente) => setModalMoverPaciente({ open: true, leito, paciente })}
                                  onObservacoes={(paciente) => setModalObservacoes({ open: true, paciente })}
                                  onSolicitarUTI={handleToggleUTI}
                                  onSolicitarRemanejamento={(paciente) => setModalRemanejamento({ open: true, paciente })}
                                  onTransferenciaExterna={(paciente) => setModalTransferenciaExterna({ open: true, paciente })}
                                  onProvavelAlta={handleToggleProvavelAlta}
                                  onAltaNoLeito={handleToggleAltaNoLeito}
                                />
                              ))}
                            </div>
                          </div>
                        ))}

                        {/* Renderizar leitos sem quarto (apenas se o setor tiver quartos cadastrados) */}
                        {setor.leitosSemQuarto.length > 0 && (
                          <div>
                            {setor.quartos.length > 0 ? (
                              <h4 className="text-md font-medium text-gray-700 mb-3 flex items-center gap-2">
                                🏥 Leitos sem quarto
                                <Badge variant="outline" className="text-xs">
                                  {setor.leitosSemQuarto.length} leito(s)
                                </Badge>
                              </h4>
                            ) : null}
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                              {setor.leitosSemQuarto.map(leito => (
                                <LeitoCard 
                                  key={leito.id} 
                                  leito={leito}
                                  onBloquearLeito={(leito) => setModalBloquear({ open: true, leito })}
                                  onSolicitarHigienizacao={(leito) => setModalHigienizacao({ open: true, leito })}
                                  onDesbloquearLeito={(leito) => setModalDesbloquear({ open: true, leito })}
                                  onFinalizarHigienizacao={(leito) => setModalFinalizarHigienizacao({ open: true, leito })}
                                  onPriorizarHigienizacao={handlePriorizarHigienizacao}
                                  onLiberarLeito={(leito, paciente) => setModalLiberarLeito({ open: true, leito, paciente })}
                                  onMoverPaciente={(leito, paciente) => setModalMoverPaciente({ open: true, leito, paciente })}
                                  onObservacoes={(paciente) => setModalObservacoes({ open: true, paciente })}
                                  onSolicitarUTI={handleToggleUTI}
                                  onSolicitarRemanejamento={(paciente) => setModalRemanejamento({ open: true, paciente })}
                                  onTransferenciaExterna={(paciente) => setModalTransferenciaExterna({ open: true, paciente })}
                                  onProvavelAlta={handleToggleProvavelAlta}
                                  onAltaNoLeito={handleToggleAltaNoLeito}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>
          </div>
        ))
      )}
      
      {/* Modal para Bloquear Leito */}
      <Dialog open={modalBloquear.open} onOpenChange={(open) => setModalBloquear({ open, leito: null })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Bloquear Leito</DialogTitle>
            <DialogDescription>Informe o motivo do bloqueio para confirmar a ação.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Você está prestes a bloquear o leito <strong>{modalBloquear.leito?.codigoLeito}</strong>.
            </p>
            <Textarea
              placeholder="Informe o motivo do bloqueio..."
              value={motivoBloqueio}
              onChange={(e) => setMotivoBloqueio(e.target.value)}
              className="min-h-[100px]"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalBloquear({ open: false, leito: null })}>
              Cancelar
            </Button>
            <Button 
              onClick={handleBloquearLeito}
              disabled={!motivoBloqueio.trim()}
              className="bg-red-600 hover:bg-red-700"
            >
              Confirmar Bloqueio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal para Solicitar Higienização */}
      <AlertDialog open={modalHigienizacao.open} onOpenChange={(open) => setModalHigienizacao({ open, leito: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Solicitar Higienização</AlertDialogTitle>
            <AlertDialogDescription>
              Confirmar solicitação de higienização para o leito <strong>{modalHigienizacao.leito?.codigoLeito}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleSolicitarHigienizacao(modalHigienizacao.leito)}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal para Desbloquear Leito */}
      <AlertDialog open={modalDesbloquear.open} onOpenChange={(open) => setModalDesbloquear({ open, leito: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desbloquear Leito</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja realmente desbloquear o leito <strong>{modalDesbloquear.leito?.codigoLeito}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleDesbloquearLeito(modalDesbloquear.leito)}>
              Desbloquear
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal para Finalizar Higienização */}
      <AlertDialog open={modalFinalizarHigienizacao.open} onOpenChange={(open) => setModalFinalizarHigienizacao({ open, leito: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Finalizar Higienização</AlertDialogTitle>
            <AlertDialogDescription>
              Confirmar a finalização da higienização do leito <strong>{modalFinalizarHigienizacao.leito?.codigoLeito}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleFinalizarHigienizacao(modalFinalizarHigienizacao.leito)}>
              Finalizar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Novos modais para leitos ocupados */}
      <LiberarLeitoModal
        isOpen={modalLiberarLeito.open}
        onClose={() => setModalLiberarLeito({ open: false, leito: null, paciente: null })}
        onConfirm={() => handleLiberarLeito(modalLiberarLeito.leito, modalLiberarLeito.paciente)}
        leito={modalLiberarLeito.leito}
        paciente={modalLiberarLeito.paciente}
      />

      <ObservacoesModal
        isOpen={modalObservacoes.open}
        onClose={() => setModalObservacoes({ open: false, paciente: null })}
        onSave={handleSalvarObservacao}
        paciente={modalObservacoes.paciente}
      />

      <MoverPacienteModal
        isOpen={modalMoverPaciente.open}
        onClose={() => setModalMoverPaciente({ open: false, leito: null, paciente: null })}
        onMove={handleMoverPaciente}
        paciente={modalMoverPaciente.paciente}
        leito={modalMoverPaciente.leito}
        dadosEstruturados={dadosEstruturados}
      />

      <RemanejamentoModal
        isOpen={modalRemanejamento.open}
        onClose={() => setModalRemanejamento({ open: false, paciente: null })}
        onSave={handleSalvarRemanejamento}
        paciente={modalRemanejamento.paciente}
      />

      <TransferenciaExternaModal
        isOpen={modalTransferenciaExterna.open}
        onClose={() => setModalTransferenciaExterna({ open: false, paciente: null })}
        onSave={handleSalvarTransferenciaExterna}
        paciente={modalTransferenciaExterna.paciente}
      />
    </div>
  );
};

export default MapaLeitosPanel;