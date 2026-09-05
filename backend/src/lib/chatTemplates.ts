export type ChatSenderSide = 'BUYER' | 'SUPPLIER';
export type ChatPurpose = 'ORDER_STATUS' | 'REPEAT_ORDER';

export type ChatTemplate = {
  key: string;
  label: string;
  side: ChatSenderSide;
  purpose: ChatPurpose;
};

export const CHAT_PURPOSE_LABELS: Record<ChatPurpose, string> = {
  ORDER_STATUS: 'Order Status',
  REPEAT_ORDER: 'Repeat Order',
};

export const CHAT_TEMPLATES: ChatTemplate[] = [
  // Order status — buyer
  {
    key: 'EXPECTED_DATE',
    label: 'What is the expected delivery/completion date?',
    side: 'BUYER',
    purpose: 'ORDER_STATUS',
  },
  {
    key: 'PENDING_WORK',
    label: 'What work is still pending on this order?',
    side: 'BUYER',
    purpose: 'ORDER_STATUS',
  },
  {
    key: 'STATUS_UPDATE',
    label: 'Please share a status update on this PO.',
    side: 'BUYER',
    purpose: 'ORDER_STATUS',
  },
  {
    key: 'DISPATCH_WHEN',
    label: 'When will the order be ready for dispatch?',
    side: 'BUYER',
    purpose: 'ORDER_STATUS',
  },
  // Order status — supplier
  {
    key: 'EXPECTED_DATE_REPLY',
    label: 'Expected delivery date is [to be confirmed in follow-up].',
    side: 'SUPPLIER',
    purpose: 'ORDER_STATUS',
  },
  {
    key: 'PENDING_WORK_REPLY',
    label: 'Pending work: machining/finishing/QC in progress.',
    side: 'SUPPLIER',
    purpose: 'ORDER_STATUS',
  },
  { key: 'DELAY_NOTICE', label: 'There is a delay; revised date will follow.', side: 'SUPPLIER', purpose: 'ORDER_STATUS' },
  { key: 'READY_FOR_DISPATCH', label: 'Order is ready for dispatch/pickup.', side: 'SUPPLIER', purpose: 'ORDER_STATUS' },
  {
    key: 'NEED_CLARIFICATION',
    label: 'We need clarification on drawings/spec before proceeding.',
    side: 'SUPPLIER',
    purpose: 'ORDER_STATUS',
  },
  // Repeat order — buyer
  {
    key: 'ORDER_AGAIN',
    label: 'Can we place a repeat order for the same items?',
    side: 'BUYER',
    purpose: 'REPEAT_ORDER',
  },
  {
    key: 'LEAD_TIME',
    label: 'What is the lead time for the next batch?',
    side: 'BUYER',
    purpose: 'REPEAT_ORDER',
  },
  {
    key: 'SAME_QUANTITY',
    label: 'Can we repeat this order with the same quantity?',
    side: 'BUYER',
    purpose: 'REPEAT_ORDER',
  },
  {
    key: 'PRICING_SAME',
    label: 'Will pricing remain the same as this PO for a repeat order?',
    side: 'BUYER',
    purpose: 'REPEAT_ORDER',
  },
  {
    key: 'REPEAT_TIMELINE',
    label: 'When can you start production for a repeat order?',
    side: 'BUYER',
    purpose: 'REPEAT_ORDER',
  },
  // Repeat order — supplier
  {
    key: 'REPEAT_CONFIRMED',
    label: 'We can accept a repeat order on the same terms.',
    side: 'SUPPLIER',
    purpose: 'REPEAT_ORDER',
  },
  {
    key: 'REPEAT_LEAD_TIME',
    label: 'Lead time for the repeat order is [to be confirmed].',
    side: 'SUPPLIER',
    purpose: 'REPEAT_ORDER',
  },
  {
    key: 'REPEAT_QUOTE_NEEDED',
    label: 'We will share updated pricing for the repeat order.',
    side: 'SUPPLIER',
    purpose: 'REPEAT_ORDER',
  },
  {
    key: 'REPEAT_SPECS_REVIEW',
    label: 'We need to review specs/drawings before confirming repeat order.',
    side: 'SUPPLIER',
    purpose: 'REPEAT_ORDER',
  },
  {
    key: 'REPEAT_PRODUCTION_START',
    label: 'We can start repeat production from [date to be confirmed].',
    side: 'SUPPLIER',
    purpose: 'REPEAT_ORDER',
  },
];

export function parseChatPurpose(value: unknown): ChatPurpose | null {
  if (value === 'ORDER_STATUS' || value === 'REPEAT_ORDER') return value;
  return null;
}

export function getTemplatesForSide(side: ChatSenderSide, purpose: ChatPurpose): ChatTemplate[] {
  return CHAT_TEMPLATES.filter((t) => t.side === side && t.purpose === purpose);
}

export function getTemplateByKey(key: string): ChatTemplate | undefined {
  return CHAT_TEMPLATES.find((t) => t.key === key);
}

export function resolveSenderSide(
  companyId: string,
  buyerCompanyId: string,
  supplierCompanyId: string
): ChatSenderSide | null {
  if (companyId === buyerCompanyId) return 'BUYER';
  if (companyId === supplierCompanyId) return 'SUPPLIER';
  return null;
}
