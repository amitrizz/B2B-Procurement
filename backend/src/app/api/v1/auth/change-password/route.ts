import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, authErrorResponse, verifyPassword, hashPassword } from '@/lib/auth';

export async function PUT(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return authErrorResponse();

    const { currentPassword, newPassword } = await req.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { success: false, code: 'BAD_REQUEST', message: 'Missing current or new password' },
        { status: 400 }
      );
    }

    // Verify current password
    if (!verifyPassword(currentPassword, user.passwordHash)) {
      return NextResponse.json(
        { success: false, code: 'INVALID_PASSWORD', message: 'Current password is incorrect' },
        { status: 400 }
      );
    }

    // Hash the new password
    const hashed = hashPassword(newPassword);

    // Update in database
    await db.user.update({
      where: { id: user.id },
      data: { passwordHash: hashed },
    });

    return NextResponse.json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error: any) {
    console.error('Change password error:', error);
    return NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: 'Internal server error' },
      { status: 500 }
    );
  }
}
