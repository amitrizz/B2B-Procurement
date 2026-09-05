type CashfreeCheckoutResult = {
  error?: { message?: string };
  redirect?: boolean;
  paymentDetails?: { paymentMessage?: string };
};

declare global {
  interface Window {
    Cashfree?: (opts: { mode: string }) => {
      checkout: (opts: Record<string, unknown>) => Promise<CashfreeCheckoutResult>;
    };
  }
}

const CASHFREE_SDK = 'https://sdk.cashfree.com/js/v3/cashfree.js';

export function loadCashfreeSdk(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.Cashfree) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${CASHFREE_SDK}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Failed to load Cashfree SDK')));
      if (window.Cashfree) resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = CASHFREE_SDK;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Cashfree SDK'));
    document.body.appendChild(script);
  });
}

export async function runCashfreeCheckout(input: {
  paymentSessionId: string;
  environment: string;
  container?: HTMLElement | null;
}): Promise<CashfreeCheckoutResult> {
  await loadCashfreeSdk();
  if (!window.Cashfree) {
    throw new Error('Cashfree SDK unavailable');
  }

  const cashfree = window.Cashfree({
    mode: input.environment === 'production' ? 'production' : 'sandbox',
  });

  const checkoutOptions: Record<string, unknown> = {
    paymentSessionId: input.paymentSessionId,
  };

  if (input.container) {
    checkoutOptions.redirectTarget = input.container;
    checkoutOptions.appearance = { width: '100%', height: '520px' };
  } else {
    checkoutOptions.redirectTarget = '_modal';
  }

  return cashfree.checkout(checkoutOptions);
}

const PENDING_KEY = 'cf_pending_payment';

export function storePendingPayment(invoiceId: string, orderId: string) {
  if (typeof window === 'undefined') return;
  const payload = JSON.stringify({ invoiceId, orderId, at: Date.now() });
  sessionStorage.setItem(PENDING_KEY, payload);
  try {
    localStorage.setItem(PENDING_KEY, payload);
  } catch {
    /* ignore quota errors */
  }
}

export function readPendingPayment(): { invoiceId: string; orderId: string } | null {
  if (typeof window === 'undefined') return null;
  const raw =
    sessionStorage.getItem(PENDING_KEY) || localStorage.getItem(PENDING_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearPendingPayment() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(PENDING_KEY);
  localStorage.removeItem(PENDING_KEY);
}

export function readPaymentReturnParams(): { orderId: string; invoiceId: string | null } | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const isReturn =
    params.get('payment') === 'return' ||
    params.has('payment-return') ||
    params.get('payment-return') === '';
  if (!isReturn) return null;
  const orderId = params.get('order_id');
  if (!orderId) return null;
  return {
    orderId,
    invoiceId: params.get('invoice_id'),
  };
}

export function clearPaymentReturnQuery() {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  url.searchParams.delete('payment');
  url.searchParams.delete('payment-return');
  url.searchParams.delete('order_id');
  url.searchParams.delete('invoice_id');
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
}
