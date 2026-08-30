import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, authErrorResponse } from '@/lib/auth';
import mongoose from 'mongoose';

type Params = {
  params: Promise<{ id: string }>
}

export async function POST(req: NextRequest, { params }: Params) {
    console.log(`[API] ${req.method} ${req.nextUrl?.pathname || req.url}`);
  try {
    const user = await getAuthUser(req);
    if (!user || !user.companyId) return authErrorResponse();

    const { id } = await params;

    await db();
    const { PurchaseOrder } = await import('@/models/PurchaseOrder');
    const { GoodsReceipt } = await import('@/models/PurchaseOrder');
    const { RFQ } = await import('@/models/RFQ');

    const order = await PurchaseOrder.findById(id).lean() as any;

    if (!order) {
      return console.log(`[API Response] /api/v1/orders/[id]/confirm-delivery - Sending response`), NextResponse.json(
        { success: false, code: 'NOT_FOUND', message: 'Order not found' },
        { status: 404 }
      );
    }

    if (order.buyerCompanyId.toString() !== user.companyId) {
      return console.log(`[API Response] /api/v1/orders/[id]/confirm-delivery - Sending response`), NextResponse.json(
        { success: false, code: 'FORBIDDEN', message: 'Only the buyer can confirm delivery' },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const acceptedQty = body.acceptedQty || 1;
    const rejectedQty = body.rejectedQty || 0;
    const remarks = body.remarks || '';

    const { nextNumber } = await import('@/lib/sequence');
    const grnNumber = await nextNumber('GRN');

    const session = await mongoose.startSession();
    let updatedOrder: any = null;

    try {
      session.startTransaction();

      const updatedOrderDoc = await PurchaseOrder.findByIdAndUpdate(
        id,
        { $set: { status: 'COMPLETED' } },
        { new: true, session }
      ).lean() as any;
      
      updatedOrder = updatedOrderDoc ? { ...updatedOrderDoc, id: updatedOrderDoc._id.toString() } : null;

      await GoodsReceipt.create([{
        purchaseOrderId: id,
        grnNumber,
        acceptedQty,
        rejectedQty,
        remarks,
      }], { session });

      await session.commitTransaction();
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }

    if (updatedOrder && updatedOrder.rfqId) {
      const rfqOrders = await PurchaseOrder.find({ rfqId: updatedOrder.rfqId }).lean();
      const allCompleted = rfqOrders.every((o: any) => o.status === 'COMPLETED');
      if (allCompleted) {
        await RFQ.findByIdAndUpdate(updatedOrder.rfqId, { $set: { status: 'COMPLETED' } });
      }
    }

    return console.log(`[API Response] /api/v1/orders/[id]/confirm-delivery - Sending response`), NextResponse.json({
      success: true,
      message: 'Delivery confirmed and order completed',
      data: updatedOrder,
    });
  } catch (error: any) {
    console.error('Confirm delivery error:', error);
    return console.log(`[API Response] /api/v1/orders/[id]/confirm-delivery - Sending response`), NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: 'Internal server error' },
      { status: 500 }
    );
  }
}
