import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

const toDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === 'function') return value.toDate();
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? null : parsed;
};

const formatTimestamp = (value) => {
  const date = toDate(value);
  if (!date) return 'Data não informada';
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const GerenciarStatusTransferenciaModal = ({
  isOpen,
  onClose,
  paciente,
  onSalvarAtualizacao,
  salvando
}) => {
  const [textoAtualizacao, setTextoAtualizacao] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setTextoAtualizacao('');
    }
  }, [isOpen]);

  const historico = useMemo(() => {
    const base = paciente?.pedidoTransferenciaExterna?.historicoStatus || [];

    return [...base]
      .map((item) => ({
        ...item,
        timestamp: toDate(item.timestamp)
      }))
      .sort((a, b) => {
        const timeA = a.timestamp?.getTime?.() || 0;
        const timeB = b.timestamp?.getTime?.() || 0;
        return timeB - timeA;
      });
  }, [paciente]);

  const handleSalvar = async () => {
    const texto = textoAtualizacao.trim();
    if (!texto) return;

    const sucesso = await onSalvarAtualizacao?.(texto);
    if (sucesso) {
      setTextoAtualizacao('');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Gerenciar Status da Transferência</DialogTitle>
          <DialogDescription>
            Consulte o histórico de atualizações e adicione novas informações sobre a transferência externa.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-muted p-3 rounded-md text-sm">
            <p className="font-medium text-foreground">Paciente: {paciente?.nomePaciente || '—'}</p>
            <p className="text-muted-foreground">Destino: {paciente?.pedidoTransferenciaExterna?.destino || '—'}</p>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-medium text-foreground">Histórico de Atualizações</h4>
            <div className="max-h-48 overflow-y-auto border border-dashed border-muted rounded-md p-3 space-y-3">
              {historico.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma atualização registrada até o momento.</p>
              ) : (
                historico.map((item, index) => (
                  <div key={index} className="space-y-1">
                    <p className="text-sm text-foreground whitespace-pre-wrap break-words">{item.texto}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.userName || 'Usuário não informado'} — {formatTimestamp(item.timestamp)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-medium text-foreground">Nova atualização</h4>
            <Textarea
              placeholder="Descreva a atualização do status da transferência..."
              value={textoAtualizacao}
              onChange={(event) => setTextoAtualizacao(event.target.value)}
              rows={4}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground text-right">{textoAtualizacao.length}/500 caracteres</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={salvando}>
            Fechar
          </Button>
          <Button onClick={handleSalvar} disabled={salvando || !textoAtualizacao.trim()}>
            {salvando ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default GerenciarStatusTransferenciaModal;
