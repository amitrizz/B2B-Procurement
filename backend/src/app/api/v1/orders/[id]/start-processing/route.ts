import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, authErrorResponse } from '@/lib/auth';

type Params = {
  params: Promise<{ id: string }>
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthUser(req);
    if (!user || !user.companyId) return authErrorResponse();

    const { id } = await params;

    const order = await db.purchaseOrder.findUnique({
      where: { id },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, code: 'NOT_FOUND', message: 'Order not found' },
        { status: 404 }
      );
    }

    if (order.supplierCompanyId !== user.companyId) {
      return NextResponse.json(
        { success: false, code: 'FORBIDDEN', message: 'Only the supplier can start processing' },
        { status: 403 }
      );
    }

    const allowedStatuses = ['CREATED', 'PROCESSING_20', 'PROCESSING_40', 'PROCESSING_60'];
    if (!allowedStatuses.includes(order.status)) {
      return NextResponse.json(
        { success: false, code: 'INVALID_STATUS', message: 'Order cannot progress further using this action' },
        { status: 400 }
      );
    }

    let nextStatus = 'PROCESSING_20';
    if (order.status === 'PROCESSING_20') nextStatus = 'PROCESSING_40';
    else if (order.status === 'PROCESSING_40') nextStatus = 'PROCESSING_60';
    else if (order.status === 'PROCESSING_60') nextStatus = 'PROCESSING_80';

    const updatedOrder = await db.purchaseOrder.update({
      where: { id },
      data: { status: nextStatus },
    });

    return NextResponse.json({
      success: true,
      message: `Order status advanced to ${nextStatus}`,
      data: updatedOrder,
    });
  } catch (error: any) {
    console.error('Start processing error:', error);
    return NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: 'Internal server error' },
      { status: 500 }
    );
  }
}
