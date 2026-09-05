/**
 * Singleton Centrifugo WebSocket client.
 */
import { Centrifuge } from 'centrifuge';
import { shouldDeliverEventToCompany } from './realtimeNotifications';

interface CentrifugoState {
  instance: Centrifuge | null;
  companyId: string | null;
  authToken: string | null;
  connecting: boolean;
  connected: boolean;
  listeners: Set<(data: any) => void>;
  lastTransportErrorAt: number;
  lastConnectAttemptAt: number;
}

const KEY = '__centrifugo_state';
const RETRY_MS = 15000;

function getState(): CentrifugoState {
  if (!(globalThis as any)[KEY]) {
    (globalThis as any)[KEY] = {
      instance: null,
      companyId: null,
      authToken: null,
      connecting: false,
      connected: false,
      listeners: new Set(),
      lastTransportErrorAt: 0,
      lastConnectAttemptAt: 0,
    };
  }
  return (globalThis as any)[KEY];
}

function isBenignTransportError(err: unknown): boolean {
  const e = err as { type?: string; error?: { code?: number; message?: string } };
  if (e?.type !== 'transport') return false;
  const code = e.error?.code;
  const message = e.error?.message?.toLowerCase() ?? '';
  return code === 2 || message.includes('transport closed');
}

function logTransportError(err: unknown) {
  if (isBenignTransportError(err)) return;
  const state = getState();
  const now = Date.now();
  if (now - state.lastTransportErrorAt < 30000) return;
  state.lastTransportErrorAt = now;
  console.warn('[CentrifugoClient] WebSocket error:', err);
}

function attachSubscription(centrifuge: Centrifuge, companyId: string) {
  const state = getState();
  const existing = centrifuge.getSubscription('global_updates');
  if (existing) {
    if (existing.state !== 'subscribed') existing.subscribe();
    return existing;
  }

  const sub = centrifuge.newSubscription('global_updates');
  sub.on('publication', (ctx) => {
    const eventData = ctx.data;
    const supportedTypes = ['platform_event', 'company_status_changed', 'db_change'];
    if (!supportedTypes.includes(eventData?.type)) return;
    if (!shouldDeliverEventToCompany(eventData, companyId)) return;
    state.listeners.forEach((fn) => fn(eventData));
  });
  sub.subscribe();
  return sub;
}

function destroyInstance(state: CentrifugoState) {
  if (!state.instance) return;
  try {
    state.instance.disconnect();
  } catch {
    // ignore
  }
  state.instance = null;
  state.companyId = null;
  state.authToken = null;
  state.connected = false;
}

export async function connectCentrifugo(authToken: string, companyId: string): Promise<boolean> {
  const state = getState();
  const centrifugoUrl = process.env.NEXT_PUBLIC_CENTRIFUGO_URL?.trim();

  if (!centrifugoUrl) {
    console.warn('[CentrifugoClient] NEXT_PUBLIC_CENTRIFUGO_URL is not set');
    return false;
  }

  if (state.connected && state.instance && state.companyId === companyId && state.authToken === authToken) {
    return true;
  }
  if (state.connecting) return state.connected;

  const now = Date.now();
  if (now - state.lastConnectAttemptAt < 2000) return state.connected;
  state.lastConnectAttemptAt = now;

  if (state.instance && (state.companyId !== companyId || state.authToken !== authToken)) {
    destroyInstance(state);
  }

  state.connecting = true;

  try {
    const res = await fetch('/api/v1/realtime/token', {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const data = await res.json();

    if (!data.success || !data.token) {
      throw new Error(data.message || 'Failed to get realtime token');
    }

    let centrifuge = state.instance;
    if (!centrifuge) {
      centrifuge = new Centrifuge(centrifugoUrl, {
        token: data.token,
        minReconnectDelay: 1000,
        maxReconnectDelay: 20000,
      });

      centrifuge.on('connected', () => {
        state.connected = true;
      });
      centrifuge.on('disconnected', () => {
        state.connected = false;
      });
      centrifuge.on('error', (err) => logTransportError(err));

      state.instance = centrifuge;
      state.companyId = companyId;
      state.authToken = authToken;
    } else {
      centrifuge.setToken(data.token);
    }

    attachSubscription(centrifuge, companyId);
    centrifuge.connect();

    return true;
  } catch (err) {
    logTransportError(err);
    destroyInstance(state);
    return false;
  } finally {
    state.connecting = false;
  }
}

export function onCentrifugoEvent(callback: (data: any) => void): () => void {
  const state = getState();
  state.listeners.add(callback);
  return () => {
    state.listeners.delete(callback);
  };
}

export function isCentrifugoConnected(): boolean {
  return getState().connected;
}

export function getCentrifugoRetryIntervalMs(): number {
  return RETRY_MS;
}
