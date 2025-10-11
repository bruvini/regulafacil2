import React, { useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  TrendingUp,
  AlertTriangle,
  Activity
} from 'lucide-react';

const STRINGS_SEM_ISOLAMENTO = new Set([
  'NAO',
  'NÃO',
  'N/A',
  'NAO INFORMADO',
  'NÃO INFORMADO',
  'NAO APLICAVEL',
  'NAO APLICÁVEL',
  'SEM ISOLAMENTO',
  'SEM ISOLAMENTO ATIVO',
  'SEM',
  '0',
  'NA'
]);

const normalizarColecaoParaArray = (valor) => {
  if (!valor) return [];
  if (Array.isArray(valor)) return valor.filter(Boolean);
  if (typeof valor === 'object') return Object.values(valor).filter(Boolean);
  return [];
};

const valorStringIndicaIsolamentoAtivo = (valor) => {
  if (!valor) return false;
  const normalizado = String(valor).trim().toUpperCase();
  if (!normalizado) return false;
  return !STRINGS_SEM_ISOLAMENTO.has(normalizado);
};

const registroIndicaIsolamentoAtivo = (registro) => {
  if (!registro) return false;

  if (Array.isArray(registro)) {
    return registro.some(item => registroIndicaIsolamentoAtivo(item));
  }

  if (typeof registro === 'object') {
    if ('statusConsideradoAtivo' in registro) {
      return Boolean(registro.statusConsideradoAtivo);
    }

    if ('ativo' in registro) {
      return Boolean(registro.ativo);
    }

    if ('status' in registro) {
      const statusNormalizado = String(registro.status).trim().toLowerCase();
      if (['finalizado', 'finalizada', 'encerrado', 'encerrada', 'liberado', 'liberada', 'descartado', 'descartada', 'cancelado', 'cancelada'].includes(statusNormalizado)) {
        return false;
      }
      if (['confirmado', 'confirmada', 'suspeito', 'suspeita', 'ativo', 'ativa', 'em andamento'].includes(statusNormalizado)) {
        return true;
      }
    }

    const camposPossiveis = [
      'sigla',
      'siglaInfeccao',
      'siglaInfeccoes',
      'nome',
      'nomeInfeccao',
      'descricao',
      'label',
      'valor',
      'coorte'
    ];

    return camposPossiveis.some(chave => registroIndicaIsolamentoAtivo(registro[chave]));
  }

  if (typeof registro === 'string') {
    return valorStringIndicaIsolamentoAtivo(registro);
  }

  return false;
};

const temOcupanteComIsolamentoAtivo = (ocupante) => {
  if (!ocupante) return false;

  const camposOcupante = [
    ocupante?.isolamentos,
    ocupante?.isolamento,
    ocupante?.coorteIsolamento,
    ocupante?.isolamentosAtivos
  ];

  const pacienteRelacionado = typeof ocupante === 'object'
    ? (ocupante.paciente || ocupante.dadosPaciente || ocupante.infoPaciente)
    : null;

  if (pacienteRelacionado && typeof pacienteRelacionado === 'object') {
    camposOcupante.push(
      pacienteRelacionado.isolamentos,
      pacienteRelacionado.isolamento,
      pacienteRelacionado.coorteIsolamento,
      pacienteRelacionado.isolamentosAtivos
    );
  }

  return camposOcupante.some(registro => registroIndicaIsolamentoAtivo(registro));
};

const quartoPossuiIsolamentoAtivo = (leito) => {
  const contexto = leito?.contextoQuarto;
  if (!contexto) return false;

  const camposContexto = [
    contexto?.isolamentos,
    contexto?.isolamentosAtivos,
    contexto?.coorteIsolamento,
    contexto?.restricaoIsolamento,
    contexto?.isolamento
  ];

  if (camposContexto.some(registro => registroIndicaIsolamentoAtivo(registro))) {
    return true;
  }

  const indicadoresBooleanos = [
    'possuiIsolamentoAtivo',
    'temIsolamentoAtivo',
    'quartoPossuiIsolamento',
    'haIsolamentoAtivo',
    'possuiPacientesIsolados'
  ];

  if (indicadoresBooleanos.some(flag => Boolean(contexto?.[flag]))) {
    return true;
  }

  const colecoesOcupantes = [
    contexto?.ocupantes,
    contexto?.ocupantesInfo,
    contexto?.ocupantesAtivos,
    contexto?.pacientes,
    contexto?.pacientesNoQuarto,
    contexto?.leitosOcupados
  ];

  return colecoesOcupantes.some(colecao =>
    normalizarColecaoParaArray(colecao).some(temOcupanteComIsolamentoAtivo)
  );
};

