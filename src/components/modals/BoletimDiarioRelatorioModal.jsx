import React, { useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";

const SETORES_REFERENCIA = [
  'PS DECISÃO CLINICA',
  'PS DECISÃO CIRURGICA',
  'SALA LARANJA',
  'SALA DE EMERGENCIA',
  'UNID. AVC AGUDO',
  'CC - RECUPERAÇÃO'
];

const normalizarTexto = (texto) => (texto || '')
  .normalize('NFD')
  .replace(/\p{Diacritic}/gu, '')
  .toUpperCase()
  .replace(/\s+/g, ' ')
  .trim();

const extrairLeitos = (dadosEstruturados) => {
  if (!dadosEstruturados) {
    return [];
  }

  const lista = [];
  Object.values(dadosEstruturados).forEach((setoresDoTipo = []) => {
    setoresDoTipo.forEach((setor) => {
      const leitosSemQuarto = setor?.leitosSemQuarto || [];
      const leitosQuartos = (setor?.quartos || []).flatMap((quarto) => quarto?.leitos || []);
      [...leitosSemQuarto, ...leitosQuartos].forEach((leito) => {
        lista.push({
          ...leito,
          nomeSetor: leito?.nomeSetor || setor?.nomeSetor || '',
          siglaSetor: leito?.siglaSetor || setor?.siglaSetor || ''
        });
      });
    });
  });

  return lista;
};

const agruparPrevisoesAlta = (leitos) => {
  const grupos = {
    'UTI 01': [],
    'UTI 02': [],
    'UTI 03': [],
    'UTI 04': [],
  };

  leitos.forEach((leito) => {
    if (!leito?.paciente?.provavelAlta) {
      return;
    }

    const codigo = String(leito?.codigoLeito || '');
    const codigoNormalizado = normalizarTexto(codigo);
    if (!codigoNormalizado.startsWith('UTI')) {
      return;
    }

    const matchNumero = codigo.match(/(\d+)/);
    if (!matchNumero) {
      return;
    }

    const numero = parseInt(matchNumero[1], 10);
    if (Number.isNaN(numero)) {
      return;
    }

    let grupo = null;
    if (numero >= 1 && numero <= 10) {
      grupo = 'UTI 01';
    } else if (numero >= 11 && numero <= 20) {
      grupo = 'UTI 02';
    } else if (numero >= 21 && numero <= 30) {
      grupo = 'UTI 03';
    } else if (numero >= 31 && numero <= 37) {
      grupo = 'UTI 04';
    }

    if (!grupo) {
      return;
    }

    const label = `L ${String(numero).padStart(2, '0')}`;
    if (!grupos[grupo].includes(label)) {
      grupos[grupo].push(label);
    }
  });

  Object.values(grupos).forEach((lista) => lista.sort());
  return grupos;
};

const BoletimDiarioRelatorioModal = ({
  isOpen,
  onClose,
  dadosManuais,
  dadosEstruturados,
}) => {
  const { toast } = useToast();
  const leitos = useMemo(() => extrairLeitos(dadosEstruturados), [dadosEstruturados]);

  const contagemOcupacao = useMemo(() => {
    const contagens = Object.fromEntries(SETORES_REFERENCIA.map((nome) => [nome, 0]));

    leitos.forEach((leito) => {
      if (leito?.status !== 'Ocupado') {
        return;
      }

      const setorNormalizado = normalizarTexto(leito?.nomeSetor || leito?.siglaSetor);
      SETORES_REFERENCIA.forEach((nomeSetor) => {
        if (setorNormalizado === normalizarTexto(nomeSetor)) {
          contagens[nomeSetor] += 1;
        }
      });
    });

    return contagens;
  }, [leitos]);

  const pcpSalaLaranja = useMemo(() => {
    const alvo = normalizarTexto('SALA LARANJA');
    return leitos.filter((leito) =>
      normalizarTexto(leito?.nomeSetor || leito?.siglaSetor) === alvo &&
      leito?.status === 'Ocupado' &&
      Boolean(leito?.isPCP)
    ).length;
  }, [leitos]);

  const pedidosUti = useMemo(() => {
    const alvoSalaEmergencia = normalizarTexto('SALA DE EMERGENCIA');
    const alvoAvc = normalizarTexto('UNID. AVC AGUDO');

    return leitos.reduce((acc, leito) => {
      if (!leito?.paciente?.pedidoUTI) {
        return acc;
      }

      const setor = normalizarTexto(leito?.nomeSetor || leito?.siglaSetor);
      if (setor === alvoSalaEmergencia) {
        acc.salaEmergencia += 1;
      }
      if (setor === alvoAvc) {
        acc.unidAvc += 1;
      }

      return acc;
    }, { salaEmergencia: 0, unidAvc: 0 });
  }, [leitos]);

  const pacientesCcRecuperacaoSemRegulacao = useMemo(() => {
    const alvo = normalizarTexto('CC - RECUPERAÇÃO');
    return leitos.filter((leito) =>
      normalizarTexto(leito?.nomeSetor || leito?.siglaSetor) === alvo &&
      leito?.paciente &&
      !leito?.paciente?.regulacaoEmAndamento
    ).length;
  }, [leitos]);

  const previsoesAlta = useMemo(() => agruparPrevisoesAlta(leitos), [leitos]);

  const manualData = {
    psDecisaoClinica: dadosManuais?.psDecisaoClinica ?? 0,
    psDecisaoCirurgica: dadosManuais?.psDecisaoCirurgica ?? 0,
    psDecisaoCirurgicaNeuro: dadosManuais?.psDecisaoCirurgicaNeuro ?? 0,
    salaLaranja: dadosManuais?.salaLaranja ?? 0,
    salaEmergencia: dadosManuais?.salaEmergencia ?? 0,
    salaEmergenciaVm: dadosManuais?.salaEmergenciaVm ?? 0,
    unidAvcAgudo: dadosManuais?.unidAvcAgudo ?? 0,
    unidAvcAgudoVm: dadosManuais?.unidAvcAgudoVm ?? 0,
    centroCirurgicoSalasAtivas: dadosManuais?.centroCirurgicoSalasAtivas ?? 0,
    centroCirurgicoSalasBloqueadas: dadosManuais?.centroCirurgicoSalasBloqueadas ?? 0,
    centroCirurgicoMotivoBloqueio: dadosManuais?.centroCirurgicoMotivoBloqueio || '',
  };

  const textoWhatsapp = useMemo(() => {
    const linhas = [
      '*Boletim Diário Consolidado*',
      '',
      '*Setores de Emergência*',
      `• PS Decisão Clínica: ${manualData.psDecisaoClinica} paciente(s) (ocupados: ${contagemOcupacao['PS DECISÃO CLINICA'] || 0})`,
      `• PS Decisão Cirúrgica: ${manualData.psDecisaoCirurgica} paciente(s) (ocupados: ${contagemOcupacao['PS DECISÃO CIRURGICA'] || 0})`,
      `   _Neuroclínica:_ ${manualData.psDecisaoCirurgicaNeuro} paciente(s)`,
      `• Sala Laranja: ${manualData.salaLaranja} paciente(s) (ocupados: ${contagemOcupacao['SALA LARANJA'] || 0})`,
      `• Sala de Emergência: ${manualData.salaEmergencia} paciente(s) (ocupados: ${contagemOcupacao['SALA DE EMERGENCIA'] || 0})`,
      `   _Em VM:_ ${manualData.salaEmergenciaVm} paciente(s)`,
      `• UNID. AVC Agudo: ${manualData.unidAvcAgudo} paciente(s) (ocupados: ${contagemOcupacao['UNID. AVC AGUDO'] || 0})`,
      `   _Em VM:_ ${manualData.unidAvcAgudoVm} paciente(s)`,
      '',
      '*Centro Cirúrgico*',
      `• Salas ativas: ${manualData.centroCirurgicoSalasAtivas}`,
      `• Salas bloqueadas: ${manualData.centroCirurgicoSalasBloqueadas}`,
    ];

    if (manualData.centroCirurgicoSalasBloqueadas > 0 && manualData.centroCirurgicoMotivoBloqueio) {
      linhas.push(`   _Motivo:_ ${manualData.centroCirurgicoMotivoBloqueio}`);
    }

    linhas.push(
      '',
      '*Indicadores em Tempo Real*',
      `• PCP na Sala Laranja: ${pcpSalaLaranja}`,
      `• Pedido de UTI - Sala de Emergência: ${pedidosUti.salaEmergencia}`,
      `• Pedido de UTI - UNID. AVC Agudo: ${pedidosUti.unidAvc}`,
      `• Pacientes em CC - Recuperação sem regulação: ${pacientesCcRecuperacaoSemRegulacao}`,
      `• CC - Recuperação (ocupados): ${contagemOcupacao['CC - RECUPERAÇÃO'] || 0}`,
      '',
      '*Previsões de Alta UTI*'
    );

    Object.entries(previsoesAlta).forEach(([grupo, lista]) => {
      linhas.push(`• ${grupo}: ${lista.length ? lista.join(', ') : 'Sem leitos com previsão de alta'}`);
    });

    return linhas.join('\n');
  }, [contagemOcupacao, manualData, pcpSalaLaranja, pedidosUti, pacientesCcRecuperacaoSemRegulacao, previsoesAlta]);

  const handleCopiarWhatsapp = useCallback(async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(textoWhatsapp);
        toast({
          title: 'Relatório copiado',
          description: 'O boletim consolidado foi copiado para a área de transferência.'
        });
      } else {
        throw new Error('Clipboard API indisponível');
      }
    } catch (error) {
      console.error('Erro ao copiar boletim:', error);
      toast({
        title: 'Não foi possível copiar',
        description: 'Tente novamente ou copie manualmente o relatório.',
        variant: 'destructive'
      });
    }
  }, [textoWhatsapp, toast]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose?.(); }}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Boletim diário consolidado</DialogTitle>
          <DialogDescription>
            Dados combinados das coletas manuais e informações em tempo real do Mapa de Leitos.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6 text-sm">
            <section className="space-y-2">
              <h4 className="text-base font-semibold">Setores de Emergência</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-lg border p-4 space-y-1">
                  <p className="font-medium">PS Decisão Clínica</p>
                  <p>Manual: <strong>{manualData.psDecisaoClinica}</strong></p>
                  <p>Ocupados: <strong>{contagemOcupacao['PS DECISÃO CLINICA'] || 0}</strong></p>
                </div>
                <div className="rounded-lg border p-4 space-y-1">
                  <p className="font-medium">PS Decisão Cirúrgica</p>
                  <p>Manual: <strong>{manualData.psDecisaoCirurgica}</strong></p>
                  <p>Ocupados: <strong>{contagemOcupacao['PS DECISÃO CIRURGICA'] || 0}</strong></p>
                  <p className="text-muted-foreground text-xs">Neuroclínica: {manualData.psDecisaoCirurgicaNeuro}</p>
                </div>
                <div className="rounded-lg border p-4 space-y-1">
                  <p className="font-medium">Sala Laranja</p>
                  <p>Manual: <strong>{manualData.salaLaranja}</strong></p>
                  <p>Ocupados: <strong>{contagemOcupacao['SALA LARANJA'] || 0}</strong></p>
                  <p className="text-muted-foreground text-xs">Leitos PCP: {pcpSalaLaranja}</p>
                </div>
                <div className="rounded-lg border p-4 space-y-1">
                  <p className="font-medium">Sala de Emergência</p>
                  <p>Manual: <strong>{manualData.salaEmergencia}</strong></p>
                  <p>Ocupados: <strong>{contagemOcupacao['SALA DE EMERGENCIA'] || 0}</strong></p>
                  <p className="text-muted-foreground text-xs">Em VM: {manualData.salaEmergenciaVm}</p>
                  <p className="text-muted-foreground text-xs">Pedidos de UTI: {pedidosUti.salaEmergencia}</p>
                </div>
                <div className="rounded-lg border p-4 space-y-1">
                  <p className="font-medium">UNID. AVC Agudo</p>
                  <p>Manual: <strong>{manualData.unidAvcAgudo}</strong></p>
                  <p>Ocupados: <strong>{contagemOcupacao['UNID. AVC AGUDO'] || 0}</strong></p>
                  <p className="text-muted-foreground text-xs">Em VM: {manualData.unidAvcAgudoVm}</p>
                  <p className="text-muted-foreground text-xs">Pedidos de UTI: {pedidosUti.unidAvc}</p>
                </div>
              </div>
            </section>

            <section className="space-y-2">
              <h4 className="text-base font-semibold">Centro Cirúrgico</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-lg border p-4 space-y-1">
                  <p className="font-medium">Salas ativas</p>
                  <p><strong>{manualData.centroCirurgicoSalasAtivas}</strong></p>
                </div>
                <div className="rounded-lg border p-4 space-y-1">
                  <p className="font-medium">Salas bloqueadas</p>
                  <p><strong>{manualData.centroCirurgicoSalasBloqueadas}</strong></p>
                  {manualData.centroCirurgicoSalasBloqueadas > 0 && manualData.centroCirurgicoMotivoBloqueio && (
                    <p className="text-muted-foreground text-xs">Motivo: {manualData.centroCirurgicoMotivoBloqueio}</p>
                  )}
                </div>
                <div className="rounded-lg border p-4 space-y-1">
                  <p className="font-medium">CC - Recuperação</p>
                  <p>Ocupados: <strong>{contagemOcupacao['CC - RECUPERAÇÃO'] || 0}</strong></p>
                  <p className="text-muted-foreground text-xs">Sem regulação: {pacientesCcRecuperacaoSemRegulacao}</p>
                </div>
              </div>
            </section>

            <section className="space-y-2">
              <h4 className="text-base font-semibold">Previsões de Alta UTI</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(previsoesAlta).map(([grupo, lista]) => (
                  <div key={grupo} className="rounded-lg border p-4 space-y-1">
                    <p className="font-medium">{grupo}</p>
                    <p className="text-sm">
                      {lista.length ? lista.join(', ') : 'Sem leitos com previsão de alta'}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </ScrollArea>

        <DialogFooter className="flex flex-col sm:flex-row sm:justify-end sm:space-x-2 space-y-2 sm:space-y-0 pt-4">
          <Button variant="outline" onClick={() => onClose?.()}>Fechar</Button>
          <Button onClick={handleCopiarWhatsapp} className="bg-emerald-600 text-white hover:bg-emerald-700">
            Copiar para WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BoletimDiarioRelatorioModal;
