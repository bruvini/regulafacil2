import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { CalendarIcon, UserCheck } from 'lucide-react';
import { format, isValid, parse } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import {
  addDoc,
  arrayUnion,
  deleteField,
  doc,
  getLeitosCollection,
  getPacientesCollection,
  getReservasExternasCollection,
  writeBatch,
  db
} from '@/lib/firebase';
import { logAction } from '@/lib/auditoria';
import { useAuth } from '@/contexts/AuthContext';
import { ESPECIALIDADES_MEDICAS } from '@/lib/constants';

const ConfirmarInternacaoExternaModal = ({ isOpen, onClose, reserva, leito }) => {
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const [alertaConfirmacaoAberto, setAlertaConfirmacaoAberto] = useState(false);
  const [formAberto, setFormAberto] = useState(false);
  const [processando, setProcessando] = useState(false);
  const formAbertoRef = useRef(false);

  const [dadosInternacao, setDadosInternacao] = useState({
    especialidade: '',
    dataInternacao: null,
    dataInternacaoTexto: '',
    horaInternacao: ''
  });

  useEffect(() => {
    if (isOpen) {
      setAlertaConfirmacaoAberto(true);
      setFormAberto(false);
      setProcessando(false);
    } else {
      setAlertaConfirmacaoAberto(false);
      setFormAberto(false);
      setProcessando(false);
      setDadosInternacao({
        especialidade: '',
        dataInternacao: null,
        dataInternacaoTexto: '',
        horaInternacao: ''
      });
    }
  }, [isOpen]);

  const obterData = useMemo(() => (
    (valor) => {
      if (!valor) return null;
      if (typeof valor?.toDate === 'function') {
        return valor.toDate();
      }
      if (valor instanceof Date) {
        return valor;
      }
      const parseado = new Date(valor);
      return Number.isNaN(parseado.getTime()) ? null : parseado;
    }
  ), []);

  const dataNascimento = obterData(reserva?.dataNascimento);

  const handleFecharTudo = () => {
    setAlertaConfirmacaoAberto(false);
    setFormAberto(false);
    setDadosInternacao({
      especialidade: '',
      dataInternacao: null,
      dataInternacaoTexto: '',
      horaInternacao: ''
    });
    onClose();
  };

  const atualizarData = (valor) => {
    setDadosInternacao(prev => ({
      ...prev,
      dataInternacao: valor,
      dataInternacaoTexto: valor ? format(valor, 'dd/MM/yyyy') : ''
    }));
  };

  const handleInputData = (valor) => {
    setDadosInternacao(prev => {
      const proximo = { ...prev, dataInternacaoTexto: valor };
      if (!valor) {
        proximo.dataInternacao = null;
        return proximo;
      }
      const parseado = parse(valor, 'dd/MM/yyyy', new Date());
      if (isValid(parseado)) {
        proximo.dataInternacao = parseado;
        proximo.dataInternacaoTexto = format(parseado, 'dd/MM/yyyy');
      } else {
        proximo.dataInternacao = null;
      }
      return proximo;
    });
  };

  useEffect(() => {
    formAbertoRef.current = formAberto;
  }, [formAberto]);

  const handleConfirmarAlerta = () => {
    setAlertaConfirmacaoAberto(false);
    setFormAberto(true);
  };

  const handleSalvar = async () => {
    if (!reserva) return;

    if (!dadosInternacao.especialidade || !dadosInternacao.dataInternacao || !dadosInternacao.horaInternacao) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Informe especialidade, data e hora da internação.',
        variant: 'destructive'
      });
      return;
    }

    const horaRegex = /^([0-1]?\d|2[0-3]):[0-5]\d$/;
    if (!horaRegex.test(dadosInternacao.horaInternacao)) {
      toast({
        title: 'Formato de hora inválido',
        description: 'Utilize o formato HH:MM (ex: 14:30).',
        variant: 'destructive'
      });
      return;
    }

    const leitoId = leito?.id || reserva.leitoReservadoId;
    if (!leitoId) {
      toast({
        title: 'Leito não encontrado',
        description: 'Não foi possível identificar o leito reservado.',
        variant: 'destructive'
      });
      return;
    }

    setProcessando(true);

    try {
      const batch = writeBatch(db);

      const novoPaciente = {
        nomeCompleto: reserva.nomeCompleto,
        dataNascimento: reserva.dataNascimento,
        sexo: reserva.sexo,
        especialidade: dadosInternacao.especialidade,
        dataInternacao: dadosInternacao.dataInternacao,
        horaInternacao: dadosInternacao.horaInternacao,
        leitoId,
        status: 'Ativo',
        origem: 'ReservaExterna',
        reservaOrigemId: reserva.id,
        isolamentos: reserva.isolamento && reserva.isolamento !== 'NÃO'
          ? [{ tipo: reserva.isolamento, ativo: true }]
          : [],
        criadoEm: new Date()
      };

      const pacienteRef = await addDoc(getPacientesCollection(), novoPaciente);

      const leitoRef = doc(getLeitosCollection(), leitoId);
      batch.update(leitoRef, {
        status: 'Ocupado',
        pacienteId: pacienteRef.id,
        reservaExterna: deleteField(),
        historico: arrayUnion({
          status: 'Ocupado',
          timestamp: new Date(),
          origem: 'Internação Reserva Externa'
        })
      });

      const reservaRef = doc(getReservasExternasCollection(), reserva.id);
      batch.update(reservaRef, {
        status: 'Internado',
        pacienteId: pacienteRef.id,
        dataEfetivacaoInternacao: new Date()
      });

      await batch.commit();

      await logAction(
        'Reservas de Leitos',
        `Internação confirmada para reserva externa: ${reserva.nomeCompleto}`,
        currentUser
      );

      toast({
        title: 'Internação confirmada',
        description: 'O leito foi atualizado para ocupado e o paciente foi cadastrado.'
      });

      handleFecharTudo();
    } catch (error) {
      console.error('Erro ao confirmar internação externa:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível confirmar a internação. Tente novamente.',
        variant: 'destructive'
      });
    } finally {
      setProcessando(false);
    }
  };

  if (!reserva) {
    return null;
  }

  return (
    <>
      <AlertDialog
        open={alertaConfirmacaoAberto}
        onOpenChange={(open) => {
          setAlertaConfirmacaoAberto(open);
          if (!open && !formAbertoRef.current) {
            handleFecharTudo();
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar internação?</AlertDialogTitle>
            <AlertDialogDescription>
              Confirme esta ação apenas quando o paciente <strong>{reserva.nomeCompleto}</strong> já estiver apto a ocupar o leito reservado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleFecharTudo}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmarAlerta}>
              Sim, prosseguir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={formAberto} onOpenChange={(open) => (!open ? handleFecharTudo() : setFormAberto(true))}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-primary" />
              Finalizar Internação - {reserva.nomeCompleto}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3 rounded-md border bg-muted/50 p-4">
              <div>
                <Label className="text-xs uppercase text-muted-foreground">Nome</Label>
                <p className="font-medium">{reserva.nomeCompleto}</p>
              </div>
              <div>
                <Label className="text-xs uppercase text-muted-foreground">Data de Nascimento</Label>
                <p className="font-medium">{dataNascimento ? format(dataNascimento, 'dd/MM/yyyy') : 'Não informada'}</p>
              </div>
              <div>
                <Label className="text-xs uppercase text-muted-foreground">Sexo</Label>
                <p className="font-medium">{reserva.sexo}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                    {ESPECIALIDADES_MEDICAS.map(item => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="horaInternacao">Hora da Internação *</Label>
                <Input
                  id="horaInternacao"
                  placeholder="HH:MM"
                  value={dadosInternacao.horaInternacao}
                  onChange={(event) => setDadosInternacao(prev => ({ ...prev, horaInternacao: event.target.value }))}
                />
              </div>

              <div className="md:col-span-2">
                <Label>Data da Internação *</Label>
                <div className="relative">
                  <CalendarIcon className="absolute left-2 top-3 h-4 w-4 text-muted-foreground" />
                  <Popover>
                    <PopoverTrigger asChild>
                      <Input
                        value={dadosInternacao.dataInternacaoTexto}
                        placeholder="dd/mm/aaaa"
                        onFocus={() => setDadosInternacao(prev => ({ ...prev, dataInternacaoTexto: prev.dataInternacaoTexto || '' }))}
                        onInput={(event) => handleInputData(event.target.value)}
                        className="pl-8"
                      />
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dadosInternacao.dataInternacao}
                        onSelect={(date) => atualizarData(date ?? null)}
                        initialFocus
                        captionLayout="dropdown-buttons"
                        fromYear={1920}
                        toYear={new Date().getFullYear()}
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleFecharTudo} disabled={processando}>
              Cancelar
            </Button>
            <Button onClick={handleSalvar} disabled={processando}>
              {processando ? 'Finalizando...' : 'Finalizar Internação'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ConfirmarInternacaoExternaModal;
