import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const TransferenciaExternaModal = ({ isOpen, onClose, onSave, paciente }) => {
  const [motivo, setMotivo] = useState('');
  const [outroMotivo, setOutroMotivo] = useState('');
  const [destino, setDestino] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    const pedido = paciente?.pedidoTransferenciaExterna;

    if (pedido) {
      setMotivo(pedido.motivo || '');
      setOutroMotivo(pedido.outroMotivo || '');
      setDestino(pedido.destino && pedido.destino !== 'Não informado' ? pedido.destino : '');
    } else {
      setMotivo('');
      setOutroMotivo('');
      setDestino('');
    }
  }, [isOpen, paciente]);

  const motivosTransferencia = [
    'UTI',
    'Retaguarda',
    'Centro especializado',
    'Hospital de referência',
    'Solicitação médica',
    'Solicitação da família',
    'Outro'
  ];

  const handleSave = () => {
    const motivoFinal = motivo === 'Outro' ? outroMotivo : motivo;
    
    if (motivoFinal) {
      onSave({
        motivo: motivoFinal,
        outroMotivo: motivo === 'Outro' ? outroMotivo : '',
        destino: destino.trim() || 'Não informado'
      });
      
      // Reset form
      setMotivo('');
      setOutroMotivo('');
      setDestino('');
    }
  };

  const handleClose = () => {
    setMotivo('');
    setOutroMotivo('');
    setDestino('');
    onClose();
  };

  const isFormValid = motivo && (motivo !== 'Outro' || outroMotivo.trim());

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Solicitar Transferência Externa</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-4">
              Paciente: <strong>{paciente?.nomePaciente}</strong>
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Motivo da Transferência</Label>
            <Select value={motivo} onValueChange={setMotivo}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o motivo" />
              </SelectTrigger>
              <SelectContent>
                {motivosTransferencia.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {motivo === 'Outro' && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Especificar motivo</Label>
              <Input
                placeholder="Digite o motivo específico..."
                value={outroMotivo}
                onChange={(e) => setOutroMotivo(e.target.value)}
                maxLength={30}
              />
              <p className="text-xs text-muted-foreground">
                {outroMotivo.length}/30 caracteres
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-sm font-medium">Destino (opcional)</Label>
            <Input
              placeholder="Ex: Hospital XYZ, UTI ABC..."
              value={destino}
              onChange={(e) => setDestino(e.target.value)}
              maxLength={100}
            />
            <p className="text-xs text-muted-foreground">
              Se não informado, será registrado como "Não informado"
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSave}
            disabled={!isFormValid}
          >
            Solicitar Transferência
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TransferenciaExternaModal;