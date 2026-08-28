import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, authErrorResponse } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user || !user.companyId) return authErrorResponse();

    const searchParams = req.nextUrl.searchParams;
    const type = searchParams.get('type') || 'buying'; // buying or selling

    const whereClause: any = {};
    if (type === 'buying') {
      whereClause.buyerCompanyId = user.companyId;
    } else {
      whereClause.supplierCompanyId = user.companyId;
    }

    const orders = await db.purchaseOrder.findMany({
      where: whereClause,
      include: {
        buyerCompany: { select: { name: true } },
        supplierCompany: { select: { name: true } },
        items: {
          include: {
            rfqItem: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Log first order's workImage fields for debugging
    if (orders.length > 0) {
      const first = orders[0];
      console.log('[ORDERS-LIST] First order fields:', JSON.stringify({
        id: first.id,
        status: first.status,
        workImage20: first.workImage20,
        workImage40: first.workImage40,
        workImage60: first.workImage60,
        workImage80: first.workImage80,
        workImageId: first.workImageId,
        hasWorkImage20Key: 'workImage20' in first,
      }));
    }

    return NextResponse.json({
      success: true,
      data: orders,
    });
  } catch (error: any) {
    console.error('List orders error:', error);
    return NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: 'Internal server error' },
      { status: 500 }
    );
  }
}
