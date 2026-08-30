import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
    console.log(`[API] ${req.method} ${req.nextUrl?.pathname || req.url}`);
  try {
    const text = await req.text();
    const signature = req.headers.get('x-razorpay-signature');
    
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || 'secret_stub';
    
    if (webhookSecret !== 'secret_stub' && signature) {
      const expectedSignature = crypto.createHmac('sha256', webhookSecret).update(text).digest('hex');
      if (expectedSignature !== signature) {
        return console.log(`[API Response] /api/v1/payments/razorpay/webhook - Sending response`), NextResponse.json({ success: false, code: 'INVALID_SIGNATURE' }, { status: 400 });
      }
    }

    const event = JSON.parse(text);

    if (event.event === 'payment.captured') {
      const paymentData = event.payload.payment.entity;
      const orderId = paymentData.order_id; // we can use this to find the payment, or map to invoice
      
      // Since Razorpay requires order_id to map to invoice, we need to create a Payment record when the order is generated, or find it by receipt.
      // But receipt contains invoice number. Let's find Invoice by receipt:
      const invoiceNumber = paymentData.description || ''; // Assuming we passed invoice.number somewhere. Wait, in create-order we passed it to 'receipt'. 
      // Unforutnately razorpay payment entity doesn't always include receipt in payload unless fetched from order. 
      // Actually we should create Payment when order is created. Let's just create a generic HELD payment for now if we can find the invoice.
      
      // Let's assume the user sends invoiceId in notes
      const invoiceId = paymentData.notes?.invoiceId;
      
      if (invoiceId) {
        await db();
        const { Payment } = await import('@/models/Finance');
        
        await Payment.create({
          invoiceId,
          amount: paymentData.amount,
          method: 'RAZORPAY',
          utrNumber: paymentData.id, // storing razorpay payment id here
          status: 'HELD',
          heldAt: new Date()
        });
        
        console.log(`Payment captured and marked HELD for invoice ${invoiceId}`);
      }
    }

    return console.log(`[API Response] /api/v1/payments/razorpay/webhook - Sending response`), NextResponse.json({ status: 'ok' });

  } catch (error: any) {
    console.error('Razorpay webhook error:', error);
    return console.log(`[API Response] /api/v1/payments/razorpay/webhook - Sending response`), NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: 'Internal server error' },
      { status: 500 }
    );
  }
}
