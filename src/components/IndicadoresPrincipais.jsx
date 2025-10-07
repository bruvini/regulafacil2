import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Timer } from "lucide-react";
import { useDadosHospitalares } from "@/hooks/useDadosHospitalares";

const NOMES_SETORES_FOCO = [
  "PS DECISÃO CLINICA",
  "PS DECISÃO CIRURGICA",
  "CC - RECUPERAÇÃO",
];

const parseDateValue = (value) => {
  if (!value) return null;
  if (typeof value.toDate === 'function') {
    try {
      return value.toDate();
    } catch (error) {
      return null;
    }
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDuration = (milliseconds) => {
  if (milliseconds == null || Number.isNaN(milliseconds)) {
    return '—';
  }

  const totalMinutes = Math.max(0, Math.round(milliseconds / (60 * 1000)));
  const minutesInDay = 60 * 24;
  const days = Math.floor(totalMinutes / minutesInDay);
  const remainingMinutes = totalMinutes % minutesInDay;
  const hours = Math.floor(remainingMinutes / 60);
  const minutes = remainingMinutes % 60;

  const parts = [];
  if (days > 0) {
    parts.push(`${days}d`);
  }
  if (hours > 0) {
    parts.push(`${hours}h`);
  }
  if (minutes > 0 || parts.length === 0) {
    parts.push(`${minutes}m`);
  }

  return parts.join(' ');
};

const IndicadoresPrincipais = () => {
  const { pacientes = [], setores = [], leitos = [] } = useDadosHospitalares();

  const setoresAlvoIds = useMemo(() => {
    const nomes = new Set(NOMES_SETORES_FOCO);
    return new Set(
      setores
        .filter((setor) => nomes.has(setor?.nomeSetor))
        .map((setor) => setor.id)
        .filter(Boolean)
    );
  }, [setores]);

  const leitosPorId = useMemo(() => {
    return new Map(leitos.map((leito) => [leito.id, leito]));
  }, [leitos]);

  const aguardandoLeitoTotal = useMemo(() => {
    if (!pacientes.length) {
      return 0;
    }

    const ids = new Set();

    pacientes.forEach((paciente) => {
      if (!paciente) return;

      const setorIdPaciente =
        paciente.setorId || leitosPorId.get(paciente.leitoId)?.setorId || null;
      const estaEmSetorAlvo = setorIdPaciente && setoresAlvoIds.has(setorIdPaciente);
      const possuiPedidoUti = Boolean(paciente.pedidoUTI);

      if ((estaEmSetorAlvo || possuiPedidoUti) && paciente.id) {
        ids.add(paciente.id);
      }
    });

    return ids.size;
  }, [pacientes, leitosPorId, setoresAlvoIds]);

  const { totalRegulacoes, tempoMedioMs } = useMemo(() => {
    if (!pacientes.length) {
      return { totalRegulacoes: 0, tempoMedioMs: null };
    }

    let somaDuracoes = 0;
    let contagemValidos = 0;

    const agora = new Date();

    pacientes.forEach((paciente) => {
      const regulacao = paciente?.regulacaoAtiva;
      if (!regulacao) return;

      const inicio = parseDateValue(regulacao.iniciadoEm);
      if (!inicio) return;

      const diff = agora.getTime() - inicio.getTime();
      if (diff < 0) return;

      somaDuracoes += diff;
      contagemValidos += 1;
    });

    if (contagemValidos === 0) {
      return { totalRegulacoes: 0, tempoMedioMs: null };
    }

    return {
      totalRegulacoes: contagemValidos,
      tempoMedioMs: somaDuracoes / contagemValidos,
    };
  }, [pacientes]);

  const tempoMedioFormatado = tempoMedioMs != null ? formatDuration(tempoMedioMs) : '—';

  const descricaoRegulacoes = totalRegulacoes === 0
    ? 'Nenhuma regulação em andamento'
    : `${totalRegulacoes} regulação${totalRegulacoes > 1 ? 'es' : ''} em andamento`;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Card className="border-muted shadow-none">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pacientes Aguardando Leito</CardTitle>
          <Users className="h-5 w-5 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{aguardandoLeitoTotal}</div>
          <p className="text-xs text-muted-foreground">
            Inclui setores PS Decisão e CC - Recuperação, além de pedidos ativos de UTI.
          </p>
        </CardContent>
      </Card>

      <Card className="border-muted shadow-none">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Tempo Médio das Regulações</CardTitle>
          <Timer className="h-5 w-5 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{tempoMedioFormatado}</div>
          <p className="text-xs text-muted-foreground">{descricaoRegulacoes}</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default IndicadoresPrincipais;
