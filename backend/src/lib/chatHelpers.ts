import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { CHAT_PURPOSE_LABELS } from '@/lib/chatTemplates';

const BLOCKED_ROLES = new Set(['TRANSPORTER', 'PLATFORM_ADMIN']);

export function chatAuthError(user: any) {
  if (!user) {
    return NextResponse.json(
      { success: false, code: 'UNAUTHORIZED', message: 'Unauthorized' },
      { status: 401 }
    );
  }
  if (!user.companyId) {
    return NextResponse.json(
      { success: false, code: 'NO_COMPANY', message: 'Company membership required for chat' },
      { status: 403 }
    );
  }
  if (BLOCKED_ROLES.has(user.role)) {
    return NextResponse.json(
      { success: false, code: 'FORBIDDEN', message: 'Your role cannot use company chat' },
      { status: 403 }
    );
  }
  return null;
}

export function resolveCompanyRefId(value: any): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (value._id) return value._id.toString();
  return value.toString?.() ?? String(value);
}

export function isThreadParticipant(companyId: string, thread: any): boolean {
  const buyer = resolveCompanyRefId(thread.buyerCompanyId);
  const supplier = resolveCompanyRefId(thread.supplierCompanyId);
  return companyId === buyer || companyId === supplier;
}

export function isPoParticipant(companyId: string, po: any): boolean {
  const buyer = resolveCompanyRefId(po.buyerCompanyId);
  const supplier = resolveCompanyRefId(po.supplierCompanyId);
  return companyId === buyer || companyId === supplier;
}

export function toObjectId(id: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return new mongoose.Types.ObjectId(id);
}

export function serializeThread(thread: any, myCompanyId: string) {
  const buyerId = thread.buyerCompanyId?._id?.toString?.() ?? thread.buyerCompanyId?.toString?.();
  const supplierId = thread.supplierCompanyId?._id?.toString?.() ?? thread.supplierCompanyId?.toString?.();
  const counterparty =
    myCompanyId === buyerId
      ? thread.supplierCompanyId
      : thread.buyerCompanyId;

  return {
    id: thread._id.toString(),
    purchaseOrderId: thread.purchaseOrderId?._id?.toString?.() ?? thread.purchaseOrderId?.toString?.(),
    purpose: thread.purpose || 'ORDER_STATUS',
    purposeLabel: CHAT_PURPOSE_LABELS[(thread.purpose as keyof typeof CHAT_PURPOSE_LABELS) || 'ORDER_STATUS'],
    poNumber: thread.purchaseOrderId?.poNumber ?? null,
    poStatus: thread.purchaseOrderId?.status ?? null,
    buyerCompany: thread.buyerCompanyId?.name
      ? { id: buyerId, name: thread.buyerCompanyId.name }
      : { id: buyerId, name: null },
    supplierCompany: thread.supplierCompanyId?.name
      ? { id: supplierId, name: thread.supplierCompanyId.name }
      : { id: supplierId, name: null },
    counterpartyCompany: counterparty?.name
      ? { id: counterparty._id?.toString?.() ?? counterparty.id, name: counterparty.name }
      : {
          id:
            myCompanyId === buyerId
              ? supplierId
              : buyerId,
          name: null,
        },
    lastMessageAt: thread.lastMessageAt,
    lastMessagePreview: thread.lastMessagePreview || '',
    createdAt: thread.createdAt,
  };
}

export function serializeMessage(msg: any, myCompanyId: string) {
  const senderId = msg.senderCompanyId?._id?.toString?.() ?? msg.senderCompanyId?.toString?.();
  return {
    id: msg._id.toString(),
    threadId: msg.threadId?.toString?.() ?? String(msg.threadId),
    templateKey: msg.templateKey,
    label: msg.label,
    senderCompanyId: senderId,
    senderCompanyName: msg.senderCompanyId?.name ?? null,
    senderUserId: msg.senderUserId?.toString?.() ?? String(msg.senderUserId),
    senderUserName: msg.senderUserId?.name ?? null,
    isMine: senderId === myCompanyId,
    createdAt: msg.createdAt,
  };
}
