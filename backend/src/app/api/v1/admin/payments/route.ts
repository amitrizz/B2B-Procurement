import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, authErrorResponse } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user || user.role !== 'PLATFORM_ADMIN') return authErrorResponse();

    await db();
    const { Payment } = await import('@/models/Finance');
    await import('@/models/PurchaseOrder');
    await import('@/models/Company');

    const paymentsDoc = await Payment.find()
      .sort({ createdAt: -1 })
      .populate({
        path: 'invoiceId',
        populate: {
          path: 'purchaseOrderId',
          populate: [
            { path: 'buyerCompanyId', select: 'name gstin' },
            { path: 'supplierCompanyId', select: 'name gstin' },
          ],
        },
      })
      .lean();

    const payments = await Promise.all(
      paymentsDoc.map(async (p: any) => {
        const inv = p.invoiceId;
        const po = inv?.purchaseOrderId;

        let supplierPayoutAmount: number | null = null;
        if (po?._id) {
          const { PurchaseOrderItem } = await import('@/models/PurchaseOrder');
          const { computeOrderAmounts } = await import('@/lib/orderAmounts');
          const items = await PurchaseOrderItem.find({ purchaseOrderId: po._id }).lean();
          const amounts = await computeOrderAmounts(po, items as any[]);
          supplierPayoutAmount = amounts.supplierPayoutTotal;
        }

        return {
          id: p._id.toString(),
          amount: p.amount,
          method: p.method,
          status: p.status,
          heldAt: p.heldAt,
          releasedAt: p.releasedAt,
          createdAt: p.createdAt,
          supplierPayoutAmount,
          invoice: inv
            ? {
                id: inv._id.toString(),
                number: inv.number,
                type: inv.type,
                status: inv.status,
                total: inv.total,
                purchaseOrder: po
                  ? {
                      id: po._id.toString(),
                      poNumber: po.poNumber,
                      buyerCompany: po.buyerCompanyId
                        ? { name: po.buyerCompanyId.name, id: po.buyerCompanyId._id?.toString() }
                        : null,
                      supplierCompany: po.supplierCompanyId
                        ? { name: po.supplierCompanyId.name, id: po.supplierCompanyId._id?.toString() }
                        : null,
                    }
                  : null,
              }
            : null,
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: payments,
    });
  } catch (error: any) {
    console.error('List payments error:', error);
    return NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
