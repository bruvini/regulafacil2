import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CalendarIcon } from "lucide-react";
import { format, setHours, setMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

const SelecionarPeriodoModal = ({ isOpen, onClose, onConfirm }) => {
  const [dataInicio, setDataInicio] = useState(new Date());
  const [dataFim, setDataFim] = useState(new Date());
  const [horaInicio, setHoraInicio] = useState("07:00");
  const [horaFim, setHoraFim] = useState("19:00");
  const [inicioPopoverOpen, setInicioPopoverOpen] = useState(false);
  const [fimPopoverOpen, setFimPopoverOpen] = useState(false);

  const handleConfirmar = () => {
    const [horaIni, minutoIni] = horaInicio.split(':').map(Number);
    const [horaFi, minutoFi] = horaFim.split(':').map(Number);
    
    const inicio = setMinutes(setHours(dataInicio, horaIni), minutoIni);
    const fim = setMinutes(setHours(dataFim, horaFi), minutoFi);
    
    onConfirm({ inicio, fim });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Selecionar Período para Relatório</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Data e Hora de Início */}
          <div className="space-y-2">
            <Label>Data e Hora de Início</Label>
            <div className="flex gap-2">
              <Popover open={inicioPopoverOpen} onOpenChange={setInicioPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dataInicio && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dataInicio ? format(dataInicio, "PPP", { locale: ptBR }) : "Selecione a data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dataInicio}
                    onSelect={(date) => {
                      setDataInicio(date);
                      setInicioPopoverOpen(false);
                    }}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              <Input
                type="time"
                value={horaInicio}
                onChange={(e) => setHoraInicio(e.target.value)}
                className="w-32"
              />
            </div>
          </div>

          {/* Data e Hora de Fim */}
          <div className="space-y-2">
            <Label>Data e Hora de Fim</Label>
            <div className="flex gap-2">
              <Popover open={fimPopoverOpen} onOpenChange={setFimPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dataFim && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dataFim ? format(dataFim, "PPP", { locale: ptBR }) : "Selecione a data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dataFim}
                    onSelect={(date) => {
                      setDataFim(date);
                      setFimPopoverOpen(false);
                    }}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              <Input
                type="time"
                value={horaFim}
                onChange={(e) => setHoraFim(e.target.value)}
                className="w-32"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleConfirmar}>
            Gerar Relatório
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SelecionarPeriodoModal;