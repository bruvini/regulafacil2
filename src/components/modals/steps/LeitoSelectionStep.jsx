import React from 'react';
import { Wrench } from "lucide-react";

const LeitoSelectionStep = ({ paciente }) => {
  if (!paciente) {
    return null;
  }

  return (
    <div className="flex flex-col items-center justify-center space-y-4 py-12 text-center">
      <Wrench className="h-12 w-12 text-yellow-500" />
      <h3 className="text-xl font-semibold">Seleção de Leitos em Desenvolvimento</h3>
      <p className="text-muted-foreground max-w-md">
        A etapa automática de sugestão e seleção de leitos está temporariamente indisponível
        enquanto reconstruímos a funcionalidade.
        <br />
        Escolha o leito desejado diretamente no mapa e retorne para confirmar a regulação.
      </p>
    </div>
  );
};

export default LeitoSelectionStep;
