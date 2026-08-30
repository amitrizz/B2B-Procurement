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
    const { status, deliveryCharge, transporterId } = await req.json();

    await db();
    const { DeliveryOrder } = await import('@/models/Logistics');
    const { PurchaseOrder } = await import('@/models/PurchaseOrder');

    const delivery = await DeliveryOrder.findById(id).lean() as any;

    if (!delivery) {
      return console.log(`[API Response] /api/v1/transporter/deliveries/[id] - Sending response`), NextResponse.json(
        { success: false, code: 'NOT_FOUND', message: 'Delivery order not found' },
        { status: 404 }
      );
    }

    const data: any = {};
    if (status) data.status = status;
    if (deliveryCharge !== undefined) data.deliveryCharge = deliveryCharge;
    if (transporterId) data.transporterId = transporterId;

    const session = await mongoose.startSession();
    let updatedDelivery: any = null;

    try {
      session.startTransaction();

      const devOrderDoc = await DeliveryOrder.findByIdAndUpdate(
        id,
        { $set: data },
        { new: true, session }
      ).lean() as any;
      
      updatedDelivery = devOrderDoc ? { ...devOrderDoc, id: devOrderDoc._id.toString() } : null;

      // Map delivery order status back to Purchase Order status
      let poStatus = '';
      if (status === 'PICKED_UP') poStatus = 'PICKED_UP';
      else if (status === 'IN_TRANSIT') poStatus = 'IN_TRANSIT';
      else if (status === 'DELIVERED') poStatus = 'DELIVERED';

      if (poStatus && devOrderDoc) {
        await PurchaseOrder.updateOne(
          { _id: devOrderDoc.purchaseOrderId },
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

    return console.log(`[API Response] /api/v1/transporter/deliveries/[id] - Sending response`), NextResponse.json({
      success: true,
      message: 'Delivery order updated successfully',
      data: updatedDelivery,
    });
  } catch (error: any) {
    console.error('Update delivery error:', error);
    return console.log(`[API Response] /api/v1/transporter/deliveries/[id] - Sending response`), NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: 'Internal server error' },
      { status: 500 }
    );
  }
}
