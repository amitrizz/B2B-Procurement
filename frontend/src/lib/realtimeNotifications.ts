export type RealtimeToastType = 'success' | 'error' | 'info';

export function resolveToastType(data: {
  toastType?: RealtimeToastType;
  eventType?: string;
  status?: string;
}): RealtimeToastType {
  if (data.toastType) return data.toastType;

  if (data.status === 'VERIFIED') return 'success';
  if (data.status === 'REJECTED' || data.status === 'SUSPENDED') return 'error';

  const eventType = data.eventType || '';
  if (/verified|accepted|completed|created|approved|delivered|paid|released|payout|selected/i.test(eventType)) {
    return 'success';
  }
  if (/rejected|failed|suspended|cancelled|withdrawn/i.test(eventType)) {
    return 'error';
  }
  return 'info';
}

export function shouldDeliverEventToCompany(eventData: any, companyId: string): boolean {
  if (!eventData) return false;
  if (eventData.target === 'all') return true;

  const targets: string[] = eventData.targetCompanyIds || [];
  if (!targets.length) return true;

  return targets.includes(companyId) || eventData.companyId === companyId;
}
