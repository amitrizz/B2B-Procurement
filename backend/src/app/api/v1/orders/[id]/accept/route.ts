import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, authErrorResponse } from '@/lib/auth';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    console.log(`[API] ${req.method} ${req.nextUrl?.pathname || req.url}`);
  try {
    const user = await getAuthUser(req);
    if (!user || !user.companyId) return authErrorResponse();

    const { id } = await params;

    await db();
    const { PurchaseOrder } = await import('@/models/PurchaseOrder');
    const { Company, CompanyBankAccount } = await import('@/models/Company');

    const po = await PurchaseOrder.findById(id).lean() as any;

    if (!po) {
      return console.log(`[API Response] /api/v1/orders/[id]/accept - Sending response`), NextResponse.json({ success: false, code: 'NOT_FOUND', message: 'PO not found' }, { status: 404 });
    }

    if (po.supplierCompanyId.toString() !== user.companyId) {
      return console.log(`[API Response] /api/v1/orders/[id]/accept - Sending response`), NextResponse.json({ success: false, code: 'FORBIDDEN', message: 'You are not the supplier for this PO' }, { status: 403 });
    }

    if (po.status !== 'AWAITING_ACCEPTANCE') {
      return console.log(`[API Response] /api/v1/orders/[id]/accept - Sending response`), NextResponse.json({ success: false, code: 'INVALID_STATUS', message: 'PO is not awaiting acceptance' }, { status: 400 });
    }

    const supplierCompany = await Company.findById(po.supplierCompanyId).lean() as any;
    const bankAccount = await CompanyBankAccount.findOne({ companyId: po.supplierCompanyId }).lean() as any;

    if (supplierCompany.status !== 'VERIFIED') {
      return console.log(`[API Response] /api/v1/orders/[id]/accept - Sending response`), NextResponse.json({ success: false, code: 'UNVERIFIED', message: 'Your company must be verified to accept POs' }, { status: 403 });
    }

    if (!bankAccount) {
      return console.log(`[API Response] /api/v1/orders/[id]/accept - Sending response`), NextResponse.json({ success: false, code: 'NO_BANK', message: 'You must provide bank details before accepting a PO' }, { status: 403 });
    }

    const updatedPoDoc = await PurchaseOrder.findByIdAndUpdate(
      id,
      { $set: { status: 'CREATED' } },
      { new: true }
    ).lean() as any;

    const updatedPo = updatedPoDoc ? { ...updatedPoDoc, id: updatedPoDoc._id.toString() } : null;

    if (updatedPoDoc) {
      const { broadcastOrderUpdate } = await import('@/lib/orderEvents');
      await broadcastOrderUpdate(updatedPoDoc, 'order_updated', `Purchase order ${po.poNumber || po._id} has been accepted`);
    }

    return console.log(`[API Response] /api/v1/orders/[id]/accept - Sending response`), NextResponse.json({
      success: true,
      message: 'Purchase order accepted',
      data: updatedPo,
    });
  } catch (error: any) {
    console.error('Accept PO error:', error);
    return console.log(`[API Response] /api/v1/orders/[id]/accept - Sending response`), NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: 'Internal server error' },
      { status: 500 }
    );
  }
}
