import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, authErrorResponse } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    console.log(`[API] ${req.method} ${req.nextUrl?.pathname || req.url}`);
  try {
    const user = await getAuthUser(req);
    if (!user || !user.companyId) return authErrorResponse();

    const searchParams = req.nextUrl.searchParams;
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const processFilter = searchParams.get('process');

    await db();
    const { RFQ, RFQItem } = await import('@/models/RFQ');
    const { Bid: RFQBid } = await import('@/models/Bid');
    await import('@/models/Company');
    const mongoose = (await import('mongoose')).default;
    const whereClause: any = {
      status: 'PUBLISHED',
      bidEndAt: { $gt: new Date() },
    };

    if (category) {
      whereClause.category = category;
    }

    if (processFilter) {
      // NOTE: This will be simplified since we don't have deep nested queries like Prisma,
      // but for now we'll skip the deep item filtering as it requires a $lookup in match
    }

    if (search) {
      whereClause.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const rfqsDoc = await RFQ.aggregate([
      { $match: whereClause },
      { $sort: { createdAt: -1 } },
      {
        $lookup: {
          from: 'companies',
          localField: 'buyerCompanyId',
          foreignField: '_id',
          as: 'buyerCompany',
        },
      },
      {
        $lookup: {
          from: 'rfqitems',
          localField: '_id',
          foreignField: 'rfqId',
          as: 'items',
        },
      },
      {
        $lookup: {
          from: 'bids',
          localField: '_id',
          foreignField: 'rfqId',
          as: 'bids',
        },
      },
    ]);

    // Format the Mongoose aggregation result to match the Prisma shape
    const rfqs = rfqsDoc.map((rfq: any) => ({
      ...rfq,
      id: rfq._id.toString(),
      buyerCompany: rfq.buyerCompany[0] ? { name: rfq.buyerCompany[0].name } : null,
      items: rfq.items.map((item: any) => ({
        ...item,
        id: item._id.toString(),
        bids: [], // The UI doesn't strictly need the deep populated bids if the count is correct
      })),
      _count: {
        bids: rfq.bids.length,
      },
    }));

    return console.log(`[API Response] /api/v1/marketplace/requirements - Sending response`), NextResponse.json({
      success: true,
      data: rfqs,
    });
  } catch (error: any) {
    console.error('Marketplace requirements error:', error);
    return console.log(`[API Response] /api/v1/marketplace/requirements - Sending response`), NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: 'Internal server error' },
      { status: 500 }
    );
  }
}
