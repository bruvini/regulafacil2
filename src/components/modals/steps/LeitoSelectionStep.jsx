import React, { useMemo, useState } from 'react';
import { Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  encontrarLeitosCompativeis,
  SETORES_CRITICOS_CONTRA_FLUXO,
} from '@/lib/compatibilidadeUtils';

const formatarStatus = (status) => {
  if (!status) return 'Sem status';
  return String(status)
    .toLowerCase()
    .split(' ')
    .map((parte) => parte.charAt(0).toUpperCase() + parte.slice(1))
    .join(' ');
};

const LeitoSelectionStep = ({
  paciente,
  pacienteEnriquecido,
  hospitalData = {},
  modo = 'enfermaria',
  excludedLeitoIds = [],
  loading = false,
  onLeitoSelect,
  modoRemanejamento = null,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const dadosPaciente = pacienteEnriquecido || paciente;
  const setores = hospitalData?.setores || [];
  const leitos = hospitalData?.leitos || [];
  const pacientesHospital = hospitalData?.pacientesEnriquecidos || [];

  const setoresMap = useMemo(
    () => new Map(setores.map((setor) => [setor.id, setor])),
    [setores]
  );

  const pacientesPorLeito = useMemo(
    () =>
      new Map(
        pacientesHospital
          .filter((p) => p.leitoId)
          .map((p) => [p.leitoId, p])
      ),
    [pacientesHospital]
  );

  const pacientesPorQuarto = useMemo(() => {
    const mapa = new Map();

    leitos.forEach((leitoAtual) => {
      if (!leitoAtual?.quartoId) return;
      if (!mapa.has(leitoAtual.quartoId)) {
        mapa.set(leitoAtual.quartoId, []);
      }
      const pacienteNoLeito = pacientesPorLeito.get(leitoAtual.id);
      if (pacienteNoLeito) {
        mapa.get(leitoAtual.quartoId).push(pacienteNoLeito);
      }
    });

    return mapa;
  }, [leitos, pacientesPorLeito]);

  const leitosCompativeis = useMemo(() => {
    if (loading || !dadosPaciente) return [];

    const opcoesCompatibilidade =
      modoRemanejamento === 'contraFluxo'
        ? { filtroSetoresEspecial: SETORES_CRITICOS_CONTRA_FLUXO }
        : undefined;

    const base = encontrarLeitosCompativeis(
      dadosPaciente,
      { estrutura: hospitalData?.estrutura || {} },
      modo,
      opcoesCompatibilidade,
    );

    return base
      .filter((leito) => leito && !excludedLeitoIds.includes(leito.id))
      .map((leito) => {
        const setor = setoresMap.get(leito.setorId);
        return {
          ...leito,
          siglaSetor: leito.siglaSetor || setor?.siglaSetor || '',
          nomeSetor: leito.nomeSetor || setor?.nomeSetor || setor?.nome || 'Setor não informado',
        };
      });
  }, [
    loading,
    dadosPaciente,
    hospitalData?.estrutura,
    modo,
    excludedLeitoIds,
    setoresMap,
    modoRemanejamento,
  ]);

  const gruposLeitos = useMemo(() => {
    if (!dadosPaciente) return [];

    const termoBusca = searchTerm.trim().toLowerCase();
    const nomeCompletoPaciente = (dadosPaciente.nomePaciente || '').trim();
    const primeiroNomePaciente = nomeCompletoPaciente.split(' ')[0] || '';
    const primeiroNomePacienteNormalizado = primeiroNomePaciente.toLowerCase();
    const nomeCompletoPacienteNormalizado = nomeCompletoPaciente.toLowerCase();

    const gruposMap = new Map();

    leitosCompativeis.forEach((leito) => {
      const codigoLeito = String(leito.codigoLeito || leito.codigo || '');
      if (termoBusca && !codigoLeito.toLowerCase().includes(termoBusca)) {
        return;
      }

      let possuiHomonimo = false;
      if (leito.quartoId && primeiroNomePacienteNormalizado) {
        const pacientesNoQuarto = pacientesPorQuarto.get(leito.quartoId) || [];
        possuiHomonimo = pacientesNoQuarto.some((pacienteVizinho) => {
          if (!pacienteVizinho?.nomePaciente) return false;
          if (pacienteVizinho.id === dadosPaciente.id) return false;

          const nomeVizinho = pacienteVizinho.nomePaciente.trim();
          const primeiroNomeVizinho = (nomeVizinho.split(' ')[0] || '').toLowerCase();

          if (!primeiroNomeVizinho) return false;
          if (primeiroNomeVizinho !== primeiroNomePacienteNormalizado) return false;

          return nomeVizinho.toLowerCase() !== nomeCompletoPacienteNormalizado;
        });
      }

      const nomeSetor = leito.nomeSetor || 'Setor não informado';
      const siglaSetor = leito.siglaSetor || '';
      const chaveGrupo = `${leito.setorId || 'sem-setor'}-${siglaSetor || 'sem-sigla'}`;

      if (!gruposMap.has(chaveGrupo)) {
        gruposMap.set(chaveGrupo, {
          nomeSetor,
          siglaSetor,
          leitos: [],
        });
      }

      gruposMap.get(chaveGrupo).leitos.push({
        ...leito,
        codigoLeito: codigoLeito || 'N/A',
        statusFormatado: formatarStatus(leito.status),
        possuiHomonimo,
      });
    });

    return Array.from(gruposMap.values())
      .map((grupo) => ({
        ...grupo,
        leitos: grupo.leitos.sort((a, b) =>
          String(a.codigoLeito || '').localeCompare(String(b.codigoLeito || ''))
        ),
      }))
      .sort((a, b) => (a.nomeSetor || '').localeCompare(b.nomeSetor || ''));
  }, [leitosCompativeis, searchTerm, dadosPaciente, pacientesPorQuarto]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-10">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!dadosPaciente) {
    return (
      <div className="flex items-center justify-center p-8 text-sm text-muted-foreground">
        Não foi possível carregar os dados do paciente.
      </div>
    );
  }

  const totalDisponiveis = leitosCompativeis.length;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">{totalDisponiveis} leito(s) compatível(is) disponível(is)</h3>
        <p className="text-xs text-muted-foreground">
          Escolha um novo leito para reservar ao paciente. Apenas leitos compatíveis e vagos são exibidos.
        </p>
      </div>
      <Input
        value={searchTerm}
        onChange={(event) => setSearchTerm(event.target.value)}
        placeholder="Buscar leito pelo código"
      />
      <ScrollArea className="h-96 rounded-md border">
        {totalDisponiveis > 0 ? (
          <div className="p-4 space-y-6">
            {gruposLeitos.length > 0 ? (
              gruposLeitos.map((grupo) => {
                const quantidadeLeitos = grupo.leitos.length;
                const textoDisponiveis =
                  quantidadeLeitos === 1 ? '1 leito disponível' : `${quantidadeLeitos} leitos disponíveis`;

                return (
                  <div key={`${grupo.nomeSetor}-${grupo.siglaSetor}`} className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h4 className="font-semibold">{grupo.nomeSetor}</h4>
                        <p className="text-xs text-muted-foreground">{textoDisponiveis}</p>
                      </div>
                      {grupo.siglaSetor && (
                        <Badge variant="outline" className="uppercase">
                          {grupo.siglaSetor}
                        </Badge>
                      )}
                    </div>
                    <div className="space-y-2">
                      {grupo.leitos.map((leito) => (
                        <button
                          key={leito.id}
                          type="button"
                          className="w-full rounded-md border p-3 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          onClick={() => onLeitoSelect?.(leito)}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-sm font-semibold">{leito.codigoLeito}</span>
                              <Badge variant="secondary" className="capitalize">
                                {leito.statusFormatado}
                              </Badge>
                              {leito.possuiHomonimo && (
                                <Badge variant="destructive">Homônimo no quarto</Badge>
                              )}
                            </div>
                            {leito.tipoLeito && (
                              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                                {leito.tipoLeito}
                              </span>
                            )}
                          </div>
                          {leito.restricaoCoorte && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              Coorte: {leito.restricaoCoorte.sexo ? `Sexo ${leito.restricaoCoorte.sexo}` : 'Restrição ativa'}
                              {Array.isArray(leito.restricaoCoorte.isolamentos) &&
                                leito.restricaoCoorte.isolamentos.length > 0 &&
                                ` · ${leito.restricaoCoorte.isolamentos.join(', ')}`}
                            </p>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="flex items-center justify-center p-6 text-sm text-muted-foreground">
                Nenhum leito corresponde ao filtro aplicado.
              </div>
            )}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center p-8 text-sm text-muted-foreground">
            Nenhum leito compatível está disponível neste momento.
          </div>
        )}
      </ScrollArea>
    </div>
  );
};

export default LeitoSelectionStep;
