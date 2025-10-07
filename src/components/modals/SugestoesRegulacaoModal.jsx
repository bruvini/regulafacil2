import React from 'react';
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

const SugestoesRegulacaoModal = ({ isOpen, onClose }) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
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
          <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
            A lista de pacientes e leitos sugeridos será exibida aqui em breve.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SugestoesRegulacaoModal;
