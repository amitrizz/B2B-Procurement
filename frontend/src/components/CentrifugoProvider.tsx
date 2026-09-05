'use client';

import { useEffect, useRef } from 'react';
import {
  connectCentrifugo,
  getCentrifugoRetryIntervalMs,
  isCentrifugoConnected,
} from '@/lib/centrifugoClient';
import { getCompanyIdFromUser } from '@/lib/userSession';

/**
 * App-level Centrifugo provider — connects after login and retries until connected.
 */
export default function CentrifugoProvider({ children }: { children: React.ReactNode }) {
  const sessionKeyRef = useRef<string | null>(null);

  useEffect(() => {
    let retryTimer: ReturnType<typeof setInterval> | null = null;

    const tryConnect = async () => {
      const token = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');
      if (!token || !storedUser) {
        sessionKeyRef.current = null;
        return;
      }

      try {
        const user = JSON.parse(storedUser);
        const companyId = getCompanyIdFromUser(user);
        if (!companyId) return;

        const sessionKey = `${companyId}:${token.slice(-8)}`;
        if (isCentrifugoConnected() && sessionKeyRef.current === sessionKey) return;

        sessionKeyRef.current = sessionKey;
        await connectCentrifugo(token, companyId);
      } catch {
        sessionKeyRef.current = null;
      }
    };

    void tryConnect();

    retryTimer = setInterval(() => {
      if (isCentrifugoConnected()) return;
      sessionKeyRef.current = null;
      void tryConnect();
    }, getCentrifugoRetryIntervalMs());

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'token' || e.key === 'user') {
        sessionKeyRef.current = null;
        void tryConnect();
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
      if (retryTimer) clearInterval(retryTimer);
    };
  }, []);

  return <>{children}</>;
}
