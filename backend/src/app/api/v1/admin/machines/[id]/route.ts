import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, authErrorResponse } from '@/lib/auth';

type Params = {
  params: Promise<{ id: string }>;
};

export async function PUT(req: NextRequest, { params }: Params) {
  console.log(`[API] ${req.method} ${req.nextUrl?.pathname || req.url}`);
  try {
    const user = await getAuthUser(req);
    if (!user || user.role !== 'PLATFORM_ADMIN') return authErrorResponse();

    const { id } = await params;
    const body = await req.json();
    const { name, model, description, isActive } = body;

    await db();
    const { MachineMaster } = await import('@/models/Machine');

    const updateData: any = {};
    if (typeof name === 'string' && name.trim()) updateData.name = name.trim();
    if (typeof model === 'string') updateData.model = model.trim();
    if (typeof description === 'string') updateData.description = description.trim();
    if (typeof isActive === 'boolean') updateData.isActive = isActive;

    const updated = await MachineMaster.findByIdAndUpdate(id, updateData, { new: true }).lean() as any;
    if (!updated) {
      return NextResponse.json({ success: false, message: 'Machine not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        ...updated,
        id: updated._id.toString()
      }
    });
  } catch (error: any) {
    console.error(`[API Error] /api/v1/admin/machines/[id] (PUT):`, error.message);
    return NextResponse.json({ success: false, message: error.message || 'Server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  console.log(`[API] ${req.method} ${req.nextUrl?.pathname || req.url}`);
  try {
    const user = await getAuthUser(req);
    if (!user || user.role !== 'PLATFORM_ADMIN') return authErrorResponse();

    const { id } = await params;

    await db();
    const { MachineMaster } = await import('@/models/Machine');

    const deleted = await MachineMaster.findByIdAndDelete(id);
    if (!deleted) {
      return NextResponse.json({ success: false, message: 'Machine not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Machine deleted successfully'
    });
  } catch (error: any) {
    console.error(`[API Error] /api/v1/admin/machines/[id] (DELETE):`, error.message);
    return NextResponse.json({ success: false, message: error.message || 'Server error' }, { status: 500 });
  }
}
