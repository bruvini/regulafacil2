import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Wrench, 
  Download, 
  Upload,
  Settings2,
  Activity,
  Map,
  RotateCcw,
  AlertTriangle
} from 'lucide-react';
import { 
  getSetoresCollection, 
  getLeitosCollection,
  getPacientesCollection,
  getInfeccoesCollection,
  onSnapshot,
  getDocs,
  writeBatch,
  doc,
  db,
  arrayUnion,
  serverTimestamp
} from '@/lib/firebase';
import { logAction } from '@/lib/auditoria';
import { toast } from '@/components/ui/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
    infeccoes: [],
    loading: true
  });

  const [showGerenciamentoModal, setShowGerenciamentoModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showRelatorioIsolamentosModal, setShowRelatorioIsolamentosModal] = useState(false);
  const [showRelatorioLeitosVagosModal, setShowRelatorioLeitosVagosModal] = useState(false);
  const [showReservasLeitosModal, setShowReservasLeitosModal] = useState(false);
  const [showResetLeitosDialog, setShowResetLeitosDialog] = useState(false);

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

  // Função para resetar todos os leitos
  const handleResetarLeitos = async () => {
    try {
      console.log('MapaLeitosPage: Iniciando reset de leitos...');
      const leitosSnapshot = await getDocs(getLeitosCollection());
      const batch = writeBatch(db);
      let leitosResetados = 0;

      leitosSnapshot.forEach((leitoDoc) => {
        const leitoData = leitoDoc.data();
        const historicoMovimentacao = leitoData.historicoMovimentacao || [];
        
        // Verificar o último status do leito
        const ultimoStatus = historicoMovimentacao.length > 0 
          ? historicoMovimentacao[historicoMovimentacao.length - 1].statusLeito 
          : 'Vago';

        // Se não estiver vago, resetar para vago
        if (ultimoStatus !== 'Vago') {
          console.log(`MapaLeitosPage: Resetando leito ${leitoData.codigoLeito} de ${ultimoStatus} para Vago`);
          batch.update(leitoDoc.ref, {
            historicoMovimentacao: arrayUnion({
              statusLeito: 'Vago',
              dataHora: serverTimestamp(),
              usuario: 'Sistema - Reset de Leitos',
              observacao: `Status anterior: ${ultimoStatus}`
            })
          });
          leitosResetados++;
        }
      });

      if (leitosResetados > 0) {
        console.log(`MapaLeitosPage: Executando batch commit para ${leitosResetados} leitos...`);
        await batch.commit();

        await logAction('Mapa de Leitos', `RESET DE LEITOS EXECUTADO: ${leitosResetados} leitos foram marcados como Vago.`);
        
        toast({
          title: "Reset Concluído",
          description: `${leitosResetados} leitos foram marcados como Vago.`,
        });
      } else {
        toast({
          title: "Nenhuma Alteração",
          description: "Todos os leitos já estão vagos.",
        });
      }

      setShowResetLeitosDialog(false);
    } catch (error) {
      console.error('Erro no reset de leitos:', error);
      toast({
        title: "Erro",
        description: "Erro ao executar reset de leitos.",
        variant: "destructive",
      });
    }
  };

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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
              onClick={() => setShowGerenciamentoModal(true)}
            >
              <Settings2 className="h-4 w-4" />
              Gerenciar leitos
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
              onClick={() => setShowRelatorioIsolamentosModal(true)}
            >
              <Activity className="h-4 w-4" />
              Relatório de isolamentos
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
              onClick={() => setShowRelatorioLeitosVagosModal(true)}
            >
              <Download className="h-4 w-4" />
              Relatório de leitos vagos
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <Activity className="h-4 w-4" />
              Boletim diário
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
              onClick={() => setShowReservasLeitosModal(true)}
            >
              <Settings2 className="h-4 w-4" />
              Reservas de leitos
            </Button>

            <Button
              variant="destructive"
              size="sm"
              className="flex items-center gap-2"
              onClick={() => setShowResetLeitosDialog(true)}
            >
              <RotateCcw className="h-4 w-4" />
              Resetar Leitos
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
      
      <RelatorioLeitosVagosModal 
        isOpen={showRelatorioLeitosVagosModal} 
        onClose={() => setShowRelatorioLeitosVagosModal(false)} 
      />

      <ReservasLeitosModal 
        isOpen={showReservasLeitosModal} 
        onClose={() => setShowReservasLeitosModal(false)} 
      />

      {/* Dialog de Confirmação para Reset de Leitos */}
      <AlertDialog open={showResetLeitosDialog} onOpenChange={setShowResetLeitosDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Resetar Todos os Leitos
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação irá marcar <strong>todos os leitos ocupados, reservados ou regulados</strong> como "Vago".
              <br /><br />
              Esta operação não pode ser desfeita. Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResetarLeitos}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Resetar Leitos
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default MapaLeitosPage;