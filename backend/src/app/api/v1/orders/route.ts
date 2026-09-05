import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, authErrorResponse } from '@/lib/auth';
import { sanitizeDeliveryOrder } from '@/lib/deliveryOrderSanitize';
import mongoose from 'mongoose';

export async function GET(req: NextRequest) {
    console.log(`[API] ${req.method} ${req.nextUrl?.pathname || req.url}`);
  try {
    const user = await getAuthUser(req);
    if (!user || !user.companyId) return authErrorResponse();

    const searchParams = req.nextUrl.searchParams;
    const type = searchParams.get('type') || 'buying'; // buying or selling

    await db();
    const { PurchaseOrder } = await import('@/models/PurchaseOrder');
    await import('@/models/Company');
    await import('@/models/RFQ');

    const matchClause: any = {};
    if (type === 'buying') {
      matchClause.buyerCompanyId = new mongoose.Types.ObjectId(user.companyId);
    } else {
      matchClause.supplierCompanyId = new mongoose.Types.ObjectId(user.companyId);
    }

    const ordersDoc = await PurchaseOrder.aggregate([
      { $match: matchClause },
      { $sort: { createdAt: -1 } },
      {
        $lookup: {
          from: 'companies',
          localField: 'buyerCompanyId',
          foreignField: '_id',
          as: 'buyerCompany'
        }
      },
      {
        $addFields: {
          'buyerCompany': { $arrayElemAt: ['$buyerCompany', 0] }
        }
      },
      {
        $lookup: {
          from: 'companies',
          localField: 'supplierCompanyId',
          foreignField: '_id',
          as: 'supplierCompany'
        }
      },
      {
        $addFields: {
          'supplierCompany': { $arrayElemAt: ['$supplierCompany', 0] }
        }
      },
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
      {
        $addFields: {
          'deliveryOrder': { $arrayElemAt: ['$deliveryOrder', 0] }
        }
      },
      {
        $lookup: {
          from: 'invoices',
          localField: '_id',
          foreignField: 'purchaseOrderId',
          as: 'invoices'
        }
      },
      {
        $lookup: {
          from: 'reviews',
          localField: '_id',
          foreignField: 'purchaseOrderId',
          as: 'reviews'
        }
      }
    ]);

    const orders = (
      await Promise.all(
        ordersDoc.map(async (o: any) => {
          const items = o.items.map((i: any) => {
            const rfqItem = o.rfqItems.find(
              (r: any) => r._id.toString() === i.rfqItemId?.toString()
            );
            return {
              ...i,
              id: i._id.toString(),
              rfqItem: rfqItem ? { ...rfqItem, id: rfqItem._id.toString() } : null,
            };
          });

          const { computeOrderAmounts } = await import('@/lib/orderAmounts');
          const pricing = await computeOrderAmounts(o, items);

          const settlementInvoice = (o.invoices || []).find(
            (inv: any) => inv.type === 'SUPPLIER_PAYOUT'
          );
          const taxInvoice = (o.invoices || []).find((inv: any) => inv.type === 'TAX_INVOICE');

          return {
            ...o,
            id: o._id.toString(),
            buyerCompany: o.buyerCompany ? { name: o.buyerCompany.name } : null,
            supplierCompany: o.supplierCompany ? { name: o.supplierCompany.name } : null,
            items,
            buyerTotal: pricing.buyerTotal,
            goodsTaxable: pricing.goodsTaxable,
            platformFeeGst: pricing.taxTotal,
            supplierPayoutAmount: pricing.supplierPayoutTotal,
            supplierPayoutStatus: settlementInvoice?.status || null,
            taxInvoiceStatus: taxInvoice?.status || null,
            invoices: (o.invoices || []).map((inv: any) => ({ ...inv, id: inv._id.toString() })),
            reviews: (o.reviews || []).map((r: any) => ({ ...r, id: r._id.toString() })),
          };
        })
      )
    ).map((o: any) => {
      delete o.rfqItems;
      if (o.deliveryOrder) {
        o.deliveryOrder = sanitizeDeliveryOrder(o.deliveryOrder, {
          role: user.role,
          isBuyer: type === 'buying',
          isSupplier: type === 'selling',
        });
      }
      return o;
    });
    if (orders.length > 0) {
      const first = orders[0];
      console.log('[ORDERS-LIST] First order fields:', JSON.stringify({
        id: first.id,
        status: first.status,
        workImage20: first.workImage20,
        workImage40: first.workImage40,
        workImage60: first.workImage60,
        workImage80: first.workImage80,
        workImageId: first.workImageId,
        hasWorkImage20Key: 'workImage20' in first,
      }));
    }

    return console.log(`[API Response] /api/v1/orders - Sending response`), NextResponse.json({
      success: true,
      data: orders,
    });
  } catch (error: any) {
    console.error('List orders error:', error);
    return console.log(`[API Response] /api/v1/orders - Sending response`), NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: 'Internal server error' },
      { status: 500 }
    );
  }
}
