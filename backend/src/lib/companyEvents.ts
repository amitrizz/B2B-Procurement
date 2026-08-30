import { eventEmitter } from './eventEmitter';
import { sendNotificationToUser } from './webpush';
import { db } from './db';

/**
 * Helper to emit SSE event and send Web Push notification for company updates.
 */
export async function broadcastCompanyUpdate(companyId: string, eventType: string, message: string) {
  try {
    // 1. Emit SSE for connected clients via companyId
    eventEmitter.emit('app_event', {
      companyId: companyId.toString(),
      type: eventType,
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
