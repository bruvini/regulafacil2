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
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  const [searchTerm, setSearchTerm] = useState('');

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

  const setoresMap = useMemo(() => new Map(setores.map(setor => [setor.id, setor])), [setores]);

  const leitoOrigem = useMemo(() => {
    if (!pacienteEnriquecido?.leitoId || !leitos.length) return null;

    const leito = leitos.find(leitoAtual => leitoAtual.id === pacienteEnriquecido.leitoId);
    if (!leito) return null;

    const setor = setoresMap.get(leito.setorId);

    return {
      ...leito,
      siglaSetor: leito.siglaSetor || setor?.siglaSetor,
      nomeSetor: leito.nomeSetor || setor?.nomeSetor,
    };
  }, [pacienteEnriquecido, leitos, setoresMap]);

  const gruposLeitosCompativeis = useMemo(() => {
    if (!pacienteEnriquecido) return [];

    const termoBusca = searchTerm.trim().toLowerCase();
    const nomeCompletoPaciente = (pacienteEnriquecido.nomePaciente || '').trim();
    const primeiroNomePaciente = nomeCompletoPaciente.split(' ')[0] || '';
    const primeiroNomePacienteNormalizado = primeiroNomePaciente.toLowerCase();
    const nomeCompletoPacienteNormalizado = nomeCompletoPaciente.toLowerCase();

    const pacientesPorLeito = new Map(
      pacientesEnriquecidos
        .filter(paciente => paciente?.leitoId)
        .map(paciente => [paciente.leitoId, paciente])
    );

    const pacientesPorQuarto = new Map();
    leitos.forEach(leitoAtual => {
      if (!leitoAtual?.quartoId) return;
      if (!pacientesPorQuarto.has(leitoAtual.quartoId)) {
        pacientesPorQuarto.set(leitoAtual.quartoId, []);
      }
      const pacienteNoLeito = pacientesPorLeito.get(leitoAtual.id);
      if (pacienteNoLeito) {
        pacientesPorQuarto.get(leitoAtual.quartoId).push(pacienteNoLeito);
      }
    });

    const gruposMap = new Map();

    const formatarStatus = (status) => {
      if (!status) return 'Sem status';
      return String(status)
        .toLowerCase()
        .split(' ')
        .map(parte => parte.charAt(0).toUpperCase() + parte.slice(1))
        .join(' ');
    };

    leitosCompativeis.forEach(leito => {
      const codigoLeito = String(leito.codigoLeito || '');
      if (termoBusca && !codigoLeito.toLowerCase().includes(termoBusca)) {
        return;
      }

      let possuiHomonimo = false;
      if (leito.quartoId && primeiroNomePacienteNormalizado) {
        const pacientesNoQuarto = pacientesPorQuarto.get(leito.quartoId) || [];
        possuiHomonimo = pacientesNoQuarto.some(pacienteVizinho => {
          if (!pacienteVizinho?.nomePaciente) return false;
          if (pacienteVizinho.id === pacienteEnriquecido.id) return false;

          const nomeVizinho = pacienteVizinho.nomePaciente.trim();
          const primeiroNomeVizinho = (nomeVizinho.split(' ')[0] || '').toLowerCase();

          if (!primeiroNomeVizinho) return false;
          if (primeiroNomeVizinho !== primeiroNomePacienteNormalizado) return false;

          return nomeVizinho.toLowerCase() !== nomeCompletoPacienteNormalizado;
        });
      }

      const setor = setoresMap.get(leito.setorId);
      const nomeSetor = setor?.nomeSetor || leito.nomeSetor || 'Setor não informado';
      const siglaSetor = setor?.siglaSetor || leito.siglaSetor || '';
      const chaveGrupo = `${nomeSetor}-${siglaSetor || 'sem-sigla'}`;

      if (!gruposMap.has(chaveGrupo)) {
        gruposMap.set(chaveGrupo, {
          nomeSetor,
          siglaSetor,
          leitos: [],
        });
      }

      gruposMap.get(chaveGrupo).leitos.push({
        ...leito,
        siglaSetor: leito.siglaSetor || siglaSetor,
        nomeSetor: leito.nomeSetor || nomeSetor,
        statusFormatado: formatarStatus(leito.status),
        possuiHomonimo,
      });
    });

    return Array.from(gruposMap.values())
      .map(grupo => ({
        ...grupo,
        leitos: grupo.leitos.sort((a, b) =>
          String(a.codigoLeito || '').localeCompare(String(b.codigoLeito || ''))
        ),
      }))
      .sort((a, b) => (a.nomeSetor || '').localeCompare(b.nomeSetor || ''));
  }, [
    leitosCompativeis,
    searchTerm,
    pacientesEnriquecidos,
    leitos,
    pacienteEnriquecido,
    setoresMap,
  ]);

  useEffect(() => {
    if (!isOpen) {
      setModalStep('selecao');
      setLeitoSelecionado(null);
      setSearchTerm('');
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
        <Input
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Buscar leito pelo código"
          className="mb-4"
        />
        <ScrollArea className="h-96 border rounded-md">
          {leitosCompativeis.length > 0 ? (
            <div className="p-4 space-y-6">
              {gruposLeitosCompativeis.length > 0 ? (
                gruposLeitosCompativeis.map(grupo => {
                  const quantidadeLeitos = grupo.leitos.length;
                  const textoDisponiveis = quantidadeLeitos === 1
                    ? '1 leito disponível'
                    : `${quantidadeLeitos} leitos disponíveis`;

                  return (
                    <div key={`${grupo.nomeSetor}-${grupo.siglaSetor}`} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold">
                          {grupo.nomeSetor} ({textoDisponiveis})
                        </h4>
                        {grupo.siglaSetor && (
                          <Badge variant="outline" className="uppercase">
                            {grupo.siglaSetor}
                          </Badge>
                        )}
                      </div>
                      <div className="space-y-2">
                        {grupo.leitos.map(leito => (
                          <div
                            key={leito.id}
                            className="p-3 border rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
                            onClick={() => handleLeitoSelect(leito)}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-mono font-semibold">{leito.codigoLeito}</span>
                                <Badge variant="secondary" className="capitalize">
                                  {leito.statusFormatado}
                                </Badge>
                                {leito.possuiHomonimo && (
                                  <Badge variant="destructive">Homônimo no quarto</Badge>
                                )}
                              </div>
                              {leito.tipoLeito && (
                                <span className="text-xs text-muted-foreground uppercase tracking-wide">
                                  {leito.tipoLeito}
                                </span>
                              )}
                            </div>
                            {leito.quartoNome && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {leito.quartoNome}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="flex items-center justify-center h-full p-4">
                  <p className="text-muted-foreground">Nenhum leito compatível com a busca.</p>
                </div>
              )}
            </div>
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
