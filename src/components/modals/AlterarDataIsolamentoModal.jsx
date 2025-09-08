import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Edit } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from "@/lib/utils";
import { 
  getPacientesCollection, 
  updateDoc, 
  doc 
} from '@/lib/firebase';
import { db } from '@/lib/firebase';
import { logAction } from '@/lib/auditoria';
import { toast } from '@/hooks/use-toast';

const AlterarDataIsolamentoModal = ({ isOpen, onClose, paciente, isolamento }) => {
  const [novaData, setNovaData] = useState(null);
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (isolamento && isOpen) {
      // Inicializar com a data atual do isolamento
      if (isolamento.dataInclusao) {
        let dataAtual;
        if (typeof isolamento.dataInclusao.toDate === 'function') {
          dataAtual = isolamento.dataInclusao.toDate();
        } else if (isolamento.dataInclusao instanceof Date) {
          dataAtual = isolamento.dataInclusao;
        } else if (typeof isolamento.dataInclusao === 'string') {
          dataAtual = new Date(isolamento.dataInclusao);
        }
        setNovaData(dataAtual);
      }
    }
  }, [isolamento, isOpen]);

  const handleSalvar = async () => {
    if (!paciente || !isolamento || !novaData) {
      toast({
        title: "Erro",
        description: "Selecione uma nova data para o isolamento.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      // Atualizar o array de isolamentos do paciente
      const isolamentosAtualizados = paciente.isolamentos.map(iso => 
        iso.id === isolamento.id 
          ? { ...iso, dataInclusao: novaData }
          : iso
      );

      const pacienteRef = doc(db, getPacientesCollection().path, paciente.id);
      await updateDoc(pacienteRef, {
        isolamentos: isolamentosAtualizados
      });

      await logAction(
        "Gestão de Isolamentos",
        `Data de isolamento alterada para ${paciente.nomePaciente}: nova data ${format(novaData, 'dd/MM/yyyy', { locale: ptBR })}`
      );

      toast({
        title: "Sucesso",
        description: "Data do isolamento alterada com sucesso!"
      });

      handleClose();
    } catch (error) {
      console.error('Erro ao alterar data do isolamento:', error);
      toast({
        title: "Erro",
        description: "Erro ao alterar data do isolamento. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setNovaData(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5" />
            Alterar Data do Isolamento
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="text-center">
            <div className="p-4 bg-muted rounded-lg">
              <div className="font-medium">{paciente?.nomePaciente}</div>
              <div className="text-sm text-muted-foreground mt-1">
                Alterando data de inclusão do isolamento
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Data Atual</Label>
              <div className="p-2 bg-muted/50 rounded text-sm">
                {isolamento?.dataInclusao ? 
                  format(
                    typeof isolamento.dataInclusao.toDate === 'function' 
                      ? isolamento.dataInclusao.toDate() 
                      : new Date(isolamento.dataInclusao), 
                    'dd/MM/yyyy', 
                    { locale: ptBR }
                  ) : 
                  'Data não disponível'
                }
              </div>
            </div>

            <div className="space-y-2">
              <Label>Nova Data de Inclusão</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !novaData && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {novaData ? 
                      format(novaData, "dd/MM/yyyy", { locale: ptBR }) : 
                      "Selecionar nova data"
                    }
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={novaData}
                    onSelect={setNovaData}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={handleClose}
              className="flex-1"
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleSalvar}
              className="flex-1"
              disabled={loading || !novaData}
            >
              {loading ? 'Salvando...' : 'Salvar Alteração'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AlterarDataIsolamentoModal;