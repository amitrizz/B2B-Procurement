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
    const { isActive } = await req.json();

    if (typeof isActive !== 'boolean') {
      return console.log(`[API Response] /api/v1/admin/companies/[id]/toggle-active - Sending response`), NextResponse.json(
        { success: false, code: 'BAD_REQUEST', message: 'isActive must be a boolean.' },
        { status: 400 }
      );
    }

    await db();
    const { Company } = await import('@/models/Company');

    const companyDoc = await Company.findByIdAndUpdate(
      id,
      { $set: { isActive } },
      { new: true }
    ).lean() as any;

    if (!companyDoc) {
       return console.log(`[API Response] /api/v1/admin/companies/[id]/toggle-active - Sending response`), NextResponse.json(
        { success: false, code: 'NOT_FOUND', message: 'Company not found' },
        { status: 404 }
      );
    }

    const company = { ...companyDoc, id: companyDoc._id.toString() };

    await audit({
      actorUserId: user.id,
      action: isActive ? 'COMPANY_ACTIVATED' : 'COMPANY_DEACTIVATED',
      entityType: 'COMPANY',
      entityId: id,
      payload: { isActive }
    });

    return console.log(`[API Response] /api/v1/admin/companies/[id]/toggle-active - Sending response`), NextResponse.json({
      success: true,
      message: `Company marked as ${isActive ? 'active' : 'inactive'}`,
      data: company,
    });
  } catch (error: any) {
    console.error('Toggle company active error:', error);
    return console.log(`[API Response] /api/v1/admin/companies/[id]/toggle-active - Sending response`), NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: 'Internal server error' },
      { status: 500 }
    );
  }
}
