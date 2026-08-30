import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, authErrorResponse } from '@/lib/auth';
import * as jose from 'jose';

export async function POST(req: NextRequest) {
    console.log(`[API] ${req.method} ${req.nextUrl?.pathname || req.url}`);
  try {
    const user = await getAuthUser(req);
    if (!user) return authErrorResponse();

    if (user.emailVerified) {
      return console.log(`[API Response] /api/v1/auth/send-verify-email - Sending response`), NextResponse.json(
        { success: false, code: 'ALREADY_VERIFIED', message: 'Email is already verified' },
        { status: 400 }
      );
    }

    const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback_secret');
    
    // Create verification token valid for 24h
    const token = await new jose.SignJWT({ email: user.email })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('24h')
      .sign(secret);

    // Using notify stub instead of real SMTP for Phase 1
    const { notify } = await import('@/lib/notify');
    await notify({
      userIds: [user.id],
      title: 'Email Verification',
      message: `Verification token generated. Access /verify-email?token=${token}`,
    });

    return console.log(`[API Response] /api/v1/auth/send-verify-email - Sending response`), NextResponse.json({
      success: true,
      message: 'Verification email sent',
    });
  } catch (error: any) {
    console.error('Send verify email error:', error);
    return console.log(`[API Response] /api/v1/auth/send-verify-email - Sending response`), NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: 'Internal server error' },
      { status: 500 }
    );
  }
}
