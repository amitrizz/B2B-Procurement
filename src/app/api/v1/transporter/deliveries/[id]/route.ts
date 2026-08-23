import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, authErrorResponse } from '@/lib/auth';

type Params = {
  params: Promise<{ id: string }>
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthUser(req);
    if (!user) return authErrorResponse();

    const { id } = await params;
    const { status, deliveryCharge, transporterId } = await req.json();

    const delivery = await db.deliveryOrder.findUnique({
      where: { id },
    });

    if (!delivery) {
      return NextResponse.json(
        { success: false, code: 'NOT_FOUND', message: 'Delivery order not found' },
        { status: 404 }
      );
    }

    const data: any = {};
    if (status) data.status = status;
    if (deliveryCharge !== undefined) data.deliveryCharge = deliveryCharge;
    if (transporterId) data.transporterId = transporterId;

    const updatedDelivery = await db.$transaction(async (tx) => {
      const devOrder = await tx.deliveryOrder.update({
        where: { id },
        data,
      });

      // Map delivery order status back to Purchase Order status
      let poStatus = '';
      if (status === 'PICKED_UP') poStatus = 'PICKED_UP';
      else if (status === 'IN_TRANSIT') poStatus = 'IN_TRANSIT';
      else if (status === 'DELIVERED') poStatus = 'DELIVERED';

      if (poStatus) {
        await tx.purchaseOrder.update({
          where: { id: devOrder.purchaseOrderId },
          data: { status: poStatus },
        });
      }

      return devOrder;
    });

    return NextResponse.json({
      success: true,
      message: 'Delivery order updated successfully',
      data: updatedDelivery,
    });
  } catch (error: any) {
    console.error('Update delivery error:', error);
    return NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: 'Internal server error' },
      { status: 500 }
    );
  }
}
