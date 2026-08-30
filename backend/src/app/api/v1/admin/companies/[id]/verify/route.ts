import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, authErrorResponse } from '@/lib/auth';

type Params = {
  params: Promise<{ id: string }>
}

export async function POST(req: NextRequest, { params }: Params) {
    console.log(`[API] ${req.method} ${req.nextUrl?.pathname || req.url}`);
  try {
    const user = await getAuthUser(req);
    if (!user || user.role !== 'PLATFORM_ADMIN') return authErrorResponse();

    const { id } = await params;

    await db();
    const { Company, CompanyDocument } = await import('@/models/Company');

    const docCount = await CompanyDocument.countDocuments({ companyId: id });

    if (docCount < 4) {
      return console.log(`[API Response] /api/v1/admin/companies/[id]/verify - Sending response`), NextResponse.json(
        { success: false, code: 'KYC_DOCS_INCOMPLETE', message: 'Company has not uploaded all 4 required KYC documents.' },
        { status: 400 }
      );
    }

    const companyDoc = await Company.findByIdAndUpdate(
      id,
      { 
        $set: {
          status: 'VERIFIED',
          kycRejectReason: null,
        }
      },
      { new: true }
    ).lean() as any;

    if (!companyDoc) {
      return console.log(`[API Response] /api/v1/admin/companies/[id]/verify - Sending response`), NextResponse.json(
        { success: false, code: 'NOT_FOUND', message: 'Company not found' },
        { status: 404 }
      );
    }

    const company = { ...companyDoc, id: companyDoc._id.toString() };

    const { audit } = await import('@/lib/audit');
    await audit({
      actorUserId: user.id,
      action: 'KYC_VERIFIED',
      entityType: 'COMPANY',
      entityId: id,
      payload: { docCount }
    });

    return console.log(`[API Response] /api/v1/admin/companies/[id]/verify - Sending response`), NextResponse.json({
      success: true,
      message: 'Company verified successfully',
      data: company,
    });
  } catch (error: any) {
    console.error('Verify company error:', error);
    return console.log(`[API Response] /api/v1/admin/companies/[id]/verify - Sending response`), NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: 'Internal server error' },
      { status: 500 }
    );
  }
}
