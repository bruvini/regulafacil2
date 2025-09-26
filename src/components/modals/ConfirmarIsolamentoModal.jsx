import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { CheckCircle2 } from 'lucide-react';
import { 
  getPacientesCollection, 
  updateDoc, 
  doc 
} from '@/lib/firebase';
import { db } from '@/lib/firebase';
import { logAction } from '@/lib/auditoria';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

const ConfirmarIsolamentoModal = ({ isOpen, onClose, paciente, isolamento }) => {
  const [loading, setLoading] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const { currentUser } = useAuth();

  const handleConfirmar = async () => {
    if (!paciente || !isolamento) return;

    setLoading(true);
    try {
      // Atualizar o array de isolamentos do paciente
      const isolamentosAtualizados = paciente.isolamentos.map(iso => 
        iso.id === isolamento.id 
          ? { ...iso, status: 'Confirmado' }
          : iso
      );

      const pacienteRef = doc(db, getPacientesCollection().path, paciente.id);
      await updateDoc(pacienteRef, {
        isolamentos: isolamentosAtualizados
      });

      await logAction(
        "Gestão de Isolamentos",
        `Isolamento confirmado para ${paciente.nomePaciente}: infecção ${isolamento.infeccaoId}`,
        currentUser
      );

      toast({
        title: "Sucesso",
        description: "Isolamento confirmado com sucesso!"
      });

      setShowConfirmDialog(false);
      onClose();
    } catch (error) {
      console.error('Erro ao confirmar isolamento:', error);
      toast({
        title: "Erro",
        description: "Erro ao confirmar isolamento. Tente novamente.",
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
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              Confirmar Isolamento
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-4">
                Você está prestes a confirmar o isolamento suspeito do paciente:
              </p>
              <div className="p-4 bg-muted rounded-lg">
                <div className="font-medium">{paciente?.nomePaciente}</div>
                <div className="text-sm text-muted-foreground mt-1">
                  Esta ação alterará o status do isolamento de "Suspeito" para "Confirmado".
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
                Confirmar Isolamento
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Ação</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja confirmar este isolamento? 
              O status será alterado de "Suspeito" para "Confirmado".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmar}
              disabled={loading}
              className="bg-green-600 hover:bg-green-700"
            >
              {loading ? 'Confirmando...' : 'Confirmar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ConfirmarIsolamentoModal;