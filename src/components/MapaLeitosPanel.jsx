import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { ChevronDown, MoreVertical, Loader2, Flame, Star } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  getSetoresCollection, 
  getLeitosCollection, 
  getQuartosCollection, 
  onSnapshot,
  doc,
  updateDoc,
  arrayUnion,
  serverTimestamp,
  deleteField
} from '@/lib/firebase';
import { logAction } from '@/lib/auditoria';
import { useToast } from '@/hooks/use-toast';

// Color mapping for sector types
const getSectorTypeColor = (tipoSetor) => {
  const colorMap = {
    'Emergência': 'border-t-4 border-red-500',
    'UTI': 'border-t-4 border-yellow-500', 
    'Enfermaria': 'border-t-4 border-green-500',
    'Centro Cirúrgico': 'border-t-4 border-purple-500'
  };
  return colorMap[tipoSetor] || 'border-t-4 border-gray-500';
};

// Componente LeitoCard Dinâmico
const LeitoCard = ({ leito, onBloquearLeito, onSolicitarHigienizacao, onDesbloquearLeito, onFinalizarHigienizacao, onPriorizarHigienizacao }) => {
  const { toast } = useToast();

  const getTempoNoStatus = () => {
    if (!leito.historico || leito.historico.length === 0) {
      return 'sem histórico';
    }

    const ultimoRegistro = leito.historico[leito.historico.length - 1];
    if (!ultimoRegistro.timestamp) {
      return 'sem timestamp';
    }

    try {
      const timestamp = ultimoRegistro.timestamp.toDate 
        ? ultimoRegistro.timestamp.toDate() 
        : new Date(ultimoRegistro.timestamp);
      
      return formatDistanceToNow(timestamp, { 
        addSuffix: true, 
        locale: ptBR 
      });
    } catch (error) {
      return 'tempo indisponível';
    }
  };

  const getCardStyle = () => {
    switch (leito.status) {
      case 'Vago':
        return "bg-white border-2 border-blue-200 hover:border-blue-300 transition-colors shadow-sm";
      case 'Bloqueado':
        return "bg-gray-50 border-2 border-gray-300 hover:border-gray-400 transition-colors shadow-sm";
      case 'Higienização':
        return "bg-yellow-50 border-2 border-yellow-300 hover:border-yellow-400 transition-colors shadow-sm";
      default:
        return "bg-white border-2 border-gray-200 hover:border-gray-300 transition-colors shadow-sm";
    }
  };

  const getBadgeStyle = () => {
    switch (leito.status) {
      case 'Vago':
        return "bg-green-100 text-green-800 border-green-200";
      case 'Bloqueado':
        return "bg-gray-100 text-gray-800 border-gray-200";
      case 'Higienização':
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const renderActions = () => {
    switch (leito.status) {
      case 'Vago':
        return (
          <>
            <DropdownMenuItem disabled className="opacity-50">
              INTERNAR PACIENTE MANUALMENTE
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onBloquearLeito(leito)}>
              BLOQUEAR LEITO
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSolicitarHigienizacao(leito)}>
              SOLICITAR HIGIENIZAÇÃO
            </DropdownMenuItem>
          </>
        );
      case 'Bloqueado':
        return (
          <DropdownMenuItem onClick={() => onDesbloquearLeito(leito)}>
            DESBLOQUEAR LEITO
          </DropdownMenuItem>
        );
      case 'Higienização':
        return (
          <>
            <DropdownMenuItem onClick={() => onFinalizarHigienizacao(leito)}>
              FINALIZAR HIGIENIZAÇÃO
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onPriorizarHigienizacao(leito)}>
              {leito.higienizacaoPrioritaria ? 'REMOVER PRIORIDADE' : 'PRIORIZAR HIGIENIZAÇÃO'}
            </DropdownMenuItem>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <Card className={getCardStyle()}>
      <CardContent className="p-4 relative">
        {/* Dropdown de ações */}
        <div className="absolute top-2 right-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <MoreVertical className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {renderActions()}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Conteúdo do card */}
        <div className="space-y-3">
          <div>
            <h4 className="font-semibold text-sm text-gray-900">
              Leito: {leito.codigoLeito}
            </h4>
            <div className="flex items-center gap-1 mt-1">
              {leito.isPCP && (
                <Badge variant="secondary" className="text-xs">
                  PCP
                </Badge>
              )}
              {leito.status === 'Higienização' && leito.higienizacaoPrioritaria && (
                <Badge variant="destructive" className="text-xs flex items-center gap-1">
                  <Flame className="h-3 w-3" />
                  Prioridade
                </Badge>
              )}
            </div>
          </div>

          <Badge variant="outline" className={getBadgeStyle()}>
            {leito.status}
          </Badge>

          {/* Informações específicas por status */}
          {leito.status === 'Bloqueado' && leito.motivoBloqueio && (
            <div className="text-xs text-gray-600 bg-gray-100 p-2 rounded">
              <strong>Motivo:</strong> {leito.motivoBloqueio}
            </div>
          )}

          <div className="text-xs text-muted-foreground">
            {getTempoNoStatus()}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Componente principal MapaLeitosPanel
const MapaLeitosPanel = () => {
  const [setores, setSetores] = useState([]);
  const [quartos, setQuartos] = useState([]);
  const [leitos, setLeitos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState({});
  const [expandedSetores, setExpandedSetores] = useState({});
  
  // Estados dos modais
  const [modalBloquear, setModalBloquear] = useState({ open: false, leito: null });
  const [modalHigienizacao, setModalHigienizacao] = useState({ open: false, leito: null });
  const [modalDesbloquear, setModalDesbloquear] = useState({ open: false, leito: null });
  const [modalFinalizarHigienizacao, setModalFinalizarHigienizacao] = useState({ open: false, leito: null });
  const [motivoBloqueio, setMotivoBloqueio] = useState('');
  
  const { toast } = useToast();

  // Funções de ação dos leitos
  const handleBloquearLeito = async () => {
    if (!modalBloquear.leito || !motivoBloqueio.trim()) return;
    
    try {
      const leitoRef = doc(getLeitosCollection(), modalBloquear.leito.id);
      await updateDoc(leitoRef, {
        status: 'Bloqueado',
        motivoBloqueio: motivoBloqueio.trim(),
        historico: arrayUnion({
          status: 'Bloqueado',
          timestamp: serverTimestamp()
        })
      });
      await logAction('Mapa de Leitos', `Leito '${modalBloquear.leito.codigoLeito}' foi bloqueado. Motivo: '${motivoBloqueio.trim()}'.`);
      
      toast({
        title: "Leito bloqueado",
        description: `Leito ${modalBloquear.leito.codigoLeito} foi bloqueado com sucesso.`,
      });
      
      setModalBloquear({ open: false, leito: null });
      setMotivoBloqueio('');
    } catch (error) {
      console.error('Erro ao bloquear leito:', error);
      toast({
        title: "Erro",
        description: "Erro ao bloquear o leito. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleSolicitarHigienizacao = async (leito) => {
    try {
      const leitoRef = doc(getLeitosCollection(), leito.id);
      await updateDoc(leitoRef, {
        status: 'Higienização',
        higienizacaoPrioritaria: false,
        historico: arrayUnion({
          status: 'Higienização',
          timestamp: serverTimestamp()
        })
      });
      await logAction('Mapa de Leitos', `Solicitada higienização para o leito '${leito.codigoLeito}'.`);
      
      toast({
        title: "Higienização solicitada",
        description: `Higienização do leito ${leito.codigoLeito} foi solicitada.`,
      });
      
      setModalHigienizacao({ open: false, leito: null });
    } catch (error) {
      console.error('Erro ao solicitar higienização:', error);
      toast({
        title: "Erro",
        description: "Erro ao solicitar higienização. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleDesbloquearLeito = async (leito) => {
    try {
      const leitoRef = doc(getLeitosCollection(), leito.id);
      await updateDoc(leitoRef, {
        status: 'Vago',
        motivoBloqueio: deleteField(),
        historico: arrayUnion({
          status: 'Vago',
          timestamp: serverTimestamp()
        })
      });
      await logAction('Mapa de Leitos', `Leito '${leito.codigoLeito}' foi desbloqueado.`);
      
      toast({
        title: "Leito desbloqueado",
        description: `Leito ${leito.codigoLeito} foi desbloqueado com sucesso.`,
      });
      
      setModalDesbloquear({ open: false, leito: null });
    } catch (error) {
      console.error('Erro ao desbloquear leito:', error);
      toast({
        title: "Erro",
        description: "Erro ao desbloquear o leito. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleFinalizarHigienizacao = async (leito) => {
    try {
      const leitoRef = doc(getLeitosCollection(), leito.id);
      await updateDoc(leitoRef, {
        status: 'Vago',
        higienizacaoPrioritaria: deleteField(),
        historico: arrayUnion({
          status: 'Vago',
          timestamp: serverTimestamp()
        })
      });
      await logAction('Mapa de Leitos', `Higienização do leito '${leito.codigoLeito}' foi finalizada.`);
      
      toast({
        title: "Higienização finalizada",
        description: `Higienização do leito ${leito.codigoLeito} foi finalizada.`,
      });
      
      setModalFinalizarHigienizacao({ open: false, leito: null });
    } catch (error) {
      console.error('Erro ao finalizar higienização:', error);
      toast({
        title: "Erro",
        description: "Erro ao finalizar higienização. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handlePriorizarHigienizacao = async (leito) => {
    try {
      const leitoRef = doc(getLeitosCollection(), leito.id);
      await updateDoc(leitoRef, {
        higienizacaoPrioritaria: !leito.higienizacaoPrioritaria
      });
      await logAction('Mapa de Leitos', !leito.higienizacaoPrioritaria
        ? `Higienização do leito '${leito.codigoLeito}' foi marcada como prioritária.`
        : `Prioridade de higienização do leito '${leito.codigoLeito}' foi removida.`
      );
      
      toast({
        title: leito.higienizacaoPrioritaria ? "Prioridade removida" : "Higienização priorizada",
        description: `Leito ${leito.codigoLeito} ${leito.higienizacaoPrioritaria ? 'não é mais' : 'agora é'} prioritário.`,
      });
    } catch (error) {
      console.error('Erro ao alterar prioridade:', error);
      toast({
        title: "Erro",
        description: "Erro ao alterar prioridade. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  // Buscar dados do Firestore em tempo real
  useEffect(() => {
    const unsubscribeSetores = onSnapshot(getSetoresCollection(), (snapshot) => {
      const setoresData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setSetores(setoresData);
    });

    const unsubscribeQuartos = onSnapshot(getQuartosCollection(), (snapshot) => {
      const quartosData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setQuartos(quartosData);
    });

    const unsubscribeLeitos = onSnapshot(getLeitosCollection(), (snapshot) => {
      const leitosData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setLeitos(leitosData);
      setLoading(false);
    });

    return () => {
      unsubscribeSetores();
      unsubscribeQuartos();
      unsubscribeLeitos();
    };
  }, []);

  // Processar dados em estrutura hierárquica
  const dadosEstruturados = useMemo(() => {
    if (!setores.length || !leitos.length) return {};

    const estrutura = {};

    // Agrupar por tipo de setor
    setores.forEach(setor => {
      const tipoSetor = setor.tipoSetor || 'Outros';
      
      if (!estrutura[tipoSetor]) {
        estrutura[tipoSetor] = [];
      }

      // Buscar quartos deste setor
      const quartosDoSetor = quartos
        .filter(quarto => quarto.setorId === setor.id)
        .sort((a, b) => a.nomeQuarto.localeCompare(b.nomeQuarto)); // Sort rooms by name
      
      // Buscar leitos deste setor
      const leitosDoSetor = leitos
        .filter(leito => leito.setorId === setor.id)
        .sort((a, b) => a.codigoLeito.localeCompare(b.codigoLeito)); // Sort beds by code

      // Separar leitos em quartos e sem quarto
      const leitosComQuarto = [];
      const leitosSemQuarto = [...leitosDoSetor];

      const quartosComLeitos = quartosDoSetor.map(quarto => {
        const leitosDoQuarto = leitosDoSetor
          .filter(leito => quarto.leitosIds && quarto.leitosIds.includes(leito.id))
          .sort((a, b) => a.codigoLeito.localeCompare(b.codigoLeito)); // Sort beds by code
        
        // Remover leitos que estão em quartos da lista de leitos sem quarto
        leitosDoQuarto.forEach(leito => {
          const index = leitosSemQuarto.findIndex(l => l.id === leito.id);
          if (index > -1) {
            leitosSemQuarto.splice(index, 1);
          }
        });

        return {
          ...quarto,
          leitos: leitosDoQuarto
        };
      });

      estrutura[tipoSetor].push({
        ...setor,
        quartos: quartosComLeitos,
        leitosSemQuarto: leitosSemQuarto
      });
    });

    return estrutura;
  }, [setores, quartos, leitos]);

  const toggleSection = (tipoSetor) => {
    setExpandedSections(prev => ({
      ...prev,
      [tipoSetor]: !prev[tipoSetor]
    }));
  };

  const toggleSetor = (setorId) => {
    setExpandedSetores(prev => ({
      ...prev,
      [setorId]: !prev[setorId]
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Carregando mapa de leitos...</span>
        </div>
      </div>
    );
  }

  if (Object.keys(dadosEstruturados).length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">
          Nenhum setor ou leito encontrado. Configure os setores e leitos primeiro.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {Object.entries(dadosEstruturados).map(([tipoSetor, setoresDoTipo]) => (
        <div key={tipoSetor} className={`border border-gray-200 rounded-lg ${getSectorTypeColor(tipoSetor)}`}>
          <Collapsible 
            open={expandedSections[tipoSetor] !== false} 
            onOpenChange={() => toggleSection(tipoSetor)}
          >
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-between p-4 h-auto text-left hover:bg-gray-50"
              >
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    {tipoSetor}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {setoresDoTipo.length} setor(es)
                  </p>
                </div>
                <ChevronDown className="h-5 w-5 transition-transform duration-200" />
              </Button>
            </CollapsibleTrigger>
            
            <CollapsibleContent className="p-4 pt-0 space-y-6">
              {setoresDoTipo.map(setor => (
                <div key={setor.id} className="border border-gray-100 rounded-lg">
                  <Collapsible 
                    open={expandedSetores[setor.id] !== false} 
                    onOpenChange={() => toggleSetor(setor.id)}
                  >
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="ghost"
                        className="w-full justify-between p-3 h-auto text-left hover:bg-gray-50"
                      >
                        <div>
                          <h3 className="text-lg font-medium text-gray-800">
                            {setor.nomeSetor} ({setor.siglaSetor})
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {(setor.quartos.length > 0 ? setor.quartos.length + " quarto(s), " : "") + 
                             (setor.leitosSemQuarto.length + setor.quartos.reduce((acc, q) => acc + q.leitos.length, 0)) + " leito(s)"}
                          </p>
                        </div>
                        <ChevronDown className="h-4 w-4 transition-transform duration-200" />
                      </Button>
                    </CollapsibleTrigger>
                    
                    <CollapsibleContent className="p-3 pt-0 space-y-4">
                      {/* Renderizar quartos (não são acordeões, apenas containers) */}
                      {setor.quartos.map(quarto => (
                        <div key={quarto.id} className="bg-gray-50 rounded-lg p-4">
                          <h4 className="text-md font-medium text-gray-700 mb-3 flex items-center gap-2">
                            📋 {quarto.nomeQuarto}
                            <Badge variant="outline" className="text-xs">
                              {quarto.leitos.length} leito(s)
                            </Badge>
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                            {quarto.leitos.map(leito => (
                              <LeitoCard 
                                key={leito.id} 
                                leito={leito}
                                onBloquearLeito={(leito) => setModalBloquear({ open: true, leito })}
                                onSolicitarHigienizacao={(leito) => setModalHigienizacao({ open: true, leito })}
                                onDesbloquearLeito={(leito) => setModalDesbloquear({ open: true, leito })}
                                onFinalizarHigienizacao={(leito) => setModalFinalizarHigienizacao({ open: true, leito })}
                                onPriorizarHigienizacao={handlePriorizarHigienizacao}
                              />
                            ))}
                          </div>
                        </div>
                      ))}

                      {/* Renderizar leitos sem quarto */}
                      {setor.leitosSemQuarto.length > 0 && (
                        <div>
                          <h4 className="text-md font-medium text-gray-700 mb-3 flex items-center gap-2">
                            🏥 Leitos sem quarto
                            <Badge variant="outline" className="text-xs">
                              {setor.leitosSemQuarto.length} leito(s)
                            </Badge>
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                            {setor.leitosSemQuarto.map(leito => (
                              <LeitoCard 
                                key={leito.id} 
                                leito={leito}
                                onBloquearLeito={(leito) => setModalBloquear({ open: true, leito })}
                                onSolicitarHigienizacao={(leito) => setModalHigienizacao({ open: true, leito })}
                                onDesbloquearLeito={(leito) => setModalDesbloquear({ open: true, leito })}
                                onFinalizarHigienizacao={(leito) => setModalFinalizarHigienizacao({ open: true, leito })}
                                onPriorizarHigienizacao={handlePriorizarHigienizacao}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        </div>
      ))}
      
      {/* Modal para Bloquear Leito */}
      <Dialog open={modalBloquear.open} onOpenChange={(open) => setModalBloquear({ open, leito: null })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Bloquear Leito</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Você está prestes a bloquear o leito <strong>{modalBloquear.leito?.codigoLeito}</strong>.
            </p>
            <Textarea
              placeholder="Informe o motivo do bloqueio..."
              value={motivoBloqueio}
              onChange={(e) => setMotivoBloqueio(e.target.value)}
              className="min-h-[100px]"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalBloquear({ open: false, leito: null })}>
              Cancelar
            </Button>
            <Button 
              onClick={handleBloquearLeito}
              disabled={!motivoBloqueio.trim()}
              className="bg-red-600 hover:bg-red-700"
            >
              Confirmar Bloqueio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal para Solicitar Higienização */}
      <AlertDialog open={modalHigienizacao.open} onOpenChange={(open) => setModalHigienizacao({ open, leito: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Solicitar Higienização</AlertDialogTitle>
            <AlertDialogDescription>
              Confirmar solicitação de higienização para o leito <strong>{modalHigienizacao.leito?.codigoLeito}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleSolicitarHigienizacao(modalHigienizacao.leito)}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal para Desbloquear Leito */}
      <AlertDialog open={modalDesbloquear.open} onOpenChange={(open) => setModalDesbloquear({ open, leito: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desbloquear Leito</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja realmente desbloquear o leito <strong>{modalDesbloquear.leito?.codigoLeito}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleDesbloquearLeito(modalDesbloquear.leito)}>
              Desbloquear
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal para Finalizar Higienização */}
      <AlertDialog open={modalFinalizarHigienizacao.open} onOpenChange={(open) => setModalFinalizarHigienizacao({ open, leito: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Finalizar Higienização</AlertDialogTitle>
            <AlertDialogDescription>
              Confirmar a finalização da higienização do leito <strong>{modalFinalizarHigienizacao.leito?.codigoLeito}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleFinalizarHigienizacao(modalFinalizarHigienizacao.leito)}>
              Finalizar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default MapaLeitosPanel;