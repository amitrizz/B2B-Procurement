import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, authErrorResponse } from '@/lib/auth';
import crypto from 'crypto';

export async function PUT(req: NextRequest) {
    console.log(`[API] ${req.method} ${req.nextUrl?.pathname || req.url}`);
  try {
    const user = await getAuthUser(req);
    if (!user || !user.companyId) return authErrorResponse();

    const { accountName, ifsc, accountNumber } = await req.json();

    if (!accountName || !ifsc || !accountNumber) {
      return console.log(`[API Response] /api/v1/company/me/bank - Sending response`), NextResponse.json(
        { success: false, code: 'BAD_REQUEST', message: 'Missing required bank details' },
        { status: 400 }
      );
    }

    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    if (!ifscRegex.test(ifsc)) {
      return console.log(`[API Response] /api/v1/company/me/bank - Sending response`), NextResponse.json(
        { success: false, code: 'INVALID_IFSC', message: 'Invalid IFSC format' },
        { status: 400 }
      );
    }

    const digitsOnly = accountNumber.replace(/\D/g, '');
    if (digitsOnly.length < 4) {
      return console.log(`[API Response] /api/v1/company/me/bank - Sending response`), NextResponse.json(
        { success: false, code: 'INVALID_ACCOUNT', message: 'Invalid account number' },
        { status: 400 }
      );
    }

    const last4 = digitsOnly.slice(-4);
    
    // Hash account number with pepper
    const pepper = process.env.BANK_HASH_PEPPER || process.env.JWT_SECRET || 'default-pepper';
    const hash = crypto.createHash('sha256').update(digitsOnly + pepper).digest('hex');

    await db();
    const { CompanyBankAccount } = await import('@/models/Company');

    const bankAccountDoc = await CompanyBankAccount.findOneAndUpdate(
      { companyId: user.companyId },
      {
        $set: {
          accountName,
          ifsc,
          accountNumberLast4: last4,
          accountNumberHash: hash,
          verified: false,
        }
      },
      { new: true, upsert: true }
    ).lean() as any;

    const bankAccount = { ...bankAccountDoc, id: bankAccountDoc._id.toString() };

    // Don't return the hash
    const { accountNumberHash, ...safeBankAccount } = bankAccount;

    return console.log(`[API Response] /api/v1/company/me/bank - Sending response`), NextResponse.json({
      success: true,
      message: 'Bank details updated successfully',
      data: safeBankAccount,
    });
  } catch (error: any) {
    console.error('Update bank error:', error);
    return console.log(`[API Response] /api/v1/company/me/bank - Sending response`), NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  console.log(`[API] ${req.method} ${req.nextUrl?.pathname || req.url}`);
  try {
    const user = await getAuthUser(req);
    if (!user || !user.companyId) return authErrorResponse();

    await db();
    const { CompanyBankAccount } = await import('@/models/Company');

    const bankAccountDoc = await CompanyBankAccount.findOne({ companyId: user.companyId }).lean() as any;

    if (!bankAccountDoc) {
      return console.log(`[API Response] /api/v1/company/me/bank - Sending response`), NextResponse.json({
        success: true,
        data: null,
      });
    }

    const bankAccount = { ...bankAccountDoc, id: bankAccountDoc._id.toString() };

    // Don't return the hash
    const { accountNumberHash, ...safeBankAccount } = bankAccount;

    return console.log(`[API Response] /api/v1/company/me/bank - Sending response`), NextResponse.json({
      success: true,
      data: safeBankAccount,
    });
  } catch (error: any) {
    console.error('Get bank error:', error);
    return console.log(`[API Response] /api/v1/company/me/bank - Sending response`), NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: 'Internal server error' },
      { status: 500 }
    );
  }
}
