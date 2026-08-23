import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, authErrorResponse } from '@/lib/auth';

type Params = {
  params: Promise<{ id: string; rfqItemId: string }>
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthUser(req);
    if (!user || !user.companyId || !user.company) return authErrorResponse();

    if (user.company.status !== 'VERIFIED') {
      return NextResponse.json(
        { success: false, code: 'UNVERIFIED_COMPANY', message: 'Only verified companies can submit bids' },
        { status: 403 }
      );
    }

    const { id: rfqId, rfqItemId } = await params;
    const { priceWithoutMaterial, priceWithMaterial, materialOptionPreference, estimatedTimeDays, terms } = await req.json();

    const rfq = await db.rFQ.findUnique({
      where: { id: rfqId },
      include: {
        items: {
          where: { id: rfqItemId },
        },
      },
    });

    if (!rfq) {
      return NextResponse.json(
        { success: false, code: 'NOT_FOUND', message: 'RFQ not found' },
        { status: 404 }
      );
    }

    if (rfq.buyerCompanyId === user.companyId) {
      return NextResponse.json(
        { success: false, code: 'INVALID_BIDDER', message: 'You cannot bid on your own requirement' },
        { status: 400 }
      );
    }

    if (rfq.status !== 'PUBLISHED' || (rfq.bidEndAt && rfq.bidEndAt < new Date())) {
      return NextResponse.json(
        { success: false, code: 'BIDDING_CLOSED', message: 'Bidding is closed for this requirement' },
        { status: 400 }
      );
    }

    const rfqItem = rfq.items[0];
    if (!rfqItem) {
      return NextResponse.json(
        { success: false, code: 'ITEM_NOT_FOUND', message: 'RFQ item not found' },
        { status: 404 }
      );
    }

    // Prevent duplicate active bids
    const existingActiveBid = await db.bid.findFirst({
      where: {
        rfqItemId,
        supplierCompanyId: user.companyId,
        status: 'SUBMITTED',
      },
    });

    if (existingActiveBid) {
      const updatedBid = await db.bid.update({
        where: { id: existingActiveBid.id },
        data: {
          priceWithoutMaterial,
          priceWithMaterial,
          materialOptionPreference,
          estimatedTimeDays,
          terms,
          status: 'SUBMITTED',
        },
      });
      return NextResponse.json({
        success: true,
        message: 'Bid updated successfully',
        data: updatedBid,
      });
    }

    const bidNumber = 'BID-' + Math.floor(100000 + Math.random() * 900000);

    const bid = await db.bid.create({
      data: {
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
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Bid submitted successfully',
      data: bid,
    });
  } catch (error: any) {
    console.error('Create bid error:', error);
    return NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthUser(req);
    if (!user || !user.companyId) return authErrorResponse();

    const { id: rfqId, rfqItemId } = await params;

    const existingBid = await db.bid.findFirst({
      where: {
        rfqItemId,
        supplierCompanyId: user.companyId,
        status: 'SUBMITTED',
      },
    });

    if (!existingBid) {
      return NextResponse.json(
        { success: false, code: 'NOT_FOUND', message: 'No active bid quote found to withdraw' },
        { status: 404 }
      );
    }

    await db.bid.delete({
      where: { id: existingBid.id },
    });

    return NextResponse.json({
      success: true,
      message: 'Bid quote withdrawn successfully',
    });
  } catch (error: any) {
    console.error('Withdraw bid error:', error);
    return NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: 'Internal server error' },
      { status: 500 }
    );
  }
}
