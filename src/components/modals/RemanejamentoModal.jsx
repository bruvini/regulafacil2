import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const RemanejamentoModal = ({ isOpen, onClose, onSave, paciente }) => {
  const [tipo, setTipo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [outroMotivo, setOutroMotivo] = useState('');

  const motivosRemanejamento = [
    'Incompatibilidade de gênero',
    'Necessidade de isolamento',
    'Mudança de especialidade',
    'Melhoria no atendimento',
    'Redução de custo',
    'Solicitação da família',
    'Outro'
  ];

  const handleSave = () => {
    const tipoFinal = tipo === 'Outro' ? outroMotivo : tipo;
    
    if (tipoFinal && (tipo !== 'Outro' || outroMotivo.trim())) {
      onSave({
        tipo: tipoFinal,
        descricao: descricao.trim()
      });
      
      // Reset form
      setTipo('');
      setDescricao('');
      setOutroMotivo('');
    }
  };

  const handleClose = () => {
    setTipo('');
    setDescricao('');
    setOutroMotivo('');
    onClose();
  };

  const isFormValid = tipo && (tipo !== 'Outro' || outroMotivo.trim());

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Solicitar Remanejamento</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-4">
              Paciente: <strong>{paciente?.nomePaciente}</strong>
            </p>
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium">Motivo do Remanejamento</Label>
            <RadioGroup value={tipo} onValueChange={setTipo}>
              {motivosRemanejamento.map((motivo) => (
                <div key={motivo} className="flex items-center space-x-2">
                  <RadioGroupItem value={motivo} id={motivo} />
                  <Label htmlFor={motivo} className="text-sm">
                    {motivo}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {tipo === 'Outro' && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Especificar motivo</Label>
              <Input
                placeholder="Digite o motivo específico..."
                value={outroMotivo}
                onChange={(e) => setOutroMotivo(e.target.value)}
                maxLength={100}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-sm font-medium">Observações (opcional)</Label>
            <Textarea
              placeholder="Detalhes adicionais sobre o remanejamento..."
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className="min-h-[80px]"
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground">
              {descricao.length}/500 caracteres
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
            Solicitar Remanejamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RemanejamentoModal;