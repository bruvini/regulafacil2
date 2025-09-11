import React, { useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/use-toast';

const INACTIVITY_TIME = 120 * 60 * 1000; // 120 minutos em millisegundos
const WARNING_TIME = 115 * 60 * 1000; // Aviso 5 minutos antes

export const useInactivityTimer = () => {
  const { logout, currentUser } = useAuth();
  const timeoutRef = useRef(null);
  const warningTimeoutRef = useRef(null);
  const warningShownRef = useRef(false);

  const resetTimer = useCallback(() => {
    // Limpar timers existentes
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
    }
    
    // Reset flag de aviso
    warningShownRef.current = false;

    // Só iniciar timer se usuário estiver logado
    if (!currentUser) return;

    // Timer de aviso (5 minutos antes)
    warningTimeoutRef.current = setTimeout(() => {
      if (!warningShownRef.current) {
        warningShownRef.current = true;
        toast({
          title: "Sessão expirando",
          description: "Sua sessão expirará em 5 minutos por inatividade. Mova o mouse ou clique para continuar.",
          duration: 10000,
        });
      }
    }, WARNING_TIME);

    // Timer de logout (120 minutos)
    timeoutRef.current = setTimeout(() => {
      toast({
        title: "Sessão expirada",
        description: "Você foi deslogado por inatividade.",
        variant: "destructive",
      });
      logout();
    }, INACTIVITY_TIME);
  }, [currentUser, logout]);

  const handleActivity = useCallback(() => {
    resetTimer();
  }, [resetTimer]);

  useEffect(() => {
    // Só ativar timer se usuário estiver logado
    if (!currentUser) return;

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    // Adicionar event listeners
    events.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    // Iniciar timer
    resetTimer();

    // Cleanup
    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current);
      }
    };
  }, [currentUser, handleActivity, resetTimer]);

  return { resetTimer };
};