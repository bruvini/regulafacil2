import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

const LOADING_MESSAGES = [
  'Compilando dados...',
  'Organizando informações...',
  'Gerando relatório...'
];

const PassagemPlantaoModal = ({ isOpen, onClose }) => {
  const [mensagemAtual, setMensagemAtual] = useState(0);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    setMensagemAtual(0);

    const intervalo = setInterval(() => {
      setMensagemAtual((indice) => (indice + 1) % LOADING_MESSAGES.length);
    }, 800);

    const timeout = setTimeout(() => {
      onClose?.();
    }, 2600);

    return () => {
      clearInterval(intervalo);
      clearTimeout(timeout);
    };
  }, [isOpen, onClose]);

  const handleOpenChange = (open) => {
    if (!open) {
      onClose?.();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            Passagem de Plantão
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-6 py-8">
          <div className="flex items-center gap-3 text-base font-medium text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span>{LOADING_MESSAGES[mensagemAtual]}</span>
          </div>
          <div className="space-y-1 text-center text-sm text-muted-foreground max-w-sm">
            <p>Estamos preparando o relatório estratégico para o próximo plantão.</p>
            <p>Mantenha o foco: em instantes o resumo corporativo estará disponível.</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PassagemPlantaoModal;
