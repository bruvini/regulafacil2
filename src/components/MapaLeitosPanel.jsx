import React, { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
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
  Filter,
  X,
  Wrench
} from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  getLeitosCollection,
  getPacientesCollection,
  doc,
  updateDoc,
  arrayUnion,
  serverTimestamp,
  deleteField,
  deleteDoc
} from '@/lib/firebase';
import { logAction } from '@/lib/auditoria';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useDadosHospitalares } from '@/hooks/useDadosHospitalares';
import LiberarLeitoModal from './modals/LiberarLeitoModal';
import ObservacoesModal from './modals/ObservacoesModal';
import MoverPacienteModal from './modals/MoverPacienteModal';
import RemanejamentoModal from './modals/RemanejamentoModal';
import TransferenciaExternaModal from './modals/TransferenciaExternaModal';
import AltaNoLeitoModal from './modals/AltaNoLeitoModal';
import CancelarReservaExternaModal from './modals/CancelarReservaExternaModal';
import ConfirmarInternacaoExternaModal from './modals/ConfirmarInternacaoExternaModal';
import InternacaoManualModal from './modals/InternacaoManualModal';
import DiagnosticoIsolamentosModal from './modals/DiagnosticoIsolamentosModal';

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
  infeccoesPorId = {},
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
  onAltaNoLeito,
  onCancelarReservaExterna,
  onConfirmarInternacaoExterna,
  onInternarManual
}) => {
  const { toast } = useToast();
  const { currentUser } = useAuth();

  const formatRegulacaoTempo = (valor) => {
    if (!valor) return null;

    try {
      let data = valor;

      if (typeof data?.toDate === 'function') {
        data = data.toDate();
      } else if (!(data instanceof Date)) {
        data = new Date(data);
      }

      if (isNaN(data.getTime())) {
        return null;
      }

      return formatDistanceToNow(data, {
        addSuffix: true,
        locale: ptBR
      });
    } catch (error) {
      return null;
    }
  };

  const regulacaoOrigemInfo = leito.regulacaoOrigem || (leito.regulacaoEmAndamento?.tipo === 'ORIGEM'
    ? {
        destinoCodigo: leito.regulacaoEmAndamento.leitoParceiroCodigo || 'N/A',
        destinoSetorNome: leito.regulacaoEmAndamento.leitoParceiroSetorNome || 'Setor não informado',
        timestamp: leito.regulacaoEmAndamento.iniciadoEm
      }
    : null);

  const regulacaoDestinoInfo = leito.regulacaoReserva || (leito.regulacaoEmAndamento?.tipo === 'DESTINO'
    ? {
        pacienteNome: leito.regulacaoEmAndamento.pacienteNome,
        origemCodigo: leito.regulacaoEmAndamento.leitoParceiroCodigo,
        origemSetorNome: leito.regulacaoEmAndamento.leitoParceiroSetorNome,
        timestamp: leito.regulacaoEmAndamento.iniciadoEm
      }
    : null);

  const reservaExterna = leito.reservaExterna || null;
  const isReservaExterna = Boolean(reservaExterna);
  const idadeReservaExterna = isReservaExterna ? calcularIdade(reservaExterna.pacienteDataNascimento) : null;
  const tempoRegulacaoOrigem = formatRegulacaoTempo(regulacaoOrigemInfo?.timestamp);
  const tempoRegulacaoDestino = formatRegulacaoTempo(regulacaoDestinoInfo?.timestamp);
  const shouldShowDefaultActions = !['Reservado', 'Regulado'].includes(leito.status);
  const shouldShowReservaExternaActions = isReservaExterna;
  const statusBadgeVariant = ['Regulado', 'Reservado'].includes(leito.status) ? 'outline' : 'secondary';
  const statusLabel = leito.status || 'Sem status';
  const destinoReguladoSetor = regulacaoOrigemInfo?.destinoSetorNome || 'Setor não informado';
  const destinoReguladoCodigo = regulacaoOrigemInfo?.destinoCodigo || 'N/A';
  const reservaOrigemSetor = regulacaoDestinoInfo?.origemSetorNome || null;
  const reservaOrigemCodigo = regulacaoDestinoInfo?.origemCodigo || 'N/A';
  const reservaPacienteNome = regulacaoDestinoInfo?.pacienteNome || null;

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

  function calcularIdade(dataNascimento) {
    if (!dataNascimento) return 'N/A';
    
    try {
      let nascimento;
      
      // Handle Firestore timestamp
      if (dataNascimento.toDate) {
        nascimento = dataNascimento.toDate();
      } 
      // Handle dd/mm/yyyy string format from XLS
      else if (typeof dataNascimento === 'string' && dataNascimento.includes('/')) {
        const partes = dataNascimento.split('/');
        if (partes.length === 3) {
          const dia = parseInt(partes[0], 10);
          const mes = parseInt(partes[1], 10) - 1; // Month is 0-indexed in Date
          const ano = parseInt(partes[2], 10);
          
          // Validate parts
          if (!isNaN(dia) && !isNaN(mes) && !isNaN(ano)) {
            nascimento = new Date(ano, mes, dia);
          } else {
            return 'N/A';
          }
        } else {
          return 'N/A';
        }
      }
      // Handle other date formats
      else {
        nascimento = new Date(dataNascimento);
      }
      
      // Validate the date
      if (isNaN(nascimento.getTime())) {
        return 'N/A';
      }
      
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
  }

  const getCardStyle = () => {
    if (isReservaExterna) {
      return "bg-sky-50 border-4 border-sky-500 hover:shadow-lg transition-all shadow-lg";
    }

    if (leito.status === 'Regulado') {
      return "bg-orange-50 border-4 border-orange-500 hover:shadow-lg transition-all shadow-lg";
    }

    if (leito.status === 'Reservado') {
      return "bg-purple-50 border-4 border-purple-500 hover:shadow-lg transition-all shadow-lg";
    }

    // Verificar se o leito está em regulação (fallback)
    if (leito.regulacaoEmAndamento) {
      if (leito.regulacaoEmAndamento.tipo === 'ORIGEM') {
        return "bg-orange-50 border-4 border-orange-500 hover:shadow-lg transition-all shadow-lg";
      } else if (leito.regulacaoEmAndamento.tipo === 'DESTINO') {
        return "bg-purple-50 border-4 border-purple-500 hover:shadow-lg transition-all shadow-lg";
      }
    }

    switch (leito.status) {
      case 'Ocupado':
        const genderBorder = leito.paciente?.sexo === 'M' ? 'border-blue-500' : 
                           leito.paciente?.sexo === 'F' ? 'border-pink-500' : 'border-red-500';
        return `bg-white border-4 ${genderBorder} hover:shadow-lg transition-all shadow-sm`;
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
    if (isReservaExterna) {
      return "bg-sky-100 text-sky-800 border-sky-200";
    }

    if (leito.status === 'Regulado') {
      return "bg-orange-50 text-orange-800 border-orange-200";
    }

    // Verificar se o leito está em regulação - DESTINO (Reservado)
    if (leito.status === 'Reservado' || leito.regulacaoEmAndamento?.tipo === 'DESTINO') {
      return "bg-purple-50 text-purple-800 border-purple-200";
    }

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
    if (!['Ocupado', 'Regulado'].includes(leito.status) || !leito.paciente) return null;

    const badges = [];
    const paciente = leito.paciente;

    if (paciente.isolamentos && paciente.isolamentos.length > 0) {
      badges.push(
        <div key="isolamentos" className="flex flex-wrap gap-1 mt-1">
          {paciente.isolamentos.map(isolamento => {
            const infeccaoRef = isolamento?.infeccaoId;
            if (infeccaoRef?.id) {
              const infeccao = infeccoesPorId[infeccaoRef.id];
              const sigla = (infeccao?.siglaInfeccao || infeccao?.sigla || '').trim();
              if (sigla) {
                return (
                  <Badge key={`isolamento-${infeccao.id}`} variant="destructive" className="text-xs">
                    {sigla}
                  </Badge>
                );
              }
            }

            const siglaFallback = (isolamento?.siglaInfeccao || isolamento?.sigla || isolamento?.nomeInfeccao || '').trim();
            if (siglaFallback) {
              return (
                <Badge key={`isolamento-${siglaFallback}`} variant="destructive" className="text-xs">
                  {siglaFallback}
                </Badge>
              );
            }

            return null;
          })}
        </div>
      );
    }

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

  const renderDefaultActions = () => {
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
            <DropdownMenuItem
              onClick={() => onSolicitarUTI(leito.paciente)}
              disabled={leito.setor?.tipoSetor === 'UTI'}
            >
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
            <DropdownMenuItem onClick={() => onInternarManual?.(leito)}>
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

  const renderReservaExternaActions = () => (
    <>
      <DropdownMenuItem onClick={() => onCancelarReservaExterna(leito)}>
        <X className="h-4 w-4 mr-2" />
        CANCELAR RESERVA
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => onConfirmarInternacaoExterna(leito)}>
        <UserCheck className="h-4 w-4 mr-2" />
        CONFIRMAR INTERNAÇÃO
      </DropdownMenuItem>
    </>
  );

  const formatarMensagemRestricaoCoorte = (restricao) => {
    if (!restricao) {
      return '';
    }

    const isolamentos = (restricao.isolamentos || []).map(sigla => sigla.toUpperCase());
    if (isolamentos.length > 0) {
      return `Permitido apenas pacientes do sexo ${restricao.sexo} com isolamento de ${isolamentos.join(', ')}`;
    }

    return `Permitido apenas pacientes do sexo ${restricao.sexo}`;
  };

  return (
    <Card className={getCardStyle()}>
      <CardContent className="p-4 relative flex flex-col min-h-[150px]">

        {/* Cabeçalho com layout corrigido */}
        <div className="flex justify-between items-start mb-3">
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-sm text-gray-900 mb-2">
              {leito.codigoLeito}
            </h4>
            <div className="flex flex-wrap gap-1">
              {leito.isPCP && (
                <Badge variant="secondary" className="text-xs">
                  PCP
                </Badge>
              )}
              <Badge variant={statusBadgeVariant} className={getBadgeStyle()}>
                {statusLabel}
              </Badge>
              {leito.status === 'Higienização' && leito.higienizacaoPrioritaria && (
                <Badge variant="destructive" className="text-xs flex items-center gap-1">
                  <Flame className="h-3 w-3" />
                  Prioridade
                </Badge>
              )}
            </div>
          </div>
          {/* Menu de ações */}
          {(shouldShowReservaExternaActions || shouldShowDefaultActions) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0">
                  <MoreVertical className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {shouldShowReservaExternaActions ? renderReservaExternaActions() : renderDefaultActions()}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Conteúdo do card */}
        <div className="flex-1 flex flex-col space-y-3">

          {/* Leito em regulação (origem) */}
          {leito.status === 'Regulado' && leito.paciente && regulacaoOrigemInfo && (
            <div className="space-y-3">
              <div className="min-w-0 space-y-1">
                <p
                  className="font-medium text-sm text-gray-900 truncate"
                  title={leito.paciente.nomePaciente}
                >
                  {leito.paciente.nomePaciente}
                </p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
                  <span>{calcularIdade(leito.paciente.dataNascimento)} anos</span>
                  {leito.paciente.especialidade && (
                    <span className="flex items-center gap-2 min-w-0">
                      <span>•</span>
                      <span
                        className="truncate"
                        title={leito.paciente.especialidade}
                      >
                        {leito.paciente.especialidade}
                      </span>
                    </span>
                  )}
                </div>
              </div>

              <div className="border border-orange-200 bg-orange-50 p-3 rounded-md text-xs text-orange-800 space-y-1">
                <p className="font-semibold text-orange-900">
                  Destino: {destinoReguladoSetor} - Leito {destinoReguladoCodigo}
                </p>
                {tempoRegulacaoOrigem && (
                  <p className="text-orange-700">
                    Regulação iniciada {tempoRegulacaoOrigem}
                  </p>
                )}
              </div>

              {renderStatusBadges()}
            </div>
          )}

          {/* Leito reservado para paciente externo */}
          {isReservaExterna && (
            <div className="space-y-3">
              <div className="min-w-0 space-y-1">
                <p
                  className="font-medium text-sm text-gray-900 truncate"
                  title={reservaExterna.pacienteNome || 'Paciente externo'}
                >
                  {reservaExterna.pacienteNome || 'Paciente externo'}
                </p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
                  {idadeReservaExterna && idadeReservaExterna !== 'N/A' && (
                    <span>{idadeReservaExterna} anos</span>
                  )}
                  {reservaExterna.pacienteSexo && (
                    <span className="flex items-center gap-2 min-w-0">
                      <span>•</span>
                      <span className="truncate" title={reservaExterna.pacienteSexo}>
                        {reservaExterna.pacienteSexo}
                      </span>
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-2 rounded-md border border-sky-200 bg-sky-50 p-3 text-xs text-sky-800">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sky-900">
                    {reservaExterna.origem === 'SISREG' ? 'Reserva SISREG' : 'Reserva Oncológica'}
                  </span>
                  {reservaExterna.idSolicitacao && (
                    <Badge variant="outline" className="border-sky-300 bg-white text-sky-700">
                      ID {reservaExterna.idSolicitacao}
                    </Badge>
                  )}
                </div>

                {reservaExterna.origem === 'SISREG' ? (
                  <div className="space-y-1">
                    {reservaExterna.instituicaoOrigem && (
                      <p>
                        <span className="font-medium">Instituição:</span> {reservaExterna.instituicaoOrigem}
                      </p>
                    )}
                    {reservaExterna.cidadeOrigem && (
                      <p>
                        <span className="font-medium">Cidade:</span> {reservaExterna.cidadeOrigem}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {reservaExterna.especialidadeOncologia && (
                      <p>
                        <span className="font-medium">Especialidade:</span> {reservaExterna.especialidadeOncologia}
                      </p>
                    )}
                    {reservaExterna.telefoneContato && (
                      <p>
                        <span className="font-medium">Contato:</span> {reservaExterna.telefoneContato}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Leito de DESTINO em regulação (Reservado) */}
          {leito.status === 'Reservado' && regulacaoDestinoInfo && !isReservaExterna && (
            <div className="space-y-2">
              <div className="min-w-0 space-y-1">
                <p
                  className="font-medium text-sm text-gray-900 truncate"
                  title={reservaPacienteNome || 'Paciente em regulação'}
                >
                  {reservaPacienteNome || 'Paciente em regulação'}
                </p>
                <div className="text-xs text-gray-600">
                  <span className="font-medium">Vindo de: </span>
                  <span
                    className="truncate"
                    title={`${reservaOrigemSetor ? `${reservaOrigemSetor} - ` : ''}${reservaOrigemCodigo}`}
                  >
                    {reservaOrigemSetor ? `${reservaOrigemSetor} - ` : ''}
                    {reservaOrigemCodigo}
                  </span>
                </div>
              </div>

              {tempoRegulacaoDestino && (
                <div className="text-xs text-purple-700">
                  Regulação iniciada {tempoRegulacaoDestino}
                </div>
              )}
            </div>
          )}

          {/* Informações do paciente para leitos ocupados normais */}
          {leito.status === 'Ocupado' && leito.paciente && !leito.regulacaoEmAndamento && (
            <div className="space-y-2">
              <div className="min-w-0 space-y-1">
                <p
                  className="font-medium text-sm text-gray-900 truncate"
                  title={leito.paciente.nomePaciente}
                >
                  {leito.paciente.nomePaciente}
                </p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
                  <span>{calcularIdade(leito.paciente.dataNascimento)} anos</span>
                  {leito.paciente.especialidade && (
                    <span className="flex items-center gap-2 min-w-0">
                      <span>•</span>
                      <span
                        className="truncate"
                        title={leito.paciente.especialidade}
                      >
                        {leito.paciente.especialidade}
                      </span>
                    </span>
                  )}
                </div>
              </div>
              {renderStatusBadges()}
            </div>
          )}

          {/* Informações específicas por status */}
          {leito.status === 'Bloqueado' && leito.motivoBloqueio && (
            <div className="text-xs text-gray-600 bg-gray-100 p-2 rounded">
              <strong>Motivo:</strong> {leito.motivoBloqueio}
            </div>
          )}

          {/* Informações de coorte para leitos vagos */}
          {leito.status === 'Vago' && leito.restricaoCoorte && (
            <div className="text-xs bg-blue-50 border border-blue-200 p-2 rounded">
              <span className="font-semibold text-blue-800">Restrição de coorte:</span>
              <span className="text-blue-700 block">{formatarMensagemRestricaoCoorte(leito.restricaoCoorte)}</span>
            </div>
          )}

          {/* Tempo no status apenas para leitos não em regulação */}
          {!leito.regulacaoEmAndamento && (
            <div className="text-xs text-muted-foreground mt-auto">
              {getTempoNoStatus()}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// Componente principal MapaLeitosPanel
const MapaLeitosPanel = () => {
  const {
    estrutura,
    pacientesEnriquecidos,
    infeccoes,
    loading: loadingDados,
  } = useDadosHospitalares();
  const { currentUser } = useAuth();
  const [expandedSections, setExpandedSections] = useState({});
  const [expandedSetores, setExpandedSetores] = useState({});
  // Estados dos filtros
  const [filtros, setFiltros] = useState({
    busca: '',
    status: [],
    sexo: [],
    especialidade: 'all',
    isPCP: false,
    comPedidoUTI: false,
    comProvavelAlta: false,
    comAltaNoLeito: false,
    comSolicitacaoRemanejamento: false,
    comPedidoTransferenciaExterna: false,
    isolamentosSelecionados: []
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
  const [modalAltaNoLeito, setModalAltaNoLeito] = useState({ open: false, paciente: null });
  const [modalCancelarReservaExterna, setModalCancelarReservaExterna] = useState({ open: false, reserva: null, leito: null });
  const [modalConfirmarInternacaoExterna, setModalConfirmarInternacaoExterna] = useState({ open: false, reserva: null, leito: null });
  const [modalInternacaoManual, setModalInternacaoManual] = useState({ open: false, leito: null });
  const [diagIsoModalOpen, setDiagIsoModalOpen] = useState(false);

  const construirContextoReservaExterna = (leitoAtual) => {
    const dadosReserva = leitoAtual?.reservaExterna || {};

    return {
      id: dadosReserva.reservaId,
      nomeCompleto: dadosReserva.pacienteNome,
      sexo: dadosReserva.pacienteSexo,
      dataNascimento: dadosReserva.pacienteDataNascimento,
      origem: dadosReserva.origem,
      instituicaoOrigem: dadosReserva.instituicaoOrigem,
      cidadeOrigem: dadosReserva.cidadeOrigem,
      especialidadeOncologia: dadosReserva.especialidadeOncologia,
      telefoneContato: dadosReserva.telefoneContato,
      isolamento: dadosReserva.isolamento || 'NÃO',
      idSolicitacao: dadosReserva.idSolicitacao,
      leitoReservadoId: leitoAtual?.id,
      status: 'Reservado'
    };
  };

  const handleAbrirCancelarReservaExterna = (leitoAtual) => {
    if (!leitoAtual?.reservaExterna) return;
    setModalCancelarReservaExterna({
      open: true,
      reserva: construirContextoReservaExterna(leitoAtual),
      leito: leitoAtual
    });
  };

  const handleAbrirConfirmarInternacaoExterna = (leitoAtual) => {
    if (!leitoAtual?.reservaExterna) return;
    setModalConfirmarInternacaoExterna({
      open: true,
      reserva: construirContextoReservaExterna(leitoAtual),
      leito: leitoAtual
    });
  };

  const handleAbrirInternacaoManual = (leitoAtual) => {
    if (!leitoAtual) return;
    setModalInternacaoManual({ open: true, leito: leitoAtual });
  };
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
      await logAction('Mapa de Leitos', `Leito '${modalBloquear.leito.codigoLeito}' foi bloqueado. Motivo: '${motivoBloqueio.trim()}'.`, currentUser);
      
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
      await logAction('Mapa de Leitos', `Solicitada higienização para o leito '${leito.codigoLeito}'.`, currentUser);
      
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
      await logAction('Mapa de Leitos', `Leito '${leito.codigoLeito}' foi desbloqueado.`, currentUser);
      
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
      await logAction('Mapa de Leitos', `Higienização do leito '${leito.codigoLeito}' foi finalizada.`, currentUser);
      
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
        : `Prioridade de higienização do leito '${leito.codigoLeito}' foi removida.`,
        currentUser
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
          timestamp: new Date()
        })
      });
      
      await logAction('Mapa de Leitos', `Leito '${leito.codigoLeito}' foi liberado. Paciente '${paciente.nomePaciente}' foi dado alta.`, currentUser);
      
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
        
        await logAction('Mapa de Leitos', `Pedido de UTI do paciente '${paciente.nomePaciente}' foi removido.`, currentUser);
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
        
        await logAction('Mapa de Leitos', `UTI solicitada para o paciente '${paciente.nomePaciente}'.`, currentUser);
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
        
        await logAction('Mapa de Leitos', `Provável alta do paciente '${paciente.nomePaciente}' foi removida.`, currentUser);
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
        
        await logAction('Mapa de Leitos', `Provável alta sinalizada para o paciente '${paciente.nomePaciente}'.`, currentUser);
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
        
        await logAction('Mapa de Leitos', `Alta no leito do paciente '${paciente.nomePaciente}' foi removida.`, currentUser);
      } else {
        // Abrir modal para coletar dados
        setModalAltaNoLeito({ open: true, paciente });
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
          timestamp: new Date()
        })
      });
      
      toast({
        title: "Observação salva",
        description: "Nova observação foi registrada.",
      });
      
      await logAction('Mapa de Leitos', `Nova observação adicionada para o paciente '${modalObservacoes.paciente.nomePaciente}'.`, currentUser);
      
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
      
      // Criar objetos de histórico com timestamp atual do cliente
      const historicoOrigemEntry = {
        status: 'Vago',
        timestamp: new Date()
      };
      
      const historicoDestinoEntry = {
        status: 'Ocupado',
        timestamp: new Date()
      };
      
      // Atualizar leito de origem para Vago
      const leitoOrigemRef = doc(getLeitosCollection(), leitoOrigem.id);
      await updateDoc(leitoOrigemRef, {
        status: 'Vago',
        statusLeito: 'Vago',
        pacienteId: deleteField(),
        historico: arrayUnion(historicoOrigemEntry),
        dataUltimaMovimentacao: serverTimestamp()
      });
      
      // Atualizar leito de destino para Ocupado
      const leitoDestinoRef = doc(getLeitosCollection(), leitoDestino.id);
      await updateDoc(leitoDestinoRef, {
        status: 'Ocupado',
        statusLeito: 'Ocupado',
        pacienteId: paciente.id,
        historico: arrayUnion(historicoDestinoEntry),
        dataUltimaMovimentacao: serverTimestamp()
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
        `Paciente '${paciente.nomePaciente}' foi movido do leito '${leitoOrigem.codigoLeito}' para o leito '${leitoDestino.codigoLeito}'.`,
        currentUser
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
          detalhe: dados.detalhe,
          solicitadoEm: new Date()
        }
      });
      
      toast({
        title: "Remanejamento solicitado",
        description: "Pedido de remanejamento foi registrado.",
      });
      
      await logAction('Mapa de Leitos',
        `Remanejamento solicitado para o paciente '${modalRemanejamento.paciente.nomePaciente}'. Motivo: ${dados.tipo}`,
        currentUser
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
        `Transferência externa solicitada para o paciente '${modalTransferenciaExterna.paciente.nomePaciente}'. Motivo: ${dados.motivo}, Destino: ${dados.destino}`,
        currentUser
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

  const handleSalvarAltaNoLeito = async (dados) => {
    try {
      const pacienteRef = doc(getPacientesCollection(), modalAltaNoLeito.paciente.id);
      
      await updateDoc(pacienteRef, {
        altaNoLeito: {
          motivo: dados.motivo,
          detalhe: dados.detalhe,
          sinalizadoEm: new Date()
        }
      });
      
      toast({
        title: "Alta no leito registrada",
        description: "Alta no leito foi sinalizada.",
      });
      
      await logAction('Mapa de Leitos',
        `Alta no leito sinalizada para o paciente '${modalAltaNoLeito.paciente.nomePaciente}'. Motivo: ${dados.motivo}`,
        currentUser
      );
      
      setModalAltaNoLeito({ open: false, paciente: null });
    } catch (error) {
      console.error('Erro ao registrar alta no leito:', error);
      toast({
        title: "Erro",
        description: "Erro ao registrar alta no leito. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const infeccoesPorId = useMemo(() => {
    return (infeccoes || []).reduce((acc, infeccaoAtual) => {
      acc[infeccaoAtual.id] = infeccaoAtual;
      return acc;
    }, {});
  }, [infeccoes]);

  // Obter especialidades únicas para o filtro
  const especialidadesUnicas = useMemo(() => {
    const especialidades = new Set();
    pacientesEnriquecidos.forEach(paciente => {
      if (paciente.especialidade) {
        especialidades.add(paciente.especialidade);
      }
    });
    return Array.from(especialidades).sort();
  }, [pacientesEnriquecidos]);

  const isolamentosSelecionadosLabel = useMemo(() => {
    if (!filtros.isolamentosSelecionados || filtros.isolamentosSelecionados.length === 0) {
      return 'Selecionar isolamentos...';
    }

    const nomesSelecionados = filtros.isolamentosSelecionados
      .map(id => {
        const infeccao = infeccoesPorId[id];
        if (!infeccao) return null;
        return infeccao.siglaInfeccao || infeccao.nomeInfeccao || null;
      })
      .filter(Boolean);

    if (nomesSelecionados.length === 0) {
      return `${filtros.isolamentosSelecionados.length} isolamento(s) selecionado(s)`;
    }

    const [primeiro, segundo, ...resto] = nomesSelecionados;
    const baseLabel = [primeiro, segundo].filter(Boolean).join(', ');
    if (resto.length > 0) {
      return `${baseLabel} +${resto.length}`;
    }

    return baseLabel || `${filtros.isolamentosSelecionados.length} isolamento(s) selecionado(s)`;
  }, [filtros.isolamentosSelecionados, infeccoesPorId]);

  const alternarIsolamentoFiltro = (infeccaoId) => {
    if (!infeccaoId) return;

    setFiltros(prev => {
      const selecionados = prev.isolamentosSelecionados || [];
      const jaSelecionado = selecionados.includes(infeccaoId);
      return {
        ...prev,
        isolamentosSelecionados: jaSelecionado
          ? selecionados.filter(id => id !== infeccaoId)
          : [...selecionados, infeccaoId]
      };
    });
  };

  // Processar dados em estrutura hierárquica
  const dadosEstruturados = useMemo(() => estrutura || {}, [estrutura]);

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

    if (filtros.isolamentosSelecionados.length > 0) {
      if (!leito.paciente) {
        return false;
      }

      const isolamentosPacienteIds = new Set(
        (leito.paciente.isolamentos || [])
          .map(iso => iso?.infeccaoId?.id)
          .filter(Boolean)
      );

      const isolamentosFiltroIds = new Set(filtros.isolamentosSelecionados);

      if (isolamentosPacienteIds.size !== isolamentosFiltroIds.size) {
        return false;
      }

      for (const idFiltro of isolamentosFiltroIds) {
        if (!isolamentosPacienteIds.has(idFiltro)) {
          return false;
        }
      }
    }

    // Filtros específicos de leitos ocupados
    if (['Ocupado', 'Regulado'].includes(leito.status) && leito.paciente) {
      const paciente = leito.paciente;

      // Filtro por sexo
      if (filtros.sexo.length > 0 && !filtros.sexo.includes(paciente.sexo)) {
        return false;
      }
      
      // Filtro por especialidade
      if (filtros.especialidade && filtros.especialidade !== 'all' && paciente.especialidade !== filtros.especialidade) {
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
      especialidade: 'all',
      isPCP: false,
      comPedidoUTI: false,
      comProvavelAlta: false,
      comAltaNoLeito: false,
      comSolicitacaoRemanejamento: false,
      comPedidoTransferenciaExterna: false,
      isolamentosSelecionados: []
    });
  };


  if (loadingDados) {
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
      <Card className="bg-white border border-gray-200 rounded-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Wrench className="h-4 w-4 text-primary" />
            Caixa de Ferramentas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            <Button variant="outline" onClick={() => setDiagIsoModalOpen(true)}>
              Diagnóstico de Isolamentos
            </Button>
          </div>
        </CardContent>
      </Card>

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
                  {['Vago', 'Ocupado', 'Regulado', 'Reservado', 'Higienização', 'Bloqueado'].map(status => (
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
                    <SelectItem value="all">Todas</SelectItem>
                    {especialidadesUnicas.map(especialidade => (
                      <SelectItem key={especialidade} value={especialidade}>
                        {especialidade}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Isolamentos */}
              <div>
                <h4 className="font-medium mb-3">Isolamento</h4>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-between overflow-hidden"
                    >
                      <span className="truncate text-left">
                        {isolamentosSelecionadosLabel}
                      </span>
                      <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar isolamentos..." />
                      <CommandList>
                        <CommandEmpty>Nenhuma infecção encontrada.</CommandEmpty>
                        <CommandGroup>
                          {infeccoes.map((infeccao) => {
                            const id = infeccao.id;
                            const isSelected = filtros.isolamentosSelecionados.includes(id);
                            const label = [infeccao?.siglaInfeccao, infeccao?.nomeInfeccao]
                              .filter(Boolean)
                              .join(' - ') || 'Infecção sem nome';

                            return (
                              <CommandItem
                                key={id}
                                value={`${infeccao?.siglaInfeccao || ''} ${infeccao?.nomeInfeccao || ''}`.trim()}
                                onSelect={() => alternarIsolamentoFiltro(id)}
                              >
                                <div className="flex w-full items-center space-x-2">
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={() => alternarIsolamentoFiltro(id)}
                                    onClick={(event) => event.stopPropagation()}
                                  />
                                  <span className="flex-1 truncate text-sm">{label}</span>
                                </div>
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
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
        <Accordion type="single" collapsible className="space-y-4">
          {Object.entries(dadosFiltrados).map(([tipoSetor, setoresDoTipo]) => (
            <AccordionItem key={tipoSetor} value={tipoSetor} className={`border border-gray-200 rounded-lg ${getSectorTypeColor(tipoSetor)}`}>
              <AccordionTrigger className="w-full justify-between p-4 h-auto text-left hover:bg-gray-50">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    {tipoSetor}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {setoresDoTipo.length} setor(es)
                  </p>
                </div>
              </AccordionTrigger>
              
              <AccordionContent className="p-4 pt-0">
                <Accordion type="single" collapsible className="space-y-6">
                  {setoresDoTipo.map(setor => (
                    <AccordionItem key={setor.id} value={setor.id} className="border border-gray-100 rounded-lg">
                      <AccordionTrigger className="w-full justify-between p-3 h-auto text-left hover:bg-gray-50">
                        <div>
                          <h3 className="text-lg font-medium text-gray-800">
                            {setor.nomeSetor} ({setor.siglaSetor})
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {(setor.quartos.length > 0 ? setor.quartos.length + " quarto(s), " : "") + 
                             (setor.leitosSemQuarto.length + setor.quartos.reduce((acc, q) => acc + q.leitos.length, 0)) + " leito(s)"}
                          </p>
                        </div>
                      </AccordionTrigger>
                      
                      <AccordionContent className="p-3 pt-0 space-y-4">
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
                                <MemoizedLeitoCard
                                  key={leito.id}
                                  leito={leito}
                                  infeccoesPorId={infeccoesPorId}
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
                                  onCancelarReservaExterna={handleAbrirCancelarReservaExterna}
                                  onConfirmarInternacaoExterna={handleAbrirConfirmarInternacaoExterna}
                                  onInternarManual={handleAbrirInternacaoManual}
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
                                <MemoizedLeitoCard
                                  key={leito.id}
                                  leito={leito}
                                  infeccoesPorId={infeccoesPorId}
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
                                  onCancelarReservaExterna={handleAbrirCancelarReservaExterna}
                                  onConfirmarInternacaoExterna={handleAbrirConfirmarInternacaoExterna}
                                  onInternarManual={handleAbrirInternacaoManual}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
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

      <AltaNoLeitoModal
        isOpen={modalAltaNoLeito.open}
        onClose={() => setModalAltaNoLeito({ open: false, paciente: null })}
        onSave={handleSalvarAltaNoLeito}
        paciente={modalAltaNoLeito.paciente}
      />

      <CancelarReservaExternaModal
        isOpen={modalCancelarReservaExterna.open}
        onClose={() => setModalCancelarReservaExterna({ open: false, reserva: null, leito: null })}
        reserva={modalCancelarReservaExterna.reserva}
        leito={modalCancelarReservaExterna.leito}
      />

      <ConfirmarInternacaoExternaModal
        isOpen={modalConfirmarInternacaoExterna.open}
        onClose={() => setModalConfirmarInternacaoExterna({ open: false, reserva: null, leito: null })}
        reserva={modalConfirmarInternacaoExterna.reserva}
        leito={modalConfirmarInternacaoExterna.leito}
      />

      <InternacaoManualModal
        isOpen={modalInternacaoManual.open}
        onClose={() => setModalInternacaoManual({ open: false, leito: null })}
        leito={modalInternacaoManual.leito}
      />

      <DiagnosticoIsolamentosModal
        isOpen={diagIsoModalOpen}
        onClose={() => setDiagIsoModalOpen(false)}
        pacientes={pacientesEnriquecidos}
      />
    </div>
  );
};

// Memoizar LeitoCard para melhorar performance
const MemoizedLeitoCard = React.memo(LeitoCard);

export default MapaLeitosPanel;