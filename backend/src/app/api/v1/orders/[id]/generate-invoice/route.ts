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

    const po = await PurchaseOrder.findById(id).lean() as any;

    if (!po) {
      return NextResponse.json({ success: false, code: 'NOT_FOUND', message: 'PO not found' }, { status: 404 });
    }

    if (po.supplierCompanyId.toString() !== user.companyId) {
      return NextResponse.json(
        { success: false, code: 'FORBIDDEN', message: 'Only supplier can generate the tax invoice' },
        { status: 403 }
      );
    }

    if (po.status !== 'COMPLETED') {
      return NextResponse.json(
        {
          success: false,
          code: 'INVALID_STATUS',
          message: 'Order must be COMPLETED (buyer GRN confirmed) before generating tax invoice',
        },
        { status: 400 }
      );
    }

    const items = await PurchaseOrderItem.find({ purchaseOrderId: po._id }).lean() as any[];
    const buyerCompany = await Company.findById(po.buyerCompanyId).lean() as any;
    const supplierCompany = await Company.findById(po.supplierCompanyId).lean() as any;

    const existingInvoice = await Invoice.findOne({ purchaseOrderId: po._id, type: 'TAX_INVOICE' }).lean() as any;

    if (existingInvoice) {
      return NextResponse.json(
        { success: false, code: 'ALREADY_EXISTS', message: 'Tax invoice already generated' },
        { status: 400 }
      );
    }

    const { nextNumber } = await import('@/lib/sequence');
    const { getPlatformBilling } = await import('@/lib/platformBilling');
    const { computeOrderAmounts } = await import('@/lib/orderAmounts');
    const platform = await getPlatformBilling();

    const invoiceNumber = await nextNumber('INV');
    const payoutNumber = await nextNumber('PAYOUT');

    const amounts = await computeOrderAmounts(po, items);
    const {
      goodsTaxable,
      commissionAmount,
      invoiceTaxable,
      cgstAmount,
      sgstAmount,
      igstAmount,
      taxTotal,
      invoiceTotal,
      supplierPayoutTotal,
    } = amounts;

    const irn = `STUB-IRN-${Date.now()}`;
    const ackNo = `ACK-${Math.floor(Math.random() * 1000000)}`;
    const signedQr = `MOCK_SIGNED_QR_${irn}`;

    const session = await mongoose.startSession();
    let invoice: any = null;
    let payoutInvoice: any = null;

    try {
      session.startTransaction();

      const placeOfSupplyState = po.placeOfSupplyState || buyerCompany?.state || platform.state;

      const invDoc = await Invoice.create(
        [
          {
            number: invoiceNumber,
            type: 'TAX_INVOICE',
            purchaseOrderId: po._id,
            payerCompanyId: po.buyerCompanyId,
            payeeCompanyId: po.supplierCompanyId,
            payeeType: 'PLATFORM',
            sellerGstin: platform.gstin,
            buyerGstin: buyerCompany?.gstin || '',
            placeOfSupplyState,
            taxable: invoiceTaxable,
            cgstAmount,
            sgstAmount,
            igstAmount,
            total: invoiceTotal,
            status: 'UNPAID',
            irn,
            ackNo,
            signedQr,
          },
        ],
        { session }
      );

      invoice = invDoc[0];

      const payoutDoc = await Invoice.create(
        [
          {
            number: payoutNumber,
            type: 'SUPPLIER_PAYOUT',
            purchaseOrderId: po._id,
            payerCompanyId: null,
            payeeCompanyId: po.supplierCompanyId,
            payeeType: 'PLATFORM',
            sellerGstin: supplierCompany?.gstin || '',
            buyerGstin: platform.gstin,
            placeOfSupplyState,
            taxable: goodsTaxable,
            cgstAmount: 0,
            sgstAmount: 0,
            igstAmount: 0,
            total: supplierPayoutTotal,
            status: 'AWAITING_BUYER_PAYMENT',
          },
        ],
        { session }
      );

      payoutInvoice = payoutDoc[0];

      const goodsLineDocs = items.map((item, index) => ({
        invoiceId: invoice._id,
        description: `PO line item ${index + 1}`,
        hsnCode: item.hsnCode || '',
        qty: item.quantity,
        unitPrice: item.unitPrice,
        taxable: item.quantity * item.unitPrice,
        taxRateBps: 0,
        taxAmount: 0,
      }));

      const platformFeeLine = {
        invoiceId: invoice._id,
        description: 'Platform service fee',
        hsnCode: '998599',
        qty: 1,
        unitPrice: commissionAmount,
        taxable: commissionAmount,
        taxRateBps: 1800,
        taxAmount: taxTotal,
      };

      const payoutLineDocs = items.map((item, index) => ({
        invoiceId: payoutInvoice._id,
        description: `PO line item ${index + 1}`,
        hsnCode: item.hsnCode || '',
        qty: item.quantity,
        unitPrice: item.unitPrice,
        taxable: item.quantity * item.unitPrice,
        taxRateBps: 0,
        taxAmount: 0,
      }));

      const allLineDocs = [...goodsLineDocs, platformFeeLine, ...payoutLineDocs];

      if (allLineDocs.length) {
        await InvoiceLine.insertMany(allLineDocs, { session });
      }

      await session.commitTransaction();
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }

    const { broadcastOrderUpdate } = await import('@/lib/orderEvents');
    await broadcastOrderUpdate(
      po,
      'invoice_created',
      `Tax invoice ${invoiceNumber} generated. Buyer pays platform; supplier settlement ${payoutNumber} created.`
    );

    return NextResponse.json({
      success: true,
      message: 'Buyer tax invoice and supplier settlement invoice created successfully',
      data: {
        taxInvoice: { ...invoice.toObject(), id: invoice._id.toString(), number: invoiceNumber },
        settlementInvoice: {
          ...payoutInvoice.toObject(),
          id: payoutInvoice._id.toString(),
          number: payoutNumber,
        },
      },
    });
  } catch (error: any) {
    console.error('Generate invoice error:', error);
    return NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: 'Internal server error' },
      { status: 500 }
    );
  }
}
