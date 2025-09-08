import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Search } from 'lucide-react';

const MoverPacienteModal = ({ isOpen, onClose, onMove, paciente, leito, dadosEstruturados }) => {
  const [busca, setBusca] = useState('');
  const [leitoSelecionado, setLeitoSelecionado] = useState(null);

  // Filtrar leitos disponíveis
  const leitosDisponiveis = useMemo(() => {
    if (!dadosEstruturados) return [];

    const leitos = [];
    Object.entries(dadosEstruturados).forEach(([tipoSetor, setores]) => {
      setores.forEach(setor => {
        // Leitos sem quarto
        setor.leitosSemQuarto?.forEach(leitoItem => {
          if ((leitoItem.status === 'Vago' || leitoItem.status === 'Higienização') && leitoItem.id !== leito?.id) {
            leitos.push({
              ...leitoItem,
              nomeSetor: setor.nomeSetor,
              tipoSetor,
              nomeQuarto: null
            });
          }
        });

        // Leitos em quartos
        setor.quartos?.forEach(quarto => {
          quarto.leitos?.forEach(leitoItem => {
            if ((leitoItem.status === 'Vago' || leitoItem.status === 'Higienização') && leitoItem.id !== leito?.id) {
              leitos.push({
                ...leitoItem,
                nomeSetor: setor.nomeSetor,
                tipoSetor,
                nomeQuarto: quarto.nomeQuarto
              });
            }
          });
        });
      });
    });

    return leitos;
  }, [dadosEstruturados, leito]);

  // Filtrar leitos pela busca
  const leitosFiltrados = useMemo(() => {
    if (!busca) return leitosDisponiveis;
    
    const termoBusca = busca.toLowerCase();
    return leitosDisponiveis.filter(leitoItem =>
      leitoItem.codigoLeito?.toLowerCase().includes(termoBusca) ||
      leitoItem.nomeSetor?.toLowerCase().includes(termoBusca) ||
      leitoItem.nomeQuarto?.toLowerCase().includes(termoBusca)
    );
  }, [leitosDisponiveis, busca]);

  // Agrupar leitos por setor
  const leitosPorSetor = useMemo(() => {
    const grupos = {};
    leitosFiltrados.forEach(leitoItem => {
      const chave = `${leitoItem.tipoSetor} - ${leitoItem.nomeSetor}`;
      if (!grupos[chave]) {
        grupos[chave] = [];
      }
      grupos[chave].push(leitoItem);
    });
    return grupos;
  }, [leitosFiltrados]);

  const handleMove = () => {
    if (leitoSelecionado) {
      onMove(leitoSelecionado);
      setLeitoSelecionado(null);
      setBusca('');
    }
  };

  const handleClose = () => {
    setLeitoSelecionado(null);
    setBusca('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Mover Paciente</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 flex-1 overflow-hidden">
          <div>
            <p className="text-sm text-muted-foreground">
              Movendo paciente <strong>{paciente?.nomePaciente}</strong> do leito <strong>{leito?.codigoLeito}</strong>
            </p>
          </div>

          {/* Busca */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Buscar leito por código, setor ou quarto..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Lista de leitos disponíveis */}
          <div className="flex-1 overflow-y-auto space-y-4">
            {Object.entries(leitosPorSetor).map(([nomeSetor, leitosDoSetor]) => (
              <div key={nomeSetor} className="space-y-2">
                <h4 className="font-medium text-sm text-gray-700 sticky top-0 bg-background py-1">
                  {nomeSetor} ({leitosDoSetor.length} disponível{leitosDoSetor.length !== 1 ? 'eis' : ''})
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {leitosDoSetor.map(leitoItem => (
                    <Card 
                      key={leitoItem.id}
                      className={`cursor-pointer transition-all ${
                        leitoSelecionado?.id === leitoItem.id 
                          ? 'ring-2 ring-primary bg-primary/5' 
                          : 'hover:shadow-md'
                      }`}
                      onClick={() => setLeitoSelecionado(leitoItem)}
                    >
                      <CardContent className="p-3">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm">{leitoItem.codigoLeito}</span>
                            <Badge 
                              variant="outline" 
                              className={
                                leitoItem.status === 'Vago' 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-yellow-100 text-yellow-800'
                              }
                            >
                              {leitoItem.status}
                            </Badge>
                          </div>
                          {leitoItem.nomeQuarto && (
                            <p className="text-xs text-muted-foreground">
                              Quarto: {leitoItem.nomeQuarto}
                            </p>
                          )}
                          {leitoItem.isPCP && (
                            <Badge variant="secondary" className="text-xs">
                              PCP
                            </Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {leitosFiltrados.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              {busca ? 'Nenhum leito encontrado para a busca.' : 'Nenhum leito disponível no momento.'}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button 
            onClick={handleMove}
            disabled={!leitoSelecionado}
          >
            Mover Paciente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MoverPacienteModal;