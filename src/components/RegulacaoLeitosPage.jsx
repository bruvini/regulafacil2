import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  TrendingUp,
  Wrench,
  Stethoscope,
  DatabaseIcon,
  BookUser,
  Sparkles,
  PieChart
} from "lucide-react";
import ImportarPacientesMVModal from './ImportarPacientesMVModal';
import AguardandoRegulacaoPanel from './AguardandoRegulacaoPanel';
import FilaEsperaUTIPanel from './FilaEsperaUTIPanel';
import TransferenciaExternaPanel from './TransferenciaExternaPanel';
import RegulacoesEmAndamentoPanel from './RegulacoesEmAndamentoPanel';
import RemanejamentosPendentesPanel from './RemanejamentosPendentesPanel';
import FiltrosRegulacao from './FiltrosRegulacao';

const filtrosIniciais = {
  searchTerm: '',
  especialidade: 'todos',
  sexo: 'todos',
  idadeMin: '',
  idadeMax: '',
  tempoInternacaoMin: '',
  tempoInternacaoMax: '',
  unidadeTempo: 'dias'
};

const sortConfigInicial = { key: 'nome', direction: 'asc' };

const RegulacaoLeitosPage = () => {
  const [showImportModal, setShowImportModal] = useState(false);
  const [filtros, setFiltros] = useState(filtrosIniciais);
  const [sortConfig, setSortConfig] = useState(sortConfigInicial);

  return (
    <div className="p-6 space-y-6">
      {/* Seção 1: Cabeçalho do Dashboard */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Coluna 1: Indicadores Principais */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Indicadores Principais
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Métricas e KPIs serão exibidos aqui.
            </p>
          </CardContent>
        </Card>

        {/* Coluna 2: Caixa de Ferramentas */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-primary" />
              Caixa de Ferramentas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="flex items-center gap-2"
                onClick={() => setShowImportModal(true)}
              >
                <DatabaseIcon className="h-4 w-4" />
                Importar Pacientes MV
              </Button>
              <Button
                variant="outline"
                className="flex items-center gap-2 opacity-60 cursor-not-allowed"
                disabled
              >
                <BookUser className="h-4 w-4" />
                Passagem de Plantão
              </Button>
              <Button
                variant="outline"
                className="flex items-center gap-2 opacity-60 cursor-not-allowed"
                disabled
              >
                <Sparkles className="h-4 w-4" />
                Sugestões de Regulação
              </Button>
              <Button
                variant="outline"
                className="flex items-center gap-2 opacity-60 cursor-not-allowed"
                disabled
              >
                <PieChart className="h-4 w-4" />
                Panorama de Regulações
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Seção 2: Filtros */}
      <section>
        <FiltrosRegulacao
          filtros={filtros}
          setFiltros={setFiltros}
          sortConfig={sortConfig}
          setSortConfig={setSortConfig}
          initialFilters={filtrosIniciais}
          defaultSortConfig={sortConfigInicial}
        />
      </section>

      {/* Seção 3: Painel Principal de Regulação */}
      <section>
        <div className="space-y-6">
          {/* Painel de Pacientes Aguardando Regulação */}
          <AguardandoRegulacaoPanel filtros={filtros} sortConfig={sortConfig} />

          {/* Linha: Fila UTI + Transferência Externa */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FilaEsperaUTIPanel filtros={filtros} sortConfig={sortConfig} />
            <TransferenciaExternaPanel filtros={filtros} sortConfig={sortConfig} />
          </div>

          {/* Painel de Remanejamentos Pendentes */}
          <RemanejamentosPendentesPanel filtros={filtros} sortConfig={sortConfig} />

          {/* Painel de Regulações em Andamento */}
          <RegulacoesEmAndamentoPanel filtros={filtros} sortConfig={sortConfig} />

          {/* Outros Cards em Grid - ÚLTIMO ITEM */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {/* Card: Marcação Cirúrgica */}
            <Card className="shadow-card card-interactive">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Stethoscope className="h-5 w-5 text-purple-600" />
                  Marcações Cirúrgicas Pendentes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Os dados serão carregados e exibidos aqui.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Modal de Importação */}
      <ImportarPacientesMVModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
      />
    </div>
  );
};

export default RegulacaoLeitosPage;
