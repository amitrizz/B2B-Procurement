import { db } from './db';
import mongoose from 'mongoose';

export function getIndianFy(date: Date = new Date()): string {
  const month = date.getMonth(); // 0-indexed (0 = Jan, 3 = Apr)
  const year = date.getFullYear();
  const yy = year % 100;
  
  if (month >= 3) {
    // April or later: FY is YY-(YY+1)
    return `${yy}-${yy + 1}`;
  } else {
    // Jan-Mar: FY is (YY-1)-YY
    return `${yy - 1}-${yy}`;
  }
}

export async function nextNumber(prefix: string): Promise<string> {
  const fy = getIndianFy();
  
  await db();
  const { NumberSequence } = await import('@/models/Platform');

  // Atomically increment and return the new document. Upsert if it doesn't exist.
  const updated = await NumberSequence.findOneAndUpdate(
    { prefix, fy },
    { $inc: { lastValue: 1 } },
    { new: true, upsert: true }
  ).lean() as any;

  if (!updated) {
    throw new Error('Failed to initialize sequence');
  }

  // Format: PREFIX/YY-YY/00000X
  const numberStr = String(updated.lastValue).padStart(6, '0');
  return `${prefix}/${fy}/${numberStr}`;
}
