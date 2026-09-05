/**
 * Singleton Centrifugo WebSocket client.
 */
import { Centrifuge } from 'centrifuge';
import { shouldDeliverEventToCompany } from './realtimeNotifications';

interface CentrifugoState {
  instance: Centrifuge | null;
  companyId: string | null;
  connecting: boolean;
  connected: boolean;
  listeners: Set<(data: any) => void>;
  lastTransportErrorAt: number;
}

const KEY = '__centrifugo_state';

function getState(): CentrifugoState {
  if (!(globalThis as any)[KEY]) {
    (globalThis as any)[KEY] = {
      instance: null,
      companyId: null,
      connecting: false,
      connected: false,
      listeners: new Set(),
      lastTransportErrorAt: 0,
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
  state.connected = false;
}

function waitForConnection(centrifuge: Centrifuge, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    if (centrifuge.state === 'connected') {
      resolve();
      return;
    }

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('Centrifugo connection timed out'));
    }, timeoutMs);

    const onConnected = () => {
      cleanup();
      resolve();
    };

    const onError = (ctx: unknown) => {
      if (isBenignTransportError(ctx)) return;
      cleanup();
      reject((ctx as { error?: unknown })?.error ?? ctx);
    };

    const cleanup = () => {
      clearTimeout(timer);
      centrifuge.off('connected', onConnected);
      centrifuge.off('error', onError);
    };

    centrifuge.on('connected', onConnected);
    centrifuge.on('error', onError);
  });
}

export async function connectCentrifugo(authToken: string, companyId: string) {
  const state = getState();
  const centrifugoUrl = process.env.NEXT_PUBLIC_CENTRIFUGO_URL;

  if (!centrifugoUrl) {
    console.warn('[CentrifugoClient] NEXT_PUBLIC_CENTRIFUGO_URL is not set');
    return;
  }

  if (state.connected && state.instance && state.companyId === companyId) return;
  if (state.connecting) return;

  if (state.instance) {
    destroyInstance(state);
  }

  state.connecting = true;
  let centrifuge: Centrifuge | null = null;

  try {
    const res = await fetch('/api/v1/realtime/token', {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const data = await res.json();

    if (!data.success || !data.token) {
      throw new Error(`Backend returned: ${JSON.stringify(data)}`);
    }

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

    attachSubscription(centrifuge, companyId);
    centrifuge.connect();
    await waitForConnection(centrifuge, 8000);

    state.instance = centrifuge;
    state.companyId = companyId;
  } catch (err) {
    logTransportError(err);
    if (centrifuge) {
      try {
        centrifuge.disconnect();
      } catch {
        // ignore
      }
    }
    destroyInstance(state);
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
