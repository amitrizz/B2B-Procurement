import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, authErrorResponse } from '@/lib/auth';
import crypto from 'crypto';
import mongoose from 'mongoose';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
    console.log(`[API] ${req.method} ${req.nextUrl?.pathname || req.url}`);
  try {
    const user = await getAuthUser(req);
    if (!user) return authErrorResponse();

    if (user.role !== 'TRANSPORTER' && user.role !== 'PLATFORM_ADMIN') {
      return NextResponse.json(
        { success: false, code: 'FORBIDDEN', message: 'Only transporter can verify delivery OTP' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const { otp, podFileId, type = 'DELIVERY' } = await req.json();

    if (!otp) {
      return NextResponse.json({ success: false, code: 'BAD_REQUEST', message: 'OTP is required' }, { status: 400 });
    }

    if (type === 'DELIVERY' && !podFileId) {
      return NextResponse.json(
        { success: false, code: 'BAD_REQUEST', message: 'Proof of Delivery (podFileId) is required' },
        { status: 400 }
      );
    }

    await db();
    const { DeliveryOrder } = await import('@/models/Logistics');
    const { PurchaseOrder } = await import('@/models/PurchaseOrder');

    const delivery = await DeliveryOrder.findById(id).lean() as any;

    if (!delivery) {
      return NextResponse.json({ success: false, code: 'NOT_FOUND', message: 'Delivery not found' }, { status: 404 });
    }

    if (user.role === 'TRANSPORTER' && delivery.transporterId && user.companyId) {
      if (delivery.transporterId.toString() !== user.companyId) {
        return NextResponse.json(
          { success: false, code: 'FORBIDDEN', message: 'This delivery is assigned to another transporter' },
          { status: 403 }
        );
      }
    }

    const inputHash = crypto.createHash('sha256').update(otp.toString()).digest('hex');

    if (type === 'PICKUP') {
      if (delivery.status !== 'ACCEPTED') {
        return NextResponse.json(
          { success: false, code: 'INVALID_STATUS', message: 'Delivery must be ACCEPTED before pickup verification' },
          { status: 400 }
        );
      }
      if (!delivery.pickupOtpHash) {
        return NextResponse.json(
          { success: false, code: 'OTP_NOT_CONFIGURED', message: 'No pickup OTP configured for this delivery' },
          { status: 400 }
        );
      }
      if (delivery.pickupOtpHash !== inputHash) {
        return NextResponse.json(
          { success: false, code: 'INVALID_OTP', message: 'The provided Pickup OTP is incorrect. Ask the supplier.' },
          { status: 400 }
        );
      }
    } else {
      if (!['PICKED_UP', 'IN_TRANSIT'].includes(delivery.status)) {
        return NextResponse.json(
          { success: false, code: 'INVALID_STATUS', message: 'Delivery must be picked up before delivery verification' },
          { status: 400 }
        );
      }
      const hashToCompare = delivery.deliveryOtpHash || delivery.otpHash;
      if (!hashToCompare) {
        return NextResponse.json(
          { success: false, code: 'OTP_NOT_CONFIGURED', message: 'No delivery OTP configured for this delivery' },
          { status: 400 }
        );
      }
      if (hashToCompare !== inputHash) {
        return NextResponse.json(
          { success: false, code: 'INVALID_OTP', message: 'The provided Delivery OTP is incorrect. Ask the buyer.' },
          { status: 400 }
        );
      }
    }

    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      const nextStatus = type === 'PICKUP' ? 'PICKED_UP' : 'DELIVERED';
      const deliveryUpdate: Record<string, unknown> = { status: nextStatus };
      if (type === 'DELIVERY' && podFileId) {
        deliveryUpdate.podFileId = podFileId;
      }

      await DeliveryOrder.updateOne({ _id: id }, { $set: deliveryUpdate }, { session });

      await PurchaseOrder.updateOne(
        { _id: delivery.purchaseOrderId },
        { $set: { status: nextStatus } },
        { session }
      );

      await session.commitTransaction();
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }

    const purchaseOrder = await PurchaseOrder.findById(delivery.purchaseOrderId).lean() as any;
    if (purchaseOrder) {
      const { broadcastOrderUpdate } = await import('@/lib/orderEvents');
      await broadcastOrderUpdate(
        purchaseOrder,
        'delivery_updated',
        type === 'PICKUP'
          ? `Order ${purchaseOrder.poNumber || purchaseOrder._id} picked up after OTP verification.`
          : `Order ${purchaseOrder.poNumber || purchaseOrder._id} delivered after OTP verification.`
      );
    }

    return NextResponse.json({
      success: true,
      message:
        type === 'PICKUP'
          ? 'Pickup OTP verified. Order marked as PICKED UP.'
          : 'Delivery OTP verified. Order marked as DELIVERED.',
    });
  } catch (error: any) {
    console.error('Verify OTP error:', error);
    return NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: 'Internal server error' },
      { status: 500 }
    );
  }
}
