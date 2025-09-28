import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import {
  getLeitosCollection,
  getQuartosCollection,
  getSetoresCollection,
  getPacientesCollection,
  onSnapshot
} from '@/lib/firebase';
import { processarPaciente, normalizarEstruturaPaciente } from '@/lib/pacienteUtils';
import LeitoSelectionStep from './steps/LeitoSelectionStep';
import ConfirmarRegulacaoModal from './ConfirmarRegulacaoModal';

const RegularPacienteModal = ({
  isOpen,
  onClose,
  paciente,
  modo = 'enfermaria',
  infeccoes = [],
  leitoSugerido = null
}) => {
  const [dados, setDados] = useState({
    leitos: [],
    quartos: [],
    setores: [],
    pacientes: [],
    loading: true
  });
  const [modalStep, setModalStep] = useState('selecao');
  const [leitoSelecionado, setLeitoSelecionado] = useState(null);
  const [pacienteProcessado, setPacienteProcessado] = useState(null);
  const infeccoesCacheRef = useRef(new Map());

  useEffect(() => {
    const cacheAtual = new Map(infeccoesCacheRef.current);
    (infeccoes || []).forEach((infeccao) => {
      if (infeccao?.id) {
        cacheAtual.set(infeccao.id, infeccao);
      }
    });
    infeccoesCacheRef.current = cacheAtual;
  }, [infeccoes]);

  // Buscar todos os dados necessários
  useEffect(() => {
    if (!isOpen || !paciente) return;

    let unsubscribes = [];
    let ativo = true;

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
          (async () => {
            const pacientesData = await Promise.all(
              snapshot.docs.map((docSnapshot) =>
                processarPaciente(
                  {
                    id: docSnapshot.id,
                    ...docSnapshot.data()
                  },
                  infeccoesCacheRef.current
                )
              )
            );

            if (!ativo) return;

            setDados(prev => ({ ...prev, pacientes: pacientesData.filter(Boolean), loading: false }));
          })();
        });

        unsubscribes = [unsubLeitos, unsubQuartos, unsubSetores, unsubPacientes];
      } catch (error) {
        console.error('Erro ao buscar dados:', error);
        if (ativo) {
          setDados(prev => ({ ...prev, loading: false }));
        }
      }
    };

    buscarDados();

    return () => {
      ativo = false;
      unsubscribes.forEach(unsub => unsub && unsub());
    };
  }, [isOpen, paciente]);

  useEffect(() => {
    if (!isOpen) {
      setModalStep('selecao');
      setLeitoSelecionado(null);
      setPacienteProcessado(null);
      return;
    }

    if (leitoSugerido) {
      setLeitoSelecionado(leitoSugerido);
      setModalStep('confirmacao');
    }
  }, [isOpen, leitoSugerido]);

  useEffect(() => {
    let ativo = true;

    const prepararPaciente = async () => {
      if (!paciente) {
        if (ativo) {
          setPacienteProcessado(null);
        }
        return;
      }

      const enriquecido = await processarPaciente(paciente, infeccoesCacheRef.current);
      if (ativo) {
        setPacienteProcessado(enriquecido);
      }
    };

    prepararPaciente();

    return () => {
      ativo = false;
    };
  }, [paciente]);

  const handleLeitoSelect = (leito) => {
    setLeitoSelecionado(leito);
    setModalStep('confirmacao');
  };

  const handleVoltarSelecao = () => {
    setModalStep('selecao');
    setLeitoSelecionado(null);
  };

  const getLeitoOrigem = () => {
    const pacienteAtual = pacienteProcessado || normalizarEstruturaPaciente(paciente);
    if (!pacienteAtual || !dados.leitos || !dados.setores) return null;

    // Buscar o leito atual do paciente
    const leitoAtual = dados.leitos.find(l => l.id === pacienteAtual.leitoId);
    if (!leitoAtual) return null;

    // Buscar o setor do leito atual
    const setorAtual = dados.setores.find(s => s.id === leitoAtual.setorId);

    return {
      id: leitoAtual.id,
      codigoLeito: leitoAtual.codigoLeito || pacienteAtual.codigoLeito || 'N/A',
      siglaSetor: setorAtual?.siglaSetor || pacienteAtual.siglaSetor || 'N/A',
      nomeSetor: setorAtual?.nomeSetor || 'N/A',
      setorId: setorAtual?.id || leitoAtual.setorId || pacienteAtual.setorId || null
    };
  };

  const handleRegulacaoConcluida = () => {
    onClose();
    // Reset state when closing
    setModalStep('selecao');
    setLeitoSelecionado(null);
  };

  const pacienteBasico = useMemo(() => normalizarEstruturaPaciente(paciente), [paciente]);
  const pacienteAtual = pacienteProcessado || pacienteBasico;

  if (!pacienteAtual) return null;

  return (
    <>
      {/* Modal de Seleção de Leitos */}
      <Dialog open={isOpen && modalStep === 'selecao'} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="text-lg">
              Selecionar Leito de Destino para: {pacienteAtual?.nomePaciente}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <LeitoSelectionStep
              dados={dados}
              paciente={pacienteAtual}
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
      {leitoSelecionado && pacienteAtual && modalStep === 'confirmacao' && (
        <Dialog
          open={true}
          onOpenChange={() => {}}
        >
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
              paciente={pacienteAtual}
              leitoOrigem={getLeitoOrigem()}
              leitoDestino={leitoSelecionado}
              infeccoes={infeccoes}
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