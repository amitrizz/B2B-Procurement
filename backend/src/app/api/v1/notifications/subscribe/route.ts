import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, authErrorResponse } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return authErrorResponse();

    const subscription = await req.json();

    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return NextResponse.json({ success: false, message: 'Invalid subscription object' }, { status: 400 });
    }

    await db();
    const { PushSubscription } = await import('@/models/User');

    // Save or update the subscription. We identify it by the endpoint URL.
    await PushSubscription.findOneAndUpdate(
      { endpoint: subscription.endpoint },
      {
        userId: user.id,
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth
        }
      },
      { upsert: true, new: true }
    );

    return NextResponse.json({ success: true, message: 'Subscription saved successfully' });
  } catch (error: any) {
    console.error('Subscription error:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
