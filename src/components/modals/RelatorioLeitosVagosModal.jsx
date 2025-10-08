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
  getInfeccoesCollection,
  onSnapshot
} from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { getLeitosVagosPorSetor } from '@/lib/leitosDisponiveisUtils';

const RelatorioLeitosVagosModal = ({ isOpen, onClose }) => {
  const { toast } = useToast();
  const [dados, setDados] = useState({
    setores: [],
    leitos: [],
    quartos: [],
    pacientes: [],
    loading: true
  });
  const [infeccoes, setInfeccoes] = useState([]);

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

    const unsubInfeccoes = onSnapshot(getInfeccoesCollection(), (snapshot) => {
      const infeccoesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setInfeccoes(infeccoesData);
    });
    unsubscribes.push(unsubInfeccoes);

    return () => {
      unsubscribes.forEach(unsubscribe => unsubscribe());
    };
  }, [isOpen]);

  const setoresComLeitosVagos = useMemo(() => {
    if (dados.loading) return [];

    return getLeitosVagosPorSetor({
      setores: dados.setores,
      leitos: dados.leitos,
      quartos: dados.quartos,
      pacientes: dados.pacientes,
      infeccoes,
    });
  }, [dados, infeccoes]);

  const gerarMensagemWhatsApp = (nomeSetor, leitosVagos) => {
    let mensagem = `*Verificação de disponibilidade de leitos - ${nomeSetor}*\n\n`;
    mensagem += `Poderia nos dar a informação dos leitos abaixo?\n`;
    
    leitosVagos.forEach(leito => {
      const statusDetalhado = leito.status;
      const restricaoInfo = leito.compatibilidade !== 'Livre'
        ? ` | Coorte: ${leito.compatibilidade}`
        : '';

      mensagem += `_${leito.codigoLeito} - Status: ${statusDetalhado}${restricaoInfo}_\n`;
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
          ) : setoresComLeitosVagos.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                Nenhum leito vago encontrado em enfermarias e UTIs.
              </p>
            </div>
          ) : (
            <div className="space-y-6 p-4">
              {setoresComLeitosVagos.map(setor => (
                <div key={setor.id} className="overflow-hidden rounded-lg border">
                  <div className="flex items-center justify-between bg-muted px-4 py-3">
                    <h3 className="text-base font-semibold text-foreground">
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

                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-border text-sm">
                      <thead className="bg-muted/60">
                        <tr>
                          <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                            Leito
                          </th>
                          <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                            Status
                          </th>
                          <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                            Compatibilidade
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border bg-background">
                        {setor.leitosVagos.map(leito => (
                          <tr key={leito.id} className="align-top">
                            <td className="px-4 py-3">
                              <div className="font-medium text-foreground">{leito.codigoLeito}</div>
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant={leito.status === 'Higienização' ? 'secondary' : 'outline'}>
                                {leito.status}
                              </Badge>
                            </td>
                            <td className="px-4 py-3">
                              {leito.compatibilidade !== 'Livre' ? (
                                <span className="text-xs font-semibold text-blue-700">
                                  {leito.compatibilidade}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">Livre</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
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