// Auditoria - helper para registrar ações do sistema
import { addDoc, serverTimestamp } from '@/lib/firebase';
import { getAuditoriaCollection } from '@/lib/firebase';

/**
 * Registra uma ação de auditoria no Firestore
 * @param {string} action - Nome da ação ou contexto (ex: "Gerenciamento de Leitos", "Mapa de Leitos")
 * @param {any} details - Informações adicionais sobre a ação realizada
 * @param {object} user - Usuário autenticado responsável pela ação
 */
export const logAction = async (action, details, user) => {
  try {
    await addDoc(getAuditoriaCollection(), {
      timestamp: serverTimestamp(),
      action,
      details,
      userId: user?.uid || 'sistema',
      userName: user?.nomeCompleto || 'Sistema',
    });
  } catch (err) {
    // Não bloquear o fluxo da aplicação por erro de auditoria
    console.error('Falha ao registrar auditoria:', err);
  }
};
