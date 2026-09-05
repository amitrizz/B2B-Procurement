import { getAppConfig } from './appConfig';

export type CashfreeEnvironment = 'sandbox' | 'production';
export type SupplierPayoutMode = 'ledger' | 'cashfree';

export function getCashfreeConfig() {
  const app = getAppConfig();

  const appId =
    process.env.CASHFREE_APP_ID ||
    process.env.CASHFREE_CLIENT_ID ||
    process.env.CASHFREE_X_CLIENT_ID ||
    '';
  const secretKey =
    process.env.CASHFREE_SECRET_KEY ||
    process.env.CASHFREE_CLIENT_SECRET ||
    process.env.CASHFREE_X_CLIENT_SECRET ||
    '';

  const environment: CashfreeEnvironment =
    process.env.CASHFREE_ENV === 'production' || app.isProduction ? 'production' : 'sandbox';

  const stubMode =
    process.env.PAYMENT_MODE === 'stub' ||
    !appId ||
    !secretKey ||
    appId === 'cf_test_stub';

  const baseUrl =
    environment === 'production'
      ? 'https://api.cashfree.com/pg'
      : 'https://sandbox.cashfree.com/pg';

  const payoutBaseUrl =
    environment === 'production'
      ? 'https://api.cashfree.com/payout'
      : 'https://sandbox.cashfree.com/payout';

  const webhookSecret = process.env.CASHFREE_WEBHOOK_SECRET || '';
  const verifyWebhooks =
    process.env.CASHFREE_VERIFY_WEBHOOKS === 'true' ||
    (app.isProduction && process.env.CASHFREE_VERIFY_WEBHOOKS !== 'false');

  return {
    appId,
    secretKey,
    environment,
    stubMode,
    baseUrl,
    payoutBaseUrl,
    apiVersion: process.env.CASHFREE_API_VERSION || '2025-01-01',
    payoutApiVersion: process.env.CASHFREE_PAYOUT_API_VERSION || '2024-01-01',
    frontendUrl: app.frontendUrl,
    backendUrl: app.backendUrl,
    webhookSecret,
    verifyWebhooks,
    deployment: app.deployment,
    isProduction: app.isProduction,
  };
}

export function getSupplierPayoutConfig() {
  const app = getAppConfig();
  const cashfree = getCashfreeConfig();

  const payoutClientId = process.env.CASHFREE_PAYOUT_CLIENT_ID || '';
  const payoutClientSecret = process.env.CASHFREE_PAYOUT_CLIENT_SECRET || '';

  const mode: SupplierPayoutMode = app.supplierPayoutMode;
  const cashfreeEnabled =
    mode === 'cashfree' && Boolean(payoutClientId && payoutClientSecret);

  return {
    mode,
    /** Bookkeeping-only release (default for sandbox). No bank transfer API. */
    ledgerOnly: mode === 'ledger' || !cashfreeEnabled,
    cashfreeEnabled,
    payoutClientId,
    payoutClientSecret,
    payoutBaseUrl: cashfree.payoutBaseUrl,
    payoutApiVersion: cashfree.payoutApiVersion,
    environment: cashfree.environment,
  };
}

export function paiseToCashfreeAmount(paise: number): number {
  return Number((paise / 100).toFixed(2));
}

export function buildCashfreeOrderId(invoiceId: string): string {
  const safe = invoiceId.replace(/[^a-zA-Z0-9]/g, '').slice(-20);
  return `inv_${safe}_${Date.now()}`;
}
