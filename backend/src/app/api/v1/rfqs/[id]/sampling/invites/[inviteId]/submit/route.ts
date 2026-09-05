import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, authErrorResponse } from '@/lib/auth';
import mongoose from 'mongoose';
import {
  SamplingCampaign,
  SamplingInvite,
  SampleSubmission,
  ACTIVE_SAMPLING_STATUSES,
} from '@/models/Sampling';
import { broadcastSampleSubmitted } from '@/lib/samplingEvents';
import { createSampleDeliveryForInvite, formatSampleDeliveryForViewer } from '@/lib/sampleDelivery';
import { serializeSampleSubmission } from '@/lib/samplingHelpers';

type Params = { params: Promise<{ id: string; inviteId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthUser(req);
    if (!user || !user.companyId) return authErrorResponse();

    const { id: rfqId, inviteId } = await params;
    const { notes, pickupAddressId } = await req.json();

    await db();
    const { RFQ } = await import('@/models/RFQ');
    const { Company } = await import('@/models/Company');

    const rfq = (await RFQ.findById(rfqId).lean()) as any;
    if (!rfq) {
      return NextResponse.json({ success: false, code: 'NOT_FOUND', message: 'RFQ not found' }, { status: 404 });
    }

    const campaign = (await SamplingCampaign.findOne({
      rfqId,
      status: { $in: ACTIVE_SAMPLING_STATUSES },
    }).lean()) as any;

    if (!campaign) {
      return NextResponse.json(
        { success: false, code: 'NOT_FOUND', message: 'No active sampling campaign' },
        { status: 404 }
      );
    }

    const invite = (await SamplingInvite.findOne({
      _id: inviteId,
      campaignId: campaign._id,
      supplierCompanyId: user.companyId,
    })) as any;

    if (!invite) {
      return NextResponse.json({ success: false, code: 'FORBIDDEN', message: 'Invite not found' }, { status: 403 });
    }

    if (['WITHDRAWN', 'NOT_SELECTED', 'SELECTED'].includes(invite.status)) {
      return NextResponse.json(
        { success: false, code: 'INVALID_STATUS', message: 'Cannot submit sample for this invite' },
        { status: 400 }
      );
    }

    if (campaign.sampleDeadlineAt && new Date(campaign.sampleDeadlineAt).getTime() < Date.now()) {
      return NextResponse.json(
        { success: false, code: 'DEADLINE_PASSED', message: 'Sampling deadline has passed' },
        { status: 400 }
      );
    }

    const session = await mongoose.startSession();
    let submission: any;

    try {
      session.startTransaction();

      if (invite.submissionId) {
        await SampleSubmission.updateOne(
          { _id: invite.submissionId },
          {
            $set: {
              notes: notes || '',
              photoFileIds: [],
              submittedAt: new Date(),
              pickupAddressId: pickupAddressId || undefined,
            },
          },
          { session }
        );
        submission = await SampleSubmission.findById(invite.submissionId).session(session).lean();
      } else {
        const created = await SampleSubmission.create(
          [
            {
              inviteId: invite._id,
              notes: notes || '',
              photoFileIds: [],
              submittedAt: new Date(),
              pickupAddressId: pickupAddressId || undefined,
            },
          ],
          { session }
        );
        submission = created[0];
        invite.submissionId = submission._id;
      }

      invite.status = 'SUBMITTED';
      await invite.save({ session });

      const submittedCount = await SamplingInvite.countDocuments({
        campaignId: campaign._id,
        status: { $in: ['SUBMITTED', 'IN_TRANSIT', 'DELIVERED'] },
      }).session(session);

      await SamplingCampaign.updateOne(
        { _id: campaign._id },
        { $set: { status: submittedCount > 0 ? 'COLLECTING' : campaign.status } },
        { session }
      );

      await session.commitTransaction();
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }

    let deliveryInfo: any = null;
    let pickupOtp = '';

    const refreshedInvite = (await SamplingInvite.findById(invite._id).lean()) as any;
    if (refreshedInvite?.deliveryOrderId) {
      const { DeliveryOrder } = await import('@/models/Logistics');
      const existingDelivery = (await DeliveryOrder.findById(refreshedInvite.deliveryOrderId).lean()) as any;
      if (existingDelivery) {
        deliveryInfo = formatSampleDeliveryForViewer(existingDelivery, { isSupplier: true });
        pickupOtp = existingDelivery.pickupOtp || '';
      }
    } else {
      const result = await createSampleDeliveryForInvite(rfq, campaign, refreshedInvite);
      deliveryInfo = formatSampleDeliveryForViewer(result.delivery, { isSupplier: true });
      pickupOtp = result.pickupOtp;

      const { publishToCentrifugo } = await import('@/lib/centrifugo');
      await publishToCentrifugo('global_updates', {
        type: 'db_change',
        eventType: 'sample_ready_for_pickup',
        target: 'all',
        message: `Sample pickup ${result.delivery.deliveryNumber} — RFQ ${rfq.rfqNumber}. Transporters can accept in Local Delivery Portal.`,
      });
    }

    const supplier = (await Company.findById(user.companyId).lean()) as any;
    await broadcastSampleSubmitted(rfq.buyerCompanyId.toString(), supplier?.name || 'Supplier', rfq.rfqNumber);

    return NextResponse.json({
      success: true,
      message: deliveryInfo
        ? `Sample ready. Pickup job ${deliveryInfo.deliveryNumber} created — share pickup OTP with transporter.`
        : 'Sample submitted successfully',
      data: {
        submission: serializeSampleSubmission(submission),
        inviteId: invite._id.toString(),
        status: deliveryInfo ? 'IN_TRANSIT' : refreshedInvite?.deliveryOrderId ? 'IN_TRANSIT' : 'SUBMITTED',
        delivery: deliveryInfo,
        pickupOtp: pickupOtp || undefined,
      },
    });
  } catch (error: any) {
    console.error('Submit sample error:', error);
    if (error?.code === 11000) {
      return NextResponse.json(
        {
          success: false,
          code: 'DELIVERY_EXISTS',
          message: 'Sample pickup job already exists for this invite. Refresh the page.',
        },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
