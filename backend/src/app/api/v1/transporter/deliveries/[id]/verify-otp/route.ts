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
    // Only transporter can verify OTP and mark DELIVERED (or admin)
    if (!user || !user.companyId) return authErrorResponse();

    const { id } = await params;
    const { otp, podFileId } = await req.json();

    if (!otp) {
      return console.log(`[API Response] /api/v1/transporter/deliveries/[id]/verify-otp - Sending response`), NextResponse.json({ success: false, code: 'BAD_REQUEST', message: 'OTP is required' }, { status: 400 });
    }
    
    if (!podFileId) {
       return console.log(`[API Response] /api/v1/transporter/deliveries/[id]/verify-otp - Sending response`), NextResponse.json({ success: false, code: 'BAD_REQUEST', message: 'Proof of Delivery (podFileId) is required' }, { status: 400 });
    }

    await db();
    const { DeliveryOrder } = await import('@/models/Logistics');
    const { PurchaseOrder } = await import('@/models/PurchaseOrder');

    const delivery = await DeliveryOrder.findById(id).lean() as any;

    if (!delivery) {
      return console.log(`[API Response] /api/v1/transporter/deliveries/[id]/verify-otp - Sending response`), NextResponse.json({ success: false, code: 'NOT_FOUND', message: 'Delivery not found' }, { status: 404 });
    }

    if (user.role !== 'PLATFORM_ADMIN') {
        // Since we are enforcing transporter logic in Phase 2
        // We'll allow the transporter who accepted the delivery, or anyone if it's not strictly assigned yet
        // For now, checking if user role is TRANSPORTER
        if (user.role !== 'TRANSPORTER') {
            return console.log(`[API Response] /api/v1/transporter/deliveries/[id]/verify-otp - Sending response`), NextResponse.json({ success: false, code: 'FORBIDDEN', message: 'Only transporter can verify delivery OTP' }, { status: 403 });
        }
    }

    const inputHash = crypto.createHash('sha256').update(otp.toString()).digest('hex');

    if (delivery.otpHash !== inputHash) {
      return console.log(`[API Response] /api/v1/transporter/deliveries/[id]/verify-otp - Sending response`), NextResponse.json({ success: false, code: 'INVALID_OTP', message: 'The provided OTP is incorrect' }, { status: 400 });
    }

    const session = await mongoose.startSession();
    
    try {
      session.startTransaction();

      await DeliveryOrder.updateOne(
        { _id: id },
        { 
          $set: {
            status: 'DELIVERED',
            podFileId,
          }
        },
        { session }
      );

      await PurchaseOrder.updateOne(
        { _id: delivery.purchaseOrderId },
        { $set: { status: 'DELIVERED' } },
        { session }
      );

      await session.commitTransaction();
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }

    return console.log(`[API Response] /api/v1/transporter/deliveries/[id]/verify-otp - Sending response`), NextResponse.json({
      success: true,
      message: 'Delivery verified and marked as DELIVERED',
    });

  } catch (error: any) {
    console.error('Verify OTP error:', error);
    return console.log(`[API Response] /api/v1/transporter/deliveries/[id]/verify-otp - Sending response`), NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: 'Internal server error' },
      { status: 500 }
    );
  }
}
