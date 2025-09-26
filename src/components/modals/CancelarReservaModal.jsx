import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { 
  updateDoc, 
  doc, 
  db,
  writeBatch,
  arrayUnion,
  serverTimestamp,
  deleteField
} from '@/lib/firebase';
import { logAction } from '@/lib/auditoria';
import { useAuth } from '@/contexts/AuthContext';

const CancelarReservaModal = ({ isOpen, onClose, reserva }) => {
  const { toast } = useToast();
  const [justificativa, setJustificativa] = useState('');
  const [cancelando, setCancelando] = useState(false);
  const { currentUser } = useAuth();

  if (!reserva) return null;

  const handleCancelarReserva = async () => {
    if (!justificativa.trim()) {
      toast({
        title: "Erro",
        description: "Por favor, informe a justificativa para o cancelamento.",
        variant: "destructive"
      });
      return;
    }

    setCancelando(true);
    try {
      const batch = writeBatch(db);

      // Adicionar observação com justificativa
      const observacao = {
        texto: `RESERVA CANCELADA - ${justificativa.trim()}`,
        data: serverTimestamp(),
        usuarioNome: currentUser?.nomeCompleto || 'Sistema'
      };

      // Atualizar reserva
      const reservaRef = doc(db, 'artifacts/regulafacil/public/data/reservasExternas', reserva.id);
      batch.update(reservaRef, {
        leitoReservadoId: null,
        observacoes: arrayUnion(observacao)
      });

      // Liberar o leito se estiver reservado
      if (reserva.leitoReservadoId) {
        const leitoRef = doc(db, 'artifacts/regulafacil/public/data/leitos', reserva.leitoReservadoId);
        batch.update(leitoRef, {
          reservaExterna: deleteField(),
          status: 'Vago'
        });
      }

      await batch.commit();

      await logAction(
        'Reservas de Leitos',
        `Reserva de leito cancelada: ${reserva.nomeCompleto} - ${justificativa.trim()}`,
        currentUser
      );

      toast({
        title: "Sucesso",
        description: "Reserva cancelada com sucesso!"
      });

      setJustificativa('');
      onClose();
    } catch (error) {
      console.error('Erro ao cancelar reserva:', error);
      toast({
        title: "Erro",
        description: "Erro ao cancelar reserva. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setCancelando(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Cancelar Reserva de Leito
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-muted p-4 rounded-md">
            <p className="font-semibold">Paciente: {reserva.nomeCompleto}</p>
            <p className="text-sm text-muted-foreground">
              Esta ação irá liberar o leito reservado e manter o pedido de reserva ativo.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="justificativa" className="text-destructive">
              Justificativa do Cancelamento *
            </Label>
            <Textarea
              id="justificativa"
              placeholder="Informe o motivo do cancelamento da reserva..."
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={cancelando}>
            Cancelar
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleCancelarReserva}
            disabled={cancelando}
          >
            {cancelando ? 'Cancelando...' : 'Confirmar Cancelamento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CancelarReservaModal;