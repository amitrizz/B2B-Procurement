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

    let workImageId = '';
    try {
      const body = await req.json();
      workImageId = body.workImageId;
    } catch (e) {
      // Body might be empty or invalid JSON
    }

    if (!workImageId) {
      return NextResponse.json(
        { success: false, code: 'BAD_REQUEST', message: 'An image of the completed work is required to mark the order as ready for pickup' },
        { status: 400 }
      );
    }

    if (order.status !== 'PROCESSING_80') {
      return NextResponse.json(
        { success: false, code: 'INVALID_STATUS', message: 'Order must be 80% completed (PROCESSING_80) before marking ready for pickup' },
        { status: 400 }
      );
    }

    const deliveryNumber = 'DEL-' + Math.floor(100000 + Math.random() * 900000);

    const result = await db.$transaction(async (tx) => {
      const updatedOrder = await tx.purchaseOrder.update({
        where: { id },
        data: { 
          status: 'READY_FOR_PICKUP',
          workImageId,
        },
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
