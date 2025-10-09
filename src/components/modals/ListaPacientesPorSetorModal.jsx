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

const formatarTempoInternacao = (dataInternacao) => {
  if (!dataInternacao) {
    return '—';
  }

  const data = dataInternacao.toDate ? dataInternacao.toDate() : new Date(dataInternacao);
  if (Number.isNaN(data.getTime())) {
    return '—';
  }

  const diferencaMs = Date.now() - data.getTime();
  if (diferencaMs <= 0) {
    return '0h';
  }

  const totalMinutos = Math.floor(diferencaMs / (1000 * 60));
  const dias = Math.floor(totalMinutos / (60 * 24));
  const horas = Math.floor((totalMinutos - dias * 24 * 60) / 60);
  const minutos = totalMinutos % 60;

  if (dias > 0) {
    return `${dias}d ${horas}h`;
  }

  if (horas > 0) {
    return `${horas}h ${minutos}m`;
  }

  return `${minutos}m`;
};

const ListaPacientesPorSetorModal = ({ isOpen, onClose, setor, grupo, pacientes }) => {
  const pacientesFiltrados = useMemo(() => {
    if (!isOpen || !setor || !grupo || !pacientes?.length) {
      return [];
    }

    return pacientes.filter((paciente) => {
      const nomeSetor = paciente?.nomeSetor || 'Setor não identificado';
      const grupoClinico = paciente?.grupoClinico || 'Outras Especialidades';
      return nomeSetor === setor && grupoClinico === grupo;
    });
  }, [isOpen, pacientes, setor, grupo]);

  const pacientesAgrupados = useMemo(() => {
    if (!pacientesFiltrados.length) {
      return [];
    }

    const mapa = new Map();

    pacientesFiltrados.forEach((paciente) => {
      const especialidade = paciente?.especialidadeFormatada || paciente?.especialidade || 'ESPECIALIDADE NÃO INFORMADA';
      if (!mapa.has(especialidade)) {
        mapa.set(especialidade, []);
      }
      mapa.get(especialidade).push(paciente);
    });

    return Array.from(mapa.entries())
      .map(([especialidade, lista]) => ({
        especialidade,
        pacientes: lista
          .slice()
          .sort((a, b) => (a?.nomePaciente || '').localeCompare(b?.nomePaciente || '')),
      }))
      .sort((a, b) => b.pacientes.length - a.pacientes.length);
  }, [pacientesFiltrados]);

  const totalPacientes = pacientesFiltrados.length;

  if (!isOpen) {
    return null;
  }

  const tituloSetor = setor || '—';
  const tituloGrupo = grupo || '—';

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(aberto) => {
        if (!aberto) {
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span>Pacientes de {tituloGrupo} no Setor {tituloSetor}</span>
            <Badge variant="secondary">{totalPacientes} paciente(s)</Badge>
          </DialogTitle>
          <DialogDescription>
            Visualize os pacientes vinculados ao grupo clínico selecionado sem realizar novas consultas ao banco de dados.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          {pacientesAgrupados.length ? (
            <div className="space-y-6 pr-2">
              {pacientesAgrupados.map(({ especialidade, pacientes: lista }) => (
                <div key={especialidade} className="space-y-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <h3 className="text-sm font-semibold text-foreground">{especialidade}</h3>
                    <Badge variant="outline">{lista.length} paciente(s)</Badge>
                  </div>
                  <div className="space-y-2">
                    {lista.map((paciente) => (
                      <div
                        key={paciente?.id || `${paciente?.nomePaciente}-${paciente?.codigoLeito}`}
                        className="rounded-lg border bg-background p-3 shadow-sm"
                      >
                        <div className="grid gap-3 text-sm sm:grid-cols-3">
                          <div>
                            <p className="text-xs font-semibold uppercase text-muted-foreground">Leito</p>
                            <p className="font-medium text-foreground">{paciente?.codigoLeito || '—'}</p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase text-muted-foreground">Paciente</p>
                            <p className="font-medium text-foreground">{paciente?.nomePaciente || 'Não informado'}</p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase text-muted-foreground">Tempo de internação</p>
                            <p className="font-medium text-foreground">{formatarTempoInternacao(paciente?.dataInternacao)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-40 items-center justify-center rounded border border-dashed text-sm text-muted-foreground">
              Nenhum paciente encontrado para este recorte.
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default ListaPacientesPorSetorModal;
