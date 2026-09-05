export type DeploymentEnvironment = 'sandbox' | 'production';

export type AppConfig = {
  deployment: DeploymentEnvironment;
  isProduction: boolean;
  nodeEnv: string;
  frontendUrl: string;
  backendUrl: string;
  jwtSecret: string;
  bankHashPepper: string;
  platform: {
    legalName: string;
    gstin: string;
    state: string;
  };
  supplierPayoutMode: 'ledger' | 'cashfree';
  emailVerifyRequired: boolean;
};

function resolveDeployment(): DeploymentEnvironment {
  if (process.env.DEPLOYMENT_ENV === 'production' || process.env.APP_ENV === 'production') {
    return 'production';
  }
  if (process.env.DEPLOYMENT_ENV === 'sandbox' || process.env.APP_ENV === 'sandbox') {
    return 'sandbox';
  }
  if (process.env.NODE_ENV === 'production' && process.env.CASHFREE_ENV === 'production') {
    return 'production';
  }
  return 'sandbox';
}

function requireUrl(name: string, value: string | undefined, isProduction: boolean, devDefault: string): string {
  const url = value?.trim() || (isProduction ? '' : devDefault);
  if (!url && isProduction) {
    throw new Error(`${name} is required when DEPLOYMENT_ENV=production`);
  }
  return url.replace(/\/$/, '');
}

export function getAppConfig(): AppConfig {
  const deployment = resolveDeployment();
  const isProduction = deployment === 'production';
  const jwtSecret = process.env.JWT_SECRET || '';

  const payoutMode = (process.env.SUPPLIER_PAYOUT_MODE || 'ledger').toLowerCase();
  const supplierPayoutMode: 'ledger' | 'cashfree' =
    payoutMode === 'cashfree' ? 'cashfree' : 'ledger';

  return {
    deployment,
    isProduction,
    nodeEnv: process.env.NODE_ENV || 'development',
    frontendUrl: requireUrl(
      'FRONTEND_URL',
      process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_FRONTEND_URL,
      isProduction,
      'http://localhost:3000'
    ),
    backendUrl: requireUrl(
      'BACKEND_URL',
      process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL,
      isProduction,
      'http://localhost:3001'
    ),
    jwtSecret,
    bankHashPepper: process.env.BANK_HASH_PEPPER || jwtSecret || 'default-pepper',
    platform: {
      legalName: process.env.PLATFORM_LEGAL_NAME || 'P2P Procurement Platform Pvt Ltd',
      gstin: process.env.PLATFORM_GSTIN || '27AABCP1234A1Z5',
      state: process.env.PLATFORM_STATE || 'Maharashtra',
    },
    supplierPayoutMode,
    emailVerifyRequired: process.env.EMAIL_VERIFY_REQUIRED === 'true',
  };
}

export type EnvCheckResult = {
  ok: boolean;
  deployment: DeploymentEnvironment;
  errors: string[];
  warnings: string[];
};

/** Validates env for current deployment — run via `npm run env:check`. */
export function validateAppEnv(): EnvCheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  let config: AppConfig;
  try {
    config = getAppConfig();
  } catch (err: any) {
    return {
      ok: false,
      deployment: resolveDeployment(),
      errors: [err?.message || 'Invalid app config'],
      warnings: [],
    };
  }

  if (!process.env.DATABASE_URL) {
    errors.push('DATABASE_URL is required');
  }

  if (config.isProduction) {
    if (!config.jwtSecret || config.jwtSecret.includes('fallback')) {
      errors.push('JWT_SECRET must be set to a strong value in production');
    }
    if (!process.env.BANK_HASH_PEPPER) {
      warnings.push('BANK_HASH_PEPPER is not set — JWT_SECRET will be used as pepper');
    }
    if (process.env.PAYMENT_MODE === 'stub') {
      errors.push('PAYMENT_MODE=stub must not be used in production');
    }
  }

  const cashfreeEnv =
    process.env.CASHFREE_ENV === 'production' || config.isProduction ? 'production' : 'sandbox';
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

  if (config.isProduction) {
    if (cashfreeEnv !== 'production') {
      warnings.push('CASHFREE_ENV is not production — set CASHFREE_ENV=production for live payments');
    }
    if (!appId || !secretKey) {
      errors.push('CASHFREE_APP_ID and CASHFREE_SECRET_KEY are required in production');
    }
    if (!process.env.CASHFREE_WEBHOOK_SECRET) {
      warnings.push('CASHFREE_WEBHOOK_SECRET is recommended in production (webhook HMAC uses PG secret if unset)');
    }
  } else if (!appId || !secretKey) {
    warnings.push('Cashfree keys missing — PAYMENT_MODE=stub or empty keys will use simulated checkout');
  }

  if (config.supplierPayoutMode === 'cashfree') {
    const payoutId = process.env.CASHFREE_PAYOUT_CLIENT_ID || '';
    const payoutSecret = process.env.CASHFREE_PAYOUT_CLIENT_SECRET || '';
    if (!payoutId || !payoutSecret) {
      errors.push(
        'SUPPLIER_PAYOUT_MODE=cashfree requires CASHFREE_PAYOUT_CLIENT_ID and CASHFREE_PAYOUT_CLIENT_SECRET'
      );
    }
  }

  if (config.isProduction && !process.env.CENTRIFUGO_URL) {
    warnings.push('CENTRIFUGO_URL is not set — realtime updates may not work');
  }

  return {
    ok: errors.length === 0,
    deployment: config.deployment,
    errors,
    warnings,
  };
}
