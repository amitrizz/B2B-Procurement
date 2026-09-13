import { NextRequest, NextResponse } from 'next/server';
import { clearImpersonation } from '@/lib/impersonation';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  console.log(`[API] ${req.method} ${req.nextUrl?.pathname || req.url}`);
  try {
    const { targetEmail } = await req.json().catch(() => ({ targetEmail: '' }));

    if (targetEmail) {
      clearImpersonation(targetEmail);
    }

    return NextResponse.json({
      success: true,
      message: 'Impersonation ended successfully',
    });
  } catch (error: any) {
    console.error('Exit impersonation error:', error);
    return NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: 'Failed to exit impersonation' },
      { status: 500 }
    );
  }
}
