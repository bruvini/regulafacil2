import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const AltaNoLeitoModal = ({ isOpen, onClose, onSave, paciente }) => {
  const [tipo, setTipo] = useState('');
  const [horarioTermino, setHorarioTermino] = useState('');
  const [destino, setDestino] = useState('');
  const [pendencia, setPendencia] = useState('');
  const [motivo, setMotivo] = useState('');

  const opcoesAlta = [
    'Finalizando medicação',
    'Aguardando transporte',
    'Aguardando familiar', 
    'Aguardando EMAD',
    'Caso Social',
    'Outros'
  ];

  const handleSave = () => {
    let detalhe = '';
    
    switch(tipo) {
      case 'Finalizando medicação':
        detalhe = horarioTermino;
        break;
      case 'Aguardando transporte':
        detalhe = destino;
        break;
      case 'Aguardando EMAD':
        detalhe = pendencia;
        break;
      case 'Outros':
        detalhe = motivo;
        break;
      default:
        detalhe = '';
    }
    
    if (tipo && (tipo === 'Aguardando familiar' || tipo === 'Caso Social' || detalhe.trim())) {
      onSave({
        motivo: tipo,
        detalhe: detalhe.trim()
      });
      
      // Reset form
      setTipo('');
      setHorarioTermino('');
      setDestino('');
      setPendencia('');
      setMotivo('');
    }
  };

  const handleClose = () => {
    setTipo('');
    setHorarioTermino('');
    setDestino('');
    setPendencia('');
    setMotivo('');
    onClose();
  };

  const isFormValid = () => {
    if (!tipo) return false;
    
    switch(tipo) {
      case 'Finalizando medicação':
        return horarioTermino.trim() !== '';
      case 'Aguardando transporte':
        return destino.trim() !== '';
      case 'Aguardando EMAD':
        return pendencia.trim() !== '';
      case 'Outros':
        return motivo.trim() !== '';
      case 'Aguardando familiar':
      case 'Caso Social':
        return true;
      default:
        return false;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Alta no Leito</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-4">
              Paciente: <strong>{paciente?.nomePaciente}</strong>
            </p>
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium">Motivo da Alta no Leito</Label>
            <RadioGroup value={tipo} onValueChange={setTipo}>
              {opcoesAlta.map((opcao) => (
                <div key={opcao} className="flex items-center space-x-2">
                  <RadioGroupItem value={opcao} id={opcao} />
                  <Label htmlFor={opcao} className="text-sm">
                    {opcao}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {tipo === 'Finalizando medicação' && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Horário de término</Label>
              <Input
                placeholder="Ex: 14:30"
                value={horarioTermino}
                onChange={(e) => setHorarioTermino(e.target.value)}
                maxLength={50}
              />
            </div>
          )}

          {tipo === 'Aguardando transporte' && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Destino</Label>
              <Input
                placeholder="Ex: Hospital Regional"
                value={destino}
                onChange={(e) => setDestino(e.target.value)}
                maxLength={100}
              />
            </div>
          )}

          {tipo === 'Aguardando EMAD' && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Pendência</Label>
              <Input
                placeholder="Descreva a pendência..."
                value={pendencia}
                onChange={(e) => setPendencia(e.target.value)}
                maxLength={100}
              />
            </div>
          )}

          {tipo === 'Outros' && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Motivo específico</Label>
              <Textarea
                placeholder="Descreva o motivo..."
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                className="min-h-[80px]"
                maxLength={200}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSave}
            disabled={!isFormValid()}
          >
            Registrar Alta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AltaNoLeitoModal;