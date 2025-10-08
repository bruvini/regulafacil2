import React, { useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useDadosHospitalares } from "@/hooks/useDadosHospitalares";
import { useQuartos } from "@/hooks/useCollections";
import { getLeitosVagosPorSetor } from "@/lib/leitosDisponiveisUtils";

const SugestoesRegulacaoModal = ({ isOpen, onClose }) => {
  const {
    setores = [],
    leitos = [],
    pacientes = [],
    infeccoes = [],
    loading: loadingDados,
  } = useDadosHospitalares();
  const { data: quartos = [], loading: loadingQuartos } = useQuartos();
  const carregando = loadingDados || loadingQuartos;

  const setoresEnfermariaDisponiveis = useMemo(() => {
    if (carregando) {
      return [];
    }

    const setoresComLeitos = getLeitosVagosPorSetor({
      setores,
      leitos,
      quartos,
      pacientes,
      infeccoes,
    });

    return setoresComLeitos
      .filter((setor) => (setor?.tipoSetor || "").toLowerCase() === "enfermaria")
      .map((setor) => ({
        id: setor.id,
        nome: setor.nomeSetor,
        leitos: setor.leitosVagos.map((leito) => ({
          ...leito,
          codigo: leito.codigoLeito,
        })),
      }));
  }, [carregando, setores, leitos, quartos, pacientes, infeccoes]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Sugestões de Regulação</DialogTitle>
          <DialogDescription>
            Conheça as regras abaixo para entender como as sugestões são apresentadas.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6">
          <Alert>
            <AlertTitle>Como as Sugestões Funcionam</AlertTitle>
            <AlertDescription>
              <div className="space-y-4">
                <p>
                  As sugestões de regulação servem como uma referência, indicando pacientes
                  que foram internados para uma determinada especialidade e mostrando os
                  leitos compatíveis com o sexo e isolamento desses pacientes que estão
                  aguardando um leito. A ordenação segue uma prioridade pré-definida, mas não
                  substitui a avaliação técnica e clínica do enfermeiro regulador.
                </p>
                <div>
                  <h4 className="font-semibold">Ordem de Prioridade</h4>
                  <ol className="mt-2 list-decimal space-y-2 pl-5">
                    <li>
                      Isolamento: O sistema sempre priorizará pacientes com algum tipo de
                      isolamento.
                    </li>
                    <li>
                      Idade: A seguir, a prioridade é para os pacientes mais idosos.
                    </li>
                    <li>
                      Tempo de Internação: O critério de desempate é o paciente internado há
                      mais tempo.
                    </li>
                  </ol>
                </div>
              </div>
            </AlertDescription>
          </Alert>
          {carregando ? (
            <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
              Carregando leitos disponíveis...
            </div>
          ) : setoresEnfermariaDisponiveis.length ? (
            <ScrollArea className="h-[60vh] pr-2">
              <Accordion type="multiple" className="space-y-4">
                {setoresEnfermariaDisponiveis.map((setor) => (
                  <AccordionItem key={setor.id} value={String(setor.id)}>
                    <AccordionTrigger>{setor.nome}</AccordionTrigger>
                    <AccordionContent>
                      <Accordion type="multiple" className="space-y-2">
                        {setor.leitos.map((leito) => (
                          <AccordionItem
                            key={leito.id}
                            value={`${setor.id}-${leito.id}`}
                          >
                            <AccordionTrigger>
                              <div className="flex w-full items-center justify-between text-left" title={leito.compatibilidade}>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{leito.codigo}</span>
                                  {leito.compatibilidadeBadges.length ? (
                                    <div className="flex flex-wrap gap-1">
                                      {leito.compatibilidadeBadges.map((badge, index) => (
                                        <Badge
                                          key={`${leito.id}-${badge.text}-${index}`}
                                          variant={badge.variant}
                                          className="text-xs capitalize"
                                        >
                                          {badge.text}
                                        </Badge>
                                      ))}
                                    </div>
                                  ) : (
                                    <Badge variant="outline" className="text-xs text-muted-foreground">
                                      Livre
                                    </Badge>
                                  )}
                                </div>
                                <span className="text-xs font-medium text-muted-foreground">
                                  {leito.status}
                                </span>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent>
                              <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                                A lista de pacientes compatíveis será exibida aqui.
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </ScrollArea>
          ) : (
            <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
              Nenhum leito de enfermaria disponível no momento.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SugestoesRegulacaoModal;
