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
    const { Company, CompanyAddress } = await import('@/models/Company');

    const otpRecord = await AuthOtp.findOne({
      email: cleanEmail,
      type: 'REGISTER'
    }).lean() as any;

    if (!otpRecord) {
      return NextResponse.json(
        { success: false, code: 'INVALID_OTP', message: 'No pending registration found for this email. Please register again.' },
        { status: 400 }
      );
    }

    if (new Date() > new Date(otpRecord.expiresAt)) {
      await AuthOtp.deleteOne({ _id: otpRecord._id });
      return NextResponse.json(
        { success: false, code: 'EXPIRED_OTP', message: 'OTP has expired. Please register again.' },
        { status: 400 }
      );
    }

    if (otpRecord.otp !== cleanOtp) {
      return NextResponse.json(
        { success: false, code: 'INVALID_OTP', message: 'Incorrect OTP code. Please try again.' },
        { status: 400 }
      );
    }

    const payload = otpRecord.payload;
    if (!payload) {
      return NextResponse.json(
        { success: false, code: 'INVALID_PAYLOAD', message: 'Registration data missing or corrupted.' },
        { status: 400 }
      );
    }

    // OTP verified - delete from database
    await AuthOtp.deleteOne({ _id: otpRecord._id });

    let userResult: any = null;
    let companyResult: any = null;

    if (payload.isInvite) {
      console.log(`[API] /verify-register-otp - Finalizing invite registration for ${cleanEmail}`);
      const userDoc = await User.create({
        email: cleanEmail,
        passwordHash: payload.passwordHash,
        role: payload.role || 'MEMBER',
        companyId: payload.companyId,
        emailVerified: true,
        name: payload.name,
        lastOtp: {
          code: cleanOtp,
          type: 'REGISTER',
          generatedAt: otpRecord.createdAt || new Date(),
          expiresAt: otpRecord.expiresAt,
          isVerified: true,
          verifiedAt: new Date()
        }
      });
      userResult = { ...userDoc.toObject(), id: userDoc._id.toString() };
      
      const compDoc = await Company.findById(payload.companyId).lean() as any;
      companyResult = compDoc ? {
        id: compDoc._id.toString(),
        name: compDoc.name,
        gstin: compDoc.gstin,
        status: compDoc.status
      } : null;
    } else {
      console.log(`[API] /verify-register-otp - Creating company & user for ${cleanEmail}`);
      const mongoose = (await import('mongoose')).default;
      const session = await mongoose.startSession();

      try {
        session.startTransaction();

        const companyDocs = await Company.create([{
          gstin: payload.gstin,
          name: payload.name,
          pan: payload.pan,
          phone: payload.phone,
          status: 'PENDING',
        }], { session });
        const company = companyDocs[0];

        await CompanyAddress.create([{
          companyId: company._id,
          state: payload.state,
          addressLine1: payload.addressLine1,
          city: payload.city,
          pincode: payload.pincode,
          isPrimary: true,
        }], { session });

        const userCount = await User.countDocuments().session(session);
        const userRole = userCount === 0 ? 'PLATFORM_ADMIN' : (payload.role || 'OWNER');

        const userDocs = await User.create([{
          email: cleanEmail,
          passwordHash: payload.passwordHash,
          role: userRole,
          companyId: company._id,
          emailVerified: true,
          name: payload.name,
          lastOtp: {
            code: cleanOtp,
            type: 'REGISTER',
            generatedAt: otpRecord.createdAt || new Date(),
            expiresAt: otpRecord.expiresAt,
            isVerified: true,
            verifiedAt: new Date()
          }
        }], { session });
        const user = userDocs[0];

        await session.commitTransaction();

        userResult = {
          id: user._id.toString(),
          email: user.email,
          role: user.role,
          companyId: company._id.toString()
        };
        companyResult = {
          id: company._id.toString(),
          name: company.name,
          gstin: company.gstin,
          status: company.status
        };
      } catch (err) {
        await session.abortTransaction();
        throw err;
      } finally {
        session.endSession();
      }
    }

    console.log(`[AUTH] Registration OTP verified. User created and authenticated: ${cleanEmail}`);

    const accessToken = generateAccessToken({
      userId: userResult.id,
      role: userResult.role,
      companyId: userResult.companyId,
    });

    const refreshToken = generateRefreshToken({ userId: userResult.id });

    await RefreshTokenModel.create({
      userId: userResult.id,
      token: refreshToken,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30d
    });

    const response = NextResponse.json({
      success: true,
      message: 'Registration and verification successful',
      data: {
        accessToken,
        refreshToken,
        user: {
          id: userResult.id,
          email: userResult.email,
          role: userResult.role,
          company: companyResult,
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
    console.error('Verify register OTP error:', error);
    return NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: 'Internal server error while finalizing registration' },
      { status: 500 }
    );
  }
}
