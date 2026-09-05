import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, authErrorResponse } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user || user.role !== 'PLATFORM_ADMIN') return authErrorResponse();

    await db();
    const { Invoice } = await import('@/models/Finance');
    await import('@/models/PurchaseOrder');
    await import('@/models/Company');

    const invoices = await Invoice.find()
      .sort({ createdAt: -1 })
      .limit(200)
      .populate('payerCompanyId', 'name gstin')
      .populate('payeeCompanyId', 'name gstin')
      .populate('purchaseOrderId', 'poNumber')
      .lean();

    const data = invoices.map((inv: any) => ({
      id: inv._id.toString(),
      number: inv.number,
      type: inv.type,
      status: inv.status,
      taxable: inv.taxable,
      total: inv.total,
      cgstAmount: inv.cgstAmount,
      sgstAmount: inv.sgstAmount,
      igstAmount: inv.igstAmount,
      createdAt: inv.createdAt,
      payerCompany: inv.payerCompanyId
        ? { id: inv.payerCompanyId._id?.toString(), name: inv.payerCompanyId.name }
        : null,
      payeeCompany: inv.payeeCompanyId
        ? { id: inv.payeeCompanyId._id?.toString(), name: inv.payeeCompanyId.name }
        : null,
      purchaseOrder: inv.purchaseOrderId
        ? { id: inv.purchaseOrderId._id?.toString(), poNumber: inv.purchaseOrderId.poNumber }
        : null,
    }));

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('List admin invoices error:', error);
    return NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
