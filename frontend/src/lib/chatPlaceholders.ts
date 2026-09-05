/** Matches [date], [date to be confirmed], etc. */
const DATE_PLACEHOLDER_REGEX = /\[date[^\]]*\]/gi;

export function answerRequiresDate(label: string): boolean {
  return /\[date[^\]]*\]/i.test(label);
}

export function formatChatDate(dateValue: string): string {
  const [y, m, d] = dateValue.split('-').map(Number);
  if (!y || !m || !d) return dateValue;
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function replaceDatePlaceholder(label: string, dateValue: string): string {
  const formatted = formatChatDate(dateValue);
  return label.replace(DATE_PLACEHOLDER_REGEX, formatted);
}

export function previewAnswerWithDate(label: string, dateValue: string): string {
  if (!dateValue || !answerRequiresDate(label)) return label;
  return replaceDatePlaceholder(label, dateValue);
}
