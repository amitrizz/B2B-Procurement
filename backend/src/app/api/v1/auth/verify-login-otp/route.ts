import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateAccessToken, generateRefreshToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  console.log(`[API] ${req.method} ${req.nextUrl?.pathname || req.url}`);
  try {
    const { email, otp } = await req.json();

    if (!email || !otp) {
      return NextResponse.json(
        { success: false, code: 'BAD_REQUEST', message: 'Email and OTP are required' },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = otp.toString().trim();

    await db();
    const { AuthOtp } = await import('@/models/AuthOtp');
    const { User, RefreshToken: RefreshTokenModel } = await import('@/models/User');
    await import('@/models/Company');

    const otpRecord = await AuthOtp.findOne({
      email: cleanEmail,
      type: 'LOGIN'
    }).lean() as any;

    if (!otpRecord) {
      return NextResponse.json(
        { success: false, code: 'INVALID_OTP', message: 'No active OTP found. Please request a new OTP.' },
        { status: 400 }
      );
    }

    if (new Date() > new Date(otpRecord.expiresAt)) {
      await AuthOtp.deleteOne({ _id: otpRecord._id });
      return NextResponse.json(
        { success: false, code: 'EXPIRED_OTP', message: 'OTP has expired. Please request a new one.' },
        { status: 400 }
      );
    }

    if (otpRecord.otp !== cleanOtp) {
      return NextResponse.json(
        { success: false, code: 'INVALID_OTP', message: 'Incorrect OTP code. Please try again.' },
        { status: 400 }
      );
    }

    // OTP is valid - delete it so it cannot be reused
    await AuthOtp.deleteOne({ _id: otpRecord._id });

    // Mark lastOtp as verified on User
    await User.updateOne(
      { email: cleanEmail },
      {
        $set: {
          'lastOtp.isVerified': true,
          'lastOtp.verifiedAt': new Date()
        }
      }
    );

    // Fetch user with company details
    const userDoc = await User.findOne({ email: cleanEmail }).populate('companyId').lean() as any;
    if (!userDoc) {
      return NextResponse.json(
        { success: false, code: 'USER_NOT_FOUND', message: 'User account not found' },
        { status: 404 }
      );
    }

    const user = {
      ...userDoc,
      id: userDoc._id.toString(),
      company: userDoc.companyId ? {
        ...userDoc.companyId,
        id: userDoc.companyId._id.toString()
      } : null
    };

    console.log(`[AUTH] Login OTP successfully verified for ${cleanEmail}`);

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
    console.error('Verify login OTP error:', error);
    return NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: 'Internal server error while verifying OTP' },
      { status: 500 }
    );
  }
}
