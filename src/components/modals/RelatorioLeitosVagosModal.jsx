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

    const normalizarTexto = (valor) =>
      String(valor || '')
        .normalize('NFD')
        .replace(/[^\p{ASCII}]/gu, '')
        .trim()
        .toLowerCase();

    const normalizarSexo = (valor) => {
      if (!valor) return '';
      const texto = String(valor).trim().toUpperCase();
      if (texto.startsWith('M')) return 'M';
      if (texto.startsWith('F')) return 'F';
      return '';
    };

    const filtrarIsolamentosAtivos = (lista) => {
      if (!Array.isArray(lista)) return [];
      return lista.filter((item) => {
        if (!item) return false;
        if (Object.prototype.hasOwnProperty.call(item, 'ativo') && item.ativo === false) {
          return false;
        }
        if (typeof item.status === 'string') {
          const statusNormalizado = normalizarTexto(item.status);
          if (['finalizado', 'encerrado', 'inativo'].includes(statusNormalizado)) {
            return false;
          }
        }
        return true;
      });
    };

    const normalizarIsolamentosPorId = (lista) => {
      if (!Array.isArray(lista) || lista.length === 0) return '';
      return lista
        .map((item) => {
          const identificador =
            item?.infecaoId ||
            item?.infeccaoId ||
            item?.infeccaoID ||
            item?.id ||
            item?.codigo ||
            item?.siglaInfeccao ||
            item?.nomeInfeccao ||
            '';
          return String(identificador).trim().toLowerCase();
        })
        .filter(Boolean)
        .sort()
        .join('|');
    };

    const extrairSiglasIsolamento = (lista) => {
      if (!Array.isArray(lista) || lista.length === 0) return '';
      const siglasUnicas = new Set(
        lista
          .map((item) =>
            String(
              item?.siglaInfeccao ||
                item?.sigla ||
                item?.codigo ||
                item?.nomeInfeccao ||
                item?.infecaoId ||
                item?.infeccaoId ||
                ''
            )
              .trim()
              .toUpperCase()
          )
          .filter(Boolean)
      );
      return Array.from(siglasUnicas).sort().join(', ');
    };

    // Criar mapa de pacientes por leito
    const pacientesPorLeito = {};
    pacientes.forEach(paciente => {
      if (paciente.leitoId) {
        pacientesPorLeito[paciente.leitoId] = paciente;
      }
    });

    const leitosPorQuarto = new Map();
    leitos.forEach((leito) => {
      if (!leito?.quartoId) return;
      if (!leitosPorQuarto.has(leito.quartoId)) {
        leitosPorQuarto.set(leito.quartoId, []);
      }
      leitosPorQuarto.get(leito.quartoId).push(leito);
    });

    // Filtrar setores elegíveis (Enfermaria e UTI)
    const setoresElegiveis = setores.filter(setor =>
      setor.tipoSetor === 'Enfermaria' || setor.tipoSetor === 'UTI'
    );

    const estruturarPorSetor = {};
    const statusElegiveis = new Set(['vago', 'higienizacao']);
    const statusOcupado = 'ocupado';

    setoresElegiveis.forEach(setor => {
      const leitosDoSetor = leitos.filter(leito => leito.setorId === setor.id);

      // Buscar leitos vagos ou em higienização deste setor
      const leitosVagos = leitosDoSetor
        .filter(leito => {
          const statusNormalizado = normalizarTexto(leito.status);
          return statusElegiveis.has(statusNormalizado) && !pacientesPorLeito[leito.id];
        })
        .map(leito => {
          let sexoCompativel = 'Ambos';
          let isolamentoExigido = null;
          let isolamentoSiglas = null;

          if (leito.quartoId) {
            const leitosMesmoQuarto = (leitosPorQuarto.get(leito.quartoId) || [])
              .filter(outro => outro.id !== leito.id);

            const leitosOcupados = leitosMesmoQuarto.filter(outro =>
              normalizarTexto(outro.status) === statusOcupado
            );

            const ocupantes = leitosOcupados
              .map(outro => pacientesPorLeito[outro.id])
              .filter(Boolean);

            if (ocupantes.length > 0) {
              const sexos = ocupantes
                .map(ocupante => normalizarSexo(ocupante?.sexo))
                .filter(Boolean);

              if (sexos.length > 0) {
                const sexoReferencia = sexos[0];
                const todosIguais = sexos.every(sexo => sexo === sexoReferencia);

                if (todosIguais) {
                  sexoCompativel =
                    sexoReferencia === 'F'
                      ? 'Feminino'
                      : sexoReferencia === 'M'
                        ? 'Masculino'
                        : 'Ambos';
                }
              }

              const isolamentosAtivos = ocupantes.flatMap(ocupante =>
                filtrarIsolamentosAtivos(ocupante?.isolamentos)
              );

              const chaveIsolamento = normalizarIsolamentosPorId(isolamentosAtivos);
              isolamentoExigido = chaveIsolamento || null;

              const siglas = extrairSiglasIsolamento(isolamentosAtivos);
              isolamentoSiglas = siglas || null;
            }
          }

          return {
            ...leito,
            sexoCompativel,
            isolamentoExigido,
            isolamentoSiglas
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

      let statusDetalhado = leito.status || 'Vago';
      if (leito.isolamentoSiglas) {
        statusDetalhado = `Isolamento: ${leito.isolamentoSiglas}`;
      }

      mensagem += `_${leito.codigoLeito || 'Leito sem código'}${sexoInfo} - Status: ${statusDetalhado}_\n`;
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
              {Object.entries(dadosProcessados).map(([setorId, setor]) => (
                <div key={setorId} className="overflow-hidden rounded-md border border-border/60">
                  <div className="flex items-center justify-between border-b border-border/60 bg-muted/50 px-4 py-3">
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

                  <div className="divide-y">
                    <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.3fr)] gap-2 px-4 py-2 text-xs font-medium uppercase text-muted-foreground">
                      <span>Leito</span>
                      <span>Status</span>
                      <span>Compatibilidade</span>
                    </div>

                    {setor.leitosVagos.map(leito => {
                      const statusTexto = leito.status || 'Vago';
                      const statusNormalizado = String(statusTexto)
                        .normalize('NFD')
                        .replace(/[^\p{ASCII}]/gu, '')
                        .trim()
                        .toLowerCase();

                      const statusClasses =
                        statusNormalizado === 'vago'
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-amber-300 bg-amber-50 text-amber-800';

                      return (
                        <div
                          key={leito.id}
                          className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.3fr)] gap-2 px-4 py-3 text-sm"
                        >
                          <div className="flex flex-col">
                            <span className="font-medium leading-tight">
                              {leito.codigoLeito || 'Leito sem código'}
                            </span>
                            {leito.sexoCompativel === 'Ambos' && !leito.isolamentoSiglas && (
                              <span className="text-xs text-muted-foreground">Disponível para ambos os sexos</span>
                            )}
                          </div>

                          <div className="flex items-center">
                            <Badge variant="outline" className={statusClasses}>
                              {statusTexto}
                            </Badge>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            {leito.sexoCompativel && leito.sexoCompativel !== 'Ambos' && (
                              <Badge
                                variant="outline"
                                className="border-blue-200 bg-blue-50 text-blue-700"
                              >
                                {leito.sexoCompativel}
                              </Badge>
                            )}

                            {leito.isolamentoSiglas && (
                              <Badge
                                variant="destructive"
                                className="border-destructive/50 bg-destructive/10 text-destructive"
                              >
                                {leito.isolamentoSiglas}
                              </Badge>
                            )}

                            {!leito.isolamentoSiglas && leito.sexoCompativel !== 'Ambos' && (
                              <span className="text-xs text-muted-foreground">Sem isolamento restritivo</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
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