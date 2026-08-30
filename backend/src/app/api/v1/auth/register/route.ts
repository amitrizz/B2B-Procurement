import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import jwt from 'jsonwebtoken';

export async function POST(req: NextRequest) {
    console.log(`[API] ${req.method} ${req.nextUrl?.pathname || req.url}`);
  try {
    const { email, password, name, gstin, pan, phone, addressLine1, city, state, pincode, role, inviteToken } = await req.json();

    console.log(`[API] /register - Step 1: Validating payload for ${email}`);
    if (inviteToken) {
      console.log(`[API] /register - Step 2 (Invite Flow): Validating basic fields`);
      if (!email || !password || !name) {
        console.log(`[API] /register - Error (Invite Flow): Missing basic fields`);
        return console.log(`[API Response] /api/v1/auth/register - Sending response`), NextResponse.json({ success: false, code: 'BAD_REQUEST', message: 'Missing required fields' }, { status: 400 });
      }

      console.log(`[API] /register - Step 3 (Invite Flow): Verifying JWT invite token`);
      const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';
      let decoded: any;
      try {
        decoded = jwt.verify(inviteToken, JWT_SECRET);
      } catch (err) {
        console.log(`[API] /register - Error (Invite Flow): JWT verification failed - ${err}`);
        return console.log(`[API Response] /api/v1/auth/register - Sending response`), NextResponse.json({ success: false, code: 'INVALID_TOKEN', message: 'Invalid or expired invite token' }, { status: 400 });
      }

      console.log(`[API] /register - Step 4 (Invite Flow): Matching email ${email} against decoded token ${decoded.email}`);
      if (decoded.email !== email) {
        console.log(`[API] /register - Error (Invite Flow): Email does not match invite`);
        return console.log(`[API Response] /api/v1/auth/register - Sending response`), NextResponse.json({ success: false, code: 'EMAIL_MISMATCH', message: 'Email does not match invite' }, { status: 400 });
      }

      await db();
      const { User } = await import('@/models/User');

      console.log(`[API] /register - Step 5 (Invite Flow): Checking if user ${email} already exists`);
      const existingUser = await User.findOne({ email }).lean();
      if (existingUser) {
        console.log(`[API] /register - Error (Invite Flow): User ${email} already exists`);
        return console.log(`[API Response] /api/v1/auth/register - Sending response`), NextResponse.json({ success: false, code: 'EMAIL_EXISTS', message: 'Email is already registered' }, { status: 400 });
      }

      console.log(`[API] /register - Step 6 (Invite Flow): Creating user for existing company ${decoded.companyId}`);
      const userDoc = await User.create({
        email,
        passwordHash: hashPassword(password),
        role: decoded.role,
        companyId: decoded.companyId,
        emailVerified: true, // Auto verify since they were invited
        name
      });
      const user = { ...userDoc.toObject(), id: userDoc._id.toString() };

      console.log(`[API] /register - Success (Invite Flow): User linked to company ${user.companyId}`);
      return console.log(`[API Response] /api/v1/auth/register - Sending response`), NextResponse.json({
        success: true,
        message: 'Registration via invite successful',
        data: { userId: user.id, companyId: user.companyId }
      });
    }

    console.log(`[API] /register - Step 2 (Standard Flow): Validating all fields`);
    if (!email || !password || !name || !gstin || !pan || !phone || !addressLine1 || !city || !state || !pincode) {
      console.log(`[API] /register - Error (Standard Flow): Missing fields`);
      return console.log(`[API Response] /api/v1/auth/register - Sending response`), NextResponse.json(
        { success: false, code: 'BAD_REQUEST', message: 'Missing required fields' },
        { status: 400 }
      );
    }

    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
    if (!panRegex.test(pan)) {
      console.log(`[API] /register - Error: Invalid PAN format ${pan}`);
      return console.log(`[API Response] /api/v1/auth/register - Sending response`), NextResponse.json(
        { success: false, code: 'BAD_REQUEST', message: 'Invalid PAN format' },
        { status: 400 }
      );
    }

    await db();
    const { User } = await import('@/models/User');
    const { Company, CompanyAddress } = await import('@/models/Company');

    console.log(`[API] /register - Step 3 (Standard Flow): Checking if email ${email} exists`);
    const existingUser = await User.findOne({ email }).lean();
    if (existingUser) {
      console.log(`[API] /register - Error: Email ${email} already exists`);
      return console.log(`[API Response] /api/v1/auth/register - Sending response`), NextResponse.json(
        { success: false, code: 'EMAIL_EXISTS', message: 'Email is already registered' },
        { status: 400 }
      );
    }

    console.log(`[API] /register - Step 4 (Standard Flow): Checking if GSTIN ${gstin} exists`);
    const existingCompany = await Company.findOne({ gstin }).lean();
    if (existingCompany) {
      console.log(`[API] /register - Error: GSTIN ${gstin} already exists`);
      return console.log(`[API Response] /api/v1/auth/register - Sending response`), NextResponse.json(
        { success: false, code: 'GSTIN_EXISTS', message: 'GSTIN is already registered' },
        { status: 400 }
      );
    }

    console.log(`[API] /register - Step 5 (Standard Flow): Creating company and user in transaction`);
    
    const mongoose = (await import('mongoose')).default;
    const session = await mongoose.startSession();
    let result: any = {};

    try {
      session.startTransaction();

      const companyDoc = await Company.create([{
        gstin,
        name,
        pan,
        phone,
        status: 'PENDING',
      }], { session });
      const company = companyDoc[0];

      await CompanyAddress.create([{
        companyId: company._id,
        state,
        addressLine1,
        city,
        pincode,
        isPrimary: true,
      }], { session });

      const userCount = await User.countDocuments().session(session);
      const userRole = userCount === 0 ? 'PLATFORM_ADMIN' : (role || 'OWNER');

      const userDoc = await User.create([{
        email,
        passwordHash: hashPassword(password),
        role: userRole,
        companyId: company._id,
        emailVerified: false,
        name
      }], { session });
      const user = userDoc[0];

      await session.commitTransaction();

      result = {
        company: { id: company._id.toString() },
        user: { id: user._id.toString() }
      };
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }

    console.log(`[AUTH] Verification token for ${email}: (Token logic to be implemented)`);

    return console.log(`[API Response] /api/v1/auth/register - Sending response`), NextResponse.json({
      success: true,
      message: 'Registration successful',
      data: {
        userId: result.user.id,
        companyId: result.company.id,
      },
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    return console.log(`[API Response] /api/v1/auth/register - Sending response`), NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: 'Internal server error' },
      { status: 500 }
    );
  }
}
