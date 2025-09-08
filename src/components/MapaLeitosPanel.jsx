import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { ChevronDown, MoreVertical, Loader2 } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  getSetoresCollection, 
  getLeitosCollection, 
  getQuartosCollection, 
  onSnapshot 
} from '@/lib/firebase';

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

// Componente LeitoCard
const LeitoCard = ({ leito }) => {
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

  // Só renderiza leitos com status "Vago"
  if (leito.status !== 'Vago') {
    return null;
  }

  return (
    <Card className="bg-white border-2 border-blue-200 hover:border-blue-300 transition-colors shadow-sm">
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
              <DropdownMenuItem>
                INTERNAR PACIENTE MANUALMENTE
              </DropdownMenuItem>
              <DropdownMenuItem>
                BLOQUEAR LEITO
              </DropdownMenuItem>
              <DropdownMenuItem>
                SOLICITAR HIGIENIZAÇÃO
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Conteúdo do card */}
        <div className="space-y-3">
          <div>
            <h4 className="font-semibold text-sm text-gray-900">
              Leito: {leito.codigoLeito}
            </h4>
            {leito.isPCP && (
              <Badge variant="secondary" className="text-xs mt-1">
                PCP
              </Badge>
            )}
          </div>

          <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">
            {leito.status}
          </Badge>

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
                              <LeitoCard key={leito.id} leito={leito} />
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
                              <LeitoCard key={leito.id} leito={leito} />
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
    </div>
  );
};

export default MapaLeitosPanel;