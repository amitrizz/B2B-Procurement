import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken, generateAccessToken, generateRefreshToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
    console.log(`[API] ${req.method} ${req.nextUrl?.pathname || req.url}`);
  try {
    const { refreshToken } = await req.json();

    if (!refreshToken) {
      return console.log(`[API Response] /api/v1/auth/refresh - Sending response`), NextResponse.json(
        { success: false, code: 'BAD_REQUEST', message: 'Missing refresh token' },
        { status: 400 }
      );
    }

    const decoded = verifyToken(refreshToken);
    if (!decoded) {
      return console.log(`[API Response] /api/v1/auth/refresh - Sending response`), NextResponse.json(
        { success: false, code: 'INVALID_TOKEN', message: 'Invalid or expired refresh token' },
        { status: 401 }
      );
    }

    await db();
    const { RefreshToken, User } = await import('@/models/User');

    // Check token state in DB
    const dbToken = await RefreshToken.findOne({ token: refreshToken }).lean() as any;

    if (!dbToken) {
      return console.log(`[API Response] /api/v1/auth/refresh - Sending response`), NextResponse.json(
        { success: false, code: 'INVALID_TOKEN', message: 'Refresh token not recognized' },
        { status: 401 }
      );
    }

    // Detect reuse of revoked token (compromise attempt)
    if (dbToken.revoked || new Date(dbToken.expiresAt) < new Date()) {
      // Revoke all tokens for this user!
      await RefreshToken.updateMany(
        { userId: dbToken.userId },
        { $set: { revoked: true } }
      );
      return console.log(`[API Response] /api/v1/auth/refresh - Sending response`), NextResponse.json(
        { success: false, code: 'COMPROMISE_DETECTED', message: 'Compromise signal detected. Force logging out all sessions.' },
        { status: 401 }
      );
    }

    const user = await User.findById(dbToken.userId).lean() as any;

    if (!user) {
      return console.log(`[API Response] /api/v1/auth/refresh - Sending response`), NextResponse.json(
        { success: false, code: 'USER_NOT_FOUND', message: 'User not found' },
        { status: 401 }
      );
    }

    // Revoke the used token and create a new rotated pair
    await RefreshToken.updateOne(
      { _id: dbToken._id },
      { $set: { revoked: true } }
    );

    const newAccessToken = generateAccessToken({
      userId: user._id.toString(),
      role: user.role,
      companyId: user.companyId ? user.companyId.toString() : null,
    });

    const newRefreshToken = generateRefreshToken({ userId: user._id.toString() });

    // Save the new refresh token
    await RefreshToken.create({
      userId: user._id,
      token: newRefreshToken,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30d
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
      maxAge: 30 * 24 * 60 * 60, // 30d
    });

    return console.log(`[API Response] /api/v1/auth/refresh - Sending response`), response;
  } catch (error: any) {
    console.error('Refresh token error:', error);
    return console.log(`[API Response] /api/v1/auth/refresh - Sending response`), NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: 'Internal server error' },
      { status: 500 }
    );
  }
}
