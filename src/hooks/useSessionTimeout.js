import { useEffect, useRef } from 'react';

/**
 * Monitor de inatividade absoluta (anti "frozen tab").
 *
 * - Rastreia atividade leve (mousemove, keydown, click, touchstart, scroll)
 *   com throttle para não pesar a CPU.
 * - Persiste o último timestamp de atividade em localStorage (rf_last_activity)
 *   para sobreviver a reloads e abas congeladas pelo Chrome institucional.
 * - Ao voltar visível (visibilitychange) ou focar a janela, compara o
 *   agora com rf_last_activity: se exceder TIMEOUT_MS, dispara onTimeout().
 */

const ACTIVITY_KEY = 'rf_last_activity';
const DEFAULT_TIMEOUT_MIN = 120; // 2h
const THROTTLE_MS = 60 * 1000;   // grava no máximo 1x/min (baixo custo)

export const SESSION_ACTIVITY_KEY = ACTIVITY_KEY;

export const touchActivity = () => {
  try {
    localStorage.setItem(ACTIVITY_KEY, String(Date.now()));
  } catch {
    /* noop */
  }
};

export const clearActivity = () => {
  try {
    localStorage.removeItem(ACTIVITY_KEY);
  } catch {
    /* noop */
  }
};

export const getLastActivity = () => {
  try {
    const v = Number(localStorage.getItem(ACTIVITY_KEY));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
};

const useSessionTimeout = ({
  enabled,
  onTimeout,
  timeoutMinutes = DEFAULT_TIMEOUT_MIN,
} = {}) => {
  const lastWriteRef = useRef(0);
  const onTimeoutRef = useRef(onTimeout);

  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  }, [onTimeout]);

  useEffect(() => {
    if (!enabled) return undefined;

    const timeoutMs = Math.max(1, timeoutMinutes) * 60 * 1000;

    // Inicializa marcador de atividade ao habilitar (login).
    touchActivity();
    lastWriteRef.current = Date.now();

    const markActivity = () => {
      const now = Date.now();
      if (now - lastWriteRef.current < THROTTLE_MS) return;
      lastWriteRef.current = now;
      try {
        localStorage.setItem(ACTIVITY_KEY, String(now));
      } catch {
        /* noop */
      }
    };

    const checkTimeout = () => {
      const last = getLastActivity();
      if (!last) {
        // Sem marca, trata como atividade nova para evitar logout falso.
        touchActivity();
        lastWriteRef.current = Date.now();
        return;
      }
      if (Date.now() - last > timeoutMs) {
        clearActivity();
        try {
          onTimeoutRef.current?.();
        } catch (err) {
          console.error('[Session] Falha ao executar timeout handler:', err);
        }
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkTimeout();
      }
    };

    // Eventos leves + passivos para não interferir em scroll/toque.
    const activityEvents = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'];
    activityEvents.forEach((evt) =>
      window.addEventListener(evt, markActivity, { passive: true })
    );
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', checkTimeout);

    return () => {
      activityEvents.forEach((evt) => window.removeEventListener(evt, markActivity));
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', checkTimeout);
    };
  }, [enabled, timeoutMinutes]);
};

export default useSessionTimeout;
