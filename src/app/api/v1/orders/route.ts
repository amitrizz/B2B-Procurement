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
