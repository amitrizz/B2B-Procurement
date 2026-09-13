import { db } from './db';
import { publishToCentrifugo } from './centrifugo';
import { sendNotificationToUser } from './webpush';
import mongoose from 'mongoose';

export type NotificationType =
  | 'ORDER'
  | 'RFQ'
  | 'BID'
  | 'LOGISTICS'
  | 'PAYMENT'
  | 'SAMPLING'
  | 'CHAT'
  | 'SYSTEM';

export interface CreateNotificationParams {
  userId?: string;
  companyId?: string;
  title: string;
  message: string;
  type?: NotificationType;
  link?: string;
  meta?: any;
}

export interface NotifyParams {
  userIds?: string[];
  companyId?: string;
  title: string;
  message: string;
  type?: NotificationType;
  link?: string;
  meta?: any;
}

/**
 * Persist notification and push real-time updates via Centrifugo & WebPush.
 */
export async function createActivityNotification({
  userId,
  companyId,
  title,
  message,
  type = 'SYSTEM',
  link = '/dashboard',
  meta
}: CreateNotificationParams) {
  try {
    await db();
    const { Notification, User } = await import('@/models/User');

    const notifDoc = await Notification.create({
      userId: userId ? new mongoose.Types.ObjectId(userId) : undefined,
      companyId: companyId ? new mongoose.Types.ObjectId(companyId) : undefined,
      title,
      message,
      type,
      link,
      read: false,
      meta
    });

    const notifObj = {
      id: notifDoc._id.toString(),
      userId: userId || null,
      companyId: companyId || null,
      title,
      message,
      type,
      link,
      read: false,
      meta,
      createdAt: notifDoc.createdAt || new Date()
    };

    // 1. Emit live WebSocket event via Centrifugo
    const targetCompanyIds = companyId ? [companyId.toString()] : [];
    await publishToCentrifugo('global_updates', {
      type: 'db_change',
      eventType: 'notification_created',
      targetCompanyIds: targetCompanyIds.length > 0 ? targetCompanyIds : undefined,
      notification: notifObj,
      message
    });

    // 2. Send Web Push to relevant users
    if (userId) {
      await sendNotificationToUser(userId, {
        title,
        body: message,
        url: link
      }).catch((e) => console.warn('Push error:', e?.message));
    } else if (companyId) {
      const users = (await User.find({ companyId }, '_id').lean()) as any[];
      await Promise.all(
        users.map((u) =>
          sendNotificationToUser(u._id.toString(), {
            title,
            body: message,
            url: link
          }).catch(() => {})
        )
      );
    }

    return notifObj;
  } catch (error) {
    console.error('Error in createActivityNotification:', error);
    return null;
  }
}

/**
 * Standard notify function for multi-user or single company delivery.
 */
export async function notify({
  userIds,
  companyId,
  title,
  message,
  type = 'SYSTEM',
  link = '/dashboard',
  meta
}: NotifyParams) {
  if (companyId) {
    return await createActivityNotification({
      companyId,
      title,
      message,
      type,
      link,
      meta
    });
  }

  if (!userIds || userIds.length === 0) return;

  await Promise.all(
    userIds.map((uid) =>
      createActivityNotification({
        userId: uid,
        title,
        message,
        type,
        link,
        meta
      })
    )
  );
}

/**
 * Helper to notify all users of a specific company (e.g. Buyer, Supplier, Transporter)
 */
export async function notifyCompany(
  companyId: string,
  title: string,
  message: string,
  type: NotificationType = 'SYSTEM',
  link: string = '/dashboard',
  meta?: any
) {
  if (!companyId) return;
  return await createActivityNotification({
    companyId,
    title,
    message,
    type,
    link,
    meta
  });
}
