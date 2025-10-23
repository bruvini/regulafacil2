import React, { useState, useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Wrench, 
  Download, 
  Upload,
  Settings2,
  Activity,
  Map
} from 'lucide-react';
import { 
  getSetoresCollection,
  getLeitosCollection,
  getPacientesCollection,
  getInfeccoesCollection,
  getQuartosCollection,
  onSnapshot
} from '@/lib/firebase';

// Importar componentes
import IndicadoresGeraisPanel from './IndicadoresGeraisPanel';
import MapaLeitosPanel from './MapaLeitosPanel';
import GerenciamentoLeitosModal from './GerenciamentoLeitosModal';
import ImportarPacientesMVModal from './ImportarPacientesMVModal';
import RelatorioIsolamentosModal from './modals/RelatorioIsolamentosModal';
import RelatorioLeitosVagosModal from './modals/RelatorioLeitosVagosModal';
import ReservasLeitosModal from './modals/ReservasLeitosModal';

const MapaLeitosPage = () => {
  const [dados, setDados] = useState({
    setores: [],
    leitos: [],
    pacientes: [],
    quartos: [],
    infeccoes: [],
    loading: true
  });

  const [showGerenciamentoModal, setShowGerenciamentoModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showRelatorioIsolamentosModal, setShowRelatorioIsolamentosModal] = useState(false);
  const [showRelatorioLeitosVagosModal, setShowRelatorioLeitosVagosModal] = useState(false);
  const [showReservasLeitosModal, setShowReservasLeitosModal] = useState(false);
  const mapaLeitosRef = useRef(null);

  // Carregar dados do Firestore
  useEffect(() => {
    const unsubscribes = [];

    // Setores
    const unsubSetores = onSnapshot(getSetoresCollection(), (snapshot) => {
      const setoresData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setDados(prev => ({ ...prev, setores: setoresData }));
    });
    unsubscribes.push(unsubSetores);

    // Leitos
    const unsubLeitos = onSnapshot(getLeitosCollection(), (snapshot) => {
      const leitosData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setDados(prev => ({ ...prev, leitos: leitosData }));
    });
    unsubscribes.push(unsubLeitos);

    // Quartos
    const unsubQuartos = onSnapshot(getQuartosCollection(), (snapshot) => {
      const quartosData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setDados(prev => ({ ...prev, quartos: quartosData }));
    });
    unsubscribes.push(unsubQuartos);

    // Pacientes
    const unsubPacientes = onSnapshot(getPacientesCollection(), (snapshot) => {
      const pacientesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setDados(prev => ({ ...prev, pacientes: pacientesData }));
    });
    unsubscribes.push(unsubPacientes);

    // Infecções
    const unsubInfeccoes = onSnapshot(getInfeccoesCollection(), (snapshot) => {
      const infeccoesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setDados(prev => ({ ...prev, infeccoes: infeccoesData, loading: false }));
    });
    unsubscribes.push(unsubInfeccoes);

    return () => {
      unsubscribes.forEach(unsubscribe => unsubscribe());
    };
  }, []);

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Indicadores Gerais */}
      <IndicadoresGeraisPanel
        setores={dados.setores}
        leitos={dados.leitos}
        pacientes={dados.pacientes}
        quartos={dados.quartos}
        infeccoes={dados.infeccoes}
      />

      {/* Caixa de Ferramentas */}
      <Card className="shadow-card">
        <CardHeader className="px-4 pb-3 sm:px-6">
          <CardTitle className="flex items-center gap-2 text-base font-semibold sm:text-lg">
            <Wrench className="h-4 w-4 text-primary sm:h-5 sm:w-5" />
            Caixa de Ferramentas
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 py-4 sm:px-6 sm:py-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-2 text-xs sm:text-sm"
              onClick={() => setShowGerenciamentoModal(true)}
            >
              <Settings2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Gerenciar leitos
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-2 text-xs sm:text-sm"
              onClick={() => setShowRelatorioIsolamentosModal(true)}
            >
              <Activity className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Relatório de isolamentos
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-2 text-xs sm:text-sm"
              onClick={() => setShowRelatorioLeitosVagosModal(true)}
            >
              <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Relatório de leitos vagos
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-2 text-xs sm:text-sm"
              onClick={() => mapaLeitosRef.current?.openBoletimDiario?.()}
            >
              <Activity className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Boletim diário
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-2 text-xs sm:text-sm"
              onClick={() => setShowReservasLeitosModal(true)}
            >
              <Settings2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Reservas de leitos
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Mapa de Leitos Principal */}
      <Card className="shadow-card">
        <CardHeader className="px-4 pb-3 sm:px-6">
          <CardTitle className="flex items-center gap-2 text-base font-semibold sm:text-lg">
            <Map className="h-4 w-4 text-primary sm:h-5 sm:w-5" />
            Mapa de Leitos
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 py-4 sm:px-6 sm:py-6">
          <MapaLeitosPanel ref={mapaLeitosRef} />
        </CardContent>
      </Card>

      {/* Modais */}
      <GerenciamentoLeitosModal 
        isOpen={showGerenciamentoModal} 
        onClose={() => setShowGerenciamentoModal(false)} 
      />
      
      <ImportarPacientesMVModal 
        isOpen={showImportModal} 
        onClose={() => setShowImportModal(false)} 
      />
      
      <RelatorioIsolamentosModal 
        isOpen={showRelatorioIsolamentosModal} 
        onClose={() => setShowRelatorioIsolamentosModal(false)} 
      />
      
      <RelatorioLeitosVagosModal 
        isOpen={showRelatorioLeitosVagosModal} 
        onClose={() => setShowRelatorioLeitosVagosModal(false)} 
      />

      <ReservasLeitosModal 
        isOpen={showReservasLeitosModal} 
        onClose={() => setShowReservasLeitosModal(false)} 
      />
    </div>
  );
};

export default MapaLeitosPage;