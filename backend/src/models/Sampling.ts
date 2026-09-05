import mongoose, { Schema } from 'mongoose';

const SamplingCampaignSchema = new Schema(
  {
    rfqId: { type: Schema.Types.ObjectId, ref: 'RFQ', required: true, unique: true },
    buyerCompanyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    status: {
      type: String,
      default: 'OPEN',
      enum: ['OPEN', 'COLLECTING', 'IN_TRANSIT', 'DELIVERED', 'EVALUATION', 'AWARDED', 'CANCELLED'],
    },
    maxParticipants: { type: Number, default: 5 },
    sampleDeadlineAt: { type: Date },
    winnerSupplierCompanyId: { type: Schema.Types.ObjectId, ref: 'Company' },
    winnerInviteId: { type: Schema.Types.ObjectId, ref: 'SamplingInvite' },
  },
  { timestamps: true, collection: 'SamplingCampaign' }
);

export const SamplingCampaign =
  mongoose.models.SamplingCampaign || mongoose.model('SamplingCampaign', SamplingCampaignSchema);

const SampleSubmissionSchema = new Schema(
  {
    inviteId: { type: Schema.Types.ObjectId, ref: 'SamplingInvite', required: true, unique: true },
    notes: { type: String },
    photoFileIds: [{ type: String }],
    submittedAt: { type: Date, required: true },
    pickupAddressId: { type: Schema.Types.ObjectId, ref: 'CompanyAddress' },
  },
  { timestamps: true, collection: 'SampleSubmission' }
);

export const SampleSubmission =
  mongoose.models.SampleSubmission || mongoose.model('SampleSubmission', SampleSubmissionSchema);

const SamplingInviteSchema = new Schema(
  {
    campaignId: { type: Schema.Types.ObjectId, ref: 'SamplingCampaign', required: true },
    supplierCompanyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    bidIds: [{ type: Schema.Types.ObjectId, ref: 'Bid' }],
    status: {
      type: String,
      default: 'INVITED',
      enum: [
        'INVITED',
        'PREPARING',
        'SUBMITTED',
        'IN_TRANSIT',
        'PICKED_UP',
        'DELIVERED',
        'SELECTED',
        'NOT_SELECTED',
        'WITHDRAWN',
      ],
    },
    submissionId: { type: Schema.Types.ObjectId, ref: 'SampleSubmission' },
    deliveryOrderId: { type: Schema.Types.ObjectId, ref: 'DeliveryOrder' },
  },
  { timestamps: true, collection: 'SamplingInvite' }
);

SamplingInviteSchema.index({ campaignId: 1, supplierCompanyId: 1 }, { unique: true });

export const SamplingInvite =
  mongoose.models.SamplingInvite || mongoose.model('SamplingInvite', SamplingInviteSchema);

/** Active campaign statuses that block direct bid award. */
export const ACTIVE_SAMPLING_STATUSES = ['OPEN', 'COLLECTING', 'IN_TRANSIT', 'DELIVERED', 'EVALUATION'];
