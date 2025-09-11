import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Sparkles, Construction } from 'lucide-react';

const CentralHigienizacaoDashboard = () => {
  return (
    <div className="flex items-center justify-center h-96">
      <Card className="max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-purple-100 rounded-full">
              <Sparkles className="h-12 w-12 text-purple-600" />
            </div>
          </div>
          <CardTitle className="text-xl text-foreground">
            Dashboard da Central de Higienização
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <div className="flex justify-center mb-4">
            <Construction className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground">
            Este dashboard está em desenvolvimento e será implementado em breve.
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Conterá métricas de limpeza, tempo médio de higienização, e status dos leitos em limpeza.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default CentralHigienizacaoDashboard;