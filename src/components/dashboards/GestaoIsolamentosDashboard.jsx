import React, { useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Shield, ShieldCheck } from 'lucide-react';
import { useDadosHospitalares } from '@/hooks/useDadosHospitalares';
import { identificarRiscosDeContaminacao } from '@/lib/compatibilidadeUtils';

const isIsolamentoAtivo = (isolamento) => {
  if (!isolamento) return false;
  if (typeof isolamento.statusConsideradoAtivo === 'boolean') {
    return isolamento.statusConsideradoAtivo;
  }
  const status = (isolamento.status || '').toLowerCase();
  return status === 'confirmado' || status === 'suspeito';
};

const formatarLocalizacao = (setor, quarto, leito) => {
  const partes = [];
  const setorNome = setor?.nomeSetor || setor?.nome || setor?.siglaSetor;
  if (setorNome) partes.push(setorNome);
  if (quarto?.nomeQuarto) partes.push(quarto.nomeQuarto);
  if (leito?.codigoLeito) partes.push(`Leito ${leito.codigoLeito}`);
  return partes.join(' • ') || 'Localização não informada';
};

const MENSAGENS_RISCO = {
  setor_aberto: 'Paciente com isolamento ativo em setor aberto (PS).',
  ausencia_coorte: 'Paciente isolado compartilhando quarto com companheiro sem isolamento ativo.',
  coorte_incompativel: 'Isolamentos diferentes entre pacientes do mesmo quarto.',
};

const GestaoIsolamentosDashboard = () => {
  const {
    pacientesEnriquecidos,
    leitos,
    setores,
    quartos,
    loading,
  } = useDadosHospitalares();

  const leitosPorId = useMemo(() => new Map(leitos.map(leito => [leito.id, leito])), [leitos]);
  const setoresPorId = useMemo(() => new Map(setores.map(setor => [setor.id, setor])), [setores]);
  const quartosPorId = useMemo(
    () => new Map((quartos || []).map(quarto => [quarto.id, quarto])),
    [quartos],
  );

  const pacientesIsolamento = useMemo(() => {
    if (!Array.isArray(pacientesEnriquecidos)) return [];

    return pacientesEnriquecidos
      .map(paciente => {
        const leito = paciente.leitoId ? leitosPorId.get(paciente.leitoId) || null : null;
        const setor = leito?.setorId ? setoresPorId.get(leito.setorId) || null : setoresPorId.get(paciente.setorId) || null;
        const quarto = leito?.quartoId ? quartosPorId.get(leito.quartoId) || null : null;
        const isolamentosAtivos = (paciente.isolamentos || []).filter(isIsolamentoAtivo);

        if (!isolamentosAtivos.length) {
          return null;
        }

        return {
          id: paciente.id,
          nome: paciente.nomePaciente || paciente.nome || 'Paciente sem identificação',
          leito,
          setor,
          quarto,
          isolamentos: isolamentosAtivos,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));
  }, [pacientesEnriquecidos, leitosPorId, setoresPorId, quartosPorId]);

  const riscosPorPaciente = useMemo(() => {
    if (!Array.isArray(pacientesEnriquecidos)) return new Map();
    return identificarRiscosDeContaminacao(pacientesEnriquecidos, leitos, quartos, setores);
  }, [pacientesEnriquecidos, leitos, quartos, setores]);

  const totalPacientesIsolados = pacientesIsolamento.length;
  const totalPacientesEmRisco = riscosPorPaciente.size;
  const percentualRisco = totalPacientesIsolados
    ? Math.round((totalPacientesEmRisco / totalPacientesIsolados) * 100)
    : 0;

  const obterDescricaoRisco = (motivo, detalhes = []) => {
    if (motivo === 'ausencia_coorte' || motivo === 'coorte_incompativel') {
      const detalheComQuarto = detalhes.find(item => item?.quartoId);
      if (detalheComQuarto?.quartoId) {
        const quarto = quartosPorId.get(detalheComQuarto.quartoId);
        const nomeQuarto = quarto?.nomeQuarto || `Quarto ${detalheComQuarto.quartoId}`;
        if (motivo === 'ausencia_coorte') {
          return `${nomeQuarto}: paciente isolado compartilhando o quarto com companheiro sem isolamento ativo.`;
        }
        return `${nomeQuarto}: isolamentos diferentes entre pacientes do mesmo quarto.`;
      }
    }
    return MENSAGENS_RISCO[motivo] || 'Risco de contaminação cruzada identificado.';
  };

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle className="text-xl text-foreground">
              Gestão de Isolamentos
            </CardTitle>
          </div>
          <p className="text-sm text-muted-foreground">
            Monitoramento de pacientes com isolamentos ativos e identificação de riscos de contaminação cruzada.
          </p>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg border border-border p-4 bg-muted/40">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="h-6 w-6 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Pacientes em isolamento</p>
                    <p className="text-2xl font-semibold text-foreground">{totalPacientesIsolados}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-lg border border-border p-4 bg-muted/40">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-6 w-6 text-destructive" />
                  <div>
                    <p className="text-sm text-muted-foreground">Pacientes com alerta</p>
                    <p className="text-2xl font-semibold text-destructive">{totalPacientesEmRisco}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-lg border border-border p-4 bg-muted/40">
                <div className="flex items-center gap-3">
                  <Shield className="h-6 w-6 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Pacientes em risco (%)</p>
                    <p className="text-2xl font-semibold text-foreground">{percentualRisco}%</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6">
              {pacientesIsolamento.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
                  Nenhum paciente com isolamento ativo no momento.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Paciente</TableHead>
                      <TableHead>Localização</TableHead>
                      <TableHead>Isolamentos Ativos</TableHead>
                      <TableHead>Alertas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pacientesIsolamento.map(paciente => {
                      const risco = riscosPorPaciente.get(paciente.id);
                      return (
                        <TableRow key={paciente.id} className={risco ? 'bg-destructive/5' : undefined}>
                          <TableCell className="font-medium text-foreground">
                            {paciente.nome}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatarLocalizacao(paciente.setor, paciente.quarto, paciente.leito)}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-2">
                              {paciente.isolamentos.map((iso, index) => (
                                <Badge key={`${paciente.id}-iso-${index}`} variant="secondary">
                                  {iso.siglaInfeccao || iso.sigla || iso.nomeInfeccao || 'Isolamento'}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            {risco ? (
                              <div className="space-y-2">
                                {risco.motivos.map(motivo => (
                                  <div key={`${paciente.id}-${motivo}`} className="flex items-start gap-2 text-sm text-destructive">
                                    <AlertTriangle className="mt-0.5 h-4 w-4" />
                                    <span>{obterDescricaoRisco(motivo, risco.detalhes)}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground">
                                Sem alerta
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default GestaoIsolamentosDashboard;
