import React from 'react';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";

const LiberarLeitoModal = ({ isOpen, onClose, onConfirm, leito, paciente }) => {
  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Liberar Leito</AlertDialogTitle>
          <AlertDialogDescription>
            Confirmar a liberação do leito <strong>{leito?.codigoLeito}</strong>?
            <br />
            <br />
            O paciente <strong>{paciente?.nomePaciente}</strong> será dado alta e o leito será encaminhado para higienização.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-red-600 hover:bg-red-700">
            Confirmar Liberação
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default LiberarLeitoModal;