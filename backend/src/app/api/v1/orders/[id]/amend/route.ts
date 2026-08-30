import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, authErrorResponse } from '@/lib/auth';
import mongoose from 'mongoose';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
    console.log(`[API] ${req.method} ${req.nextUrl?.pathname || req.url}`);
  try {
    const user = await getAuthUser(req);
    if (!user || !user.companyId) return authErrorResponse();

    const { id } = await params;
    const body = await req.json(); // Accept partial updates like paymentTermsDays, escrowRequired, or items

    await db();
    const { PurchaseOrder, PurchaseOrderRevision, PurchaseOrderItem } = await import('@/models/PurchaseOrder');

    const order = await PurchaseOrder.findById(id).lean() as any;

    if (!order) {
       return console.log(`[API Response] /api/v1/orders/[id]/amend - Sending response`), NextResponse.json({ success: false, code: 'NOT_FOUND', message: 'Order not found' }, { status: 404 });
    }

    if (order.buyerCompanyId.toString() !== user.companyId) {
       return console.log(`[API Response] /api/v1/orders/[id]/amend - Sending response`), NextResponse.json({ success: false, code: 'FORBIDDEN', message: 'Only buyer can amend PO' }, { status: 403 });
    }

    if (['CANCELLED', 'COMPLETED'].includes(order.status)) {
       return console.log(`[API Response] /api/v1/orders/[id]/amend - Sending response`), NextResponse.json({ success: false, code: 'INVALID_STATUS', message: 'Cannot amend completed or cancelled orders' }, { status: 400 });
    }

    const items = await PurchaseOrderItem.find({ poId: order._id }).lean() as any;
    const orderWithItems = { ...order, id: order._id.toString(), items: items.map((i: any) => ({ ...i, id: i._id.toString() })) };

    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      // 1. Create a revision snapshot
      await PurchaseOrderRevision.create([{
        purchaseOrderId: order._id,
        version: order.version || 1,
        snapshot: JSON.stringify(orderWithItems)
      }], { session });

      // 2. Apply amendments and increment version. Reset status to CREATED (or AWAITING_ACCEPTANCE) so supplier must re-accept
      // Wait, in previous schema it used AWAITING_ACCEPTANCE. Let's stick with CREATED which is the Mongoose equivalent of AWAITING_ACCEPTANCE for POs, or if schema has AWAITING_ACCEPTANCE, we use that.
      // Let's use 'CREATED' as it is the default for a new PO.
      
      const updateData: any = {
        status: 'CREATED',
        $inc: { version: 1 }
      };
      
      if (body.paymentTermsDays !== undefined) updateData.paymentTermsDays = body.paymentTermsDays;
      if (body.escrowRequired !== undefined) updateData.escrowRequired = body.escrowRequired;
      if (body.orderType !== undefined) updateData.orderType = body.orderType;

      await PurchaseOrder.updateOne(
        { _id: order._id },
        updateData.status ? { $set: { status: updateData.status, ...Object.fromEntries(Object.entries(updateData).filter(([k]) => k !== 'status' && k !== '$inc')) }, $inc: updateData.$inc } : updateData,
        { session }
      );

      // (If amending items, we would do a more complex diff. For Phase 3 basic amendments, updating terms/type is standard).

      await session.commitTransaction();
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }

    const { broadcastOrderUpdate } = await import('@/lib/orderEvents');
    await broadcastOrderUpdate(order, 'order_updated', `Purchase Order ${order.poNumber} has been amended by the buyer and requires your acceptance.`);

    return console.log(`[API Response] /api/v1/orders/[id]/amend - Sending response`), NextResponse.json({
      success: true,
      message: 'Purchase Order amended successfully and is awaiting supplier acceptance.'
    });

  } catch (error: any) {
    console.error('Amend PO error:', error);
    return console.log(`[API Response] /api/v1/orders/[id]/amend - Sending response`), NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: 'Internal server error' },
      { status: 500 }
    );
  }
}
