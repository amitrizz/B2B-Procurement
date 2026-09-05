import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { chatAuthError, isPoParticipant, serializeThread, toObjectId } from '@/lib/chatHelpers';
import mongoose from 'mongoose';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    const authErr = chatAuthError(user);
    if (authErr) return authErr;

    await db();
    const { getCompanyChatThreadModel } = await import('@/models/Chat');
    const CompanyChatThread = getCompanyChatThreadModel();
    await import('@/models/PurchaseOrder');
    await import('@/models/Company');

    const myId = new mongoose.Types.ObjectId(user!.companyId);

    const threads = await CompanyChatThread.find({
      $or: [{ buyerCompanyId: myId }, { supplierCompanyId: myId }],
    })
      .sort({ lastMessageAt: -1 })
      .populate('purchaseOrderId', 'poNumber status')
      .populate('buyerCompanyId', 'name')
      .populate('supplierCompanyId', 'name')
      .lean();

    const data = threads.map((t: any) => serializeThread(t, user!.companyId));

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('List chat threads error:', error);
    return NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    const authErr = chatAuthError(user);
    if (authErr) return authErr;

    const body = await req.json();
    const purchaseOrderId = body?.purchaseOrderId as string | undefined;
    const purposeRaw = body?.purpose;
    const { parseChatPurpose } = await import('@/lib/chatTemplates');
    const purpose = parseChatPurpose(purposeRaw);

    if (!purchaseOrderId) {
      return NextResponse.json(
        { success: false, code: 'MISSING_FIELD', message: 'purchaseOrderId is required' },
        { status: 400 }
      );
    }

    if (!purpose) {
      return NextResponse.json(
        { success: false, code: 'MISSING_FIELD', message: 'purpose must be ORDER_STATUS or REPEAT_ORDER' },
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

    await db();
    const { syncChatThreadIndexes } = await import('@/lib/syncChatThreadIndexes');
    await syncChatThreadIndexes();

    const { PurchaseOrder } = await import('@/models/PurchaseOrder');
    const { Company } = await import('@/models/Company');
    const { getCompanyChatThreadModel } = await import('@/models/Chat');
    const CompanyChatThread = getCompanyChatThreadModel();

    const po = await PurchaseOrder.findById(poOid).lean();
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

    const buyerId = po.buyerCompanyId.toString();
    const supplierId = po.supplierCompanyId.toString();
    const counterpartyId = user!.companyId === buyerId ? supplierId : buyerId;

    const counterparty = await Company.findById(counterpartyId).lean();
    if (!counterparty || counterparty.status !== 'VERIFIED' || counterparty.isActive === false) {
      return NextResponse.json(
        { success: false, code: 'COUNTERPARTY_UNAVAILABLE', message: 'Counterparty company is not available for chat' },
        { status: 400 }
      );
    }

    const createThread = async () =>
      CompanyChatThread.create({
        purchaseOrderId: poOid,
        purpose,
        buyerCompanyId: po.buyerCompanyId,
        supplierCompanyId: po.supplierCompanyId,
        lastMessageAt: new Date(),
        lastMessagePreview: '',
      });

    let thread = await CompanyChatThread.findOne({ purchaseOrderId: poOid, purpose });
    if (!thread) {
      try {
        thread = await createThread();
      } catch (createErr: any) {
        if (createErr?.code === 11000) {
          thread = await CompanyChatThread.findOne({ purchaseOrderId: poOid, purpose });
          if (!thread) {
            // Legacy purchaseOrderId-only index blocks a second purpose on the same PO.
            await syncChatThreadIndexes(true);
            thread = await CompanyChatThread.findOne({ purchaseOrderId: poOid, purpose });
            if (!thread) {
              try {
                thread = await createThread();
              } catch (retryErr: any) {
                if (retryErr?.code === 11000) {
                  thread = await CompanyChatThread.findOne({ purchaseOrderId: poOid, purpose });
                }
                if (!thread) throw retryErr;
              }
            }
          }
        } else {
          throw createErr;
        }
      }
    }

    if (thread && !thread.purpose) {
      await CompanyChatThread.updateOne({ _id: thread._id }, { $set: { purpose } });
      thread.purpose = purpose;
    }

    const populated = await CompanyChatThread.findById(thread._id)
      .populate('purchaseOrderId', 'poNumber status')
      .populate('buyerCompanyId', 'name')
      .populate('supplierCompanyId', 'name')
      .lean();

    return NextResponse.json({
      success: true,
      data: serializeThread(populated, user!.companyId),
    });
  } catch (error: any) {
    console.error('Create chat thread error:', error);
    if (error?.code === 11000) {
      return NextResponse.json(
        {
          success: false,
          code: 'DUPLICATE_THREAD',
          message: 'A chat for this purchase order and purpose already exists.',
        },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