const leitoSemRestricaoDeIsolamento = (leito) => {
  if (!leito) return false;

  const camposLeito = [
    leito?.restricaoCoorte?.isolamentos,
    leito?.restricaoCoorte?.isolamento,
    leito?.restricaoCoorte?.isolamentosAtivos
  ];

  if (camposLeito.some(registro => registroIndicaIsolamentoAtivo(registro))) {
    return false;
  }

  if (quartoPossuiIsolamentoAtivo(leito)) {
    return false;
  }

  return true;
};

const IndicadoresGeraisPanel = ({ setores, leitos, pacientes }) => {
  const indicadores = useMemo(() => {
    const setoresLista = Array.isArray(setores) ? setores : [];
    const leitosLista = Array.isArray(leitos) ? leitos : [];
    const pacientesLista = Array.isArray(pacientes) ? pacientes : [];

    const contagensIniciais = {
      totalLeitos: leitosLista.length,
      vagosTotal: 0,
      vagosRegulaveis: { total: 0, semIsolamento: 0 },
      ocupados: 0,
      higienizacao: 0,
      bloqueados: 0,
      reservasExternas: 0
    };

    if (leitosLista.length === 0) {
      return {
        taxaOcupacao: 0,
        nivelPCP: { nivel: 'Rotina Diária', cor: 'blue', ocupados: 0 },
        contagens: contagensIniciais
      };
    }

    const pacientesPorLeito = {};
    pacientesLista.forEach(paciente => {
      if (paciente?.leitoId) {
        pacientesPorLeito[paciente.leitoId] = paciente;
      }
    });

    const leitosComPacientes = leitosLista.map(leito => ({
      ...leito,
      paciente: pacientesPorLeito[leito.id] || null,
      status: pacientesPorLeito[leito.id] ? 'Ocupado' : leito.status
    }));

    const setoresOperacionais = setoresLista.filter(setor =>
      ['UTI', 'Enfermaria', 'Emergência'].includes(setor.tipoSetor)
    );
    const leitosOperacionais = leitosComPacientes.filter(leito =>
      setoresOperacionais.some(setor => setor.id === leito.setorId)
    );

    const leitosOcupados = leitosOperacionais.filter(leito => leito.status === 'Ocupado');
    const totalOperacional = leitosOperacionais.filter(leito =>
      ['Ocupado', 'Vago', 'Higienização'].includes(leito.status)
    );

    const taxaOcupacao = totalOperacional.length > 0
      ? (leitosOcupados.length / totalOperacional.length) * 100
      : 0;

    const setoresPCP = setoresLista.filter(setor =>
      setor.nomeSetor === 'PS DECISÃO CIRURGICA' || setor.nomeSetor === 'PS DECISÃO CLINICA'
    );
    const leitosPCP = leitosComPacientes.filter(leito =>
      setoresPCP.some(setor => setor.id === leito.setorId)
    );
    const totalPcpOcupado = leitosPCP.filter(leito => leito.status === 'Ocupado').length;

    let nivelPCP = { nivel: 'Rotina Diária', cor: 'blue', ocupados: totalPcpOcupado };
    if (totalPcpOcupado >= 23 && totalPcpOcupado <= 28) {
      nivelPCP = { nivel: 'Nível 1', cor: 'green', ocupados: totalPcpOcupado };
    } else if (totalPcpOcupado >= 29 && totalPcpOcupado <= 32) {
      nivelPCP = { nivel: 'Nível 2', cor: 'yellow', ocupados: totalPcpOcupado };
    } else if (totalPcpOcupado > 32) {
      nivelPCP = { nivel: 'Nível 3', cor: 'red', ocupados: totalPcpOcupado };
    }

    const leitosOcupadosTodos = leitosComPacientes.filter(leito => leito.status === 'Ocupado');
    const leitosBloqueados = leitosComPacientes.filter(leito => leito.status === 'Bloqueado');
    const leitosHigienizacao = leitosComPacientes.filter(leito => leito.status === 'Higienização');
    const leitosVagos = leitosComPacientes.filter(leito => leito.status === 'Vago');

    const setoresRegulaveis = setoresLista.filter(setor =>
      ['Enfermaria', 'UTI'].includes(setor.tipoSetor)
    );
    const leitosVagosRegulaveis = leitosVagos.filter(leito =>
      setoresRegulaveis.some(setor => setor.id === leito.setorId)
    );

    const leitosRegulaveisSemIsolamento = leitosVagosRegulaveis.filter(leito =>
      leitoSemRestricaoDeIsolamento(leito)
    );

    const reservasExternas = leitosComPacientes.filter(leito => Boolean(leito?.reservaExterna)).length;

    return {
      taxaOcupacao,
      nivelPCP,
      contagens: {
        totalLeitos: leitosComPacientes.length,
        vagosTotal: leitosVagos.length,
        vagosRegulaveis: {
          total: leitosVagosRegulaveis.length,
          semIsolamento: leitosRegulaveisSemIsolamento.length
        },
        ocupados: leitosOcupadosTodos.length,
        higienizacao: leitosHigienizacao.length,
        bloqueados: leitosBloqueados.length,
        reservasExternas
      }
    };
  }, [setores, leitos, pacientes]);

  const getCorNivelPCP = (cor) => {
    const cores = {
      blue: 'bg-blue-500 text-blue-100',
      green: 'bg-green-500 text-green-100',
      yellow: 'bg-yellow-500 text-yellow-900',
      red: 'bg-red-500 text-red-100'
    };
    return cores[cor] || cores.blue;
  };

  return (
    <div className="w-full space-y-6 mb-6">
      {/* Cabeçalho */}
      <div className="flex items-center gap-3">
        <Activity className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold text-gray-900">Indicadores Estratégicos</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Taxa de Ocupação Geral */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Taxa de Ocupação Geral</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">
                  {Number.isFinite(indicadores.taxaOcupacao)
                    ? indicadores.taxaOcupacao.toFixed(1)
                    : '0.0'}%
                </span>
                <Badge variant="outline" className="text-sm">
                  Operacional
                </Badge>
              </div>
              <Progress
                value={Number.isFinite(indicadores.taxaOcupacao) ? indicadores.taxaOcupacao : 0}
                className="h-3"
              />
              <p className="text-sm text-muted-foreground">
                UTI, Enfermaria e Emergência
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Status PCP */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Status PCP</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-lg font-semibold">
                  {indicadores.nivelPCP.ocupados} ocupados
                </span>
              </div>
              <Badge 
                className={`${getCorNivelPCP(indicadores.nivelPCP.cor)} px-3 py-1 text-sm font-medium`}
              >
                {indicadores.nivelPCP.nivel}
              </Badge>
              <p className="text-sm text-muted-foreground">
                PS Decisão Cirúrgica e Clínica
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <TooltipProvider delayDuration={150}>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
          {[
            {
              id: 'total-leitos',
              titulo: 'Total de Leitos',
              valor: indicadores.contagens.totalLeitos,
              tooltip: 'Exibe o número total de leitos operacionais cadastrados no sistema, independentemente do status.'
            },
            {
              id: 'vagos-total',
              titulo: 'Vagos (Total)',
              valor: indicadores.contagens.vagosTotal,
              tooltip: "Total de leitos com status 'Vago' em todos os setores do hospital."
            },
            {
              id: 'vagos-regulaveis',
              titulo: 'Vagos (Reguláveis)',
              valor: indicadores.contagens.vagosRegulaveis.total,
              valorSecundario: indicadores.contagens.vagosRegulaveis.semIsolamento,
              labelSecundario: 'Sem isolamento',
              tooltip: 'Exibe o total de leitos vagos em Enfermarias e UTIs. O número menor indica quantos destes estão aptos a receber pacientes sem isolamento.'
            },
            {
              id: 'ocupados',
              titulo: 'Ocupados',
              valor: indicadores.contagens.ocupados,
              tooltip: 'Total de leitos atualmente ocupados por pacientes.'
            },
            {
              id: 'higienizacao',
              titulo: 'Higienização',
              valor: indicadores.contagens.higienizacao,
              tooltip: 'Total de leitos que receberam alta e estão em processo de limpeza e preparação.'
            },
            {
              id: 'bloqueados',
              titulo: 'Bloqueados',
              valor: indicadores.contagens.bloqueados,
              tooltip: 'Total de leitos indisponíveis para uso por motivos de manutenção, reforma ou outras razões administrativas.'
            },
            {
              id: 'reservas-externas',
              titulo: 'Reservas Externas',
              valor: indicadores.contagens.reservasExternas,
              tooltip: 'Total de leitos com reserva para pacientes externos, como Oncologia ou transferências via SISREG.'
            }
          ].map(card => (
            <Tooltip key={card.id}>
              <TooltipTrigger asChild>
                <Card className="h-full cursor-help transition-shadow hover:shadow-md">
                  <CardContent className="p-4">
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">{card.titulo}</p>
                      <p className="text-2xl font-semibold text-foreground">
                        {Number(card.valor || 0).toLocaleString('pt-BR')}
                      </p>
                      {typeof card.valorSecundario === 'number' && (
                        <div className="text-xs text-muted-foreground">
                          {card.labelSecundario}: {' '}
                          <span className="font-semibold text-foreground">
                            {Number(card.valorSecundario).toLocaleString('pt-BR')}
                          </span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
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