import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, UserCheck, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  addDoc,
  doc,
  db,
  writeBatch,
  serverTimestamp,
  deleteField
} from '@/lib/firebase';
import { getPacientesCollection } from '@/lib/firebase';
import { logAction } from '@/lib/auditoria';
import { useAuth } from '@/contexts/AuthContext';
import { ESPECIALIDADES_MEDICAS } from '@/lib/constants';

const ConfirmarInternacaoModal = ({ isOpen, onClose, reserva }) => {
  const { toast } = useToast();
  const [showAlertDialog, setShowAlertDialog] = useState(false);
  const [showFormDialog, setShowFormDialog] = useState(false);
  const [internando, setInternando] = useState(false);
  const { currentUser } = useAuth();

  // Dados da internação
  const [dadosInternacao, setDadosInternacao] = useState({
    especialidade: '',
    dataInternacao: null,
    horaInternacao: ''
  });

  if (!reserva) return null;

  const resetState = () => {
    setShowAlertDialog(false);
    setShowFormDialog(false);
    setDadosInternacao({
      especialidade: '',
      dataInternacao: null,
      horaInternacao: ''
    });
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleIniciarConfirmacao = () => {
    setShowAlertDialog(true);
  };

  const handleConfirmarAlerta = () => {
    setShowAlertDialog(false);
    setShowFormDialog(true);
  };

  const handleFinalizarInternacao = async () => {
    // Validações
    if (!dadosInternacao.especialidade || !dadosInternacao.dataInternacao || !dadosInternacao.horaInternacao) {
      toast({
        title: "Erro",
        description: "Por favor, preencha todos os campos obrigatórios.",
        variant: "destructive"
      });
      return;
    }

    // Validar formato da hora
    const horaRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!horaRegex.test(dadosInternacao.horaInternacao)) {
      toast({
        title: "Erro",
        description: "Por favor, informe a hora no formato HH:MM (ex: 14:30).",
        variant: "destructive"
      });
      return;
    }

    setInternando(true);
    try {
      const batch = writeBatch(db);
      const timestampAtualizacao = serverTimestamp();

      // Criar documento do paciente
      const novoPaciente = {
        nomeCompleto: reserva.nomeCompleto,
        dataNascimento: reserva.dataNascimento,
        sexo: reserva.sexo,
        especialidade: dadosInternacao.especialidade,
        dataInternacao: dadosInternacao.dataInternacao,
        horaInternacao: dadosInternacao.horaInternacao,
        leitoId: reserva.leitoReservadoId,
        setorId: '', // TODO: Buscar do leito se necessário
        status: 'Ativo',
        isolamentos: reserva.isolamento !== 'NÃO' ? [{ tipo: reserva.isolamento, ativo: true }] : [],
        criadoEm: serverTimestamp(),
        origem: 'ReservaExterna',
        reservaOrigemId: reserva.id
      };

      // Adicionar paciente
      const pacienteRef = await addDoc(getPacientesCollection(), novoPaciente);

      // Atualizar leito
      const leitoRef = doc(db, 'artifacts/regulafacil/public/data/leitos', reserva.leitoReservadoId);
      batch.update(leitoRef, {
        status: 'Ocupado',
        pacienteId: pacienteRef.id,
        reservaExterna: deleteField()
      });

      // Atualizar reserva
      const reservaRef = doc(db, 'artifacts/regulafacil/public/data/reservasExternas', reserva.id);
      batch.update(reservaRef, {
        status: 'Internado',
        pacienteId: pacienteRef.id,
        dataEfetivacaoInternacao: timestampAtualizacao,
        atualizadoEm: timestampAtualizacao,
        userName: currentUser?.nomeCompleto || 'Usuário'
      });

      await batch.commit();

      await logAction(
        'Reservas de Leitos',
        `Internação confirmada: ${reserva.nomeCompleto} - Especialidade: ${dadosInternacao.especialidade}`,
        currentUser
      );

      toast({
        title: "Sucesso",
        description: "Internação confirmada com sucesso!"
      });

      handleClose();
    } catch (error) {
      console.error('Erro ao confirmar internação:', error);
      toast({
        title: "Erro",
        description: "Erro ao confirmar internação. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setInternando(false);
    }
  };

  return (
    <>
      {/* Modal principal - botão de iniciar */}
      <Dialog open={isOpen && !showAlertDialog && !showFormDialog} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-primary" />
              Confirmar Internação
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-muted p-4 rounded-md">
              <p className="font-semibold">Paciente: {reserva.nomeCompleto}</p>
              <p className="text-sm text-muted-foreground">
                Leito Reservado: {reserva.leitoReservadoId}
              </p>
            </div>

            <div className="flex items-start gap-3 p-4 border border-yellow-200 bg-yellow-50 rounded-md">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-yellow-800">Atenção</p>
                <p className="text-sm text-yellow-700">
                  Confirme esta ação apenas se o paciente já deu entrada no hospital.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button onClick={handleIniciarConfirmacao}>
              Prosseguir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Alert Dialog de confirmação */}
      <AlertDialog open={showAlertDialog} onOpenChange={setShowAlertDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              Confirmação Necessária
            </AlertDialogTitle>
            <AlertDialogDescription>
              <strong>Atenção:</strong> confirme esta ação apenas se o paciente <strong>{reserva.nomeCompleto}</strong> já deu entrada no hospital.
              <br /><br />
              Ao confirmar, você será direcionado para finalizar os dados da internação.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowAlertDialog(false)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmarAlerta}>
              Sim, o paciente já deu entrada
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de finalização da internação */}
      <Dialog open={showFormDialog} onOpenChange={() => setShowFormDialog(false)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-primary" />
              Finalizar Internação - {reserva.nomeCompleto}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Dados pré-preenchidos (não editáveis) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/50 rounded-md">
              <div>
                <Label className="text-sm font-semibold text-muted-foreground">Nome</Label>
                <p className="font-medium">{reserva.nomeCompleto}</p>
              </div>
              <div>
                <Label className="text-sm font-semibold text-muted-foreground">Data de Nascimento</Label>
                <p className="font-medium">
                  {reserva.dataNascimento && format(reserva.dataNascimento.toDate(), 'dd/MM/yyyy', { locale: ptBR })}
                </p>
              </div>
              <div>
                <Label className="text-sm font-semibold text-muted-foreground">Sexo</Label>
                <p className="font-medium">{reserva.sexo}</p>
              </div>
            </div>

            {/* Dados obrigatórios */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Especialidade *</Label>
                <Select 
                  value={dadosInternacao.especialidade} 
                  onValueChange={(value) => setDadosInternacao(prev => ({ ...prev, especialidade: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a especialidade" />
                  </SelectTrigger>
                  <SelectContent>
                    {ESPECIALIDADES_MEDICAS.map(esp => (
                      <SelectItem key={esp} value={esp}>{esp}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="horaInternacao">Hora da Internação *</Label>
                <Input
                  id="horaInternacao"
                  placeholder="HH:MM (ex: 14:30)"
                  value={dadosInternacao.horaInternacao}
                  onChange={(e) => setDadosInternacao(prev => ({ ...prev, horaInternacao: e.target.value }))}
                />
              </div>

              <div className="md:col-span-2">
                <Label>Data da Internação *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !dadosInternacao.dataInternacao && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dadosInternacao.dataInternacao ? (
                        format(dadosInternacao.dataInternacao, "dd/MM/yyyy", { locale: ptBR })
                      ) : (
                        <span>Selecione a data</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={dadosInternacao.dataInternacao}
                      onSelect={(date) => setDadosInternacao(prev => ({ ...prev, dataInternacao: date }))}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFormDialog(false)} disabled={internando}>
              Cancelar
            </Button>
            <Button onClick={handleFinalizarInternacao} disabled={internando}>
              {internando ? 'Finalizando...' : 'Finalizar Internação'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ConfirmarInternacaoModal;