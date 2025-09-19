import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { format, subHours } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Clock } from 'lucide-react';

const combineDateAndTime = (date, time) => {
  if (!date || !time) return null;

  const [hoursStr = '0', minutesStr = '0'] = time.split(':');
  const hours = Number.parseInt(hoursStr, 10);
  const minutes = Number.parseInt(minutesStr, 10);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return null;
  }

  const combined = new Date(date);
  combined.setHours(hours, minutes, 0, 0);
  return combined;
};

const PanoramaDatePickerModal = ({ isOpen, onClose, onConfirmarPeriodo }) => {
  const [inicioDate, setInicioDate] = useState(null);
  const [fimDate, setFimDate] = useState(null);
  const [inicioTime, setInicioTime] = useState('00:00');
  const [fimTime, setFimTime] = useState('00:00');

  useEffect(() => {
    if (!isOpen) return;

    const agora = new Date();
    const inicioPadrao = subHours(agora, 24);

    setInicioDate(inicioPadrao);
    setFimDate(agora);
    setInicioTime(format(inicioPadrao, 'HH:mm'));
    setFimTime(format(agora, 'HH:mm'));
  }, [isOpen]);

  const inicioSelecionado = useMemo(
    () => combineDateAndTime(inicioDate, inicioTime),
    [inicioDate, inicioTime]
  );

  const fimSelecionado = useMemo(
    () => combineDateAndTime(fimDate, fimTime),
    [fimDate, fimTime]
  );

  const periodoValido =
    inicioSelecionado &&
    fimSelecionado &&
    inicioSelecionado.getTime() <= fimSelecionado.getTime();

  const handleConfirmar = () => {
    if (!periodoValido) return;

    onConfirmarPeriodo({ inicio: inicioSelecionado, fim: fimSelecionado });
  };

  const formatarResumoPeriodo = () => {
    if (!inicioSelecionado || !fimSelecionado) return '';

    return `${format(inicioSelecionado, 'dd/MM/yyyy HH:mm', { locale: ptBR })} até ${format(fimSelecionado, 'dd/MM/yyyy HH:mm', { locale: ptBR })}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Selecionar Período</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Escolha a janela de tempo que será utilizada para gerar o panorama de regulações.
          </p>
        </DialogHeader>

        <div className="space-y-6 py-2">
          <div className="space-y-2">
            <Label className="font-medium">Data e Hora de Início</Label>
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'justify-start text-left font-normal',
                      !inicioDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {inicioDate
                      ? format(inicioDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                      : 'Selecione a data'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={inicioDate}
                    onSelect={setInicioDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <Input
                  type="time"
                  value={inicioTime}
                  onChange={(event) => setInicioTime(event.target.value)}
                  className="w-28"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="font-medium">Data e Hora de Fim</Label>
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'justify-start text-left font-normal',
                      !fimDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {fimDate
                      ? format(fimDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                      : 'Selecione a data'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={fimDate}
                    onSelect={setFimDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <Input
                  type="time"
                  value={fimTime}
                  onChange={(event) => setFimTime(event.target.value)}
                  className="w-28"
                />
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Período selecionado:</p>
            {periodoValido ? (
              <p>{formatarResumoPeriodo()}</p>
            ) : (
              <p className="text-destructive">O horário final deve ser posterior ao horário inicial.</p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-end">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleConfirmar} disabled={!periodoValido}>
            Gerar panorama
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PanoramaDatePickerModal;
