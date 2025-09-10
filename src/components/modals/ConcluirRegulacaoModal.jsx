import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle, AlertTriangle } from "lucide-react";

const ConcluirRegulacaoModal = ({ 
  open, 
  onOpenChange, 
  paciente, 
  leitoOrigem, 
  leitoDestino, 
  onConfirmar 
}) => {
  if (!paciente) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Concluir Regulação
          </DialogTitle>
        </DialogHeader>
        
        <div className="py-4">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="h-8 w-8 text-amber-500 flex-shrink-0" />
            <div>
              <p className="font-medium">
                Deseja concluir a regulação para o paciente <span className="font-bold">{paciente.nomePaciente}</span>?
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

          <p className="text-sm text-muted-foreground mt-4">
            Esta ação irá finalizar a regulação e transferir o paciente definitivamente para o leito de destino.
          </p>
        </div>

        <DialogFooter className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button 
            onClick={() => onConfirmar(paciente)}
            className="bg-green-600 hover:bg-green-700"
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Concluir Regulação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ConcluirRegulacaoModal;