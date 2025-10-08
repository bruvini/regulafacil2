import React, { useMemo } from 'react';
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
import { useDadosHospitalares } from "@/hooks/useDadosHospitalares";
import { useQuartos } from "@/hooks/useCollections";
import { getLeitosVagosPorSetor } from "@/lib/leitosDisponiveisUtils";
import { encontrarLeitosCompativeis, calcularIdade } from "@/lib/compatibilidadeUtils";

const PERFIS_DE_SETOR_POR_ESPECIALIDADE = {
  "UNID. JS ORTOPEDIA": [
    "NEUROCIRURGIA",
    "ODONTOLOGIA C.TRAUM.B.M.F.",
    "ORTOPEDIA/TRAUMATOLOGIA",
    "BUCOMAXILO",
  ],
  "UNID. INT. GERAL - UIG": [
    "CLINICA GERAL",
    "INTENSIVISTA",
    "NEUROLOGIA",
    "PROCTOLOGIA",
    "UROLOGIA",
    "MASTOLOGIA",
  ],
  "UNID. CLINICA MEDICA": [
    "CLINICA GERAL",
    "INTENSIVISTA",
    "NEUROLOGIA",
    "PROCTOLOGIA",
    "UROLOGIA",
    "MASTOLOGIA",
  ],
  "UNID. ONCOLOGIA": [
    "HEMATOLOGIA",
    "ONCOLOGIA CIRURGICA",
    "ONCOLOGIA CLINICA/CANCEROLOGIA",
  ],
  "UNID. CIRURGICA": [
    "CIRURGIA CABECA E PESCOCO",
    "CIRURGIA GERAL",
    "CIRURGIA TORACICA",
    "CIRURGIA VASCULAR",
    "NEUROCIRURGIA",
    "PROCTOLOGIA",
    "UROLOGIA",
    "ONCOLOGIA CIRURGICA",
    "MASTOLOGIA",
  ],
  "UNID. NEFROLOGIA TRANSPLANTE": ["NEFROLOGIA", "HEPATOLOGISTA"],
};

const SETORES_POOL_REGULACAO = [
  "PS DECISÃO CLINICA",
  "PS DECISÃO CIRURGICA",
  "CC - RECUPERAÇÃO",
];

const SETOR_EXCLUIDO = "UNID. DE AVC - INTEGRAL";

const normalizarTexto = (valor) =>
  String(valor || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .trim();

const PERFIS_NORMALIZADOS = new Map(
  Object.entries(PERFIS_DE_SETOR_POR_ESPECIALIDADE).map(([setor, especialidades]) => [
    normalizarTexto(setor),
    new Set(especialidades.map((item) => normalizarTexto(item))),
  ]),
);

const parseDataFlexivel = (valor) => {
  if (!valor) return null;

  if (valor instanceof Date) {
    return valor;
  }

  if (typeof valor === "string") {
    const texto = valor.trim();
    if (!texto) return null;

    if (/^\d{2}\/\d{2}\/\d{4}/.test(texto)) {
      const [dataParte, horaParte] = texto.split(" ");
      const [dia, mes, ano] = dataParte.split("/").map((parte) => parseInt(parte, 10));
      if (Number.isNaN(dia) || Number.isNaN(mes) || Number.isNaN(ano)) return null;

      if (horaParte && /^\d{2}:\d{2}/.test(horaParte)) {
        const [hora, minuto] = horaParte
          .split(":")
          .map((parte) => parseInt(parte, 10));
        return new Date(ano, mes - 1, dia, hora || 0, minuto || 0);
      }

      return new Date(ano, mes - 1, dia);
    }

    const data = new Date(texto);
    return Number.isNaN(data.getTime()) ? null : data;
  }

  if (typeof valor === "object") {
    if (typeof valor.toDate === "function") {
      const data = valor.toDate();
      return Number.isNaN(data?.getTime?.()) ? null : data;
    }

    if (typeof valor.seconds === "number") {
      return new Date(valor.seconds * 1000);
    }
  }

  return null;
};

const obterInfoTempoInternacao = (dataInternacao) => {
  const data = parseDataFlexivel(dataInternacao);
  if (!data) {
    return {
      timestamp: Number.POSITIVE_INFINITY,
      texto: "Tempo de internação não informado",
    };
  }

  const agora = new Date();
  const diffMs = Math.max(0, agora.getTime() - data.getTime());
  const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDias >= 1) {
    return {
      timestamp: data.getTime(),
      texto: `Internado há ${diffDias} ${diffDias === 1 ? "dia" : "dias"}`,
    };
  }

  const diffHoras = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHoras >= 1) {
    return {
      timestamp: data.getTime(),
      texto: `Internado há ${diffHoras} ${diffHoras === 1 ? "hora" : "horas"}`,
    };
  }

  const diffMinutos = Math.floor(diffMs / (1000 * 60));
  if (diffMinutos >= 1) {
    return {
      timestamp: data.getTime(),
      texto: `Internado há ${diffMinutos} ${diffMinutos === 1 ? "minuto" : "minutos"}`,
    };
  }

  return {
    timestamp: data.getTime(),
    texto: "Internado há menos de um minuto",
  };
};

