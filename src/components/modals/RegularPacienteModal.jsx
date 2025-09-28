// src/components/modals/RegularPacienteModal.jsx
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
import { useDadosHospitalares } from '@/hooks/useDadosHospitalares';
import { encontrarLeitosCompativeis } from '@/lib/compatibilidadeUtils';
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

  // 1. USA O HOOK MESTRE PARA TER A VISÃO COMPLETA E ENRIQUECIDA DO HOSPITAL
  const {
    estrutura,
    pacientesEnriquecidos,
    setores = [],
    leitos = [],
    infeccoes = [],
    loading
  } = useDadosHospitalares();

  // 2. ENCONTRA A VERSÃO ENRIQUECIDA DO PACIENTE-ALVO
  const pacienteEnriquecido = useMemo(() => {
    if (!pacienteAlvo) return null;
    return pacientesEnriquecidos.find(p => p.id === pacienteAlvo.id) || null;
  }, [pacientesEnriquecidos, pacienteAlvo]);

  // 3. CALCULA OS LEITOS COMPATÍVEIS USANDO O MOTOR DE REGRAS PURO
  const leitosCompativeis = useMemo(() => {
    if (loading || !pacienteEnriquecido) return [];
    return encontrarLeitosCompativeis(pacienteEnriquecido, { estrutura }, modo);
  }, [pacienteEnriquecido, estrutura, modo, loading]);

  const leitoOrigem = useMemo(() => {
    if (!pacienteEnriquecido?.leitoId) return null;
    return leitos.find(leito => leito.id === pacienteEnriquecido.leitoId) || null;
  }, [pacienteEnriquecido, leitos]);

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

  const handleLeitoSelect = (leito) => {
    console.log('Leito selecionado:', leito);
    setLeitoSelecionado(leito);
    setModalStep('confirmacao');
  };

  const renderContent = () => {
    if (loading || !pacienteAlvo) {
      return (
        <div className="flex justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      );
    }

    if (!pacienteEnriquecido) {
      return (
        <div className="flex items-center justify-center p-8 text-sm text-muted-foreground">
          Paciente não encontrado.
        </div>
      );
    }

    // RENDERIZA A LISTA FINAL DE LEITOS COMPATÍVEIS
    return (
      <div>
        <h3 className="mb-4 font-semibold">
          {leitosCompativeis.length} Leito(s) Compatível(is) Encontrado(s)
        </h3>
        <ScrollArea className="h-96 border rounded-md">
          {leitosCompativeis.length > 0 ? (
            leitosCompativeis.map(leito => (
              <div
                key={leito.id}
                className="p-3 border-b hover:bg-muted/50 cursor-pointer"
                onClick={() => handleLeitoSelect(leito)}
              >
                <p className="font-mono font-semibold">{leito.codigoLeito}</p>
                <p className="text-sm text-muted-foreground">
                  {setores.find(s => s.id === leito.setorId)?.nomeSetor || leito.nomeSetor || 'Setor não informado'}
                </p>
              </div>
            ))
          ) : (
            <div className="flex items-center justify-center h-full p-4">
              <p className="text-muted-foreground">Nenhum leito compatível encontrado.</p>
            </div>
          )}
        </ScrollArea>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Regular Paciente: {pacienteAlvo?.nomePaciente}</DialogTitle>
        </DialogHeader>

        {modalStep === 'selecao' && renderContent()}

        {leitoSelecionado && pacienteEnriquecido && modalStep === 'confirmacao' && (
          <ConfirmarRegulacaoModal
            isOpen={true}
            onClose={handleRegulacaoConcluida}
            paciente={pacienteEnriquecido}
            leitoOrigem={leitoOrigem}
            leitoDestino={leitoSelecionado}
            infeccoes={infeccoes}
            onBack={() => {
              setModalStep('selecao');
              setLeitoSelecionado(null);
            }}
            showAsContent={true}
            modo={modo}
          />
        )}

        {modalStep === 'selecao' && (
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Fechar
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default RegularPacienteModal;
