import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, authErrorResponse } from '@/lib/auth';
import {
  SamplingCampaign,
  SamplingInvite,
  ACTIVE_SAMPLING_STATUSES,
} from '@/models/Sampling';
import { createSampleDeliveryForInvite } from '@/lib/sampleDelivery';

type Params = { params: Promise<{ id: string; inviteId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthUser(req);
    if (!user || !user.companyId) return authErrorResponse();

    const { id: rfqId, inviteId } = await params;
    await db();
    const { RFQ } = await import('@/models/RFQ');

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
    })) as any;

    if (!invite) {
      return NextResponse.json({ success: false, code: 'NOT_FOUND', message: 'Invite not found' }, { status: 404 });
    }

    const isSupplier = invite.supplierCompanyId.toString() === user.companyId;
    const isAdmin = user.role === 'PLATFORM_ADMIN';
    if (!isSupplier && !isAdmin) {
      return NextResponse.json({ success: false, code: 'FORBIDDEN', message: 'Forbidden' }, { status: 403 });
    }

    if (!['SUBMITTED', 'IN_TRANSIT'].includes(invite.status)) {
      return NextResponse.json(
        { success: false, code: 'INVALID_STATUS', message: 'Sample must be submitted before ready for pickup' },
        { status: 400 }
      );
    }

    if (campaign.sampleDeadlineAt && new Date(campaign.sampleDeadlineAt).getTime() < Date.now()) {
      return NextResponse.json(
        { success: false, code: 'DEADLINE_PASSED', message: 'Sampling deadline has passed' },
        { status: 400 }
      );
    }

    if (invite.deliveryOrderId) {
      const { DeliveryOrder } = await import('@/models/Logistics');
      const existing = (await DeliveryOrder.findById(invite.deliveryOrderId).lean()) as any;
      return NextResponse.json({
        success: true,
        message: 'Sample pickup job already exists',
        data: {
          delivery: existing
            ? {
                id: existing._id.toString(),
                deliveryNumber: existing.deliveryNumber,
                status: existing.status,
                purpose: existing.purpose,
              }
            : null,
        },
      });
    }

    const result = await createSampleDeliveryForInvite(rfq, campaign, invite);

    const { publishToCentrifugo } = await import('@/lib/centrifugo');
    await publishToCentrifugo('global_updates', {
      type: 'db_change',
      eventType: 'sample_ready_for_pickup',
      target: 'all',
      message: `Sample pickup ${result.delivery.deliveryNumber} — RFQ ${rfq.rfqNumber}. Transporters can accept in Local Delivery Portal.`,
    });

    const responseData: any = {
      delivery: {
        id: result.delivery._id.toString(),
        deliveryNumber: result.delivery.deliveryNumber,
        status: result.delivery.status,
        purpose: 'SAMPLE',
      },
    };

    if (isSupplier || isAdmin) {
      responseData.pickupOtp = result.pickupOtp;
    }

    return NextResponse.json({
      success: true,
      message: 'Sample marked ready for transporter pickup',
      data: responseData,
    });
  } catch (error: any) {
    console.error('Sample ready-for-pickup error:', error);
    return NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
