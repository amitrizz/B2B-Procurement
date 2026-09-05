import mongoose from 'mongoose';
import { rupeesToPaise } from '@/lib/money';
import { computePlatformPricing } from '@/lib/platformPricing';
import { getPlatformBilling } from '@/lib/platformBilling';
import { loadRepeatOrderThreadContext, RepeatOrderChatError } from '@/lib/repeatChatContext';
import { resolveCompanyRefId } from '@/lib/chatHelpers';

export { RepeatOrderChatError };

type RepeatPoItemInput = {
  rfqItemId: string;
  quantity: number;
  unitPriceRupees: number;
};

type CreateRepeatPoInput = {
  buyerPrId?: string;
  expectedDeliveryDate?: string;
  paymentTermsDays?: number;
  items: RepeatPoItemInput[];
};

export async function getRepeatPoDraft(threadId: string, userCompanyId: string) {
  const { thread, po } = await loadRepeatOrderThreadContext(threadId, userCompanyId);

  const { PurchaseOrderItem } = await import('@/models/PurchaseOrder');
  const { RFQItem } = await import('@/models/RFQ');

  const poItems = await PurchaseOrderItem.find({ purchaseOrderId: po._id }).lean();
  if (!poItems.length) {
    throw new RepeatOrderChatError('NOT_FOUND', 'Original purchase order has no line items', 404);
  }

  const rfqItemIds = poItems.map((pi: any) => pi.rfqItemId).filter(Boolean);
  const rfqItems = rfqItemIds.length
    ? await RFQItem.find({ _id: { $in: rfqItemIds } }).lean()
    : [];
  const rfqItemMap = new Map(rfqItems.map((i: any) => [i._id.toString(), i]));

  const items = poItems.map((poItem: any) => {
    const rfqItem = rfqItemMap.get(poItem.rfqItemId?.toString?.() ?? '');
    const unitPricePaise = poItem.unitPrice ?? 0;
    return {
      rfqItemId: poItem.rfqItemId?.toString?.() ?? '',
      bidId: poItem.bidId?.toString?.() ?? '',
      materialOption: poItem.materialOption || 'WITH_MATERIAL',
      componentName: rfqItem?.componentName || 'Component',
      quantity: poItem.quantity,
      unit: rfqItem?.unit || 'pcs',
      hsnCode: rfqItem?.hsnCode || '',
      previousUnitPricePaise: unitPricePaise,
      unitPriceRupees: unitPricePaise / 100,
    };
  });

  let sourceRfqNumber: string | null = null;
  if (po.rfqId) {
    const { RFQ } = await import('@/models/RFQ');
    const sourceRfq = await RFQ.findById(po.rfqId).select('rfqNumber').lean();
    sourceRfqNumber = (sourceRfq as any)?.rfqNumber ?? null;
  }

  const supplierId = resolveCompanyRefId(thread.supplierCompanyId);

  return {
    threadId: thread._id.toString(),
    purchaseOrderId: po._id.toString(),
    poNumber: po.poNumber,
    sourceRfqNumber,
    supplierCompany: {
      id: supplierId,
      name: thread.supplierCompanyId?.name ?? null,
    },
    paymentTermsDays: 30,
    items,
  };
}

export async function createRepeatPoFromChat(
  threadId: string,
  user: any,
  input: CreateRepeatPoInput
) {
  const { threadOid, thread, po } = await loadRepeatOrderThreadContext(threadId, user.companyId);

  if (!input.items?.length) {
    throw new RepeatOrderChatError('MISSING_FIELD', 'At least one line item is required', 400);
  }

  for (const item of input.items) {
    if (!item.rfqItemId || !item.quantity || item.quantity <= 0) {
      throw new RepeatOrderChatError('MISSING_FIELD', 'Each item needs quantity', 400);
    }
    if (item.unitPriceRupees == null || Number(item.unitPriceRupees) < 0) {
      throw new RepeatOrderChatError('MISSING_FIELD', 'Each item needs a unit price', 400);
    }
  }

  if (user.company?.requirePr) {
    if (!input.buyerPrId) {
      throw new RepeatOrderChatError(
        'PR_REQUIRED',
        'A Purchase Requisition (PR) is required by your company to create a repeat PO.',
        403
      );
    }
    const { PurchaseRequisition } = await import('@/models/Catalog');
    const pr = await PurchaseRequisition.findOne({
      _id: input.buyerPrId,
      companyId: user.companyId,
    }).lean();
    if (!pr || (pr as any).status !== 'APPROVED') {
      throw new RepeatOrderChatError(
        'PR_NOT_APPROVED',
        'The linked Purchase Requisition must be APPROVED.',
        403
      );
    }
  }

  const { PurchaseOrderItem, PurchaseOrder } = await import('@/models/PurchaseOrder');
  const { CompanyAddress } = await import('@/models/Company');
  const { PlatformConfig } = await import('@/models/Platform');

  const sourcePoItems = await PurchaseOrderItem.find({ purchaseOrderId: po._id }).lean();
  const sourceByRfqItem = new Map(
    sourcePoItems.map((pi: any) => [pi.rfqItemId?.toString?.(), pi])
  );

  for (const item of input.items) {
    if (!sourceByRfqItem.has(item.rfqItemId)) {
      throw new RepeatOrderChatError('INVALID_ITEM', 'Line item does not belong to the source PO', 400);
    }
  }

  const buyerAddress = await CompanyAddress.findOne({
    companyId: user.companyId,
    isPrimary: true,
  }).lean();
  if (!buyerAddress) {
    throw new RepeatOrderChatError('BAD_REQUEST', 'A primary delivery address is required', 400);
  }

  const configDoc = (await PlatformConfig.findOne().lean()) as any;
  const commissionBps = configDoc?.commissionBps || 500;
  const platform = await getPlatformBilling();
  const supplierCompanyId =
    thread.supplierCompanyId?._id ?? resolveCompanyRefId(thread.supplierCompanyId);

  let goodsTotal = 0;
  const poItemsPayload = input.items.map((item) => {
    const source = sourceByRfqItem.get(item.rfqItemId)! as any;
    const unitPrice = rupeesToPaise(Number(item.unitPriceRupees));
    const lineBase = unitPrice * Number(item.quantity);
    goodsTotal += lineBase;
    return {
      rfqItemId: source.rfqItemId,
      bidId: source.bidId,
      quantity: Number(item.quantity),
      unitPrice,
      materialOption: source.materialOption || 'WITH_MATERIAL',
      taxRateBps: source.taxRateBps ?? 0,
      taxAmount: 0,
    };
  });

  const pricing = computePlatformPricing({
    goodsTaxablePaise: goodsTotal,
    commissionBps,
    shipToState: (buyerAddress as any).state,
    platformState: platform.state,
  });

  const { nextNumber } = await import('@/lib/sequence');
  const poNumber = await nextNumber('PO');

  const session = await mongoose.startSession();
  let createdPo: any = null;

  try {
    session.startTransaction();

    const [poDoc] = await PurchaseOrder.create(
      [
        {
          poNumber,
          rfqId: po.rfqId || undefined,
          buyerCompanyId: user.companyId,
          supplierCompanyId,
          status: 'AWAITING_ACCEPTANCE',
          totalAmount: pricing.buyerTotal,
          taxAmount: pricing.taxTotal,
          commissionAmount: pricing.commissionAmount,
          placeOfSupplyState: (buyerAddress as any).state,
          cgstAmount: pricing.cgstAmount,
          sgstAmount: pricing.sgstAmount,
          igstAmount: pricing.igstAmount,
          orderType: 'REPEAT',
          paymentTermsDays: input.paymentTermsDays ? Number(input.paymentTermsDays) : 30,
          escrowRequired: true,
          sourcePurchaseOrderId: po._id,
          sourceChatThreadId: threadOid,
          expectedDeliveryDate: input.expectedDeliveryDate
            ? new Date(input.expectedDeliveryDate)
            : null,
        },
      ],
      { session }
    );

    await PurchaseOrderItem.insertMany(
      poItemsPayload.map((pi) => ({ ...pi, purchaseOrderId: poDoc._id })),
      { session }
    );

    await session.commitTransaction();
    createdPo = {
      ...poDoc.toObject(),
      id: poDoc._id.toString(),
      poNumber,
    };
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }

  const { broadcastOrderUpdate } = await import('@/lib/orderEvents');
  await broadcastOrderUpdate(
    createdPo,
    'repeat_po_created',
    `${user.company?.name || 'Buyer'} sent repeat purchase order ${poNumber} for your acceptance.`
  );

  return createdPo;
}
