import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, authErrorResponse } from '@/lib/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ gstin: string }> }
) {
    console.log(`[API] ${req.method} ${req.nextUrl?.pathname || req.url}`);
  try {
    const user = await getAuthUser(req);
    if (!user) return authErrorResponse();

    const { gstin } = await params;

    if (!gstin || gstin.length !== 15) {
      return console.log(`[API Response] /api/v1/gstn/[gstin] - Sending response`), NextResponse.json({ success: false, code: 'INVALID_GSTIN', message: 'Invalid GSTIN format' }, { status: 400 });
    }

    // This is a stub for the actual GSTN API.
    // In production, this would call ClearTax or similar API.
    // For Phase 3, we mock fetching the legal name.

    const mockedResponse = {
       gstin,
       legalName: `MOCK COMPANY INC FOR ${gstin}`,
       tradeName: 'MOCK TRADING CO',
       status: 'Active',
       stateJurisdiction: 'Maharashtra'
    };

    // Add a slight delay to simulate network call
    await new Promise(resolve => setTimeout(resolve, 500));

    return console.log(`[API Response] /api/v1/gstn/[gstin] - Sending response`), NextResponse.json({
      success: true,
      data: mockedResponse
    });

  } catch (error: any) {
    console.error('GSTN adapter error:', error);
    return console.log(`[API Response] /api/v1/gstn/[gstin] - Sending response`), NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: 'Internal server error' },
      { status: 500 }
    );
  }
}
