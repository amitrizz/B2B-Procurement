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
    const { User } = await import('@/models/User');
    const users = await User.find({ companyId: recipientCompanyId }).lean() as any[];

    const pushTitle = params.poNumber
      ? `New chat message · ${params.poNumber}`
      : 'New company chat message';
    const pushBody = `${params.senderCompanyName}: ${params.label}`;

    await Promise.all(
      users.map((u) =>
        sendNotificationToUser(u._id.toString(), {
          title: pushTitle,
          body: pushBody,
          url: '/chat',
        })
      )
    );
  } catch (error) {
    console.error('Error broadcasting chat message:', error);
  }
}
