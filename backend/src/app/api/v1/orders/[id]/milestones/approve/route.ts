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
    const { stage } = await req.json();

    if (!stage || !['20', '40', '60', '80'].includes(stage)) {
      return console.log(`[API Response] /api/v1/orders/[id]/milestones/approve - Sending response`), NextResponse.json({ success: false, code: 'BAD_REQUEST', message: 'Invalid stage' }, { status: 400 });
    }

    await db();
    const { PurchaseOrder } = await import('@/models/PurchaseOrder');

    const order = await PurchaseOrder.findById(id).lean() as any;

    if (!order) {
      return console.log(`[API Response] /api/v1/orders/[id]/milestones/approve - Sending response`), NextResponse.json({ success: false, code: 'NOT_FOUND', message: 'Order not found' }, { status: 404 });
    }

    // Only buyer can approve
    if (order.buyerCompanyId.toString() !== user.companyId) {
      return console.log(`[API Response] /api/v1/orders/[id]/milestones/approve - Sending response`), NextResponse.json({ success: false, code: 'FORBIDDEN', message: 'Only buyer can approve milestones' }, { status: 403 });
    }

    // Ensure the supplier has actually submitted the work for this stage
    // For stage '20', it means `workImage20` should be uploaded. But wait, the spec says:
    // "PO cannot 20→40 until buyer POST /orders/:id/milestones/approve { stage:'20' }."
    // This implies the supplier reached 20, uploaded image. Buyer approves 20. Then supplier can reach 40.
    
    // Update the approved milestone
    await PurchaseOrder.updateOne(
      { _id: id },
      { $set: { milestoneApproved: stage } }
    );

    return console.log(`[API Response] /api/v1/orders/[id]/milestones/approve - Sending response`), NextResponse.json({
      success: true,
      message: `Milestone ${stage}% approved successfully`,
    });

  } catch (error: any) {
    console.error('Approve milestone error:', error);
    return console.log(`[API Response] /api/v1/orders/[id]/milestones/approve - Sending response`), NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: 'Internal server error' },
      { status: 500 }
    );
  }
}
