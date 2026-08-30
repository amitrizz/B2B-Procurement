import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyPassword, generateAccessToken, generateRefreshToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
    console.log(`[API] ${req.method} ${req.nextUrl?.pathname || req.url}`);
  try {
    const { email, password } = await req.json();

    console.log('[API] /login - Step 1: Validating payload');
    if (!email || !password) {
      console.log('[API] /login - Error: Missing email or password');
      return console.log(`[API Response] /api/v1/auth/login - Sending response`), NextResponse.json(
        { success: false, code: 'BAD_REQUEST', message: 'Missing email or password' },
        { status: 400 }
      );
    }

    console.log(`[API] /login - Step 2: Fetching user ${email} from database`);

    await db();
    const { User } = await import('@/models/User');
    await import('@/models/Company');

    const userDoc = await User.findOne({ email }).populate('companyId').lean() as any;
    
    // Map Mongoose object to match expected Prisma format
    const user = userDoc ? {
      ...userDoc,
      id: userDoc._id.toString(),
      company: userDoc.companyId ? { 
        ...userDoc.companyId, 
        id: userDoc.companyId._id.toString() 
      } : null
    } : null;

    if (!user) {
      console.log(`[API] /login - Error: User ${email} not found`);
      return console.log(`[API Response] /api/v1/auth/login - Sending response`), NextResponse.json(
        { success: false, code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
        { status: 401 }
      );
    }

    console.log(`[API] /login - Step 3: Verifying password for ${email}`);
    if (!verifyPassword(password, user.passwordHash)) {
      console.log(`[API] /login - Error: Invalid password for ${email}`);
      return console.log(`[API Response] /api/v1/auth/login - Sending response`), NextResponse.json(
        { success: false, code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
        { status: 401 }
      );
    }

    console.log(`[API] /login - Step 4: Generating tokens for ${email}`);

    const accessToken = generateAccessToken({
      userId: user.id,
      role: user.role,
      companyId: user.companyId,
    });

    const refreshToken = generateRefreshToken({ userId: user.id });

    console.log(`[API] /login - Step 5: Saving refresh token in DB`);
    const { RefreshToken: RefreshTokenModel } = await import('@/models/User');
    await RefreshTokenModel.create({
      userId: user.id,
      token: refreshToken,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
    });

    console.log(`[API] /login - Success: Returning auth response and setting cookies`);

    const response = NextResponse.json({
      success: true,
      message: 'Login successful',
      data: {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          company: user.company ? {
            id: user.company.id,
            name: user.company.name,
            gstin: user.company.gstin,
            status: user.company.status,
          } : null,
        },
      },
    });

    // Set cookie
    response.cookies.set('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 3600, // 1h
    });

    response.cookies.set('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 86400, // 24h
    });

    return response;
  } catch (error: any) {
    console.error('Login error:', error);
    
    let message = 'Internal server error';
    let code = 'SERVER_ERROR';
    let status = 500;

    // Handle Mongoose database connection errors
    if (error.name === 'MongooseServerSelectionError' || error.message?.includes('database connection') || error.message?.includes('unreachable network')) {
      message = 'Unable to connect to the database server. Please try again later.';
      code = 'DATABASE_UNREACHABLE';
      status = 503;
    }

    return console.log(`[API Response] /api/v1/auth/login - Sending response`), NextResponse.json(
      { success: false, code, message },
      { status }
    );
  }
}
