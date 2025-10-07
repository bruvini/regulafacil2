import React, { useMemo } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { useDadosHospitalares } from '@/hooks/useDadosHospitalares';
import {
  getChavesIsolamentoAtivo,
  identificarRiscosContaminacao,
  TIPOS_RISCO_CONTAMINACAO,
} from '@/lib/compatibilidadeUtils';

const GestaoIsolamentosDashboard = () => {
  const dadosHospitalares = useDadosHospitalares();
  const { estrutura, pacientesEnriquecidos, loading } = dadosHospitalares;

  const riscosPorPaciente = useMemo(
    () => identificarRiscosContaminacao({ estrutura, pacientesEnriquecidos }),
    [estrutura, pacientesEnriquecidos],
  );

  const pacientesIsolados = useMemo(() => {
    return (pacientesEnriquecidos || [])
      .filter(paciente => getChavesIsolamentoAtivo(paciente).size > 0)
      .sort((a, b) => (a.nomePaciente || '').localeCompare(b.nomePaciente || ''));
  }, [pacientesEnriquecidos]);

  const localizacaoPorPaciente = useMemo(() => {
    const mapa = new Map();
    const setores = estrutura
      ? (Array.isArray(estrutura) ? estrutura : Object.values(estrutura).flat())
      : [];

    setores.forEach(setor => {
      const setorNome = setor?.nomeSetor || setor?.nome || setor?.siglaSetor || '';
      const tipoSetor = setor?.tipoSetor || '';

      (setor?.quartos || []).forEach(quarto => {
        const quartoNome = quarto?.nomeQuarto || '';
        (quarto?.leitos || []).forEach(leito => {
          const paciente = leito?.paciente;
          if (!paciente?.id) return;
          mapa.set(paciente.id, {
            setorNome,
            tipoSetor,
            quartoNome,
            leitoCodigo: leito?.codigoLeito || '',
          });
        });
      });

      (setor?.leitosSemQuarto || []).forEach(leito => {
        const paciente = leito?.paciente;
        if (!paciente?.id) return;
        mapa.set(paciente.id, {
          setorNome,
          tipoSetor,
          quartoNome: null,
          leitoCodigo: leito?.codigoLeito || '',
        });
      });
    });

    return mapa;
  }, [estrutura]);

  const totalIsolamentos = pacientesIsolados.length;
  const pacientesIsoladosComRisco = pacientesIsolados.filter(
    paciente => (riscosPorPaciente.get(paciente.id) || []).length > 0,
  ).length;

  const renderResumo = () => (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pacientes com isolamento</CardTitle>
          <CardDescription>Total monitorado pela CCIH</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-semibold">{totalIsolamentos}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Alertas ativos</CardTitle>
          <CardDescription>Risco de contaminação cruzada</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-semibold text-destructive">{pacientesIsoladosComRisco}</p>
        </CardContent>
      </Card>
    </div>
  );

  const renderRisco = (paciente) => {
    const riscos = riscosPorPaciente.get(paciente.id) || [];
    if (!riscos.length) {
      return (
        <div className="mt-3 flex items-center gap-2 text-sm text-emerald-600">
          <ShieldCheck className="h-4 w-4" />
          <span>Nenhum risco de contaminação cruzada identificado.</span>
        </div>
      );
    }

    return (
      <div className="mt-3 space-y-2">
        {riscos.map(risco => (
          <div
            key={risco.chaveContexto}
            className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-sm text-destructive"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="space-y-1">
              <p className="font-medium">
                {risco.tipo === TIPOS_RISCO_CONTAMINACAO.SETOR_ABERTO && 'Setor aberto (PS)'}
                {risco.tipo === TIPOS_RISCO_CONTAMINACAO.FALTA_COHORTE && 'Falta de coorte'}
                {risco.tipo === TIPOS_RISCO_CONTAMINACAO.COORTE_INCOMPATIVEL && 'Coorte incompatível'}
              </p>
              <p>{risco.mensagem}</p>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderListaPacientes = () => {
    if (!totalIsolamentos) {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Pacientes com isolamento ativo</CardTitle>
            <CardDescription>Não há pacientes isolados no momento.</CardDescription>
          </CardHeader>
        </Card>
      );
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Pacientes com isolamento ativo</CardTitle>
          <CardDescription>Monitoramento de risco de contaminação cruzada</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {pacientesIsolados.map(paciente => {
            const localizacao = localizacaoPorPaciente.get(paciente.id) || {};
            const isolamentosAtivos = (paciente.isolamentos || [])
              .filter(iso => iso.statusConsideradoAtivo)
              .map(iso => iso.siglaInfeccao || iso.sigla || iso.nomeInfeccao || iso.nome || 'Isolamento');

            return (
              <div
                key={paciente.id}
                className="rounded-lg border bg-card/50 p-4 shadow-sm"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-base font-semibold text-foreground">
                      {paciente.nomePaciente || 'Paciente sem nome informado'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {localizacao.setorNome || 'Setor não informado'}
                      {localizacao.quartoNome ? ` • ${localizacao.quartoNome}` : ''}
                      {localizacao.leitoCodigo ? ` • Leito ${localizacao.leitoCodigo}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {isolamentosAtivos.map((iso, index) => (
                      <Badge key={`${iso}-${index}`} variant="secondary">
                        {iso}
                      </Badge>
                    ))}
                  </div>
                </div>
                {renderRisco(paciente)}
              </div>
            );
          })}
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <p className="text-sm text-muted-foreground">Carregando dados de isolamentos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {renderResumo()}
      {renderListaPacientes()}
    </div>
  );
};

export default GestaoIsolamentosDashboard;