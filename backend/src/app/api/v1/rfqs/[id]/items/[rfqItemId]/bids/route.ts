import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, authErrorResponse } from '@/lib/auth';
import { rupeesToPaise } from '@/lib/money';

type Params = {
  params: Promise<{ id: string; rfqItemId: string }>
}

export async function POST(req: NextRequest, { params }: Params) {
    console.log(`[API] ${req.method} ${req.nextUrl?.pathname || req.url}`);
  try {
    const user = await getAuthUser(req);
    if (!user || !user.companyId || !user.company) return authErrorResponse();

    if (user.company.status !== 'VERIFIED') {
      return console.log(`[API Response] /api/v1/rfqs/[id]/items/[rfqItemId]/bids - Sending response`), NextResponse.json(
        { success: false, code: 'UNVERIFIED_COMPANY', message: 'You are not allowed to bid due to pending verification documentation' },
        { status: 403 }
      );
    }

    if (user.company.isActive === false) {
      return console.log(`[API Response] /api/v1/rfqs/[id]/items/[rfqItemId]/bids - Sending response`), NextResponse.json(
        { success: false, code: 'INACTIVE_COMPANY', message: 'Your company account is inactive. Please contact support.' },
        { status: 403 }
      );
    }

    if (process.env.EMAIL_VERIFY_REQUIRED === 'true' && !user.emailVerified) {
      return console.log(`[API Response] /api/v1/rfqs/[id]/items/[rfqItemId]/bids - Sending response`), NextResponse.json(
        { success: false, code: 'EMAIL_NOT_VERIFIED', message: 'Email verification required to submit bids' },
        { status: 403 }
      );
    }

    const { id: rfqId, rfqItemId } = await params;
    const { materialOptionPreference, estimatedTimeDays, terms } = await req.json();
    let { priceWithoutMaterial, priceWithMaterial } = await req.json();

    priceWithoutMaterial = priceWithoutMaterial ? rupeesToPaise(Number(priceWithoutMaterial)) : 0;
    priceWithMaterial = priceWithMaterial ? rupeesToPaise(Number(priceWithMaterial)) : 0;

    await db();
    const { RFQ, RFQItem } = await import('@/models/RFQ');
    const { Bid } = await import('@/models/Bid');
    
    const rfq = await RFQ.findById(rfqId).lean() as any;
    const rfqItems = rfq ? await RFQItem.find({ rfqId: rfq._id }).lean() as any[] : [];

    if (!rfq) {
      return console.log(`[API Response] /api/v1/rfqs/[id]/items/[rfqItemId]/bids - Sending response`), NextResponse.json(
        { success: false, code: 'NOT_FOUND', message: 'RFQ not found' },
        { status: 404 }
      );
    }

    if (rfq.buyerCompanyId.toString() === user.companyId) {
      return console.log(`[API Response] /api/v1/rfqs/[id]/items/[rfqItemId]/bids - Sending response`), NextResponse.json(
        { success: false, code: 'INVALID_BIDDER', message: 'You cannot bid on your own requirement' },
        { status: 400 }
      );
    }

    if (rfq.status !== 'PUBLISHED' || (rfq.bidEndAt && rfq.bidEndAt < new Date())) {
      return console.log(`[API Response] /api/v1/rfqs/[id]/items/[rfqItemId]/bids - Sending response`), NextResponse.json(
        { success: false, code: 'BIDDING_CLOSED', message: 'Bidding is closed for this requirement' },
        { status: 400 }
      );
    }

    const rfqItem = rfqItems.find(i => i._id.toString() === rfqItemId);
    if (!rfqItem) {
      return console.log(`[API Response] /api/v1/rfqs/[id]/items/[rfqItemId]/bids - Sending response`), NextResponse.json(
        { success: false, code: 'ITEM_NOT_FOUND', message: 'RFQ item not found' },
        { status: 404 }
      );
    }

    // Prevent duplicate active bids
    const existingActiveBid = await Bid.findOne({
      rfqItemId,
      supplierCompanyId: user.companyId,
      status: 'SUBMITTED',
    }).lean() as any;

    if (existingActiveBid) {
      const updatedBidDoc = await Bid.findByIdAndUpdate(
        existingActiveBid._id,
        {
          priceWithoutMaterial,
          priceWithMaterial,
          materialOptionPreference,
          estimatedTimeDays,
          terms,
          status: 'SUBMITTED',
        },
        { new: true }
      ).lean() as any;
      
      const updatedBid = updatedBidDoc ? { ...updatedBidDoc, id: updatedBidDoc._id.toString() } : null;

      return console.log(`[API Response] /api/v1/rfqs/[id]/items/[rfqItemId]/bids - Sending response`), NextResponse.json({
        success: true,
        message: 'Bid updated successfully',
        data: updatedBid,
      });
    }

    const bidNumber = 'BID-' + Math.floor(100000 + Math.random() * 900000);

    const bidDoc = await Bid.create({
      bidNumber,
      rfqId,
      rfqItemId,
      supplierCompanyId: user.companyId,
      quantity: rfqItem.quantity, // enforces full quantity bid rule
      priceWithoutMaterial,
      priceWithMaterial,
      materialOptionPreference,
      estimatedTimeDays,
      terms,
      status: 'SUBMITTED',
    });
    
    const bid = { ...bidDoc.toObject(), id: bidDoc._id.toString() };

    return console.log(`[API Response] /api/v1/rfqs/[id]/items/[rfqItemId]/bids - Sending response`), NextResponse.json({
      success: true,
      message: 'Bid submitted successfully',
      data: bid,
    });
  } catch (error: any) {
    console.error('Create bid error:', error);
    return console.log(`[API Response] /api/v1/rfqs/[id]/items/[rfqItemId]/bids - Sending response`), NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
    console.log(`[API] ${req.method} ${req.nextUrl?.pathname || req.url}`);
  try {
    const user = await getAuthUser(req);
    if (!user || !user.companyId) return authErrorResponse();

    const { id: rfqId, rfqItemId } = await params;

    await db();
    const { Bid } = await import('@/models/Bid');

    const existingBid = await Bid.findOne({
      rfqItemId,
      supplierCompanyId: user.companyId,
      status: 'SUBMITTED',
    }).lean() as any;

    if (!existingBid) {
      return console.log(`[API Response] /api/v1/rfqs/[id]/items/[rfqItemId]/bids - Sending response`), NextResponse.json(
        { success: false, code: 'NOT_FOUND', message: 'No active bid quote found to withdraw' },
        { status: 404 }
      );
    }

    await Bid.deleteOne({ _id: existingBid._id });

    return console.log(`[API Response] /api/v1/rfqs/[id]/items/[rfqItemId]/bids - Sending response`), NextResponse.json({
      success: true,
      message: 'Bid quote withdrawn successfully',
    });
  } catch (error: any) {
    console.error('Withdraw bid error:', error);
    return console.log(`[API Response] /api/v1/rfqs/[id]/items/[rfqItemId]/bids - Sending response`), NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: 'Internal server error' },
      { status: 500 }
    );
  }
}
