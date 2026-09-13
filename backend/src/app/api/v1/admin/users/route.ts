import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, authErrorResponse } from '@/lib/auth';

export async function GET(req: NextRequest) {
    console.log(`[API] ${req.method} ${req.nextUrl?.pathname || req.url}`);
  try {
    const user = await getAuthUser(req);
    if (!user || user.role !== 'PLATFORM_ADMIN') return authErrorResponse();

    await db();
    const { User } = await import('@/models/User');
    const { AuthOtp } = await import('@/models/AuthOtp');
    await import('@/models/Company');

    const usersDoc = await User.find({})
      .sort({ createdAt: -1 })
      .populate('companyId', 'name status')
      .lean() as any[];

    const userEmails = usersDoc.map(u => u.email?.toLowerCase().trim()).filter(Boolean);
    const activeOtps = await AuthOtp.find({ email: { $in: userEmails } }).lean() as any[];
    const otpMapByEmail = new Map<string, any>();
    for (const record of activeOtps) {
      otpMapByEmail.set(record.email.toLowerCase().trim(), record);
    }

    // Map Mongoose documents back to what the frontend expects
    const users = usersDoc.map(u => {
      const email = u.email?.toLowerCase().trim();
      const pendingOtp = otpMapByEmail.get(email);
      let latestOtp = null;

      if (pendingOtp) {
        const isExpired = Date.now() > new Date(pendingOtp.expiresAt).getTime();
        latestOtp = {
          code: pendingOtp.otp,
          type: pendingOtp.type,
          generatedAt: pendingOtp.createdAt || pendingOtp.updatedAt || new Date(),
          expiresAt: pendingOtp.expiresAt,
          status: isExpired ? 'EXPIRED' : 'ACTIVE'
        };
      } else if (u.lastOtp?.code) {
        const isExpired = Date.now() > new Date(u.lastOtp.expiresAt).getTime();
        latestOtp = {
          code: u.lastOtp.code,
          type: u.lastOtp.type,
          generatedAt: u.lastOtp.generatedAt || u.createdAt,
          expiresAt: u.lastOtp.expiresAt,
          status: u.lastOtp.isVerified ? 'VERIFIED' : (isExpired ? 'EXPIRED' : 'ACTIVE'),
          verifiedAt: u.lastOtp.verifiedAt
        };
      }

      return {
        id: u._id.toString(),
        email: u.email,
        name: u.name,
        role: u.role,
        createdAt: u.createdAt,
        latestOtp,
        company: u.companyId ? {
          id: u.companyId._id.toString(),
          name: u.companyId.name,
          status: u.companyId.status
        } : null
      };
    });

    return console.log(`[API Response] /api/v1/admin/users - Sending response`), NextResponse.json({
      success: true,
      data: users,
    });
  } catch (error: any) {
    console.error(`[API Error] /api/v1/admin/users - Failed to fetch users:`, error.message, error.stack);
    return console.log(`[API Response] /api/v1/admin/users - Sending response`), NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
