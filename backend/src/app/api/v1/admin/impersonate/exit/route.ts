import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateAccessToken, generateRefreshToken } from '@/lib/auth';
import { clearImpersonation, getImpersonationAdmin } from '@/lib/impersonation';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  console.log(`[API] ${req.method} ${req.nextUrl?.pathname || req.url}`);
  try {
    const body = await req.json().catch(() => ({}));
    const { targetEmail, adminUserId } = body;

    let adminId = adminUserId;
    if (targetEmail) {
      const record = getImpersonationAdmin(targetEmail);
      if (record && record.adminUserId) {
        adminId = record.adminUserId;
      }
      clearImpersonation(targetEmail);
    }

    await db();
    const { User, RefreshToken } = await import('@/models/User');
    await import('@/models/Company');

    let adminUser: any = null;
    if (adminId) {
      adminUser = await User.findById(adminId).populate('companyId').lean();
    }

    // Fallback: If adminId not provided or not found, look up any PLATFORM_ADMIN
    if (!adminUser || adminUser.role !== 'PLATFORM_ADMIN') {
      adminUser = await User.findOne({ role: 'PLATFORM_ADMIN' }).populate('companyId').lean();
    }

    if (!adminUser) {
      return NextResponse.json(
        { success: false, code: 'ADMIN_NOT_FOUND', message: 'Platform Administrator account not found' },
        { status: 404 }
      );
    }

    const accessToken = generateAccessToken({
      userId: adminUser._id.toString(),
      role: adminUser.role,
      companyId: adminUser.companyId ? adminUser.companyId._id?.toString() || adminUser.companyId.toString() : null,
    });

    const refreshToken = generateRefreshToken({ userId: adminUser._id.toString() });

    await RefreshToken.create({
      userId: adminUser._id,
      token: refreshToken,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    const response = NextResponse.json({
      success: true,
      message: 'Impersonation ended successfully',
      data: {
        accessToken,
        refreshToken,
        user: {
          id: adminUser._id.toString(),
          name: adminUser.name,
          email: adminUser.email,
          role: adminUser.role,
          companyId: adminUser.companyId ? adminUser.companyId._id?.toString() || adminUser.companyId.toString() : null,
          company: adminUser.companyId ? {
            ...adminUser.companyId,
            id: adminUser.companyId._id?.toString() || adminUser.companyId.toString(),
          } : null,
        }
      }
    });

    // Reset auth cookies back to Admin credentials
    response.cookies.set('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60,
    });

    response.cookies.set('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60,
    });

    return response;
  } catch (error: any) {
    console.error('Exit impersonation error:', error);
    return NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: 'Failed to exit impersonation' },
      { status: 500 }
    );
  }
}
