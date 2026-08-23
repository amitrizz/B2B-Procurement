import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-for-development-use-only';

export async function POST(req: NextRequest) {
  try {
    const { token, newPassword } = await req.json();

    if (!token || !newPassword) {
      return NextResponse.json(
        { success: false, code: 'BAD_REQUEST', message: 'Token and new password are required' },
        { status: 400 }
      );
    }

    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return NextResponse.json(
        { success: false, code: 'INVALID_TOKEN', message: 'Reset token is invalid or has expired' },
        { status: 400 }
      );
    }

    const email = decoded.email;
    if (!email) {
      return NextResponse.json(
        { success: false, code: 'INVALID_TOKEN', message: 'Invalid token payload' },
        { status: 400 }
      );
    }

    const user = await db.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, code: 'USER_NOT_FOUND', message: 'User not found' },
        { status: 404 }
      );
    }

    const hashed = hashPassword(newPassword);

    await db.user.update({
      where: { email },
      data: { passwordHash: hashed },
    });

    return NextResponse.json({
      success: true,
      message: 'Password reset successfully',
    });
  } catch (error: any) {
    console.error('Reset password error:', error);
    return NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: 'Internal server error' },
      { status: 500 }
    );
  }
}
