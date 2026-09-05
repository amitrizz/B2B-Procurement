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
    if (status) {
      if (status === 'PICKED_UP' && delivery.pickupOtpHash) {
        return NextResponse.json(
          {
            success: false,
            code: 'OTP_REQUIRED',
            message: 'Pickup OTP verification required. Use verify-otp with type PICKUP.',
          },
          { status: 400 }
        );
      }
      if (status === 'DELIVERED' && (delivery.deliveryOtpHash || delivery.otpHash)) {
        return NextResponse.json(
          {
            success: false,
            code: 'OTP_REQUIRED',
            message: 'Delivery OTP verification required. Use verify-otp with type DELIVERY.',
          },
          { status: 400 }
        );
      }

      data.status = status;
      // If a Transporter is accepting an open delivery, assign it to them
      if (status === 'ACCEPTED' && user.role === 'TRANSPORTER' && user.companyId) {
        data.transporterId = new mongoose.Types.ObjectId(user.companyId);
      }
    }
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

      if (poStatus && devOrderDoc?.purchaseOrderId) {
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

    if (updatedDelivery && updatedDelivery.purchaseOrderId) {
      const purchaseOrder = await PurchaseOrder.findById(updatedDelivery.purchaseOrderId).lean() as any;
      if (purchaseOrder) {
        const { broadcastOrderUpdate } = await import('@/lib/orderEvents');
        await broadcastOrderUpdate(
          purchaseOrder,
          'delivery_updated',
          `Delivery status updated to ${status} for order ${purchaseOrder.poNumber || purchaseOrder._id}.`
        );
      }
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
