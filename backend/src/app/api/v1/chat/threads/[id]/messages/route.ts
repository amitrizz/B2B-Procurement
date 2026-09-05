import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import {
  chatAuthError,
  isThreadParticipant,
  serializeMessage,
  toObjectId,
} from '@/lib/chatHelpers';
import {
  getTemplateByKey,
  parseChatPurpose,
  resolveSenderSide,
} from '@/lib/chatTemplates';
import {
  findPendingBuyerQuestion,
  resolveMessageFromTemplateKey,
  answerRequiresDate,
  isValidDateValue,
  parseAnswerTemplateKey,
} from '@/lib/chatQa';
import { seedChatQaIfEmpty } from '@/lib/seedChatQa';
import { broadcastChatMessage } from '@/lib/chatEvents';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(req);
    const authErr = chatAuthError(user);
    if (authErr) return authErr;

    const { id } = await params;
    const threadOid = toObjectId(id);
    if (!threadOid) {
      return NextResponse.json(
        { success: false, code: 'INVALID_ID', message: 'Invalid thread id' },
        { status: 400 }
      );
    }

    await db();
    const { getCompanyChatThreadModel, getCompanyChatMessageModel } = await import('@/models/Chat');
    const CompanyChatThread = getCompanyChatThreadModel();
    const CompanyChatMessage = getCompanyChatMessageModel();
    await import('@/models/Company');
    await import('@/models/User');

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

    const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '100', 10), 200);

    const messages = await CompanyChatMessage.find({ threadId: threadOid })
      .sort({ createdAt: 1 })
      .limit(limit)
      .populate('senderCompanyId', 'name')
      .populate('senderUserId', 'name')
      .lean();

    const data = messages.map((m: any) => serializeMessage(m, user!.companyId));

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('List chat messages error:', error);
    return NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(req);
    const authErr = chatAuthError(user);
    if (authErr) return authErr;

    const { id } = await params;
    const threadOid = toObjectId(id);
    if (!threadOid) {
      return NextResponse.json(
        { success: false, code: 'INVALID_ID', message: 'Invalid thread id' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const templateKey = body?.templateKey as string | undefined;
    const dateValue = body?.dateValue as string | undefined;
    if (!templateKey || typeof templateKey !== 'string') {
      return NextResponse.json(
        { success: false, code: 'MISSING_FIELD', message: 'templateKey is required' },
        { status: 400 }
      );
    }

    await db();
    await seedChatQaIfEmpty();
    const { getCompanyChatThreadModel, getCompanyChatMessageModel } = await import('@/models/Chat');
    const CompanyChatThread = getCompanyChatThreadModel();
    const CompanyChatMessage = getCompanyChatMessageModel();
    await import('@/models/Company');
    await import('@/models/User');

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

    const side = resolveSenderSide(
      user!.companyId,
      thread.buyerCompanyId.toString(),
      thread.supplierCompanyId.toString()
    );
    if (!side) {
      return NextResponse.json(
        { success: false, code: 'FORBIDDEN', message: 'Cannot determine sender role' },
        { status: 403 }
      );
    }

    const threadPurpose = parseChatPurpose(thread.purpose) || 'ORDER_STATUS';
    const pendingQuestion = side === 'SUPPLIER' ? await findPendingBuyerQuestion(threadOid) : null;

    let resolved = await resolveMessageFromTemplateKey(
      templateKey,
      side,
      threadPurpose,
      pendingQuestion?.id,
      dateValue
    );

    if (!resolved) {
      const legacy = getTemplateByKey(templateKey);
      if (legacy && legacy.side === side && legacy.purpose === threadPurpose) {
        resolved = {
          messageType: side === 'BUYER' ? ('QUESTION' as const) : ('ANSWER' as const),
          questionId: undefined,
          answerId: undefined,
          label: legacy.label,
          templateKey: legacy.key,
        };
      }
    }

    if (!resolved) {
      if (side === 'SUPPLIER' && !pendingQuestion) {
        return NextResponse.json(
          {
            success: false,
            code: 'NO_PENDING_QUESTION',
            message: 'Wait for the buyer to ask a question before replying.',
          },
          { status: 400 }
        );
      }

      const answerId = parseAnswerTemplateKey(templateKey);
      if (side === 'SUPPLIER' && answerId && pendingQuestion?.id) {
        const { getChatQuestionModel } = await import('@/models/ChatQuestion');
        const question = await getChatQuestionModel().findById(pendingQuestion.id).lean();
        const answer = (question?.answers || []).find((a: any) => a._id.toString() === answerId);
        if (answer && answerRequiresDate(answer.label) && !isValidDateValue(dateValue)) {
          return NextResponse.json(
            {
              success: false,
              code: 'MISSING_DATE',
              message: 'Please select a date for this answer.',
            },
            { status: 400 }
          );
        }
      }

      return NextResponse.json(
        { success: false, code: 'INVALID_TEMPLATE', message: 'Invalid option for your role or chat purpose' },
        { status: 400 }
      );
    }

    const recentDuplicate = await CompanyChatMessage.findOne({
      threadId: threadOid,
      senderCompanyId: user!.companyId,
      templateKey: resolved.templateKey,
      createdAt: { $gte: new Date(Date.now() - 5000) },
    }).lean();

    if (recentDuplicate) {
      return NextResponse.json(
        { success: false, code: 'DUPLICATE', message: 'Please wait before sending the same message again' },
        { status: 429 }
      );
    }

    const msg = await CompanyChatMessage.create({
      threadId: threadOid,
      senderCompanyId: user!.companyId,
      senderUserId: user!.id,
      messageType: resolved.messageType,
      questionId: resolved.questionId,
      answerId: resolved.answerId,
      templateKey: resolved.templateKey,
      label: resolved.label,
    });

    await CompanyChatThread.updateOne(
      { _id: threadOid },
      { lastMessageAt: new Date(), lastMessagePreview: resolved.label }
    );

    const populated = await CompanyChatMessage.findById(msg._id)
      .populate('senderCompanyId', 'name')
      .populate('senderUserId', 'name')
      .lean();

    const senderCompanyName =
      (populated as any)?.senderCompanyId?.name || user!.company?.name || 'Company';

    const { PurchaseOrder } = await import('@/models/PurchaseOrder');
    const po = await PurchaseOrder.findById(thread.purchaseOrderId).select('poNumber').lean();

    await broadcastChatMessage({
      buyerCompanyId: thread.buyerCompanyId.toString(),
      supplierCompanyId: thread.supplierCompanyId.toString(),
      senderCompanyId: user!.companyId,
      senderCompanyName,
      label: resolved.label,
      threadId: threadOid.toString(),
      purchaseOrderId: thread.purchaseOrderId.toString(),
      poNumber: po?.poNumber,
      chatMessage: {
        id: msg._id.toString(),
        label: resolved.label,
        senderCompanyId: user!.companyId,
        senderCompanyName,
        createdAt: (msg.createdAt ?? new Date()).toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      data: serializeMessage(populated, user!.companyId),
    });
  } catch (error: any) {
    console.error('Send chat message error:', error);
    return NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
