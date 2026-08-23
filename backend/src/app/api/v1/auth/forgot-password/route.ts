import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-for-development-use-only';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json(
        { success: false, code: 'BAD_REQUEST', message: 'Email is required' },
        { status: 400 }
      );
    }

    const user = await db.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Return success with a mock message to prevent email enumeration, but no token details
      return NextResponse.json({
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

    return NextResponse.json({
      success: true,
      message: 'Password reset link has been generated.',
      data: {
        resetToken,
        resetLink,
      },
    });
  } catch (error: any) {
    console.error('Forgot password error:', error);
    return NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: 'Internal server error' },
      { status: 500 }
    );
  }
}
