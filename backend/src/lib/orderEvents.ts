import { publishToCentrifugo } from './centrifugo';
import { sendNotificationToUser } from './webpush';
import { db } from './db';

/**
 * Helper to emit SSE event and send Web Push notification for order updates.
 */
export async function broadcastOrderUpdate(po: any, eventType: string, message: string) {
  try {
    // 1. Emit to Centrifugo
    await publishToCentrifugo('global_updates', {
      type: 'db_change',
      targetCompanyIds: [po.buyerCompanyId?.toString(), po.supplierCompanyId?.toString()],
      message
    });

    // 2. Send Web Push to all users in these companies
    await db();
    const { User } = await import('@/models/User');
    
    // Find all users in both companies
    const users = await User.find({
      companyId: { $in: [po.buyerCompanyId, po.supplierCompanyId] }
    }).lean() as any[];

    const pushPromises = users.map(user => 
      sendNotificationToUser(user._id.toString(), {
        title: 'Order Update',
        body: message,
        url: `/dashboard/orders?id=${po._id?.toString() || po.id}`
      })
    );
    
    await Promise.all(pushPromises);
  } catch (error) {
    console.error('Error broadcasting order update:', error);
  }
}
