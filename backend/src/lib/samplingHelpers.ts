import { ACTIVE_SAMPLING_STATUSES, SamplingCampaign } from '@/models/Sampling';

/** Returns active sampling campaign for RFQ if any. */
export async function getActiveSamplingCampaign(rfqId: string) {
  return SamplingCampaign.findOne({
    rfqId,
    status: { $in: ACTIVE_SAMPLING_STATUSES },
  }).lean();
}

export async function assertNoActiveSampling(rfqId: string) {
  const active = await getActiveSamplingCampaign(rfqId);
  if (active) {
    throw new Error('Complete or cancel the active sampling campaign before awarding bids directly.');
  }
}

/** Plain JSON-safe sample submission (avoids Mongoose/MongoClient circular refs). */
export function serializeSampleSubmission(submission: any) {
  if (!submission) return null;
  const plain =
    typeof submission.toObject === 'function'
      ? submission.toObject({ getters: false, virtuals: false })
      : submission;
  return {
    id: plain._id?.toString?.() || plain.id,
    notes: plain.notes || '',
    photoFileIds: plain.photoFileIds || [],
    submittedAt: plain.submittedAt,
    pickupAddressId: plain.pickupAddressId?.toString?.() || plain.pickupAddressId || null,
  };
}
