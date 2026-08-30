import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, authErrorResponse } from '@/lib/auth';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
    console.log(`[API] ${req.method} ${req.nextUrl?.pathname || req.url}`);
  try {
    const user = await getAuthUser(req);
    if (!user || !user.companyId) return authErrorResponse();

    const { id } = await params;
    const { rating, comment } = await req.json();

    if (rating === undefined || rating < 1 || rating > 5) {
      return console.log(`[API Response] /api/v1/orders/[id]/review - Sending response`), NextResponse.json({ success: false, code: 'BAD_REQUEST', message: 'Rating must be between 1 and 5' }, { status: 400 });
    }

    await db();
    const { PurchaseOrder } = await import('@/models/PurchaseOrder');
    const { Review } = await import('@/models/Platform');

    const order = await PurchaseOrder.findById(id).lean() as any;

    if (!order) {
      return console.log(`[API Response] /api/v1/orders/[id]/review - Sending response`), NextResponse.json({ success: false, code: 'NOT_FOUND', message: 'Order not found' }, { status: 404 });
    }

    if (order.buyerCompanyId.toString() !== user.companyId) {
      return console.log(`[API Response] /api/v1/orders/[id]/review - Sending response`), NextResponse.json({ success: false, code: 'FORBIDDEN', message: 'Only buyer can review the order' }, { status: 403 });
    }

    if (order.status !== 'COMPLETED') {
      return console.log(`[API Response] /api/v1/orders/[id]/review - Sending response`), NextResponse.json({ success: false, code: 'INVALID_STATUS', message: 'Order must be COMPLETED to review' }, { status: 400 });
    }

    // Upsert review (one review per order)
    const reviewDoc = await Review.findOneAndUpdate(
      {
        purchaseOrderId: id,
        reviewerCompanyId: user.companyId,
        reviewedCompanyId: order.supplierCompanyId,
      },
      {
        $set: {
          rating,
          comment
        }
      },
      { new: true, upsert: true }
    ).lean() as any;
    
    const review = reviewDoc ? { ...reviewDoc, id: reviewDoc._id.toString() } : null;

    return console.log(`[API Response] /api/v1/orders/[id]/review - Sending response`), NextResponse.json({
      success: true,
      message: 'Review submitted successfully',
      data: review,
    });

  } catch (error: any) {
    console.error('Review submission error:', error);
    return console.log(`[API Response] /api/v1/orders/[id]/review - Sending response`), NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: 'Internal server error' },
      { status: 500 }
    );
  }
}
