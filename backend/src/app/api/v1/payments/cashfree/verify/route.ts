import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, authErrorResponse } from '@/lib/auth';
import { confirmInvoicePayment } from '@/lib/confirmInvoicePayment';
import { getCashfreeConfig } from '@/lib/cashfreeConfig';
import {
  fetchCashfreeOrder,
  fetchCashfreeOrderUntilSettled,
  isCashfreeOrderPaid,
  resolveInvoiceIdFromCashfreeOrder,
} from '@/lib/cashfreeClient';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user || !user.companyId) return authErrorResponse();

    const { invoiceId: bodyInvoiceId, orderId, poll } = await req.json();

    if (!orderId) {
      return NextResponse.json(
        { success: false, code: 'BAD_REQUEST', message: 'orderId is required' },
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

    const cfOrder =
      poll === false
        ? await fetchCashfreeOrder(orderId)
        : await fetchCashfreeOrderUntilSettled(orderId);

    const taggedInvoiceId = resolveInvoiceIdFromCashfreeOrder(cfOrder, bodyInvoiceId);
    const invoiceId = bodyInvoiceId || taggedInvoiceId;

    if (!invoiceId) {
      return NextResponse.json(
        { success: false, code: 'NOT_FOUND', message: 'Could not resolve invoice for this payment' },
        { status: 400 }
      );
    }

    if (taggedInvoiceId && bodyInvoiceId && taggedInvoiceId !== bodyInvoiceId) {
      return NextResponse.json(
        { success: false, code: 'MISMATCH', message: 'Invoice does not match Cashfree order' },
        { status: 400 }
      );
    }

    if (!isCashfreeOrderPaid(cfOrder)) {
      return NextResponse.json(
        {
          success: false,
          code: 'PAYMENT_PENDING',
          message: `Payment not completed yet (status: ${cfOrder.order_status || 'UNKNOWN'})`,
          data: { orderStatus: cfOrder.order_status },
        },
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

    return NextResponse.json({
      success: true,
      message: result.message,
      data: { alreadyPaid: (result as { alreadyPaid?: boolean }).alreadyPaid === true },
    });
  } catch (error: any) {
    console.error('Cashfree verify error:', error);
    return NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
