import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, authErrorResponse } from '@/lib/auth';

export async function GET(req: NextRequest) {
    console.log(`[API] ${req.method} ${req.nextUrl?.pathname || req.url}`);
  try {
    const user = await getAuthUser(req);
    if (!user || !user.companyId) return authErrorResponse();

    await db();
    const { Bid } = await import('@/models/Bid');
    const mongoose = (await import('mongoose')).default;

    // Find all bids where this user's company is the supplier
    const bidsDoc = await Bid.aggregate([
      { $match: { supplierCompanyId: new mongoose.Types.ObjectId(user.companyId) } },
      { $sort: { createdAt: -1 } },
      {
        $lookup: {
          from: 'RFQItem',
          localField: 'rfqItemId',
          foreignField: '_id',
          as: 'rfqItem'
        }
      },
      { $unwind: { path: '$rfqItem', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'RFQ',
          localField: 'rfqId',
          foreignField: '_id',
          as: 'rfq'
        }
      },
      { $unwind: { path: '$rfq', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'RFQItem',
          localField: 'rfq._id',
          foreignField: 'rfqId',
          as: 'rfq.items'
        }
      }
    ]);

    const bids = bidsDoc.map((b: any) => ({
      ...b,
      id: b._id.toString(),
      rfqItem: b.rfqItem ? { ...b.rfqItem, id: b.rfqItem._id.toString() } : null,
      rfq: b.rfq ? { 
        ...b.rfq, 
        id: b.rfq._id.toString(),
        items: b.rfq.items ? b.rfq.items.map((i: any) => ({ ...i, id: i._id.toString() })) : []
      } : null
    }));

    return console.log(`[API Response] /api/v1/rfqs/my-bids - Sending response`), NextResponse.json({
      success: true,
      data: bids
    });
  } catch (error: any) {
    console.error('List own bids error:', error);
    return console.log(`[API Response] /api/v1/rfqs/my-bids - Sending response`), NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: 'Internal server error' },
      { status: 500 }
    );
  }
}
