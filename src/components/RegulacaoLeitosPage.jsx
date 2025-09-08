import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  TrendingUp, 
  Wrench, 
  Filter, 
  Users, 
  Loader, 
  BedDouble, 
  Truck, 
  Stethoscope, 
  ArrowRightLeft,
  DatabaseIcon,
  BookUser,
  Sparkles,
  PieChart
} from "lucide-react";
import ImportarPacientesMVModal from './ImportarPacientesMVModal';
import AguardandoRegulacaoPanel from './AguardandoRegulacaoPanel';

const RegulacaoLeitosPage = () => {
  const [showImportModal, setShowImportModal] = useState(false);

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
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-primary" />
              Filtros e Pesquisa
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Opções de filtro para os painéis abaixo serão implementadas aqui.
            </p>
            <div className="mt-3 text-xs text-muted-foreground/70">
              ▼ Esta área será expansível
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Seção 3: Painel Principal de Regulação */}
      <section>
        <div className="grid grid-cols-1 gap-6">
          {/* Painel de Pacientes Aguardando Regulação - OCUPA TODA A LARGURA */}
          <div className="col-span-full">
            <AguardandoRegulacaoPanel />
          </div>

          {/* Outros Cards em Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {/* Card 2: Regulações em Andamento */}
            <Card className="shadow-card card-interactive">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Loader className="h-5 w-5 text-orange-600" />
                  Regulações em Andamento
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Os dados serão carregados e exibidos aqui.
                </p>
              </CardContent>
            </Card>

            {/* Card 3: Pacientes Aguardando UTI */}
            <Card className="shadow-card card-interactive border-red-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <BedDouble className="h-5 w-5 text-red-600" />
                  Fila de Espera - UTI
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Os dados serão carregados e exibidos aqui.
                </p>
              </CardContent>
            </Card>

            {/* Card 4: Pacientes Aguardando Transf. Externa */}
            <Card className="shadow-card card-interactive">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Truck className="h-5 w-5 text-green-600" />
                  Aguardando Transferência Externa
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Os dados serão carregados e exibidos aqui.
                </p>
              </CardContent>
            </Card>

            {/* Card 5: Marcação Cirúrgica */}
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

            {/* Card 6: Remanejamentos Pendentes */}
            <Card className="shadow-card card-interactive">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <ArrowRightLeft className="h-5 w-5 text-teal-600" />
                  Remanejamentos Pendentes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Os dados serão carregados e exibidos aqui.
                </p>
              </CardContent>
            </Card>

            {/* Card 7: Espaço para Futuro Uso */}
            <Card className="shadow-card border-dashed border-muted-foreground/30 bg-muted/20">
              <CardHeader>
                <CardTitle className="text-lg text-muted-foreground">
                  Painel Futuro
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground/70 text-sm">
                  Espaço reservado para futuras funcionalidades.
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