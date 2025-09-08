// Auditoria - helper para registrar ações do sistema
import { addDoc, serverTimestamp } from '@/lib/firebase';
import { getAuditoriaCollection } from '@/lib/firebase';

/**
 * Registra uma ação de auditoria no Firestore
 * @param {string} pagina - Nome da página onde ocorreu a ação (ex: "Gerenciamento de Leitos", "Mapa de Leitos")
 * @param {string} mensagemAcao - Descrição legível da ação realizada
 */
export async function logAction(pagina, mensagemAcao) {
  try {
    await addDoc(getAuditoriaCollection(), {
      timestamp: serverTimestamp(),
      usuario: 'Usuário do Sistema',
      pagina,
      acao: mensagemAcao,
    });
  } catch (err) {
    // Não bloquear o fluxo da aplicação por erro de auditoria
    console.error('Falha ao registrar auditoria:', err);
  }
}
