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

  const formatarMensagemRestricaoCoorte = (restricao) => {
    if (!restricao) {
      return '';
    }
    const isolamentos = (restricao.isolamentos || []).map(sigla => sigla.toUpperCase());
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

  const infeccoesPorId = useMemo(() => {
    return new Map((infeccoes || []).map(infeccaoAtual => [infeccaoAtual.id, infeccaoAtual]));
  }, [infeccoes]);

  const pacientesPorId = useMemo(() => {
    return new Map((dados.pacientes || []).map(pacienteAtual => [pacienteAtual.id, pacienteAtual]));
  }, [dados.pacientes]);

  const aplicarRestricoesCoorte = (quartos, pacientesMap, infeccoesMap) => {
    if (!quartos || !pacientesMap || !infeccoesMap) return;

    quartos.forEach(quarto => {
      const leitosOcupados = quarto.leitos.filter(l => (l.status === 'Ocupado' || l.status === 'Regulado') && l.pacienteId);

      if (leitosOcupados.length === 0) return; // Nenhuma restrição se o quarto não tiver pacientes

      let coorteSexo = null;
      const coorteIsolamentos = new Set();
      let isSexoConflitante = false;

      leitosOcupados.forEach(leitoOcupado => {
        const paciente = pacientesMap.get(leitoOcupado.pacienteId);
        if (!paciente) return;

        // Define o sexo da coorte com base no primeiro paciente
        if (coorteSexo === null) {
          coorteSexo = paciente.sexo;
        } else if (coorteSexo !== paciente.sexo) {
          isSexoConflitante = true;
        }

        // Agrega os isolamentos de todos os pacientes do quarto
        (paciente.isolamentos || []).forEach(iso => {
          const infeccao = infeccoesMap.get(iso.infeccaoId);
          if (infeccao) {
            const sigla = infeccao.siglaInfeccao || infeccao.sigla;
            if (sigla) coorteIsolamentos.add(sigla);
          }
        });
      });

      // Se houver conflito de sexo no quarto, não é possível criar uma coorte válida
      if (isSexoConflitante) return;

      // Cria o objeto de restrição
      const restricao = {
        sexo: coorteSexo,
        isolamentos: Array.from(coorteIsolamentos)
      };

      // Aplica a restrição a todos os leitos VAGOS do quarto
      quarto.leitos.forEach(leito => {
        if (leito.status === 'Vago') {
          leito.restricaoCoorte = restricao;
        }
      });
    });
  };

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
          pacienteId: leito.pacienteId || pacientesPorLeito[leito.id]?.id || null,
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

        aplicarRestricoesCoorte(quartosComLeitos, pacientesPorId, infeccoesPorId);
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

        aplicarRestricoesCoorte(quartosComLeitos, pacientesPorId, infeccoesPorId);
      }

      const leitosVagos = [...quartosComLeitos.flatMap(quarto => quarto.leitos), ...leitosSemQuarto]
        .filter(leito =>
          leito.status === 'Vago' &&
          !leito.paciente &&
          !leito.reservaExterna &&
          !leito.regulacaoEmAndamento &&
          leito.statusLeito !== 'Reservado'
        )
        .sort((a, b) => {
          const codeA = a.codigoLeito || '';
          const codeB = b.codigoLeito || '';
          return codeA.localeCompare(codeB);
        })
        .map(leito => ({
          ...leito,
          compatibilidade: formatarMensagemRestricaoCoorte(leito.restricaoCoorte) || 'Livre',
        }));

      if (leitosVagos.length > 0) {
        estruturarPorSetor[setor.id] = {
          nomeSetor: setor.nomeSetor,
          leitosVagos
        };
      }
    });

    return estruturarPorSetor;
  }, [dados, infeccoesPorId, pacientesPorId]);

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