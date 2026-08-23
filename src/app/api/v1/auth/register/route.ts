import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { email, password, name, gstin, role } = await req.json();

    if (!email || !password || !name || !gstin) {
      return NextResponse.json(
        { success: false, code: 'BAD_REQUEST', message: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { email },
    });
    if (existingUser) {
      return NextResponse.json(
        { success: false, code: 'EMAIL_EXISTS', message: 'Email is already registered' },
        { status: 400 }
      );
    }

    // Check if GSTIN already exists
    const existingCompany = await db.company.findUnique({
      where: { gstin },
    });
    if (existingCompany) {
      return NextResponse.json(
        { success: false, code: 'GSTIN_EXISTS', message: 'GSTIN is already registered' },
        { status: 400 }
      );
    }

    // Create Company and User in a transaction
    const result = await db.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          gstin,
          name,
          status: 'PENDING',
        },
      });

      // Auto-generate primary address to satisfy RFQ publishing requirements
      await tx.companyAddress.create({
        data: {
          companyId: company.id,
          state: 'Maharashtra',
          addressLine1: 'Primary Business Office',
          city: 'Mumbai',
          pincode: '400001',
          isPrimary: true,
        },
      });

      const user = await tx.user.create({
        data: {
          email,
          passwordHash: hashPassword(password),
          role: role || 'OWNER',
          companyId: company.id,
        },
      });

      return { company, user };
    });

    return NextResponse.json({
      success: true,
      message: 'Registration successful',
      data: {
        userId: result.user.id,
        companyId: result.company.id,
      },
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: 'Internal server error' },
      { status: 500 }
    );
  }
}
