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
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useDadosHospitalares } from "@/hooks/useDadosHospitalares";

const PassagemPlantaoModal = ({ isOpen, onClose }) => {
  const [loading, setLoading] = useState(true);
  const { estrutura } = useDadosHospitalares();

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

  const estruturaHospitalar = useMemo(() => Object.entries(estrutura || {}), [estrutura]);

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl">
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
              {estruturaHospitalar.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum setor disponível no momento.
                </p>
              ) : (
                estruturaHospitalar.map(([tipoSetor, setoresDoTipo]) => (
                  <Accordion
                    key={tipoSetor}
                    type="single"
                    collapsible
                    className="rounded-lg border"
                  >
                    <AccordionItem value={tipoSetor}>
                      <AccordionTrigger className="px-4 text-left">
                        <span className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                          {tipoSetor}
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="px-4">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          {setoresDoTipo.map((setor) => (
                            <Card key={setor?.idSetor ?? setor?.nomeSetor}>
                              <CardHeader className="py-4">
                                <CardTitle className="text-base font-medium">
                                  {setor?.nomeSetor}
                                </CardTitle>
                              </CardHeader>
                            </Card>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                ))
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
