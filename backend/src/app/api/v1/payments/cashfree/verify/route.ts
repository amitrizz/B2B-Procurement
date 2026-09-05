import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, authErrorResponse } from '@/lib/auth';
import { confirmInvoicePayment } from '@/lib/confirmInvoicePayment';
import { getCashfreeConfig } from '@/lib/cashfreeConfig';
import { fetchCashfreeOrder } from '@/lib/cashfreeClient';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user || !user.companyId) return authErrorResponse();

    const { invoiceId, orderId } = await req.json();

    if (!invoiceId || !orderId) {
      return NextResponse.json(
        { success: false, code: 'BAD_REQUEST', message: 'invoiceId and orderId are required' },
        { status: 400 }
      );
    }

    const { stubMode } = getCashfreeConfig();
    if (stubMode) {
      return NextResponse.json(
        { success: false, code: 'INVALID_MODE', message: 'Cashfree verify is not available in stub mode' },
        { status: 400 }
      );
    }

    const cfOrder = await fetchCashfreeOrder(orderId);
    const paidStatuses = ['PAID', 'SUCCESS'];
    if (!paidStatuses.includes(String(cfOrder.order_status || '').toUpperCase())) {
      return NextResponse.json(
        {
          success: false,
          code: 'PAYMENT_PENDING',
          message: `Payment not completed yet (status: ${cfOrder.order_status})`,
        },
        { status: 400 }
      );
    }

    const taggedInvoiceId = cfOrder.order_tags?.invoice_id;
    if (taggedInvoiceId && taggedInvoiceId !== invoiceId) {
      return NextResponse.json(
        { success: false, code: 'MISMATCH', message: 'Invoice does not match Cashfree order' },
        { status: 400 }
      );
    }

    const result = await confirmInvoicePayment(invoiceId, user.companyId, {
      method: 'CASHFREE',
      utrNumber: orderId,
    });

    if (!result.ok) {
      return NextResponse.json(
        { success: false, code: result.code, message: result.message },
        { status: result.status }
      );
    }

    return NextResponse.json({ success: true, message: result.message });
  } catch (error: any) {
    console.error('Cashfree verify error:', error);
    return NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
