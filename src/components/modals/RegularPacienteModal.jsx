import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { 
  getLeitosCollection,
  getQuartosCollection,
  getSetoresCollection,
  getPacientesCollection,
  onSnapshot
} from '@/lib/firebase';
import LeitoSelectionStep from './steps/LeitoSelectionStep';
import ConfirmarRegulacaoModal from './ConfirmarRegulacaoModal';

const RegularPacienteModal = ({ isOpen, onClose, paciente, modo = 'enfermaria', infeccoes = [] }) => {
  const [dados, setDados] = useState({
    leitos: [],
    quartos: [],
    setores: [],
    pacientes: [],
    loading: true
  });
  const [modalStep, setModalStep] = useState('selecao');
  const [leitoSelecionado, setLeitoSelecionado] = useState(null);

  // Buscar todos os dados necessários
  useEffect(() => {
    if (!isOpen || !paciente) return;

    let unsubscribes = [];

    const buscarDados = async () => {
      setDados(prev => ({ ...prev, loading: true }));

      try {
        // Listener para leitos
        const unsubLeitos = onSnapshot(getLeitosCollection(), (snapshot) => {
          const leitosData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          setDados(prev => ({ ...prev, leitos: leitosData }));
        });

        // Listener para quartos
        const unsubQuartos = onSnapshot(getQuartosCollection(), (snapshot) => {
          const quartosData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          setDados(prev => ({ ...prev, quartos: quartosData }));
        });

        // Listener para setores
        const unsubSetores = onSnapshot(getSetoresCollection(), (snapshot) => {
          const setoresData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          setDados(prev => ({ ...prev, setores: setoresData }));
        });

        // Listener para pacientes
        const unsubPacientes = onSnapshot(getPacientesCollection(), (snapshot) => {
          const pacientesData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          setDados(prev => ({ ...prev, pacientes: pacientesData, loading: false }));
        });

        unsubscribes = [unsubLeitos, unsubQuartos, unsubSetores, unsubPacientes];
      } catch (error) {
        console.error('Erro ao buscar dados:', error);
        setDados(prev => ({ ...prev, loading: false }));
      }
    };

    buscarDados();

    return () => {
      unsubscribes.forEach(unsub => unsub && unsub());
    };
  }, [isOpen, paciente]);

  const handleLeitoSelect = (leito) => {
    setLeitoSelecionado(leito);
    setModalStep('confirmacao');
  };

  const getLeitoOrigem = () => {
    if (!paciente || !dados.leitos || !dados.setores) return null;
    
    // Buscar o leito atual do paciente
    const leitoAtual = dados.leitos.find(l => l.id === paciente.leitoId);
    if (!leitoAtual) return null;
    
    // Buscar o setor do leito atual
    const setorAtual = dados.setores.find(s => s.id === leitoAtual.setorId);
    
    return {
      id: leitoAtual.id,
      codigoLeito: leitoAtual.codigoLeito || paciente.codigoLeito || 'N/A',
      siglaSetor: setorAtual?.siglaSetor || paciente.siglaSetor || 'N/A',
      nomeSetor: setorAtual?.nomeSetor || 'N/A'
    };
  };

  const handleRegulacaoConcluida = () => {
    onClose();
    // Reset state when closing
    setModalStep('selecao');
    setLeitoSelecionado(null);
  };

  if (!paciente) return null;

  return (
    <>
      {/* Modal de Seleção de Leitos */}
      <Dialog open={isOpen && modalStep === 'selecao'} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="text-lg">
              Selecionar Leito de Destino para: {paciente?.nomePaciente}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <LeitoSelectionStep
              dados={dados}
              paciente={paciente}
              modo={modo}
              onLeitoSelect={handleLeitoSelect}
            />

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={onClose}>
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Confirmação */}
      {leitoSelecionado && paciente && (
        <ConfirmarRegulacaoModal
          isOpen={modalStep === 'confirmacao'}
          onClose={handleRegulacaoConcluida}
          paciente={paciente}
          leitoOrigem={getLeitoOrigem()}
          leitoDestino={leitoSelecionado}
          infeccoes={infeccoes}
        />
      )}
    </>
  );
};

export default RegularPacienteModal;