import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Sparkles } from 'lucide-react';

const opcoesLimpeza = [
  {
    valor: 'Concorrente',
    titulo: 'Limpeza Concorrente',
    descricao: 'Manutenção do leito com limpeza rápida para reutilização imediata.'
  },
  {
    valor: 'Terminal',
    titulo: 'Limpeza Terminal',
    descricao: 'Processo completo de desinfecção para liberação do leito.'
  }
];

const IniciarHigienizacaoModal = ({ open, onOpenChange, leito, onConfirmar, loading = false }) => {
  const [tipoLimpeza, setTipoLimpeza] = useState('Concorrente');

  useEffect(() => {
    if (open) {
      setTipoLimpeza('Concorrente');
    }
  }, [open]);

  const handleOpenChange = (novoEstado) => {
    if (!novoEstado) {
      setTipoLimpeza('Concorrente');
    }

    if (onOpenChange) {
      onOpenChange(novoEstado);
    }
  };

  const handleConfirmar = () => {
    if (onConfirmar) {
      onConfirmar(tipoLimpeza);
    }
  };

  const descricaoLeito = leito?.codigoLeito
    ? `o leito ${leito.codigoLeito}`
    : 'o leito selecionado';

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-600" />
            Iniciar Higienização
          </DialogTitle>
          <DialogDescription>
            Selecione o tipo de higienização para {descricaoLeito} e confirme o início do processo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Leito:</span> {leito?.codigoLeito || 'Não informado'}
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">Tipo de limpeza</p>
            <RadioGroup value={tipoLimpeza} onValueChange={setTipoLimpeza} className="space-y-3">
              {opcoesLimpeza.map((opcao) => (
                <div
                  key={opcao.valor}
                  className="flex items-start gap-3 rounded-lg border p-3"
                >
                  <RadioGroupItem value={opcao.valor} id={`limpeza-${opcao.valor}`} />
                  <Label htmlFor={`limpeza-${opcao.valor}`} className="space-y-1">
                    <span className="block text-sm font-medium">{opcao.titulo}</span>
                    <span className="block text-xs text-muted-foreground">{opcao.descricao}</span>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        </div>

        <DialogFooter className="pt-4">
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleConfirmar} disabled={loading}>
            {loading ? 'Iniciando...' : 'Confirmar Início'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default IniciarHigienizacaoModal;
