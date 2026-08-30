import { db } from './db';
import mongoose from 'mongoose';

interface NotifyParams {
  userIds: string[];
  title: string;
  message: string;
  meta?: any;
}

export async function notify({ userIds, title, message, meta }: NotifyParams) {
  if (!userIds || userIds.length === 0) return;

  const notifications = userIds.map(userId => ({
    userId,
    title,
    message,
  }));

  // Insert notifications in DB
  await db();
  const { Notification } = await import('@/models/User');
  await Notification.insertMany(notifications);

  // Check if SMTP is configured for emails
  const smtpUrl = process.env.SMTP_URL;
  if (smtpUrl) {
    // Send email logic here (Phase 2 or when SMTP is ready)
    // console.log('[NOTIFY - EMAIL SENT]', { userIds, title });
  } else {
    // Local development console log
    console.log('[NOTIFY - LOCAL LOG]', { userIds, title, message });
  }
}

// Helper to notify all users of a specific company
export async function notifyCompany(companyId: string, title: string, message: string, meta?: any) {
  await db();
  const { User } = await import('@/models/User');

  const users = await User.find({ companyId }, '_id').lean() as any[];

  if (users.length > 0) {
    await notify({
      userIds: users.map((u: any) => u._id.toString()),
      title,
      message,
      meta
    });
  }
}
