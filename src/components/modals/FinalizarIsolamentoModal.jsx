import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { CheckCircle } from 'lucide-react';
import { 
  getPacientesCollection, 
  updateDoc, 
  doc 
} from '@/lib/firebase';
import { db } from '@/lib/firebase';
import { logAction } from '@/lib/auditoria';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

const FinalizarIsolamentoModal = ({ isOpen, onClose, paciente, isolamento }) => {
  const [loading, setLoading] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const { currentUser } = useAuth();

  const handleFinalizar = async () => {
    if (!paciente || !isolamento) return;

    setLoading(true);
    try {
      // Remover o isolamento do array (finalização = remoção)
      const isolamentosAtualizados = paciente.isolamentos.filter(iso => 
        iso.id !== isolamento.id
      );

      const pacienteRef = doc(db, getPacientesCollection().path, paciente.id);
      await updateDoc(pacienteRef, {
        isolamentos: isolamentosAtualizados
      });

      await logAction(
        "Gestão de Isolamentos",
        `Isolamento finalizado para ${paciente.nomePaciente}: infecção ${isolamento.infeccaoId}`,
        currentUser
      );

      toast({
        title: "Sucesso",
        description: "Isolamento finalizado com sucesso!"
      });

      setShowConfirmDialog(false);
      onClose();
    } catch (error) {
      console.error('Erro ao finalizar isolamento:', error);
      toast({
        title: "Erro",
        description: "Erro ao finalizar isolamento. Tente novamente.",
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
              <CheckCircle className="h-5 w-5 text-green-500" />
              Finalizar Isolamento
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-4">
                Você está prestes a finalizar o isolamento confirmado do paciente:
              </p>
              <div className="p-4 bg-muted rounded-lg">
                <div className="font-medium">{paciente?.nomePaciente}</div>
                <div className="text-sm text-muted-foreground mt-1">
                  Esta ação indica que o isolamento foi concluído e o paciente 
                  não precisa mais estar em isolamento para esta infecção.
                  O registro será removido da lista ativa.
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
                onClick={() => setShowConfirmDialog(true)}
                className="flex-1"
                disabled={loading}
              >
                Finalizar Isolamento
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Finalização</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja finalizar este isolamento? 
              O paciente será considerado liberado do isolamento para esta infecção.
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleFinalizar}
              disabled={loading}
              className="bg-green-600 hover:bg-green-700"
            >
              {loading ? 'Finalizando...' : 'Finalizar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default FinalizarIsolamentoModal;