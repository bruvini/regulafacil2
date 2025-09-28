// src/components/modals/RegularPacienteModal.jsx

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, CheckCircle, Info } from "lucide-react";
import { getHospitalData } from '@/lib/hospitalData'; // Importando nosso novo pipeline!
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

  // Estados para nossa tela de diagnóstico da Fase 1
  const [loadingData, setLoadingData] = useState(true);
  const [hospitalData, setHospitalData] = useState(null);
  const [error, setError] = useState(null);

  // Efeito para carregar os dados quando o modal abre
  useEffect(() => {
    if (isOpen && modalStep === 'selecao' && !leitoSugerido) {
      setLoadingData(true);
      setError(null);
      
      getHospitalData()
        .then(data => {
          setHospitalData(data);
        })
        .catch(err => {
          console.error("Erro ao carregar dados do hospital:", err);
          setError("Falha ao carregar os dados do hospital. Verifique o console.");
        })
        .finally(() => {
          setLoadingData(false);
        });
    }
  }, [isOpen, modalStep, leitoSugerido]);
  
  // Efeito CRÍTICO que preserva o fluxo de confirmação direta
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

  const PacienteAtualInfo = () => {
    if (!hospitalData || !paciente) return null;
    const pacienteEnriquecido = hospitalData.pacientes.find(p => p.id === paciente.id);
    if (!pacienteEnriquecido) return <p>Paciente não encontrado nos dados carregados.</p>;

    return (
      <div className="text-sm p-4 bg-muted rounded-lg">
        <h4 className="font-semibold mb-2">Paciente a Regular: {pacienteEnriquecido.nomePaciente}</h4>
        <p><strong>Sexo:</strong> {pacienteEnriquecido.sexo || 'Não definido'}</p>
        <div>
          <strong>Isolamentos Ativos:</strong>
          {pacienteEnriquecido.isolamentos.filter(iso => iso.statusConsideradoAtivo).length > 0 ? (
            <ul className="list-disc pl-5 mt-1">
              {pacienteEnriquecido.isolamentos.filter(iso => iso.statusConsideradoAtivo).map((iso, i) => (
                <li key={i}>{iso.siglaInfeccao || 'Desconhecido'} ({iso.status})</li>
              ))}
            </ul>
          ) : (
            <span> Nenhum</span>
          )}
        </div>
      </div>
    );
  };

  const ResumoDados = () => (
    <div className="space-y-4">
      <div className="flex items-center text-green-600">
        <CheckCircle className="h-5 w-5 mr-2" />
        <p className="font-semibold">Pipeline de Dados executado com sucesso!</p>
      </div>
      
      <PacienteAtualInfo />
      
      <div className="text-sm p-4 border rounded-lg">
        <h4 className="font-semibold mb-2">Resumo dos Dados Carregados do Firestore:</h4>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>{hospitalData.pacientes.length}</strong> pacientes processados e enriquecidos.</li>
          <li><strong>{hospitalData.leitos.length}</strong> leitos carregados.</li>
          <li><strong>{hospitalData.quartos.length}</strong> quartos carregados.</li>
          <li><strong>{hospitalData.setores.length}</strong> setores carregados.</li>
          <li><strong>{hospitalData.infeccoes.length}</strong> infecções no cache.</li>
        </ul>
      </div>

       <div className="text-xs p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start">
        <Info className="h-4 w-4 mr-2 mt-0.5 text-blue-500 flex-shrink-0" />
        <p className="text-blue-700">
          <strong>Próximo Passo:</strong> Com os dados validados, a próxima etapa (Fase 2) será implementar as regras de compatibilidade para filtrar os leitos disponíveis para este paciente.
        </p>
      </div>
    </div>
  );

  return (
    <>
      <Dialog open={isOpen && modalStep === 'selecao'} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg">
              Fase 1: Validação do Pipeline de Dados
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {loadingData && (
              <div className="flex items-center justify-center h-40">
                <Loader2 className="h-8 w-8 animate-spin mr-3" />
                <span>Buscando e processando dados...</span>
              </div>
            )}
            {error && <p className="text-red-500">{error}</p>}
            {!loadingData && hospitalData && <ResumoDados />}
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* O Modal de Confirmação continua funcionando normalmente */}
      {leitoSelecionado && paciente && modalStep === 'confirmacao' && (
        <Dialog open={true} onOpenChange={() => {}}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-lg flex items-center gap-2">
                 <Button variant="ghost" size="sm" onClick={() => setModalStep('selecao')}>
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
