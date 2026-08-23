import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, authErrorResponse } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user || !user.companyId) return authErrorResponse();

    // Find all bids where this user's company is the supplier
    const bids = await db.bid.findMany({
      where: { supplierCompanyId: user.companyId },
      include: {
        rfq: {
          include: {
            items: true
          }
        },
        rfqItem: true
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({
      success: true,
      data: bids
    });
  } catch (error: any) {
    console.error('List own bids error:', error);
    return NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: 'Internal server error' },
      { status: 500 }
    );
  }
}
