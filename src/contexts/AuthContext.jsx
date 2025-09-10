import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  auth, 
  signInWithEmailAndPassword, 
  signOut,
  onAuthStateChanged,
  updatePassword,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  increment
} from '@/lib/firebase';
import { getUsuariosCollection } from '@/lib/firebase';
import { logAction } from '@/lib/auditoria';
import { toast } from '@/components/ui/use-toast';

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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setAuthUser(user);
      
      if (user) {
        try {
          // Buscar dados do usuário no Firestore
          const userDocRef = doc(getUsuariosCollection(), user.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setCurrentUser({
              uid: user.uid,
              email: user.email,
              ...userData
            });
          } else {
            // Usuário não encontrado no Firestore
            console.error('Usuário não encontrado no banco de dados');
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
      const result = await signInWithEmailAndPassword(auth, email, password);
      return { success: true, user: result.user };
    } catch (error) {
      let message = 'Erro desconhecido. Tente novamente.';
      
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
      
      return { success: false, error: message };
    }
  };

  const logout = async () => {
    try {
      if (currentUser) {
        await logAction('Sistema', `Usuário deslogado: ${currentUser.nomeCompleto}`);
      }
      await signOut(auth);
      setCurrentUser(null);
      setAuthUser(null);
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  };

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
      if (!currentUser) return;
      
      const userDocRef = doc(getUsuariosCollection(), currentUser.uid);
      
      // Atualizar dados de acesso
      await updateDoc(userDocRef, {
        qtdAcessos: increment(1),
        ultimoAcesso: serverTimestamp()
      });

      // Log de auditoria
      await logAction('Sistema', `Login realizado: ${currentUser.nomeCompleto} (${currentUser.emailInstitucional})`);
      
    } catch (error) {
      console.error('Erro ao registrar auditoria de login:', error);
    }
  };

  const checkFirstAccess = () => {
    return currentUser && (currentUser.ultimoAcesso === null || !currentUser.ultimoAcesso);
  };

  const hasPermission = (route) => {
    if (!currentUser) return false;
    
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
    login,
    logout,
    updateUserPassword,
    updateLoginAudit,
    checkFirstAccess,
    hasPermission
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};