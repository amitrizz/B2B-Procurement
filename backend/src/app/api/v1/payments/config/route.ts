import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, authErrorResponse } from '@/lib/auth';
import { getPlatformBilling } from '@/lib/platformBilling';
import { getAppConfig } from '@/lib/appConfig';
import { getCashfreeConfig, getSupplierPayoutConfig } from '@/lib/cashfreeConfig';

/** Payment settings shown to buyers before checkout. */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user || !user.companyId) return authErrorResponse();

    const platform = await getPlatformBilling();
    const cashfree = getCashfreeConfig();
    const app = getAppConfig();
    const payout = getSupplierPayoutConfig();

    return NextResponse.json({
      success: true,
      data: {
        stubMode: cashfree.stubMode,
        provider: cashfree.stubMode ? 'DEV_STUB' : 'CASHFREE',
        environment: cashfree.environment,
        deployment: app.deployment,
        supplierPayoutMode: payout.mode,
        supplierPayoutLedgerOnly: payout.ledgerOnly,
        platform: {
          name: platform.name,
          gstin: platform.gstin,
          state: platform.state,
        },
        instructions: cashfree.stubMode
          ? 'Cashfree keys are not configured. Use the simulated payment flow for local testing.'
          : 'You will pay the platform securely via Cashfree checkout.',
      },
    });
  } catch (error) {
    console.error('Payment config error:', error);
    return NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: 'Internal server error' },
      { status: 500 }
    );
  }
}
