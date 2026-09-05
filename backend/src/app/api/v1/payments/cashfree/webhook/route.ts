import { NextRequest, NextResponse } from 'next/server';
import { confirmInvoicePayment } from '@/lib/confirmInvoicePayment';
import { fetchCashfreeOrder } from '@/lib/cashfreeClient';
import { verifyCashfreeWebhookSignature } from '@/lib/cashfreeWebhook';

/** Cashfree payment webhook (server-to-server). */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-webhook-signature');
    const timestamp = req.headers.get('x-webhook-timestamp');

    const verified = verifyCashfreeWebhookSignature(rawBody, signature, timestamp);
    if (!verified.ok) {
      console.warn('Cashfree webhook rejected:', verified.message);
      return NextResponse.json({ success: false, message: verified.message }, { status: 401 });
    }

    const event = JSON.parse(rawBody);
    const eventType = event?.type || event?.event || '';
    const orderId =
      event?.data?.order?.order_id ||
      event?.data?.order_id ||
      event?.order_id;

    if (!orderId) {
      return NextResponse.json({ success: true, message: 'ignored' });
    }

    if (!String(eventType).toLowerCase().includes('payment') && !String(eventType).toLowerCase().includes('order')) {
      return NextResponse.json({ success: true, message: 'ignored' });
    }

    const cfOrder = await fetchCashfreeOrder(String(orderId));
    if (String(cfOrder.order_status || '').toUpperCase() !== 'PAID') {
      return NextResponse.json({ success: true, message: 'not paid yet' });
    }

    const invoiceId = cfOrder.order_tags?.invoice_id;
    if (!invoiceId) {
      return NextResponse.json({ success: true, message: 'no invoice tag' });
    }

    const { db } = await import('@/lib/db');
    await db();
    const { Invoice } = await import('@/models/Finance');
    const invoice = (await Invoice.findById(invoiceId).lean()) as any;
    if (!invoice?.payerCompanyId) {
      return NextResponse.json({ success: true, message: 'invoice not found' });
    }

    await confirmInvoicePayment(invoiceId, invoice.payerCompanyId.toString(), {
      method: 'CASHFREE',
      utrNumber: String(orderId),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Cashfree webhook error:', error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
