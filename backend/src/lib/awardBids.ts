import mongoose from 'mongoose';
import { computePlatformPricing } from './platformPricing';
import { getPlatformBilling } from './platformBilling';

export type BidSelectionInput = {
  rfqItemId: string;
  bidId: string;
  materialOption: string;
  quantity: number;
};

export type AwardBidsResult = {
  purchaseOrders: any[];
  rfqStatus: string;
};

/** Award selected bids and create purchase order(s) grouped by supplier. */
export async function awardBidsForRfq(
  rfqId: string,
  buyerCompanyId: string,
  selections: BidSelectionInput[],
  session: mongoose.ClientSession
): Promise<AwardBidsResult> {
  const { RFQ, RFQItem } = await import('@/models/RFQ');
  const { Bid } = await import('@/models/Bid');
  const { CompanyAddress, Company } = await import('@/models/Company');
  const { PurchaseOrder, PurchaseOrderItem } = await import('@/models/PurchaseOrder');

  const rfq = (await RFQ.findById(rfqId).session(session).lean()) as any;
  if (!rfq) throw new Error('RFQ not found');
  if (rfq.buyerCompanyId.toString() !== buyerCompanyId) {
    throw new Error('You do not own this RFQ');
  }

  const rfqItems = (await RFQItem.find({ rfqId: rfq._id }).session(session).lean()) as any[];
  const buyerAddress = (await CompanyAddress.findOne({
    companyId: buyerCompanyId,
    isPrimary: true,
  })
    .session(session)
    .lean()) as any;
  const platform = await getPlatformBilling();

  const qtyByItem: Record<string, number> = {};
  for (const sel of selections) {
    if (sel.quantity <= 0) throw new Error('Quantity must be greater than 0');
    qtyByItem[sel.rfqItemId] = (qtyByItem[sel.rfqItemId] || 0) + Number(sel.quantity);
  }

  for (const item of rfqItems) {
    const sumQty = qtyByItem[item._id.toString()] || 0;
    if (sumQty > 0 && sumQty !== item.quantity) {
      throw new Error(
        `Sum of selected quantities (${sumQty}) for item ${item.componentName} does not match requested quantity (${item.quantity}).`
      );
    }
  }

  const selectedBidsData: any[] = [];

  for (const sel of selections) {
    const bid = (await Bid.findById(sel.bidId).session(session).lean()) as any;

    if (!bid || bid.rfqItemId.toString() !== sel.rfqItemId || bid.rfqId.toString() !== rfqId) {
      throw new Error(`Bid ${sel.bidId} does not match RFQ item ${sel.rfqItemId}`);
    }

    const supplierCompany = (await Company.findById(bid.supplierCompanyId).session(session).lean()) as any;
    const supplierAddresses = (await CompanyAddress.find({ companyId: bid.supplierCompanyId })
      .session(session)
      .lean()) as any[];

    if (supplierCompany.status !== 'VERIFIED') {
      throw new Error(`Supplier for bid ${sel.bidId} is not verified`);
    }

    await Bid.updateOne({ _id: bid._id }, { $set: { status: 'ACCEPTED' } }, { session });

    await Bid.updateMany(
      {
        rfqItemId: sel.rfqItemId,
        _id: { $ne: bid._id },
        status: 'SUBMITTED',
      },
      { $set: { status: 'REJECTED' } },
      { session }
    );

    const rfqItem = rfqItems.find((i) => i._id.toString() === bid.rfqItemId.toString());
    const selectedPrice =
      sel.materialOption === 'WITH_MATERIAL' ? bid.priceWithMaterial : bid.priceWithoutMaterial;

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

  const selectionsBySupplier: { [key: string]: typeof selectedBidsData } = {};
  selectedBidsData.forEach((item) => {
    const supplierId = item.bid.supplierCompanyId.toString();
    if (!selectionsBySupplier[supplierId]) selectionsBySupplier[supplierId] = [];
    selectionsBySupplier[supplierId].push(item);
  });

  const purchaseOrders: any[] = [];

  for (const [supplierId, itemsWon] of Object.entries(selectionsBySupplier)) {
    const poNumber = 'PO-' + Math.floor(100000 + Math.random() * 900000);
    let totalBase = 0;
    const commissionRate = 0.05;
    const buyerAddressState = buyerAddress?.state || 'Maharashtra';

    const poItemsData = itemsWon.map((item) => {
      const awardQty = Number(item.quantity) || Number(item.bid.quantity);
      const bidUnitPrice = Number(item.selectedPrice) / Number(item.bid.quantity);
      const baseAmount = bidUnitPrice * awardQty;
      totalBase += baseAmount;

      return {
        rfqItemId: item.bid.rfqItemId,
        bidId: item.bid._id,
        quantity: awardQty,
        unitPrice: bidUnitPrice,
        materialOption: item.materialOption,
        taxRateBps: 0,
        taxAmount: 0,
        priceWithoutMaterial: item.bid.priceWithoutMaterial / Number(item.bid.quantity),
        priceWithMaterial: item.bid.priceWithMaterial / Number(item.bid.quantity),
        finalUnitPrice: bidUnitPrice,
        hsnCode: item.rfqItem.hsnCode,
      };
    });

    const pricing = computePlatformPricing({
      goodsTaxablePaise: totalBase,
      commissionRate,
      shipToState: buyerAddressState,
      platformState: platform.state,
    });

    const poDoc = await PurchaseOrder.create(
      [
        {
          poNumber,
          rfqId,
          buyerCompanyId,
          supplierCompanyId: supplierId,
          status: 'CREATED',
          totalAmount: pricing.buyerTotal,
          taxAmount: pricing.taxTotal,
          commissionAmount: pricing.commissionAmount,
          placeOfSupplyState: buyerAddressState,
          cgstAmount: pricing.cgstAmount,
          sgstAmount: pricing.sgstAmount,
          igstAmount: pricing.igstAmount,
          deliveryCharge: 0,
        },
      ],
      { session }
    );

    const createdPo = poDoc[0];
    const poItemsWithPoId = poItemsData.map((pi) => ({
      ...pi,
      purchaseOrderId: createdPo._id,
    }));

    await PurchaseOrderItem.insertMany(poItemsWithPoId, { session });

    purchaseOrders.push({
      ...createdPo.toObject(),
      id: createdPo._id.toString(),
    });
  }

  const totalRFQItems = rfqItems.length;
  const uniqueSelectedItemIds = new Set(selections.map((s) => s.rfqItemId));
  const newRFQStatus =
    uniqueSelectedItemIds.size === totalRFQItems ? 'FULLY_AWARDED' : 'PARTIALLY_AWARDED';

  await RFQ.updateOne({ _id: rfq._id }, { $set: { status: newRFQStatus } }, { session });

  return { purchaseOrders, rfqStatus: newRFQStatus };
}

/** Build bid selections for all SUBMITTED bids of a supplier on an RFQ. */
export async function buildSelectionsForSupplier(
  rfqId: string,
  supplierCompanyId: string
): Promise<BidSelectionInput[]> {
  const { Bid } = await import('@/models/Bid');
  const { RFQItem } = await import('@/models/RFQ');

  const bids = (await Bid.find({
    rfqId,
    supplierCompanyId,
    status: 'SUBMITTED',
  }).lean()) as any[];

  if (!bids.length) throw new Error('No active bids found for this supplier on the RFQ');

  const rfqItems = (await RFQItem.find({ rfqId }).lean()) as any[];
  const itemMap = new Map(rfqItems.map((i) => [i._id.toString(), i]));

  return bids.map((bid) => {
    const item = itemMap.get(bid.rfqItemId.toString());
    let materialOption = bid.materialOptionPreference || item?.materialOptionPreference || 'WITHOUT_MATERIAL';
    if (materialOption === 'BOTH') materialOption = 'WITHOUT_MATERIAL';

    return {
      rfqItemId: bid.rfqItemId.toString(),
      bidId: bid._id.toString(),
      materialOption,
      quantity: item?.quantity || bid.quantity,
    };
  });
}
