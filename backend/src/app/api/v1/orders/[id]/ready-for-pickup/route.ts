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
    const { DeliveryOrder } = await import('@/models/Logistics');

    const order = await PurchaseOrder.findById(id).lean() as any;

    if (!order) {
      return console.log(`[API Response] /api/v1/orders/[id]/ready-for-pickup - Sending response`), NextResponse.json(
        { success: false, code: 'NOT_FOUND', message: 'Order not found' },
        { status: 404 }
      );
    }

    if (order.supplierCompanyId.toString() !== user.companyId) {
      return console.log(`[API Response] /api/v1/orders/[id]/ready-for-pickup - Sending response`), NextResponse.json(
        { success: false, code: 'FORBIDDEN', message: 'Only the supplier can set order as ready for pickup' },
        { status: 403 }
      );
    }

    let workImageId = '';
    try {
      const body = await req.json();
      workImageId = body.workImageId;
    } catch (e) {
      // Body might be empty or invalid JSON
    }

    if (!workImageId) {
      return console.log(`[API Response] /api/v1/orders/[id]/ready-for-pickup - Sending response`), NextResponse.json(
        { success: false, code: 'BAD_REQUEST', message: 'An image of the completed work is required to mark the order as ready for pickup' },
        { status: 400 }
      );
    }

    if (order.status !== 'PROCESSING_80') {
      return console.log(`[API Response] /api/v1/orders/[id]/ready-for-pickup - Sending response`), NextResponse.json(
        { success: false, code: 'INVALID_STATUS', message: 'Order must be 80% completed (PROCESSING_80) before marking ready for pickup' },
        { status: 400 }
      );
    }

    const deliveryNumber = 'DEL-' + Math.floor(100000 + Math.random() * 900000);

    const session = await mongoose.startSession();
    let result: any = null;

    try {
      session.startTransaction();

      const updatedOrderDoc = await PurchaseOrder.findByIdAndUpdate(
        id,
        {
          $set: {
            status: 'READY_FOR_PICKUP',
            workImageId,
          }
        },
        { new: true, session }
      ).lean() as any;
      
      const updatedOrder = updatedOrderDoc ? { ...updatedOrderDoc, id: updatedOrderDoc._id.toString() } : null;

      // Generate 6 digit OTP
      const crypto = await import('crypto');
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const otpHash = crypto.createHash('sha256').update(otp).digest('hex');

      const deliveryDoc = await DeliveryOrder.create([{
        deliveryNumber,
        purchaseOrderId: id,
        status: 'CREATED',
        deliveryCharge: 0,
        otpHash,
      }], { session });
      
      const delivery = deliveryDoc[0];

      await session.commitTransaction();

      result = { 
        updatedOrder, 
        delivery: { ...delivery.toObject(), id: delivery._id.toString() }, 
        otp 
      }; // Return OTP in response so supplier can see it and give to transporter
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }

    if (result && result.updatedOrder) {
      const { broadcastOrderUpdate } = await import('@/lib/orderEvents');
      await broadcastOrderUpdate(result.updatedOrder, 'order_updated', `Order ${order.poNumber || order._id} is ready for pickup`);
    }

    return console.log(`[API Response] /api/v1/orders/[id]/ready-for-pickup - Sending response`), NextResponse.json({
      success: true,
      message: 'Order marked ready for pickup. Delivery order generated.',
      data: result,
    });
  } catch (error: any) {
    console.error('Ready for pickup error:', error);
    return console.log(`[API Response] /api/v1/orders/[id]/ready-for-pickup - Sending response`), NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: 'Internal server error' },
      { status: 500 }
    );
  }
}
