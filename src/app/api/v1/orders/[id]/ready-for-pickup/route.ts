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
        { success: false, code: 'FORBIDDEN', message: 'Only the supplier can set order as ready for pickup' },
        { status: 403 }
      );
    }

    const deliveryNumber = 'DEL-' + Math.floor(100000 + Math.random() * 900000);

    const result = await db.$transaction(async (tx) => {
      const updatedOrder = await tx.purchaseOrder.update({
        where: { id },
        data: { status: 'READY_FOR_PICKUP' },
      });

      const delivery = await tx.deliveryOrder.create({
        data: {
          deliveryNumber,
          purchaseOrderId: id,
          status: 'CREATED',
          deliveryCharge: 0,
        },
      });

      return { updatedOrder, delivery };
    });

    return NextResponse.json({
      success: true,
      message: 'Order marked ready for pickup. Delivery order generated.',
      data: result,
    });
  } catch (error: any) {
    console.error('Ready for pickup error:', error);
    return NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: 'Internal server error' },
      { status: 500 }
    );
  }
}
