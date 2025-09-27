import React, { useState, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";
import {
  writeBatch,
  doc,
  serverTimestamp
} from '@/lib/firebase';
import { db, getLeitosCollection, getPacientesCollection, getHistoricoRegulacoesCollection } from '@/lib/firebase';
import { logAction } from '@/lib/auditoria';
import { useAuth } from '@/contexts/AuthContext';

const ConfirmarRegulacaoModal = ({ 
  isOpen, 
  onClose, 
  paciente, 
  leitoOrigem, 
  leitoDestino, 
  infeccoes = [],
  showAsContent = false,
  modo = 'enfermaria'
}) => {
  const [observacoes, setObservacoes] = useState('');
  const [processando, setProcessando] = useState(false);
  const { currentUser } = useAuth();

  // Gerar mensagem formatada para WhatsApp
  const mensagemWhatsApp = useMemo(() => {
    if (!paciente || !leitoOrigem || !leitoDestino) return '';

    const nomesPaciente = paciente.nomePaciente;
    const setorOrigem = `${leitoOrigem.siglaSetor} - ${leitoOrigem.codigoLeito}`;
    const setorDestino = `${leitoDestino.siglaSetor} - ${leitoDestino.codigoLeito}`;
    
    // Obter nomes das infecções
    const nomesInfeccoes = (paciente.isolamentos || [])
      .map(iso => {
        const infeccaoId = iso.infeccaoId || iso.infecaoId;
        if (!infeccaoId) return null;
        const infeccao = infeccoes.find(inf => inf.id === infeccaoId);
        if (infeccao) {
          return infeccao.siglaInfeccao || infeccao.nomeInfeccao;
        }
        return `ID:${infeccaoId}`;
      })
      .filter(Boolean)
      .join(', ');

    const dataHora = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

    // Personalizar mensagem baseado no modo
    let titulo = '*LEITO REGULADO*';
    let justificativaTexto = '';

    if (modo === 'remanejamento') {
      titulo = '*REMANEJAMENTO SOLICITADO*';
      if (paciente.pedidoRemanejamento) {
        const tipoJustificativa = paciente.pedidoRemanejamento.tipo || '';
        const descricaoJustificativa =
          paciente.pedidoRemanejamento.detalhe || paciente.pedidoRemanejamento.descricao;
        const justificativa = `${tipoJustificativa}${descricaoJustificativa ? `: ${descricaoJustificativa}` : ''}`.trim();

        if (justificativa) {
          justificativaTexto = `\n*Justificativa:* _${justificativa}_`;
        }
      }
    }

    let mensagem = `${titulo}

*Paciente:* _${nomesPaciente}_
*DE:* _${setorOrigem}_
*PARA:* _${setorDestino}_`;

    // Adicionar justificativa para remanejamento
    if (justificativaTexto) {
      mensagem += justificativaTexto;
    }

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
  }, [paciente, leitoOrigem, leitoDestino, infeccoes, observacoes, modo]);

  const copiarMensagem = async () => {
    try {
      await navigator.clipboard.writeText(mensagemWhatsApp);
      return true;
    } catch (error) {
      console.error('Erro ao copiar mensagem:', error);
      return false;
    }
  };

  const concluirRegulacao = async () => {
    if (!paciente || !leitoOrigem || !leitoDestino) return;

    setProcessando(true);

    try {
      const batch = writeBatch(db);
      const agora = serverTimestamp();
      const nomeUsuario = currentUser?.nomeCompleto || 'Usuário do Sistema';

      // Dados da regulação
      const dadosRegulacao = {
        leitoOrigemId: leitoOrigem.id,
        leitoDestinoId: leitoDestino.id,
        setorDestinoId: leitoDestino.setorId,
        iniciadoEm: agora
      };
      const historicoRef = doc(getHistoricoRegulacoesCollection(), paciente.id);
      const setorOrigemId = leitoOrigem.setorId ?? paciente.setorId ?? null;
      const setorDestinoId = leitoDestino.setorId ?? null;

      batch.set(
        historicoRef,
        {
          pacienteId: paciente.id,
          pacienteNome: paciente.nomePaciente,
          dataInicio: agora,
          leitoOrigemId: leitoOrigem.id,
          setorOrigemId,
          leitoDestinoId: leitoDestino.id,
          setorDestinoId,
          userNameInicio: nomeUsuario,
          status: 'Em andamento',
          modo
        },
        { merge: true }
      );

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
      const copiou = await copiarMensagem();

      // Log de auditoria
      await logAction(
        'Regulação de Leitos',
        `Regulação iniciada para o paciente '${paciente.nomePaciente}' do leito '${leitoOrigem.codigoLeito}' para o leito '${leitoDestino.codigoLeito}'`,
        currentUser
      );

      // Mostrar toast de sucesso
      toast({
        title: "Regulação confirmada!",
        description: copiou ? "Mensagem copiada para a área de transferência." : "Regulação concluída com sucesso.",
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

  if (showAsContent) {
    return (
      <div className="space-y-4">
        {/* Pré-visualização da mensagem */}
        <div>
          <label className="text-sm font-medium mb-2 block">
            Mensagem para WhatsApp:
          </label>
          <Card className="p-4 bg-muted/50">
            <pre className="text-sm whitespace-pre-wrap font-mono">
              {mensagemWhatsApp}
            </pre>
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

        {/* Botão de ação */}
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
    );
  }

  return (
    <Dialog 
      open={isOpen} 
      onOpenChange={(open) => !open && !processando && onClose()}
    >
      <DialogContent 
        className="max-w-lg"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
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