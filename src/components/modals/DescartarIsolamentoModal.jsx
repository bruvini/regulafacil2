import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { XCircle } from 'lucide-react';
import { 
  getPacientesCollection, 
  updateDoc, 
  doc 
} from '@/lib/firebase';
import { db } from '@/lib/firebase';
import { logAction } from '@/lib/auditoria';
import { toast } from '@/hooks/use-toast';

const DescartarIsolamentoModal = ({ isOpen, onClose, paciente, isolamento }) => {
  const [loading, setLoading] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const handleDescartar = async () => {
    if (!paciente || !isolamento) return;

    setLoading(true);
    try {
      // Remover o isolamento do array
      const isolamentosAtualizados = paciente.isolamentos.filter(iso => 
        iso.id !== isolamento.id
      );

      const pacienteRef = doc(db, getPacientesCollection().path, paciente.id);
      await updateDoc(pacienteRef, {
        isolamentos: isolamentosAtualizados
      });

      await logAction(
        "Gestão de Isolamentos",
        `Isolamento descartado para ${paciente.nomePaciente}: infecção ${isolamento.infeccaoId}`
      );

      toast({
        title: "Sucesso",
        description: "Isolamento descartado com sucesso!"
      });

      setShowConfirmDialog(false);
      onClose();
    } catch (error) {
      console.error('Erro ao descartar isolamento:', error);
      toast({
        title: "Erro",
        description: "Erro ao descartar isolamento. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setShowConfirmDialog(false);
    onClose();
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" />
              Descartar Isolamento
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-4">
                Você está prestes a descartar o isolamento suspeito do paciente:
              </p>
              <div className="p-4 bg-muted rounded-lg">
                <div className="font-medium">{paciente?.nomePaciente}</div>
                <div className="text-sm text-muted-foreground mt-1">
                  Esta ação removerá completamente o isolamento da lista. 
                  Esta ação não pode ser desfeita.
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={handleClose}
                className="flex-1"
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button 
                variant="destructive"
                onClick={() => setShowConfirmDialog(true)}
                className="flex-1"
                disabled={loading}
              >
                Descartar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Descarte</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja descartar este isolamento? 
              O isolamento será removido permanentemente da lista do paciente.
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDescartar}
              disabled={loading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading ? 'Descartando...' : 'Descartar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default DescartarIsolamentoModal;