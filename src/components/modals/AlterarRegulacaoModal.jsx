import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  arrayUnion,
  deleteField,
  doc,
  getHistoricoRegulacoesCollection,
  getLeitosCollection,
  getPacientesCollection,
  serverTimestamp,
  writeBatch,
  db,
} from '@/lib/firebase';
import { logAction } from '@/lib/auditoria';
import { useAuth } from '@/contexts/AuthContext';
import { useDadosHospitalares } from '@/hooks/useDadosHospitalares';
import LeitoSelectionStep from './steps/LeitoSelectionStep';
import { Loader2 } from "lucide-react";

const TITULOS = {
  selecionar: 'Selecionar novo leito',
  justificativa: 'Justificativa da alteração',
  confirmacao: 'Confirmar alteração da regulação',
};

const gerarMensagemAlteracao = (resumo, data = new Date()) => {
  if (!resumo) return '';

  const dataHoraFormatada = data.toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });

  return (
    `*✅ REGULAÇÃO ALTERADA*\n\n` +
    `*Paciente:* _${resumo.pacienteNome}_\n` +
    `*Origem:* _${resumo.origemDescricao}_\n` +
    `*Destino Anterior:* _${resumo.destinoAnteriorDescricao}_\n` +
    `*Novo Destino:* _${resumo.novoDestinoDescricao}_\n\n` +
    `*Justificativa:* _${resumo.justificativa}_\n\n` +
    `_${dataHoraFormatada}_`
  );
};

