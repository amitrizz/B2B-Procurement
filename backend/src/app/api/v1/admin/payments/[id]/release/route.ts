import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, authErrorResponse } from '@/lib/auth';
import { releaseSupplierPayout } from '@/lib/supplierPayout';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(req);
    if (!user || user.role !== 'PLATFORM_ADMIN') {
      return authErrorResponse('Only Platform Admin can release payments');
    }

    const { id } = await params;
    await db();

    const result = await releaseSupplierPayout(id);
    if (!result.ok) {
      return NextResponse.json(
        { success: false, code: result.code, message: result.message },
        { status: result.status }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Supplier payout of ₹${(result.payoutAmount / 100).toFixed(2)} released successfully`,
      data: {
        payoutAmount: result.payoutAmount,
        supplierCompanyId: result.supplierCompanyId,
      },
    });
  } catch (error: any) {
    console.error('Release payment error:', error);
    return NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: 'Internal server error' },
      { status: 500 }
    );
  }
}
