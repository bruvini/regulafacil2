import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Shield, Construction } from 'lucide-react';

const GestaoIsolamentosDashboard = () => {
  return (
    <div className="flex items-center justify-center h-96">
      <Card className="max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-red-100 rounded-full">
              <Shield className="h-12 w-12 text-red-600" />
            </div>
          </div>
          <CardTitle className="text-xl text-foreground">
            Dashboard de Isolamentos
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
            Conterá estatísticas de isolamentos ativos, tipos de isolamento, e alertas de precauções.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default GestaoIsolamentosDashboard;