import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, authErrorResponse } from '@/lib/auth';
import { computeGst, getHsnTaxRate } from '@/lib/gst';
import mongoose from 'mongoose';

export async function POST(req: NextRequest) {
    console.log(`[API] ${req.method} ${req.nextUrl?.pathname || req.url}`);
  try {
    const user = await getAuthUser(req);
    if (!user || !user.companyId || !user.company) return authErrorResponse();

    const { catalogItems, deliveryAddressId, buyerPrId } = await req.json();

    if (!catalogItems || !Array.isArray(catalogItems) || catalogItems.length === 0) {
      return console.log(`[API Response] /api/v1/orders/from-catalog - Sending response`), NextResponse.json({ success: false, code: 'BAD_REQUEST', message: 'No items provided' }, { status: 400 });
    }

    await db();
    const { CatalogItem } = await import('@/models/Catalog');
    const { PurchaseRequisition } = await import('@/models/Catalog');
    const { Company, CompanyAddress } = await import('@/models/Company');
    const { PurchaseOrder, PurchaseOrderItem } = await import('@/models/PurchaseOrder');

    if (user.company.requirePr) {
      if (!buyerPrId) {
        return console.log(`[API Response] /api/v1/orders/from-catalog - Sending response`), NextResponse.json({ success: false, code: 'PR_REQUIRED', message: 'A Purchase Requisition (PR) is required' }, { status: 403 });
      }
      const pr = await PurchaseRequisition.findOne({ _id: buyerPrId, companyId: user.companyId }).lean() as any;
      if (!pr || pr.status !== 'APPROVED') {
        return console.log(`[API Response] /api/v1/orders/from-catalog - Sending response`), NextResponse.json({ success: false, code: 'PR_NOT_APPROVED', message: 'The linked PR must be APPROVED' }, { status: 403 });
      }
    }

    let primaryAddress;
    if (deliveryAddressId) {
      primaryAddress = await CompanyAddress.findOne({ _id: deliveryAddressId, companyId: user.companyId }).lean() as any;
    } else {
      primaryAddress = await CompanyAddress.findOne({ companyId: user.companyId, isPrimary: true }).lean() as any;
    }

    if (!primaryAddress) {
      return console.log(`[API Response] /api/v1/orders/from-catalog - Sending response`), NextResponse.json({ success: false, code: 'BAD_REQUEST', message: 'Valid delivery address required' }, { status: 400 });
    }

    // Process catalog items. We assume all items belong to the same supplier for a single PO.
    const firstItemId = catalogItems[0].catalogItemId;
    const firstDbItem = await CatalogItem.findById(firstItemId).lean() as any;
    
    if (!firstDbItem) return console.log(`[API Response] /api/v1/orders/from-catalog - Sending response`), NextResponse.json({ success: false, code: 'NOT_FOUND', message: 'Catalog item not found' }, { status: 404 });
    const supplierCompanyId = firstDbItem.supplierCompanyId;

    const supplierCompany = await Company.findById(supplierCompanyId).lean() as any;
    const supplierAddress = await CompanyAddress.findOne({ companyId: supplierCompanyId, isPrimary: true }).lean() as any;

    if (!supplierCompany || !supplierAddress) {
      return console.log(`[API Response] /api/v1/orders/from-catalog - Sending response`), NextResponse.json({ success: false, code: 'BAD_REQUEST', message: 'Supplier has no primary address' }, { status: 400 });
    }

    const supplierState = supplierAddress.state;
    const buyerState = primaryAddress.state;

    let totalAmount = 0;
    let poItems = [];

    for (const item of catalogItems) {
      const dbItem = await CatalogItem.findById(item.catalogItemId).lean() as any;
      if (!dbItem) return console.log(`[API Response] /api/v1/orders/from-catalog - Sending response`), NextResponse.json({ success: false, code: 'NOT_FOUND', message: `Item ${item.catalogItemId} not found` }, { status: 404 });
      if (dbItem.supplierCompanyId.toString() !== supplierCompanyId.toString()) {
        return console.log(`[API Response] /api/v1/orders/from-catalog - Sending response`), NextResponse.json({ success: false, code: 'BAD_REQUEST', message: 'All catalog items must be from the same supplier' }, { status: 400 });
      }
      if (new Date(dbItem.validTo) < new Date()) {
        return console.log(`[API Response] /api/v1/orders/from-catalog - Sending response`), NextResponse.json({ success: false, code: 'EXPIRED', message: `Item ${dbItem.name} has expired` }, { status: 400 });
      }

      const lineTotal = dbItem.unitPrice * item.quantity;
      totalAmount += lineTotal;

      poItems.push({
        componentName: dbItem.name,
        quantity: item.quantity,
        priceWithoutMaterial: dbItem.unitPrice,
        priceWithMaterial: dbItem.unitPrice,
        finalUnitPrice: dbItem.unitPrice,
        hsnCode: dbItem.hsnCode,
        taxRateBps: getHsnTaxRate(dbItem.hsnCode)
      });
    }

    const { PlatformConfig } = await import('@/models/Platform');
    const configDoc = await PlatformConfig.findOne().lean() as any;
    const commissionBps = configDoc?.commissionBps || 100;
    const commissionAmount = Math.round((totalAmount * commissionBps) / 10000);

    // Compute GST for the whole order
    let totalCgst = 0, totalSgst = 0, totalIgst = 0, totalTax = 0;
    for (const item of poItems) {
       const lineTotal = item.quantity * item.finalUnitPrice;
       const { cgst, sgst, igst, taxTotal } = computeGst({
         taxablePaise: lineTotal,
         shipToState: buyerState,
         supplierState: supplierState,
         taxRateBps: item.taxRateBps
       });
       totalCgst += cgst;
       totalSgst += sgst;
       totalIgst += igst;
       totalTax += taxTotal;
    }

    const { nextNumber } = await import('@/lib/sequence');
    const poNumber = await nextNumber('PO');

    const session = await mongoose.startSession();
    let po: any = null;
    let itemsResult: any[] = [];

    try {
      session.startTransaction();

      const poDocs = await PurchaseOrder.create([{
        poNumber,
        buyerCompanyId: user.companyId,
        supplierCompanyId,
        status: 'AWAITING_ACCEPTANCE',
        totalAmount,
        taxAmount: totalTax,
        commissionAmount,
        placeOfSupplyState: buyerState,
        cgstAmount: totalCgst,
        sgstAmount: totalSgst,
        igstAmount: totalIgst,
        orderType: 'PRODUCTION', // default for catalog
        paymentTermsDays: 30, // default
        escrowRequired: true,
      }], { session });

      po = poDocs[0];

      const poItemsDocs = poItems.map(pi => ({
        poId: po._id,
        componentName: pi.componentName,
        quantity: pi.quantity,
        priceWithoutMaterial: pi.priceWithoutMaterial,
        priceWithMaterial: pi.priceWithMaterial,
        finalUnitPrice: pi.finalUnitPrice,
        hsnCode: pi.hsnCode
      }));

      itemsResult = await PurchaseOrderItem.insertMany(poItemsDocs, { session });

      await session.commitTransaction();
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }

    const poData = {
      ...po.toObject(),
      id: po._id.toString(),
      items: itemsResult.map(i => ({ ...i.toObject(), id: i._id.toString() }))
    };

    return console.log(`[API Response] /api/v1/orders/from-catalog - Sending response`), NextResponse.json({ success: true, message: 'Direct Purchase Order created', data: poData });

  } catch (error: any) {
    console.error('Create direct PO error:', error);
    return console.log(`[API Response] /api/v1/orders/from-catalog - Sending response`), NextResponse.json({ success: false, code: 'SERVER_ERROR', message: 'Internal server error' }, { status: 500 });
  }
}
