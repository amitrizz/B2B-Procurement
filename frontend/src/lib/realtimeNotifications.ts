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
  if (eventType === 'sampling_cancelled') return 'info';
  if (eventType === 'chat_message') return 'info';
  if (eventType === 'sample_picked_up') return 'success';
  if (/verified|accepted|completed|created|approved|delivered|paid|released|payout|selected|sampling|sample_/i.test(eventType)) {
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

/** Show toast for chat only when the message is from the counterparty, not your own company. */
export function shouldShowChatToast(eventData: any, companyId: string): boolean {
  if (eventData?.eventType !== 'chat_message' || !eventData?.message) return false;
  if (!shouldDeliverEventToCompany(eventData, companyId)) return false;
  if (!eventData.senderCompanyId) return true;
  return eventData.senderCompanyId !== companyId;
}

export function isIncomingChatEvent(eventData: any, companyId: string): boolean {
  return (
    eventData?.eventType === 'chat_message' &&
    shouldDeliverEventToCompany(eventData, companyId) &&
    eventData.senderCompanyId !== companyId
  );
}
