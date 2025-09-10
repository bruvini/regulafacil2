import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { XCircle, AlertTriangle } from "lucide-react";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const CancelarRegulacaoModal = ({ 
  open, 
  onOpenChange, 
  paciente, 
  leitoOrigem, 
  leitoDestino, 
  onConfirmar 
}) => {
  const [justificativa, setJustificativa] = useState('');

  const handleClose = () => {
    setJustificativa('');
    onOpenChange(false);
  };

  const handleConfirmar = () => {
    if (!justificativa.trim()) return;
    
    const mensagemCancelamento = `*REGULAÇÃO CANCELADA*

*Paciente:* _${paciente?.nomePaciente}_
*Motivo:* _${justificativa.trim()}_

_${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}_`;

    onConfirmar(paciente, justificativa.trim(), mensagemCancelamento);
    handleClose();
  };

  if (!paciente) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-destructive" />
            Cancelar Regulação
          </DialogTitle>
        </DialogHeader>
        
        <div className="py-4 space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="h-8 w-8 text-amber-500 flex-shrink-0" />
            <div>
              <p className="font-medium">
                Cancelar a regulação para o paciente <span className="font-bold">{paciente.nomePaciente}</span>?
              </p>
            </div>
          </div>

          <div className="bg-muted/50 p-4 rounded-lg space-y-2">
            <div className="text-sm">
              <span className="font-medium text-muted-foreground">DE: </span>
              <span className="font-semibold">{leitoOrigem?.siglaSetor} - {leitoOrigem?.codigo}</span>
            </div>
            <div className="text-sm">
              <span className="font-medium text-muted-foreground">PARA: </span>
              <span className="font-semibold">{leitoDestino?.siglaSetor} - {leitoDestino?.codigo}</span>
            </div>
          </div>

          {/* Pré-visualização da mensagem */}
          <div className="bg-muted/30 p-4 rounded-lg border">
            <Label className="text-sm font-medium text-muted-foreground">Pré-visualização da Mensagem:</Label>
            <div className="mt-2 text-sm whitespace-pre-line font-mono bg-background p-3 rounded border">
              {`*REGULAÇÃO CANCELADA*

*Paciente:* _${paciente?.nomePaciente}_
*Motivo:* _${justificativa || '[Justificativa será inserida aqui]'}_

_${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}_`}
            </div>
          </div>

          {/* Campo de justificativa */}
          <div className="space-y-2">
            <Label htmlFor="justificativa">
              Justificativa do Cancelamento <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="justificativa"
              placeholder="Informe o motivo do cancelamento da regulação..."
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              className="min-h-20"
            />
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={handleClose}
          >
            Cancelar
          </Button>
          <Button 
            onClick={handleConfirmar}
            disabled={!justificativa.trim()}
            variant="destructive"
          >
            <XCircle className="h-4 w-4 mr-2" />
            Confirmar Cancelamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CancelarRegulacaoModal;