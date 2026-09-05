import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, authErrorResponse } from '@/lib/auth';
import {
  SamplingCampaign,
  SamplingInvite,
  SampleSubmission,
  ACTIVE_SAMPLING_STATUSES,
} from '@/models/Sampling';
import { broadcastSamplingStarted } from '@/lib/samplingEvents';
import { ensureSampleDeliveriesForCampaign, formatSampleDeliveryForViewer, resolveSamplingInviteStatus } from '@/lib/sampleDelivery';
import { serializeSampleSubmission } from '@/lib/samplingHelpers';

type Params = { params: Promise<{ id: string }> };

async function loadCampaignDetail(
  campaign: any,
  opts?: { viewerCompanyId?: string; buyerCompanyId?: string }
) {
  const invites = (await SamplingInvite.find({ campaignId: campaign._id }).lean()) as any[];
  const submissionIds = invites.map((i) => i.submissionId).filter(Boolean);
  const submissions = submissionIds.length
    ? ((await SampleSubmission.find({ _id: { $in: submissionIds } }).lean()) as any[])
    : [];
  const submissionMap = new Map(submissions.map((s) => [s._id.toString(), s]));

  const { Company } = await import('@/models/Company');
  const { Bid } = await import('@/models/Bid');
  const { DeliveryOrder } = await import('@/models/Logistics');

  const supplierIds = invites.map((i) => i.supplierCompanyId);
  const companies = (await Company.find({ _id: { $in: supplierIds } }).lean()) as any[];
  const companyMap = new Map(companies.map((c) => [c._id.toString(), c]));

  const deliveryIds = invites.map((i) => i.deliveryOrderId).filter(Boolean);
  const deliveries = deliveryIds.length
    ? ((await DeliveryOrder.find({ _id: { $in: deliveryIds } }).lean()) as any[])
    : [];
  const deliveryMap = new Map(deliveries.map((d) => [d._id.toString(), d]));

  const transporterIds = deliveries.map((d) => d.transporterId).filter(Boolean);
  const transporters = transporterIds.length
    ? ((await Company.find({ _id: { $in: transporterIds } }).lean()) as any[])
    : [];
  const transporterMap = new Map(transporters.map((t) => [t._id.toString(), t]));

  const allBidIds = invites.flatMap((i) => i.bidIds || []);
  const bids = allBidIds.length ? ((await Bid.find({ _id: { $in: allBidIds } }).lean()) as any[]) : [];

  const isViewerBuyer =
    opts?.viewerCompanyId &&
    opts?.buyerCompanyId &&
    opts.viewerCompanyId === opts.buyerCompanyId;

  return {
    ...campaign,
    id: campaign._id.toString(),
    invites: invites.map((inv) => {
      const sub = inv.submissionId ? submissionMap.get(inv.submissionId.toString()) : null;
      const delivery = inv.deliveryOrderId ? deliveryMap.get(inv.deliveryOrderId.toString()) : null;
      const supplier = companyMap.get(inv.supplierCompanyId.toString());
      const transporter =
        delivery?.transporterId ? transporterMap.get(delivery.transporterId.toString()) : null;
      const isViewerSupplier =
        opts?.viewerCompanyId &&
        inv.supplierCompanyId.toString() === opts.viewerCompanyId;

      return {
        ...inv,
        id: inv._id.toString(),
        supplierName: supplier?.name || 'Supplier',
        supplierGstin: supplier?.gstin,
        status: resolveSamplingInviteStatus(inv, delivery),
        submission: serializeSampleSubmission(sub),
        delivery: delivery
          ? formatSampleDeliveryForViewer(delivery, {
              isBuyer: Boolean(isViewerBuyer),
              isSupplier: Boolean(isViewerSupplier),
              transporterName: transporter?.name || null,
            })
          : null,
        bids: bids.filter((b) =>
          (inv.bidIds || []).some((bidId: any) => bidId.toString() === b._id.toString())
        ),
      };
    }),
  };
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthUser(req);
    if (!user || !user.companyId) return authErrorResponse();

    const { id: rfqId } = await params;
    await db();
    const { RFQ } = await import('@/models/RFQ');

    const rfq = (await RFQ.findById(rfqId).lean()) as any;
    if (!rfq) {
      return NextResponse.json({ success: false, code: 'NOT_FOUND', message: 'RFQ not found' }, { status: 404 });
    }

    const campaign = (await SamplingCampaign.findOne({ rfqId }).lean()) as any;
    if (!campaign || !ACTIVE_SAMPLING_STATUSES.includes(campaign.status)) {
      return NextResponse.json({ success: true, data: null });
    }

    const isBuyer = rfq.buyerCompanyId.toString() === user.companyId;
    const isAdmin = user.role === 'PLATFORM_ADMIN';
    const invite = (await SamplingInvite.findOne({
      campaignId: campaign._id,
      supplierCompanyId: user.companyId,
    }).lean()) as any;

    if (!isBuyer && !isAdmin && !invite) {
      return NextResponse.json({ success: false, code: 'FORBIDDEN', message: 'Forbidden' }, { status: 403 });
    }

    if (ACTIVE_SAMPLING_STATUSES.includes(campaign.status)) {
      await ensureSampleDeliveriesForCampaign(rfq, campaign);
    }

    const refreshed = (await SamplingCampaign.findById(campaign._id).lean()) as any;
    const detail = await loadCampaignDetail(refreshed, {
      viewerCompanyId: user.companyId,
      buyerCompanyId: rfq.buyerCompanyId.toString(),
    });

    return NextResponse.json({
      success: true,
      data: {
        ...detail,
        rfqNumber: rfq.rfqNumber,
        rfqTitle: rfq.title,
      },
    });
  } catch (error: any) {
    console.error('Get sampling error:', error);
    return NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthUser(req);
    if (!user || !user.companyId) return authErrorResponse();

    const { id: rfqId } = await params;
    const { bidIds, sampleDeadlineAt, deadlineAt } = await req.json();
    const deadlineRaw = sampleDeadlineAt || deadlineAt;

    if (!bidIds || !Array.isArray(bidIds) || bidIds.length === 0) {
      return NextResponse.json(
        { success: false, code: 'BAD_REQUEST', message: 'Select at least one bid' },
        { status: 400 }
      );
    }

    if (!deadlineRaw) {
      return NextResponse.json(
        { success: false, code: 'BAD_REQUEST', message: 'Sampling deadline is required' },
        { status: 400 }
      );
    }

    const sampleDeadline = new Date(deadlineRaw);
    if (Number.isNaN(sampleDeadline.getTime())) {
      return NextResponse.json(
        { success: false, code: 'BAD_REQUEST', message: 'Invalid sampling deadline' },
        { status: 400 }
      );
    }
    if (sampleDeadline.getTime() <= Date.now()) {
      return NextResponse.json(
        { success: false, code: 'BAD_REQUEST', message: 'Sampling deadline must be in the future' },
        { status: 400 }
      );
    }

    await db();
    const { RFQ } = await import('@/models/RFQ');
    const { Bid } = await import('@/models/Bid');

    const rfq = (await RFQ.findById(rfqId).lean()) as any;
    if (!rfq) {
      return NextResponse.json({ success: false, code: 'NOT_FOUND', message: 'RFQ not found' }, { status: 404 });
    }
    if (rfq.buyerCompanyId.toString() !== user.companyId) {
      return NextResponse.json({ success: false, code: 'FORBIDDEN', message: 'You do not own this RFQ' }, { status: 403 });
    }
    if (!['PUBLISHED', 'SAMPLING'].includes(rfq.status)) {
      return NextResponse.json(
        { success: false, code: 'INVALID_STATUS', message: 'RFQ must be published to start sampling' },
        { status: 400 }
      );
    }

    const existingActive = await SamplingCampaign.findOne({
      rfqId,
      status: { $in: ACTIVE_SAMPLING_STATUSES },
    }).lean();
    if (existingActive) {
      return NextResponse.json(
        { success: false, code: 'ALREADY_EXISTS', message: 'Sampling campaign already active for this RFQ' },
        { status: 400 }
      );
    }

    const priorCampaign = (await SamplingCampaign.findOne({ rfqId }).lean()) as any;

    const bids = (await Bid.find({ _id: { $in: bidIds }, rfqId, status: 'SUBMITTED' }).lean()) as any[];
    if (bids.length !== bidIds.length) {
      return NextResponse.json(
        { success: false, code: 'BAD_REQUEST', message: 'One or more bids are invalid or not submitted' },
        { status: 400 }
      );
    }

    const supplierMap = new Map<string, string[]>();
    for (const bid of bids) {
      const sid = bid.supplierCompanyId.toString();
      if (!supplierMap.has(sid)) supplierMap.set(sid, []);
      supplierMap.get(sid)!.push(bid._id.toString());
    }

    if (supplierMap.size > 5) {
      return NextResponse.json(
        { success: false, code: 'BAD_REQUEST', message: 'Maximum 5 supplier companies for sampling' },
        { status: 400 }
      );
    }

    const allBidsForSuppliers = (await Bid.find({
      rfqId,
      supplierCompanyId: { $in: [...supplierMap.keys()] },
      status: 'SUBMITTED',
    }).lean()) as any[];

    const mongoose = await import('mongoose');
    const session = await mongoose.default.startSession();
    let campaignDoc: any;

    try {
      session.startTransaction();

      if (priorCampaign) {
        const oldInvites = (await SamplingInvite.find({ campaignId: priorCampaign._id })
          .session(session)
          .lean()) as any[];
        const oldInviteIds = oldInvites.map((i) => i._id);
        const oldSubmissionIds = oldInvites.map((i) => i.submissionId).filter(Boolean);

        if (oldSubmissionIds.length) {
          await SampleSubmission.deleteMany({ _id: { $in: oldSubmissionIds } }, { session });
        }
        if (oldInviteIds.length) {
          await SamplingInvite.deleteMany({ _id: { $in: oldInviteIds } }, { session });
        }

        campaignDoc = (await SamplingCampaign.findByIdAndUpdate(
          priorCampaign._id,
          {
            $set: {
              buyerCompanyId: user.companyId,
              status: 'OPEN',
              maxParticipants: 5,
              sampleDeadlineAt: sampleDeadline,
            },
            $unset: {
              winnerSupplierCompanyId: '',
              winnerInviteId: '',
            },
          },
          { new: true, session }
        )) as any;
      } else {
        const created = await SamplingCampaign.create(
          [
            {
              rfqId,
              buyerCompanyId: user.companyId,
              status: 'OPEN',
              maxParticipants: 5,
              sampleDeadlineAt: sampleDeadline,
            },
          ],
          { session }
        );
        campaignDoc = created[0];
      }

      for (const [supplierId] of supplierMap.entries()) {
        const allSupplierBidIds = allBidsForSuppliers
          .filter((b) => b.supplierCompanyId.toString() === supplierId)
          .map((b) => b._id);

        await SamplingInvite.create(
          [
            {
              campaignId: campaignDoc._id,
              supplierCompanyId: supplierId,
              bidIds: allSupplierBidIds,
              status: 'INVITED',
            },
          ],
          { session }
        );
      }

      await RFQ.updateOne({ _id: rfqId }, { $set: { status: 'SAMPLING' } }, { session });

      await session.commitTransaction();
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }

    await broadcastSamplingStarted(
      user.companyId,
      [...supplierMap.keys()],
      rfq.rfqNumber,
      sampleDeadline
    );

    const detail = await loadCampaignDetail(campaignDoc.toObject(), {
      viewerCompanyId: user.companyId,
      buyerCompanyId: rfq.buyerCompanyId.toString(),
    });

    return NextResponse.json({
      success: true,
      message: priorCampaign
        ? `Sampling restarted with ${supplierMap.size} supplier(s)`
        : `Sampling started with ${supplierMap.size} supplier(s)`,
      data: detail,
    });
  } catch (error: any) {
    console.error('Start sampling error:', error);
    if (error?.code === 11000) {
      return NextResponse.json(
        {
          success: false,
          code: 'ALREADY_EXISTS',
          message: 'A sampling record already exists for this RFQ. Refresh the page and try again.',
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
