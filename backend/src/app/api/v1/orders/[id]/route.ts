import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, authErrorResponse } from '@/lib/auth';

type Params = {
  params: Promise<{ id: string }>
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthUser(req);
    if (!user || !user.companyId) return authErrorResponse();

    const { id } = await params;

    const order = await db.purchaseOrder.findUnique({
      where: { id },
      include: {
        buyerCompany: true,
        supplierCompany: true,
        items: {
          include: {
            rfqItem: true,
          },
        },
        deliveryOrder: {
          include: {
            transporter: true,
          },
        },
        disputes: true,
        reviews: true,
      },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, code: 'NOT_FOUND', message: 'Order not found' },
        { status: 404 }
      );
    }

    // IDOR / BOLA authorization check
    if (order.buyerCompanyId !== user.companyId && order.supplierCompanyId !== user.companyId && user.role !== 'PLATFORM_ADMIN') {
      return NextResponse.json(
        { success: false, code: 'FORBIDDEN', message: 'Unauthorized access to this order' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: order,
    });
  } catch (error: any) {
    console.error('Get order details error:', error);
    return NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: 'Internal server error' },
      { status: 500 }
    );
  }
}
