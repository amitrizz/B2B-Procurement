import webpush from 'web-push';
import { db } from './db';

const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
const privateVapidKey = process.env.VAPID_PRIVATE_KEY || '';

// Always setup web-push if keys exist
if (publicVapidKey && privateVapidKey) {
  webpush.setVapidDetails(
    'mailto:support@b2bprocurement.com',
    publicVapidKey,
    privateVapidKey
  );
} else {
  console.warn('VAPID keys not configured. Push notifications will not work.');
}

/**
 * Sends a web push notification to a specific user by querying all their active subscriptions.
 * @param userId The ObjectId string of the user
 * @param payload Object containing title, message, url, etc.
 */
export async function sendNotificationToUser(userId: string, payload: any) {
  if (!publicVapidKey || !privateVapidKey) return;
  
  try {
    await db();
    const { PushSubscription } = await import('@/models/User');
    
    // Find all subscriptions for this user
    const subscriptions = await PushSubscription.find({ userId }).lean() as any[];
    
    if (!subscriptions || subscriptions.length === 0) {
      return;
    }

    const payloadString = JSON.stringify(payload);
    
    const sendPromises = subscriptions.map(async (sub) => {
      const pushSub = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.keys.p256dh,
          auth: sub.keys.auth
        }
      };
      
      try {
        await webpush.sendNotification(pushSub, payloadString);
      } catch (err: any) {
        // If the subscription is no longer valid (e.g. user revoked permission), delete it
        if (err.statusCode === 410 || err.statusCode === 404) {
          await PushSubscription.findByIdAndDelete(sub._id);
        } else {
          console.error('Error sending push notification:', err);
        }
      }
    });

    await Promise.all(sendPromises);
  } catch (error) {
    console.error('Push utility error:', error);
  }
}
