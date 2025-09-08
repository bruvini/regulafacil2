import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const ObservacoesModal = ({ isOpen, onClose, onSave, paciente }) => {
  const [novaObservacao, setNovaObservacao] = useState('');

  const handleSave = () => {
    if (novaObservacao.trim()) {
      onSave(novaObservacao.trim());
      setNovaObservacao('');
    }
  };

  const formatarDataObservacao = (timestamp) => {
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    } catch (error) {
      return 'Data inválida';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Observações do Paciente</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-2">
              Paciente: <strong>{paciente?.nomePaciente}</strong>
            </p>
          </div>

          {/* Nova observação */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Nova Observação</label>
            <Textarea
              placeholder="Digite sua observação..."
              value={novaObservacao}
              onChange={(e) => setNovaObservacao(e.target.value)}
              className="min-h-[100px]"
            />
          </div>

          {/* Lista de observações existentes */}
          {paciente?.observacoes && paciente.observacoes.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Observações Anteriores</h4>
              <div className="max-h-60 overflow-y-auto space-y-2">
                {paciente.observacoes
                  .sort((a, b) => {
                    const dateA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp);
                    const dateB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp);
                    return dateB - dateA;
                  })
                  .map((obs, index) => (
                    <div key={index} className="bg-gray-50 p-3 rounded-lg">
                      <p className="text-sm text-gray-900 mb-1">{obs.texto}</p>
                      <Badge variant="outline" className="text-xs">
                        {formatarDataObservacao(obs.timestamp)}
                      </Badge>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {(!paciente?.observacoes || paciente.observacoes.length === 0) && (
            <div className="text-center py-4 text-sm text-muted-foreground">
              Nenhuma observação registrada para este paciente.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
          <Button 
            onClick={handleSave}
            disabled={!novaObservacao.trim()}
          >
            Salvar Observação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ObservacoesModal;