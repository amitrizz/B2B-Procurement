import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, authErrorResponse, generateAccessToken, generateRefreshToken } from '@/lib/auth';
import { registerImpersonation } from '@/lib/impersonation';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  console.log(`[API] ${req.method} ${req.nextUrl?.pathname || req.url}`);
  try {
    const adminUser = await getAuthUser(req);
    if (!adminUser || adminUser.role !== 'PLATFORM_ADMIN') {
      return authErrorResponse('Only Platform Administrators can impersonate other accounts');
    }

    const { companyId, userId } = await req.json();

    if (!companyId && !userId) {
      return NextResponse.json(
        { success: false, code: 'BAD_REQUEST', message: 'Either companyId or userId is required' },
        { status: 400 }
      );
    }

    await db();
    const { User, RefreshToken: RefreshTokenModel } = await import('@/models/User');
    const { Company } = await import('@/models/Company');

    let targetUserDoc: any = null;

    if (userId) {
      targetUserDoc = await User.findById(userId).populate('companyId').lean();
    } else if (companyId) {
      // Find the primary user (OWNER first, or any active user in this company)
      targetUserDoc = await User.findOne({ companyId, role: 'OWNER' }).populate('companyId').lean();
      if (!targetUserDoc) {
        targetUserDoc = await User.findOne({ companyId }).populate('companyId').lean();
      }
    }

    if (!targetUserDoc) {
      // If company exists but has no user, fetch company info to give a clear message
      const comp = companyId ? await Company.findById(companyId).lean() : null;
      return NextResponse.json(
        { 
          success: false, 
          code: 'USER_NOT_FOUND', 
          message: comp 
            ? `No registered user account found for "${comp.name}".` 
            : 'Target user not found.' 
        },
        { status: 404 }
      );
    }

    const targetUser = {
      ...targetUserDoc,
      id: targetUserDoc._id.toString(),
      companyId: targetUserDoc.companyId ? targetUserDoc.companyId._id.toString() : null,
      company: targetUserDoc.companyId ? {
        ...targetUserDoc.companyId,
        id: targetUserDoc.companyId._id.toString(),
      } : null,
    };

    // Register active impersonation so emails/OTPs route to Admin
    registerImpersonation(
      targetUser.email,
      adminUser.email,
      adminUser.id,
      targetUser.companyId || ''
    );

    // Generate tokens for target user with impersonation metadata
    const accessToken = generateAccessToken({
      userId: targetUser.id,
      role: targetUser.role,
      companyId: targetUser.companyId,
    });

    const refreshToken = generateRefreshToken({ userId: targetUser.id });

    await RefreshTokenModel.create({
      userId: targetUser.id,
      token: refreshToken,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30d
    });

    const response = NextResponse.json({
      success: true,
      message: `Now impersonating ${targetUser.name} (${targetUser.company?.name || targetUser.email})`,
      data: {
        accessToken,
        refreshToken,
        user: {
          id: targetUser.id,
          name: targetUser.name,
          email: targetUser.email,
          role: targetUser.role,
          company: targetUser.company,
        },
        originalAdminUser: {
          id: adminUser.id,
          name: adminUser.name,
          email: adminUser.email,
          role: adminUser.role,
        },
        impersonatedCompany: targetUser.company,
      },
    });

    // Set auth cookies for immediate session switch
    response.cookies.set('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 3600,
    });

    response.cookies.set('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60,
    });

    return response;
  } catch (error: any) {
    console.error('Admin impersonate error:', error);
    return NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: error?.message || 'Failed to impersonate user' },
      { status: 500 }
    );
  }
}
