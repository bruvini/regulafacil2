import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  getReservasExternasCollection,
  getLeitosCollection,
  doc,
  writeBatch,
  db,
  deleteField,
  arrayUnion
} from '@/lib/firebase';
import { logAction } from '@/lib/auditoria';

const CancelarReservaExternaModal = ({ isOpen, onClose, reserva, leito }) => {
  const { toast } = useToast();
  const [decisao, setDecisao] = useState('fila');
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setDecisao('fila');
      setCarregando(false);
    }
  }, [isOpen]);

  if (!reserva) {
    return null;
  }

  const leitoSelecionadoId = leito?.id || reserva.leitoReservadoId;

  const handleConfirmar = async () => {
    setCarregando(true);

    try {
      const batch = writeBatch(db);

      const reservaRef = doc(getReservasExternasCollection(), reserva.id);
      batch.update(reservaRef, {
        leitoReservadoId: deleteField(),
        status: decisao === 'fila' ? 'Aguardando Leito' : 'Cancelada'
      });

      if (leitoSelecionadoId) {
        const leitoRef = doc(getLeitosCollection(), leitoSelecionadoId);
        batch.update(leitoRef, {
          status: 'Vago',
          reservaExterna: deleteField(),
          historico: arrayUnion({
            status: 'Vago',
            timestamp: new Date(),
            origem: 'Reserva Externa cancelada'
          })
        });
      }

      await batch.commit();

      await logAction(
        'Reservas de Leitos',
        decisao === 'fila'
          ? `Reserva externa devolvida para a fila: ${reserva.nomeCompleto}`
          : `Reserva externa cancelada permanentemente: ${reserva.nomeCompleto}`
      );

      toast({
        title: 'Reserva atualizada',
        description:
          decisao === 'fila'
            ? 'O paciente retornou para a fila de espera.'
            : 'A solicitação foi cancelada permanentemente.'
      });

      onClose();
    } catch (error) {
      console.error('Erro ao cancelar reserva externa:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar a reserva. Tente novamente.',
        variant: 'destructive'
      });
    } finally {
      setCarregando(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Cancelar Reserva Externa</DialogTitle>
          <DialogDescription>
            Defina como a solicitação do paciente <strong>{reserva.nomeCompleto}</strong> deve seguir.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="rounded-md border bg-muted/50 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-yellow-600" />
              <div className="space-y-2 text-sm">
                <p>
                  <strong>Leito reservado:</strong>{' '}
                  {leito?.codigoLeito || leitoSelecionadoId || 'Não informado'}
                </p>
                <p>
                  <strong>Origem:</strong> {reserva.origem}
                </p>
                {reserva.origem === 'SISREG' ? (
                  <p>
                    <strong>Instituição:</strong> {reserva.instituicaoOrigem}
                  </p>
                ) : (
                  <p>
                    <strong>Especialidade:</strong> {reserva.especialidadeOncologia}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <Label>Selecione a ação desejada</Label>
            <RadioGroup value={decisao} onValueChange={setDecisao} className="space-y-3">
              <div
                className={`flex items-start gap-3 rounded-md border p-4 transition-colors ${
                  decisao === 'fila' ? 'border-primary bg-primary/5' : 'border-border'
                }`}
              >
                <RadioGroupItem value="fila" id="decisao-fila" className="mt-1" />
                <div>
                  <Label htmlFor="decisao-fila" className="font-semibold">
                    Manter na Fila de Espera
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Remove o leito reservado e mantém a solicitação aguardando um novo leito disponível.
                  </p>
                </div>
              </div>

              <div
                className={`flex items-start gap-3 rounded-md border p-4 transition-colors ${
                  decisao === 'cancelar' ? 'border-destructive bg-destructive/10' : 'border-border'
                }`}
              >
                <RadioGroupItem value="cancelar" id="decisao-cancelar" className="mt-1" />
                <div>
                  <Label htmlFor="decisao-cancelar" className="font-semibold text-destructive">
                    Cancelar Solicitação Permanentemente
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Remove a reserva e encerra a solicitação do paciente, registrando o status como cancelado.
                  </p>
                </div>
              </div>
            </RadioGroup>
          </div>

          <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
            <p>
              Após confirmar, o leito será liberado e ficará novamente disponível no mapa de leitos.
            </p>
          </div>
        </div>

        <DialogFooter className="flex items-center justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={carregando}>
            Voltar
          </Button>
          <Button variant={decisao === 'cancelar' ? 'destructive' : 'default'} onClick={handleConfirmar} disabled={carregando}>
            {carregando ? 'Atualizando...' : 'Confirmar Ação'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CancelarReservaExternaModal;
