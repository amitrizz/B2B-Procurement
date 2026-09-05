import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, authErrorResponse } from '@/lib/auth';
import { sanitizeDeliveryOrder } from '@/lib/deliveryOrderSanitize';
import { ensureAllPendingSampleDeliveries } from '@/lib/sampleDelivery';
import mongoose from 'mongoose';

export async function GET(req: NextRequest) {
  console.log(`[API] ${req.method} ${req.nextUrl?.pathname || req.url}`);
  try {
    const user = await getAuthUser(req);
    if (!user) return authErrorResponse();

    await db();
    await ensureAllPendingSampleDeliveries();
    const { DeliveryOrder } = await import('@/models/Logistics');
    await import('@/models/PurchaseOrder');
    await import('@/models/Company');
    await import('@/models/Sampling');
    await import('@/models/RFQ');

    const pipeline: any[] = [
      { $sort: { createdAt: -1 } },
      {
        $lookup: {
          from: 'purchaseorders',
          localField: 'purchaseOrderId',
          foreignField: '_id',
          as: 'purchaseOrder',
        },
      },
      { $unwind: { path: '$purchaseOrder', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'SamplingInvite',
          localField: 'samplingInviteId',
          foreignField: '_id',
          as: 'samplingInvite',
        },
      },
      { $unwind: { path: '$samplingInvite', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'rfqs',
          localField: 'rfqId',
          foreignField: '_id',
          as: 'rfq',
        },
      },
      { $unwind: { path: '$rfq', preserveNullAndEmptyArrays: true } },
    ];

    if (user.role === 'TRANSPORTER') {
      pipeline.push({
        $match: {
          $or: [{ status: 'CREATED' }, { transporterId: new mongoose.Types.ObjectId(user.companyId) }],
        },
      });
    } else if (user.role !== 'PLATFORM_ADMIN') {
      if (!user.companyId) {
        return NextResponse.json({ success: false, code: 'FORBIDDEN', message: 'Forbidden' }, { status: 403 });
      }
      pipeline.push({
        $match: {
          $or: [
            { 'purchaseOrder.buyerCompanyId': new mongoose.Types.ObjectId(user.companyId) },
            { 'purchaseOrder.supplierCompanyId': new mongoose.Types.ObjectId(user.companyId) },
            { 'samplingInvite.supplierCompanyId': new mongoose.Types.ObjectId(user.companyId) },
            { 'rfq.buyerCompanyId': new mongoose.Types.ObjectId(user.companyId) },
          ],
        },
      });
    }

    pipeline.push(
      {
        $lookup: {
          from: 'companies',
          localField: 'purchaseOrder.buyerCompanyId',
          foreignField: '_id',
          as: 'poBuyerCompany',
        },
      },
      {
        $lookup: {
          from: 'companies',
          localField: 'purchaseOrder.supplierCompanyId',
          foreignField: '_id',
          as: 'poSupplierCompany',
        },
      },
      {
        $lookup: {
          from: 'companies',
          localField: 'rfq.buyerCompanyId',
          foreignField: '_id',
          as: 'rfqBuyerCompany',
        },
      },
      {
        $lookup: {
          from: 'companies',
          localField: 'samplingInvite.supplierCompanyId',
          foreignField: '_id',
          as: 'sampleSupplierCompany',
        },
      },
      {
        $lookup: {
          from: 'companyaddresses',
          localField: 'purchaseOrder.buyerCompanyId',
          foreignField: 'companyId',
          as: 'buyerAddresses',
        },
      },
      {
        $lookup: {
          from: 'companyaddresses',
          localField: 'purchaseOrder.supplierCompanyId',
          foreignField: 'companyId',
          as: 'supplierAddresses',
        },
      },
      {
        $lookup: {
          from: 'companyaddresses',
          localField: 'samplingInvite.supplierCompanyId',
          foreignField: 'companyId',
          as: 'sampleSupplierAddresses',
        },
      },
      {
        $lookup: {
          from: 'companyaddresses',
          localField: 'rfq.buyerCompanyId',
          foreignField: 'companyId',
          as: 'sampleBuyerAddresses',
        },
      },
      {
        $lookup: {
          from: 'companies',
          localField: 'transporterId',
          foreignField: '_id',
          as: 'transporter',
        },
      },
      {
        $addFields: {
          transporter: { $arrayElemAt: ['$transporter', 0] },
        },
      }
    );

    const deliveriesDoc = await DeliveryOrder.aggregate(pipeline);

    const formatAddress = (addresses: any[], snapshot?: string) => {
      if (snapshot) return snapshot;
      const primary = addresses?.find((a) => a.isPrimary) || addresses?.[0];
      if (!primary) return null;
      return `${primary.addressLine1}, ${primary.city}, ${primary.state} - ${primary.pincode}`;
    };

    const deliveries = deliveriesDoc.map((d: any) => {
      const isSample = d.purpose === 'SAMPLE';
      const isBuyer =
        user.companyId &&
        (d.purchaseOrder?.buyerCompanyId?.toString() === user.companyId ||
          d.rfq?.buyerCompanyId?.toString() === user.companyId);
      const isSupplier =
        user.companyId &&
        (d.purchaseOrder?.supplierCompanyId?.toString() === user.companyId ||
          d.samplingInvite?.supplierCompanyId?.toString() === user.companyId);

      let purchaseOrder: any = null;
      if (isSample) {
        const buyerCo = d.rfqBuyerCompany?.[0];
        const supplierCo = d.sampleSupplierCompany?.[0];
        purchaseOrder = {
          id: d.rfq?._id?.toString() || d._id?.toString(),
          poNumber: d.rfq?.rfqNumber || d.deliveryNumber,
          orderType: 'SAMPLE',
          buyerCompany: {
            name: buyerCo?.name || 'Buyer',
            address: formatAddress(d.sampleBuyerAddresses, d.dropAddressSnapshot) || d.dropAddressSnapshot || 'Address not provided',
          },
          supplierCompany: {
            name: supplierCo?.name || 'Supplier',
            address: formatAddress(d.sampleSupplierAddresses, d.pickupAddressSnapshot) || d.pickupAddressSnapshot || 'Address not provided',
          },
        };
      } else if (d.purchaseOrder?._id) {
        const poBuyer = d.poBuyerCompany?.[0];
        const poSupplier = d.poSupplierCompany?.[0];
        purchaseOrder = {
          ...d.purchaseOrder,
          id: d.purchaseOrder._id.toString(),
          buyerCompany: poBuyer
            ? { name: poBuyer.name, address: formatAddress(d.buyerAddresses) }
            : null,
          supplierCompany: poSupplier
            ? { name: poSupplier.name, address: formatAddress(d.supplierAddresses) }
            : null,
        };
      }

      const formatted = {
        ...d,
        id: d._id?.toString(),
        purchaseOrder,
        transporter: d.transporter?._id ? { ...d.transporter, id: d.transporter._id.toString() } : null,
      };

      delete formatted.purchaseOrderArray;
      delete formatted.samplingInvite;
      delete formatted.rfq;

      return sanitizeDeliveryOrder(formatted, {
        role: user.role,
        isBuyer: Boolean(isBuyer),
        isSupplier: Boolean(isSupplier),
      });
    });

    return NextResponse.json({ success: true, data: deliveries });
  } catch (error: any) {
    console.error('List deliveries error:', error);
    return NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: 'Internal server error' },
      { status: 500 }
    );
  }
}
