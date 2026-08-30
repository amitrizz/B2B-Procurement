import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, authErrorResponse } from '@/lib/auth';
import { audit } from '@/lib/audit';

type Params = {
  params: Promise<{ id: string }>
}

export async function POST(req: NextRequest, { params }: Params) {
    console.log(`[API] ${req.method} ${req.nextUrl?.pathname || req.url}`);
  try {
    const user = await getAuthUser(req);
    if (!user || user.role !== 'PLATFORM_ADMIN') return authErrorResponse();

    const { id } = await params;
    const { reason } = await req.json();

    if (!reason || reason.length < 10) {
      return console.log(`[API Response] /api/v1/admin/companies/[id]/suspend - Sending response`), NextResponse.json(
        { success: false, code: 'BAD_REQUEST', message: 'Suspension reason must be at least 10 characters long.' },
        { status: 400 }
      );
    }

    await db();
    const { Company } = await import('@/models/Company');

    const companyDoc = await Company.findByIdAndUpdate(
      id,
      { $set: { status: 'SUSPENDED' } },
      { new: true }
    ).lean() as any;

    if (!companyDoc) {
       return console.log(`[API Response] /api/v1/admin/companies/[id]/suspend - Sending response`), NextResponse.json(
        { success: false, code: 'NOT_FOUND', message: 'Company not found' },
        { status: 404 }
      );
    }

    const company = { ...companyDoc, id: companyDoc._id.toString() };

    await audit({
      actorUserId: user.id,
      action: 'KYC_SUSPENDED',
      entityType: 'COMPANY',
      entityId: id,
      payload: { reason }
    });

    const { broadcastCompanyUpdate } = await import('@/lib/companyEvents');
    await broadcastCompanyUpdate(id, 'company_updated', `Your company account has been suspended. Reason: ${reason}`);

    return console.log(`[API Response] /api/v1/admin/companies/[id]/suspend - Sending response`), NextResponse.json({
      success: true,
      message: 'Company suspended successfully',
      data: company,
    });
  } catch (error: any) {
    console.error('Suspend company error:', error);
    return console.log(`[API Response] /api/v1/admin/companies/[id]/suspend - Sending response`), NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: 'Internal server error' },
      { status: 500 }
    );
  }
}
