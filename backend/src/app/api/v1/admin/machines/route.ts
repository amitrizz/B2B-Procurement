import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, authErrorResponse } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  console.log(`[API] ${req.method} ${req.nextUrl?.pathname || req.url}`);
  try {
    const user = await getAuthUser(req);
    if (!user || user.role !== 'PLATFORM_ADMIN') return authErrorResponse();

    await db();
    const { MachineMaster } = await import('@/models/Machine');

    const machines = await MachineMaster.find().sort({ createdAt: -1 }).lean();

    return NextResponse.json({
      success: true,
      data: machines.map((m: any) => ({
        ...m,
        id: m._id.toString()
      }))
    });
  } catch (error: any) {
    console.error(`[API Error] /api/v1/admin/machines (GET):`, error.message);
    return NextResponse.json({ success: false, message: error.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  console.log(`[API] ${req.method} ${req.nextUrl?.pathname || req.url}`);
  try {
    const user = await getAuthUser(req);
    if (!user || user.role !== 'PLATFORM_ADMIN') return authErrorResponse();

    const body = await req.json();
    const { name, model, description } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ success: false, message: 'Machine name is required' }, { status: 400 });
    }

    await db();
    const { MachineMaster } = await import('@/models/Machine');

    const existing = await MachineMaster.findOne({ 
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') } 
    });

    if (existing) {
      return NextResponse.json({ success: false, message: 'A machine with this name already exists' }, { status: 400 });
    }

    const newMachine = await MachineMaster.create({
      name: name.trim(),
      model: model ? model.trim() : '',
      description: description ? description.trim() : '',
      isActive: true
    });

    return NextResponse.json({
      success: true,
      data: {
        ...newMachine.toObject(),
        id: newMachine._id.toString()
      }
    }, { status: 201 });
  } catch (error: any) {
    console.error(`[API Error] /api/v1/admin/machines (POST):`, error.message);
    return NextResponse.json({ success: false, message: error.message || 'Server error' }, { status: 500 });
  }
}
