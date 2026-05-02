import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  auth,
  db,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updatePassword,
  doc,
  updateDoc,
  serverTimestamp,
  increment,
  collection,
  query,
  where,
  getDocs
} from '@/lib/firebase';
import { USERS_COLLECTION_PATH } from '@/lib/firebase-constants';
import { logAction } from '@/lib/auditoria';
import useSessionTimeout, { clearActivity, touchActivity } from '@/hooks/useSessionTimeout';
import { toast } from '@/components/ui/use-toast';

const SESSION_START_KEY = 'rf_session_started_at';
const SESSION_TIMEOUT_MINUTES = 120;

const getSessionStart = () => {
  try {
    const v = Number(sessionStorage.getItem(SESSION_START_KEY));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
};
const setSessionStart = (ts) => {
  try {
    sessionStorage.setItem(SESSION_START_KEY, String(ts));
  } catch {
    /* noop */
  }
};
const clearSessionStart = () => {
  try {
    sessionStorage.removeItem(SESSION_START_KEY);
  } catch {
    /* noop */
  }
};
const formatDuracao = (ms) => {
  if (!Number.isFinite(ms) || ms <= 0) return '0min';
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
};

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authUser, setAuthUser] = useState(null); // Firebase Auth user
  const [isFirstLogin, setIsFirstLogin] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setAuthUser(user);
      
      if (user) {
        try {
          // Buscar dados do usuário no Firestore
          const usersRef = collection(db, USERS_COLLECTION_PATH);
          const q = query(usersRef, where('uid', '==', user.uid));
          const snapshot = await getDocs(q);

          if (!snapshot.empty) {
            const profileDoc = snapshot.docs[0];
            const userData = profileDoc.data();
            setCurrentUser({
              id: profileDoc.id,
              uid: user.uid,
              email: user.email,
              ...userData
            });
          } else {
            // Usuário não encontrado no Firestore
            console.error(`Usuário não encontrado no banco de dados para UID: ${user.uid}`);
            setCurrentUser(null);
          }
        } catch (error) {
          console.error('Erro ao buscar dados do usuário:', error);
          setCurrentUser(null);
        }
      } else {
        setCurrentUser(null);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = async (email, password) => {
    try {
      // Passo 1: Autenticar no Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const authenticatedUser = userCredential.user;

      // Passo 2: Buscar o perfil do usuário no Firestore USANDO QUERY POR CAMPO 'uid'
      const usersRef = collection(db, USERS_COLLECTION_PATH);
      const q = query(usersRef, where('uid', '==', authenticatedUser.uid));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        console.error(`CRITICAL: Nenhum perfil encontrado no Firestore para o UID: ${authenticatedUser.uid}`);
        throw new Error('Perfil de usuário não encontrado no Firestore.');
      }

      const userProfileDoc = snapshot.docs[0];
      const userProfile = { id: userProfileDoc.id, ...userProfileDoc.data() };

      // Atualiza estados globais imediatamente
      setAuthUser(authenticatedUser);
      setCurrentUser({
        uid: authenticatedUser.uid,
        email: authenticatedUser.email,
        ...userProfile,
      });

      // Passo 3: Marcar início da sessão (sessionStorage) e registrar auditoria
      const agora = Date.now();
      setSessionStart(agora);
      touchActivity();

      const sessionUser = {
        uid: authenticatedUser.uid,
        email: authenticatedUser.email,
        ...userProfile,
      };

      // Passo 4: Verificar se é o primeiro acesso
      const firstAccess = userProfile.ultimoAcesso === null || userProfile.ultimoAcesso === undefined;
      if (firstAccess) {
        setIsFirstLogin(true);
        // Ainda assim registra "Sessão Iniciada" para auditoria completa
        logAction('Sessão', 'Sessão Iniciada', sessionUser).catch(() => {});
        return { success: true, firstLogin: true };
      }

      // Passo 5: Auditoria de login para usuários recorrentes
      await updateDoc(doc(usersRef, userProfile.id), {
        qtdAcessos: increment(1),
        ultimoAcesso: serverTimestamp(),
      });
      logAction('Sessão', 'Sessão Iniciada', sessionUser).catch(() => {});
      setIsFirstLogin(false);
      return { success: true, firstLogin: false };
    } catch (error) {
      let message = 'Erro desconhecido. Tente novamente.';

      if (error?.message?.includes('Perfil de usuário')) {
        message = error.message;
      } else {
        switch (error.code) {
          case 'auth/user-not-found':
            message = 'Usuário não encontrado. Por favor, solicite seu cadastro a um administrador do sistema.';
            break;
          case 'auth/wrong-password':
            message = 'Senha não confere. Tente novamente ou utilize a opção abaixo.';
            break;
          case 'auth/invalid-email':
            message = 'E-mail inválido.';
            break;
          case 'auth/user-disabled':
            message = 'Esta conta foi desabilitada. Entre em contato com um administrador.';
            break;
          case 'auth/too-many-requests':
            message = 'Muitas tentativas de login. Tente novamente em alguns minutos.';
            break;
          default:
            message = 'Erro no login. Verifique suas credenciais e tente novamente.';
        }
      }

      return { success: false, error: message };
    }
  };

  const logout = useCallback(async (motivo = 'Manual') => {
    try {
      const inicio = getSessionStart();
      const duracaoMs = inicio ? Date.now() - inicio : 0;
      const detalhe = `Sessão Encerrada (${motivo}) - duração: ${formatDuracao(duracaoMs)}`;

      if (currentUser) {
        await logAction('Sessão', detalhe, currentUser).catch(() => {});
      }
      await signOut(auth);
      clearSessionStart();
      clearActivity();
      setCurrentUser(null);
      setAuthUser(null);
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  }, [currentUser]);

  // Monitoramento de inatividade absoluta (anti frozen tabs / Chrome institucional).
  // Ao exceder o limite, desloga e força reload para limpar cache de código em memória
  // (os dados do Firestore ficam salvos em IndexedDB, então reads não são penalizados).
  const handleSessionTimeout = useCallback(async () => {
    try {
      await logout('Timeout');
    } finally {
      try {
        window.location.replace('/');
      } catch {
        /* noop */
      }
      window.location.reload();
    }
  }, [logout]);

  useSessionTimeout({
    enabled: Boolean(authUser),
    onTimeout: handleSessionTimeout,
    timeoutMinutes: SESSION_TIMEOUT_MINUTES,
  });

  const updateUserPassword = async (newPassword) => {
    try {
      if (!authUser) {
        throw new Error('Usuário não autenticado');
      }
      
      await updatePassword(authUser, newPassword);
      return { success: true };
    } catch (error) {
      console.error('Erro ao atualizar senha:', error);
      return { 
        success: false, 
        error: 'Erro ao atualizar senha. Tente novamente.' 
      };
    }
  };

  const updateLoginAudit = async () => {
    try {
      if (!currentUser || !currentUser.id) return;
      
      const usersRef = collection(db, USERS_COLLECTION_PATH);
      const userDocRef = doc(usersRef, currentUser.id);
      
      // Atualizar dados de acesso
      await updateDoc(userDocRef, {
        qtdAcessos: increment(1),
        ultimoAcesso: serverTimestamp()
      });

      // Log de auditoria
      await logAction('Sistema', `Login realizado: ${currentUser.nomeCompleto} (${currentUser.emailInstitucional})`, currentUser);
      
    } catch (error) {
      console.error('Erro ao registrar auditoria de login:', error);
    }
  };

  const checkFirstAccess = () => {
    return currentUser && (currentUser.ultimoAcesso === null || !currentUser.ultimoAcesso);
  };

  const hasPermission = (route) => {
    if (!currentUser) return false;

    if (route === '/informacoes') {
      return true;
    }

    // Rota de configurações: exclusiva para administradores
    if (route === '/configuracoes') {
      return currentUser.tipoUsuario === 'Administrador';
    }

    // Administradores têm acesso a tudo
    if (currentUser.tipoUsuario === 'Administrador') {
      return true;
    }
    
    // Usuários comuns precisam ter a permissão específica
    if (currentUser.tipoUsuario === 'Comum') {
      return currentUser.permissoes && currentUser.permissoes.includes(route);
    }
    
    return false;
  };

  const value = {
    currentUser,
    authUser,
    loading,
    isFirstLogin,
    setIsFirstLogin,
    login,
    logout,
    updateUserPassword,
    updateLoginAudit,
    checkFirstAccess,
    hasPermission,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};