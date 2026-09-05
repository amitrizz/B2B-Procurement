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

  const returnUrl = `${cfg.frontendUrl}/dashboard/orders?payment=return&order_id={order_id}`;
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

  return data as {
    order_id: string;
    order_status: string;
    order_amount: number;
    order_currency: string;
    order_tags?: { invoice_id?: string };
  };
}
