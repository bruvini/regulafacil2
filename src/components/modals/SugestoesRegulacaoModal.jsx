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
import { encontrarLeitosCompativeis, calcularIdade } from "@/lib/compatibilidadeUtils";
import { intervalToDuration } from "date-fns";
import { useRegrasConfig } from "@/hooks/useRegrasConfig";

// PERFIS_DE_SETOR_POR_ESPECIALIDADE foram migrados para o Firestore via useRegrasConfig.
// A constante abaixo é mantida como referência histórica e para outros consumidores do arquivo.
// O componente agora usa regrasConfig.perfisSetor (dinâmico).

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

  const inicio = data.getTime();
  const agora = Date.now();
  const inicioNormalizado = Math.min(inicio, agora);
  const fimNormalizado = Math.max(inicio, agora);

  const duration = intervalToDuration({
    start: new Date(inicioNormalizado),
    end: new Date(fimNormalizado),
  });

  const totalDias = Math.floor((fimNormalizado - inicioNormalizado) / (1000 * 60 * 60 * 24));
  const horasRestantes = duration.hours ?? 0;
  const minutosRestantes = duration.minutes ?? 0;

  const partes = [];

  if (totalDias > 0) {
    partes.push(`${totalDias}d`);
  }

  if (horasRestantes > 0 || (totalDias > 0 && minutosRestantes > 0)) {
    partes.push(`${horasRestantes}h`);
  }

  if (minutosRestantes > 0) {
    partes.push(`${minutosRestantes}m`);
  }

  if (!partes.length) {
    partes.push("0m");
  }

  return {
    timestamp: inicio,
    texto: partes.join(" "),
  };
};

const calcularDiasInternado = (dataInternacao) => {
  const data = parseDataFlexivel(dataInternacao);
  if (!data) return 0;
  const ms = Date.now() - data.getTime();
  if (ms <= 0) return 0;
  return Math.floor(ms / (1000 * 60 * 60 * 24));
};

const calcularScoreRegulacao = (paciente, contexto = {}) => {
  const motivos = [];
  let score = 0;

  if (contexto.temIsolamento) {
    score += 30;
    motivos.push("Possui isolamento compatível com o leito (+30)");
  }

  const idade = Number.isFinite(contexto.idade) ? contexto.idade : null;
  if (idade !== null) {
    if (idade >= 80) {
      score += 20;
      motivos.push("Paciente Superidoso >80a (+20)");
    } else if (idade >= 60) {
      score += 10;
      motivos.push("Estatuto do Idoso >60a (+10)");
    }
  }

  const origemNorm = normalizarTexto(
    paciente?.setorNome
      || paciente?.localizacaoAtual
      || paciente?.setorOrigem
      || paciente?.setorOrigemNome
      || contexto.setorOrigemTexto
      || "",
  );
  if (origemNorm.includes("CC - RECUPERACAO") || origemNorm.includes("RECUPERACAO") || origemNorm === "CC RECU") {
    score += 30;
    motivos.push("Retenção em RPA trava o CC (+30)");
  } else if (origemNorm.includes("PS DECISAO") || origemNorm === "DCL" || origemNorm === "DCX") {
    score += 20;
    motivos.push("Retenção no Pronto Socorro (+20)");
  }

  const dias = calcularDiasInternado(paciente?.dataInternacao);
  if (dias > 0) {
    const ptsTempo = Math.min(20, dias * 2);
    score += ptsTempo;
    motivos.push(`Aguardando há ${dias} ${dias === 1 ? "dia" : "dias"} (+${ptsTempo})`);
  }

  return {
    scoreTotal: Math.min(100, score),
    motivos,
  };
};

