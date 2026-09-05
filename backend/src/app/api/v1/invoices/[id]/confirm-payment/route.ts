import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, authErrorResponse } from '@/lib/auth';
import { confirmInvoicePayment } from '@/lib/confirmInvoicePayment';

/** Buyer confirms payment to platform (dev stub / manual confirm). */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(req);
    if (!user || !user.companyId) return authErrorResponse();

    const { id } = await params;
    const result = await confirmInvoicePayment(id, user.companyId);

    if (!result.ok) {
      return NextResponse.json(
        { success: false, code: result.code, message: result.message },
        { status: result.status }
      );
    }

    return NextResponse.json({ success: true, message: result.message });
  } catch (error) {
    console.error('Confirm invoice payment error:', error);
    return NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: 'Internal server error' },
      { status: 500 }
    );
  }
}
