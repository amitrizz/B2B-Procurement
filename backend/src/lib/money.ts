export function rupeesToPaise(n: number): number {
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) {
    throw new Error('Invalid amount for rupees to paise conversion');
  }
  return Math.round(n * 100);
}

export function formatInr(paise: number): string {
  if (typeof paise !== 'number' || !Number.isFinite(paise)) {
    return '₹0.00';
  }
  return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
