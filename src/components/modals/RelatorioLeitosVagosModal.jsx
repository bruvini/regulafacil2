import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Copy, Loader2 } from 'lucide-react';
import { 
  getSetoresCollection, 
  getLeitosCollection, 
  getQuartosCollection,
  getPacientesCollection,
  onSnapshot
} from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';

const RelatorioLeitosVagosModal = ({ isOpen, onClose }) => {
  const { toast } = useToast();
  const [dados, setDados] = useState({
    setores: [],
    leitos: [],
    quartos: [],
    pacientes: [],
    loading: true
  });

  // Buscar dados do Firestore
  useEffect(() => {
    if (!isOpen) return;

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
      setDados(prev => ({ ...prev, pacientes: pacientesData, loading: false }));
    });
    unsubscribes.push(unsubPacientes);

    return () => {
      unsubscribes.forEach(unsubscribe => unsubscribe());
    };
  }, [isOpen]);

  // Processar dados e aplicar lógica de coorte
  const dadosProcessados = useMemo(() => {
    if (dados.loading) return {};

    const { setores, leitos, quartos, pacientes } = dados;

    // Criar mapa de pacientes por leito
    const pacientesPorLeito = {};
    pacientes.forEach(paciente => {
      if (paciente.leitoId) {
        pacientesPorLeito[paciente.leitoId] = paciente;
      }
    });

    // Filtrar setores elegíveis (Enfermaria e UTI)
    const setoresElegiveis = setores.filter(setor => 
      setor.tipoSetor === 'Enfermaria' || setor.tipoSetor === 'UTI'
    );

    const estruturarPorSetor = {};

    setoresElegiveis.forEach(setor => {
      // Buscar leitos vagos ou em higienização deste setor
      const leitosVagos = leitos
        .filter(leito => 
          leito.setorId === setor.id && 
          (leito.status === 'Vago' || leito.status === 'Higienização') &&
          !pacientesPorLeito[leito.id] // Garantir que não tem paciente
        )
        .map(leito => {
          const leitoEnriquecido = {
            ...leito,
            contextoQuarto: null
          };

          // Aplicar lógica de coorte
          if (leito.quartoId) {
            const quartoDoLeito = quartos.find(q => q.id === leito.quartoId);
            if (quartoDoLeito && quartoDoLeito.leitosIds) {
              // Encontrar companheiros de quarto ocupados
              const companheirosDeQuarto = quartoDoLeito.leitosIds
                .map(leitoId => pacientesPorLeito[leitoId])
                .filter(paciente => paciente != null);

              if (companheirosDeQuarto.length > 0) {
                const primeiroCompanheiro = companheirosDeQuarto[0];
                const sexoQuarto = primeiroCompanheiro.sexo === 'M' ? 'Masculino' : 'Feminino';
                
                // Coletar isolamentos únicos
                const isolamentosQuarto = [];
                if (primeiroCompanheiro.isolamentos && Array.isArray(primeiroCompanheiro.isolamentos)) {
                  primeiroCompanheiro.isolamentos.forEach(isolamento => {
                    if (isolamento.siglaInfeccao && !isolamentosQuarto.find(i => i.sigla === isolamento.siglaInfeccao)) {
                      isolamentosQuarto.push({
                        sigla: isolamento.siglaInfeccao,
                        nome: isolamento.nomeInfeccao || isolamento.siglaInfeccao
                      });
                    }
                  });
                }

                leitoEnriquecido.contextoQuarto = {
                  sexo: sexoQuarto,
                  isolamentos: isolamentosQuarto.sort((a, b) => a.sigla.localeCompare(b.sigla))
                };
              }
            }
          }

          return leitoEnriquecido;
        })
        .sort((a, b) => a.codigoLeito.localeCompare(b.codigoLeito));

      if (leitosVagos.length > 0) {
        estruturarPorSetor[setor.id] = {
          nomeSetor: setor.nomeSetor,
          leitosVagos
        };
      }
    });

    return estruturarPorSetor;
  }, [dados]);

  const gerarMensagemWhatsApp = (nomeSetor, leitosVagos) => {
    let mensagem = `*Verificação de disponibilidade de leitos - ${nomeSetor}*\n\n`;
    mensagem += `Poderia nos dar a informação dos leitos abaixo?\n`;
    
    leitosVagos.forEach(leito => {
      let statusDetalhado = leito.status;
      let infoAdicional = '';
      
      if (leito.contextoQuarto) {
        infoAdicional = ` - Leito ${leito.contextoQuarto.sexo}`;
        if (leito.contextoQuarto.isolamentos.length > 0) {
          statusDetalhado = `Isolamento por Coorte: ${leito.contextoQuarto.isolamentos.map(i => i.sigla).join(', ')}`;
        }
      }
      
      mensagem += `_${leito.codigoLeito}${infoAdicional} - Status: ${statusDetalhado}_\n`;
    });
    
    mensagem += `\n_Se houver outros leitos vagos, com alta provável ou alta no leito, nos informar também._`;
    
    return mensagem;
  };

  const copiarMensagem = async (nomeSetor, leitosVagos) => {
    try {
      const mensagem = gerarMensagemWhatsApp(nomeSetor, leitosVagos);
      await navigator.clipboard.writeText(mensagem);
      
      toast({
        title: "Mensagem copiada!",
        description: `Mensagem para ${nomeSetor} copiada para a área de transferência.`,
      });
    } catch (error) {
      console.error('Erro ao copiar mensagem:', error);
      toast({
        title: "Erro",
        description: "Erro ao copiar mensagem. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const renderStatusDetalhado = (leito) => {
    if (leito.contextoQuarto) {
      const isolamentos = leito.contextoQuarto.isolamentos;
      if (isolamentos.length > 0) {
        return `Isolamento por Coorte: ${isolamentos.map(i => i.sigla).join(', ')}`;
      }
    }
    return leito.status;
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Relatório de Leitos Vagos</DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh] overflow-y-auto">
          {dados.loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span>Carregando relatório...</span>
            </div>
          ) : Object.keys(dadosProcessados).length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                Nenhum leito vago encontrado em enfermarias e UTIs.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-4">
              {Object.values(dadosProcessados).map(setor => (
                <div key={setor.nomeSetor} className="border border-gray-200 rounded-lg p-4">
                  {/* Cabeçalho do setor com botão de copiar */}
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-gray-900">
                      {setor.nomeSetor}
                    </h3>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex items-center gap-2"
                      onClick={() => copiarMensagem(setor.nomeSetor, setor.leitosVagos)}
                    >
                      <Copy className="h-4 w-4" />
                      Copiar
                    </Button>
                  </div>

                  {/* Lista de leitos */}
                  {setor.leitosVagos.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">
                      Nenhum leito disponível neste setor.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {setor.leitosVagos.map(leito => (
                        <div key={leito.id} className="bg-gray-50 p-3 rounded border">
                          <div className="font-medium text-sm">
                            {leito.codigoLeito}
                            {leito.contextoQuarto && (
                              <span className="ml-2 text-blue-700">
                                - Leito {leito.contextoQuarto.sexo}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-600 mt-1">
                            <strong>Status:</strong> {renderStatusDetalhado(leito)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RelatorioLeitosVagosModal;