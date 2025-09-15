import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { 
  onSnapshot,
  getLeitosCollection,
  getQuartosCollection,
  getSetoresCollection,
  getPacientesCollection,
  writeBatch,
  doc,
  arrayUnion,
  deleteField,
  serverTimestamp,
  db
} from '@/lib/firebase';
import LeitoSelectionStep from './steps/LeitoSelectionStep';
import { logAction } from '@/lib/auditoria';
import { useAuth } from '@/contexts/AuthContext';

const AlterarRegulacaoModal = ({ isOpen, onClose, regulacao }) => {
  const paciente = regulacao;
  const [dados, setDados] = useState({ leitos: [], quartos: [], setores: [], pacientes: [], loading: true });
  const [step, setStep] = useState('selecao');
  const [novoLeito, setNovoLeito] = useState(null);
  const [justificativa, setJustificativa] = useState('');
  const { currentUser } = useAuth();

  useEffect(() => {
    if (!isOpen || !paciente) return;
    let unsubs = [];

    const load = async () => {
      setDados((p) => ({ ...p, loading: true }));
      try {
        const u1 = onSnapshot(getLeitosCollection(), (snap) => {
          setDados((p) => ({ ...p, leitos: snap.docs.map(d => ({ id: d.id, ...d.data() })) }));
        });
        const u2 = onSnapshot(getQuartosCollection(), (snap) => {
          setDados((p) => ({ ...p, quartos: snap.docs.map(d => ({ id: d.id, ...d.data() })) }));
        });
        const u3 = onSnapshot(getSetoresCollection(), (snap) => {
          setDados((p) => ({ ...p, setores: snap.docs.map(d => ({ id: d.id, ...d.data() })) }));
        });
        const u4 = onSnapshot(getPacientesCollection(), (snap) => {
          setDados((p) => ({ ...p, pacientes: snap.docs.map(d => ({ id: d.id, ...d.data() })), loading: false }));
        });
        unsubs = [u1, u2, u3, u4];
      } catch (e) {
        console.error('Erro ao carregar dados:', e);
        setDados((p) => ({ ...p, loading: false }));
      }
    };
    load();
    return () => unsubs.forEach(u => u && u());
  }, [isOpen, paciente]);

  const modo = useMemo(() => (paciente?.pedidoUTI ? 'uti' : 'enfermaria'), [paciente]);

  const obterInfoLeito = (leitoId) => {
    const leito = dados.leitos.find(l => l.id === leitoId);
    if (!leito) return { codigo: 'N/A', siglaSetor: 'N/A' };
    const setor = dados.setores.find(s => s.id === leito.setorId);
    return { codigo: leito.codigoLeito || 'N/A', siglaSetor: setor?.siglaSetor || 'N/A' };
  };

  const origemInfo = useMemo(() => {
    if (!paciente?.regulacaoAtiva) return null;
    return obterInfoLeito(paciente.regulacaoAtiva.leitoOrigemId);
  }, [paciente, dados.leitos, dados.setores]);

  const destinoAtualInfo = useMemo(() => {
    if (!paciente?.regulacaoAtiva) return null;
    return obterInfoLeito(paciente.regulacaoAtiva.leitoDestinoId);
  }, [paciente, dados.leitos, dados.setores]);

  const mensagemPreview = useMemo(() => {
    if (!paciente || !origemInfo || !destinoAtualInfo || !novoLeito) return '';
    const novoSetor = dados.setores.find(s => s.id === novoLeito.setorId);
    const novoDestino = `${novoSetor?.siglaSetor || 'N/A'} - ${novoLeito.codigoLeito}`;
    return `*REGULAÇÃO ALTERADA*\n\n*Paciente:* _${paciente.nomePaciente}_\n*Origem:* _${origemInfo.siglaSetor} - ${origemInfo.codigo}_\n*Destino Anterior:* _${destinoAtualInfo.siglaSetor} - ${destinoAtualInfo.codigo}_\n*Novo Destino:* _${novoDestino}_\n*Motivo:* _${justificativa || '[preencher]'}_\n\n_${new Date().toLocaleString()}_`;
  }, [paciente, origemInfo, destinoAtualInfo, novoLeito, justificativa, dados.setores]);

  const onSelectLeito = (leito) => {
    setNovoLeito(leito);
    setStep('confirmacao');
  };

  const handleVoltar = () => {
    setStep('selecao');
    setNovoLeito(null);
  };

  const fechar = () => {
    setStep('selecao');
    setNovoLeito(null);
    setJustificativa('');
    onClose?.();
  };

  const confirmarAlteracao = async () => {
    if (!paciente || !paciente.regulacaoAtiva || !novoLeito) return;
    try {
      const batch = writeBatch(db);
      const ts = serverTimestamp();

      const pacienteRef = doc(getPacientesCollection(), paciente.id);
      const origemId = paciente.regulacaoAtiva.leitoOrigemId;
      const destinoAnteriorId = paciente.regulacaoAtiva.leitoDestinoId;

      // 1) Atualiza paciente.regulacaoAtiva
      batch.update(pacienteRef, {
        regulacaoAtiva: {
          ...paciente.regulacaoAtiva,
          leitoDestinoId: novoLeito.id,
          setorDestinoId: novoLeito.setorId,
          iniciadoEm: ts,
        }
      });

      // 2) Limpa destino anterior
      const destinoAnteriorRef = doc(getLeitosCollection(), destinoAnteriorId);
      batch.update(destinoAnteriorRef, {
        regulacaoEmAndamento: deleteField(),
        status: 'Vago',
        historico: arrayUnion({ status: 'Vago', timestamp: new Date() })
      });

      // 3) Marca novo destino
      const novoDestinoRef = doc(getLeitosCollection(), novoLeito.id);
      batch.update(novoDestinoRef, {
        regulacaoEmAndamento: {
          tipo: 'DESTINO',
          pacienteId: paciente.id,
          pacienteNome: paciente.nomePaciente,
          leitoParceiroId: origemId,
          leitoParceiroCodigo: obterInfoLeito(origemId).codigo,
          iniciadoEm: ts
        }
      });

      // 4) Ajusta leito de origem para apontar para novo destino (integridade)
      const origemRef = doc(getLeitosCollection(), origemId);
      batch.update(origemRef, {
        regulacaoEmAndamento: {
          ...dados.leitos.find(l => l.id === origemId)?.regulacaoEmAndamento,
          tipo: 'ORIGEM',
          pacienteId: paciente.id,
          pacienteNome: paciente.nomePaciente,
          leitoParceiroId: novoLeito.id,
          leitoParceiroCodigo: novoLeito.codigoLeito,
          iniciadoEm: paciente.regulacaoAtiva?.iniciadoEm || ts
        }
      });

      await batch.commit();

      const usuario = currentUser?.nomeCompleto || 'Usuário do Sistema';
      const destAnteriorStr = `${destinoAtualInfo?.siglaSetor} - ${destinoAtualInfo?.codigo}`;
      const novoDestinoStr = `${dados.setores.find(s => s.id === novoLeito.setorId)?.siglaSetor || 'N/A'} - ${novoLeito.codigoLeito}`;
      await logAction('Regulação de Leitos', `Regulação do paciente '${paciente.nomePaciente}' foi ALTERADA por ${usuario} do leito '${destAnteriorStr}' para '${novoDestinoStr}'. Motivo: '${justificativa}'.`);

      toast({ title: 'Regulação alterada', description: 'A alteração foi aplicada com sucesso.' });
      fechar();
    } catch (e) {
      console.error('Erro ao alterar regulação:', e);
      toast({ title: 'Erro', description: 'Falha ao alterar a regulação.', variant: 'destructive' });
    }
  };

  if (!paciente) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) fechar(); }}>
      <DialogContent className="max-w-3xl" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{step === 'selecao' ? 'Selecionar novo leito' : 'Confirmar Alteração de Regulação'}</DialogTitle>
        </DialogHeader>

        {step === 'selecao' ? (
          <div className="space-y-4">
            <LeitoSelectionStep dados={dados} paciente={paciente} modo={modo} onLeitoSelect={onSelectLeito} />
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={fechar}>Cancelar</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Pré-visualização</label>
              <Card className="p-4 bg-muted/50">
                <pre className="text-sm whitespace-pre-wrap font-mono">{mensagemPreview}</pre>
              </Card>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Justificativa (obrigatória)</label>
              <Textarea value={justificativa} onChange={(e) => setJustificativa(e.target.value)} placeholder="Descreva o motivo da alteração" className="min-h-[100px]" />
            </div>
            <div className="flex justify-between gap-2 pt-4 border-t">
              <Button variant="ghost" onClick={handleVoltar}>Voltar</Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={fechar}>Cancelar</Button>
                <Button onClick={confirmarAlteracao} disabled={!justificativa.trim()}>Confirmar Alteração</Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AlterarRegulacaoModal;
