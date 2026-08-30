import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, authErrorResponse } from '@/lib/auth';
import { computeGst, getHsnTaxRate } from '@/lib/gst';
import mongoose from 'mongoose';

type Params = {
  params: Promise<{ id: string }>
}

export async function POST(req: NextRequest, { params }: Params) {
    console.log(`[API] ${req.method} ${req.nextUrl?.pathname || req.url}`);
  try {
    const user = await getAuthUser(req);
    if (!user || !user.companyId) return authErrorResponse();

    const { id: rfqId } = await params;
    const { selections } = await req.json(); // Array of { rfqItemId, bidId, materialOption, quantity }

    if (!selections || !Array.isArray(selections) || selections.length === 0) {
      return console.log(`[API Response] /api/v1/rfqs/[id]/select-bids - Sending response`), NextResponse.json(
        { success: false, code: 'BAD_REQUEST', message: 'Missing selections array' },
        { status: 400 }
      );
    }

    await db();
    const { RFQ, RFQItem } = await import('@/models/RFQ');
    const { Bid } = await import('@/models/Bid');
    const { CompanyAddress, Company } = await import('@/models/Company');
    const { PurchaseOrder, PurchaseOrderItem } = await import('@/models/PurchaseOrder');

    const rfq = await RFQ.findById(rfqId).lean() as any;

    if (!rfq) {
      return console.log(`[API Response] /api/v1/rfqs/[id]/select-bids - Sending response`), NextResponse.json(
        { success: false, code: 'NOT_FOUND', message: 'RFQ not found' },
        { status: 404 }
      );
    }

    if (rfq.buyerCompanyId.toString() !== user.companyId) {
      return console.log(`[API Response] /api/v1/rfqs/[id]/select-bids - Sending response`), NextResponse.json(
        { success: false, code: 'FORBIDDEN', message: 'You do not own this RFQ' },
        { status: 403 }
      );
    }

    const rfqItems = await RFQItem.find({ rfqId: rfq._id }).lean() as any[];

    const buyerAddress = await CompanyAddress.findOne({
      companyId: user.companyId, isPrimary: true
    }).lean() as any;

    const session = await mongoose.startSession();
    let purchaseOrders: any[] = [];

    try {
      session.startTransaction();

      // Validate quantities match RFQ item quantities
      const qtyByItem: Record<string, number> = {};
      for (const sel of selections) {
         if (sel.quantity <= 0) throw new Error('Quantity must be greater than 0');
         qtyByItem[sel.rfqItemId] = (qtyByItem[sel.rfqItemId] || 0) + Number(sel.quantity);
      }
      
      for (const item of rfqItems) {
         const sumQty = qtyByItem[item._id.toString()] || 0;
         if (sumQty > 0 && sumQty !== item.quantity) {
             throw new Error(`Sum of selected quantities (${sumQty}) for item ${item.componentName} does not match requested quantity (${item.quantity}).`);
         }
      }

      const selectedBidsData: any[] = [];

      for (const sel of selections) {
        const bid = await Bid.findById(sel.bidId).session(session).lean() as any;

        if (!bid || bid.rfqItemId.toString() !== sel.rfqItemId || bid.rfqId.toString() !== rfqId) {
          throw new Error(`Bid ${sel.bidId} does not match RFQ item ${sel.rfqItemId}`);
        }

        const supplierCompany = await Company.findById(bid.supplierCompanyId).lean() as any;
        const supplierAddresses = await CompanyAddress.find({ companyId: bid.supplierCompanyId }).lean() as any[];

        if (supplierCompany.status !== 'VERIFIED') {
          throw new Error(`Supplier for bid ${sel.bidId} is not verified`);
        }

        // Accept the bid
        await Bid.updateOne(
          { _id: bid._id },
          { $set: { status: 'ACCEPTED' } },
          { session }
        );

        // Reject other bids on this item
        await Bid.updateMany(
          {
            rfqItemId: sel.rfqItemId,
            _id: { $ne: bid._id },
            status: 'SUBMITTED',
          },
          { $set: { status: 'REJECTED' } },
          { session }
        );

        const rfqItem = rfqItems.find(i => i._id.toString() === bid.rfqItemId.toString());

        const selectedPrice = sel.materialOption === 'WITH_MATERIAL' 
          ? bid.priceWithMaterial 
          : bid.priceWithoutMaterial;

        selectedBidsData.push({
          bid,
          rfqItem,
          supplierCompany,
          supplierAddresses,
          selectedPrice,
          materialOption: sel.materialOption,
          quantity: sel.quantity,
        });
      }

      // Group selections by Supplier to generate multiple POs
      const selectionsBySupplier: { [key: string]: typeof selectedBidsData } = {};
      selectedBidsData.forEach(item => {
        const supplierId = item.bid.supplierCompanyId.toString();
        if (!selectionsBySupplier[supplierId]) {
          selectionsBySupplier[supplierId] = [];
        }
        selectionsBySupplier[supplierId].push(item);
      });

      for (const [supplierId, itemsWon] of Object.entries(selectionsBySupplier)) {
        const poNumber = 'PO-' + Math.floor(100000 + Math.random() * 900000);

        let totalBase = 0;
        let totalTax = 0;
        const commissionRate = 0.05; // 5% platform commission

        const supplier = itemsWon[0].supplierCompany;
        const supplierAddresses = itemsWon[0].supplierAddresses;
        const supplierAddress = supplierAddresses.find((addr: any) => addr.isPrimary) || supplierAddresses[0];

        const isSameState = buyerAddress && supplierAddress && (buyerAddress.state === supplierAddress.state);

        const poItemsData = itemsWon.map(item => {
          const awardQty = Number(item.quantity) || Number(item.bid.quantity);
          const bidUnitPrice = Number(item.selectedPrice) / Number(item.bid.quantity);
          const baseAmount = bidUnitPrice * awardQty;
          totalBase += baseAmount;

          const taxRateBps = getHsnTaxRate(item.rfqItem.hsnCode); 
          const { cgst, sgst, igst, taxTotal } = computeGst({
            taxablePaise: baseAmount,
            shipToState: buyerAddress ? buyerAddress.state : 'Maharashtra',
            supplierState: supplierAddress ? supplierAddress.state : 'Maharashtra',
            taxRateBps
          });
          totalTax += taxTotal;

          return {
            rfqItemId: item.bid.rfqItemId,
            bidId: item.bid._id,
            quantity: awardQty,
            unitPrice: bidUnitPrice, 
            materialOption: item.materialOption,
            taxRateBps,
            taxAmount: taxTotal,
            priceWithoutMaterial: item.bid.priceWithoutMaterial / Number(item.bid.quantity),
            priceWithMaterial: item.bid.priceWithMaterial / Number(item.bid.quantity),
            finalUnitPrice: bidUnitPrice,
            hsnCode: item.rfqItem.hsnCode
          };
        });

        const commissionAmount = totalBase * commissionRate;
        const totalAmount = totalBase + totalTax + commissionAmount;

        const poDoc = await PurchaseOrder.create([{
          poNumber,
          rfqId,
          buyerCompanyId: user.companyId,
          supplierCompanyId: supplierId,
          status: 'CREATED',
          totalAmount,
          taxAmount: totalTax,
          commissionAmount,
          deliveryCharge: 0,
        }], { session });

        const createdPo = poDoc[0];

        const poItemsWithPoId = poItemsData.map(pi => ({
           ...pi,
           poId: createdPo._id
        }));

        await PurchaseOrderItem.insertMany(poItemsWithPoId, { session });
        
        purchaseOrders.push({
          ...createdPo.toObject(),
          id: createdPo._id.toString()
        });
      }

      // Recalculate RFQ status
      const totalRFQItems = rfqItems.length;
      const uniqueSelectedItemIds = new Set(selections.map((s: any) => s.rfqItemId));
      const newRFQStatus = uniqueSelectedItemIds.size === totalRFQItems 
        ? 'FULLY_AWARDED' 
        : 'PARTIALLY_AWARDED';

      await RFQ.updateOne(
        { _id: rfq._id },
        { $set: { status: newRFQStatus } },
        { session }
      );

      await session.commitTransaction();
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }

    if (purchaseOrders && purchaseOrders.length > 0) {
      const { broadcastCompanyUpdate } = await import('@/lib/companyEvents');
      for (const po of purchaseOrders) {
        // Send a notification to the winning supplier
        await broadcastCompanyUpdate(po.supplierCompanyId.toString(), 'order_created', `Congratulations! Your bid was selected for RFQ ${rfq.rfqNumber}. A new Purchase Order has been created.`);
      }
    }

    return console.log(`[API Response] /api/v1/rfqs/[id]/select-bids - Sending response`), NextResponse.json({
      success: true,
      message: 'Bids selected and Purchase Order(s) generated successfully',
      data: purchaseOrders,
    });
  } catch (error: any) {
    console.error('Bid selection error:', error.message);
    return console.log(`[API Response] /api/v1/rfqs/[id]/select-bids - Sending response`), NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
