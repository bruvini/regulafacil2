import React, { useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Info,
  TrendingUp,
  TrendingDown,
  Target,
  Calculator,
  Database,
  Filter,
  X,
  Clock,
  Lightbulb,
} from "lucide-react";
import { definicoesIndicadores } from "@/data/indicadoresDefinicoes";

/**
 * Ficha do Indicador
 * Fonte: src/data/indicadoresDefinicoes.js (estático, versionado).
 * Antes lia de uma coleção Firestore "definicoesIndicadores" que nunca foi
 * populada — por isso o modal aparecia vazio. A leitura local é instantânea,
 * elimina o onSnapshot desnecessário e remove o risco de memory leak.
 */
const IndicadorInfoModal = ({ isOpen, onClose, indicadorId }) => {
  const indicador = useMemo(() => {
    if (!indicadorId) return null;
    const def = definicoesIndicadores[indicadorId];
    return def ? { id: indicadorId, ...def } : null;
  }, [indicadorId]);

  if (!isOpen) return null;

  const getDirecaoIcon = (direcao) => {
    const d = String(direcao || '').toLowerCase();
    if (d.includes('menos')) return <TrendingDown className="h-4 w-4 text-emerald-600" />;
    if (d.includes('mais')) return <TrendingUp className="h-4 w-4 text-blue-600" />;
    return <Target className="h-4 w-4 text-muted-foreground" />;
  };

  const getDirecaoColor = (direcao) => {
    const d = String(direcao || '').toLowerCase();
    if (d.includes('menos')) return 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100';
    if (d.includes('mais')) return 'bg-blue-100 text-blue-800 hover:bg-blue-100';
    return 'bg-muted text-foreground hover:bg-muted';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Info className="h-5 w-5 text-primary" />
            Ficha do Indicador
          </DialogTitle>
        </DialogHeader>

        {indicador ? (
          <div className="space-y-6">
            {/* Cabeçalho */}
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <h3 className="text-xl font-semibold text-foreground">
                  {indicador.nome}
                </h3>
                {indicador.unidadeMedida && (
                  <Badge variant="outline">{indicador.unidadeMedida}</Badge>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {indicador.meta && (
                  <div className="flex items-center gap-1.5 text-sm">
                    <Target className="h-4 w-4 text-orange-600" />
                    <span className="font-medium">Meta:</span>
                    <Badge variant="secondary">{indicador.meta}</Badge>
                  </div>
                )}
                {indicador.direcao && (
                  <div className="flex items-center gap-1.5 text-sm">
                    {getDirecaoIcon(indicador.direcao)}
                    <span className="font-medium">Direção:</span>
                    <Badge className={getDirecaoColor(indicador.direcao)}>
                      {indicador.direcao}
                    </Badge>
                  </div>
                )}
                {indicador.periodicidade && (
                  <div className="flex items-center gap-1.5 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Periodicidade:</span>
                    <Badge variant="outline">{indicador.periodicidade}</Badge>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Objetivo / Definição */}
            {indicador.definicao && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Info className="h-4 w-4" />
                    Objetivo
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground leading-relaxed text-sm">
                    {indicador.definicao}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Cálculo */}
            {(indicador.formula || indicador.numerador || indicador.denominador) && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Calculator className="h-4 w-4" />
                    Fórmula de Cálculo
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {indicador.formula && (
                    <div>
                      <p className="text-sm font-medium text-foreground mb-1">Fórmula:</p>
                      <code className="bg-muted px-3 py-2 rounded text-sm block break-words">
                        {indicador.formula}
                      </code>
                    </div>
                  )}
                  {indicador.numerador && (
                    <div>
                      <p className="text-sm font-medium text-foreground mb-1">Numerador:</p>
                      <p className="text-sm text-muted-foreground">{indicador.numerador}</p>
                    </div>
                  )}
                  {indicador.denominador && (
                    <div>
                      <p className="text-sm font-medium text-foreground mb-1">Denominador:</p>
                      <p className="text-sm text-muted-foreground">{indicador.denominador}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Critérios */}
            {(indicador.criteriosInclusao || indicador.criteriosExclusao) && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    Critérios
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {indicador.criteriosInclusao && (
                    <div>
                      <p className="text-sm font-medium text-emerald-700 mb-1 flex items-center gap-1">
                        <Filter className="h-3 w-3" />
                        Inclusão
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {indicador.criteriosInclusao}
                      </p>
                    </div>
                  )}
                  {indicador.criteriosExclusao && (
                    <div>
                      <p className="text-sm font-medium text-red-700 mb-1 flex items-center gap-1">
                        <X className="h-3 w-3" />
                        Exclusão
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {indicador.criteriosExclusao}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Fonte */}
            {indicador.fonte && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    Fonte de Dados
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{indicador.fonte}</p>
                </CardContent>
              </Card>
            )}

            {/* Resultado / Impacto */}
            {(indicador.resultado || indicador.impactoGestao) && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-amber-500" />
                    Impacto na Gestão
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {indicador.impactoGestao && (
                    <p className="text-sm text-muted-foreground">{indicador.impactoGestao}</p>
                  )}
                  {indicador.resultado && (
                    <p className="text-sm text-muted-foreground">{indicador.resultado}</p>
                  )}
                </CardContent>
              </Card>
            )}

            <div className="pt-2">
              <Button onClick={onClose} className="w-full">Fechar</Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 space-y-3">
            <p className="text-muted-foreground">
              Indicador não encontrado ou ainda não foi documentado.
            </p>
            <p className="text-xs text-muted-foreground">
              ID solicitado: <code className="bg-muted px-1.5 py-0.5 rounded">{indicadorId || '—'}</code>
            </p>
            <Button onClick={onClose} className="mt-2">Fechar</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default IndicadorInfoModal;
