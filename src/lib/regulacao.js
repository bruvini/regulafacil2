import { differenceInMinutes } from 'date-fns';
import {
  doc,
  getPacientesCollection,
  getLeitosCollection,
  getHistoricoRegulacoesCollection,
  deleteField,
  arrayUnion,
  serverTimestamp
} from '@/lib/firebase';

/**
 * Adiciona ao batch as operações necessárias para concluir uma regulação existente.
 * Retorna metadados auxiliares (ex.: mensagens de auditoria) para processamento pós-commit.
 */
export const adicionarConclusaoRegulacaoAoBatch = ({
  batch,
  paciente,
  currentUser,
  leitoOrigem,
  leitoDestino,
  setorDestino,
  dataReferencia = new Date(),
  liberarLeitosAdicionais = []
}) => {
  if (!batch) {
    throw new Error('Batch do Firestore é obrigatório para concluir a regulação.');
  }

  if (!paciente?.regulacaoAtiva) {
    throw new Error('Paciente informado não possui regulação ativa.');
  }

  const regulacaoAtiva = paciente.regulacaoAtiva;
  const leitoOrigemId = leitoOrigem?.id || regulacaoAtiva.leitoOrigemId;
  const leitoDestinoId = leitoDestino?.id || regulacaoAtiva.leitoDestinoId;
  const destinoSetorId =
    setorDestino?.id ||
    leitoDestino?.setorId ||
    regulacaoAtiva.setorDestinoId;

  const pacienteRef = doc(getPacientesCollection(), paciente.id);
  const updatesPaciente = {
    regulacaoAtiva: deleteField(),
    leitoId: leitoDestinoId,
    setorId: destinoSetorId
  };

  if (setorDestino?.tipoSetor === 'UTI' && paciente.pedidoUTI) {
    updatesPaciente.pedidoUTI = deleteField();
  }

  if (paciente.pedidoRemanejamento) {
    updatesPaciente.pedidoRemanejamento = deleteField();
  }

  batch.update(pacienteRef, updatesPaciente);

  if (leitoOrigemId) {
    const leitoOrigemRef = doc(getLeitosCollection(), leitoOrigemId);
    batch.update(leitoOrigemRef, {
      regulacaoEmAndamento: deleteField(),
      status: 'Higienização',
      historico: arrayUnion({
        status: 'Higienização',
        timestamp: dataReferencia
      })
    });
  }

  if (leitoDestinoId) {
    const leitoDestinoRef = doc(getLeitosCollection(), leitoDestinoId);
    batch.update(leitoDestinoRef, {
      regulacaoEmAndamento: deleteField(),
      status: 'Ocupado',
      historico: arrayUnion({
        status: 'Ocupado',
        timestamp: dataReferencia
      })
    });
  }

  liberarLeitosAdicionais.forEach((leitoExtra) => {
    if (!leitoExtra?.id) return;
    const leitoExtraRef = doc(getLeitosCollection(), leitoExtra.id);
    batch.update(leitoExtraRef, {
      regulacaoEmAndamento: deleteField(),
      status: 'Vago',
      historico: arrayUnion({
        status: 'Vago',
        timestamp: dataReferencia
      })
    });
  });

  const historicoRef = doc(getHistoricoRegulacoesCollection(), paciente.id);
  const inicioRegulacaoDate =
    regulacaoAtiva.iniciadoEm?.toDate?.() ||
    (regulacaoAtiva.iniciadoEm ? new Date(regulacaoAtiva.iniciadoEm) : null);
  const tempoRegulacao = Number.isNaN(inicioRegulacaoDate?.getTime?.())
    ? null
    : differenceInMinutes(new Date(), inicioRegulacaoDate);

  batch.set(
    historicoRef,
    {
      status: 'Concluída',
      dataConclusao: serverTimestamp(),
      userNameConclusao: currentUser?.nomeCompleto || 'Usuário do Sistema',
      statusFinal: 'Concluída',
      tempoRegulacaoMinutos: tempoRegulacao,
      leitoDestinoFinalId: leitoDestinoId,
      setorDestinoFinalId: destinoSetorId
    },
    { merge: true }
  );

  const nomeUsuario = currentUser?.nomeCompleto || 'Usuário do Sistema';
  const origemDesc = leitoOrigem
    ? `${leitoOrigem.siglaSetor || leitoOrigem.nomeSetor || 'N/A'} - ${
        leitoOrigem.codigo || leitoOrigem.codigoLeito || 'N/A'
      }`
    : 'Origem não informada';
  const destinoDesc = leitoDestino
    ? `${leitoDestino.siglaSetor || leitoDestino.nomeSetor || 'N/A'} - ${
        leitoDestino.codigo || leitoDestino.codigoLeito || 'N/A'
      }`
    : 'Destino não informado';

  const logEntries = [
    `Regulação para o paciente '${paciente.nomePaciente}' (do leito ${origemDesc} para ${destinoDesc}) foi concluída por ${nomeUsuario} em ${
      tempoRegulacao ?? 0
    } minutos.`
  ];

  if (setorDestino?.tipoSetor === 'UTI' && paciente.pedidoUTI) {
    const inicioUTI =
      paciente.pedidoUTI.solicitadoEm?.toDate?.() ||
      (paciente.pedidoUTI.solicitadoEm ? new Date(paciente.pedidoUTI.solicitadoEm) : null);

    if (inicioUTI && !Number.isNaN(inicioUTI.getTime())) {
      const tempoEspera = differenceInMinutes(new Date(), inicioUTI);
      logEntries.push(
        `Pedido de UTI do paciente '${paciente.nomePaciente}' foi atendido. Tempo de espera: ${tempoEspera} minutos.`
      );
    } else {
      logEntries.push(
        `Pedido de UTI do paciente '${paciente.nomePaciente}' foi atendido.`
      );
    }
  }

  const leitosEnvolvidos = [
    ...new Set(
      [
        leitoOrigemId,
        leitoDestinoId,
        ...liberarLeitosAdicionais.map((leito) => leito?.id).filter(Boolean)
      ].filter(Boolean)
    )
  ];

  return {
    destinoSetorId,
    destinoLeitoId: leitoDestinoId,
    tempoRegulacaoMinutos: tempoRegulacao,
    leitosEnvolvidos,
    logEntries
  };
};
