import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import * as jose from 'jose';

export async function POST(req: NextRequest) {
    console.log(`[API] ${req.method} ${req.nextUrl?.pathname || req.url}`);
  try {
    const { token } = await req.json();

    if (!token) {
      return console.log(`[API Response] /api/v1/auth/verify-email - Sending response`), NextResponse.json(
        { success: false, code: 'BAD_REQUEST', message: 'Token is required' },
        { status: 400 }
      );
    }

    const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback_secret');
    
    let payload;
    try {
      const { payload: jwtPayload } = await jose.jwtVerify(token, secret);
      payload = jwtPayload;
    } catch (e) {
      return console.log(`[API Response] /api/v1/auth/verify-email - Sending response`), NextResponse.json(
        { success: false, code: 'INVALID_TOKEN', message: 'Invalid or expired token' },
        { status: 400 }
      );
    }

    if (!payload.email) {
      return console.log(`[API Response] /api/v1/auth/verify-email - Sending response`), NextResponse.json(
        { success: false, code: 'INVALID_TOKEN', message: 'Invalid token payload' },
        { status: 400 }
      );
    }

    await db();
    const { User } = await import('@/models/User');

    const user = await User.findOneAndUpdate(
      { email: payload.email as string },
      { $set: { emailVerified: true } },
      { new: true }
    ).lean() as any;

    if (!user) {
      return console.log(`[API Response] /api/v1/auth/verify-email - Sending response`), NextResponse.json(
        { success: false, code: 'USER_NOT_FOUND', message: 'User not found' },
        { status: 404 }
      );
    }

    return console.log(`[API Response] /api/v1/auth/verify-email - Sending response`), NextResponse.json({
      success: true,
      message: 'Email verified successfully',
    });
  } catch (error: any) {
    console.error('Verify email error:', error);
    return console.log(`[API Response] /api/v1/auth/verify-email - Sending response`), NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: 'Internal server error' },
      { status: 500 }
    );
  }
}
