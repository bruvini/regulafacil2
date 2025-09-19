import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Eye } from 'lucide-react';

const VisualizarPacienteModal = ({ isOpen, onClose, paciente }) => {
  if (!paciente) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Visualizar Paciente
          </DialogTitle>
          <DialogDescription>
            Dados completos do paciente {paciente.nomeCompleto}
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="h-[70vh] w-full rounded-md border p-4">
          <div className="space-y-4">
            <div className="bg-muted/50 p-4 rounded-lg">
              <h3 className="font-semibold mb-2 text-foreground">Dados do Paciente</h3>
              <pre className="text-sm whitespace-pre-wrap font-mono text-muted-foreground overflow-x-auto">
                {JSON.stringify(paciente, null, 2)}
              </pre>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default VisualizarPacienteModal;