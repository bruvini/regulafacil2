import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Loader2 } from "lucide-react";
import { useDadosHospitalares } from "@/hooks/useDadosHospitalares";

const PassagemPlantaoModal = ({ isOpen, onClose }) => {
  const [loading, setLoading] = useState(true);
  const { estrutura } = useDadosHospitalares();

  const ORDEM_TIPO_SETOR = ["Enfermaria", "UTI", "Centro Cirúrgico", "Emergência"];

  const ORDEM_SETORES = {
    Enfermaria: [
      "UNID. JS ORTOPEDIA",
      "UNID. INT. GERAL - UIG",
      "UNID. DE AVC - INTEGRAL",
      "UNID. NEFROLOGIA TRANSPLANTE",
      "UNID. CIRURGICA",
      "UNID. ONCOLOGIA",
      "UNID. CLINICA MEDICA",
    ],
    UTI: ["UTI"],
    "Centro Cirúrgico": ["CC - RECUPERAÇÃO", "CC - SALAS CIRURGICAS"],
    Emergência: [
      "UNID. AVC AGUDO",
      "SALA DE EMERGENCIA",
      "SALA LARANJA",
      "PS DECISÃO CIRURGICA",
      "PS DECISão CLINICA",
    ],
  };

  useEffect(() => {
    let timeoutId;

    if (isOpen) {
      setLoading(true);
      timeoutId = setTimeout(() => {
        setLoading(false);
      }, 2000);
    } else {
      setLoading(true);
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [isOpen]);

  const handleOpenChange = (open) => {
    if (!open) {
      onClose?.();
    }
  };

  const estruturaOrdenada = useMemo(() => {
    if (!estrutura) return [];

    return ORDEM_TIPO_SETOR.map((tipoSetor) => {
      const setoresDoTipo = estrutura[tipoSetor] || [];
      const ordemParaTipo = ORDEM_SETORES[tipoSetor] || [];

      const setoresOrdenados = [...setoresDoTipo].sort((a, b) => {
        const indexA = ordemParaTipo.indexOf(a.nomeSetor);
        const indexB = ordemParaTipo.indexOf(b.nomeSetor);

        if (indexA === -1) return 1;
        if (indexB === -1) return -1;

        return indexA - indexB;
      });

      return { tipoSetor, setores: setoresOrdenados };
    }).filter((grupo) => grupo.setores.length > 0);
  }, [estrutura]);

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Relatório de Passagem de Plantão</DialogTitle>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto pr-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                Gerando relatório de passagem de plantão...
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {estruturaOrdenada.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum setor disponível no momento.
                </p>
              ) : (
                <Accordion type="multiple" className="w-full space-y-4">
                  {estruturaOrdenada.map(({ tipoSetor, setores }) => (
                    <AccordionItem key={tipoSetor} value={tipoSetor}>
                      <AccordionTrigger className="text-xl font-semibold">
                        {tipoSetor}
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="flex flex-col space-y-2 pt-2">
                          {setores.map((setor) => (
                            <div
                              key={setor?.idSetor ?? setor?.id ?? setor?.nomeSetor}
                              className="w-full rounded-md border p-4"
                            >
                              <h4 className="text-md font-medium">
                                {setor?.nomeSetor}
                              </h4>
                            </div>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
          <Button disabled>Gerar PDF</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PassagemPlantaoModal;
