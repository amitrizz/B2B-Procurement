import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, authErrorResponse } from '@/lib/auth';

export async function GET(req: NextRequest) {
    console.log(`[API] ${req.method} ${req.nextUrl?.pathname || req.url}`);
  try {
    const user = await getAuthUser(req);
    // Let's say only admin can view/edit config
    if (!user || user.role !== 'PLATFORM_ADMIN') return authErrorResponse();

    await db();
    const { PlatformConfig } = await import('@/models/Platform');

    let configDoc = await PlatformConfig.findOne().lean() as any;
    if (!configDoc) {
      configDoc = await PlatformConfig.create({}); // create default if not exists
    }
    const config = { ...configDoc, id: configDoc._id.toString() };

    return console.log(`[API Response] /api/v1/admin/config - Sending response`), NextResponse.json({ success: true, data: config });
  } catch (error: any) {
    return console.log(`[API Response] /api/v1/admin/config - Sending response`), NextResponse.json({ success: false, code: 'SERVER_ERROR' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  console.log(`[API] ${req.method} ${req.nextUrl?.pathname || req.url}`);
  try {
    const user = await getAuthUser(req);
    if (!user || user.role !== 'PLATFORM_ADMIN') return authErrorResponse();

    const body = await req.json();
    const { commissionBps, poAcceptHours, grnAutoAcceptDays, platformState } = body;

    await db();
    const { PlatformConfig } = await import('@/models/Platform');

    const configDoc = await PlatformConfig.findOne().lean() as any;
    if (!configDoc) {
        return console.log(`[API Response] /api/v1/admin/config - Sending response`), NextResponse.json({ success: false, code: 'NOT_FOUND', message: 'Config not found' }, { status: 404 });
    }

    const updateData: any = {};
    if (commissionBps !== undefined) updateData.commissionBps = parseInt(commissionBps);
    if (poAcceptHours !== undefined) updateData.poAcceptHours = parseInt(poAcceptHours);
    if (grnAutoAcceptDays !== undefined) updateData.grnAutoAcceptDays = parseInt(grnAutoAcceptDays);
    if (platformState !== undefined) updateData.platformState = platformState;

    const updatedConfigDoc = await PlatformConfig.findByIdAndUpdate(
      configDoc._id,
      { $set: updateData },
      { new: true }
    ).lean() as any;

    const updatedConfig = updatedConfigDoc ? { ...updatedConfigDoc, id: updatedConfigDoc._id.toString() } : null;

    return console.log(`[API Response] /api/v1/admin/config - Sending response`), NextResponse.json({
      success: true,
      message: 'Platform configuration updated',
      data: updatedConfig
    });

  } catch (error: any) {
    console.error('Update config error:', error);
    return console.log(`[API Response] /api/v1/admin/config - Sending response`), NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: 'Internal server error' },
      { status: 500 }
    );
  }
}
