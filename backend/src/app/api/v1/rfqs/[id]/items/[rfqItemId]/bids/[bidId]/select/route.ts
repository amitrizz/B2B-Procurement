import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, authErrorResponse } from '@/lib/auth';
import { computeGst } from '@/lib/gst';
import { nextNumber } from '@/lib/sequence';
import mongoose from 'mongoose';

type Params = {
  params: Promise<{ id: string; rfqItemId: string; bidId: string }>
}

export async function POST(req: NextRequest, { params }: Params) {
    console.log(`[API] ${req.method} ${req.nextUrl?.pathname || req.url}`);
  try {
    const user = await getAuthUser(req);
    if (!user || !user.companyId) return authErrorResponse();

    const { id: rfqId, rfqItemId, bidId } = await params;
    
    // Some basic info from req (materialOptionPreference if applicable)
    const body = await req.json().catch(() => ({}));
    const selectedMaterialOption = body.materialOptionPreference; 

    await db();
    const { RFQ, RFQItem } = await import('@/models/RFQ');
    const { Bid } = await import('@/models/Bid');
    const { CompanyAddress, Company } = await import('@/models/Company');
    const { PurchaseOrder, PurchaseOrderItem } = await import('@/models/PurchaseOrder');
    const { Invoice, InvoiceLine, LedgerEntry } = await import('@/models/Finance');

    const rfq = await RFQ.findById(rfqId).lean() as any;
    const rfqItems = rfq ? await RFQItem.find({ rfqId: rfq._id }).lean() as any[] : [];
    const rfqItem = rfqItems.find(i => i._id.toString() === rfqItemId);
    const buyerCompany = rfq ? await Company.findById(rfq.buyerCompanyId).lean() as any : null;
    const buyerAddresses = buyerCompany ? await CompanyAddress.find({ companyId: buyerCompany._id }).lean() as any[] : [];
    const buyerPrimaryAddress = buyerAddresses.find(a => a.isPrimary) || buyerAddresses[0];

    if (!rfq || rfq.buyerCompanyId.toString() !== user.companyId) {
      return console.log(`[API Response] /api/v1/rfqs/[id]/items/[rfqItemId]/bids/[bidId]/select - Sending response`), NextResponse.json({ success: false, code: 'FORBIDDEN', message: 'You do not own this RFQ' }, { status: 403 });
    }

    if (rfq.status !== 'PUBLISHED' && rfq.status !== 'PARTIALLY_AWARDED') {
      return console.log(`[API Response] /api/v1/rfqs/[id]/items/[rfqItemId]/bids/[bidId]/select - Sending response`), NextResponse.json({ success: false, code: 'INVALID_STATUS', message: 'RFQ must be published to award bids' }, { status: 400 });
    }

    const bid = await Bid.findById(bidId).lean() as any;
    const supplierCompany = bid ? await Company.findById(bid.supplierCompanyId).lean() as any : null;
    const supplierAddresses = supplierCompany ? await CompanyAddress.find({ companyId: supplierCompany._id }).lean() as any[] : [];
    const supplierPrimaryAddress = supplierAddresses.find(a => a.isPrimary) || supplierAddresses[0];

    if (!bid || bid.rfqItemId.toString() !== rfqItemId || bid.status !== 'SUBMITTED') {
      return console.log(`[API Response] /api/v1/rfqs/[id]/items/[rfqItemId]/bids/[bidId]/select - Sending response`), NextResponse.json({ success: false, code: 'INVALID_BID', message: 'Invalid bid or already processed' }, { status: 400 });
    }

    const buyerState = buyerPrimaryAddress?.state || 'Maharashtra';
    const supplierState = supplierPrimaryAddress?.state || 'Maharashtra';

    // Determine unit price based on material choice
    let unitPrice = 0;
    let finalMaterialPreference = bid.materialOptionPreference;
    if (finalMaterialPreference === 'BOTH') {
      finalMaterialPreference = selectedMaterialOption || 'WITH_MATERIAL';
    }
    
    if (finalMaterialPreference === 'WITH_MATERIAL' && bid.priceWithMaterial) {
      unitPrice = bid.priceWithMaterial;
    } else if (finalMaterialPreference === 'WITHOUT_MATERIAL' && bid.priceWithoutMaterial) {
      unitPrice = bid.priceWithoutMaterial;
    } else {
      // Fallback
      unitPrice = bid.priceWithMaterial || bid.priceWithoutMaterial || 0;
    }

    const baseAmount = unitPrice * bid.quantity;
    const gstInfo = computeGst({
      taxablePaise: baseAmount,
      taxRateBps: 1800,
      shipToState: buyerState,
      supplierState
    });
    const totalAmount = baseAmount + gstInfo.cgst + gstInfo.sgst + gstInfo.igst;

    const poNumber = await nextNumber('PO');
    
    const session = await mongoose.startSession();
    let result: any = null;

    try {
      session.startTransaction();

      // 1. Accept bid
      await Bid.updateOne(
        { _id: bid._id },
        { $set: { status: 'ACCEPTED' } },
        { session }
      );

      // Reject other bids for this item
      await Bid.updateMany(
        { rfqItemId, _id: { $ne: bid._id }, status: 'SUBMITTED' },
        { $set: { status: 'REJECTED' } },
        { session }
      );

      // 2. Create PO
      const poDoc = await PurchaseOrder.create([{
        poNumber,
        rfqId,
        buyerCompanyId: user.companyId,
        supplierCompanyId: bid.supplierCompanyId,
        status: 'CREATED', // was AWAITING_ACCEPTANCE in schema/original code, mapped appropriately
        totalAmount,
        taxAmount: gstInfo.cgst + gstInfo.sgst + gstInfo.igst,
        commissionAmount: 0,
        deliveryCharge: 0,
      }], { session });

      const po = poDoc[0];

      // Create PO Line
      await PurchaseOrderItem.create([{
        poId: po._id,
        rfqItemId: bid.rfqItemId,
        bidId: bid._id,
        quantity: bid.quantity,
        unitPrice,
        materialOption: finalMaterialPreference,
        taxRateBps: 1800,
        taxAmount: gstInfo.cgst + gstInfo.sgst + gstInfo.igst,
        priceWithoutMaterial: bid.priceWithoutMaterial,
        priceWithMaterial: bid.priceWithMaterial,
        finalUnitPrice: unitPrice,
        hsnCode: rfqItem?.hsnCode || ''
      }], { session });

      // Check if all items awarded to update RFQ status
      const allItems = await RFQItem.find({ rfqId }).session(session).lean();
      const awardedItems = await Bid.find({ rfqId, status: 'ACCEPTED' }).session(session).lean();
      
      const newRfqStatus = awardedItems.length >= allItems.length ? 'CLOSED' : 'PARTIALLY_AWARDED';
      await RFQ.updateOne(
        { _id: rfqId },
        { $set: { status: newRfqStatus } },
        { session }
      );

      // Platform Commission logic
      // Assuming platform is in Maharashtra (MH) for inter-state calculation
      const platformState = 'Maharashtra';
      const commissionBase = Math.round(baseAmount * 0.05);
      const commissionGst = computeGst({
        taxablePaise: commissionBase,
        taxRateBps: 1800,
        shipToState: platformState,
        supplierState
      });
      const commissionTotal = commissionBase + commissionGst.cgst + commissionGst.sgst + commissionGst.igst;

      const invoiceNumber = await nextNumber('INV');
      
      const invoiceDoc = await Invoice.create([{
        invoiceNumber,
        purchaseOrderId: po._id,
        type: 'COMMISSION',
        status: 'DRAFT',
        payeeCompanyId: bid.supplierCompanyId,
        payerCompanyId: bid.supplierCompanyId, 
        baseAmount: commissionBase,
        cgst: commissionGst.cgst,
        sgst: commissionGst.sgst,
        igst: commissionGst.igst,
        totalAmount: commissionTotal,
      }], { session });

      const invoice = invoiceDoc[0];

      await InvoiceLine.create([{
        invoiceId: invoice._id,
        description: `Platform Fee (5%) for PO ${poNumber}`,
        quantity: 1,
        unitPrice: commissionBase,
        totalPrice: commissionBase,
      }], { session });

      await LedgerEntry.create([{
        companyId: bid.supplierCompanyId,
        type: 'COMMISSION_FEE',
        amount: -commissionTotal, // debit
        referenceId: invoice._id,
        referenceType: 'INVOICE'
      }], { session });

      await session.commitTransaction();
      result = po.toObject();
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }

    return console.log(`[API Response] /api/v1/rfqs/[id]/items/[rfqItemId]/bids/[bidId]/select - Sending response`), NextResponse.json({
      success: true,
      message: 'Bid accepted and PO generated',
      data: result,
    });
  } catch (error: any) {
    console.error('Select bid error:', error);
    return console.log(`[API Response] /api/v1/rfqs/[id]/items/[rfqItemId]/bids/[bidId]/select - Sending response`), NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: 'Internal server error' },
      { status: 500 }
    );
  }
}
