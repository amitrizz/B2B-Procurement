import crypto from 'crypto';
import { getCashfreeConfig } from './cashfreeConfig';

/** Verify Cashfree PG webhook HMAC (timestamp + raw body). Skipped when verifyWebhooks=false. */
export function verifyCashfreeWebhookSignature(
  rawBody: string,
  signature: string | null,
  timestamp: string | null
): { ok: true } | { ok: false; message: string } {
  const cfg = getCashfreeConfig();

  if (!cfg.verifyWebhooks) {
    return { ok: true };
  }

  if (!signature || !timestamp) {
    return { ok: false, message: 'Missing Cashfree webhook signature headers' };
  }

  const secret = cfg.webhookSecret || cfg.secretKey;
  if (!secret) {
    return { ok: false, message: 'Cashfree webhook secret is not configured' };
  }

  const expected = crypto
    .createHmac('sha256', secret)
    .update(timestamp + rawBody)
    .digest('base64');

  const expectedBuf = Buffer.from(expected);
  const signatureBuf = Buffer.from(signature);

  if (expectedBuf.length !== signatureBuf.length || !crypto.timingSafeEqual(expectedBuf, signatureBuf)) {
    return { ok: false, message: 'Invalid Cashfree webhook signature' };
  }

  return { ok: true };
}
