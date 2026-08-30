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
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
}

export function verifyToken(token: string) {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: string; role: string; companyId: string | null; exp: number };
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      console.log('🚨 Backend Alert: An Access Token just expired!');
    } else {
      console.log('🚨 Backend Alert: Invalid Token provided!', error.message);
    }
    return null;
  }
}

export async function getAuthUser(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  let token = '';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else {
    // try to get from cookie
    const cookie = req.cookies.get('token') || req.cookies.get('accessToken');
    if (cookie) token = cookie.value;
  }

  if (!token) return null;
  const decoded = verifyToken(token);
  if (!decoded) return null;

  // Verify user still exists
  try {
    await db();
    const { User } = await import('@/models/User');
    await import('@/models/Company'); // Ensure Company model is registered for populate

    const userDoc = await User.findById(decoded.userId).populate('companyId').lean() as any;
    
    if (!userDoc) return null;

    // Map Mongoose structure back to what the app expects from Prisma
    const user = {
      ...userDoc,
      id: userDoc._id.toString(),
      companyId: userDoc.companyId ? userDoc.companyId._id.toString() : null,
      company: userDoc.companyId ? { 
        ...userDoc.companyId, 
        id: userDoc.companyId._id.toString() 
      } : null
    };

    return user;
  } catch (error: any) {
    console.error(`[DB Error in getAuthUser] Failed to fetch user. DB might be unreachable.`);
    const cleanError = new Error('Database server is unreachable');
    cleanError.name = 'DatabaseConnectionError';
    throw cleanError;
  }
}

export function authErrorResponse(message = 'Unauthorized') {
  return NextResponse.json(
    { success: false, code: 'UNAUTHORIZED', message },
    { status: 401 }
  );
}
