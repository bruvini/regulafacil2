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

    const { setores, leitos, pacientes } = dados;

    const pacientesPorLeito = {};
    pacientes.forEach(paciente => {
      if (paciente.leitoId) {
        pacientesPorLeito[paciente.leitoId] = paciente;
      }
    });

    const leitosPorQuarto = {};
    leitos.forEach(leitoAtual => {
      if (!leitoAtual.quartoId) return;
      if (!leitosPorQuarto[leitoAtual.quartoId]) {
        leitosPorQuarto[leitoAtual.quartoId] = [];
      }
      leitosPorQuarto[leitoAtual.quartoId].push(leitoAtual);
    });

    const setoresElegiveis = setores.filter(setor =>
      setor.tipoSetor === 'Enfermaria' || setor.tipoSetor === 'UTI'
    );

    const estruturarPorSetor = {};

    const normalizarSexo = (valor) => {
      if (!valor) return null;
      const texto = String(valor).trim().toUpperCase();
      if (texto.startsWith('M')) return 'Masculino';
      if (texto.startsWith('F')) return 'Feminino';
      return null;
    };

    const normalizarIdentificadorIsolamento = (valor) => {
      if (!valor) return null;
      const texto = String(valor).trim();
      return texto.length > 0 ? texto : null;
    };

    setoresElegiveis.forEach(setor => {
    const leitosVagos = leitos
      .filter(leito =>
        leito.setorId === setor.id &&
        ((leito.statusLeito === 'Vago' || leito.statusLeito === 'Higienização') || 
         (leito.status === 'Vago' || leito.status === 'Higienização')) &&
        !pacientesPorLeito[leito.id]
      )
        .map(leito => {
          let sexoCompativel = 'Ambos';
          let isolamentoExigido = null;
          let isolamentosSiglas = [];

          if (leito.quartoId) {
            const leitosDoQuarto = leitosPorQuarto[leito.quartoId] || [];
            const leitosOcupados = leitosDoQuarto.filter(outro =>
              outro.id !== leito.id && outro.status === 'Ocupado'
            );

            if (leitosOcupados.length > 0) {
              const ocupantes = leitosOcupados
                .map(outro => pacientesPorLeito[outro.id])
                .filter(paciente => paciente != null);

              if (ocupantes.length > 0) {
                const primeiroOcupante = ocupantes[0];
                const sexoOcupante = normalizarSexo(primeiroOcupante.sexo);
                if (sexoOcupante) {
                  sexoCompativel = sexoOcupante;
                }

                const idsIsolamentos = new Set();
                const siglasIsolamentos = new Set();

                ocupantes.forEach(pacienteOcupante => {
                  (pacienteOcupante.isolamentos || []).forEach(isolamento => {
                    const identificador = normalizarIdentificadorIsolamento(
                      isolamento.infeccaoId || isolamento.id || isolamento.siglaInfeccao
                    );
                    if (identificador) {
                      idsIsolamentos.add(identificador);
                    }

                    if (isolamento.siglaInfeccao) {
                      siglasIsolamentos.add(String(isolamento.siglaInfeccao).trim().toUpperCase());
                    }
                  });
                });

                if (idsIsolamentos.size > 0) {
                  isolamentoExigido = Array.from(idsIsolamentos)
                    .sort((a, b) => a.localeCompare(b))
                    .join('-');
                }

                if (siglasIsolamentos.size > 0) {
                  isolamentosSiglas = Array.from(siglasIsolamentos)
                    .sort((a, b) => a.localeCompare(b));
                }
              }
            }
          }

          return {
            ...leito,
            sexoCompativel,
            isolamentoExigido,
            isolamentosSiglas
          };
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
      const sexoInfo =
        leito.sexoCompativel && leito.sexoCompativel !== 'Ambos'
          ? ` (${leito.sexoCompativel})`
          : '';

      const statusDetalhado = leito.status;
      const isolamentoInfo =
        leito.isolamentosSiglas && leito.isolamentosSiglas.length > 0
          ? ` | Isolamento: ${leito.isolamentosSiglas.join(', ')}`
          : '';

      mensagem += `_${leito.codigoLeito}${sexoInfo} - Status: ${statusDetalhado}${isolamentoInfo}_\n`;
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
          ) : Object.keys(dadosProcessados).length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                Nenhum leito vago encontrado em enfermarias e UTIs.
              </p>
            </div>
          ) : (
            <div className="space-y-6 p-4">
              {Object.values(dadosProcessados).map(setor => (
                <div key={setor.nomeSetor} className="overflow-hidden rounded-lg border">
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
                              <div className="flex flex-col gap-1">
                                {leito.sexoCompativel && leito.sexoCompativel !== 'Ambos' && (
                                  <Badge variant="secondary" className="w-fit">
                                    {leito.sexoCompativel}
                                  </Badge>
                                )}
                                {leito.isolamentosSiglas && leito.isolamentosSiglas.length > 0 && (
                                  <span className="text-xs font-semibold text-destructive">
                                    Isolamento: {leito.isolamentosSiglas.join(', ')}
                                  </span>
                                )}
                              </div>
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