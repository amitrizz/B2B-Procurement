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
    await import('@/models/Company');

    const usersDoc = await User.find({})
      .sort({ createdAt: -1 })
      .populate('companyId', 'name status')
      .lean() as any[];

    // Map Mongoose documents back to what the frontend expects
    const users = usersDoc.map(u => ({
      id: u._id.toString(),
      email: u.email,
      name: u.name,
      role: u.role,
      createdAt: u.createdAt,
      company: u.companyId ? {
        id: u.companyId._id.toString(),
        name: u.companyId.name,
        status: u.companyId.status
      } : null
    }));

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
