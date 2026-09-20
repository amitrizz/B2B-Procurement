import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, authErrorResponse } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  console.log(`[API] ${req.method} ${req.nextUrl?.pathname || req.url}`);
  try {
    const user = await getAuthUser(req);
    if (!user) return authErrorResponse();

    await db();
    const { MachineMaster } = await import('@/models/Machine');

    const machines = await MachineMaster.find({ isActive: true }).sort({ name: 1 }).lean();

    return NextResponse.json({
      success: true,
      data: machines.map((m: any) => ({
        id: m._id.toString(),
        name: m.name,
        model: m.model || '',
        description: m.description || ''
      }))
    });
  } catch (error: any) {
    console.error(`[API Error] /api/v1/machines (GET):`, error.message);
    return NextResponse.json({ success: false, message: error.message || 'Server error' }, { status: 500 });
  }
}
