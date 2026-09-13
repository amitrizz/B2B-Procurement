import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import jwt from 'jsonwebtoken';

export async function POST(req: NextRequest) {
  console.log(`[API] ${req.method} ${req.nextUrl?.pathname || req.url}`);
  try {
    const { email, password, name, gstin, pan, phone, addressLine1, city, state, pincode, role, inviteToken } = await req.json();

    if (!email || !password || !name) {
      return NextResponse.json(
        { success: false, code: 'BAD_REQUEST', message: 'Missing required fields (email, password, name)' },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();

    await db();
    const { User } = await import('@/models/User');
    const { Company } = await import('@/models/Company');
    const { AuthOtp } = await import('@/models/AuthOtp');

    // 1. Check if email already exists
    const existingUser = await User.findOne({ email: cleanEmail }).lean();
    if (existingUser) {
      return NextResponse.json(
        { success: false, code: 'EMAIL_EXISTS', message: 'Email is already registered' },
        { status: 400 }
      );
    }

    let payload: any = {};

    if (inviteToken) {
      console.log(`[API] /register - Invite Flow for ${cleanEmail}`);
      const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';
      let decoded: any;
      try {
        decoded = jwt.verify(inviteToken, JWT_SECRET);
      } catch (err) {
        return NextResponse.json(
          { success: false, code: 'INVALID_TOKEN', message: 'Invalid or expired invite token' },
          { status: 400 }
        );
      }

      if (decoded.email?.toLowerCase() !== cleanEmail) {
        return NextResponse.json(
          { success: false, code: 'EMAIL_MISMATCH', message: 'Email does not match invite' },
          { status: 400 }
        );
      }

      payload = {
        isInvite: true,
        email: cleanEmail,
        name: name.trim(),
        passwordHash: hashPassword(password),
        role: decoded.role || 'MEMBER',
        companyId: decoded.companyId
      };
    } else {
      console.log(`[API] /register - Standard Flow for ${cleanEmail}`);
      if (!gstin || !pan || !phone || !addressLine1 || !city || !state || !pincode) {
        return NextResponse.json(
          { success: false, code: 'BAD_REQUEST', message: 'Missing required company or address fields' },
          { status: 400 }
        );
      }

      const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
      if (!panRegex.test(pan.toUpperCase())) {
        return NextResponse.json(
          { success: false, code: 'BAD_REQUEST', message: 'Invalid PAN format' },
          { status: 400 }
        );
      }

      const existingCompany = await Company.findOne({ gstin: gstin.toUpperCase().trim() }).lean();
      if (existingCompany) {
        return NextResponse.json(
          { success: false, code: 'GSTIN_EXISTS', message: 'GSTIN is already registered' },
          { status: 400 }
        );
      }

      payload = {
        isInvite: false,
        email: cleanEmail,
        name: name.trim(),
        passwordHash: hashPassword(password),
        gstin: gstin.toUpperCase().trim(),
        pan: pan.toUpperCase().trim(),
        phone: phone.trim(),
        addressLine1: addressLine1.trim(),
        city: city.trim(),
        state: state.trim(),
        pincode: pincode.trim(),
        role: role || 'OWNER'
      };
    }

    // Generate 6-digit OTP for Registration Verification
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await AuthOtp.findOneAndUpdate(
      { email: cleanEmail, type: 'REGISTER' },
      { $set: { otp, payload, expiresAt } },
      { upsert: true, new: true }
    );

    // Prominently print OTP on backend terminal console
    console.log('\n' + '='.repeat(54));
    console.log('  📝 [REGISTRATION OTP GENERATED]');
    console.log(`  👤 Email   : ${cleanEmail}`);
    console.log(`  🏢 Name    : ${name}`);
    console.log(`  🔑 OTP CODE: \x1b[1m\x1b[32m${otp}\x1b[0m`);
    console.log(`  ⏰ Expires : 10 minutes`);
    console.log('='.repeat(54) + '\n');

    // Send OTP via email
    const { sendOtpEmail } = await import('@/lib/email');
    const emailResult = await sendOtpEmail({ to: cleanEmail, otp, type: 'REGISTER' });

    return NextResponse.json({
      success: true,
      requireOtp: true,
      email: cleanEmail,
      emailSent: emailResult.sent,
      message: emailResult.sent 
        ? 'Verification OTP sent to your email address.' 
        : 'Verification OTP generated. Please enter OTP to complete registration.'
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: 'Internal server error during registration' },
      { status: 500 }
    );
  }
}
