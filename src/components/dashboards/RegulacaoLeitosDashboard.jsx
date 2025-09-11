import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Activity, Construction } from 'lucide-react';

const RegulacaoLeitosDashboard = () => {
  return (
    <div className="flex items-center justify-center h-96">
      <Card className="max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-green-100 rounded-full">
              <Activity className="h-12 w-12 text-green-600" />
            </div>
          </div>
          <CardTitle className="text-xl text-foreground">
            Dashboard de Regulação
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
            Conterá indicadores de regulação de leitos, tempo médio de espera, e estatísticas de ocupação.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default RegulacaoLeitosDashboard;