const formatarDataPrevistaAlta = (valor) => {
  if (!valor) return null;
  const data = parseDataFlexivel(valor);
  if (!data) {
    const texto = String(valor).trim();
    return texto || null;
  }
  const dd = String(data.getDate()).padStart(2, "0");
  const mm = String(data.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}`;
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

const obterTextoValido = (valor) => {
  const texto = String(valor ?? "").trim();
  return texto || null;
};

const obterSetorOrigemTextoFallback = (paciente) => {
  const candidato = [
    paciente?.setorOrigemNome,
    paciente?.setorOrigemSigla,
    paciente?.setorOrigem,
    paciente?.origemSetorNome,
    paciente?.setorNome,
    paciente?.localizacaoAtual,
    paciente?.setor,
  ].map(obterTextoValido)
    .find(Boolean);

  return candidato || "Não informado";
};

const obterLeitoOrigemTextoFallback = (paciente) => {
  const candidato = [
    paciente?.leitoOrigemCodigo,
    paciente?.leitoOrigem,
    paciente?.leitoAtualCodigo,
    paciente?.leitoAtual,
    paciente?.leitoNome,
    paciente?.leito,
  ].map(obterTextoValido)
    .find(Boolean);

  return candidato || "Não informado";
};

const normalizarCodigoLeito = (valor) => {
  const texto = obterTextoValido(valor);
  return texto ? texto.toUpperCase() : null;
};

const encontrarLeitoPaciente = (paciente, leitosPorId, leitosPorCodigo) => {
  if (!paciente) return null;

  const candidatosId = [
    paciente?.leitoId,
    paciente?.leitoOrigemId,
    paciente?.leitoAtualId,
    paciente?.leito?.id,
    paciente?.leito?.leitoId,
    paciente?.leitoAtual?.id,
    paciente?.regulacaoAtiva?.leitoOrigemId,
  ].filter(Boolean);

  for (const id of candidatosId) {
    const leito = leitosPorId.get(id);
    if (leito) return leito;
  }

  const candidatosCodigo = [
    paciente?.leitoOrigemCodigo,
    paciente?.leitoOrigem,
    paciente?.leitoAtualCodigo,
    paciente?.leitoAtual,
    paciente?.leitoNome,
    paciente?.leito,
    paciente?.codigoLeito,
    paciente?.leito?.codigoLeito,
    paciente?.leito?.codigo,
  ]
    .map((valor) => normalizarCodigoLeito(valor))
    .filter(Boolean);

  for (const codigo of candidatosCodigo) {
    const leito = leitosPorCodigo.get(codigo);
    if (leito) return leito;
  }

  return null;
};

const encontrarSetorPaciente = (
  paciente,
  setoresPorId,
  leitosPorId,
  leitosPorCodigo,
  leitoEncontrado,
) => {
  if (!paciente) return null;

  const candidatosId = [
    paciente?.setorId,
    paciente?.setorOrigemId,
    paciente?.setor?.id,
    paciente?.setorOrigem?.id,
    paciente?.regulacaoAtiva?.setorOrigemId,
  ].filter(Boolean);

  for (const id of candidatosId) {
    const setor = setoresPorId.get(id);
    if (setor) return setor;
  }

  const leito = leitoEncontrado || encontrarLeitoPaciente(paciente, leitosPorId, leitosPorCodigo);
  if (leito) {
    const setorDoLeito = setoresPorId.get(leito.setorId);
    if (setorDoLeito) return setorDoLeito;
  }

  return null;
};

const obterLocalizacaoPaciente = (paciente, setoresPorId, leitosPorId, leitosPorCodigo) => {
  const fallbackSetor = obterSetorOrigemTextoFallback(paciente);
  const fallbackLeito = obterLeitoOrigemTextoFallback(paciente);

  const leito = encontrarLeitoPaciente(paciente, leitosPorId, leitosPorCodigo);
  const setor = encontrarSetorPaciente(
    paciente,
    setoresPorId,
    leitosPorId,
    leitosPorCodigo,
    leito,
  );

  const setorPreferencial =
    obterTextoValido(setor?.siglaSetor) ||
    obterTextoValido(setor?.nomeSetor || setor?.nome) ||
    (fallbackSetor !== "Não informado" ? fallbackSetor : null);

  const leitoPreferencial =
    obterTextoValido(leito?.codigoLeito || leito?.codigo) ||
    (fallbackLeito !== "Não informado" ? fallbackLeito : null);

  const localizacaoTexto = setorPreferencial
    ? leitoPreferencial
      ? `${setorPreferencial} - ${leitoPreferencial}`
      : setorPreferencial
    : leitoPreferencial || "Não informado";

  return {
    setorTexto: setorPreferencial || fallbackSetor,
    leitoTexto: leitoPreferencial || fallbackLeito,
    localizacaoTexto,
  };
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
  const { regras: regrasConfig, loading: loadingRegras } = useRegrasConfig();
  const carregando = loadingDados || loadingQuartos;

  // Gera os perfis de setor normalizados a partir do Firebase (dinâmico)
  const perfisNormalizados = useMemo(() => {
    const perfis = regrasConfig?.perfisSetor ?? {};
    return new Map(
      Object.entries(perfis).map(([setor, especialidades]) => [
        normalizarTexto(setor),
        new Set((especialidades || []).map((item) => normalizarTexto(item))),
      ]),
    );
  }, [regrasConfig]);

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

    const setoresPorId = new Map((setores || []).map((setor) => [setor.id, setor]));
    const leitosPorId = new Map((leitos || []).map((leito) => [leito.id, leito]));
    const leitosPorCodigo = new Map(
      (leitos || [])
        .map((leito) => [normalizarCodigoLeito(leito?.codigoLeito || leito?.codigo), leito])
        .filter(([codigo]) => Boolean(codigo)),
    );

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
      .filter((paciente) => !paciente?.altaAposRPA)
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
      // Enriquece com setorNome resolvido para que a Hard Rule de origem RPA
      // no compatibilidadeUtils possa detectar "CC - RECUPERAÇÃO" pelo nome textual.
      const setorResolvido = paciente.setorId ? setoresPorId.get(paciente.setorId) : null;
      const pacienteComSetor = setorResolvido
        ? { ...paciente, setorNome: setorResolvido.nomeSetor || setorResolvido.nome || setorResolvido.siglaSetor || paciente.setorNome }
        : paciente;

      const leitosCompat = encontrarLeitosCompativeis(pacienteComSetor, hospitalData, "enfermaria", {}, regrasConfig);
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
        const especialidadesPermitidas = perfisNormalizados.get(setorNomeNorm) || new Set();

        const leitosComSugestoes = setor.leitosVagos
          .map((leito) => {
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
                const localizacao = obterLocalizacaoPaciente(
                  paciente,
                  setoresPorId,
                  leitosPorId,
                  leitosPorCodigo,
                );
                const temIsolamento = possuiIsolamentoAtivo(paciente);
                const { scoreTotal, motivos } = calcularScoreRegulacao(paciente, {
                  idade,
                  temIsolamento,
                  setorOrigemTexto: localizacao.setorTexto,
                });
                const dataPrevistaAltaFmt = formatarDataPrevistaAlta(paciente.dataPrevistaAlta);

                return {
                  id: paciente.id,
                  nome: paciente.nomePaciente,
                  especialidade: paciente.especialidade || "Não informado",
                  sexo: sexoFormatado,
                  idade,
                  tempoInternacaoTexto: infoTempo.texto,
                  tempoInternacaoTimestamp: infoTempo.timestamp,
                  isolamentos,
                  temIsolamento,
                  setorOrigem: localizacao.setorTexto,
                  leitoOrigem: localizacao.leitoTexto,
                  localizacao: localizacao.localizacaoTexto,
                  scoreTotal,
                  scoreMotivos: motivos,
                  dataPrevistaAlta: dataPrevistaAltaFmt,
                };
              })
              .sort((a, b) => {
                if (b.scoreTotal !== a.scoreTotal) {
                  return b.scoreTotal - a.scoreTotal;
                }
                if (a.tempoInternacaoTimestamp !== b.tempoInternacaoTimestamp) {
                  return a.tempoInternacaoTimestamp - b.tempoInternacaoTimestamp;
                }
                if (b.idade !== a.idade) {
                  return (b.idade || 0) - (a.idade || 0);
                }
                return (a.nome || "").localeCompare(b.nome || "");
              });

            return {
              ...leito,
              codigo: leito.codigoLeito,
              sugestoes: pacientesCompativeis,
            };
          })
          .filter((leito) => leito.sugestoes.length > 0);

        if (!leitosComSugestoes.length) {
          return null;
        }

        return {
          id: setor.id,
          nome: setor.nomeSetor,
          leitos: leitosComSugestoes,
        };
      })
      .filter(Boolean);
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
                              <AccordionTrigger>
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
                                  <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2 pb-2 scrollbar-thin">
                                    {leito.sugestoes.map((sugestao) => {
                                      const idadeTexto = Number.isFinite(sugestao.idade)
                                        ? `${sugestao.idade} ${sugestao.idade === 1 ? 'ano' : 'anos'}`
                                        : 'Idade não informada';

                                      const score = sugestao.scoreTotal ?? 0;

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
                                                  <Badge 
                                                    className="text-lg px-3 py-1 font-bold border-transparent text-white hover:opacity-90"
                                                    style={{ backgroundColor: `hsl(calc(${score} * 1.2), 80%, 45%)` }}
                                                  >
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

export default SugestoesRegulacaoModal;
