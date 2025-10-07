import { getPacientesCollection, doc, writeBatch, deleteField, db } from '@/lib/firebase';
import { logAction } from '@/lib/auditoria';

const normalizarTexto = (valor) => (valor || '').toString().trim();

export const verificarEFinalizarPedidosUTIAtendidos = async (
  pacientes = [],
  leitos = [],
  setores = [],
  currentUser = null
) => {
  if (!Array.isArray(pacientes) || pacientes.length === 0) {
    return { finalizados: 0 };
  }

  const setoresMap = new Map((setores || []).map((setor) => [setor.id, setor]));
  const leitosMap = new Map((leitos || []).map((leito) => [leito.id, leito]));

  const atualizacoes = pacientes
    .filter((paciente) => paciente?.pedidoUTI)
    .map((paciente) => {
      const leitoAtual = paciente.leitoId ? leitosMap.get(paciente.leitoId) : null;
      const setorId = paciente.setorId || leitoAtual?.setorId || null;
      const setorAtual = setorId ? setoresMap.get(setorId) : null;
      const tipoSetorNormalizado = normalizarTexto(setorAtual?.tipoSetor).toUpperCase();

      return {
        paciente,
        leitoAtual,
        setorAtual,
        estaEmUTI: tipoSetorNormalizado === 'UTI',
      };
    })
    .filter((info) => info.estaEmUTI);

  if (atualizacoes.length === 0) {
    return { finalizados: 0 };
  }

  const batch = writeBatch(db);

  atualizacoes.forEach(({ paciente }) => {
    if (!paciente?.id) {
      return;
    }

    const pacienteRef = doc(getPacientesCollection(), paciente.id);
    batch.update(pacienteRef, { pedidoUTI: deleteField() });
  });

  try {
    await batch.commit();
  } catch (error) {
    console.error('Erro ao finalizar pedidos de UTI automaticamente:', error);
    throw error;
  }

  await Promise.all(
    atualizacoes
      .filter(({ paciente }) => paciente?.id)
      .map(async ({ paciente, leitoAtual }) => {
        const leitoDescricao =
          normalizarTexto(leitoAtual?.codigoLeito) ||
          normalizarTexto(paciente?.codigoLeito) ||
          normalizarTexto(paciente?.leitoId) ||
          'não informado';

        const mensagem = `Pedido de UTI para o paciente '${paciente?.nomePaciente || paciente?.id}' foi finalizado automaticamente pelo sistema, pois o paciente já se encontra no leito ${leitoDescricao}.`;

        try {
          await logAction('Mapa de Leitos', mensagem, currentUser);
        } catch (logError) {
          console.error('Erro ao registrar auditoria de finalização automática de UTI:', logError);
        }
      })
  );

  return { finalizados: atualizacoes.length };
};
