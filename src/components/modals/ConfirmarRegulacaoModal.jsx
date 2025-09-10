import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Copy, Check } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  writeBatch,
  doc,
  serverTimestamp
} from '@/lib/firebase';
import { db, getLeitosCollection, getPacientesCollection } from '@/lib/firebase';
import { logAction } from '@/lib/auditoria';

const ConfirmarRegulacaoModal = ({ 
  isOpen, 
  onClose, 
  paciente, 
  leitoOrigem, 
  leitoDestino, 
  infeccoes = []
}) => {
  const [observacoes, setObservacoes] = useState('');
  const [copiado, setCopiado] = useState(false);
  const [processando, setProcessando] = useState(false);

  // Gerar mensagem formatada para WhatsApp
  const mensagemWhatsApp = useMemo(() => {
    if (!paciente || !leitoOrigem || !leitoDestino) return '';

    const nomesPaciente = paciente.nomePaciente;
    const setorOrigem = `${leitoOrigem.siglaSetor} - ${leitoOrigem.codigoLeito}`;
    const setorDestino = `${leitoDestino.siglaSetor} - ${leitoDestino.codigoLeito}`;
    
    // Obter nomes das infecções
    const nomesInfeccoes = (paciente.isolamentos || [])
      .map(iso => {
        const infeccao = infeccoes.find(inf => inf.id === iso.infecaoId);
        return infeccao ? infeccao.nomeInfeccao : 'Infecção não identificada';
      })
      .join(', ');

    const dataHora = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

    let mensagem = `*LEITO REGULADO*

*Paciente:* _${nomesPaciente}_
*DE:* _${setorOrigem}_
*PARA:* _${setorDestino}_`;

    // Adicionar isolamento se houver
    if (nomesInfeccoes) {
      mensagem += `\n*Isolamento:* _${nomesInfeccoes}_`;
    }

    // Adicionar observações se houver
    if (observacoes.trim()) {
      mensagem += `\n*Observações NIR:* _${observacoes.trim()}_`;
    }

    mensagem += `\n\n_${dataHora}_`;

    return mensagem;
  }, [paciente, leitoOrigem, leitoDestino, infeccoes, observacoes]);

  const copiarMensagem = async () => {
    try {
      await navigator.clipboard.writeText(mensagemWhatsApp);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch (error) {
      console.error('Erro ao copiar mensagem:', error);
    }
  };

  const concluirRegulacao = async () => {
    if (!paciente || !leitoOrigem || !leitoDestino) return;

    setProcessando(true);

    try {
      const batch = writeBatch(db);
      const agora = serverTimestamp();

      // Dados da regulação
      const dadosRegulacao = {
        leitoOrigemId: leitoOrigem.id,
        leitoDestinoId: leitoDestino.id,
        iniciadoEm: agora
      };

      // 1. Atualizar paciente - adicionar regulacaoAtiva
      const pacienteRef = doc(getPacientesCollection(), paciente.id);
      batch.update(pacienteRef, {
        regulacaoAtiva: dadosRegulacao
      });

      // 2. Atualizar leito de origem - adicionar regulacaoEmAndamento tipo ORIGEM
      const leitoOrigemRef = doc(getLeitosCollection(), leitoOrigem.id);
      batch.update(leitoOrigemRef, {
        regulacaoEmAndamento: {
          tipo: "ORIGEM",
          pacienteId: paciente.id,
          pacienteNome: paciente.nomePaciente,
          leitoParceiroId: leitoDestino.id,
          leitoParceiroCodigo: leitoDestino.codigoLeito,
          iniciadoEm: agora
        }
      });

      // 3. Atualizar leito de destino - adicionar regulacaoEmAndamento tipo DESTINO  
      const leitoDestinoRef = doc(getLeitosCollection(), leitoDestino.id);
      batch.update(leitoDestinoRef, {
        regulacaoEmAndamento: {
          tipo: "DESTINO",
          pacienteId: paciente.id,
          pacienteNome: paciente.nomePaciente,
          leitoParceiroId: leitoOrigem.id,
          leitoParceiroCodigo: leitoOrigem.codigoLeito,
          iniciadoEm: agora
        }
      });

      // Executar lote de escritas
      await batch.commit();

      // Copiar mensagem para área de transferência
      await copiarMensagem();

      // Log de auditoria
      await logAction(
        'Regulação de Leitos',
        `Regulação iniciada para o paciente '${paciente.nomePaciente}' do leito '${leitoOrigem.codigoLeito}' para o leito '${leitoDestino.codigoLeito}'`
      );

      // Mostrar toast de sucesso
      toast({
        title: "Regulação confirmada!",
        description: "Mensagem copiada para a área de transferência.",
      });

      // Fechar modal
      onClose();

    } catch (error) {
      console.error('Erro ao concluir regulação:', error);
      toast({
        title: "Erro",
        description: "Não foi possível concluir a regulação. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setProcessando(false);
    }
  };

  if (!paciente || !leitoOrigem || !leitoDestino) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg">
            Confirmar Regulação
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Pré-visualização da mensagem */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              Mensagem para WhatsApp:
            </label>
            <Card className="p-4 bg-muted/50">
              <div className="relative">
                <pre className="text-sm whitespace-pre-wrap font-mono">
                  {mensagemWhatsApp}
                </pre>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={copiarMensagem}
                  className="absolute top-2 right-2"
                >
                  {copiado ? (
                    <>
                      <Check className="h-3 w-3 mr-1" />
                      Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3 mr-1" />
                      Copiar
                    </>
                  )}
                </Button>
              </div>
            </Card>
          </div>

          {/* Campo de observações */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              Observações NIR (opcional):
            </label>
            <Textarea
              placeholder="Adicionar observações opcionais..."
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              className="min-h-[80px]"
            />
          </div>

          {/* Botões de ação */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button 
              variant="outline" 
              onClick={onClose}
              disabled={processando}
            >
              Cancelar
            </Button>
            <Button 
              onClick={concluirRegulacao}
              disabled={processando}
              className="bg-primary hover:bg-primary/90"
            >
              {processando ? 'Processando...' : 'Concluir Regulação'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ConfirmarRegulacaoModal;