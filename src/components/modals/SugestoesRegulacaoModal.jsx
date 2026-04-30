import React, { useMemo } from 'react';
import { ErrorBoundary } from '../ErrorBoundary';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Sparkles, CalendarClock } from "lucide-react";
import { useDadosHospitalares } from "@/hooks/useDadosHospitalares";
import { useQuartos } from "@/hooks/useCollections";
import { getLeitosVagosPorSetor } from "@/lib/leitosDisponiveisUtils";
import { RegulacaoService } from "../../domain/regulacao/RegulacaoService";
import { SugestoesRegulacaoFormatters as Formatters } from "../../domain/regulacao/SugestoesRegulacaoFormatters";
import { RegulacaoAuditService } from "../../domain/regulacao/RegulacaoAuditService";

const SugestoesRegulacaoModal = ({ isOpen, onClose }) => {
  const {
    setores = [],
    leitos = [],
    pacientes = [],
    infeccoes = [],
    estrutura = {},
    pacientesEnriquecidos = [],
    loading: loadingDados,
  } = useDadosHospitalares();
  const { data: quartos = [], loading: loadingQuartos } = useQuartos();
  const carregando = loadingDados || loadingQuartos;

  const infeccoesMap = useMemo(
    () => new Map((infeccoes || []).map((item) => [item.id, item])),
    [infeccoes],
  );

  const setoresEnfermariaDisponiveis = useMemo(() => {
    if (carregando) return [];

    const setoresComLeitos = getLeitosVagosPorSetor({
      setores, leitos, quartos, pacientes, infeccoes,
    });

    if (!setoresComLeitos.length) return [];

    const sugestoesBrutas = RegulacaoService.processarSugestoes(
      setoresComLeitos,
      pacientesEnriquecidos,
      infeccoesMap,
      { estrutura }
    );

    const setoresPorId = new Map((setores || []).map((setor) => [setor.id, setor]));
    const leitosPorId = new Map((leitos || []).map((leito) => [leito.id, leito]));
    const leitosPorCodigo = new Map(
      (leitos || [])
        .map((leito) => [Formatters.normalizarCodigoLeito(leito?.codigoLeito || leito?.codigo), leito])
        .filter(([codigo]) => Boolean(codigo)),
    );

    return sugestoesBrutas.map(setor => ({
      ...setor,
      leitos: setor.leitos.map((leito) => ({
        ...leito,
        sugestoes: leito.sugestoes.map((sugestao) => {
          const infoTempo = Formatters.obterInfoTempoInternacao(sugestao.dataInternacao);
          const localizacao = Formatters.obterLocalizacaoPaciente(sugestao, setoresPorId, leitosPorId, leitosPorCodigo);
          
          return {
            id: sugestao.id,
            nome: sugestao.nome,
            especialidade: sugestao.especialidade,
            sexo: Formatters.formatarSexo(sugestao.sexo),
            idade: sugestao.idade,
            tempoInternacaoTexto: infoTempo.texto,
            tempoInternacaoTimestamp: infoTempo.timestamp,
            isolamentos: sugestao.isolamentos,
            temIsolamento: sugestao.temIsolamento,
            setorOrigem: localizacao.setorTexto,
            leitoOrigem: localizacao.leitoTexto,
            localizacao: localizacao.localizacaoTexto,
            scoreTotal: sugestao.scoreTotal,
            scoreMotivos: sugestao.scoreMotivos,
            dataPrevistaAlta: Formatters.formatarDataPrevistaAlta(sugestao.dataPrevistaAlta),
          };
        })
      }))
    }));

  }, [carregando, setores, leitos, quartos, pacientes, infeccoes, estrutura, pacientesEnriquecidos, infeccoesMap]);

  const registrarAuditoria = (sugestao, leito) => {
    RegulacaoAuditService.logSugestao({
      pacienteId: sugestao.id,
      pacienteNome: sugestao.nome,
      leitoId: leito.id,
      leitoCodigo: leito.codigo,
      score: sugestao.scoreTotal,
      motivos: sugestao.scoreMotivos,
      usuarioId: 'regulacao-user'
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Sugestões Inteligentes de Regulação
          </DialogTitle>
          <DialogDescription>
            Pacientes priorizados por Score Clínico (0–100) para cada leito vago compatível.
          </DialogDescription>
        </DialogHeader>
        <TooltipProvider delayDuration={150}>
          <div className="space-y-6">
            <Alert className="border-primary/30 bg-primary/5">
              <Sparkles className="h-4 w-4 text-primary" />
              <AlertTitle className="text-primary">Como o Score Clínico funciona</AlertTitle>
              <AlertDescription>
                <div className="space-y-3 text-sm">
                  <p>
                    Cada paciente sugerido recebe um <strong>Score de 0 a 100</strong> calculado automaticamente
                    a partir de critérios clínicos e operacionais. A lista é ordenada do maior para o menor score,
                    ajudando a priorizar quem mais precisa do leito agora.
                  </p>
                  <ul className="grid gap-1.5 sm:grid-cols-2">
                    <li className="flex items-start gap-2">
                      <span className="mt-0.5 inline-block h-2 w-2 rounded-full bg-red-500" />
                      <span><strong>Isolamento ativo</strong> compatível com o leito (+30)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-0.5 inline-block h-2 w-2 rounded-full bg-amber-500" />
                      <span><strong>Idade / vulnerabilidade</strong> — &gt;80a (+20) ou &gt;60a (+10)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-0.5 inline-block h-2 w-2 rounded-full bg-blue-500" />
                      <span><strong>Gargalo de origem</strong> — RPA (+30) ou PS Decisão (+20)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-0.5 inline-block h-2 w-2 rounded-full bg-emerald-500" />
                      <span><strong>Tempo de espera</strong> — +2 pts/dia internado (máx. +20)</span>
                    </li>
                  </ul>
                  <p className="text-xs text-muted-foreground">
                    Passe o mouse sobre o badge de Score em cada paciente para ver exatamente quais critérios
                    contribuíram. Restrições clínicas (especialidade, sexo, isolamento, PCP) são aplicadas como
                    regras rígidas — pacientes incompatíveis nunca aparecem na lista. O Score é uma orientação;
                    a decisão final é sempre do enfermeiro regulador.
                  </p>
                </div>
              </AlertDescription>
            </Alert>
            {carregando ? (
              <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
                Carregando leitos disponíveis...
              </div>
            ) : setoresEnfermariaDisponiveis.length ? (
              <div className="flex-1 overflow-y-auto pr-4 min-h-0">
                <Accordion type="single" collapsible className="space-y-4">
                  {setoresEnfermariaDisponiveis.map((setor) => (
                    <AccordionItem key={setor.id} value={String(setor.id)}>
                      <AccordionTrigger>{setor.nome}</AccordionTrigger>
                      <AccordionContent>
                        <Accordion type="single" collapsible className="space-y-2">
                          {setor.leitos.map((leito) => (
                            <AccordionItem
                              key={leito.id}
                              value={`${setor.id}-${leito.id}`}
                            >
                              <AccordionTrigger onClick={() => {
                                // Auditoria do leito apenas para debug no clique do trigger se precisar
                              }}>
                                <div className="flex w-full items-center justify-between text-left" title={leito.compatibilidade}>
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">{leito.codigo}</span>
                                    {(leito.compatibilidadeBadges || []).length ? (
                                      <div className="flex flex-wrap gap-1">
                                        {(leito.compatibilidadeBadges || []).map((badge, index) => (
                                          <Badge
                                            key={`${leito.id}-${badge.text}-${index}`}
                                            variant={badge.variant}
                                            className="text-xs capitalize"
                                          >
                                            {badge.text}
                                          </Badge>
                                        ))}
                                      </div>
                                    ) : (
                                      <Badge variant="outline" className="text-xs text-muted-foreground">
                                        Livre
                                      </Badge>
                                    )}
                                  </div>
                                  <span className="text-xs font-medium text-muted-foreground">
                                    {leito.status}
                                  </span>
                                </div>
                              </AccordionTrigger>
                                <AccordionContent>
                                  {leito.sugestoes.length ? (
                                    <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                                    {leito.sugestoes.map((sugestao) => {
                                      const idadeTexto = Number.isFinite(sugestao.idade)
                                        ? `${sugestao.idade} ${sugestao.idade === 1 ? 'ano' : 'anos'}`
                                        : 'Idade não informada';

                                      const score = sugestao.scoreTotal ?? 0;
                                      let scoreClasses = 'bg-slate-500 text-white hover:bg-slate-500 border-transparent';
                                      if (score === 100) {
                                        scoreClasses = 'bg-emerald-600 text-white hover:bg-emerald-600 border-transparent';
                                      } else if (score >= 50) {
                                        scoreClasses = 'bg-amber-500 text-white hover:bg-amber-500 border-transparent';
                                      } else {
                                        scoreClasses = 'bg-red-600 text-white hover:bg-red-600 border-transparent';
                                      }

                                      let badgeAltaPrevistaClasses = "border-transparent bg-yellow-400 text-yellow-950 hover:bg-yellow-400 text-xs";
                                      if (sugestao.dataPrevistaAlta) {
                                        const altaParts = sugestao.dataPrevistaAlta.split('/');
                                        if (altaParts.length >= 2) {
                                          const dia = parseInt(altaParts[0], 10);
                                          const mes = parseInt(altaParts[1], 10) - 1;
                                          const ano = altaParts.length === 3 ? parseInt(altaParts[2].split(' ')[0], 10) : new Date().getFullYear();

                                          const altaDate = new Date(ano, mes, dia);
                                          altaDate.setHours(0, 0, 0, 0);
                                          const hoje = new Date();
                                          hoje.setHours(0, 0, 0, 0);

                                          if (altaDate <= hoje) {
                                            badgeAltaPrevistaClasses = "border-transparent bg-red-500 text-white hover:bg-red-500 text-xs";
                                          } else {
                                            badgeAltaPrevistaClasses = "border-transparent bg-amber-400 text-amber-950 hover:bg-amber-400 text-xs";
                                          }
                                        }
                                      }

                                      return (
                                        <div
                                          key={`${leito.id}-paciente-${sugestao.id}`}
                                          className="rounded-md border bg-muted/30 p-3 flex justify-between items-start"
                                          onClick={() => registrarAuditoria(sugestao, leito)}
                                        >
                                          {/* Coluna Esquerda: Dados Descritivos */}
                                          <div className="space-y-2 flex-1 pr-4">
                                            <p className="font-semibold text-sm text-foreground">
                                              {sugestao.nome || 'Nome não informado'} <span className="font-normal text-muted-foreground">({idadeTexto} - {sugestao.sexo})</span>
                                            </p>

                                            <div className="text-xs text-muted-foreground">
                                              <span className="font-medium text-foreground">Especialidade:</span>{' '}
                                              {sugestao.especialidade}
                                            </div>

                                            <div className="text-xs text-muted-foreground">
                                              <span className="font-medium text-foreground">Localização:</span>{' '}
                                              {sugestao.localizacao}
                                            </div>

                                            {sugestao.tempoInternacaoTexto && (
                                              <div className="text-xs text-muted-foreground">
                                                <span className="font-medium text-foreground">Tempo de Internação:</span>{' '}
                                                {sugestao.tempoInternacaoTexto}
                                              </div>
                                            )}

                                            <div className="mt-1 flex flex-wrap gap-1">
                                              {sugestao.isolamentos.map((rotulo) => (
                                                <Badge
                                                  key={`${sugestao.id}-isolamento-${rotulo}`}
                                                  variant="destructive"
                                                  className="text-xs uppercase"
                                                >
                                                  {rotulo}
                                                </Badge>
                                              ))}
                                              {sugestao.dataPrevistaAlta && (
                                                <Badge
                                                  className={badgeAltaPrevistaClasses}
                                                >
                                                  <CalendarClock className="mr-1 h-3 w-3" />
                                                  ⚠️ Alta Prevista: {sugestao.dataPrevistaAlta}
                                                </Badge>
                                              )}
                                            </div>
                                          </div>

                                          {/* Coluna Direita: Score e Tooltip */}
                                          <div className="flex-shrink-0">
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <span tabIndex={0} className="cursor-help inline-block">
                                                  <Badge className={`text-lg px-3 py-1 font-bold ${scoreClasses}`}>
                                                    <Sparkles className="mr-1 h-4 w-4" />
                                                    Score {score}
                                                  </Badge>
                                                </span>
                                              </TooltipTrigger>
                                              <TooltipContent side="left" className="max-w-xs z-50">
                                                <p className="mb-1 font-semibold">Composição do Score</p>
                                                {sugestao.scoreMotivos?.length ? (
                                                  <ul className="space-y-0.5 text-xs">
                                                    {sugestao.scoreMotivos.map((m, i) => (
                                                      <li key={i}>• {m}</li>
                                                    ))}
                                                  </ul>
                                                ) : (
                                                  <p className="text-xs">Nenhum critério de prioridade aplicado.</p>
                                                )}
                                              </TooltipContent>
                                            </Tooltip>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                                    Nenhum paciente compatível encontrado.
                                  </div>
                                )}
                              </AccordionContent>
                            </AccordionItem>
                          ))}
                        </Accordion>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            ) : (
              <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
                Nenhum leito de enfermaria disponível no momento.
              </div>
            )}
          </div>
        </TooltipProvider>
      </DialogContent>
    </Dialog>
  );
};

export default function SugestoesRegulacaoModalWrapped(props) {
  return (
    <ErrorBoundary>
      <SugestoesRegulacaoModal {...props} />
    </ErrorBoundary>
  );
}
