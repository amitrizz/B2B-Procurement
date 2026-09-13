import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  console.log(`[API] ${req.method} ${req.nextUrl?.pathname || req.url}`);
  try {
    const { email, type } = await req.json();

    if (!email || !type) {
      return NextResponse.json(
        { success: false, code: 'BAD_REQUEST', message: 'Email and OTP type are required' },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanType = type.toString().toUpperCase();

    if (!['LOGIN', 'REGISTER'].includes(cleanType)) {
      return NextResponse.json(
        { success: false, code: 'BAD_REQUEST', message: 'Invalid OTP type' },
        { status: 400 }
      );
    }

    await db();
    const { AuthOtp } = await import('@/models/AuthOtp');
    const { User } = await import('@/models/User');

    if (cleanType === 'LOGIN') {
      const user = await User.findOne({ email: cleanEmail }).lean();
      if (!user) {
        return NextResponse.json(
          { success: false, code: 'USER_NOT_FOUND', message: 'User not found' },
          { status: 404 }
        );
      }
    } else if (cleanType === 'REGISTER') {
      const pendingRecord = await AuthOtp.findOne({ email: cleanEmail, type: 'REGISTER' }).lean();
      if (!pendingRecord) {
        return NextResponse.json(
          { success: false, code: 'NOT_FOUND', message: 'No pending registration found. Please register again.' },
          { status: 404 }
        );
      }
    }

    // Generate fresh 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await AuthOtp.findOneAndUpdate(
      { email: cleanEmail, type: cleanType },
      { $set: { otp, expiresAt } },
      { upsert: true, new: true }
    );

    // Prominently print to backend terminal console
    console.log('\n' + '='.repeat(54));
    console.log(`  🔄 [RESENT ${cleanType} OTP]`);
    console.log(`  👤 Email   : ${cleanEmail}`);
    console.log(`  🔑 OTP CODE: \x1b[1m\x1b[32m${otp}\x1b[0m`);
    console.log(`  ⏰ Expires : 10 minutes`);
    console.log('='.repeat(54) + '\n');

    // Send OTP via email
    const { sendOtpEmail } = await import('@/lib/email');
    const emailResult = await sendOtpEmail({ to: cleanEmail, otp, type: cleanType as any });

    return NextResponse.json({
      success: true,
      emailSent: emailResult.sent,
      message: emailResult.sent 
        ? 'New OTP has been sent to your email address.' 
        : 'New OTP generated. Check backend console.'
    });
  } catch (error: any) {
    console.error('Resend OTP error:', error);
    return NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: 'Internal server error while resending OTP' },
      { status: 500 }
    );
  }
}
