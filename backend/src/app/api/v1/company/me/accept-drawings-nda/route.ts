import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, authErrorResponse } from '@/lib/auth';

export async function POST(req: NextRequest) {
    console.log(`[API] ${req.method} ${req.nextUrl?.pathname || req.url}`);
  try {
    const user = await getAuthUser(req);
    if (!user || !user.companyId) return authErrorResponse();

    await db();
    const { Company } = await import('@/models/Company');

    const companyDoc = await Company.findByIdAndUpdate(
      user.companyId,
      { $set: { drawingsNdaAcceptedAt: new Date() } },
      { new: true }
    ).lean() as any;

    if (!companyDoc) {
       return console.log(`[API Response] /api/v1/company/me/accept-drawings-nda - Sending response`), NextResponse.json(
        { success: false, code: 'NOT_FOUND', message: 'Company not found' },
        { status: 404 }
      );
    }

    return console.log(`[API Response] /api/v1/company/me/accept-drawings-nda - Sending response`), NextResponse.json({
      success: true,
      message: 'Drawings NDA accepted successfully',
      data: { drawingsNdaAcceptedAt: companyDoc.drawingsNdaAcceptedAt },
    });
  } catch (error: any) {
    console.error('Accept NDA error:', error);
    return console.log(`[API Response] /api/v1/company/me/accept-drawings-nda - Sending response`), NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: 'Internal server error' },
      { status: 500 }
    );
  }
}
