import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, authErrorResponse } from '@/lib/auth';
import { sanitizeDeliveryOrder } from '@/lib/deliveryOrderSanitize';
import mongoose from 'mongoose';

export async function GET(req: NextRequest) {
    console.log(`[API] ${req.method} ${req.nextUrl?.pathname || req.url}`);
  try {
    const user = await getAuthUser(req);
    if (!user) return authErrorResponse();

    await db();
    const { DeliveryOrder } = await import('@/models/Logistics');
    await import('@/models/PurchaseOrder');
    await import('@/models/Company');

    const matchStage: any = {};
    if (user.role !== 'PLATFORM_ADMIN') {
      if (!user.companyId) {
        return console.log(`[API Response] /api/v1/transporter/deliveries - Sending response`), NextResponse.json(
          { success: false, code: 'FORBIDDEN', message: 'Forbidden' },
          { status: 403 }
        );
      }
      
      // we need to match deliveries where the associated PO has buyerCompanyId or supplierCompanyId equal to user.companyId
      // Because we can't do that directly without a lookup, we'll do the lookup first, then match.
    }

    const pipeline: any[] = [
      { $sort: { createdAt: -1 } },
      {
        $lookup: {
          from: 'purchaseorders',
          localField: 'purchaseOrderId',
          foreignField: '_id',
          as: 'purchaseOrder'
        }
      },
      { $unwind: { path: '$purchaseOrder', preserveNullAndEmptyArrays: true } },
    ];

    if (user.role === 'TRANSPORTER') {
      pipeline.push({
        $match: {
          $or: [
            { status: 'CREATED' },
            { transporterId: new mongoose.Types.ObjectId(user.companyId) }
          ]
        }
      });
    } else if (user.role !== 'PLATFORM_ADMIN') {
      pipeline.push({
        $match: {
          $or: [
            { 'purchaseOrder.buyerCompanyId': new mongoose.Types.ObjectId(user.companyId) },
            { 'purchaseOrder.supplierCompanyId': new mongoose.Types.ObjectId(user.companyId) }
          ]
        }
      });
    }

    pipeline.push(
      {
        $lookup: {
          from: 'companies',
          localField: 'purchaseOrder.buyerCompanyId',
          foreignField: '_id',
          as: 'purchaseOrder.buyerCompany'
        }
      },
      {
        $addFields: {
          'purchaseOrder.buyerCompany': { $arrayElemAt: ['$purchaseOrder.buyerCompany', 0] }
        }
      },
      {
        $lookup: {
          from: 'companies',
          localField: 'purchaseOrder.supplierCompanyId',
          foreignField: '_id',
          as: 'purchaseOrder.supplierCompany'
        }
      },
      {
        $addFields: {
          'purchaseOrder.supplierCompany': { $arrayElemAt: ['$purchaseOrder.supplierCompany', 0] }
        }
      },
      {
        $lookup: {
          from: 'companyaddresses',
          localField: 'purchaseOrder.buyerCompanyId',
          foreignField: 'companyId',
          as: 'buyerAddresses'
        }
      },
      {
        $lookup: {
          from: 'companyaddresses',
          localField: 'purchaseOrder.supplierCompanyId',
          foreignField: 'companyId',
          as: 'supplierAddresses'
        }
      },
      {
        $lookup: {
          from: 'companies',
          localField: 'transporterId',
          foreignField: '_id',
          as: 'transporter'
        }
      },
      {
        $addFields: {
          'transporter': { $arrayElemAt: ['$transporter', 0] }
        }
      }
    );

    const deliveriesDoc = await DeliveryOrder.aggregate(pipeline);

    const formatAddress = (addresses: any[]) => {
      const primary = addresses?.find(a => a.isPrimary) || addresses?.[0];
      if (!primary) return null;
      return `${primary.addressLine1}, ${primary.city}, ${primary.state} - ${primary.pincode}`;
    };

    const deliveries = deliveriesDoc.map((d: any) => {
      const formatted = {
      ...d,
      id: d._id?.toString(),
      purchaseOrder: (d.purchaseOrder && d.purchaseOrder._id) ? {
        ...d.purchaseOrder,
        id: d.purchaseOrder._id.toString(),
        buyerCompany: d.purchaseOrder.buyerCompany ? { name: d.purchaseOrder.buyerCompany.name, address: formatAddress(d.buyerAddresses) } : null,
        supplierCompany: d.purchaseOrder.supplierCompany ? { name: d.purchaseOrder.supplierCompany.name, address: formatAddress(d.supplierAddresses) } : null
      } : null,
      transporter: (d.transporter && d.transporter._id) ? { ...d.transporter, id: d.transporter._id.toString() } : null
    };
      return sanitizeDeliveryOrder(formatted, { role: user.role });
    });

    return console.log(`[API Response] /api/v1/transporter/deliveries - Sending response`), NextResponse.json({
      success: true,
      data: deliveries,
    });
  } catch (error: any) {
    console.error('List deliveries error:', error);
    return console.log(`[API Response] /api/v1/transporter/deliveries - Sending response`), NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: 'Internal server error' },
      { status: 500 }
    );
  }
}
