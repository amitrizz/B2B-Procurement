import {
  isThreadParticipant,
  resolveCompanyRefId,
  toObjectId,
} from '@/lib/chatHelpers';
import { parseChatPurpose } from '@/lib/chatTemplates';

export class RepeatOrderChatError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

/** Shared validation for repeat-order chat actions (RFQ legacy / direct PO). */
export async function loadRepeatOrderThreadContext(threadId: string, userCompanyId: string) {
  const threadOid = toObjectId(threadId);
  if (!threadOid) {
    throw new RepeatOrderChatError('INVALID_ID', 'Invalid thread id', 400);
  }

  const { getCompanyChatThreadModel } = await import('@/models/Chat');
  const CompanyChatThread = getCompanyChatThreadModel();
  const thread = await CompanyChatThread.findById(threadOid)
    .populate('purchaseOrderId', 'poNumber status rfqId')
    .populate('supplierCompanyId', 'name')
    .populate('buyerCompanyId', 'name')
    .lean();

  if (!thread) {
    throw new RepeatOrderChatError('NOT_FOUND', 'Chat thread not found', 404);
  }

  if (!isThreadParticipant(userCompanyId, thread)) {
    throw new RepeatOrderChatError('FORBIDDEN', 'Not a participant on this thread', 403);
  }

  const purpose = parseChatPurpose(thread.purpose);
  if (purpose !== 'REPEAT_ORDER') {
    throw new RepeatOrderChatError(
      'INVALID_PURPOSE',
      'Repeat orders can only be created from a Repeat Order chat',
      400
    );
  }

  const buyerId = resolveCompanyRefId(thread.buyerCompanyId);
  if (buyerId !== userCompanyId) {
    throw new RepeatOrderChatError('FORBIDDEN', 'Only the buyer can create a repeat order', 403);
  }

  const po: any = thread.purchaseOrderId;
  if (!po?._id) {
    throw new RepeatOrderChatError('NOT_FOUND', 'Linked purchase order not found', 404);
  }

  return { threadOid, thread, po, buyerId };
}