const AlterarRegulacaoModal = ({ isOpen, onClose, regulacao }) => {
  const { paciente: pacienteBase, leitoOrigem: leitoOrigemBase, leitoDestino: leitoDestinoBase } = regulacao || {};
  const { estrutura, pacientesEnriquecidos, leitos = [], setores = [], loading } = useDadosHospitalares();
  const { toast } = useToast();
  const { currentUser } = useAuth();

  const [step, setStep] = useState('selecionar');
  const [novoLeito, setNovoLeito] = useState(null);
  const [justificativa, setJustificativa] = useState('');
  const [processando, setProcessando] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setStep('selecionar');
      setNovoLeito(null);
      setJustificativa('');
      setProcessando(false);
    }
  }, [isOpen]);

  const pacienteAtual = useMemo(() => {
    if (!pacienteBase) return null;
    return pacientesEnriquecidos.find((p) => p.id === pacienteBase.id) || pacienteBase;
  }, [pacientesEnriquecidos, pacienteBase]);

  const regulacaoAtiva = pacienteAtual?.regulacaoAtiva || null;

  const origemInfo = useMemo(() => {
    if (!regulacaoAtiva?.leitoOrigemId && !leitoOrigemBase) return null;
    const id = regulacaoAtiva?.leitoOrigemId || leitoOrigemBase?.id || null;
    if (!id) return null;

    const leitoDoc = leitos.find((l) => l.id === id) || leitoOrigemBase?.dadosCompletos || null;
    if (!leitoDoc) {
      if (!leitoOrigemBase) return null;
      return {
        id: leitoOrigemBase.id ?? null,
        codigo: leitoOrigemBase.codigo || leitoOrigemBase.codigoLeito || 'N/A',
        codigoLeito: leitoOrigemBase.codigoLeito || leitoOrigemBase.codigo || 'N/A',
        siglaSetor: leitoOrigemBase.siglaSetor || 'N/A',
        nomeSetor: leitoOrigemBase.nomeSetor || 'Setor não informado',
        setorId: leitoOrigemBase.setorId ?? null,
        status: leitoOrigemBase.status || 'Indefinido',
      };
    }

    const setorDoc = setores.find((s) => s.id === leitoDoc.setorId);
    return {
      id: leitoDoc.id,
      codigo: leitoDoc.codigoLeito || leitoOrigemBase?.codigo || leitoOrigemBase?.codigoLeito || 'N/A',
      codigoLeito: leitoDoc.codigoLeito || leitoOrigemBase?.codigoLeito || leitoOrigemBase?.codigo || 'N/A',
      siglaSetor: setorDoc?.siglaSetor || leitoOrigemBase?.siglaSetor || 'N/A',
      nomeSetor: setorDoc?.nomeSetor || leitoOrigemBase?.nomeSetor || 'Setor não informado',
      setorId: leitoDoc.setorId,
      status: leitoDoc.status || leitoOrigemBase?.status || 'Indefinido',
    };
  }, [regulacaoAtiva, leitos, setores, leitoOrigemBase]);

  const destinoAtualInfo = useMemo(() => {
    if (!regulacaoAtiva?.leitoDestinoId && !leitoDestinoBase) return null;
    const id = regulacaoAtiva?.leitoDestinoId || leitoDestinoBase?.id || null;
    if (!id) return null;

    const leitoDoc = leitos.find((l) => l.id === id) || leitoDestinoBase?.dadosCompletos || null;
    if (!leitoDoc) {
      if (!leitoDestinoBase) return null;
      return {
        id: leitoDestinoBase.id ?? null,
        codigo: leitoDestinoBase.codigo || leitoDestinoBase.codigoLeito || 'N/A',
        codigoLeito: leitoDestinoBase.codigoLeito || leitoDestinoBase.codigo || 'N/A',
        siglaSetor: leitoDestinoBase.siglaSetor || 'N/A',
        nomeSetor: leitoDestinoBase.nomeSetor || 'Setor não informado',
        setorId: leitoDestinoBase.setorId ?? null,
        status: leitoDestinoBase.status || 'Indefinido',
      };
    }

    const setorDoc = setores.find((s) => s.id === leitoDoc.setorId);
    return {
      id: leitoDoc.id,
      codigo: leitoDoc.codigoLeito || leitoDestinoBase?.codigo || leitoDestinoBase?.codigoLeito || 'N/A',
      codigoLeito: leitoDoc.codigoLeito || leitoDestinoBase?.codigoLeito || leitoDestinoBase?.codigo || 'N/A',
      siglaSetor: setorDoc?.siglaSetor || leitoDestinoBase?.siglaSetor || 'N/A',
      nomeSetor: setorDoc?.nomeSetor || leitoDestinoBase?.nomeSetor || 'Setor não informado',
      setorId: leitoDoc.setorId,
      status: leitoDoc.status || leitoDestinoBase?.status || 'Indefinido',
    };
  }, [regulacaoAtiva, leitos, setores, leitoDestinoBase]);

  const novoLeitoInfo = useMemo(() => {
    if (!novoLeito) return null;
    const leitoDoc = leitos.find((l) => l.id === novoLeito.id) || null;
    const setorDoc = leitoDoc
      ? setores.find((s) => s.id === leitoDoc.setorId)
      : setores.find((s) => s.id === novoLeito.setorId);

    return {
      id: leitoDoc?.id || novoLeito.id,
      codigo: leitoDoc?.codigoLeito || novoLeito.codigoLeito || novoLeito.codigo || 'N/A',
      codigoLeito: leitoDoc?.codigoLeito || novoLeito.codigoLeito || novoLeito.codigo || 'N/A',
      siglaSetor: setorDoc?.siglaSetor || novoLeito.siglaSetor || 'N/A',
      nomeSetor: setorDoc?.nomeSetor || novoLeito.nomeSetor || 'Setor não informado',
      setorId: leitoDoc?.setorId || novoLeito.setorId || setorDoc?.id || null,
      status: leitoDoc?.status || novoLeito.status || 'Indefinido',
      quartoId: leitoDoc?.quartoId || novoLeito.quartoId || null,
    };
  }, [novoLeito, leitos, setores]);

  const modo = useMemo(() => (pacienteAtual?.pedidoUTI ? 'uti' : 'enfermaria'), [pacienteAtual]);

  const justificativaNormalizada = justificativa.trim();

  const resumoConfirmacao = useMemo(() => {
    if (!pacienteAtual || !origemInfo || !destinoAtualInfo || !novoLeitoInfo || !justificativaNormalizada) {
      return null;
    }

    return {
      pacienteNome: pacienteAtual.nomePaciente,
      origemDescricao: `${origemInfo.siglaSetor || origemInfo.nomeSetor} - ${origemInfo.codigo}`,
      destinoAnteriorDescricao: `${destinoAtualInfo.siglaSetor || destinoAtualInfo.nomeSetor} - ${destinoAtualInfo.codigo}`,
      novoDestinoDescricao: `${novoLeitoInfo.siglaSetor || novoLeitoInfo.nomeSetor} - ${novoLeitoInfo.codigo}`,
      justificativa: justificativaNormalizada,
    };
  }, [pacienteAtual, origemInfo, destinoAtualInfo, novoLeitoInfo, justificativaNormalizada]);

  const excludedLeitoIds = useMemo(() => {
    const ids = [];
    if (regulacaoAtiva?.leitoDestinoId) ids.push(regulacaoAtiva.leitoDestinoId);
    if (regulacaoAtiva?.leitoOrigemId) ids.push(regulacaoAtiva.leitoOrigemId);
    return ids;
  }, [regulacaoAtiva]);

  const hospitalData = useMemo(
    () => ({ estrutura, leitos, setores, pacientesEnriquecidos }),
    [estrutura, leitos, setores, pacientesEnriquecidos]
  );

  const fechar = () => {
    if (processando) return;
    setStep('selecionar');
    setNovoLeito(null);
    setJustificativa('');
    setProcessando(false);
    onClose?.();
  };

  const handleSelecionarLeito = (leito) => {
    setNovoLeito(leito);
    setStep('justificativa');
  };

  const handleVoltarSelecao = () => {
    if (processando) return;
    setStep('selecionar');
    setNovoLeito(null);
  };

  const handleAvancarConfirmacao = () => {
    if (!justificativaNormalizada) return;
    setStep('confirmacao');
  };

  const confirmarAlteracao = async () => {
    if (!pacienteAtual || !regulacaoAtiva || !novoLeitoInfo || !destinoAtualInfo || !origemInfo) {
      toast({
        title: 'Não foi possível alterar a regulação',
        description: 'Dados insuficientes para concluir a alteração.',
        variant: 'destructive',
      });
      return;
    }

    setProcessando(true);

    try {
      const batch = writeBatch(db);
      const ts = serverTimestamp();
      const timestampHistorico = new Date();
      const nomeUsuario = currentUser?.nomeCompleto || 'Usuário do Sistema';
      const justificativaTexto = justificativaNormalizada;

      const pacienteRef = doc(getPacientesCollection(), pacienteAtual.id);
      const origemId = regulacaoAtiva.leitoOrigemId;
      const destinoAnteriorId = regulacaoAtiva.leitoDestinoId;
      const historicoRef = doc(getHistoricoRegulacoesCollection(), pacienteAtual.id);

      const regulacaoAtualizada = {
        ...regulacaoAtiva,
        leitoDestinoId: novoLeitoInfo.id,
        setorDestinoId: novoLeitoInfo.setorId ?? regulacaoAtiva.setorDestinoId ?? null,
        leitoDestinoCodigo: novoLeitoInfo.codigoLeito,
        leitoDestinoSetorNome: novoLeitoInfo.nomeSetor,
        ultimaAlteracaoEm: ts,
        ultimaJustificativa: justificativaTexto,
        userUltimaAlteracao: nomeUsuario,
      };

      batch.update(pacienteRef, {
        regulacaoAtiva: regulacaoAtualizada,
      });

      if (destinoAnteriorId) {
        const destinoAnteriorRef = doc(getLeitosCollection(), destinoAnteriorId);
        batch.update(destinoAnteriorRef, {
          regulacaoEmAndamento: deleteField(),
          status: 'Vago',
          historico: arrayUnion({
            status: 'Vago',
            timestamp: timestampHistorico,
            origem: 'alteracao-regulacao',
            pacienteId: pacienteAtual.id,
          }),
        });
      }

      const novoDestinoRef = doc(getLeitosCollection(), novoLeitoInfo.id);
      batch.update(novoDestinoRef, {
        regulacaoEmAndamento: {
          tipo: 'DESTINO',
          pacienteId: pacienteAtual.id,
          pacienteNome: pacienteAtual.nomePaciente,
          leitoParceiroId: origemId,
          leitoParceiroCodigo: origemInfo.codigoLeito || origemInfo.codigo,
          leitoParceiroSetorNome: origemInfo.siglaSetor || origemInfo.nomeSetor || null,
          iniciadoEm: regulacaoAtiva?.iniciadoEm || ts,
          atualizadoEm: ts,
        },
        status: 'Reservado',
        historico: arrayUnion({
          status: 'Reservado',
          timestamp: timestampHistorico,
          origem: 'alteracao-regulacao',
          pacienteId: pacienteAtual.id,
        }),
      });

      if (origemId) {
        const origemRef = doc(getLeitosCollection(), origemId);
        const leitoOrigemDoc = leitos.find((l) => l.id === origemId);
        const regulacaoOrigemAtual = leitoOrigemDoc?.regulacaoEmAndamento || {};

        batch.update(origemRef, {
          regulacaoEmAndamento: {
            ...regulacaoOrigemAtual,
            tipo: 'ORIGEM',
            pacienteId: pacienteAtual.id,
            pacienteNome: pacienteAtual.nomePaciente,
            leitoParceiroId: novoLeitoInfo.id,
            leitoParceiroCodigo: novoLeitoInfo.codigoLeito,
            leitoParceiroSetorNome: novoLeitoInfo.siglaSetor || novoLeitoInfo.nomeSetor || null,
            iniciadoEm: regulacaoOrigemAtual?.iniciadoEm || regulacaoAtiva?.iniciadoEm || ts,
            atualizadoEm: ts,
          },
        });
      }

      batch.set(
        historicoRef,
        {
          status: 'Em andamento',
          ultimaAlteracaoEm: ts,
          userNameUltimaAlteracao: nomeUsuario,
          justificativaUltimaAlteracao: justificativaTexto,
          alteracoes: arrayUnion({
            tipo: 'alteracao',
            timestamp: timestampHistorico,
            realizadoPor: nomeUsuario,
            justificativa: justificativaTexto,
            deLeitoId: destinoAnteriorId || null,
            deLeitoCodigo: destinoAtualInfo.codigoLeito || destinoAtualInfo.codigo,
            deSetorSigla: destinoAtualInfo.siglaSetor || null,
            deSetorNome: destinoAtualInfo.nomeSetor || null,
            paraLeitoId: novoLeitoInfo.id,
            paraLeitoCodigo: novoLeitoInfo.codigoLeito,
            paraSetorSigla: novoLeitoInfo.siglaSetor || null,
            paraSetorNome: novoLeitoInfo.nomeSetor || null,
          }),
        },
        { merge: true }
      );

      await batch.commit();

      await logAction(
        'Regulação de Leitos',
        `Regulação do paciente '${pacienteAtual.nomePaciente}' atualizada de ${destinoAtualInfo.siglaSetor || destinoAtualInfo.nomeSetor} - ${destinoAtualInfo.codigo} para ${novoLeitoInfo.siglaSetor || novoLeitoInfo.nomeSetor} - ${novoLeitoInfo.codigoLeito}. Motivo: '${justificativaTexto}'.`,
        currentUser
      );

      const mensagemResumo = gerarMensagemAlteracao(resumoConfirmacao, new Date());

      try {
        if (!navigator?.clipboard?.writeText) {
          throw new Error('Clipboard API não suportada.');
        }

        if (mensagemResumo) {
          await navigator.clipboard.writeText(mensagemResumo);
        }

        toast({
          title: 'Regulação alterada e mensagem copiada para a área de transferência!',
        });
      } catch (clipboardError) {
        console.error('Não foi possível copiar a mensagem de alteração:', clipboardError);
        toast({
          title: 'Regulação alterada',
          description:
            'O novo leito foi reservado, mas não foi possível copiar a mensagem automaticamente.',
        });
      }

      fechar();
    } catch (error) {
      console.error('Erro ao alterar regulação:', error);
      toast({
        title: 'Erro ao alterar regulação',
        description: 'Não foi possível concluir a alteração. Tente novamente em instantes.',
        variant: 'destructive',
      });
    } finally {
      setProcessando(false);
    }
  };

  const renderResumoAtual = () => {
    if (!pacienteAtual || !origemInfo || !destinoAtualInfo) {
      return null;
    }

    return (
      <Card className="bg-muted/40 p-4 text-sm">
        <div className="flex flex-col gap-2">
          <div>
            <p className="text-xs uppercase text-muted-foreground">Paciente</p>
            <p className="font-semibold text-foreground">{pacienteAtual.nomePaciente}</p>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <div>
              <p className="text-xs uppercase text-muted-foreground">Setor e leito de origem</p>
              <p className="font-medium text-foreground">
                {origemInfo.siglaSetor || origemInfo.nomeSetor} - {origemInfo.codigo}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground">Reserva atual</p>
              <p className="font-medium text-foreground">
                {destinoAtualInfo.siglaSetor || destinoAtualInfo.nomeSetor} - {destinoAtualInfo.codigo}
              </p>
            </div>
          </div>
        </div>
      </Card>
    );
  };

  const renderJustificativaStep = () => (
    <div className="space-y-4">
      {renderResumoAtual()}

      {novoLeitoInfo && (
        <Card className="p-4 text-sm">
          <p className="text-xs uppercase text-muted-foreground">Novo leito selecionado</p>
          <p className="font-medium text-foreground">
            {novoLeitoInfo.siglaSetor || novoLeitoInfo.nomeSetor} - {novoLeitoInfo.codigo}
          </p>
        </Card>
      )}

      <div className="space-y-2">
        <label className="text-sm font-medium">Justificativa da alteração</label>
        <Textarea
          value={justificativa}
          onChange={(event) => setJustificativa(event.target.value)}
          placeholder="Descreva o motivo da alteração da reserva"
          className="min-h-[120px]"
          maxLength={500}
          disabled={processando}
        />
        <p className="text-xs text-muted-foreground">
          O campo é obrigatório. Informe de forma objetiva a motivação da mudança de leito.
        </p>
      </div>

      <div className="flex justify-between gap-2 pt-4 border-t">
        <Button variant="ghost" onClick={handleVoltarSelecao} disabled={processando}>
          Voltar à seleção
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fechar} disabled={processando}>
            Cancelar
          </Button>
          <Button onClick={handleAvancarConfirmacao} disabled={!justificativaNormalizada || processando}>
            Avançar para confirmação
          </Button>
        </div>
      </div>
    </div>
  );

  const renderConfirmacaoStep = () => (
    <div className="space-y-4">
      {resumoConfirmacao && (
        <Card className="space-y-3 p-4 text-sm">
          <div>
            <p className="text-xs uppercase text-muted-foreground">Paciente</p>
            <p className="font-semibold text-foreground">{resumoConfirmacao.pacienteNome}</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <p className="text-xs uppercase text-muted-foreground">Origem</p>
              <p className="font-medium text-foreground">{resumoConfirmacao.origemDescricao}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground">Reserva anterior</p>
              <p className="font-medium text-foreground">{resumoConfirmacao.destinoAnteriorDescricao}</p>
            </div>
            <div className="md:col-span-2">
              <p className="text-xs uppercase text-muted-foreground">Novo leito reservado</p>
              <p className="font-medium text-foreground">{resumoConfirmacao.novoDestinoDescricao}</p>
            </div>
          </div>
          <div>
            <p className="text-xs uppercase text-muted-foreground">Justificativa</p>
            <p className="whitespace-pre-wrap text-foreground">{resumoConfirmacao.justificativa}</p>
          </div>
        </Card>
      )}

      <div className="flex justify-between gap-2 pt-4 border-t">
        <Button variant="ghost" onClick={() => setStep('justificativa')} disabled={processando}>
          Revisar justificativa
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fechar} disabled={processando}>
            Cancelar
          </Button>
          <Button onClick={confirmarAlteracao} disabled={!resumoConfirmacao || processando}>
            {processando ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              'Confirmar alteração'
            )}
          </Button>
        </div>
      </div>
    </div>
  );

  const renderSelecaoStep = () => (
    <div className="space-y-4">
      {renderResumoAtual()}
      <LeitoSelectionStep
        paciente={pacienteBase}
        pacienteEnriquecido={pacienteAtual}
        hospitalData={hospitalData}
        modo={modo}
        excludedLeitoIds={excludedLeitoIds}
        loading={loading}
        onLeitoSelect={handleSelecionarLeito}
      />
      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button variant="outline" onClick={fechar}>
          Fechar
        </Button>
      </div>
    </div>
  );

  const renderConteudo = () => {
    if (!pacienteAtual || !regulacaoAtiva || !origemInfo || !destinoAtualInfo) {
      return (
        <div className="space-y-4">
          <Card className="p-4 text-sm">
            <p className="font-medium text-destructive">
              Não foi possível carregar todos os dados necessários para alterar esta regulação.
            </p>
            <p className="text-muted-foreground">
              Verifique se a regulação ainda está ativa e tente novamente.
            </p>
          </Card>
          <div className="flex justify-end">
            <Button onClick={fechar}>Fechar</Button>
          </div>
        </div>
      );
    }

    if (step === 'selecionar') return renderSelecaoStep();
    if (step === 'justificativa') return renderJustificativaStep();
    return renderConfirmacaoStep();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => (!open ? fechar() : null)}>
      <DialogContent
        className="max-w-3xl"
        onInteractOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => {
          if (!processando) return;
          event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>{TITULOS[step] || 'Alterar regulação'}</DialogTitle>
        </DialogHeader>
        {renderConteudo()}
      </DialogContent>
    </Dialog>
  );
};

export default AlterarRegulacaoModal;