const obterIsolamentosAtivos = (paciente, infeccoesMap) => {
  if (!paciente || !Array.isArray(paciente.isolamentos)) return [];

  const rotulos = new Set();

  paciente.isolamentos
    .filter((iso) => iso && iso.statusConsideradoAtivo)
    .forEach((iso) => {
      const infeccaoId =
        iso?.infeccaoId?.id ?? iso?.infeccaoId ?? iso?.idInfeccao ?? iso?.id ?? null;
      const dadosInfeccao = infeccaoId ? infeccoesMap.get(infeccaoId) : null;
      const rotulo =
        iso?.siglaInfeccao ||
        iso?.sigla ||
        dadosInfeccao?.siglaInfeccao ||
        dadosInfeccao?.sigla ||
        dadosInfeccao?.nome ||
        iso?.nome ||
        iso?.descricao;

      if (rotulo) {
        rotulos.add(String(rotulo).toUpperCase());
      }
    });

  return Array.from(rotulos);
};

const possuiIsolamentoAtivo = (paciente) =>
  Array.isArray(paciente?.isolamentos) &&
  paciente.isolamentos.some((iso) => iso && iso.statusConsideradoAtivo);

const formatarSexo = (valor) => {
  const texto = String(valor || "").trim();
  if (!texto) return "Sexo não informado";

  const base = texto.toLowerCase();
  if (base.startsWith("m")) return "Masculino";
  if (base.startsWith("f")) return "Feminino";
  if (base.startsWith("i")) return "Intersexo";
  if (base.startsWith("o")) return "Outro";

  return texto;
};

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
    if (carregando) {
      return [];
    }

    const setoresComLeitos = getLeitosVagosPorSetor({
      setores,
      leitos,
      quartos,
      pacientes,
      infeccoes,
    });

    if (!setoresComLeitos.length) {
      return [];
    }

    const hospitalData = { estrutura };

    const setoresPorNome = new Map(
      (setores || []).map((setor) => [
        normalizarTexto(setor?.nomeSetor || setor?.nome || setor?.siglaSetor),
        setor,
      ]),
    );

    const setoresPoolIds = new Set(
      SETORES_POOL_REGULACAO.map((nome) => setoresPorNome.get(normalizarTexto(nome))?.id)
        .filter(Boolean),
    );

    const setoresPoolNormalizados = new Set(
      SETORES_POOL_REGULACAO.map((nome) => normalizarTexto(nome)),
    );

    const pacientesElegiveis = (pacientesEnriquecidos || [])
      .filter((paciente) => !paciente?.regulacaoAtiva)
      .filter((paciente) => {
        if (paciente?.setorId && setoresPoolIds.has(paciente.setorId)) {
          return true;
        }

        const setorPacienteNorm = normalizarTexto(
          paciente?.setorNome || paciente?.localizacaoAtual || paciente?.setorOrigem || "",
        );

        return setorPacienteNorm && setoresPoolNormalizados.has(setorPacienteNorm);
      });

    const setorExcluidoNorm = normalizarTexto(SETOR_EXCLUIDO);

    if (!pacientesElegiveis.length) {
      return setoresComLeitos
        .filter((setor) => (setor?.tipoSetor || "").toLowerCase() === "enfermaria")
        .filter((setor) => normalizarTexto(setor?.nomeSetor) !== setorExcluidoNorm)
        .map((setor) => ({
          id: setor.id,
          nome: setor.nomeSetor,
          leitos: setor.leitosVagos.map((leito) => ({
            ...leito,
            codigo: leito.codigoLeito,
            sugestoes: [],
          })),
        }));
    }

    const leitosCompativeisPorPaciente = new Map();

    pacientesElegiveis.forEach((paciente) => {
      const leitosCompat = encontrarLeitosCompativeis(paciente, hospitalData, "enfermaria");
      leitosCompativeisPorPaciente.set(
        paciente.id,
        new Set((leitosCompat || []).map((leitoCompat) => leitoCompat.id)),
      );
    });

    return setoresComLeitos
      .filter((setor) => (setor?.tipoSetor || "").toLowerCase() === "enfermaria")
      .filter((setor) => normalizarTexto(setor?.nomeSetor) !== setorExcluidoNorm)
      .map((setor) => {
        const setorNomeNorm = normalizarTexto(setor?.nomeSetor);
        const especialidadesPermitidas = PERFIS_NORMALIZADOS.get(setorNomeNorm) || new Set();

        const leitosComSugestoes = setor.leitosVagos.map((leito) => {
          const pacientesCompativeis = pacientesElegiveis
            .filter((paciente) => {
              if (!especialidadesPermitidas.size) {
                return false;
              }

              const especialidadePaciente = normalizarTexto(paciente?.especialidade);
              if (!especialidadePaciente || !especialidadesPermitidas.has(especialidadePaciente)) {
                return false;
              }

              const leitosPaciente = leitosCompativeisPorPaciente.get(paciente.id);
              return leitosPaciente ? leitosPaciente.has(leito.id) : false;
            })
            .map((paciente) => {
              const idade = calcularIdade(paciente.dataNascimento);
              const infoTempo = obterInfoTempoInternacao(paciente.dataInternacao);
              const isolamentos = obterIsolamentosAtivos(paciente, infeccoesMap);
              const sexoFormatado = formatarSexo(paciente.sexo);

              return {
                id: paciente.id,
                nome: paciente.nomePaciente,
                especialidade: paciente.especialidade || "Não informado",
                sexo: sexoFormatado,
                idade,
                tempoInternacaoTexto: infoTempo.texto,
                tempoInternacaoTimestamp: infoTempo.timestamp,
                isolamentos,
                temIsolamento: possuiIsolamentoAtivo(paciente),
              };
            })
            .sort((a, b) => {
              if (a.temIsolamento !== b.temIsolamento) {
                return a.temIsolamento ? -1 : 1;
              }

              const idadeA = Number.isFinite(a.idade) ? a.idade : -Infinity;
              const idadeB = Number.isFinite(b.idade) ? b.idade : -Infinity;
              if (idadeA !== idadeB) {
                return idadeB - idadeA;
              }

              if (a.tempoInternacaoTimestamp !== b.tempoInternacaoTimestamp) {
                return a.tempoInternacaoTimestamp - b.tempoInternacaoTimestamp;
              }

              return (a.nome || "").localeCompare(b.nome || "");
            });

          return {
            ...leito,
            codigo: leito.codigoLeito,
            sugestoes: pacientesCompativeis,
          };
        });

        return {
          id: setor.id,
          nome: setor.nomeSetor,
          leitos: leitosComSugestoes,
        };
      });
  }, [
    carregando,
    setores,
    leitos,
    quartos,
    pacientes,
    infeccoes,
    estrutura,
    pacientesEnriquecidos,
    infeccoesMap,
  ]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Sugestões de Regulação</DialogTitle>
          <DialogDescription>
            Conheça as regras abaixo para entender como as sugestões são apresentadas.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6">
          <Alert>
            <AlertTitle>Como as Sugestões Funcionam</AlertTitle>
            <AlertDescription>
              <div className="space-y-4">
                <p>
                  As sugestões de regulação servem como uma referência, indicando pacientes
                  que foram internados para uma determinada especialidade e mostrando os
                  leitos compatíveis com o sexo e isolamento desses pacientes que estão
                  aguardando um leito. A ordenação segue uma prioridade pré-definida, mas não
                  substitui a avaliação técnica e clínica do enfermeiro regulador.
                </p>
                <div>
                  <h4 className="font-semibold">Ordem de Prioridade</h4>
                  <ol className="mt-2 list-decimal space-y-2 pl-5">
                    <li>
                      Isolamento: O sistema sempre priorizará pacientes com algum tipo de
                      isolamento.
                    </li>
                    <li>
                      Idade: A seguir, a prioridade é para os pacientes mais idosos.
                    </li>
                    <li>
                      Tempo de Internação: O critério de desempate é o paciente internado há
                      mais tempo.
                    </li>
                  </ol>
                </div>
              </div>
            </AlertDescription>
          </Alert>
          {carregando ? (
            <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
              Carregando leitos disponíveis...
            </div>
          ) : setoresEnfermariaDisponiveis.length ? (
            <ScrollArea className="h-[60vh] pr-2">
              <Accordion type="multiple" className="space-y-4">
                {setoresEnfermariaDisponiveis.map((setor) => (
                  <AccordionItem key={setor.id} value={String(setor.id)}>
                    <AccordionTrigger>{setor.nome}</AccordionTrigger>
                    <AccordionContent>
                      <Accordion type="multiple" className="space-y-2">
                        {setor.leitos.map((leito) => (
                          <AccordionItem
                            key={leito.id}
                            value={`${setor.id}-${leito.id}`}
                          >
                            <AccordionTrigger>
                              <div className="flex w-full items-center justify-between text-left" title={leito.compatibilidade}>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{leito.codigo}</span>
                                  {leito.compatibilidadeBadges.length ? (
                                    <div className="flex flex-wrap gap-1">
                                      {leito.compatibilidadeBadges.map((badge, index) => (
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
                                <div className="space-y-3">
                                  {leito.sugestoes.map((sugestao) => {
                                    const idadeTexto = Number.isFinite(sugestao.idade)
                                      ? `${sugestao.idade} ${sugestao.idade === 1 ? 'ano' : 'anos'}`
                                      : 'Idade não informada';

                                    return (
                                      <div
                                        key={`${leito.id}-paciente-${sugestao.id}`}
                                        className="rounded-md border bg-muted/30 p-3"
                                      >
                                        <div className="space-y-2">
                                          <div className="flex flex-wrap items-start justify-between gap-2">
                                            <p className="font-semibold text-sm text-foreground">
                                              {sugestao.nome || 'Nome não informado'}
                                            </p>
                                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                              <span>{idadeTexto}</span>
                                              <span>•</span>
                                              <span>{sugestao.sexo}</span>
                                            </div>
                                          </div>
                                          <div className="text-xs text-muted-foreground">
                                            <span className="font-medium text-foreground">Especialidade:</span>{' '}
                                            {sugestao.especialidade}
                                          </div>
                                          {sugestao.tempoInternacaoTexto && (
                                            <div className="text-xs text-muted-foreground">
                                              <span className="font-medium text-foreground">Tempo de Internação:</span>{' '}
                                              {sugestao.tempoInternacaoTexto}
                                            </div>
                                          )}
                                          {sugestao.isolamentos.length > 0 && (
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
                                            </div>
                                          )}
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
            </ScrollArea>
          ) : (
            <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
              Nenhum leito de enfermaria disponível no momento.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SugestoesRegulacaoModal;
