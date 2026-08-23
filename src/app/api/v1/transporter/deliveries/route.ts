import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, authErrorResponse } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return authErrorResponse();

    const deliveries = await db.deliveryOrder.findMany({
      include: {
        purchaseOrder: {
          include: {
            buyerCompany: { select: { name: true } },
            supplierCompany: { select: { name: true } },
          },
        },
        transporter: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      data: deliveries,
    });
  } catch (error: any) {
    console.error('List deliveries error:', error);
    return NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: 'Internal server error' },
      { status: 500 }
    );
  }
}
