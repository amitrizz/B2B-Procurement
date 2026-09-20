import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, authErrorResponse } from '@/lib/auth';

type Params = {
  params: Promise<{ id: string }>;
};

export async function DELETE(req: NextRequest, { params }: Params) {
  console.log(`[API] ${req.method} ${req.nextUrl?.pathname || req.url}`);
  try {
    const user = await getAuthUser(req);
    if (!user || !user.companyId) return authErrorResponse();

    const { id } = await params;

    await db();
    const { CompanyMachine } = await import('@/models/Company');

    const machine = await CompanyMachine.findOne({ _id: id, companyId: user.companyId });
    if (!machine) {
      return NextResponse.json({ success: false, message: 'Machine entry not found' }, { status: 404 });
    }

    await CompanyMachine.deleteOne({ _id: id });

    return NextResponse.json({
      success: true,
      message: 'Machine removed from company fleet'
    });
  } catch (error: any) {
    console.error(`[API Error] /api/v1/company/me/machines/[id] (DELETE):`, error.message);
    return NextResponse.json({ success: false, message: error.message || 'Server error' }, { status: 500 });
  }
}
