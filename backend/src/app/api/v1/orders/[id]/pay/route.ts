import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, authErrorResponse } from '@/lib/auth';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    console.log(`[API] ${req.method} ${req.nextUrl?.pathname || req.url}`);
  try {
    const user = await getAuthUser(req);
    if (!user || !user.companyId) return authErrorResponse();

    const { id } = await params;

    await db();
    const { PurchaseOrder } = await import('@/models/PurchaseOrder');

    const po = await PurchaseOrder.findById(id).lean() as any;

    if (!po) {
      return console.log(`[API Response] /api/v1/orders/[id]/pay - Sending response`), NextResponse.json({ success: false, code: 'NOT_FOUND', message: 'PO not found' }, { status: 404 });
    }

    if (po.buyerCompanyId.toString() !== user.companyId) {
      return console.log(`[API Response] /api/v1/orders/[id]/pay - Sending response`), NextResponse.json({ success: false, code: 'FORBIDDEN', message: 'You are not the buyer for this PO' }, { status: 403 });
    }

    // In mongoose schema, the status 'ACCEPTED' was replaced by 'CREATED'. 
    // If the schema allows ACCEPTED, use it, but the original logic says ACCEPTED -> PROCESSING.
    if (po.status !== 'ACCEPTED' && po.status !== 'CREATED') {
      return console.log(`[API Response] /api/v1/orders/[id]/pay - Sending response`), NextResponse.json({ success: false, code: 'INVALID_STATUS', message: 'PO must be ACCEPTED to make a payment' }, { status: 400 });
    }

    // Offline stub: directly move to PROCESSING
    const updatedPoDoc = await PurchaseOrder.findByIdAndUpdate(
      id,
      { $set: { status: 'PROCESSING' } },
      { new: true }
    ).lean() as any;
    
    const updatedPo = updatedPoDoc ? { ...updatedPoDoc, id: updatedPoDoc._id.toString() } : null;

    if (updatedPoDoc) {
      const { broadcastOrderUpdate } = await import('@/lib/orderEvents');
      await broadcastOrderUpdate(updatedPoDoc, 'order_updated', `Payment confirmed for order ${po.poNumber || po._id}`);
    }

    return console.log(`[API Response] /api/v1/orders/[id]/pay - Sending response`), NextResponse.json({
      success: true,
      message: 'Payment recorded (offline stub)',
      data: updatedPo,
    });
  } catch (error: any) {
    console.error('Pay PO error:', error);
    return console.log(`[API Response] /api/v1/orders/[id]/pay - Sending response`), NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: 'Internal server error' },
      { status: 500 }
    );
  }
}
