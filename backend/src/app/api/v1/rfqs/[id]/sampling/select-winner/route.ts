import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, authErrorResponse } from '@/lib/auth';
import mongoose from 'mongoose';
import { SamplingCampaign, SamplingInvite, ACTIVE_SAMPLING_STATUSES } from '@/models/Sampling';
import { awardBidsForRfq, buildSelectionsForSupplier } from '@/lib/awardBids';
import { broadcastSamplingWinnerSelected } from '@/lib/samplingEvents';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthUser(req);
    if (!user || !user.companyId) return authErrorResponse();

    const { id: rfqId } = await params;
    const { inviteId } = await req.json();

    if (!inviteId) {
      return NextResponse.json(
        { success: false, code: 'BAD_REQUEST', message: 'inviteId is required' },
        { status: 400 }
      );
    }

    await db();
    const { RFQ } = await import('@/models/RFQ');

    const rfq = (await RFQ.findById(rfqId).lean()) as any;
    if (!rfq || rfq.buyerCompanyId.toString() !== user.companyId) {
      return NextResponse.json({ success: false, code: 'FORBIDDEN', message: 'Forbidden' }, { status: 403 });
    }

    const campaign = (await SamplingCampaign.findOne({
      rfqId,
      status: { $in: [...ACTIVE_SAMPLING_STATUSES, 'EVALUATION'] },
    }).lean()) as any;

    if (!campaign) {
      return NextResponse.json(
        { success: false, code: 'NOT_FOUND', message: 'No sampling campaign in evaluation' },
        { status: 404 }
      );
    }

    const invite = (await SamplingInvite.findOne({
      _id: inviteId,
      campaignId: campaign._id,
    }).lean()) as any;

    if (!invite) {
      return NextResponse.json({ success: false, code: 'NOT_FOUND', message: 'Invite not found' }, { status: 404 });
    }

    if (!['DELIVERED'].includes(invite.status)) {
      return NextResponse.json(
        {
          success: false,
          code: 'INVALID_STATUS',
          message: 'Supplier sample must be delivered before selecting a winner',
        },
        { status: 400 }
      );
    }

    const selections = await buildSelectionsForSupplier(rfqId, invite.supplierCompanyId.toString());

    const session = await mongoose.startSession();
    let purchaseOrders: any[] = [];

    try {
      session.startTransaction();

      const result = await awardBidsForRfq(rfqId, user.companyId, selections, session);
      purchaseOrders = result.purchaseOrders;

      await SamplingInvite.updateOne(
        { _id: invite._id },
        { $set: { status: 'SELECTED' } },
        { session }
      );

      await SamplingInvite.updateMany(
        { campaignId: campaign._id, _id: { $ne: invite._id } },
        { $set: { status: 'NOT_SELECTED' } },
        { session }
      );

      await SamplingCampaign.updateOne(
        { _id: campaign._id },
        {
          $set: {
            status: 'AWARDED',
            winnerSupplierCompanyId: invite.supplierCompanyId,
            winnerInviteId: invite._id,
          },
        },
        { session }
      );

      await session.commitTransaction();
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }

    const otherInvites = (await SamplingInvite.find({
      campaignId: campaign._id,
      _id: { $ne: invite._id },
    }).lean()) as any[];

    await broadcastSamplingWinnerSelected(
      user.companyId,
      invite.supplierCompanyId.toString(),
      otherInvites.map((i) => i.supplierCompanyId.toString()),
      rfq.rfqNumber
    );

    if (purchaseOrders.length) {
      const { broadcastCompanyUpdate } = await import('@/lib/companyEvents');
      for (const po of purchaseOrders) {
        await broadcastCompanyUpdate(
          po.supplierCompanyId.toString(),
          'order_created',
          `Your sample was selected for RFQ ${rfq.rfqNumber}. Purchase order created.`
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Winner selected and purchase order(s) created',
      data: { purchaseOrders },
    });
  } catch (error: any) {
    console.error('Select sampling winner error:', error);
    return NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
