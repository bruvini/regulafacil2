import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Wrench } from "lucide-react";
import ConfirmarRegulacaoModal from './ConfirmarRegulacaoModal';

const RegularPacienteModal = ({
  isOpen,
  onClose,
  paciente,
  modo = 'enfermaria',
  leitoSugerido = null
}) => {
  const [modalStep, setModalStep] = useState('selecao');
  const [leitoSelecionado, setLeitoSelecionado] = useState(null);

  // Este useEffect é CRÍTICO. Ele permite que o fluxo de confirmação continue funcionando.
  useEffect(() => {
    if (!isOpen) {
      setModalStep('selecao');
      setLeitoSelecionado(null);
      return;
    }

    if (leitoSugerido) {
      setLeitoSelecionado(leitoSugerido);
      setModalStep('confirmacao');
    }
  }, [isOpen, leitoSugerido]);

  const handleVoltarSelecao = () => {
    setModalStep('selecao');
    setLeitoSelecionado(null);
  };

  const handleRegulacaoConcluida = () => {
    onClose();
    setModalStep('selecao');
    setLeitoSelecionado(null);
  };

  if (!paciente) return null;

  return (
    <>
      {/* Modal principal, agora mostrando a mensagem de desenvolvimento */}
      <Dialog open={isOpen && modalStep === 'selecao'} onOpenChange={onClose}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg">
              Regular Paciente: {paciente?.nomePaciente}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center space-y-4 py-8 text-center">
            <Wrench className="h-12 w-12 text-yellow-500" />
            <h3 className="text-xl font-semibold">Em Desenvolvimento</h3>
            <p className="text-muted-foreground">
              O módulo de sugestão inteligente de leitos está sendo aprimorado.
              <br />
              Por favor, selecione o leito de destino diretamente no mapa.
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Confirmação (lógica preservada) */}
      {leitoSelecionado && paciente && modalStep === 'confirmacao' && (
        <Dialog open={true} onOpenChange={() => {}}>
          <DialogContent
            className="max-w-lg"
            onInteractOutside={(e) => e.preventDefault()}
            onEscapeKeyDown={(e) => e.preventDefault()}
          >
            <DialogHeader>
              <DialogTitle className="text-lg flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleVoltarSelecao}
                  className="p-1 h-8 w-8"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                Confirmar Regulação
              </DialogTitle>
            </DialogHeader>
            <ConfirmarRegulacaoModal
              isOpen={true}
              onClose={handleRegulacaoConcluida}
              paciente={paciente}
              leitoDestino={leitoSelecionado}
              showAsContent={true}
              modo={modo}
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

export default RegularPacienteModal;
