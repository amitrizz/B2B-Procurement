import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { NextRequest, NextResponse } from 'next/server';
import { db } from './db';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-for-development-use-only';
const PBKDF2_ITERATIONS = 10000;
const KEY_LENGTH = 64;
const DIGEST = 'sha512';

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, DIGEST).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, originalHash] = storedHash.split(':');
  if (!salt || !originalHash) return false;
  const hash = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, DIGEST).toString('hex');
  return hash === originalHash;
}

export function generateAccessToken(payload: { userId: string; role: string; companyId: string | null }): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

export function generateRefreshToken(payload: { userId: string }): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}

export function verifyToken(token: string) {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: string; role: string; companyId: string | null; exp: number };
  } catch (error) {
    return null;
  }
}

export async function getAuthUser(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  let token = '';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else {
    token = req.cookies.get('accessToken')?.value || '';
  }

  if (!token) return null;
  const decoded = verifyToken(token);
  if (!decoded) return null;

  // Verify user still exists
  const user = await db.user.findUnique({
    where: { id: decoded.userId },
    include: { company: true },
  });

  return user;
}

export function authErrorResponse(message = 'Unauthorized') {
  return NextResponse.json(
    { success: false, code: 'UNAUTHORIZED', message },
    { status: 401 }
  );
}
