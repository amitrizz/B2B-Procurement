import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, authErrorResponse } from '@/lib/auth';

type Params = {
  params: Promise<{ id: string }>
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthUser(req);
    if (!user || !user.companyId) return authErrorResponse();

    const { id } = await params;

    const rfq = await db.rFQ.findUnique({
      where: { id },
      include: {
        buyerCompany: true,
        items: {
          include: {
            bids: {
              include: {
                supplierCompany: {
                  select: { name: true },
                },
              },
            },
          },
        },
      },
    });

    if (!rfq) {
      return NextResponse.json(
        { success: false, code: 'NOT_FOUND', message: 'RFQ not found' },
        { status: 404 }
      );
    }

    // Strict security check: non-buyer cannot see bids on the RFQ
    const isBuyer = rfq.buyerCompanyId === user.companyId;

    const sanitizedItems = rfq.items.map(item => {
      if (!isBuyer) {
        // Hide other suppliers' bids from public viewers
        const { bids, ...rest } = item;
        return rest;
      }
      return item;
    });

    return NextResponse.json({
      success: true,
      data: {
        ...rfq,
        items: sanitizedItems,
      },
    });
  } catch (error: any) {
    console.error('Get RFQ details error:', error);
    return NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: 'Internal server error' },
      { status: 500 }
    );
  }
}
