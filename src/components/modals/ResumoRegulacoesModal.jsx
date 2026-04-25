import React, { useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Copy } from "lucide-react";
import { format } from 'date-fns';
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
      let inicioRegulacao;
      try {
        inicioRegulacao = regulacaoAtiva.iniciadoEm?.toDate?.() || new Date(regulacaoAtiva.iniciadoEm);
        // Verificar se a data é válida
        if (isNaN(inicioRegulacao.getTime())) {
          inicioRegulacao = new Date(); // Fallback para data atual
        }
      } catch (error) {
        inicioRegulacao = new Date(); // Fallback para data atual
      }
      
      const tempoEsperaMs = Date.now() - inicioRegulacao.getTime();
      const horas = Math.floor(Math.abs(tempoEsperaMs) / (1000 * 60 * 60));
      const minutos = Math.floor((Math.abs(tempoEsperaMs) % (1000 * 60 * 60)) / (1000 * 60));
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

  const handleCopiarParaWhatsapp = async () => {
    if (!regulacoes || regulacoes.length === 0) {
      toast({
        title: "Sem regulações",
        description: "Não há regulações pendentes para copiar.",
        variant: "destructive",
      });
      return;
    }

    let texto = "REGULAÇÕES PENDENTES\n\n";

    regulacoes.forEach((reg, index) => {
      const regAtiva = reg.regulacaoAtiva || {};
      const dataRaw = regAtiva.iniciadoEm;
      let dataObj = null;
      try {
        if (dataRaw?.toDate) dataObj = dataRaw.toDate();
        else if (dataRaw?.seconds) dataObj = new Date(dataRaw.seconds * 1000);
        else if (dataRaw) dataObj = new Date(dataRaw);
      } catch (e) {
        dataObj = null;
      }
      const inicioStr = dataObj && !isNaN(dataObj.getTime())
        ? format(dataObj, "dd/MM/yyyy HH:mm")
        : "Data não disponível";

      const leitoOrigem = leitos.find(l => l.id === regAtiva.leitoOrigemId) || {};
      const leitoDestino = leitos.find(l => l.id === regAtiva.leitoDestinoId) || {};
      const setorOrigem = setores.find(s => s.id === leitoOrigem.setorId) || {};
      const setorDestino = setores.find(s => s.id === leitoDestino.setorId) || {};

      const origemSetor = setorOrigem.siglaSetor || setorOrigem.nomeSetor || "N/A";
      const origemLeito = leitoOrigem.codigoLeito || "";
      const destinoSetor = setorDestino.siglaSetor || setorDestino.nomeSetor || "N/A";
      const destinoLeito = leitoDestino.codigoLeito || "";

      const origemCompleta = origemLeito ? `${origemSetor} · ${origemLeito}` : origemSetor;
      const destinoCompleto = destinoLeito ? `${destinoSetor} · ${destinoLeito}` : destinoSetor;

      const statusStr = regAtiva.status || "Em andamento";
      const nomePaciente = reg.nomePaciente || "PACIENTE NÃO IDENTIFICADO";

      texto += `${index + 1}. ${nomePaciente.toUpperCase()} — ${statusStr}\n`;
      texto += `   Início: ${inicioStr}\n`;
      texto += `   Origem: ${origemCompleta}\n`;
      texto += `   Destino atual: ${destinoCompleto}\n\n`;
    });

    try {
      await navigator.clipboard.writeText(texto.trim());
      toast({
        title: "Resumo copiado",
        description: "Resumo copiado para a área de transferência!",
      });
    } catch (error) {
      console.error("Erro ao copiar:", error);
      toast({
        title: "Erro",
        description: "Não foi possível copiar o resumo.",
        variant: "destructive",
      });
    }
  };

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
          <div className="flex items-center justify-between gap-4 pr-6">
            <DialogTitle>Resumo de Regulações em Andamento</DialogTitle>
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
              onClick={handleCopiarParaWhatsapp}
            >
              <Copy className="h-4 w-4" />
              Copiar para WhatsApp
            </Button>
          </div>
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