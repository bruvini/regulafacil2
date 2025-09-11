import React, { useState, useEffect } from 'react';
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
  onSnapshot
} from '@/lib/firebase';

// Importar componentes
import IndicadoresGeraisPanel from './IndicadoresGeraisPanel';
import MapaLeitosPanel from './MapaLeitosPanel';
import GerenciamentoLeitosModal from './GerenciamentoLeitosModal';
import ImportarPacientesMVModal from './ImportarPacientesMVModal';
import RelatorioIsolamentosModal from './modals/RelatorioIsolamentosModal';

const MapaLeitosPage = () => {
  const [dados, setDados] = useState({
    setores: [],
    leitos: [],
    pacientes: [],
    infeccoes: [],
    loading: true
  });

  const [showGerenciamentoModal, setShowGerenciamentoModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showRelatorioIsolamentosModal, setShowRelatorioIsolamentosModal] = useState(false);

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
    <div className="space-y-6">
      {/* Indicadores Gerais */}
      <IndicadoresGeraisPanel 
        setores={dados.setores}
        leitos={dados.leitos}
        pacientes={dados.pacientes}
      />

      {/* Caixa de Ferramentas */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-primary" />
            Caixa de Ferramentas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Button 
              variant="outline" 
              className="flex items-center gap-2" 
              onClick={() => setShowGerenciamentoModal(true)}
            >
              <Settings2 className="h-4 w-4" />
              Gerenciar leitos
            </Button>
            
            <Button 
              variant="outline" 
              className="flex items-center gap-2"
              onClick={() => setShowRelatorioIsolamentosModal(true)}
            >
              <Activity className="h-4 w-4" />
              Relatório de isolamentos
            </Button>
            
            <Button 
              variant="outline" 
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Relatório de leitos vagos
            </Button>
            
            <Button 
              variant="outline" 
              className="flex items-center gap-2"
            >
              <Activity className="h-4 w-4" />
              Boletim diário
            </Button>

            <Button 
              variant="outline" 
              className="flex items-center gap-2"
            >
              <Settings2 className="h-4 w-4" />
              Reservas de leitos
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Mapa de Leitos Principal */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Map className="h-5 w-5 text-primary" />
            Mapa de Leitos
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <MapaLeitosPanel />
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
    </div>
  );
};

export default MapaLeitosPage;