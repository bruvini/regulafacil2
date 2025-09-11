import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { FileSearch, Construction } from 'lucide-react';

const AuditoriasDashboard = () => {
  return (
    <div className="flex items-center justify-center h-96">
      <Card className="max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-gray-100 rounded-full">
              <FileSearch className="h-12 w-12 text-gray-600" />
            </div>
          </div>
          <CardTitle className="text-xl text-foreground">
            Dashboard de Auditorias
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
            Conterá logs de atividades, relatórios de auditoria, e análises de conformidade.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AuditoriasDashboard;