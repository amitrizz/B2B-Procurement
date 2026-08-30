import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import mongoose from 'mongoose';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(req);
    if (!user || !user.companyId) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { id } = await params;
    const cleanId = id.split('.')[0];

    await db();
    const { FileStorage, PlatformConfig, AuditLog, Dispute, Review, NumberSequence } = await import('@/models/Platform');
    const { CompanyDocument, Company } = await import('@/models/Company');
    const { PurchaseOrder, GoodsReceipt, PurchaseOrderItem, PurchaseOrderRevision } = await import('@/models/PurchaseOrder');
    const { RFQItem, RFQ, RfqQuestion } = await import('@/models/RFQ');
    const { Bid } = await import('@/models/Bid');
    const { DeliveryOrder, TransporterDocument, Transporter } = await import('@/models/Logistics');
    const { Payment, Invoice, InvoiceLine, LedgerEntry, CreditNote } = await import('@/models/Finance');

    const fileRecord = await FileStorage.findById(cleanId).lean() as any;

    if (!fileRecord) {
      return new Response('File not found', { status: 404 });
    }

    if (user.role !== 'PLATFORM_ADMIN') {
      let isAllowed = false;
      let isDrawing = false;
      const companyIdStr = user.companyId.toString();

      // 1. Company Document
      const doc = await CompanyDocument.findOne({ fileId: cleanId, companyId: user.companyId }).lean();
      if (doc) isAllowed = true;

      // 2. PO Work Images
      if (!isAllowed) {
        const po = await PurchaseOrder.findOne({
          $or: [
            { workImageId: cleanId },
            { workImage20: cleanId },
            { workImage40: cleanId },
            { workImage60: cleanId },
            { workImage80: cleanId },
          ],
          $and: [
            { $or: [{ buyerCompanyId: user.companyId }, { supplierCompanyId: user.companyId }] }
          ]
        }).lean();
        if (po) isAllowed = true;
      }

      // 3. RFQ Drawings
      if (!isAllowed) {
        const item = await RFQItem.aggregate([
          { $match: { drawingFileId: cleanId } },
          {
            $lookup: {
              from: 'rfqs',
              localField: 'rfqId',
              foreignField: '_id',
              as: 'rfq'
            }
          },
          { $unwind: '$rfq' }
        ]);

        if (item && item.length > 0) {
          const rfqItem = item[0];
          isDrawing = true;
          if (rfqItem.rfq.buyerCompanyId.toString() === companyIdStr) {
            isAllowed = true; // Buyer can see their own
          } else {
            // Suppliers can see if published OR if they have a bid
            if (rfqItem.rfq.status === 'PUBLISHED') {
               isAllowed = true;
            } else {
               const bid = await Bid.findOne({
                 rfqItemId: rfqItem._id, supplierCompanyId: user.companyId, status: { $in: ['SUBMITTED', 'ACCEPTED'] }
               }).lean();
               if (bid) isAllowed = true;
            }
          }
        }
      }

      // 4. Delivery POD
      if (!isAllowed) {
        const delivery = await DeliveryOrder.aggregate([
          { $match: { podFileId: cleanId } },
          {
            $lookup: {
              from: 'purchaseorders',
              localField: 'purchaseOrderId',
              foreignField: '_id',
              as: 'purchaseOrder'
            }
          },
          { $unwind: '$purchaseOrder' }
        ]);

        if (delivery && delivery.length > 0) {
          const del = delivery[0];
          if (del.purchaseOrder.buyerCompanyId.toString() === companyIdStr || del.purchaseOrder.supplierCompanyId.toString() === companyIdStr) {
            isAllowed = true;
          }
        }
      }
      
      // 5. Payment Proof
      if (!isAllowed) {
        const payment = await Payment.aggregate([
          { $match: { proofFileId: cleanId } },
          {
            $lookup: {
              from: 'invoices',
              localField: 'invoiceId',
              foreignField: '_id',
              as: 'invoice'
            }
          },
          { $unwind: '$invoice' }
        ]);

        if (payment && payment.length > 0) {
          const pay = payment[0];
          if (pay.invoice.payerCompanyId.toString() === companyIdStr || pay.invoice.payeeCompanyId.toString() === companyIdStr) {
            isAllowed = true;
          }
        }
      }

      if (!isAllowed) {
        return new Response('Forbidden', { status: 403 });
      }

      if (isDrawing) {
        const company = await Company.findById(user.companyId).lean() as any;
        if (!company?.drawingsNdaAcceptedAt) {
          return new Response(JSON.stringify({ code: 'NDA_REQUIRED', message: 'Drawings NDA required' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
        }
      }
    }

    if (!fileRecord) {
      return new Response('File not found', { status: 404 });
    }

    if (fileRecord.data === 'minio' && fileRecord.objectKey) {
      const { minioClient, BUCKET_NAME } = await import('@/lib/minio');
      try {
        const dataStream = await minioClient.getObject(BUCKET_NAME, fileRecord.objectKey);
        
        const webStream = new ReadableStream({
          start(controller) {
            dataStream.on('data', (chunk) => controller.enqueue(chunk));
            dataStream.on('end', () => controller.close());
            dataStream.on('error', (err) => controller.error(err));
          }
        });

        return new Response(webStream, {
          headers: {
            'Content-Type': fileRecord.mimeType,
            'Content-Disposition': `inline; filename="${fileRecord.filename}"`,
            'Cache-Control': 'public, max-age=31536000, immutable',
          },
        });
      } catch (err) {
        console.error('Minio getObject error:', err);
        return new Response('Error retrieving file from storage', { status: 500 });
      }
    }

    // Convert Base64 back to binary Buffer
    const buffer = Buffer.from(fileRecord.data, 'base64');

    return new Response(buffer, {
      headers: {
        'Content-Type': fileRecord.mimeType,
        'Content-Disposition': `inline; filename="${fileRecord.filename}"`,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error: any) {
    console.error('File retrieval error:', error);
    return new Response('Internal server error', { status: 500 });
  }
}
