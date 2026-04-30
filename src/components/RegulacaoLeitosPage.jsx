import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  TrendingUp,
  Wrench,
  DatabaseIcon,
  BookUser,
  Sparkles,
  PieChart
} from "lucide-react";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  getAuditoriaCollection,
  onSnapshot,
  query,
  orderBy,
  limit
} from '@/lib/firebase';
import ImportarPacientesMVModal from './ImportarPacientesMVModal';
import AguardandoRegulacaoPanel from './AguardandoRegulacaoPanel';
import FilaEsperaUTIPanel from './FilaEsperaUTIPanel';
import TransferenciaExternaPanel from './TransferenciaExternaPanel';
import RegulacoesEmAndamentoPanel from './RegulacoesEmAndamentoPanel';
import RemanejamentosPendentesPanel from './RemanejamentosPendentesPanel';
import FiltrosRegulacao from './FiltrosRegulacao';
import PanoramaDatePickerModal from './modals/PanoramaDatePickerModal';
import PanoramaRegulacoesModal from './modals/PanoramaRegulacoesModal';
import RegularPacienteModal from './modals/RegularPacienteModal';
import PassagemPlantaoModal from './modals/PassagemPlantaoModal';
import SugestoesRegulacaoModal from './modals/SugestoesRegulacaoModal';
import IndicadoresPrincipais from './IndicadoresPrincipais';

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
  const [isDatePickerOpen, setDatePickerOpen] = useState(false);
  const [periodoRelatorio, setPeriodoRelatorio] = useState(null);
  const [regularModalAberto, setRegularModalAberto] = useState(false);
  const [pacienteSugestao, setPacienteSugestao] = useState(null);
  const [leitoSugestao, setLeitoSugestao] = useState(null);
  const [isPassagemPlantaoModalOpen, setPassagemPlantaoModalOpen] = useState(false);
  const [isSugestoesModalOpen, setIsSugestoesModalOpen] = useState(false);
  const [ultimaSincronizacao, setUltimaSincronizacao] = useState(null);

  useEffect(() => {
    let unsub = () => {};
    try {
      // Aumentamos o limite para 300 para garantir que pegamos o log de sincronização
      // mesmo que o hospital tenha tido muitas movimentações recentes.
      const q = query(
        getAuditoriaCollection(),
        orderBy('timestamp', 'desc'),
        limit(300)
      );

      unsub = onSnapshot(q, (snapshot) => {
        try {
          const logs = snapshot.docs.map(doc => doc.data());
          // Busca especificamente pela string da MV
          const lastSync = logs.find(l => l.acao && String(l.acao).includes('Sincronização via MV'));

          if (lastSync && lastSync.timestamp) {
            let dataObj = null;

            // Conversão segura do Timestamp do Firebase para Date do JS
            if (typeof lastSync.timestamp.toDate === 'function') {
              dataObj = lastSync.timestamp.toDate();
            } else if (lastSync.timestamp.seconds) {
              dataObj = new Date(lastSync.timestamp.seconds * 1000);
            } else {
              dataObj = new Date(lastSync.timestamp);
            }

            // Atualiza o estado apenas se for uma data válida
            if (dataObj && !isNaN(dataObj.getTime())) {
              setUltimaSincronizacao(dataObj);
            }
          }
        } catch (err) {
          console.error("Erro interno ao processar data da auditoria:", err);
        }
      });
    } catch (e) {
      console.error("Erro ao configurar listener de auditoria:", e);
    }
    return () => unsub();
  }, []);

  const handleFecharRegularModal = () => {
    setRegularModalAberto(false);
    setLeitoSugestao(null);
    setPacienteSugestao(null);
  };

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Seção 1: Cabeçalho do Dashboard */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Coluna 1: Indicadores Principais */}
        <Card className="shadow-card">
          <CardHeader className="px-4 pb-3 sm:px-6">
            <CardTitle className="flex items-center gap-2 text-base font-semibold sm:text-lg">
              <TrendingUp className="h-4 w-4 text-primary sm:h-5 sm:w-5" />
              Indicadores Principais
            </CardTitle>
          </CardHeader>
          <CardContent>
            <IndicadoresPrincipais />
          </CardContent>
        </Card>

        {/* Coluna 2: Caixa de Ferramentas */}
        <Card className="shadow-card">
          <CardHeader className="px-4 pb-3 sm:px-6">
            <CardTitle className="flex items-center gap-2 text-base font-semibold sm:text-lg">
              <Wrench className="h-4 w-4 text-primary sm:h-5 sm:w-5" />
              Caixa de Ferramentas
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col">
                <Button
                  variant="outline"
                  className="w-full flex items-center gap-2 text-xs sm:text-sm"
                  onClick={() => setShowImportModal(true)}
                >
                  <DatabaseIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  Importar Pacientes MV
                </Button>
                {ultimaSincronizacao && (
                  <span className="text-[10px] text-muted-foreground mt-1 text-center font-medium">
                    Última att: {format(ultimaSincronizacao, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </span>
                )}
              </div>
              <Button
                variant="outline"
                className="flex items-center gap-2 text-xs sm:text-sm"
                onClick={() => setPassagemPlantaoModalOpen(true)}
              >
                <BookUser className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                Passagem de Plantão
              </Button>
              <Button
                variant="outline"
                className="flex items-center gap-2 text-xs sm:text-sm"
                onClick={() => setIsSugestoesModalOpen(true)}
              >
                <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                Sugestões de Regulação
              </Button>
              <Button
                variant="outline"
                className="flex items-center gap-2 text-xs sm:text-sm"
                onClick={() => setDatePickerOpen(true)}
              >
                <PieChart className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
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

        </div>
      </section>

      {/* Modal de Importação */}
      <RegularPacienteModal
        isOpen={regularModalAberto}
        onClose={handleFecharRegularModal}
        paciente={pacienteSugestao}
        modo="enfermaria"
        leitoSugerido={leitoSugestao}
      />
      <ImportarPacientesMVModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
      />
      <PanoramaDatePickerModal
        isOpen={isDatePickerOpen}
        onClose={() => setDatePickerOpen(false)}
        onConfirmarPeriodo={(periodo) => {
          setPeriodoRelatorio(periodo);
          setDatePickerOpen(false);
        }}
      />
      {periodoRelatorio && (
        <PanoramaRegulacoesModal
          isOpen={!!periodoRelatorio}
          onClose={() => setPeriodoRelatorio(null)}
          periodo={periodoRelatorio}
        />
      )}
      <PassagemPlantaoModal
        isOpen={isPassagemPlantaoModalOpen}
        onClose={() => setPassagemPlantaoModalOpen(false)}
      />
      <SugestoesRegulacaoModal
        isOpen={isSugestoesModalOpen}
        onClose={() => setIsSugestoesModalOpen(false)}
      />
    </div>
  );
};

export default RegulacaoLeitosPage;
