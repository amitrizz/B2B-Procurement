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
    const { workImageId } = await req.json();

    if (!workImageId) {
      return NextResponse.json(
        { success: false, code: 'MISSING_IMAGE', message: 'Please upload a proof of work image for this milestone.' },
        { status: 400 }
      );
    }

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
    let updateData: any = {};

    if (order.status === 'CREATED') {
      nextStatus = 'PROCESSING_20';
      updateData.workImage20 = workImageId;
    } else if (order.status === 'PROCESSING_20') {
      nextStatus = 'PROCESSING_40';
      updateData.workImage40 = workImageId;
    } else if (order.status === 'PROCESSING_40') {
      nextStatus = 'PROCESSING_60';
      updateData.workImage60 = workImageId;
    } else if (order.status === 'PROCESSING_60') {
      nextStatus = 'PROCESSING_80';
      updateData.workImage80 = workImageId;
    }

    updateData.status = nextStatus;

    console.log('[START-PROCESSING] Updating order:', id, 'with data:', JSON.stringify(updateData));

    const updatedOrder = await db.purchaseOrder.update({
      where: { id },
      data: updateData,
    });

    console.log('[START-PROCESSING] Updated order result:', JSON.stringify({
      id: updatedOrder.id,
      status: updatedOrder.status,
      workImage20: updatedOrder.workImage20,
      workImage40: updatedOrder.workImage40,
      workImage60: updatedOrder.workImage60,
      workImage80: updatedOrder.workImage80,
      workImageId: updatedOrder.workImageId,
    }));

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
