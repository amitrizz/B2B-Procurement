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
    const { action } = await req.json(); // ACCEPT, REJECT

    await db();
    const { PurchaseRequisition } = await import('@/models/Catalog');

    const pr = await PurchaseRequisition.findOne({
      _id: id,
      companyId: user.companyId
    }).lean() as any;

    if (!pr) {
      return console.log(`[API Response] /api/v1/prs/[id]/approve - Sending response`), NextResponse.json({ success: false, code: 'NOT_FOUND', message: 'PR not found' }, { status: 404 });
    }

    if (pr.status !== 'PENDING_APPROVER') {
      return console.log(`[API Response] /api/v1/prs/[id]/approve - Sending response`), NextResponse.json({ success: false, code: 'INVALID_STATUS', message: 'PR is not pending approval' }, { status: 400 });
    }

    // Maker-checker rule: Creator cannot approve their own PR (unless they are OWNER or PLATFORM_ADMIN)
    if (pr.createdByUserId === user.id && !['OWNER', 'PLATFORM_ADMIN'].includes(user.role)) {
       return console.log(`[API Response] /api/v1/prs/[id]/approve - Sending response`), NextResponse.json({ success: false, code: 'FORBIDDEN', message: 'Maker-Checker constraint: You cannot approve your own requisition' }, { status: 403 });
    }

    // Role check: Only OWNER or PLATFORM_ADMIN can approve
    if (!['OWNER', 'PLATFORM_ADMIN'].includes(user.role)) {
       return console.log(`[API Response] /api/v1/prs/[id]/approve - Sending response`), NextResponse.json({ success: false, code: 'FORBIDDEN', message: 'Only Owners or Platform Admins can approve PRs' }, { status: 403 });
    }

    const newStatus = (action === 'ACCEPT' || action === 'APPROVE') ? 'APPROVED' : 'REJECTED';

    const updatedPrDoc = await PurchaseRequisition.findByIdAndUpdate(
      id,
      {
        status: newStatus,
        approverUserId: user.id
      },
      { new: true }
    ).lean() as any;
    
    const updatedPr = updatedPrDoc ? { ...updatedPrDoc, id: updatedPrDoc._id.toString() } : null;

    if (updatedPr) {
      const { broadcastCompanyUpdate } = await import('@/lib/companyEvents');
      await broadcastCompanyUpdate(user.companyId, 'pr_updated', `Purchase Requisition ${pr.prNumber} has been ${newStatus.toLowerCase()}.`);
    }

    return console.log(`[API Response] /api/v1/prs/[id]/approve - Sending response`), NextResponse.json({
      success: true,
      message: `Purchase Requisition ${newStatus.toLowerCase()}`,
      data: updatedPr
    });

  } catch (error: any) {
    console.error('Approve PR error:', error);
    return console.log(`[API Response] /api/v1/prs/[id]/approve - Sending response`), NextResponse.json({ success: false, code: 'SERVER_ERROR', message: 'Internal server error' }, { status: 500 });
  }
}
