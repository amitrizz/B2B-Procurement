import mongoose from 'mongoose';
import crypto from 'crypto';
import { SamplingCampaign, SamplingInvite, ACTIVE_SAMPLING_STATUSES } from '@/models/Sampling';

export type SampleDeliveryResult = {
  delivery: any;
  pickupOtp: string;
  deliveryOtp: string;
  invite: any;
};

/** Public delivery fields + role-specific OTP for sampling UI. */
export function formatSampleDeliveryForViewer(
  delivery: any,
  opts: {
    isBuyer?: boolean;
    isSupplier?: boolean;
    transporterName?: string | null;
  }
) {
  if (!delivery?._id && !delivery?.id) return null;

  const base: any = {
    id: delivery._id?.toString() || delivery.id,
    deliveryNumber: delivery.deliveryNumber,
    status: delivery.status,
    purpose: delivery.purpose,
    transporterName: opts.transporterName ?? null,
    transporterId: delivery.transporterId?.toString?.() || null,
  };

  if (opts.isSupplier && delivery.pickupOtp && ['CREATED', 'ACCEPTED'].includes(delivery.status)) {
    base.pickupOtp = delivery.pickupOtp;
  }
  if (
    opts.isBuyer &&
    delivery.deliveryOtp &&
    ['ACCEPTED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED'].includes(delivery.status)
  ) {
    base.deliveryOtp = delivery.deliveryOtp;
  }

  return base;
}

/** Human-readable invite status aligned with sample delivery progress. */
export function resolveSamplingInviteStatus(inv: any, delivery: any) {
  if (['SELECTED', 'NOT_SELECTED', 'WITHDRAWN', 'DELIVERED'].includes(inv?.status)) {
    return inv.status;
  }
  const ds = delivery?.status;
  if (ds === 'DELIVERED') return 'DELIVERED';
  if (ds === 'PICKED_UP' || ds === 'IN_TRANSIT') return 'PICKED_UP';
  if (ds === 'ACCEPTED' || ds === 'CREATED') {
    return inv?.status === 'SUBMITTED' && delivery ? 'IN_TRANSIT' : inv?.status || 'INVITED';
  }
  return inv?.status || 'INVITED';
}

/** Create a sample pickup delivery job for transporters (open marketplace accept). */
export async function createSampleDeliveryForInvite(
  rfq: any,
  campaign: any,
  invite: any,
  session?: mongoose.ClientSession
): Promise<SampleDeliveryResult> {
  if (invite.deliveryOrderId) {
    const { DeliveryOrder } = await import('@/models/Logistics');
    const existing = (await DeliveryOrder.findById(invite.deliveryOrderId).session(session || null).lean()) as any;
    if (existing) {
      return {
        delivery: existing,
        pickupOtp: existing.pickupOtp || '',
        deliveryOtp: existing.deliveryOtp || '',
        invite,
      };
    }
  }

  const { CompanyAddress } = await import('@/models/Company');
  const { DeliveryOrder } = await import('@/models/Logistics');

  const supplierAddresses = (await CompanyAddress.find({
    companyId: invite.supplierCompanyId,
  })
    .session(session || null)
    .lean()) as any[];
  const buyerAddresses = (await CompanyAddress.find({
    companyId: rfq.buyerCompanyId,
  })
    .session(session || null)
    .lean()) as any[];

  const pickupAddr = supplierAddresses.find((a) => a.isPrimary) || supplierAddresses[0];
  const dropAddr =
    (rfq.deliveryAddressId &&
      buyerAddresses.find((a) => a._id.toString() === rfq.deliveryAddressId.toString())) ||
    buyerAddresses.find((a) => a.isPrimary) ||
    buyerAddresses[0];

  const formatAddr = (a: any) =>
    a ? `${a.addressLine1}, ${a.city}, ${a.state} - ${a.pincode}` : '';

  const deliveryNumber = 'SDEL-' + Math.floor(100000 + Math.random() * 900000);
  const pickupOtp = Math.floor(100000 + Math.random() * 900000).toString();
  const pickupOtpHash = crypto.createHash('sha256').update(pickupOtp).digest('hex');
  const deliveryOtp = Math.floor(100000 + Math.random() * 900000).toString();
  const deliveryOtpHash = crypto.createHash('sha256').update(deliveryOtp).digest('hex');

  const createOpts = session ? { session } : {};
  const deliveryDoc = await DeliveryOrder.create(
    [
      {
        deliveryNumber,
        purpose: 'SAMPLE',
        samplingInviteId: invite._id,
        rfqId: rfq._id,
        assignedToPlatform: false,
        status: 'CREATED',
        deliveryCharge: 0,
        pickupAddressSnapshot: formatAddr(pickupAddr),
        dropAddressSnapshot: formatAddr(dropAddr),
        pickupOtp,
        pickupOtpHash,
        deliveryOtp,
        deliveryOtpHash,
      },
    ],
    createOpts
  );

  const delivery =
    typeof deliveryDoc[0]?.toObject === 'function' ? deliveryDoc[0].toObject() : deliveryDoc[0];

  await SamplingInvite.updateOne(
    { _id: invite._id },
    { $set: { deliveryOrderId: delivery._id, status: 'IN_TRANSIT' } },
    createOpts
  );

  await SamplingCampaign.updateOne(
    { _id: campaign._id },
    { $set: { status: 'IN_TRANSIT' } },
    createOpts
  );

  return { delivery, pickupOtp, deliveryOtp, invite };
}

/** Repair invites stuck at SUBMITTED without a delivery job. */
export async function ensureSampleDeliveriesForCampaign(rfq: any, campaign: any) {
  const stuck = (await SamplingInvite.find({
    campaignId: campaign._id,
    status: 'SUBMITTED',
    $or: [{ deliveryOrderId: { $exists: false } }, { deliveryOrderId: null }],
  }).lean()) as any[];

  for (const invite of stuck) {
    if (invite.deliveryOrderId) continue;
    try {
      await createSampleDeliveryForInvite(rfq, campaign, invite);
    } catch (err) {
      console.warn('ensureSampleDelivery failed for invite', invite._id, err);
    }
  }
}

/** Create missing sample pickup jobs before listing deliveries (admin/transporter portal). */
export async function ensureAllPendingSampleDeliveries() {
  const campaigns = (await SamplingCampaign.find({
    status: { $in: ACTIVE_SAMPLING_STATUSES },
  }).lean()) as any[];

  if (!campaigns.length) return;

  const { RFQ } = await import('@/models/RFQ');
  const { DeliveryOrder } = await import('@/models/Logistics');

  for (const campaign of campaigns) {
    const rfq = (await RFQ.findById(campaign.rfqId).lean()) as any;
    if (rfq) {
      await ensureSampleDeliveriesForCampaign(rfq, campaign);
    }
  }

  await DeliveryOrder.updateMany(
    { purpose: 'SAMPLE', status: 'CREATED', assignedToPlatform: true },
    { $set: { assignedToPlatform: false } }
  );
}
