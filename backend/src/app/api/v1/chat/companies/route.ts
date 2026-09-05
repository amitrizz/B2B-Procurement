import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { chatAuthError } from '@/lib/chatHelpers';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    const authErr = chatAuthError(user);
    if (authErr) return authErr;

    await db();
    const { Company } = await import('@/models/Company');

    const companies = await Company.find({
      _id: { $ne: user!.companyId },
      status: 'VERIFIED',
      isActive: { $ne: false },
    })
      .sort({ name: 1 })
      .select('name gstin status')
      .lean();

    const data = companies.map((c: any) => ({
      id: c._id.toString(),
      name: c.name,
      gstin: c.gstin,
    }));

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('List chat companies error:', error);
    return NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
