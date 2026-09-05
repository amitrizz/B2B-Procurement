import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, authErrorResponse } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    console.log(`[API] ${req.method} ${req.nextUrl?.pathname || req.url}`);
  try {
    const user = await getAuthUser(req);
    if (!user || !user.companyId) return authErrorResponse();

    await db();
    const { Company, CompanyAddress, CompanyDocument, CompanyBankAccount } = await import('@/models/Company');

    const companyDoc = await Company.findById(user.companyId).lean() as any;

    if (!companyDoc) {
      console.log(`[API] /company/me - Error: Company ${user.companyId} not found in DB`);
      return console.log(`[API Response] /api/v1/company/me - Sending response`), NextResponse.json({ success: false, code: 'COMPANY_NOT_FOUND', message: 'Company not found' }, { status: 404 });
    }

    const addresses = await CompanyAddress.find({ companyId: user.companyId }).lean();
    const documents = await CompanyDocument.find({ companyId: user.companyId }).lean();
    const bankAccount = await CompanyBankAccount.findOne({ companyId: user.companyId }).lean() as any;

    const company = {
      ...companyDoc,
      id: companyDoc._id.toString(),
      addresses: addresses.map((a: any) => ({ ...a, id: a._id.toString() })),
      documents: documents.map((d: any) => ({ ...d, id: d._id.toString() })),
      bankAccount: bankAccount ? { ...bankAccount, id: bankAccount._id.toString() } : null
    };

    console.log(`[API] /company/me - Success: Returning company details`);
    return console.log(`[API Response] /api/v1/company/me - Sending response`), NextResponse.json({
      success: true,
      data: company,
    });
  } catch (error: any) {
    if (error.name === 'DatabaseConnectionError') {
      return console.log(`[API Response] /api/v1/company/me - Sending response`), NextResponse.json(
        { success: false, code: 'DATABASE_UNREACHABLE', message: 'Database server is unreachable' },
        { status: 503 }
      );
    }
    console.error(`[API Error] /api/v1/company/me (GET):`, error.message);
    return console.log(`[API Response] /api/v1/company/me - Sending response`), NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  console.log(`[API] ${req.method} ${req.nextUrl?.pathname || req.url}`);
  try {
    const user = await getAuthUser(req);
    if (!user || !user.companyId) return authErrorResponse();

    const { name, gstin, pan, phone, address } = await req.json();

    await db();
    const { Company, CompanyAddress } = await import('@/models/Company');

    const companyToUpdate = await Company.findById(user.companyId).lean() as any;
    if (!companyToUpdate) return authErrorResponse();

    // Check if GSTIN is already in use by another company
    if (gstin && gstin !== companyToUpdate.gstin) {
      if (companyToUpdate.status === 'VERIFIED') {
        return console.log(`[API Response] /api/v1/company/me - Sending response`), NextResponse.json(
          { success: false, code: 'FORBIDDEN', message: 'Cannot change GSTIN after verification' },
          { status: 403 }
        );
      }

      const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
      if (!gstinRegex.test(gstin)) {
        return console.log(`[API Response] /api/v1/company/me - Sending response`), NextResponse.json(
          { success: false, code: 'INVALID_GSTIN', message: 'Please provide a valid 15-character GSTIN format' },
          { status: 400 }
        );
      }

      const existingCompanyWithGstin = await Company.findOne({
        gstin,
        _id: { $ne: user.companyId },
      }).lean();

      if (existingCompanyWithGstin) {
        return console.log(`[API Response] /api/v1/company/me - Sending response`), NextResponse.json(
          { success: false, code: 'GSTIN_CONFLICT', message: 'GSTIN is already in use by another company' },
          { status: 400 }
        );
      }
    }

    if (pan) {
      const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
      if (!panRegex.test(pan)) {
        return console.log(`[API Response] /api/v1/company/me - Sending response`), NextResponse.json(
          { success: false, code: 'INVALID_PAN', message: 'Invalid PAN format' },
          { status: 400 }
        );
      }
    }

    const mongoose = (await import('mongoose')).default;
    const session = await mongoose.startSession();
    let updatedCompanyDoc;
    
    try {
      session.startTransaction();

      updatedCompanyDoc = await Company.findByIdAndUpdate(
        user.companyId,
        {
          ...(name && { name }),
          ...(gstin && companyToUpdate.status !== 'VERIFIED' && { gstin }),
          ...(pan && { pan }),
          ...(phone && { phone }),
        },
        { new: true, session }
      ).lean() as any;

      await session.commitTransaction();
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }

    const updatedCompany = {
      ...updatedCompanyDoc,
      id: updatedCompanyDoc._id.toString()
    };

    return console.log(`[API Response] /api/v1/company/me - Sending response`), NextResponse.json({
      success: true,
      message: 'Company profile updated successfully',
      data: updatedCompany,
    });
  } catch (error: any) {
    console.error('Update company error:', error);
    return console.log(`[API Response] /api/v1/company/me - Sending response`), NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: 'Internal server error' },
      { status: 500 }
    );
  }
}
