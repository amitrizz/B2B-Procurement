import { publishToCentrifugo } from './centrifugo';
import { sendNotificationToUser } from './webpush';
import { db } from './db';

export async function broadcastChatMessage(params: {
  buyerCompanyId: string;
  supplierCompanyId: string;
  senderCompanyId: string;
  senderCompanyName: string;
  label: string;
  threadId: string;
  purchaseOrderId: string;
  poNumber?: string;
  chatMessage: {
    id: string;
    label: string;
    senderCompanyId: string;
    senderCompanyName: string;
    createdAt: string;
  };
}) {
  try {
    await publishToCentrifugo('global_updates', {
      type: 'db_change',
      eventType: 'chat_message',
      targetCompanyIds: [params.buyerCompanyId, params.supplierCompanyId],
      senderCompanyId: params.senderCompanyId,
      message: `${params.senderCompanyName}: ${params.label}`,
      threadId: params.threadId,
      purchaseOrderId: params.purchaseOrderId,
      poNumber: params.poNumber,
      chatMessage: params.chatMessage,
    });

    const recipientCompanyId =
      params.senderCompanyId === params.buyerCompanyId
        ? params.supplierCompanyId
        : params.buyerCompanyId;

    await db();
    const { User, Notification } = await import('@/models/User');

    const pushTitle = params.poNumber
      ? `New chat message · ${params.poNumber}`
      : 'New company chat message';
    const pushBody = `${params.senderCompanyName}: ${params.label}`;

    // 1. Persist notification in DB
    const mongoose = (await import('mongoose')).default;
    if (recipientCompanyId && mongoose.Types.ObjectId.isValid(recipientCompanyId)) {
      await Notification.create({
        companyId: new mongoose.Types.ObjectId(recipientCompanyId),
        title: pushTitle,
        message: pushBody,
        type: 'CHAT',
        link: '/dashboard/company_chat',
        read: false,
        meta: {
          threadId: params.threadId,
          purchaseOrderId: params.purchaseOrderId,
          poNumber: params.poNumber
        }
      }).catch(() => {});
    }

    const users = await User.find({ companyId: recipientCompanyId }).lean() as any[];

    await Promise.all(
      users.map((u) =>
        sendNotificationToUser(u._id.toString(), {
          title: pushTitle,
          body: pushBody,
          url: '/chat',
        }).catch(() => {})
      )
    );
  } catch (error) {
    console.error('Error broadcasting chat message:', error);
  }
}
