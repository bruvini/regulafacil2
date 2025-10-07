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
import { useDadosHospitalares } from "@/hooks/useDadosHospitalares";

const SugestoesRegulacaoModal = ({ isOpen, onClose }) => {
  const { setores = [], leitos = [] } = useDadosHospitalares();

  const setoresEnfermariaDisponiveis = useMemo(() => {
    if (!setores.length || !leitos.length) {
      return [];
    }

    const statusPermitidos = new Set(["Vago", "Higienização"]);
    const leitosPorSetor = new Map();

    leitos.forEach((leito) => {
      const setorId = leito?.setorId;
      if (!setorId || !statusPermitidos.has(leito?.status)) {
        return;
      }

      if (!leitosPorSetor.has(setorId)) {
        leitosPorSetor.set(setorId, []);
      }

      leitosPorSetor.get(setorId).push(leito);
    });

    return setores
      .filter((setor) => (setor?.tipoSetor || "").toLowerCase() === "enfermaria")
      .map((setor) => {
        const leitosDisponiveis = leitosPorSetor.get(setor.id) || [];

        if (!leitosDisponiveis.length) {
          return null;
        }

        const nomeSetor =
          setor?.nomeSetor || setor?.nome || setor?.siglaSetor || "Setor sem nome";

        const leitosOrdenados = [...leitosDisponiveis]
          .sort((a, b) =>
            String(a?.codigoLeito || "").localeCompare(String(b?.codigoLeito || ""))
          )
          .map((leito) => {
            const identificadorBase =
              leito?.codigoLeito || leito?.nomeLeito || leito?.nome || String(leito?.id || "");
            const label = identificadorBase
              ? (identificadorBase.toLowerCase().startsWith("leito")
                  ? identificadorBase
                  : `Leito ${identificadorBase}`)
              : "Leito sem código";

            return {
              id: leito.id,
              label,
              status: leito?.status || "Sem status",
            };
          });

        return {
          id: setor.id,
          nome: nomeSetor,
          leitos: leitosOrdenados,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [setores, leitos]);

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
          {setoresEnfermariaDisponiveis.length ? (
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
                            <div className="flex w-full items-center justify-between text-left">
                              <span>{leito.label}</span>
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
