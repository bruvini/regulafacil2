import React, { useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Copy } from "lucide-react";
import { useToast } from '@/hooks/use-toast';

const ResumoRegulacoesModal = ({ isOpen, onClose, regulacoes, leitos, setores }) => {
  const { toast } = useToast();

  const dadosProcessados = useMemo(() => {
    if (!regulacoes?.length || !leitos?.length || !setores?.length) {
      return { agrupadoPorOrigem: {}, agrupadoPorDestino: {} };
    }

    // Enriquecimento dos dados
    const regulacoesEnriquecidas = regulacoes.map(paciente => {
      const { regulacaoAtiva } = paciente;
      
      // Buscar leitos e setores
      const leitoOrigem = leitos.find(l => l.id === regulacaoAtiva.leitoOrigemId) || {};
      const leitoDestino = leitos.find(l => l.id === regulacaoAtiva.leitoDestinoId) || {};
      const setorOrigem = setores.find(s => s.id === leitoOrigem.setorId) || {};
      const setorDestino = setores.find(s => s.id === leitoDestino.setorId) || {};
      
      // Calcular tempo de espera
      const inicioRegulacao = regulacaoAtiva.iniciadoEm?.toDate?.() || new Date(regulacaoAtiva.iniciadoEm);
      const tempoEsperaMs = Date.now() - inicioRegulacao.getTime();
      const horas = Math.floor(tempoEsperaMs / (1000 * 60 * 60));
      const minutos = Math.floor((tempoEsperaMs % (1000 * 60 * 60)) / (1000 * 60));
      const tempoEsperaHHMM = `${horas.toString().padStart(2, '0')}:${minutos.toString().padStart(2, '0')}`;
      
      return {
        paciente,
        leitoOrigem,
        leitoDestino,
        setorOrigem,
        setorDestino,
        tempoEsperaMs,
        tempoEsperaHHMM
      };
    });

    // Ordenação por tempo de espera (decrescente)
    regulacoesEnriquecidas.sort((a, b) => b.tempoEsperaMs - a.tempoEsperaMs);

    // Agrupamento
    const agrupadoPorOrigem = {};
    const agrupadoPorDestino = {};

    regulacoesEnriquecidas.forEach(reg => {
      // Agrupamento por origem
      const origemId = reg.setorOrigem.id || 'sem-setor';
      if (!agrupadoPorOrigem[origemId]) {
        agrupadoPorOrigem[origemId] = {
          setor: reg.setorOrigem,
          regulacoes: []
        };
      }
      agrupadoPorOrigem[origemId].regulacoes.push(reg);

      // Agrupamento por destino
      const destinoId = reg.setorDestino.id || 'sem-setor';
      if (!agrupadoPorDestino[destinoId]) {
        agrupadoPorDestino[destinoId] = {
          setor: reg.setorDestino,
          regulacoes: []
        };
      }
      agrupadoPorDestino[destinoId].regulacoes.push(reg);
    });

    return { agrupadoPorOrigem, agrupadoPorDestino };
  }, [regulacoes, leitos, setores]);

  const handleCopiarResumoOrigem = async (setor, regulacoesDoSetor) => {
    const nomeSetor = setor.nomeSetor || 'Setor Desconhecido';
    
    let mensagem = `REGULAÇÕES PENDENTES - ${nomeSetor.toUpperCase()}\n\n`;
    mensagem += `Segue abaixo a lista das regulações pendentes para seu setor:\n\n`;

    regulacoesDoSetor.forEach(reg => {
      const codigoLeitoOrigem = reg.leitoOrigem.codigoLeito || 'N/A';
      const nomePaciente = reg.paciente.nomePaciente || 'Nome não informado';
      const siglaSetorDestino = reg.setorDestino.siglaSetor || 'N/A';
      const codigoLeitoDestino = reg.leitoDestino.codigoLeito || 'N/A';
      
      mensagem += `- ${codigoLeitoOrigem} - ${nomePaciente} -> ${siglaSetorDestino} - ${codigoLeitoDestino} / Regulado há: ${reg.tempoEsperaHHMM}\n`;
    });

    mensagem += `\n- Priorize as rotinas dos pacientes regulados\n`;
    mensagem += `- Garanta que todas as regulações foram repassadas aos setores de origem\n`;
    mensagem += `- Informe ao NIR qualquer dificuldade na passagem de plantão\n`;
    mensagem += `- Caso o paciente já tenha sido transferido, confirme nesta mensagem`;

    try {
      await navigator.clipboard.writeText(mensagem);
      toast({
        title: "Resumo copiado",
        description: `Resumo do setor ${setor.siglaSetor} copiado para área de transferência.`,
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível copiar o resumo.",
        variant: "destructive",
      });
    }
  };

  const handleCopiarResumoDestino = async (setor, regulacoesDoSetor) => {
    const nomeSetor = setor.nomeSetor || 'Setor Desconhecido';
    
    let mensagem = `REGULAÇÕES PENDENTES - ${nomeSetor.toUpperCase()}\n\n`;
    mensagem += `Segue abaixo a lista das regulações pendentes para seu setor:\n\n`;

    regulacoesDoSetor.forEach(reg => {
      const codigoLeitoDestino = reg.leitoDestino.codigoLeito || 'N/A';
      const nomePaciente = reg.paciente.nomePaciente || 'Nome não informado';
      const siglaSetorOrigem = reg.setorOrigem.siglaSetor || 'N/A';
      const codigoLeitoOrigem = reg.leitoOrigem.codigoLeito || 'N/A';
      
      mensagem += `- ${codigoLeitoDestino} - ${nomePaciente} <- ${siglaSetorOrigem} - ${codigoLeitoOrigem} / Regulado há: ${reg.tempoEsperaHHMM}\n`;
    });

    mensagem += `\n- Priorize a organização do leito para receber o paciente\n`;
    mensagem += `- Informe ao NIR qualquer dificuldade na passagem de plantão\n`;
    mensagem += `- Caso o paciente já tenha sido transferido, realize no MV a transferência do paciente`;

    try {
      await navigator.clipboard.writeText(mensagem);
      toast({
        title: "Resumo copiado",
        description: `Resumo do setor ${setor.siglaSetor} copiado para área de transferência.`,
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível copiar o resumo.",
        variant: "destructive",
      });
    }
  };

  const { agrupadoPorOrigem, agrupadoPorDestino } = dadosProcessados;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl">
        <DialogHeader>
          <DialogTitle>Resumo de Regulações em Andamento</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[80vh]">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Coluna 1: Agrupado por Origem */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-center">Por Setor de Origem</h3>
              {Object.keys(agrupadoPorOrigem).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-sm">Nenhuma regulação em andamento</p>
                </div>
              ) : (
                Object.entries(agrupadoPorOrigem).map(([setorId, { setor, regulacoes }]) => (
                  <Card key={`origem-${setorId}`} className="border border-muted">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-base">
                            {setor.siglaSetor || 'N/A'}
                          </CardTitle>
                          <Badge variant="secondary" className="text-xs">
                            {regulacoes.length}
                          </Badge>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCopiarResumoOrigem(setor, regulacoes)}
                          className="flex items-center gap-1"
                        >
                          <Copy className="h-3 w-3" />
                          Copiar
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {regulacoes.map((reg, index) => (
                        <div key={index} className="text-xs space-y-1 p-2 bg-muted/50 rounded">
                          <div className="font-medium">{reg.paciente.nomePaciente}</div>
                          <div className="text-muted-foreground">
                            {reg.setorOrigem.siglaSetor} - {reg.leitoOrigem.codigoLeito} → {reg.setorDestino.siglaSetor} - {reg.leitoDestino.codigoLeito}
                          </div>
                          <div className="font-mono text-xs">
                            {reg.tempoEsperaHHMM}
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>

            {/* Coluna 2: Agrupado por Destino */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-center">Por Setor de Destino</h3>
              {Object.keys(agrupadoPorDestino).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-sm">Nenhuma regulação em andamento</p>
                </div>
              ) : (
                Object.entries(agrupadoPorDestino).map(([setorId, { setor, regulacoes }]) => (
                  <Card key={`destino-${setorId}`} className="border border-muted">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-base">
                            {setor.siglaSetor || 'N/A'}
                          </CardTitle>
                          <Badge variant="secondary" className="text-xs">
                            {regulacoes.length}
                          </Badge>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCopiarResumoDestino(setor, regulacoes)}
                          className="flex items-center gap-1"
                        >
                          <Copy className="h-3 w-3" />
                          Copiar
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {regulacoes.map((reg, index) => (
                        <div key={index} className="text-xs space-y-1 p-2 bg-muted/50 rounded">
                          <div className="font-medium">{reg.paciente.nomePaciente}</div>
                          <div className="text-muted-foreground">
                            {reg.setorDestino.siglaSetor} - {reg.leitoDestino.codigoLeito} ← {reg.setorOrigem.siglaSetor} - {reg.leitoOrigem.codigoLeito}
                          </div>
                          <div className="font-mono text-xs">
                            {reg.tempoEsperaHHMM}
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default ResumoRegulacoesModal;