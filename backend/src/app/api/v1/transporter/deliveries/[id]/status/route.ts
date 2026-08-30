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
    if (!user) return authErrorResponse();

    const { id } = await params;
    const { status, podFileId, deliveryCharge } = await req.json();

    await db();
    const { DeliveryOrder } = await import('@/models/Logistics');
    const { PurchaseOrder } = await import('@/models/PurchaseOrder');

    const delivery = await DeliveryOrder.findById(id).lean() as any;
    
    if (!delivery) {
      return console.log(`[API Response] /api/v1/transporter/deliveries/[id]/status - Sending response`), NextResponse.json(
        { success: false, code: 'NOT_FOUND', message: 'Delivery not found' },
        { status: 404 }
      );
    }

    const purchaseOrder = await PurchaseOrder.findById(delivery.purchaseOrderId).lean() as any;

    // RBAC
    let isAllowed = false;
    if (user.role === 'PLATFORM_ADMIN') {
      isAllowed = true;
    } else if (user.companyId && purchaseOrder && (purchaseOrder.buyerCompanyId.toString() === user.companyId || purchaseOrder.supplierCompanyId.toString() === user.companyId)) {
      isAllowed = true;
    }
    // Phase 1 ignores explicit Transporter user mapping as per PRD unless admin

    if (!isAllowed) {
      return console.log(`[API Response] /api/v1/transporter/deliveries/[id]/status - Sending response`), NextResponse.json(
        { success: false, code: 'FORBIDDEN', message: 'Forbidden' },
        { status: 403 }
      );
    }

    // Valid transitions
    const validTransitions: Record<string, string[]> = {
      'CREATED': ['ACCEPTED'],
      'ACCEPTED': ['PICKED_UP'],
      'PICKED_UP': ['IN_TRANSIT', 'DELIVERED'],
      'IN_TRANSIT': ['DELIVERED'],
      'DELIVERED': []
    };

    if (!validTransitions[delivery.status]?.includes(status)) {
      return console.log(`[API Response] /api/v1/transporter/deliveries/[id]/status - Sending response`), NextResponse.json(
        { success: false, code: 'INVALID_TRANSITION', message: `Cannot transition delivery from ${delivery.status} to ${status}` },
        { status: 400 }
      );
    }

    if (status === 'DELIVERED' && !podFileId) {
      return console.log(`[API Response] /api/v1/transporter/deliveries/[id]/status - Sending response`), NextResponse.json(
        { success: false, code: 'POD_REQUIRED', message: 'Proof of Delivery (podFileId) is required to mark as DELIVERED' },
        { status: 400 }
      );
    }

    if (status === 'ACCEPTED' && deliveryCharge !== undefined) {
      if (typeof deliveryCharge !== 'number' || deliveryCharge < 0) {
        return console.log(`[API Response] /api/v1/transporter/deliveries/[id]/status - Sending response`), NextResponse.json({ success: false, code: 'BAD_REQUEST', message: 'Invalid delivery charge' }, { status: 400 });
      }
    }

    const session = await mongoose.startSession();
    let updatedDelivery: any = null;

    try {
      session.startTransaction();

      const dataToUpdate: any = { status };
      if (status === 'DELIVERED' && podFileId) dataToUpdate.podFileId = podFileId;
      if (status === 'ACCEPTED' && deliveryCharge !== undefined) dataToUpdate.deliveryCharge = deliveryCharge;

      const updatedDoc = await DeliveryOrder.findByIdAndUpdate(
        id,
        { $set: dataToUpdate },
        { new: true, session }
      ).lean() as any;
      
      updatedDelivery = updatedDoc ? { ...updatedDoc, id: updatedDoc._id.toString() } : null;

      // Map to PO status
      let poStatus = null;
      if (status === 'PICKED_UP') poStatus = 'READY_FOR_PICKUP'; // Assuming pickup matchesREADY_FOR_PICKUP or IN_TRANSIT
      if (status === 'IN_TRANSIT') poStatus = 'IN_TRANSIT';
      if (status === 'DELIVERED') poStatus = 'DELIVERED';

      if (poStatus) {
        await PurchaseOrder.updateOne(
          { _id: delivery.purchaseOrderId },
          { $set: { status: poStatus } },
          { session }
        );
      }

      await session.commitTransaction();
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }

    return console.log(`[API Response] /api/v1/transporter/deliveries/[id]/status - Sending response`), NextResponse.json({
      success: true,
      message: 'Delivery status updated',
      data: updatedDelivery,
    });
  } catch (error: any) {
    console.error('Update delivery status error:', error);
    return console.log(`[API Response] /api/v1/transporter/deliveries/[id]/status - Sending response`), NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: 'Internal server error' },
      { status: 500 }
    );
  }
}
