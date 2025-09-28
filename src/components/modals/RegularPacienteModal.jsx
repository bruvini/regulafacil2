import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { usePacientes, useLeitos, useSetores, useInfeccoes } from '@/hooks/useHospitalData';
import { useLeitoFinder } from '@/hooks/useLeitoFinder';
import ConfirmarRegulacaoModal from './ConfirmarRegulacaoModal';

const RegularPacienteModal = ({
  isOpen,
  onClose,
  paciente: pacienteAlvo,
  modo = 'enfermaria',
  leitoSugerido = null,
}) => {
  const [modalStep, setModalStep] = useState('selecao');
  const [leitoSelecionado, setLeitoSelecionado] = useState(null);

  // 1. Usa os hooks para buscar dados em tempo real
  const { data: pacientes, loading: loadingPacientes } = usePacientes();
  const { data: leitos, loading: loadingLeitos } = useLeitos();
  const { data: setores, loading: loadingSetores } = useSetores();
  const { data: infeccoes, loading: loadingInfeccoes } = useInfeccoes();

  // 2. Instancia o motor de regras
  const { encontrarLeitosCompativeis } = useLeitoFinder(pacientes, leitos, setores, infeccoes);

  // 3. Calcula os leitos compatíveis
  const leitosCompativeis = useMemo(() => {
    if (
      loadingPacientes ||
      loadingLeitos ||
      loadingSetores ||
      loadingInfeccoes ||
      !pacienteAlvo
    ) {
      return [];
    }
    return encontrarLeitosCompativeis(pacienteAlvo, modo);
  }, [
    pacienteAlvo,
    pacientes,
    leitos,
    setores,
    infeccoes,
    modo,
    loadingPacientes,
    loadingLeitos,
    loadingSetores,
    loadingInfeccoes,
    encontrarLeitosCompativeis,
  ]);

  const isLoading =
    loadingPacientes || loadingLeitos || loadingSetores || loadingInfeccoes || !pacienteAlvo;

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

  const handleRegulacaoConcluida = () => {
    onClose();
    setModalStep('selecao');
    setLeitoSelecionado(null);
  };

  const renderConteudo = () => {
    if (isLoading) {
      return (
        <div className="flex justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      );
    }

    return (
      <div>
        <h3 className="font-bold">{leitosCompativeis.length} Leitos Compatíveis Encontrados</h3>
        <ScrollArea className="h-96 mt-4">
          {leitosCompativeis.map((leito) => (
            <div key={leito.id} className="p-2 border-b">
              {leito.codigoLeito}
            </div>
          ))}
          {leitosCompativeis.length === 0 && (
            <div className="p-4 text-sm text-muted-foreground">
              Nenhum leito compatível encontrado.
            </div>
          )}
        </ScrollArea>
      </div>
    );
  };

  return (
    <>
      <Dialog open={isOpen && modalStep === 'selecao'} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Regular Paciente: {pacienteAlvo?.nomePaciente}</DialogTitle>
          </DialogHeader>
          {renderConteudo()}
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {leitoSelecionado && pacienteAlvo && modalStep === 'confirmacao' && (
        <ConfirmarRegulacaoModal
          isOpen
          onClose={onClose}
          paciente={pacienteAlvo}
          leito={leitoSelecionado}
          onBack={() => {
            setModalStep('selecao');
            setLeitoSelecionado(null);
          }}
          onSuccess={handleRegulacaoConcluida}
        />
      )}
    </>
  );
};

export default RegularPacienteModal;
