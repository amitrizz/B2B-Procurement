import { publishToCentrifugo } from './centrifugo';
import { sendNotificationToUser } from './webpush';
import { db } from './db';

/**
 * Helper to emit SSE event and send Web Push notification for company updates.
 */
export async function broadcastCompanyUpdate(companyId: string, eventType: string, message: string) {
  try {
    console.log(`[Centrifugo] Broadcasting company update for company ${companyId}`);
    // 1. Emit to Centrifugo
    await publishToCentrifugo('global_updates', {
      type: 'db_change',
      targetCompanyIds: [companyId.toString()],
      message
    });

    // 2. Send Web Push to all users in this company
    await db();
    const { User } = await import('@/models/User');
    
    // Find all users in the company
    const users = await User.find({ companyId }).lean() as any[];

    const pushPromises = users.map(user => 
      sendNotificationToUser(user._id.toString(), {
        title: 'Account Update',
        body: message,
        url: '/'
      })
    );
    
    await Promise.all(pushPromises);
  } catch (error) {
    console.error('Error broadcasting company update:', error);
  }
}
