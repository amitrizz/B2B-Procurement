import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-for-development-use-only';

export async function POST(req: NextRequest) {
    console.log(`[API] ${req.method} ${req.nextUrl?.pathname || req.url}`);
  try {
    const { email } = await req.json();

    if (!email) {
      return console.log(`[API Response] /api/v1/auth/forgot-password - Sending response`), NextResponse.json(
        { success: false, code: 'BAD_REQUEST', message: 'Email is required' },
        { status: 400 }
      );
    }

    await db();
    const { User } = await import('@/models/User');

    const user = await User.findOne({ email }).lean() as any;

    if (!user) {
      // Return success with a mock message to prevent email enumeration, but no token details
      return console.log(`[API Response] /api/v1/auth/forgot-password - Sending response`), NextResponse.json({
        success: true,
        message: 'If the email exists in our system, a password reset link has been generated.',
      });
    }

    // Generate reset token containing email
    const resetToken = jwt.sign({ email: user.email }, JWT_SECRET, { expiresIn: '15m' });
    const resetLink = `/?resetToken=${resetToken}`;

    console.log(`\n======================================================`);
    console.log(`[PASSWORD RESET REQUEST]`);
    console.log(`User: ${email}`);
    console.log(`Reset Link: ${resetLink}`);
    console.log(`======================================================\n`);

    return console.log(`[API Response] /api/v1/auth/forgot-password - Sending response`), NextResponse.json({
      success: true,
      message: 'Password reset link has been generated.',
      data: {
        resetToken,
        resetLink,
      },
    });
  } catch (error: any) {
    console.error('Forgot password error:', error);
    return console.log(`[API Response] /api/v1/auth/forgot-password - Sending response`), NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: 'Internal server error' },
      { status: 500 }
    );
  }
}
