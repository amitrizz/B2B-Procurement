import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { chatAuthError, isPoParticipant, isThreadParticipant, toObjectId } from '@/lib/chatHelpers';
import {
  parseChatPurpose,
  resolveSenderSide,
  type ChatPurpose,
} from '@/lib/chatTemplates';
import {
  findPendingBuyerQuestion,
  getBuyerTemplates,
  getSupplierTemplates,
} from '@/lib/chatQa';
import { seedChatQaIfEmpty } from '@/lib/seedChatQa';
import mongoose from 'mongoose';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    const authErr = chatAuthError(user);
    if (authErr) return authErr;

    const threadId = req.nextUrl.searchParams.get('threadId');
    const purchaseOrderId = req.nextUrl.searchParams.get('purchaseOrderId');
    const purposeParam = req.nextUrl.searchParams.get('purpose');

    await db();
    await seedChatQaIfEmpty();

    const { PurchaseOrder } = await import('@/models/PurchaseOrder');
    const { getCompanyChatThreadModel } = await import('@/models/Chat');
    const CompanyChatThread = getCompanyChatThreadModel();

    let purpose: ChatPurpose | null = parseChatPurpose(purposeParam);
    let po: any;
    let threadOid: mongoose.Types.ObjectId | null = null;

    if (threadId) {
      threadOid = toObjectId(threadId);
      if (!threadOid) {
        return NextResponse.json(
          { success: false, code: 'INVALID_ID', message: 'Invalid thread id' },
          { status: 400 }
        );
      }
      const thread = await CompanyChatThread.findById(threadOid).lean();
      if (!thread) {
        return NextResponse.json(
          { success: false, code: 'NOT_FOUND', message: 'Thread not found' },
          { status: 404 }
        );
      }
      if (!isThreadParticipant(user!.companyId, thread)) {
        return NextResponse.json(
          { success: false, code: 'FORBIDDEN', message: 'Not a participant on this thread' },
          { status: 403 }
        );
      }
      purpose = parseChatPurpose(thread.purpose) || 'ORDER_STATUS';
      po = await PurchaseOrder.findById(thread.purchaseOrderId).lean();
    } else if (purchaseOrderId) {
      if (!purpose) {
        return NextResponse.json(
          { success: false, code: 'MISSING_PARAM', message: 'purpose is required with purchaseOrderId' },
          { status: 400 }
        );
      }
      const poOid = toObjectId(purchaseOrderId);
      if (!poOid) {
        return NextResponse.json(
          { success: false, code: 'INVALID_ID', message: 'Invalid purchase order id' },
          { status: 400 }
        );
      }
      po = await PurchaseOrder.findById(poOid).lean();
    } else {
      return NextResponse.json(
        { success: false, code: 'MISSING_PARAM', message: 'threadId or purchaseOrderId is required' },
        { status: 400 }
      );
    }

    if (!po) {
      return NextResponse.json(
        { success: false, code: 'NOT_FOUND', message: 'Purchase order not found' },
        { status: 404 }
      );
    }

    if (!isPoParticipant(user!.companyId, po)) {
      return NextResponse.json(
        { success: false, code: 'FORBIDDEN', message: 'Not a party on this purchase order' },
        { status: 403 }
      );
    }

    const side = resolveSenderSide(
      user!.companyId,
      po.buyerCompanyId.toString(),
      po.supplierCompanyId.toString()
    );

    if (!side || !purpose) {
      return NextResponse.json(
        { success: false, code: 'FORBIDDEN', message: 'Cannot determine sender role' },
        { status: 403 }
      );
    }

    if (side === 'BUYER') {
      const templates = await getBuyerTemplates(purpose);
      return NextResponse.json({
        success: true,
        data: { side, purpose, role: 'buyer', templates, pendingQuestion: null },
      });
    }

    if (!threadOid) {
      return NextResponse.json({
        success: true,
        data: {
          side,
          purpose,
          role: 'supplier',
          templates: [],
          pendingQuestion: null,
          hint: 'Open the chat thread to reply to buyer questions.',
        },
      });
    }

    const pendingQuestion = await findPendingBuyerQuestion(threadOid);
    if (!pendingQuestion) {
      return NextResponse.json({
        success: true,
        data: {
          side,
          purpose,
          role: 'supplier',
          templates: [],
          pendingQuestion: null,
          hint: 'Waiting for the buyer to ask a question.',
        },
      });
    }

    const templates = await getSupplierTemplates(purpose, pendingQuestion.id);

    return NextResponse.json({
      success: true,
      data: {
        side,
        purpose,
        role: 'supplier',
        templates,
        pendingQuestion,
        hint: `Reply to: ${pendingQuestion.text}`,
      },
    });
  } catch (error: any) {
    console.error('List chat templates error:', error);
    return NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
