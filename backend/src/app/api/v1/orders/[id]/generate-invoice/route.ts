import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, authErrorResponse } from '@/lib/auth';
import mongoose from 'mongoose';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
    console.log(`[API] ${req.method} ${req.nextUrl?.pathname || req.url}`);
  try {
    const user = await getAuthUser(req);
    if (!user || !user.companyId) return authErrorResponse();

    const { id } = await params;

    await db();
    const { PurchaseOrder, PurchaseOrderItem } = await import('@/models/PurchaseOrder');
    const { Company } = await import('@/models/Company');
    const { Invoice, InvoiceLine } = await import('@/models/Finance');
    const { RFQItem } = await import('@/models/RFQ'); // if we need componentName

    const po = await PurchaseOrder.findById(id).lean() as any;

    if (!po) {
      return console.log(`[API Response] /api/v1/orders/[id]/generate-invoice - Sending response`), NextResponse.json({ success: false, code: 'NOT_FOUND', message: 'PO not found' }, { status: 404 });
    }

    if (po.supplierCompanyId.toString() !== user.companyId) {
      return console.log(`[API Response] /api/v1/orders/[id]/generate-invoice - Sending response`), NextResponse.json({ success: false, code: 'FORBIDDEN', message: 'Only supplier can generate the tax invoice' }, { status: 403 });
    }

    const items = await PurchaseOrderItem.find({ poId: po._id }).lean() as any[];
    const buyerCompany = await Company.findById(po.buyerCompanyId).lean() as any;
    const supplierCompany = await Company.findById(po.supplierCompanyId).lean() as any;

    // Check if TAX_INVOICE already exists
    const existingInvoice = await Invoice.findOne({ purchaseOrderId: po._id, type: 'TAX_INVOICE' }).lean() as any;

    if (existingInvoice) {
      return console.log(`[API Response] /api/v1/orders/[id]/generate-invoice - Sending response`), NextResponse.json({ success: false, code: 'ALREADY_EXISTS', message: 'Tax invoice already generated' }, { status: 400 });
    }

    const { nextNumber } = await import('@/lib/sequence');
    const invoiceNumber = await nextNumber('INV');

    // E-Invoice Stub Logic
    const irn = `STUB-IRN-${Date.now()}`;
    const ackNo = `ACK-${Math.floor(Math.random() * 1000000)}`;
    const signedQr = `MOCK_SIGNED_QR_${irn}`;
    
    const invoiceTaxable = items.reduce((sum, item) => sum + (item.quantity * item.finalUnitPrice), 0);

    const session = await mongoose.startSession();
    let invoice: any = null;

    try {
      session.startTransaction();

      // Ensure fields that might not exist are safely handled or defaulted
      const placeOfSupplyState = po.placeOfSupplyState || 'Maharashtra'; // fallback
      const cgstAmount = po.cgstAmount || 0;
      const sgstAmount = po.sgstAmount || 0;
      const igstAmount = po.igstAmount || 0;

      const invDoc = await Invoice.create([{
        invoiceNumber,
        type: 'TAX_INVOICE',
        purchaseOrderId: po._id,
        payerCompanyId: po.buyerCompanyId,
        payeeCompanyId: po.supplierCompanyId,
        payeeType: 'COMPANY',
        sellerGstin: supplierCompany?.gstin || '',
        buyerGstin: buyerCompany?.gstin || '',
        placeOfSupplyState,
        baseAmount: invoiceTaxable,
        cgst: cgstAmount,
        sgst: sgstAmount,
        igst: igstAmount,
        totalAmount: invoiceTaxable + cgstAmount + sgstAmount + igstAmount,
        status: 'UNPAID',
        irn,
        ackNo,
        signedQr,
      }], { session });

      invoice = invDoc[0];

      // Create lines
      const lineDocs = items.map((item, index) => {
         return {
            invoiceId: invoice._id,
            description: `PO Item ${index + 1}`, // Assuming no direct link to RFQItem.componentName easily available without extra lookup. Or we could fetch it.
            hsnCode: item.hsnCode || '',
            quantity: item.quantity,
            unitPrice: item.finalUnitPrice,
            totalPrice: item.quantity * item.finalUnitPrice,
            taxAmount: 0 // Ideally this is calculated per line, but omitting for simplicity in stub
         };
      });

      await InvoiceLine.insertMany(lineDocs, { session });

      await session.commitTransaction();
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }

    return console.log(`[API Response] /api/v1/orders/[id]/generate-invoice - Sending response`), NextResponse.json({
      success: true,
      message: 'Tax Invoice with E-Invoice STUB created successfully',
      data: { ...invoice.toObject(), id: invoice._id.toString() }
    });

  } catch (error: any) {
    console.error('Generate invoice error:', error);
    return console.log(`[API Response] /api/v1/orders/[id]/generate-invoice - Sending response`), NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: 'Internal server error' },
      { status: 500 }
    );
  }
}
