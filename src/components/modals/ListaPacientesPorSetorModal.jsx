import React, { useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

const formatarTempoInternacao = (dataInternacao) => {
  if (!dataInternacao) return '—';
  const data = dataInternacao.toDate ? dataInternacao.toDate() : new Date(dataInternacao);
  if (Number.isNaN(data.getTime())) return '—';

  const diferencaMs = Date.now() - data.getTime();
  if (diferencaMs <= 0) return '0h';

  const totalMinutos = Math.floor(diferencaMs / (1000 * 60));
  const dias = Math.floor(totalMinutos / (60 * 24));
  const horas = Math.floor((totalMinutos - dias * 24 * 60) / 60);
  const minutos = totalMinutos % 60;

  if (dias > 0) return `${dias}d ${horas}h`;
  if (horas > 0) return `${horas}h ${minutos}m`;
  return `${minutos}m`;
};

/**
 * Lista de pacientes do setor focada em DESVIO DE PERFIL.
 *
 * Comportamento:
 *  - Identifica o "perfil nativo" do setor (grupo clínico majoritário).
 *  - Quando o usuário clica em uma faixa do gráfico empilhado, o modal mostra
 *    TODOS os pacientes daquele setor, mas com a faixa clicada destacada.
 *  - Pacientes "fora do perfil" recebem badge laranja.
 *  - Isolamentos são listados como justificativa (já que não há setor de
 *    infectologia, pacientes infectados são alocados onde houver leito).
 *
 * Props:
 *  - setor:           string (nome do setor clicado)
 *  - grupo:           string (grupo clínico clicado na barra)
 *  - pacientes:       array de TODOS os pacientes ativos enriquecidos
 *  - infeccoesPorId:  Record<id, infecção>  (para resolver siglas de isolamento)
 */
const ListaPacientesPorSetorModal = ({
  isOpen,
  onClose,
  setor,
  grupo,
  pacientes,
  infeccoesPorId = {},
}) => {
  // Todos os pacientes daquele setor (independente do grupo clicado)
  const pacientesDoSetor = useMemo(() => {
    if (!isOpen || !setor || !pacientes?.length) return [];
    return pacientes.filter(
      (p) => (p?.nomeSetor || 'Setor não identificado') === setor
    );
  }, [isOpen, pacientes, setor]);

  // Perfil nativo = grupo majoritário do setor
  const perfilNativo = useMemo(() => {
    if (!pacientesDoSetor.length) return null;
    const cont = new Map();
    pacientesDoSetor.forEach((p) => {
      const g = p?.grupoClinico || 'Outras Especialidades';
      cont.set(g, (cont.get(g) || 0) + 1);
    });
    const ordenado = Array.from(cont.entries()).sort((a, b) => b[1] - a[1]);
    return ordenado[0]?.[0] || null;
  }, [pacientesDoSetor]);

  // Agrupa por grupo clínico, ordenando: clicado primeiro, depois fora do perfil, depois nativo
  const gruposOrdenados = useMemo(() => {
    if (!pacientesDoSetor.length) return [];

    const mapa = new Map();
    pacientesDoSetor.forEach((p) => {
      const g = p?.grupoClinico || 'Outras Especialidades';
      if (!mapa.has(g)) mapa.set(g, []);
      mapa.get(g).push(p);
    });

    const ordenarPacientes = (lista) =>
      lista.slice().sort((a, b) => (a?.nomePaciente || '').localeCompare(b?.nomePaciente || ''));

    const todos = Array.from(mapa.entries()).map(([nomeGrupo, lista]) => ({
      nomeGrupo,
      pacientes: ordenarPacientes(lista),
      foraDoPerfil: perfilNativo ? nomeGrupo !== perfilNativo : false,
      destacado: nomeGrupo === grupo,
    }));

    return todos.sort((a, b) => {
      // 1) grupo clicado primeiro
      if (a.destacado && !b.destacado) return -1;
      if (b.destacado && !a.destacado) return 1;
      // 2) fora do perfil antes do nativo
      if (a.foraDoPerfil && !b.foraDoPerfil) return -1;
      if (b.foraDoPerfil && !a.foraDoPerfil) return 1;
      // 3) maior volume primeiro
      return b.pacientes.length - a.pacientes.length;
    });
  }, [pacientesDoSetor, perfilNativo, grupo]);

  const totalSetor = pacientesDoSetor.length;
  const totalForaDoPerfil = useMemo(
    () => gruposOrdenados.filter((g) => g.foraDoPerfil).reduce((s, g) => s + g.pacientes.length, 0),
    [gruposOrdenados]
  );
  const totalComIsolamento = useMemo(
    () => pacientesDoSetor.filter((p) => Array.isArray(p?.isolamentos) && p.isolamentos.length > 0).length,
    [pacientesDoSetor]
  );

  if (!isOpen) return null;

  const resolverSiglaIsolamento = (iso) => {
    const infeccao = iso?.infeccaoId ? infeccoesPorId[iso.infeccaoId] : null;
    return (
      infeccao?.siglaInfeccao ||
      infeccao?.sigla ||
      iso?.siglaInfeccao ||
      iso?.sigla ||
      iso?.nomeInfeccao ||
      'ISO'
    );
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(aberto) => {
        if (!aberto) onClose();
      }}
    >
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span>Pacientes no Setor {setor || '—'}</span>
            <Badge variant="secondary">{totalSetor} paciente(s)</Badge>
          </DialogTitle>
          <DialogDescription className="space-y-2">
            <span className="block">
              {perfilNativo ? (
                <>Perfil predominante do setor: <strong>{perfilNativo}</strong>.</>
              ) : (
                <>Sem perfil clínico predominante identificado.</>
              )}
              {' '}Você clicou no grupo <strong>{grupo || '—'}</strong>.
            </span>
            <span className="flex flex-wrap gap-2 pt-1">
              {totalForaDoPerfil > 0 && (
                <Badge variant="outline" className="border-orange-300 bg-orange-50 text-orange-700">
                  <AlertTriangle className="mr-1 h-3 w-3" />
                  {totalForaDoPerfil} fora do perfil
                </Badge>
              )}
              {totalComIsolamento > 0 && (
                <Badge variant="outline" className="border-red-300 bg-red-50 text-red-700">
                  <ShieldAlert className="mr-1 h-3 w-3" />
                  {totalComIsolamento} com isolamento
                </Badge>
              )}
            </span>
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[65vh] pr-4">
          {gruposOrdenados.length ? (
            <div className="space-y-6 pr-2">
              {gruposOrdenados.map(({ nomeGrupo, pacientes: lista, foraDoPerfil, destacado }) => (
                <div
                  key={nomeGrupo}
                  className={cn(
                    "space-y-3 rounded-lg border p-3",
                    destacado && "border-primary/40 bg-primary/5",
                    foraDoPerfil && !destacado && "border-orange-200 bg-orange-50/40"
                  )}
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-foreground">{nomeGrupo}</h3>
                      {foraDoPerfil ? (
                        <Badge
                          variant="outline"
                          className="border-orange-300 bg-orange-100 text-xs text-orange-800"
                        >
                          <AlertTriangle className="mr-1 h-3 w-3" />
                          Fora do perfil
                        </Badge>
                      ) : perfilNativo === nomeGrupo ? (
                        <Badge
                          variant="outline"
                          className="border-emerald-300 bg-emerald-50 text-xs text-emerald-800"
                        >
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          Perfil do setor
                        </Badge>
                      ) : null}
                    </div>
                    <Badge variant="outline">{lista.length} paciente(s)</Badge>
                  </div>

                  <div className="space-y-2">
                    {lista.map((paciente) => {
                      const isolamentos = Array.isArray(paciente?.isolamentos) ? paciente.isolamentos : [];
                      const temIsolamento = isolamentos.length > 0;

                      return (
                        <div
                          key={paciente?.id || `${paciente?.nomePaciente}-${paciente?.codigoLeito}`}
                          className="rounded-lg border bg-background p-3 shadow-sm"
                        >
                          <div className="grid gap-3 text-sm sm:grid-cols-4">
                            <div>
                              <p className="text-xs font-semibold uppercase text-muted-foreground">Leito</p>
                              <p className="font-medium text-foreground">{paciente?.codigoLeito || '—'}</p>
                            </div>
                            <div className="sm:col-span-2">
                              <p className="text-xs font-semibold uppercase text-muted-foreground">Paciente</p>
                              <p className="font-medium text-foreground">
                                {paciente?.nomePaciente || 'Não informado'}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {paciente?.especialidadeFormatada ||
                                  paciente?.especialidade ||
                                  'Especialidade não informada'}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs font-semibold uppercase text-muted-foreground">
                                Tempo de internação
                              </p>
                              <p className="font-medium text-foreground">
                                {formatarTempoInternacao(paciente?.dataInternacao)}
                              </p>
                            </div>
                          </div>

                          {temIsolamento && (
                            <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t pt-2">
                              <ShieldAlert className="h-3.5 w-3.5 text-red-600" />
                              <span className="text-xs font-medium text-red-700">
                                {foraDoPerfil
                                  ? 'Justificativa para alocação fora do perfil:'
                                  : 'Isolamentos ativos:'}
                              </span>
                              {isolamentos.map((iso, idx) => (
                                <Badge
                                  key={`${paciente.id}-iso-${idx}`}
                                  variant="destructive"
                                  className="text-[0.65rem]"
                                >
                                  {resolverSiglaIsolamento(iso)}
                                </Badge>
                              ))}
                            </div>
                          )}

                          {foraDoPerfil && !temIsolamento && (
                            <div className="mt-3 flex items-center gap-1.5 border-t pt-2 text-xs text-orange-700">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              Sem isolamento cadastrado — verificar motivo da alocação fora do perfil.
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-40 items-center justify-center rounded border border-dashed text-sm text-muted-foreground">
              Nenhum paciente encontrado neste setor.
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default ListaPacientesPorSetorModal;
