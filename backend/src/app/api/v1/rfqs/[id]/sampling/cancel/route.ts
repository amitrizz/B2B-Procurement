import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, authErrorResponse } from '@/lib/auth';
import mongoose from 'mongoose';
import { SamplingCampaign, SamplingInvite, ACTIVE_SAMPLING_STATUSES } from '@/models/Sampling';
import { broadcastSamplingCancelled } from '@/lib/samplingEvents';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthUser(req);
    if (!user || !user.companyId) return authErrorResponse();

    const { id: rfqId } = await params;
    await db();
    const { RFQ } = await import('@/models/RFQ');
    const { DeliveryOrder } = await import('@/models/Logistics');

    const rfq = (await RFQ.findById(rfqId).lean()) as any;
    if (!rfq || rfq.buyerCompanyId.toString() !== user.companyId) {
      return NextResponse.json({ success: false, code: 'FORBIDDEN', message: 'Forbidden' }, { status: 403 });
    }

    const campaign = (await SamplingCampaign.findOne({
      rfqId,
      status: { $in: ACTIVE_SAMPLING_STATUSES },
    })) as any;

    if (!campaign) {
      return NextResponse.json(
        { success: false, code: 'NOT_FOUND', message: 'No active sampling campaign' },
        { status: 404 }
      );
    }

    const invites = (await SamplingInvite.find({ campaignId: campaign._id }).lean()) as any[];
    const supplierCompanyIds = [
      ...new Set(invites.map((i) => i.supplierCompanyId?.toString()).filter(Boolean)),
    ];
    const deliveryIds = invites.map((i) => i.deliveryOrderId).filter(Boolean);

    const session = await mongoose.startSession();
    try {
      session.startTransaction();
      campaign.status = 'CANCELLED';
      await campaign.save({ session });
      await SamplingInvite.updateMany(
        { campaignId: campaign._id, status: { $nin: ['SELECTED', 'NOT_SELECTED'] } },
        { $set: { status: 'WITHDRAWN' } },
        { session }
      );
      if (deliveryIds.length) {
        await DeliveryOrder.updateMany(
          { _id: { $in: deliveryIds }, status: { $nin: ['DELIVERED'] } },
          { $set: { status: 'CANCELLED' } },
          { session }
        );
      }
      await RFQ.updateOne({ _id: rfqId }, { $set: { status: 'PUBLISHED' } }, { session });
      await session.commitTransaction();
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }

    await broadcastSamplingCancelled(
      user.companyId,
      supplierCompanyIds,
      rfq.rfqNumber || rfqId
    );

    return NextResponse.json({ success: true, message: 'Sampling campaign cancelled' });
  } catch (error: any) {
    console.error('Cancel sampling error:', error);
    return NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
