import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyPassword, generateAccessToken, generateRefreshToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
    console.log(`[API] ${req.method} ${req.nextUrl?.pathname || req.url}`);
  try {
    const { email, password, loginMethod, requestOtp } = await req.json();

    if (!email) {
      return NextResponse.json(
        { success: false, code: 'BAD_REQUEST', message: 'Email address is required' },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const isOtpLogin = loginMethod === 'otp' || requestOtp || !password;

    console.log(`[API] /login - Method: ${isOtpLogin ? 'OTP' : 'PASSWORD'} for ${cleanEmail}`);

    await db();
    const { User, RefreshToken: RefreshTokenModel } = await import('@/models/User');
    await import('@/models/Company');

    const userDoc = await User.findOne({ email: cleanEmail }).populate('companyId').lean() as any;
    
    // Map Mongoose object to match expected format
    const user = userDoc ? {
      ...userDoc,
      id: userDoc._id.toString(),
      company: userDoc.companyId ? { 
        ...userDoc.companyId, 
        id: userDoc.companyId._id.toString() 
      } : null
    } : null;

    if (!user) {
      return NextResponse.json(
        { success: false, code: 'INVALID_CREDENTIALS', message: 'No account found with this email address' },
        { status: 401 }
      );
    }

    // --- OPTION 1: SIGN IN WITH OTP ---
    if (isOtpLogin) {
      // Generate 6-digit numeric OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      const { AuthOtp } = await import('@/models/AuthOtp');
      await AuthOtp.findOneAndUpdate(
        { email: cleanEmail, type: 'LOGIN' },
        { $set: { otp, expiresAt } },
        { upsert: true, new: true }
      );

      // Prominently print OTP on backend terminal console
      console.log('\n' + '='.repeat(54));
      console.log('  🔐 [LOGIN OTP GENERATED]');
      console.log(`  👤 Email   : ${cleanEmail}`);
      console.log(`  🔑 OTP CODE: \x1b[1m\x1b[32m${otp}\x1b[0m`);
      console.log(`  ⏰ Expires : 10 minutes`);
      console.log('='.repeat(54) + '\n');

      // Send OTP via email
      const { sendOtpEmail } = await import('@/lib/email');
      const emailResult = await sendOtpEmail({ to: cleanEmail, otp, type: 'LOGIN' });

      return NextResponse.json({
        success: true,
        requireOtp: true,
        email: user.email,
        emailSent: emailResult.sent,
        message: emailResult.sent 
          ? 'OTP code sent to your email address.' 
          : 'OTP code generated. Check backend console to sign in.'
      });
    }

    // --- OPTION 2: SIGN IN WITH PASSWORD ---
    if (!verifyPassword(password, user.passwordHash)) {
      return NextResponse.json(
        { success: false, code: 'INVALID_CREDENTIALS', message: 'Incorrect password. Please try again.' },
        { status: 401 }
      );
    }

    console.log(`[API] /login - Password verified successfully for ${cleanEmail}`);

    const accessToken = generateAccessToken({
      userId: user.id,
      role: user.role,
      companyId: user.companyId,
    });

    const refreshToken = generateRefreshToken({ userId: user.id });

    await RefreshTokenModel.create({
      userId: user.id,
      token: refreshToken,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30d
    });

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

    // Set cookies
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
      maxAge: 30 * 24 * 60 * 60, // 30d
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
