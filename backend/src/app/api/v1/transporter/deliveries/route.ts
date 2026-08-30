import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, authErrorResponse } from '@/lib/auth';
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
          from: 'PurchaseOrder',
          localField: 'purchaseOrderId',
          foreignField: '_id',
          as: 'purchaseOrder'
        }
      },
      { $unwind: { path: '$purchaseOrder', preserveNullAndEmptyArrays: true } },
    ];

    if (user.role !== 'PLATFORM_ADMIN') {
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
          from: 'Company',
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
          from: 'Company',
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
          from: 'Company',
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

    const deliveries = deliveriesDoc.map((d: any) => ({
      ...d,
      id: d._id.toString(),
      purchaseOrder: d.purchaseOrder ? {
        ...d.purchaseOrder,
        id: d.purchaseOrder._id.toString(),
        buyerCompany: d.purchaseOrder.buyerCompany ? { name: d.purchaseOrder.buyerCompany.name } : null,
        supplierCompany: d.purchaseOrder.supplierCompany ? { name: d.purchaseOrder.supplierCompany.name } : null
      } : null,
      transporter: d.transporter ? { ...d.transporter, id: d.transporter._id.toString() } : null
    }));

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
