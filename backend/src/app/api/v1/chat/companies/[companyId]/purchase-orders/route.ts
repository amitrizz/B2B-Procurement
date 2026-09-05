import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { chatAuthError, toObjectId } from '@/lib/chatHelpers';
import mongoose from 'mongoose';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const user = await getAuthUser(req);
    const authErr = chatAuthError(user);
    if (authErr) return authErr;

    const { companyId } = await params;
    const otherId = toObjectId(companyId);
    if (!otherId) {
      return NextResponse.json(
        { success: false, code: 'INVALID_ID', message: 'Invalid company id' },
        { status: 400 }
      );
    }

    await db();
    const { Company } = await import('@/models/Company');
    const { PurchaseOrder } = await import('@/models/PurchaseOrder');

    const other = await Company.findById(otherId).lean();
    if (!other || other.status !== 'VERIFIED' || other.isActive === false) {
      return NextResponse.json(
        { success: false, code: 'NOT_FOUND', message: 'Company not available for chat' },
        { status: 404 }
      );
    }

    const myId = new mongoose.Types.ObjectId(user!.companyId);

    const orders = await PurchaseOrder.find({
      $or: [
        { buyerCompanyId: myId, supplierCompanyId: otherId },
        { buyerCompanyId: otherId, supplierCompanyId: myId },
      ],
    })
      .sort({ createdAt: -1 })
      .select('poNumber status totalAmount createdAt buyerCompanyId supplierCompanyId')
      .lean();

    const data = orders.map((po: any) => ({
      id: po._id.toString(),
      poNumber: po.poNumber,
      status: po.status,
      totalAmount: po.totalAmount,
      createdAt: po.createdAt,
      buyerCompanyId: po.buyerCompanyId.toString(),
      supplierCompanyId: po.supplierCompanyId.toString(),
    }));

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('List chat POs error:', error);
    return NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
