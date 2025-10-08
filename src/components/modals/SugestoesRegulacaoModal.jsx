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

const SugestoesRegulacaoModal = ({ isOpen, onClose }) => {
  const { setores = [], leitos = [], estrutura = {} } = useDadosHospitalares();

  const normalizarStatusLeito = (status) => {
    if (!status) {
      return "";
    }

    const texto = String(status).trim();
    if (!texto) {
      return "";
    }

    const semAcentos = texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

    if (semAcentos === "vago") {
      return "Vago";
    }

    if (semAcentos === "higienizacao") {
      return "Higienização";
    }

    return texto;
  };

  const restricoesPorLeito = useMemo(() => {
    const mapaRestricoes = new Map();

    const setoresEstruturados = Array.isArray(estrutura)
      ? estrutura
      : Object.values(estrutura || {}).reduce((acc, entradaAtual) => {
          if (Array.isArray(entradaAtual)) {
            acc.push(...entradaAtual);
          } else if (entradaAtual) {
            acc.push(entradaAtual);
          }
          return acc;
        }, []);

    setoresEstruturados.forEach((setor) => {
      const registrarLeito = (leitoAtual = {}) => {
        if (!leitoAtual?.id) {
          return;
        }

        mapaRestricoes.set(leitoAtual.id, {
          restricao: leitoAtual?.restricaoCoorte || null,
        });
      };

      (setor?.quartos || []).forEach((quarto) => {
        (quarto?.leitos || []).forEach(registrarLeito);
      });

      (setor?.leitosSemQuarto || []).forEach(registrarLeito);
    });

    return mapaRestricoes;
  }, [estrutura]);

  const obterCompatibilidade = (leitoBase) => {
    if (!leitoBase) {
      return "Misto";
    }

    const restricao =
      restricoesPorLeito.get(leitoBase.id)?.restricao || leitoBase?.restricaoCoorte || null;

    const sexo = restricao?.sexo ? String(restricao.sexo).trim() : "";
    if (!sexo) {
      return "Misto";
    }

    const sexoNormalizado = sexo
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

    if (["m", "masc", "masculino"].includes(sexoNormalizado)) {
      return "Masculino";
    }

    if (["f", "fem", "feminino"].includes(sexoNormalizado)) {
      return "Feminino";
    }

    return sexo;
  };

  const setoresEnfermariaDisponiveis = useMemo(() => {
    if (!setores.length || !leitos.length) {
      return [];
    }

    const statusPermitidos = new Set(["Vago", "Higienização"]);
    const leitosPorSetor = new Map();

    leitos.forEach((leito) => {
      const setorId = leito?.setorId;
      const statusAtual = normalizarStatusLeito(leito?.status || leito?.statusLeito);

      if (!setorId || !statusPermitidos.has(statusAtual)) {
        return;
      }

      if (!leitosPorSetor.has(setorId)) {
        leitosPorSetor.set(setorId, []);
      }

      leitosPorSetor.get(setorId).push({
        ...leito,
        statusPadronizado: statusAtual,
      });
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
            const codigo =
              leito?.codigoLeito || leito?.nomeLeito || leito?.nome || String(leito?.id || "");

            return {
              id: leito.id,
              codigo: codigo || "Leito sem código",
              status: leito?.statusPadronizado || leito?.status || "Sem status",
              compatibilidade: obterCompatibilidade(leito),
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
  }, [setores, leitos, restricoesPorLeito]);

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
                              <div className="flex w-full items-center justify-between text-left">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{leito.codigo}</span>
                                  <Badge
                                    variant={
                                      leito.compatibilidade === "Misto" ? "outline" : "secondary"
                                    }
                                    className="text-xs capitalize"
                                  >
                                    {leito.compatibilidade}
                                  </Badge>
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
