import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, authErrorResponse } from '@/lib/auth';
import { SamplingInvite, SamplingCampaign, SampleSubmission, ACTIVE_SAMPLING_STATUSES } from '@/models/Sampling';
import { formatSampleDeliveryForViewer, resolveSamplingInviteStatus } from '@/lib/sampleDelivery';

/** List sampling invites for the logged-in supplier. */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user || !user.companyId) return authErrorResponse();

    await db();
    const { RFQ } = await import('@/models/RFQ');
    const { DeliveryOrder } = await import('@/models/Logistics');

    const invites = (await SamplingInvite.find({
      supplierCompanyId: user.companyId,
      status: { $nin: ['WITHDRAWN', 'NOT_SELECTED', 'SELECTED'] },
    })
      .sort({ createdAt: -1 })
      .lean()) as any[];

    const campaignIds = invites.map((i) => i.campaignId);
    const campaigns = (await SamplingCampaign.find({ _id: { $in: campaignIds } }).lean()) as any[];
    const campaignMap = new Map(campaigns.map((c) => [c._id.toString(), c]));

    const rfqIds = campaigns.map((c) => c.rfqId);
    const rfqs = (await RFQ.find({ _id: { $in: rfqIds } }).lean()) as any[];
    const rfqMap = new Map(rfqs.map((r) => [r._id.toString(), r]));

    const submissionIds = invites.map((i) => i.submissionId).filter(Boolean);
    const submissions = submissionIds.length
      ? ((await SampleSubmission.find({ _id: { $in: submissionIds } }).lean()) as any[])
      : [];
    const submissionMap = new Map(submissions.map((s) => [s._id.toString(), s]));

    const deliveryIds = invites.map((i) => i.deliveryOrderId).filter(Boolean);
    const deliveries = deliveryIds.length
      ? ((await DeliveryOrder.find({ _id: { $in: deliveryIds } }).lean()) as any[])
      : [];
    const deliveryMap = new Map(deliveries.map((d) => [d._id.toString(), d]));

    const data = invites
      .map((inv) => {
        const campaign = campaignMap.get(inv.campaignId.toString());
        const rfq = campaign ? rfqMap.get(campaign.rfqId.toString()) : null;
        const sub = inv.submissionId ? submissionMap.get(inv.submissionId.toString()) : null;
        const delivery = inv.deliveryOrderId ? deliveryMap.get(inv.deliveryOrderId.toString()) : null;

        return {
          ...inv,
          id: inv._id.toString(),
          rfqId: campaign?.rfqId?.toString(),
          rfqNumber: rfq?.rfqNumber,
          rfqTitle: rfq?.title,
          campaignStatus: campaign?.status,
          sampleDeadlineAt: campaign?.sampleDeadlineAt,
          status: resolveSamplingInviteStatus(inv, delivery),
          submission: sub ? { ...sub, id: sub._id.toString() } : null,
          delivery: delivery
            ? formatSampleDeliveryForViewer(delivery, { isSupplier: true })
            : null,
        };
      })
      .filter(
        (inv) =>
          inv.campaignStatus &&
          ACTIVE_SAMPLING_STATUSES.includes(inv.campaignStatus) &&
          !['WITHDRAWN', 'NOT_SELECTED', 'SELECTED'].includes(inv.status)
      );

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('List my sampling invites error:', error);
    return NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
