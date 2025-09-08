import React, { useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  TrendingUp, 
  Users, 
  Bed, 
  Clock, 
  AlertTriangle,
  Activity
} from 'lucide-react';

const IndicadoresGeraisPanel = ({ setores, leitos, pacientes }) => {
  // Função para calcular tempo médio no status
  const calcularTempoMedio = (leitosFiltrados) => {
    if (leitosFiltrados.length === 0) return "0m";
    
    const agora = new Date();
    let tempoTotalMs = 0;
    
    leitosFiltrados.forEach(leito => {
      if (leito.historico && leito.historico.length > 0) {
        const ultimoRegistro = leito.historico[leito.historico.length - 1];
        if (ultimoRegistro.timestamp) {
          const timestamp = ultimoRegistro.timestamp.toDate 
            ? ultimoRegistro.timestamp.toDate() 
            : new Date(ultimoRegistro.timestamp);
          tempoTotalMs += agora - timestamp;
        }
      }
    });
    
    const tempoMedioMs = tempoTotalMs / leitosFiltrados.length;
    const horas = Math.floor(tempoMedioMs / (1000 * 60 * 60));
    const minutos = Math.floor((tempoMedioMs % (1000 * 60 * 60)) / (1000 * 60));
    const dias = Math.floor(horas / 24);
    
    if (dias > 0) {
      return `${dias}d ${horas % 24}h`;
    } else if (horas > 0) {
      return `${horas}h ${minutos}m`;
    } else {
      return `${minutos}m`;
    }
  };

  const indicadores = useMemo(() => {
    if (!setores.length || !leitos.length) {
      return {
        taxaOcupacao: 0,
        nivelPCP: { nivel: 'Rotina Diária', cor: 'blue', ocupados: 0 },
        resumoStatus: {
          ocupados: { total: 0, tempo: "0m" },
          bloqueados: { total: 0, tempo: "0m" },
          higienizacao: { total: 0, tempo: "0m" },
          vagosTotal: { total: 0, tempo: "0m" },
          vagosRegulaveis: { total: 0, tempo: "0m" }
        }
      };
    }

    // Criar mapa de pacientes por leitoId
    const pacientesPorLeito = {};
    pacientes.forEach(paciente => {
      if (paciente.leitoId) {
        pacientesPorLeito[paciente.leitoId] = paciente;
      }
    });

    // Adicionar informações de paciente aos leitos e definir status
    const leitosComPacientes = leitos.map(leito => ({
      ...leito,
      paciente: pacientesPorLeito[leito.id] || null,
      status: pacientesPorLeito[leito.id] ? 'Ocupado' : leito.status
    }));

    // 1. Taxa de Ocupação Geral
    const setoresOperacionais = setores.filter(setor => 
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

    // 2. Status PCP
    const setoresPCP = setores.filter(setor => 
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

    // 3. Resumo por Status
    const leitosOcupadosTodos = leitosComPacientes.filter(leito => leito.status === 'Ocupado');
    const leitosBloqueados = leitosComPacientes.filter(leito => leito.status === 'Bloqueado');
    const leitosHigienizacao = leitosComPacientes.filter(leito => leito.status === 'Higienização');
    const leitosVagos = leitosComPacientes.filter(leito => leito.status === 'Vago');
    
    const setoresRegulaveis = setores.filter(setor => 
      ['Enfermaria', 'UTI'].includes(setor.tipoSetor)
    );
    const leitosVagosRegulaveis = leitosVagos.filter(leito =>
      setoresRegulaveis.some(setor => setor.id === leito.setorId)
    );

    const resumoStatus = {
      ocupados: { 
        total: leitosOcupadosTodos.length, 
        tempo: calcularTempoMedio(leitosOcupadosTodos) 
      },
      bloqueados: { 
        total: leitosBloqueados.length, 
        tempo: calcularTempoMedio(leitosBloqueados) 
      },
      higienizacao: { 
        total: leitosHigienizacao.length, 
        tempo: calcularTempoMedio(leitosHigienizacao) 
      },
      vagosTotal: { 
        total: leitosVagos.length, 
        tempo: calcularTempoMedio(leitosVagos) 
      },
      vagosRegulaveis: { 
        total: leitosVagosRegulaveis.length, 
        tempo: calcularTempoMedio(leitosVagosRegulaveis) 
      }
    };

    return {
      taxaOcupacao,
      nivelPCP,
      resumoStatus
    };
  }, [setores, leitos, pacientes]);

  const getCorTaxaOcupacao = (taxa) => {
    if (taxa <= 50) return 'bg-green-500';
    if (taxa <= 75) return 'bg-yellow-500';
    return 'bg-red-500';
  };

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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                  {indicadores.taxaOcupacao.toFixed(1)}%
                </span>
                <Badge variant="outline" className="text-sm">
                  Operacional
                </Badge>
              </div>
              <Progress 
                value={indicadores.taxaOcupacao} 
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

        {/* Resumo Rápido */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Resumo Rápido</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-red-600 font-medium">Ocupados:</span>
                <span>{indicadores.resumoStatus.ocupados.total}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-green-600 font-medium">Vagos (Reguláveis):</span>
                <span>{indicadores.resumoStatus.vagosRegulaveis.total}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-yellow-600 font-medium">Higienização:</span>
                <span>{indicadores.resumoStatus.higienizacao.total}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600 font-medium">Bloqueados:</span>
                <span>{indicadores.resumoStatus.bloqueados.total}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cards Detalhados por Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="border-red-200 bg-red-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-red-700 flex items-center gap-2">
              <Bed className="h-4 w-4" />
              Ocupados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <p className="text-2xl font-bold text-red-800">
                {indicadores.resumoStatus.ocupados.total}
              </p>
              <div className="flex items-center gap-1 text-sm text-red-600">
                <Clock className="h-3 w-3" />
                <span>Média: {indicadores.resumoStatus.ocupados.tempo}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-gray-200 bg-gray-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-gray-700 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Bloqueados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <p className="text-2xl font-bold text-gray-800">
                {indicadores.resumoStatus.bloqueados.total}
              </p>
              <div className="flex items-center gap-1 text-sm text-gray-600">
                <Clock className="h-3 w-3" />
                <span>Média: {indicadores.resumoStatus.bloqueados.tempo}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-yellow-700 flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Higienização
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <p className="text-2xl font-bold text-yellow-800">
                {indicadores.resumoStatus.higienizacao.total}
              </p>
              <div className="flex items-center gap-1 text-sm text-yellow-600">
                <Clock className="h-3 w-3" />
                <span>Média: {indicadores.resumoStatus.higienizacao.tempo}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-green-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-green-700 flex items-center gap-2">
              <Bed className="h-4 w-4" />
              Vagos (Total)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <p className="text-2xl font-bold text-green-800">
                {indicadores.resumoStatus.vagosTotal.total}
              </p>
              <div className="flex items-center gap-1 text-sm text-green-600">
                <Clock className="h-3 w-3" />
                <span>Média: {indicadores.resumoStatus.vagosTotal.tempo}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-blue-700 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Vagos (Reguláveis)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <p className="text-2xl font-bold text-blue-800">
                {indicadores.resumoStatus.vagosRegulaveis.total}
              </p>
              <div className="flex items-center gap-1 text-sm text-blue-600">
                <Clock className="h-3 w-3" />
                <span>Média: {indicadores.resumoStatus.vagosRegulaveis.tempo}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default IndicadoresGeraisPanel;