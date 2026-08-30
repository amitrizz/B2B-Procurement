import { db } from './db';

interface AuditParams {
  actorUserId?: string;
  action: string;
  entityType: string;
  entityId: string;
  payload: any;
}

export async function audit({ actorUserId, action, entityType, entityId, payload }: AuditParams) {
  try {
    await db();
    const { AuditLog } = await import('@/models/Platform');
    
    await AuditLog.create({
      actorUserId: actorUserId || null,
      action,
      entityType,
      entityId,
      payload: JSON.stringify(payload)
    });
  } catch (error) {
    // We don't want audit logging failure to block the main transaction,
    // but we should log it to the console for debugging
    console.error('[AUDIT LOG FAILED]', error);
  }
}
