import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, authErrorResponse } from '@/lib/auth';

export async function GET(req: NextRequest) {
    console.log(`[API] ${req.method} ${req.nextUrl?.pathname || req.url}`);
  try {
    const user = await getAuthUser(req);
    if (!user || user.role !== 'PLATFORM_ADMIN') return authErrorResponse();

    await db();
    const { Payment } = await import('@/models/Finance');
    await import('@/models/PurchaseOrder');
    await import('@/models/Company');
    const mongoose = (await import('mongoose')).default;
    
    const paymentsDoc = await Payment.aggregate([
      { $sort: { createdAt: -1 } },
      {
        $lookup: {
          from: 'Invoice',
          localField: 'invoiceId',
          foreignField: '_id',
          as: 'invoice',
        },
      },
      {
        $unwind: { path: '$invoice', preserveNullAndEmptyArrays: true }
      },
      {
        $lookup: {
          from: 'PurchaseOrder',
          localField: 'invoice.purchaseOrderId',
          foreignField: '_id',
          as: 'invoice.purchaseOrder',
        },
      },
      {
        $unwind: { path: '$invoice.purchaseOrder', preserveNullAndEmptyArrays: true }
      },
      {
        $lookup: {
          from: 'Company',
          localField: 'invoice.purchaseOrder.buyerCompanyId',
          foreignField: '_id',
          as: 'invoice.purchaseOrder.buyerCompany',
        },
      },
      {
        $lookup: {
          from: 'Company',
          localField: 'invoice.purchaseOrder.supplierCompanyId',
          foreignField: '_id',
          as: 'invoice.purchaseOrder.supplierCompany',
        },
      },
      {
        $addFields: {
          'invoice.purchaseOrder.buyerCompany': { $arrayElemAt: ['$invoice.purchaseOrder.buyerCompany', 0] },
          'invoice.purchaseOrder.supplierCompany': { $arrayElemAt: ['$invoice.purchaseOrder.supplierCompany', 0] }
        }
      }
    ]);

    const payments = paymentsDoc.map((p: any) => ({
      ...p,
      id: p._id.toString(),
      invoice: p.invoice ? {
        ...p.invoice,
        id: p.invoice._id.toString(),
        purchaseOrder: p.invoice.purchaseOrder ? {
          ...p.invoice.purchaseOrder,
          id: p.invoice.purchaseOrder._id.toString(),
          buyerCompany: p.invoice.purchaseOrder.buyerCompany ? {
            ...p.invoice.purchaseOrder.buyerCompany,
            id: p.invoice.purchaseOrder.buyerCompany._id.toString()
          } : null,
          supplierCompany: p.invoice.purchaseOrder.supplierCompany ? {
            ...p.invoice.purchaseOrder.supplierCompany,
            id: p.invoice.purchaseOrder.supplierCompany._id.toString()
          } : null
        } : null
      } : null
    }));

    return console.log(`[API Response] /api/v1/admin/payments - Sending response`), NextResponse.json({
      success: true,
      data: payments,
    });
  } catch (error: any) {
    console.error('List payments error:', error);
    return console.log(`[API Response] /api/v1/admin/payments - Sending response`), NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: 'Internal server error' },
      { status: 500 }
    );
  }
}
