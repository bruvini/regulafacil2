// src/components/modals/DiagnosticoIsolamentosModal.jsx
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

const DiagnosticoIsolamentosModal = ({ isOpen, onClose, pacientes }) => {
  const pacientesComIsolamento = pacientes.filter(p => p.isolamentos && p.isolamentos.length > 0);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Diagnóstico de Isolamentos (Pacientes Ativos)</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <p className="mb-4 text-sm text-muted-foreground">
            Esta é uma lista de todos os pacientes atualmente internados que possuem isolamentos ativos, com base nos dados processados pelo pipeline.
          </p>
          <ScrollArea className="h-96 border rounded-lg p-3">
            {pacientesComIsolamento.length > 0 ? (
              <div className="space-y-4">
                {pacientesComIsolamento.map(paciente => (
                  <div key={paciente.id} className="p-3 bg-muted/50 rounded-md">
                    <p className="font-semibold">{paciente.nomePaciente}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {paciente.isolamentos.map((iso, index) => (
                        <Badge key={index} variant="destructive">
                          {iso.siglaInfeccao || iso.sigla || 'N/A'} ({iso.status})
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground">Nenhum paciente com isolamento ativo encontrado.</p>
            )}
          </ScrollArea>
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DiagnosticoIsolamentosModal;
