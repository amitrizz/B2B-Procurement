import mongoose from 'mongoose';
import {
  chatAuthError,
  isThreadParticipant,
  resolveCompanyRefId,
  toObjectId,
} from '@/lib/chatHelpers';
import { parseChatPurpose } from '@/lib/chatTemplates';

export class RepeatRfqError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function loadRepeatThreadContext(threadId: string, userCompanyId: string) {
  const threadOid = toObjectId(threadId);
  if (!threadOid) {
    throw new RepeatRfqError('INVALID_ID', 'Invalid thread id', 400);
  }

  const { getCompanyChatThreadModel } = await import('@/models/Chat');
  const CompanyChatThread = getCompanyChatThreadModel();
  const thread = await CompanyChatThread.findById(threadOid)
    .populate('purchaseOrderId', 'poNumber status rfqId')
    .populate('supplierCompanyId', 'name')
    .populate('buyerCompanyId', 'name')
    .lean();

  if (!thread) {
    throw new RepeatRfqError('NOT_FOUND', 'Chat thread not found', 404);
  }

  if (!isThreadParticipant(userCompanyId, thread)) {
    throw new RepeatRfqError('FORBIDDEN', 'Not a participant on this thread', 403);
  }

  const purpose = parseChatPurpose(thread.purpose);
  if (purpose !== 'REPEAT_ORDER') {
    throw new RepeatRfqError(
      'INVALID_PURPOSE',
      'Repeat RFQ can only be created from a Repeat Order chat',
      400
    );
  }

  const buyerId = resolveCompanyRefId(thread.buyerCompanyId);
  if (buyerId !== userCompanyId) {
    throw new RepeatRfqError('FORBIDDEN', 'Only the buyer can create a repeat RFQ', 403);
  }

  const po: any = thread.purchaseOrderId;
  if (!po?._id) {
    throw new RepeatRfqError('NOT_FOUND', 'Linked purchase order not found', 404);
  }

  if (!po.rfqId) {
    throw new RepeatRfqError(
      'NO_SOURCE_RFQ',
      'This purchase order was not created from an RFQ, so items cannot be prefilled automatically.',
      400
    );
  }

  return { threadOid, thread, po };
}

export async function getRepeatRfqDraft(threadId: string, userCompanyId: string) {
  const { thread, po } = await loadRepeatThreadContext(threadId, userCompanyId);

  const { RFQ, RFQItem } = await import('@/models/RFQ');
  const { PurchaseOrderItem } = await import('@/models/PurchaseOrder');

  const sourceRfq = await RFQ.findById(po.rfqId).lean();
  if (!sourceRfq) {
    throw new RepeatRfqError('NOT_FOUND', 'Original RFQ for this order was not found', 404);
  }

  const rfqItems = await RFQItem.find({ rfqId: po.rfqId }).lean();
  const poItems = await PurchaseOrderItem.find({ purchaseOrderId: po._id }).lean();

  const items = rfqItems.map((rfqItem: any) => {
    const poItem = poItems.find((pi: any) => pi.rfqItemId?.toString() === rfqItem._id.toString());
    return {
      rfqItemId: rfqItem._id.toString(),
      componentName: rfqItem.componentName,
      quantity: poItem?.quantity ?? rfqItem.quantity,
      unit: rfqItem.unit || 'pcs',
      drawingFileId: rfqItem.drawingFileId,
      drawingRevision: rfqItem.drawingRevision || 'v1',
      hsnCode: rfqItem.hsnCode,
      specification: rfqItem.specification || '',
      materialOptionPreference: rfqItem.materialOptionPreference || 'BOTH',
      expectedTimeDays: rfqItem.expectedTimeDays ?? 14,
      previousUnitPrice: poItem?.unitPrice ?? null,
    };
  });

  const supplierId = resolveCompanyRefId(thread.supplierCompanyId);
  const supplierName = thread.supplierCompanyId?.name ?? null;

  return {
    threadId: thread._id.toString(),
    purchaseOrderId: po._id.toString(),
    poNumber: po.poNumber,
    supplierCompany: { id: supplierId, name: supplierName },
    suggestedTitle: `Repeat order — ${po.poNumber}`,
    suggestedDescription: `Repeat procurement linked to ${po.poNumber} and prior RFQ ${sourceRfq.rfqNumber}.`,
    category: sourceRfq.category || '',
    sourceRfqNumber: sourceRfq.rfqNumber,
    items,
  };
}

type CreateRepeatRfqInput = {
  title: string;
  description?: string;
  category: string;
  bidEndAt: string;
  requiredDeliveryDate?: string;
  buyerPrId?: string;
  items: Array<{
    componentName: string;
    quantity: number;
    unit?: string;
    drawingFileId: string;
    drawingRevision?: string;
    hsnCode: string;
    specification?: string;
    materialOptionPreference?: string;
    expectedTimeDays?: number;
  }>;
};

export async function createRepeatRfqFromChat(
  threadId: string,
  user: any,
  input: CreateRepeatRfqInput
) {
  const { threadOid, thread, po } = await loadRepeatThreadContext(threadId, user.companyId);

  if (!input.title?.trim() || !input.category?.trim()) {
    throw new RepeatRfqError('MISSING_FIELD', 'Title and category are required', 400);
  }

  if (!input.items?.length) {
    throw new RepeatRfqError('MISSING_FIELD', 'At least one RFQ item is required', 400);
  }

  for (const item of input.items) {
    if (!item.componentName?.trim() || !item.drawingFileId || !item.quantity || !item.hsnCode) {
      throw new RepeatRfqError(
        'MISSING_FIELD',
        'Each item needs component name, quantity, drawing, and HSN code',
        400
      );
    }
  }

  if (user.company?.requirePr) {
    if (!input.buyerPrId) {
      throw new RepeatRfqError(
        'PR_REQUIRED',
        'A Purchase Requisition (PR) is required by your company to publish an RFQ.',
        403
      );
    }
    const { PurchaseRequisition } = await import('@/models/Catalog');
    const pr = await PurchaseRequisition.findOne({
      _id: input.buyerPrId,
      companyId: user.companyId,
    }).lean();
    if (!pr || (pr as any).status !== 'APPROVED') {
      throw new RepeatRfqError(
        'PR_NOT_APPROVED',
        'The linked Purchase Requisition must be APPROVED.',
        403
      );
    }
  }

  const bidEndAt = input.bidEndAt ? new Date(input.bidEndAt) : null;
  if (!bidEndAt || Number.isNaN(bidEndAt.getTime()) || bidEndAt <= new Date()) {
    throw new RepeatRfqError('INVALID_DATE', 'Bidding end date must be in the future', 400);
  }

  const { CompanyAddress } = await import('@/models/Company');
  const primaryAddress = await CompanyAddress.findOne({
    companyId: user.companyId,
    isPrimary: true,
  }).lean();

  if (!primaryAddress) {
    throw new RepeatRfqError('BAD_REQUEST', 'A primary delivery address is required', 400);
  }

  const supplierCompanyId =
    thread.supplierCompanyId?._id ?? resolveCompanyRefId(thread.supplierCompanyId);

  const { nextNumber } = await import('@/lib/sequence');
  const rfqNumber = await nextNumber('RFQ');

  const session = await mongoose.startSession();
  let created: any = null;

  try {
    session.startTransaction();
    const { RFQ, RFQItem } = await import('@/models/RFQ');

    const [rfqDoc] = await RFQ.create(
      [
        {
          buyerCompanyId: user.companyId,
          buyerPrId: input.buyerPrId || undefined,
          rfqNumber,
          title: input.title.trim(),
          description: input.description?.trim() || '',
          category: input.category.trim(),
          status: 'PUBLISHED',
          bidStartAt: new Date(),
          bidEndAt,
          requiredDeliveryDate: input.requiredDeliveryDate
            ? new Date(input.requiredDeliveryDate)
            : null,
          deliveryAddressId: primaryAddress._id,
          sourcePurchaseOrderId: po._id,
          sourceChatThreadId: threadOid,
          invitedSupplierCompanyId: supplierCompanyId,
        },
      ],
      { session }
    );

    const itemsToCreate = input.items.map((item) => ({
      rfqId: rfqDoc._id,
      componentName: item.componentName.trim(),
      drawingFileId: item.drawingFileId,
      drawingRevision: item.drawingRevision || 'v1',
      quantity: Number(item.quantity),
      unit: item.unit || 'pcs',
      specification: item.specification || '',
      hsnCode: item.hsnCode,
      materialOptionPreference: item.materialOptionPreference || 'BOTH',
      expectedTimeDays: item.expectedTimeDays ? Number(item.expectedTimeDays) : null,
    }));

    const createdItems = await RFQItem.insertMany(itemsToCreate, { session });
    await session.commitTransaction();

    created = {
      ...rfqDoc.toObject(),
      id: rfqDoc._id.toString(),
      items: createdItems.map((i) => ({ ...i.toObject(), id: i._id.toString() })),
    };
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }

  const supplierId = supplierCompanyId.toString();
  const { broadcastCompanyUpdate } = await import('@/lib/companyEvents');
  await broadcastCompanyUpdate(
    supplierId,
    'repeat_rfq_invited',
    `${user.company?.name || 'Buyer'} invited you to quote a repeat order (${created.rfqNumber}).`
  );

  const { publishToCentrifugo } = await import('@/lib/centrifugo');
  await publishToCentrifugo('global_updates', {
    type: 'db_change',
    target: 'all',
    message: `New repeat order RFQ ${created.rfqNumber} posted`,
  });

  return created;
}

export { chatAuthError };
