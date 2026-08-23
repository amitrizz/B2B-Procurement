import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken, generateAccessToken, generateRefreshToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { refreshToken } = await req.json();

    if (!refreshToken) {
      return NextResponse.json(
        { success: false, code: 'BAD_REQUEST', message: 'Missing refresh token' },
        { status: 400 }
      );
    }

    const decoded = verifyToken(refreshToken);
    if (!decoded) {
      return NextResponse.json(
        { success: false, code: 'INVALID_TOKEN', message: 'Invalid or expired refresh token' },
        { status: 401 }
      );
    }

    // Check token state in DB
    const dbToken = await db.refreshToken.findUnique({
      where: { token: refreshToken },
    });

    if (!dbToken) {
      return NextResponse.json(
        { success: false, code: 'INVALID_TOKEN', message: 'Refresh token not recognized' },
        { status: 401 }
      );
    }

    // Detect reuse of revoked token (compromise attempt)
    if (dbToken.revoked || dbToken.expiresAt < new Date()) {
      // Revoke all tokens for this user!
      await db.refreshToken.updateMany({
        where: { userId: dbToken.userId },
        data: { revoked: true },
      });
      return NextResponse.json(
        { success: false, code: 'COMPROMISE_DETECTED', message: 'Compromise signal detected. Force logging out all sessions.' },
        { status: 401 }
      );
    }

    const user = await db.user.findUnique({
      where: { id: dbToken.userId },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, code: 'USER_NOT_FOUND', message: 'User not found' },
        { status: 401 }
      );
    }

    // Revoke the used token and create a new rotated pair
    await db.refreshToken.update({
      where: { id: dbToken.id },
      data: { revoked: true },
    });

    const newAccessToken = generateAccessToken({
      userId: user.id,
      role: user.role,
      companyId: user.companyId,
    });

    const newRefreshToken = generateRefreshToken({ userId: user.id });

    // Save the new refresh token
    await db.refreshToken.create({
      data: {
        userId: user.id,
        token: newRefreshToken,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
      },
    });

    const response = NextResponse.json({
      success: true,
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      },
    });

    response.cookies.set('accessToken', newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 3600,
    });

    response.cookies.set('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 86400,
    });

    return response;
  } catch (error: any) {
    console.error('Refresh token error:', error);
    return NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: 'Internal server error' },
      { status: 500 }
    );
  }
}
