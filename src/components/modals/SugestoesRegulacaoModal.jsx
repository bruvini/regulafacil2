import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const SugestoesRegulacaoModal = ({ isOpen, onClose }) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Funcionalidade em Desenvolvimento</DialogTitle>
          <DialogDescription>
            A funcionalidade de sugestões de regulação está sendo desenvolvida e estará
            disponível em breve.
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
};

export default SugestoesRegulacaoModal;
