import { publishToCentrifugo } from './centrifugo';
import { sendNotificationToUser } from './webpush';
import { db } from './db';
import mongoose from 'mongoose';

/**
 * Helper to emit SSE/Centrifugo event, persist notification, and send Web Push notification for company updates.
 */
export async function broadcastCompanyUpdate(companyId: string, eventType: string, message: string) {
  try {
    console.log(`[Centrifugo] Broadcasting company update for company ${companyId}`);

    let notifType: 'ORDER' | 'BID' | 'RFQ' | 'SYSTEM' = 'SYSTEM';
    let link = '/dashboard/profile';
    let title = 'Account Update';

    if (eventType.includes('bid')) {
      notifType = 'BID';
      link = '/dashboard/my_rfqs';
      title = 'RFQ & Bid Update';
    } else if (eventType.includes('order')) {
      notifType = 'ORDER';
      link = '/dashboard/orders';
      title = 'Order Update';
    } else if (eventType.includes('rfq')) {
      notifType = 'RFQ';
      link = '/dashboard/marketplace';
      title = 'Marketplace Requirement';
    }

    await db();
    const { Notification, User } = await import('@/models/User');

    // 1. Persist notification in DB
    if (mongoose.Types.ObjectId.isValid(companyId)) {
      await Notification.create({
        companyId: new mongoose.Types.ObjectId(companyId),
        title,
        message,
        type: notifType,
        link,
        read: false,
        meta: { eventType }
      }).catch(() => {});
    }

    // 2. Emit to Centrifugo
    await publishToCentrifugo('global_updates', {
      type: 'db_change',
      eventType,
      targetCompanyIds: [companyId.toString()],
      message,
      notification: {
        title,
        message,
        type: notifType,
        link
      }
    });

    // 3. Send Web Push to all users in this company
    const users = (await User.find({ companyId }).lean()) as any[];

    const pushPromises = users.map((user) =>
      sendNotificationToUser(user._id.toString(), {
        title,
        body: message,
        url: link
      }).catch(() => {})
    );

    await Promise.all(pushPromises);
  } catch (error) {
    console.error('Error broadcasting company update:', error);
  }
}
