import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, authErrorResponse } from '@/lib/auth';
import jwt from 'jsonwebtoken';

export async function POST(req: NextRequest) {
    console.log(`[API] ${req.method} ${req.nextUrl?.pathname || req.url}`);
  try {
    const user = await getAuthUser(req);
    // Only OWNER or PLATFORM_ADMIN can invite
    if (!user || !user.companyId || (user.role !== 'OWNER' && user.role !== 'PLATFORM_ADMIN')) {
      return authErrorResponse();
    }

    const { email, role } = await req.json();

    if (!email || !role) {
      return console.log(`[API Response] /api/v1/company/invites - Sending response`), NextResponse.json({ success: false, code: 'BAD_REQUEST', message: 'Email and role are required' }, { status: 400 });
    }

    const validRoles = ['OWNER', 'PROCUREMENT', 'FINANCE', 'TRANSPORTER'];
    if (!validRoles.includes(role)) {
      return console.log(`[API Response] /api/v1/company/invites - Sending response`), NextResponse.json({ success: false, code: 'INVALID_ROLE', message: 'Invalid role' }, { status: 400 });
    }

    await db();
    const { User } = await import('@/models/User');

    // Check if user already exists
    const existingUser = await User.findOne({ email }).lean() as any;
    if (existingUser) {
      return console.log(`[API Response] /api/v1/company/invites - Sending response`), NextResponse.json({ success: false, code: 'ALREADY_EXISTS', message: 'User already exists' }, { status: 400 });
    }

    const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';
    
    // Create an invite token
    const token = jwt.sign(
      { email, role, companyId: user.companyId },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // In a real app, send email here
    console.log(`Invite link: http://localhost:3000/?inviteToken=${token}`);

    return console.log(`[API Response] /api/v1/company/invites - Sending response`), NextResponse.json({
      success: true,
      message: 'Invite sent successfully',
      data: { token }
    });

  } catch (error: any) {
    console.error('Invite error:', error);
    return console.log(`[API Response] /api/v1/company/invites - Sending response`), NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: 'Internal server error' },
      { status: 500 }
    );
  }
}
