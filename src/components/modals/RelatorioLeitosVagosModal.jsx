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

  const formatarMensagemRestricaoCoorte = (restricao) => {
    if (!restricao) {
      return '';
    }

    const isolamentos = restricao.isolamentos || [];
    if (isolamentos.length > 0) {
      return `Permitido apenas pacientes do sexo ${restricao.sexo} com isolamento de ${isolamentos.join(', ')}`;
    }

    return `Permitido apenas pacientes do sexo ${restricao.sexo}`;
  };

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

    const { setores, leitos, pacientes, quartos } = dados;

    const pacientesPorLeito = {};
    pacientes.forEach(paciente => {
      if (paciente.leitoId) {
        pacientesPorLeito[paciente.leitoId] = paciente;
      }
    });

    const normalizarSexo = (valor) => {
      if (!valor) return 'Não informado';
      const texto = String(valor).trim().toUpperCase();
      if (texto.startsWith('M')) return 'Masculino';
      if (texto.startsWith('F')) return 'Feminino';
      return 'Não informado';
    };

    const aplicarRestricoesCoorte = (quartosAlvo = []) => {
      quartosAlvo.forEach(quartoAtual => {
        const pacientesOcupantes = quartoAtual.leitos
          .map(leitoQuarto => pacientesPorLeito[leitoQuarto.id])
          .filter(paciente => paciente);

        const possuiOcupantes = pacientesOcupantes.length > 0;
        let restricao = null;

        if (possuiOcupantes) {
          restricao = {
            sexo: normalizarSexo(pacientesOcupantes[0]?.sexo),
            isolamentos: []
          };

          const isolamentosSet = new Set();
          pacientesOcupantes.forEach(pacienteOcupante => {
            (pacienteOcupante.isolamentos || []).forEach(isolamento => {
              const sigla = isolamento?.siglaInfeccao || isolamento?.sigla || isolamento?.nomeInfeccao;
              if (sigla) {
                isolamentosSet.add(String(sigla).trim());
              }
            });
          });

          if (isolamentosSet.size > 0) {
            restricao.isolamentos = Array.from(isolamentosSet).sort((a, b) => a.localeCompare(b));
          }
        }

        quartoAtual.leitos.forEach(leitoQuarto => {
          const possuiPaciente = Boolean(pacientesPorLeito[leitoQuarto.id]);
          if (restricao && !possuiPaciente && leitoQuarto.status === 'Vago') {
            leitoQuarto.restricaoCoorte = restricao;
          } else {
            leitoQuarto.restricaoCoorte = null;
          }
        });
      });
    };

    const setoresElegiveis = setores.filter(setor =>
      setor.tipoSetor === 'Enfermaria' || setor.tipoSetor === 'UTI'
    );

    const estruturarPorSetor = {};

    setoresElegiveis.forEach(setor => {
      const leitosDoSetor = leitos
        .filter(leito => leito.setorId === setor.id)
        .map(leito => ({
          ...leito,
          status: leito.status || leito.statusLeito || 'Desconhecido',
          paciente: pacientesPorLeito[leito.id] || null,
          restricaoCoorte: null
        }));

      if (leitosDoSetor.length === 0) return;

      let quartosComLeitos = [];
      let leitosSemQuarto = [];

      if (setor.tipoSetor === 'Enfermaria') {
        const gruposQuarto = leitosDoSetor.reduce((acc, leitoAtual) => {
          const codigo = leitoAtual.codigoLeito || '';
          const codigoNormalizado = String(codigo).trim();
          const chave = (codigoNormalizado.substring(0, 3) || '---').toUpperCase();
          if (!acc[chave]) {
            acc[chave] = {
              id: `din-${setor.id}-${chave}`,
              nomeQuarto: `Quarto ${chave}`,
              leitos: []
            };
          }
          acc[chave].leitos.push(leitoAtual);
          return acc;
        }, {});

        quartosComLeitos = Object.values(gruposQuarto)
          .map(quarto => ({
            ...quarto,
            leitos: quarto.leitos.sort((a, b) => {
              const codeA = a.codigoLeito || '';
              const codeB = b.codigoLeito || '';
              return codeA.localeCompare(codeB);
            })
          }))
          .sort((a, b) => {
            const nomeA = a.nomeQuarto || '';
            const nomeB = b.nomeQuarto || '';
            return nomeA.localeCompare(nomeB);
          });

        aplicarRestricoesCoorte(quartosComLeitos);
        leitosSemQuarto = [];
      } else {
        const quartosDoSetor = quartos
          .filter(quarto => quarto.setorId === setor.id)
          .sort((a, b) => {
            const nameA = a.nomeQuarto || '';
            const nameB = b.nomeQuarto || '';
            return nameA.localeCompare(nameB);
          });

        leitosSemQuarto = [...leitosDoSetor];

        quartosComLeitos = quartosDoSetor.map(quarto => {
          const leitosDoQuarto = leitosDoSetor
            .filter(leito => quarto.leitosIds && quarto.leitosIds.includes(leito.id))
            .sort((a, b) => {
              const codeA = a.codigoLeito || '';
              const codeB = b.codigoLeito || '';
              return codeA.localeCompare(codeB);
            });

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

        aplicarRestricoesCoorte(quartosComLeitos);
      }

      const leitosVagos = [...quartosComLeitos.flatMap(quarto => quarto.leitos), ...leitosSemQuarto]
        .filter(leito => (leito.status === 'Vago' || leito.status === 'Higienização') && !leito.paciente)
        .sort((a, b) => {
          const codeA = a.codigoLeito || '';
          const codeB = b.codigoLeito || '';
          return codeA.localeCompare(codeB);
        });

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
      const statusDetalhado = leito.status;
      const restricaoInfo = leito.restricaoCoorte
        ? ` | Coorte: ${formatarMensagemRestricaoCoorte(leito.restricaoCoorte)}`
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
                              {leito.restricaoCoorte ? (
                                <span className="text-xs font-semibold text-blue-700">
                                  {formatarMensagemRestricaoCoorte(leito.restricaoCoorte)}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">Sem restrição de coorte</span>
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