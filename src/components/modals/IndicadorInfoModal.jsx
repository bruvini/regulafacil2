import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Info, TrendingUp, TrendingDown, Target, Calculator, Database, Filter, Exclude } from "lucide-react";
import { getDefinicoesIndicadoresCollection, onSnapshot } from "@/lib/firebase";
import { Skeleton } from "@/components/ui/skeleton";

const IndicadorInfoModal = ({ isOpen, onClose, indicadorId }) => {
  const [indicador, setIndicador] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen || !indicadorId) return;

    setLoading(true);
    const unsubscribe = onSnapshot(getDefinicoesIndicadoresCollection(), (snapshot) => {
      const indicadorDoc = snapshot.docs.find(doc => doc.id === indicadorId);
      if (indicadorDoc) {
        setIndicador({ id: indicadorDoc.id, ...indicadorDoc.data() });
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isOpen, indicadorId]);

  if (!isOpen) return null;

  const getDirecaoIcon = (direcao) => {
    if (direcao?.includes('menos')) return <TrendingDown className="h-4 w-4 text-green-600" />;
    if (direcao?.includes('mais')) return <TrendingUp className="h-4 w-4 text-blue-600" />;
    return <Target className="h-4 w-4 text-gray-600" />;
  };

  const getDirecaoColor = (direcao) => {
    if (direcao?.includes('menos')) return 'bg-green-100 text-green-800';
    if (direcao?.includes('mais')) return 'bg-blue-100 text-blue-800';
    return 'bg-gray-100 text-gray-800';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Info className="h-5 w-5 text-blue-600" />
            Ficha do Indicador
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : indicador ? (
          <div className="space-y-6">
            {/* Header do Indicador */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-foreground">{indicador.nome}</h3>
                <Badge variant="outline" className="flex items-center gap-1">
                  {indicador.unidadeMedida}
                </Badge>
              </div>
              
              {indicador.meta && (
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-orange-600" />
                  <span className="text-sm font-medium">Meta:</span>
                  <Badge variant="secondary">{indicador.meta}</Badge>
                </div>
              )}

              {indicador.direcao && (
                <div className="flex items-center gap-2">
                  {getDirecaoIcon(indicador.direcao)}
                  <span className="text-sm font-medium">Direção:</span>
                  <Badge className={getDirecaoColor(indicador.direcao)}>
                    {indicador.direcao}
                  </Badge>
                </div>
              )}
            </div>

            <Separator />

            {/* Definição */}
            {indicador.definicao && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Info className="h-4 w-4" />
                    Definição
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground leading-relaxed">
                    {indicador.definicao}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Fórmula de Cálculo */}
            {(indicador.formula || indicador.numerador || indicador.denominador) && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Calculator className="h-4 w-4" />
                    Cálculo
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {indicador.formula && (
                    <div>
                      <p className="text-sm font-medium text-foreground mb-1">Fórmula:</p>
                      <code className="bg-muted px-3 py-2 rounded text-sm block">
                        {indicador.formula}
                      </code>
                    </div>
                  )}
                  
                  {indicador.numerador && (
                    <div>
                      <p className="text-sm font-medium text-foreground mb-1">Numerador:</p>
                      <p className="text-sm text-muted-foreground">
                        {indicador.numerador}
                      </p>
                    </div>
                  )}
                  
                  {indicador.denominador && (
                    <div>
                      <p className="text-sm font-medium text-foreground mb-1">Denominador:</p>
                      <p className="text-sm text-muted-foreground">
                        {indicador.denominador}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Critérios */}
            {(indicador.criteriosInclusao || indicador.criteriosExclusao) && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    Critérios
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {indicador.criteriosInclusao && (
                    <div>
                      <p className="text-sm font-medium text-green-700 mb-1 flex items-center gap-1">
                        <Filter className="h-3 w-3" />
                        Inclusão:
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {indicador.criteriosInclusao}
                      </p>
                    </div>
                  )}
                  
                  {indicador.criteriosExclusao && (
                    <div>
                      <p className="text-sm font-medium text-red-700 mb-1 flex items-center gap-1">
                        <Exclude className="h-3 w-3" />
                        Exclusão:
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {indicador.criteriosExclusao}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Fonte dos Dados */}
            {indicador.fonte && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    Fonte dos Dados
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {indicador.fonte}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Resultado Esperado */}
            {indicador.resultado && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Resultado</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {indicador.resultado}
                  </p>
                </CardContent>
              </Card>
            )}

            <div className="pt-4">
              <Button onClick={onClose} className="w-full">
                Fechar
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-muted-foreground">
              Indicador não encontrado ou ainda não foi configurado.
            </p>
            <Button onClick={onClose} className="mt-4">
              Fechar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default IndicadorInfoModal;