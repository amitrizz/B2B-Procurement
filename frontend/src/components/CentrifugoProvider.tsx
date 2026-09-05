'use client';

import { useEffect, useRef } from 'react';
import { connectCentrifugo } from '@/lib/centrifugoClient';
import { getCompanyIdFromUser } from '@/lib/userSession';

/**
 * App-level Centrifugo provider.
 */
export default function CentrifugoProvider({ children }: { children: React.ReactNode }) {
  const connectKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const tryConnect = () => {
      const token = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');
      if (!token || !storedUser) return;

      try {
        const user = JSON.parse(storedUser);
        const companyId = getCompanyIdFromUser(user);
        if (!companyId) return;

        const key = `${companyId}:${token.slice(-8)}`;
        if (connectKeyRef.current === key) return;
        connectKeyRef.current = key;

        connectCentrifugo(token, companyId);
      } catch {
        // Invalid JSON in localStorage — ignore
      }
    };

    tryConnect();

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'token' || e.key === 'user') {
        connectKeyRef.current = null;
        tryConnect();
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  return <>{children}</>;
}
