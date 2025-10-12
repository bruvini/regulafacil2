import React, { useMemo, useCallback } from 'react';
import { format } from 'date-fns';
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
          siglaSetor: leito?.siglaSetor || setor?.siglaSetor || '',
          tipoSetor: leito?.tipoSetor || setor?.tipoSetor || ''
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

const determinarNivelPCP = (total) => {
  if (total >= 23 && total <= 28) {
    return { nivel: 'Nível 1', emoji: '🟡' };
  }

  if (total >= 29 && total <= 32) {
    return { nivel: 'Nível 2', emoji: '🟠' };
  }

  if (total > 32) {
    return { nivel: 'Nível 3', emoji: '🔴' };
  }

  return { nivel: 'Rotina Diária', emoji: '🟢' };
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
    const alvoCentroCirurgico = normalizarTexto('CENTRO CIRÚRGICO');

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
      if (setor === alvoCentroCirurgico) {
        acc.centroCirurgico += 1;
      }

      return acc;
    }, { salaEmergencia: 0, unidAvc: 0, centroCirurgico: 0 });
  }, [leitos]);

  const pcpEnfermariasOcupados = useMemo(() => leitos.filter((leito) =>
    normalizarTexto(leito?.tipoSetor) === normalizarTexto('Enfermaria') &&
    leito?.status === 'Ocupado' &&
    Boolean(leito?.isPCP)
  ).length, [leitos]);

  const pacientesCcRecuperacaoSemRegulacao = useMemo(() => {
    const alvo = normalizarTexto('CC - RECUPERAÇÃO');
    return leitos.filter((leito) =>
      normalizarTexto(leito?.nomeSetor || leito?.siglaSetor) === alvo &&
      leito?.paciente &&
      !leito?.paciente?.regulacaoEmAndamento
    ).length;
  }, [leitos]);

  const previsoesAlta = useMemo(() => agruparPrevisoesAlta(leitos), [leitos]);

  const manualData = useMemo(() => ({
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
  }), [dadosManuais]);

  const totalPcpInternados = useMemo(() => (
    (contagemOcupacao['PS DECISÃO CLINICA'] || 0) +
    (contagemOcupacao['PS DECISÃO CIRURGICA'] || 0)
  ), [contagemOcupacao]);

  const statusPcp = useMemo(() => determinarNivelPCP(totalPcpInternados), [totalPcpInternados]);

  const textoWhatsapp = useMemo(() => {
    const dataGeracao = format(new Date(), 'dd/MM/yyyy HH:mm');

    const linhas = [
      '*Boletim Diário Consolidado*',
      '',
      `*${dataGeracao}*`,
      `*Status PCP: ${statusPcp.nivel} ${statusPcp.emoji}*`,
      '',
      '*Setores de Emergência*',
      '• *PS Decisão Clínica:*',
      `   - _Internados:_ ${contagemOcupacao['PS DECISÃO CLINICA'] || 0}`,
      `   - _Observados:_ ${manualData.psDecisaoClinica}`,
      '',
      '• *PS Decisão Cirúrgica:*',
      `   - _Internados:_ ${contagemOcupacao['PS DECISÃO CIRURGICA'] || 0}`,
      `   - _Observados:_ ${manualData.psDecisaoCirurgica}`,
      `   - _Observados (Neuroclínica):_ ${manualData.psDecisaoCirurgicaNeuro}`,
      '',
      '• *Sala Laranja:*',
      `   - _Internados:_ ${contagemOcupacao['SALA LARANJA'] || 0}`,
      `   - _Observados:_ ${manualData.salaLaranja}`,
      '',
      '• *Sala de Emergência:*',
      `   - _Internados:_ ${contagemOcupacao['SALA DE EMERGENCIA'] || 0}`,
      `   - _Observados:_ ${manualData.salaEmergencia}`,
      `   - _Em VM:_ ${manualData.salaEmergenciaVm}`,
      `   - _Aguardando UTI:_ ${pedidosUti.salaEmergencia}`,
      '',
      '• *UNID. AVC Agudo:*',
      `   - _Internados:_ ${contagemOcupacao['UNID. AVC AGUDO'] || 0}`,
      `   - _Observados:_ ${manualData.unidAvcAgudo}`,
      `   - _Em VM:_ ${manualData.unidAvcAgudoVm}`,
      `   - _Aguardando UTI:_ ${pedidosUti.unidAvc}`,
      '',
      '*Centro Cirúrgico*',
      `• Salas ativas: ${manualData.centroCirurgicoSalasAtivas}`,
      `• Salas bloqueadas: ${manualData.centroCirurgicoSalasBloqueadas}`,
    ];

    if (manualData.centroCirurgicoSalasBloqueadas > 0 && manualData.centroCirurgicoMotivoBloqueio) {
      linhas.push(`• Motivo: ${manualData.centroCirurgicoMotivoBloqueio}`);
    }

    linhas.push(
      `• Pacientes aguardando UTI: ${pedidosUti.centroCirurgico}`,
      `• CC - Recuperação (ocupados): ${contagemOcupacao['CC - RECUPERAÇÃO'] || 0}`,
      `• CC - Recuperação (aguardando leito): ${pacientesCcRecuperacaoSemRegulacao}`,
      '',
      '*Indicadores em Tempo Real*',
      `• PCP em Enfermarias (Ocupados): ${pcpEnfermariasOcupados}`,
      `• PCP (PS) Internados: ${totalPcpInternados}`,
      `• Aguardando UTI - Sala de Emergência: ${pedidosUti.salaEmergencia}`,
      `• Aguardando UTI - UNID. AVC Agudo: ${pedidosUti.unidAvc}`,
      '',
      '*Previsões de Alta UTI*'
    );

    Object.entries(previsoesAlta).forEach(([grupo, lista]) => {
      linhas.push(`• ${grupo}: ${lista.length ? lista.join(', ') : 'Sem leitos com previsão de alta'}`);
    });

    return linhas.join('\n');
  }, [contagemOcupacao, manualData, pedidosUti, pacientesCcRecuperacaoSemRegulacao, previsoesAlta, pcpEnfermariasOcupados, statusPcp, totalPcpInternados]);

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
                  <p>Observados: <strong>{manualData.psDecisaoClinica}</strong></p>
                  <p>Ocupados: <strong>{contagemOcupacao['PS DECISÃO CLINICA'] || 0}</strong></p>
                </div>
                <div className="rounded-lg border p-4 space-y-1">
                  <p className="font-medium">PS Decisão Cirúrgica</p>
                  <p>Observados: <strong>{manualData.psDecisaoCirurgica}</strong></p>
                  <p>Ocupados: <strong>{contagemOcupacao['PS DECISÃO CIRURGICA'] || 0}</strong></p>
                  <p className="text-muted-foreground text-xs">Neuroclínica: {manualData.psDecisaoCirurgicaNeuro}</p>
                </div>
                <div className="rounded-lg border p-4 space-y-1">
                  <p className="font-medium">Sala Laranja</p>
                  <p>Observados: <strong>{manualData.salaLaranja}</strong></p>
                  <p>Ocupados: <strong>{contagemOcupacao['SALA LARANJA'] || 0}</strong></p>
                  <p className="text-muted-foreground text-xs">Leitos PCP: {pcpSalaLaranja}</p>
                </div>
                <div className="rounded-lg border p-4 space-y-1">
                  <p className="font-medium">Sala de Emergência</p>
                  <p>Observados: <strong>{manualData.salaEmergencia}</strong></p>
                  <p>Ocupados: <strong>{contagemOcupacao['SALA DE EMERGENCIA'] || 0}</strong></p>
                  <p className="text-muted-foreground text-xs">Em VM: {manualData.salaEmergenciaVm}</p>
                  <p className="text-muted-foreground text-xs">Aguardando UTI: {pedidosUti.salaEmergencia}</p>
                </div>
                <div className="rounded-lg border p-4 space-y-1">
                  <p className="font-medium">UNID. AVC Agudo</p>
                  <p>Observados: <strong>{manualData.unidAvcAgudo}</strong></p>
                  <p>Ocupados: <strong>{contagemOcupacao['UNID. AVC AGUDO'] || 0}</strong></p>
                  <p className="text-muted-foreground text-xs">Em VM: {manualData.unidAvcAgudoVm}</p>
                  <p className="text-muted-foreground text-xs">Aguardando UTI: {pedidosUti.unidAvc}</p>
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
                  <p className="text-muted-foreground text-xs">Aguardando leito: {pacientesCcRecuperacaoSemRegulacao}</p>
                </div>
                <div className="rounded-lg border p-4 space-y-1">
                  <p className="font-medium">Pacientes aguardando UTI</p>
                  <p><strong>{pedidosUti.centroCirurgico}</strong></p>
                </div>
              </div>
            </section>

            <section className="space-y-2">
              <h4 className="text-base font-semibold">Indicadores em Tempo Real</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-lg border p-4 space-y-1">
                  <p className="font-medium">PCP em Enfermarias (Ocupados)</p>
                  <p><strong>{pcpEnfermariasOcupados}</strong></p>
                </div>
                <div className="rounded-lg border p-4 space-y-1">
                  <p className="font-medium">PCP (PS) Internados</p>
                  <p><strong>{totalPcpInternados}</strong></p>
                </div>
                <div className="rounded-lg border p-4 space-y-1">
                  <p className="font-medium">Aguardando UTI - Sala de Emergência</p>
                  <p><strong>{pedidosUti.salaEmergencia}</strong></p>
                </div>
                <div className="rounded-lg border p-4 space-y-1">
                  <p className="font-medium">Aguardando UTI - UNID. AVC Agudo</p>
                  <p><strong>{pedidosUti.unidAvc}</strong></p>
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
