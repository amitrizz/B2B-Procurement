import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, authErrorResponse } from '@/lib/auth';
import mongoose from 'mongoose';

type Params = {
  params: Promise<{ id: string }>
}

export async function GET(req: NextRequest, { params }: Params) {
    console.log(`[API] ${req.method} ${req.nextUrl?.pathname || req.url}`);
  try {
    const user = await getAuthUser(req);
    if (!user || !user.companyId) return authErrorResponse();

    const { id } = await params;

    await db();
    const { PurchaseOrder } = await import('@/models/PurchaseOrder');
    await import('@/models/Company');
    await import('@/models/RFQ');
    await import('@/models/Logistics');
    await import('@/models/Platform');

    const orderDoc = await PurchaseOrder.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(id) } },
      {
        $lookup: {
          from: 'companies',
          localField: 'buyerCompanyId',
          foreignField: '_id',
          as: 'buyerCompany'
        }
      },
      { $unwind: { path: '$buyerCompany', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'companies',
          localField: 'supplierCompanyId',
          foreignField: '_id',
          as: 'supplierCompany'
        }
      },
      { $unwind: { path: '$supplierCompany', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'purchaseorderitems',
          localField: '_id',
          foreignField: 'purchaseOrderId',
          as: 'items'
        }
      },
      {
        $lookup: {
          from: 'rfqitems',
          localField: 'items.rfqItemId',
          foreignField: '_id',
          as: 'rfqItems'
        }
      },
      {
        $lookup: {
          from: 'deliveryorders',
          localField: '_id',
          foreignField: 'purchaseOrderId',
          as: 'deliveryOrder'
        }
      },
      { $unwind: { path: '$deliveryOrder', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'companies',
          localField: 'deliveryOrder.transporterId',
          foreignField: '_id',
          as: 'transporter'
        }
      },
      {
        $addFields: {
          'deliveryOrder.transporter': {
            $arrayElemAt: ['$transporter', 0]
          }
        }
      },
      { $project: { transporter: 0 } },
      {
        $lookup: {
          from: 'disputes',
          localField: '_id',
          foreignField: 'purchaseOrderId',
          as: 'disputes'
        }
      },
      {
        $lookup: {
          from: 'reviews',
          localField: '_id',
          foreignField: 'purchaseOrderId',
          as: 'reviews'
        }
      },
      {
        $lookup: {
          from: 'invoices',
          localField: '_id',
          foreignField: 'purchaseOrderId',
          as: 'invoices'
        }
      }
    ]);

    let order: any = null;
    if (orderDoc.length > 0) {
      const o = orderDoc[0];
      
      // Manually map rfqItems to their respective poItems
      const items = o.items.map((i: any) => {
        const rfqItem = o.rfqItems.find((r: any) => r._id.toString() === i.rfqItemId.toString());
        return {
          ...i,
          id: i._id.toString(),
          rfqItem: rfqItem ? { ...rfqItem, id: rfqItem._id.toString() } : null
        };
      });

      order = {
        ...o,
        id: o._id.toString(),
        buyerCompany: o.buyerCompany ? { ...o.buyerCompany, id: o.buyerCompany._id.toString() } : null,
        supplierCompany: o.supplierCompany ? { ...o.supplierCompany, id: o.supplierCompany._id.toString() } : null,
        items,
        deliveryOrder: o.deliveryOrder ? { 
          ...o.deliveryOrder, 
          id: o.deliveryOrder._id.toString(),
          transporter: o.deliveryOrder.transporter ? { ...o.deliveryOrder.transporter, id: o.deliveryOrder.transporter._id.toString() } : null
        } : null,
        disputes: o.disputes.map((d: any) => ({ ...d, id: d._id.toString() })),
        reviews: o.reviews.map((r: any) => ({ ...r, id: r._id.toString() })),
        invoices: (o.invoices || []).map((inv: any) => ({ ...inv, id: inv._id.toString() })),
      };
      
      delete order.rfqItems;
    }

    if (!order) {
      return console.log(`[API Response] /api/v1/orders/[id] - Sending response`), NextResponse.json(
        { success: false, code: 'NOT_FOUND', message: 'Order not found' },
        { status: 404 }
      );
    }

    // IDOR / BOLA authorization check
    if (order.buyerCompanyId.toString() !== user.companyId && order.supplierCompanyId.toString() !== user.companyId && user.role !== 'PLATFORM_ADMIN') {
      return console.log(`[API Response] /api/v1/orders/[id] - Sending response`), NextResponse.json(
        { success: false, code: 'FORBIDDEN', message: 'Unauthorized access to this order' },
        { status: 403 }
      );
    }

    return console.log(`[API Response] /api/v1/orders/[id] - Sending response`), NextResponse.json({
      success: true,
      data: order,
    });
  } catch (error: any) {
    console.error('Get order details error:', error);
    return console.log(`[API Response] /api/v1/orders/[id] - Sending response`), NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: 'Internal server error' },
      { status: 500 }
    );
  }
}
