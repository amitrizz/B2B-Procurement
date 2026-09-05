import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, authErrorResponse } from '@/lib/auth';
import { assertNoActiveSampling } from '@/lib/samplingHelpers';
import { awardBidsForRfq, type BidSelectionInput } from '@/lib/awardBids';
import mongoose from 'mongoose';

type Params = {
  params: Promise<{ id: string }>;
};

export async function POST(req: NextRequest, { params }: Params) {
  console.log(`[API] ${req.method} ${req.nextUrl?.pathname || req.url}`);
  try {
    const user = await getAuthUser(req);
    if (!user || !user.companyId) return authErrorResponse();

    const { id: rfqId } = await params;
    const { selections } = await req.json();

    if (!selections || !Array.isArray(selections) || selections.length === 0) {
      return NextResponse.json(
        { success: false, code: 'BAD_REQUEST', message: 'Missing selections array' },
        { status: 400 }
      );
    }

    await db();
    const { RFQ } = await import('@/models/RFQ');

    const rfq = (await RFQ.findById(rfqId).lean()) as any;
    if (!rfq) {
      return NextResponse.json({ success: false, code: 'NOT_FOUND', message: 'RFQ not found' }, { status: 404 });
    }
    if (rfq.buyerCompanyId.toString() !== user.companyId) {
      return NextResponse.json({ success: false, code: 'FORBIDDEN', message: 'You do not own this RFQ' }, { status: 403 });
    }

    await assertNoActiveSampling(rfqId);

    const session = await mongoose.startSession();
    let purchaseOrders: any[] = [];

    try {
      session.startTransaction();
      const result = await awardBidsForRfq(
        rfqId,
        user.companyId,
        selections as BidSelectionInput[],
        session
      );
      purchaseOrders = result.purchaseOrders;
      await session.commitTransaction();
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }

    if (purchaseOrders.length > 0) {
      const { broadcastCompanyUpdate } = await import('@/lib/companyEvents');
      for (const po of purchaseOrders) {
        await broadcastCompanyUpdate(
          po.supplierCompanyId.toString(),
          'order_created',
          `Congratulations! Your bid was selected for RFQ ${rfq.rfqNumber}. A new Purchase Order has been created.`
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Bids selected and Purchase Order(s) generated successfully',
      data: purchaseOrders,
    });
  } catch (error: any) {
    console.error('Bid selection error:', error.message);
    return NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
