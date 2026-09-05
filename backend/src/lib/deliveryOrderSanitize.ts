/** Strip OTP secrets from delivery payloads based on viewer role. */

const OTP_HASH_KEYS = ['pickupOtpHash', 'deliveryOtpHash', 'otpHash'] as const;
const OTP_PLAIN_KEYS = ['pickupOtp', 'deliveryOtp', 'otp'] as const;

function stripOtpFields(delivery: Record<string, unknown>): Record<string, unknown> {
  const out = { ...delivery };
  for (const key of OTP_HASH_KEYS) delete out[key];
  for (const key of OTP_PLAIN_KEYS) delete out[key];
  return out;
}

export function sanitizeDeliveryOrder(
  delivery: any,
  opts: {
    role: string;
    isBuyer?: boolean;
    isSupplier?: boolean;
  }
): any {
  if (!delivery) return null;

  const raw = typeof delivery.toObject === 'function' ? delivery.toObject() : { ...delivery };
  const id = raw.id || raw._id?.toString?.();
  const base = stripOtpFields({ ...raw, id });

  const requiresPickupOtp = Boolean(raw.pickupOtpHash);
  const requiresDeliveryOtp = Boolean(raw.deliveryOtpHash || raw.otpHash);

  if (opts.role === 'TRANSPORTER' || opts.role === 'PLATFORM_ADMIN') {
    return {
      ...base,
      requiresPickupOtp,
      requiresDeliveryOtp,
    };
  }

  if (opts.isSupplier && raw.pickupOtp) {
    return { ...base, pickupOtp: raw.pickupOtp };
  }

  if (opts.isBuyer) {
    const deliveryOtp = raw.deliveryOtp || raw.otp;
    if (deliveryOtp) {
      return { ...base, deliveryOtp };
    }
  }

  return base;
}
