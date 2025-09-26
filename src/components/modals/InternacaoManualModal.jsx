import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Calendar as CalendarIcon, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ptBR } from 'date-fns/locale';
import {
  arrayUnion,
  db,
  doc,
  getDoc,
  getLeitosCollection,
  getPacientesCollection,
  getSetoresCollection,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from '@/lib/firebase';
import { ESPECIALIDADES_MEDICAS } from '@/lib/constants';
import { useToast } from '@/hooks/use-toast';
import { logAction } from '@/lib/auditoria';
import { useAuth } from '@/contexts/AuthContext';

const internacaoSchema = z.object({
  nomeCompleto: z.string().min(3, 'Informe o nome completo do paciente.'),
  dataNascimento: z
    .string()
    .min(1, 'Informe a data de nascimento.')
    .refine((value) => Boolean(parseDateString(value)), {
      message: 'Informe uma data de nascimento válida no formato DD/MM/AAAA.',
    }),
  sexo: z.enum(['Masculino', 'Feminino'], {
    required_error: 'Selecione o sexo do paciente.',
  }),
  dataHoraInternacao: z
    .string()
    .min(1, 'Informe a data e hora de internação.')
    .refine((value) => Boolean(parseDateTimeString(value)), {
      message: 'Informe data e hora válidas no formato DD/MM/AAAA HH:MM.',
    }),
  especialidade: z.string().min(1, 'Selecione a especialidade de internação.'),
});

function sanitizeName(value) {
  return (value || '').toString().trim().replace(/\s+/g, ' ');
}

function normalizarNomePaciente(nome) {
  const base = sanitizeName(nome).toUpperCase();
  return base
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function padNumber(value) {
  return String(value).padStart(2, '0');
}

function formatDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return '';
  }
  const day = padNumber(date.getDate());
  const month = padNumber(date.getMonth() + 1);
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatDateTime(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return '';
  }
  const datePart = formatDate(date);
  const hours = padNumber(date.getHours());
  const minutes = padNumber(date.getMinutes());
  return `${datePart} ${hours}:${minutes}`;
}

function parseDateString(value) {
  if (!value) return null;

  const [dayStr, monthStr, yearStr] = value.split('/');
  const day = Number(dayStr);
  const month = Number(monthStr);
  const year = Number(yearStr);

  if (
    Number.isNaN(day) ||
    Number.isNaN(month) ||
    Number.isNaN(year) ||
    day < 1 ||
    month < 1 ||
    month > 12 ||
    year < 1900
  ) {
    return null;
  }

  const candidate = new Date(year, month - 1, day);
  if (
    candidate.getFullYear() !== year ||
    candidate.getMonth() !== month - 1 ||
    candidate.getDate() !== day
  ) {
    return null;
  }

  return candidate;
}

function parseDateTimeString(value) {
  if (!value) return null;

  const [datePart, timePart] = value.split(' ').filter(Boolean);
  if (!datePart || !timePart) return null;

  const baseDate = parseDateString(datePart);
  if (!baseDate) return null;

  const [hourStr, minuteStr] = timePart.split(':');
  const hours = Number(hourStr);
  const minutes = Number(minuteStr);

  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  return new Date(
    baseDate.getFullYear(),
    baseDate.getMonth(),
    baseDate.getDate(),
    hours,
    minutes,
    0,
    0
  );
}

function extractTime(value) {
  const match = (value || '').match(/(\d{2}):(\d{2})/);
  if (match) {
    return `${match[1]}:${match[2]}`;
  }
  return '00:00';
}

function extractDatePart(value) {
  const match = (value || '').match(/(\d{2}\/\d{2}\/\d{4})/);
  return match ? match[1] : '';
}

