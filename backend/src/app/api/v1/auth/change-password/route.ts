import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, authErrorResponse, verifyPassword, hashPassword } from '@/lib/auth';

export async function PUT(req: NextRequest) {
    console.log(`[API] ${req.method} ${req.nextUrl?.pathname || req.url}`);
  try {
    const user = await getAuthUser(req);
    if (!user) return authErrorResponse();

    const { currentPassword, newPassword } = await req.json();

    if (!currentPassword || !newPassword) {
      return console.log(`[API Response] /api/v1/auth/change-password - Sending response`), NextResponse.json(
        { success: false, code: 'BAD_REQUEST', message: 'Missing current or new password' },
        { status: 400 }
      );
    }

    // Verify current password
    if (!verifyPassword(currentPassword, user.passwordHash)) {
      return console.log(`[API Response] /api/v1/auth/change-password - Sending response`), NextResponse.json(
        { success: false, code: 'INVALID_PASSWORD', message: 'Current password is incorrect' },
        { status: 400 }
      );
    }

    // Hash the new password
    const hashed = hashPassword(newPassword);

    await db();
    const { User } = await import('@/models/User');

    // Update in database
    await User.updateOne(
      { _id: user.id },
      { $set: { passwordHash: hashed } }
    );

    return console.log(`[API Response] /api/v1/auth/change-password - Sending response`), NextResponse.json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error: any) {
    console.error('Change password error:', error);
    return console.log(`[API Response] /api/v1/auth/change-password - Sending response`), NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: 'Internal server error' },
      { status: 500 }
    );
  }
}
