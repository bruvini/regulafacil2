import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
  getInfeccoesCollection,
  getDoc,
  doc,
  onSnapshot
} from '@/lib/firebase';
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

  const normalizarSexoPaciente = useCallback((valor) => {
    if (typeof valor === 'string' && valor.trim().toUpperCase() === 'M') {
      return 'M';
    }
    return 'F';
  }, []);

  const construirPacienteBasico = useCallback((pacienteOriginal) => {
    if (!pacienteOriginal) return null;

    const pacienteNormalizado = { ...pacienteOriginal };

    if (pacienteNormalizado.leitoId && typeof pacienteNormalizado.leitoId === 'object') {
      pacienteNormalizado.leitoId = pacienteNormalizado.leitoId.id || pacienteNormalizado.leitoId;
    }

    if (pacienteNormalizado.leitoId) {
      pacienteNormalizado.leitoId = String(pacienteNormalizado.leitoId);
    }

    pacienteNormalizado.sexo = normalizarSexoPaciente(pacienteNormalizado.sexo);

    if (Array.isArray(pacienteNormalizado.isolamentos)) {
      pacienteNormalizado.isolamentos = pacienteNormalizado.isolamentos
        .filter(Boolean)
        .map((isolamentoOriginal) => {
          if (!isolamentoOriginal || typeof isolamentoOriginal !== 'object') {
            return isolamentoOriginal;
          }

          const isolamento = { ...isolamentoOriginal };
          const infeccaoRef = isolamento.infeccaoId || isolamento.infecaoId;

          let infeccaoId = null;
          if (typeof infeccaoRef === 'string') {
            infeccaoId = infeccaoRef;
          } else if (typeof infeccaoRef === 'object' && infeccaoRef) {
            infeccaoId = infeccaoRef.id || null;
          }

          const siglaBase =
            isolamento.sigla ||
            isolamento.siglaInfeccao ||
            (infeccaoId ? String(infeccaoId) : '');

          const nomeBase = isolamento.nome || isolamento.nomeInfeccao || siglaBase || '';

          return {
            ...isolamento,
            infeccaoId: infeccaoId || isolamento.infeccaoId || isolamento.infecaoId || null,
            sigla: siglaBase || '',
            nome: nomeBase || '',
          };
        });
    } else {
      pacienteNormalizado.isolamentos = [];
    }

    return pacienteNormalizado;
  }, [normalizarSexoPaciente]);

  const enriquecerIsolamentos = useCallback(async (isolamentos = []) => {
    if (!Array.isArray(isolamentos)) return [];

    const itens = await Promise.all(
      isolamentos.map(async (isolamentoOriginal) => {
        if (!isolamentoOriginal) return isolamentoOriginal;

        const isolamento = { ...isolamentoOriginal };
        const infeccaoRef = isolamento.infeccaoId || isolamento.infecaoId;

        let infeccaoId = null;
        if (typeof infeccaoRef === 'string') {
          infeccaoId = infeccaoRef;
        } else if (typeof infeccaoRef === 'object' && infeccaoRef) {
          infeccaoId = infeccaoRef.id || null;
        }

        let sigla =
          isolamento.sigla ||
          isolamento.siglaInfeccao ||
          (typeof infeccaoId === 'string' ? infeccaoId : '');
        let nome = isolamento.nome || isolamento.nomeInfeccao || sigla || '';

        if (infeccaoId) {
          let dadosInfeccao = infeccoesCacheRef.current.get(infeccaoId);

          if (!dadosInfeccao) {
            try {
              if (typeof infeccaoRef === 'object' && infeccaoRef) {
                const snapshot = await getDoc(infeccaoRef);
                if (snapshot.exists()) {
                  dadosInfeccao = { id: snapshot.id, ...snapshot.data() };
                  infeccoesCacheRef.current.set(snapshot.id, dadosInfeccao);
                }
              } else {
                const docRef = doc(getInfeccoesCollection(), infeccaoId);
                const snapshot = await getDoc(docRef);
                if (snapshot.exists()) {
                  dadosInfeccao = { id: snapshot.id, ...snapshot.data() };
                  infeccoesCacheRef.current.set(snapshot.id, dadosInfeccao);
                }
              }
            } catch (error) {
              console.error('Erro ao buscar infecção do isolamento:', error);
            }
          }

          if (dadosInfeccao) {
            sigla = sigla || dadosInfeccao.siglaInfeccao || dadosInfeccao.sigla || infeccaoId || '';
            nome = nome || dadosInfeccao.nomeInfeccao || dadosInfeccao.nome || sigla;
          }
        }

        return {
          ...isolamento,
          infeccaoId: infeccaoId || isolamento.infeccaoId || isolamento.infecaoId || null,
          sigla: sigla || '',
          nome: nome || '',
        };
      })
    );

    return itens.filter(Boolean);
  }, []);

  const enriquecerPaciente = useCallback(
    async (pacienteOriginal) => {
      const pacienteBasico = construirPacienteBasico(pacienteOriginal);
      if (!pacienteBasico) return null;

      const isolamentosDetalhados = await enriquecerIsolamentos(pacienteBasico.isolamentos);
      return { ...pacienteBasico, isolamentos: isolamentosDetalhados };
    },
    [construirPacienteBasico, enriquecerIsolamentos]
  );

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
                enriquecerPaciente({
                  id: docSnapshot.id,
                  ...docSnapshot.data()
                })
              )
            );

            if (!ativo) return;

            setDados(prev => ({ ...prev, pacientes: pacientesData, loading: false }));
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
  }, [isOpen, paciente, enriquecerPaciente]);

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

      const enriquecido = await enriquecerPaciente(paciente);
      if (ativo) {
        setPacienteProcessado(enriquecido);
      }
    };

    prepararPaciente();

    return () => {
      ativo = false;
    };
  }, [paciente, enriquecerPaciente]);

  const handleLeitoSelect = (leito) => {
    setLeitoSelecionado(leito);
    setModalStep('confirmacao');
  };

  const handleVoltarSelecao = () => {
    setModalStep('selecao');
    setLeitoSelecionado(null);
  };

  const getLeitoOrigem = () => {
    const pacienteAtual = pacienteProcessado || construirPacienteBasico(paciente);
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

  const pacienteBasico = useMemo(() => construirPacienteBasico(paciente), [paciente, construirPacienteBasico]);
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