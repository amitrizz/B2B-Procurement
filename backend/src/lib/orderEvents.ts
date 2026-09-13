import { publishToCentrifugo } from './centrifugo';
import { sendNotificationToUser } from './webpush';
import { db } from './db';
import mongoose from 'mongoose';

/**
 * Helper to persist notification, emit Centrifugo event, and send Web Push notification for order updates.
 */
export async function broadcastOrderUpdate(po: any, eventType: string, message: string) {
  try {
    const buyerId = po.buyerCompanyId?.toString();
    const supplierId = po.supplierCompanyId?.toString();
    const targetCompanyIds = [buyerId, supplierId].filter(Boolean);

    await db();
    const { Notification, User } = await import('@/models/User');

    // 1. Persist notification in database for both Buyer and Supplier
    const notifsToInsert: any[] = [];
    if (buyerId) {
      notifsToInsert.push({
        companyId: new mongoose.Types.ObjectId(buyerId),
        title: 'Order Update',
        message,
        type: 'ORDER',
        link: '/dashboard/orders',
        read: false,
        meta: { sourceId: po._id?.toString() || po.id, poNumber: po.poNumber, status: po.status, eventType }
      });
    }
    if (supplierId) {
      notifsToInsert.push({
        companyId: new mongoose.Types.ObjectId(supplierId),
        title: 'Order Update',
        message,
        type: 'ORDER',
        link: '/dashboard/orders',
        read: false,
        meta: { sourceId: po._id?.toString() || po.id, poNumber: po.poNumber, status: po.status, eventType }
      });
    }

    if (notifsToInsert.length > 0) {
      await Notification.insertMany(notifsToInsert, { ordered: false }).catch(() => {});
    }

    // 2. Emit to Centrifugo
    await publishToCentrifugo('global_updates', {
      type: 'db_change',
      eventType,
      targetCompanyIds,
      message,
      notification: {
        title: 'Order Update',
        message,
        type: 'ORDER',
        link: '/dashboard/orders',
        poNumber: po.poNumber,
        status: po.status
      }
    });

    // 3. Send Web Push to all users in these companies
    const users = (await User.find({
      companyId: { $in: [po.buyerCompanyId, po.supplierCompanyId] }
    }).lean()) as any[];

    const pushPromises = users.map((user) =>
      sendNotificationToUser(user._id.toString(), {
        title: 'Order Update',
        body: message,
        url: `/dashboard/orders?id=${po._id?.toString() || po.id}`
      }).catch(() => {})
    );

    await Promise.all(pushPromises);
  } catch (error) {
    console.error('Error broadcasting order update:', error);
  }
}
