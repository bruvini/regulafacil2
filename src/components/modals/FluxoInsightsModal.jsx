import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { AlertTriangle, CheckCircle2, Info, TrendingDown, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const TIPO_CONFIG = {
  alerta: {
    icon: AlertTriangle,
    wrapper: 'border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20',
    iconClass: 'text-amber-600 dark:text-amber-400',
    label: 'Alerta',
  },
  negativo: {
    icon: TrendingDown,
    wrapper: 'border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/20',
    iconClass: 'text-red-600 dark:text-red-400',
    label: 'Atenção',
  },
  positivo: {
    icon: CheckCircle2,
    wrapper: 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/20',
    iconClass: 'text-emerald-600 dark:text-emerald-400',
    label: 'Positivo',
  },
  info: {
    icon: Info,
    wrapper: 'border-blue-200 bg-blue-50 dark:border-blue-900/40 dark:bg-blue-950/20',
    iconClass: 'text-blue-600 dark:text-blue-400',
    label: 'Informação',
  },
};

const FluxoInsightsModal = ({ isOpen, onClose, fluxo, insights = [] }) => {
  if (!fluxo) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose?.()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2 text-base sm:text-lg">
            <span className="font-semibold">{fluxo.origem}</span>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold">{fluxo.destino}</span>
          </DialogTitle>
          <DialogDescription>
            {fluxo.total} regulação(ões) · Tempo médio:{' '}
            {fluxo.tempoMedio != null ? `${Math.round(fluxo.tempoMedio)} min` : '—'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
          {insights.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Nenhum insight gerado para este fluxo.
            </p>
          ) : (
            insights.map((ins, i) => {
              const cfg = TIPO_CONFIG[ins.tipo] || TIPO_CONFIG.info;
              const Icon = cfg.icon;
              return (
                <div
                  key={i}
                  className={cn('flex gap-3 rounded-md border p-3', cfg.wrapper)}
                >
                  <Icon className={cn('h-5 w-5 shrink-0 mt-0.5', cfg.iconClass)} />
                  <div className="space-y-0.5">
                    <p className={cn('text-xs font-semibold uppercase tracking-wide', cfg.iconClass)}>
                      {cfg.label}
                    </p>
                    <p className="text-sm text-foreground leading-snug">{ins.texto}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FluxoInsightsModal;