const InternacaoManualModal = ({ isOpen, onClose, leito }) => {
  const { toast } = useToast();
  const [dobPopoverOpen, setDobPopoverOpen] = useState(false);
  const [internacaoPopoverOpen, setInternacaoPopoverOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { currentUser } = useAuth();

  const form = useForm({
    resolver: zodResolver(internacaoSchema),
    defaultValues: {
      nomeCompleto: '',
      dataNascimento: '',
      sexo: '',
      dataHoraInternacao: '',
      especialidade: '',
    },
  });

  const defaultDateTime = useMemo(() => formatDateTime(new Date()), [isOpen]);

  useEffect(() => {
    if (isOpen) {
      form.reset({
        nomeCompleto: '',
        dataNascimento: '',
        sexo: '',
        dataHoraInternacao: defaultDateTime,
        especialidade: '',
      });
      setDobPopoverOpen(false);
      setInternacaoPopoverOpen(false);
    }
  }, [isOpen, form, defaultDateTime]);

  const handleClose = () => {
    if (isSubmitting) return;
    onClose?.();
  };

  const handleSubmit = async (values) => {
    if (!leito?.id) {
      toast({
        title: 'Leito não encontrado',
        description: 'Não foi possível identificar o leito selecionado.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const nomeSanitizado = sanitizeName(values.nomeCompleto);
      const nomePaciente = nomeSanitizado.toUpperCase();
      const nomePacienteNormalizado = normalizarNomePaciente(values.nomeCompleto);
      const dataNascimentoDate = parseDateString(values.dataNascimento);
      const dataInternacaoDate = parseDateTimeString(values.dataHoraInternacao);

      if (!dataNascimentoDate || !dataInternacaoDate) {
        toast({
          title: 'Dados inválidos',
          description: 'Revise as datas informadas e tente novamente.',
          variant: 'destructive',
        });
        return;
      }

      const dataNascimentoFormatada = formatDate(dataNascimentoDate);
      const sexoCodigo = values.sexo === 'Masculino' ? 'M' : 'F';

      const pacientesQuery = query(
        getPacientesCollection(),
        where('nomePacienteNormalizado', '==', nomePacienteNormalizado),
        where('dataNascimento', '==', dataNascimentoFormatada)
      );

      const duplicados = await getDocs(pacientesQuery);

      if (!duplicados.empty) {
        const pacienteExistenteDoc = duplicados.docs[0];
        const pacienteExistente = pacienteExistenteDoc.data();

        let setorPaciente = 'Setor não informado';
        let codigoLeitoPaciente = 'Não informado';

        if (pacienteExistente?.leitoId) {
          const leitoRef = doc(getLeitosCollection(), pacienteExistente.leitoId);
          const leitoSnapshot = await getDoc(leitoRef);
          if (leitoSnapshot.exists()) {
            const leitoData = leitoSnapshot.data();
            codigoLeitoPaciente = leitoData?.codigoLeito || codigoLeitoPaciente;
            setorPaciente =
              leitoData?.nomeSetor ||
              leitoData?.setorNome ||
              setorPaciente;

            if ((!setorPaciente || setorPaciente === 'Setor não informado') && leitoData?.setorId) {
              const setorRef = doc(getSetoresCollection(), leitoData.setorId);
              const setorSnapshot = await getDoc(setorRef);
              if (setorSnapshot.exists()) {
                const setorData = setorSnapshot.data();
                setorPaciente =
                  setorData?.nomeSetor ||
                  setorData?.siglaSetor ||
                  setorPaciente;
              }
            }
          }
        }

        if ((setorPaciente === 'Setor não informado' || !setorPaciente) && pacienteExistente?.setorId) {
          const setorRef = doc(getSetoresCollection(), pacienteExistente.setorId);
          const setorSnapshot = await getDoc(setorRef);
          if (setorSnapshot.exists()) {
            const setorData = setorSnapshot.data();
            setorPaciente =
              setorData?.nomeSetor ||
              setorData?.siglaSetor ||
              setorPaciente;
          }
        }

        toast({
          title: 'Paciente já internado',
          description: `Paciente já internado. ${nomePaciente} já se encontra no sistema. Localização: ${setorPaciente || 'Setor não informado'}, Leito: ${codigoLeitoPaciente || 'Não informado'}. Para alterar a localização, por favor, utilize a função 'Mover Paciente'.`,
          variant: 'destructive',
        });
        return;
      }

      const batch = writeBatch(db);
      const pacienteRef = doc(getPacientesCollection());
      const leitoRef = doc(getLeitosCollection(), leito.id);

      batch.set(pacienteRef, {
        nomePaciente,
        nomePacienteNormalizado,
        dataNascimento: dataNascimentoFormatada,
        sexo: sexoCodigo,
        dataInternacao: dataInternacaoDate,
        especialidade: values.especialidade,
        leitoId: leito.id,
        setorId: leito.setorId || null,
        status: 'Ativo',
        origemInternacao: 'Manual',
        criadoEm: serverTimestamp(),
      });

      batch.update(leitoRef, {
        status: 'Ocupado',
        statusLeito: 'Ocupado',
        pacienteId: pacienteRef.id,
        historico: arrayUnion({
          status: 'Ocupado',
          timestamp: new Date(),
        }),
        dataUltimaMovimentacao: serverTimestamp(),
      });

      await batch.commit();

      await logAction(
        'Mapa de Leitos',
        `Internação Manual - Paciente ${nomePaciente} internado manualmente no leito ${leito.codigoLeito || leito.codigo}.`,
        currentUser
      );

      toast({
        title: 'Internação registrada',
        description: `Paciente ${nomePaciente} internado no leito ${leito.codigoLeito || leito.codigo}.`,
      });

      onClose?.();
    } catch (error) {
      console.error('Erro ao internar paciente manualmente:', error);
      toast({
        title: 'Erro na internação',
        description: 'Não foi possível completar a internação manual. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => (open ? null : handleClose())}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Internação Manual de Paciente</DialogTitle>
          <DialogDescription>
            Informe os dados do paciente para ocupar o leito {leito?.codigoLeito || leito?.codigo || 'selecionado'}.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="nomeCompleto"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome completo do paciente</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Digite o nome completo"
                      {...field}
                      onChange={(event) => field.onChange(event.target.value.toUpperCase())}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-6 md:grid-cols-2">
              <FormField
                control={form.control}
                name="dataNascimento"
                render={({ field }) => {
                  const selectedDate = parseDateString(field.value);
                  return (
                    <FormItem className="flex flex-col">
                      <FormLabel>Data de nascimento</FormLabel>
                      <Popover open={dobPopoverOpen} onOpenChange={setDobPopoverOpen}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <div className="relative">
                              <Input
                                placeholder="DD/MM/AAAA"
                                value={field.value}
                                onChange={(event) => field.onChange(event.target.value)}
                                disabled={isSubmitting}
                              />
                              <CalendarIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                            </div>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={selectedDate || undefined}
                            onSelect={(date) => {
                              if (date) {
                                field.onChange(formatDate(date));
                              }
                              setDobPopoverOpen(false);
                            }}
                            initialFocus
                            locale={ptBR}
                            disabled={(date) => date > new Date()}
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />

              <FormField
                control={form.control}
                name="sexo"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel>Sexo</FormLabel>
                    <FormControl>
                      <RadioGroup
                        className="flex flex-col space-y-2"
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={isSubmitting}
                      >
                        <FormItem className="flex items-center space-x-2 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="Masculino" />
                          </FormControl>
                          <Label className="font-normal">Masculino</Label>
                        </FormItem>
                        <FormItem className="flex items-center space-x-2 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="Feminino" />
                          </FormControl>
                          <Label className="font-normal">Feminino</Label>
                        </FormItem>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="dataHoraInternacao"
              render={({ field }) => {
                const selectedDateTime = parseDateTimeString(field.value);
                const currentDatePart = extractDatePart(field.value);
                const currentTimePart = extractTime(field.value);

                return (
                  <FormItem className="flex flex-col">
                    <FormLabel>Data e hora de internação</FormLabel>
                    <Popover open={internacaoPopoverOpen} onOpenChange={setInternacaoPopoverOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <div className="relative">
                            <Input
                              placeholder="DD/MM/AAAA HH:MM"
                              value={field.value}
                              onChange={(event) => field.onChange(event.target.value)}
                              disabled={isSubmitting}
                            />
                            <CalendarIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                          </div>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={selectedDateTime || parseDateString(currentDatePart) || new Date()}
                          onSelect={(date) => {
                            if (!date) return;
                            field.onChange(`${formatDate(date)} ${currentTimePart}`.trim());
                          }}
                          initialFocus
                          locale={ptBR}
                        />
                        <div className="p-3 border-t">
                          <Label htmlFor="hora-internacao" className="mb-1 block text-sm text-muted-foreground">
                            Hora
                          </Label>
                          <Input
                            id="hora-internacao"
                            type="time"
                            step={60}
                            value={currentTimePart}
                            onChange={(event) => {
                              const timeValue = event.target.value || '00:00';
                              const datePart = currentDatePart || formatDate(new Date());
                              field.onChange(`${datePart} ${timeValue}`.trim());
                            }}
                            disabled={isSubmitting}
                          />
                        </div>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />

            <FormField
              control={form.control}
              name="especialidade"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Especialidade de internação</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={isSubmitting}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a especialidade" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ESPECIALIDADES_MEDICAS.map((especialidade) => (
                        <SelectItem key={especialidade} value={especialidade}>
                          {especialidade}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  'Confirmar internação'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default InternacaoManualModal;

