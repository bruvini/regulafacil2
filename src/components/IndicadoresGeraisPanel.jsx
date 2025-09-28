import React, { useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Users, Bed, TrendingUp, Activity, Clock, AlertTriangle } from 'lucide-react';

const IndicadoresGeraisPanel = ({ setores = [], leitos = [], pacientes = [] }) => {
  const normalizarTexto = (valor) => {
    if (!valor) return '';
    return valor
      .toString()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .trim();
  };

  const parseDataFlex = (valor) => {
    if (!valor) return null;

    if (valor instanceof Date) {
      return Number.isNaN(valor.getTime()) ? null : valor;
    }

    if (typeof valor === 'object' && typeof valor.toDate === 'function') {
      const data = valor.toDate();
      return Number.isNaN(data?.getTime?.()) ? null : data;
    }

    if (typeof valor === 'string') {
      const texto = valor.trim();
      if (!texto) return null;

      if (texto.includes('/')) {
        const [dataParte, horaParte] = texto.split(' ');
        const [dia, mes, ano] = dataParte.split('/').map((parte) => parseInt(parte, 10));
        let horas = 0;
        let minutos = 0;

        if (horaParte && horaParte.includes(':')) {
          const [horaTexto, minutoTexto] = horaParte.split(':');
          horas = parseInt(horaTexto, 10);
          minutos = parseInt(minutoTexto, 10);
        }

        const data = new Date(ano, mes - 1, dia, horas, minutos);
        return Number.isNaN(data.getTime()) ? null : data;
      }

      const tentativa = new Date(texto);
      return Number.isNaN(tentativa.getTime()) ? null : tentativa;
    }

    const tentativa = new Date(valor);
    return Number.isNaN(tentativa.getTime()) ? null : tentativa;
  };

  const formatarDuracaoMedia = (tempoMedioMs) => {
    if (!tempoMedioMs || tempoMedioMs <= 0) return '0m';

    const totalMinutos = Math.floor(tempoMedioMs / 60000);
    const dias = Math.floor(totalMinutos / (60 * 24));
    const horas = Math.floor((totalMinutos % (60 * 24)) / 60);
    const minutos = totalMinutos % 60;

    if (dias > 0) {
      return `${dias}d ${horas}h`;
    }

    if (horas > 0) {
      return `${horas}h ${minutos}m`;
    }

    return `${minutos}m`;
  };

  const indicadores = useMemo(() => {
    const setoresLista = Array.isArray(setores) ? setores : [];
    const leitosLista = Array.isArray(leitos) ? leitos : [];
    const pacientesLista = Array.isArray(pacientes) ? pacientes : [];

    const setoresPorId = new Map(setoresLista.map((setor) => [setor.id, setor]));
    const leitosPorId = new Map(leitosLista.map((leito) => [leito.id, leito]));

    const agora = new Date();

    const pacientesInternados = pacientesLista.filter((paciente) => {
      const status = normalizarTexto(
        paciente.status ||
          paciente.statusPaciente ||
          paciente.situacao ||
          paciente.situacaoAtual ||
          paciente.statusAtendimento
      );
      if (!status) return true;
      return status.includes('intern');
    });

    const pacientesBase = pacientesInternados.length > 0 ? pacientesInternados : pacientesLista;

    let tempoTotalMs = 0;
    let pacientesComData = 0;

    pacientesBase.forEach((paciente) => {
      const dataInternacao = parseDataFlex(paciente.dataInternacao);
      if (dataInternacao) {
        tempoTotalMs += agora.getTime() - dataInternacao.getTime();
        pacientesComData += 1;
      }
    });

    const tempoMedioMs = pacientesComData > 0 ? tempoTotalMs / pacientesComData : 0;

    const tiposAssistenciais = new Set(['Emergência', 'Enfermaria', 'UTI']);
    const tiposRegulaveis = new Set(['Enfermaria', 'UTI']);
    const tiposHigienizacao = new Set(['Centro Cirúrgico', 'Emergência', 'Enfermaria', 'UTI']);

    const quartosComOcupacao = new Set();
    pacientesBase.forEach((paciente) => {
      const leitoAtual = paciente.leitoId ? leitosPorId.get(paciente.leitoId) : null;
      const quartoId = paciente.quartoId || leitoAtual?.quartoId;
      if (quartoId) {
        quartosComOcupacao.add(quartoId);
      }
    });

    const normalizarStatus = (status) => normalizarTexto(status || '').replace(/ç/g, 'c');

    let ocupadosAssistenciais = 0;
    let vagosRegulaveis = 0;
    let vagosCoorte = 0;
    let higienizacaoAssistenciais = 0;
    let bloqueadosAssistenciais = 0;

    leitosLista.forEach((leito) => {
      const setor = setoresPorId.get(leito.setorId);
      if (!setor) return;

      const tipoSetor = setor.tipoSetor;
      const status = normalizarStatus(leito.status || leito.statusLeito);

      if (tiposAssistenciais.has(tipoSetor) && status === 'ocupado') {
        ocupadosAssistenciais += 1;
      }

      const ehVagoElegivel = status === 'vago' || status === 'higienizacao';

      if (tiposRegulaveis.has(tipoSetor) && ehVagoElegivel) {
        vagosRegulaveis += 1;

        if (tipoSetor === 'Enfermaria') {
          const quartoId = leito.quartoId || leito.quarto?.id;
          if (quartoId && quartosComOcupacao.has(quartoId)) {
            vagosCoorte += 1;
          }
        }
      }

      if (tiposHigienizacao.has(tipoSetor) && status === 'higienizacao') {
        higienizacaoAssistenciais += 1;
      }

      if (tiposHigienizacao.has(tipoSetor) && status === 'bloqueado') {
        bloqueadosAssistenciais += 1;
      }
    });

    return {
      pacientes: {
        total: pacientesBase.length,
        tempoMedioMs
      },
      ocupados: ocupadosAssistenciais,
      vagosRegulaveis,
      vagosCoorte,
      higienizacao: higienizacaoAssistenciais,
      bloqueados: bloqueadosAssistenciais
    };
  }, [setores, leitos, pacientes]);

  const cards = [
    {
      key: 'pacientes',
      title: 'Pacientes',
      icon: Users,
      value: indicadores.pacientes.total,
      subtitle: `Tempo médio: ${formatarDuracaoMedia(indicadores.pacientes.tempoMedioMs)}`,
      tooltip:
        "Número total de pacientes com status 'Internado' no sistema. O tempo médio de internação é calculado desde a data de admissão registrada."
    },
    {
      key: 'ocupados',
      title: 'Ocupados',
      icon: Bed,
      value: indicadores.ocupados,
      subtitle: 'Setores: Emergência, Enfermaria e UTI',
      tooltip: 'Total de leitos ocupados nos setores assistenciais de Emergência, Enfermaria e UTI.'
    },
    {
      key: 'vagosRegulaveis',
      title: 'Vagos (Reguláveis)',
      icon: TrendingUp,
      value: indicadores.vagosRegulaveis,
      subtitle: 'Setores: Enfermaria e UTI',
      tooltip:
        'Leitos vagos ou em higienização em setores de Enfermaria e UTI, considerados aptos para receber novas regulações.'
    },
    {
      key: 'vagosCoorte',
      title: 'Vagos (Coorte)',
      icon: Activity,
      value: indicadores.vagosCoorte,
      subtitle: 'Enfermarias com quartos ocupados',
      tooltip:
        'Leitos vagos ou em higienização em Enfermarias que estão em quartos já ocupados, indicando restrição de alocação (coorte).'
    },
    {
      key: 'higienizacao',
      title: 'Higienização',
      icon: Clock,
      value: indicadores.higienizacao,
      subtitle: 'Centro Cirúrgico, Emergência, Enfermaria e UTI',
      tooltip:
        'Total de leitos em processo de higienização nos setores de Centro Cirúrgico, Emergência, Enfermaria e UTI.'
    },
    {
      key: 'bloqueados',
      title: 'Bloqueados',
      icon: AlertTriangle,
      value: indicadores.bloqueados,
      subtitle: 'Centro Cirúrgico, Emergência, Enfermaria e UTI',
      tooltip:
        'Total de leitos bloqueados por motivos administrativos ou de manutenção nos setores de Centro Cirúrgico, Emergência, Enfermaria e UTI.'
    }
  ];

  return (
    <div className="w-full space-y-6 mb-6">
      <div className="flex items-center gap-3">
        <Activity className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold text-gray-900">Indicadores Estratégicos</h1>
      </div>

      <TooltipProvider delayDuration={150}>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {cards.map((card) => (
            <Tooltip key={card.key}>
              <TooltipTrigger asChild>
                <Card className="hover:shadow-md transition-shadow">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                    <card.icon className="h-5 w-5 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{card.value}</div>
                    {card.subtitle && (
                      <p className="text-xs text-muted-foreground mt-1">{card.subtitle}</p>
                    )}
                  </CardContent>
                </Card>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-sm leading-relaxed">
                <p>{card.tooltip}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </TooltipProvider>
    </div>
  );
};

export default IndicadoresGeraisPanel;
