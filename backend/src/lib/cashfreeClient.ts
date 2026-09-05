import { getCashfreeConfig, paiseToCashfreeAmount } from './cashfreeConfig';

type CreateOrderInput = {
  orderId: string;
  amountPaise: number;
  invoiceNumber: string;
  invoiceId: string;
  customer: {
    id: string;
    name?: string;
    email?: string;
    phone?: string;
  };
};

export async function createCashfreeOrder(input: CreateOrderInput) {
  const cfg = getCashfreeConfig();

  const returnUrl = `${cfg.frontendUrl}/dashboard/orders?payment=return&order_id={order_id}&invoice_id=${encodeURIComponent(input.invoiceId)}`;
  const notifyUrl = `${cfg.backendUrl}/api/v1/payments/cashfree/webhook`;

  const response = await fetch(`${cfg.baseUrl}/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'x-api-version': cfg.apiVersion,
      'X-Client-Id': cfg.appId,
      'X-Client-Secret': cfg.secretKey,
    },
    body: JSON.stringify({
      order_id: input.orderId,
      order_amount: paiseToCashfreeAmount(input.amountPaise),
      order_currency: 'INR',
      order_note: input.invoiceNumber,
      customer_details: {
        customer_id: input.customer.id,
        customer_name: input.customer.name || 'Buyer',
        customer_email: input.customer.email || 'buyer@example.com',
        customer_phone: input.customer.phone || '9999999999',
      },
      order_meta: {
        return_url: returnUrl,
        notify_url: notifyUrl,
      },
      order_tags: {
        invoice_id: input.invoiceId,
      },
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      data?.message ||
      data?.error?.message ||
      `Cashfree order creation failed (${response.status})`;
    throw new Error(message);
  }

  return data as {
    order_id: string;
    payment_session_id: string;
    order_status?: string;
  };
}

export async function fetchCashfreeOrder(orderId: string) {
  const cfg = getCashfreeConfig();

  const response = await fetch(`${cfg.baseUrl}/orders/${encodeURIComponent(orderId)}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'x-api-version': cfg.apiVersion,
      'X-Client-Id': cfg.appId,
      'X-Client-Secret': cfg.secretKey,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      data?.message ||
      data?.error?.message ||
      `Cashfree order fetch failed (${response.status})`;
    throw new Error(message);
  }

  return data as CashfreeOrderResponse;
}

export type CashfreeOrderResponse = {
  order_id: string;
  order_status: string;
  order_amount: number;
  order_currency: string;
  order_tags?: Record<string, string> | { invoice_id?: string };
  payments?: Array<{ payment_status?: string; status?: string }>;
};

export function resolveInvoiceIdFromCashfreeOrder(
  cfOrder: CashfreeOrderResponse,
  fallbackInvoiceId?: string
): string | null {
  const tags = cfOrder.order_tags;
  if (tags && typeof tags === 'object') {
    const fromTag = (tags as { invoice_id?: string }).invoice_id;
    if (fromTag) return String(fromTag);
  }
  return fallbackInvoiceId || null;
}

export function isCashfreeOrderPaid(cfOrder: CashfreeOrderResponse): boolean {
  const status = String(cfOrder.order_status || '').toUpperCase();
  if (['PAID', 'SUCCESS'].includes(status)) return true;

  const payments = cfOrder.payments;
  if (Array.isArray(payments)) {
    return payments.some((p) =>
      ['SUCCESS', 'PAID', 'COMPLETED'].includes(
        String(p.payment_status || p.status || '').toUpperCase()
      )
    );
  }
  return false;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Poll Cashfree until paid or terminal failure (handles redirect return lag). */
export async function fetchCashfreeOrderUntilSettled(
  orderId: string,
  opts?: { attempts?: number; delayMs?: number }
): Promise<CashfreeOrderResponse> {
  const attempts = opts?.attempts ?? 6;
  const delayMs = opts?.delayMs ?? 1500;
  let last!: CashfreeOrderResponse;

  for (let i = 0; i < attempts; i++) {
    last = await fetchCashfreeOrder(orderId);
    if (isCashfreeOrderPaid(last)) return last;

    const status = String(last.order_status || '').toUpperCase();
    if (['EXPIRED', 'CANCELLED', 'TERMINATED', 'FAILED'].includes(status)) {
      return last;
    }
    if (i < attempts - 1) await sleep(delayMs);
  }

  return last;
}
