import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, authErrorResponse } from '@/lib/auth';
import Razorpay from 'razorpay';

export async function POST(req: NextRequest) {
    console.log(`[API] ${req.method} ${req.nextUrl?.pathname || req.url}`);
  try {
    const user = await getAuthUser(req);
    if (!user || !user.companyId) return authErrorResponse();

    const { invoiceId } = await req.json();

    if (!invoiceId) {
      return console.log(`[API Response] /api/v1/payments/razorpay/create-order - Sending response`), NextResponse.json({ success: false, code: 'BAD_REQUEST', message: 'invoiceId is required' }, { status: 400 });
    }

    await db();
    const { Invoice } = await import('@/models/Finance');

    const invoice = await Invoice.findById(invoiceId).lean() as any;

    if (!invoice) {
      return console.log(`[API Response] /api/v1/payments/razorpay/create-order - Sending response`), NextResponse.json({ success: false, code: 'NOT_FOUND', message: 'Invoice not found' }, { status: 404 });
    }

    if (invoice.payerCompanyId.toString() !== user.companyId) {
      return console.log(`[API Response] /api/v1/payments/razorpay/create-order - Sending response`), NextResponse.json({ success: false, code: 'FORBIDDEN', message: 'You are not the payer for this invoice' }, { status: 403 });
    }

    if (invoice.status !== 'UNPAID') {
      return console.log(`[API Response] /api/v1/payments/razorpay/create-order - Sending response`), NextResponse.json({ success: false, code: 'INVALID_STATUS', message: 'Invoice is already paid or settled' }, { status: 400 });
    }

    // Initialize Razorpay
    const key_id = process.env.RAZORPAY_KEY_ID || 'rzp_test_stub';
    const key_secret = process.env.RAZORPAY_KEY_SECRET || 'secret_stub';

    const instance = new Razorpay({ key_id, key_secret });

    const options = {
      amount: invoice.totalAmount || invoice.total, // amount in paise (schema uses totalAmount)
      currency: 'INR',
      receipt: invoice.invoiceNumber || invoice.number, // schema uses invoiceNumber
      notes: { invoiceId },
    };

    let order;
    if (key_id === 'rzp_test_stub') {
      // Offline fallback / stub for local dev without keys
      order = {
        id: `order_stub_${Date.now()}`,
        amount: options.amount,
        currency: 'INR',
        receipt: options.receipt,
      };
    } else {
      order = await instance.orders.create(options);
    }

    return console.log(`[API Response] /api/v1/payments/razorpay/create-order - Sending response`), NextResponse.json({
      success: true,
      data: {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: key_id
      }
    });

  } catch (error: any) {
    console.error('Razorpay create order error:', error);
    return console.log(`[API Response] /api/v1/payments/razorpay/create-order - Sending response`), NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: 'Internal server error' },
      { status: 500 }
    );
  }
}
