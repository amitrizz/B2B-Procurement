import mongoose, { Schema } from 'mongoose';

// NumberSequence
const NumberSequenceSchema = new Schema({
  prefix: { type: String, required: true },
  fy: { type: String, required: true },
  lastValue: { type: Number, required: true }
});

NumberSequenceSchema.index({ prefix: 1, fy: 1 }, { unique: true });

export const NumberSequence = mongoose.models.NumberSequence || mongoose.model('NumberSequence', NumberSequenceSchema);

// AuditLog
const AuditLogSchema = new Schema({
  actorUserId: { type: Schema.Types.ObjectId, ref: 'User' },
  action: { type: String, required: true },
  entityType: { type: String, required: true },
  entityId: { type: String, required: true },
  payload: { type: String, required: true } // JSON string
}, { timestamps: { createdAt: true, updatedAt: false } });

export const AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', AuditLogSchema);

// FileStorage
const FileStorageSchema = new Schema({
  filename: { type: String, required: true },
  mimeType: { type: String, required: true },
  data: { type: String, required: true }, // Base64 encoded file content
  objectKey: { type: String }
}, { timestamps: { createdAt: true, updatedAt: false } });

export const FileStorage = mongoose.models.FileStorage || mongoose.model('FileStorage', FileStorageSchema);

// Dispute
const DisputeSchema = new Schema({
  purchaseOrderId: { type: Schema.Types.ObjectId, ref: 'PurchaseOrder', required: true },
  category: { type: String, required: true },
  status: { type: String, default: 'OPEN' },
  outcomeType: { type: String },
  refundAmount: { type: Number },
  notes: { type: String }
}, { timestamps: { createdAt: true, updatedAt: false } });

export const Dispute = mongoose.models.Dispute || mongoose.model('Dispute', DisputeSchema);

// Review
const ReviewSchema = new Schema({
  purchaseOrderId: { type: Schema.Types.ObjectId, ref: 'PurchaseOrder', required: true },
  reviewerCompanyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  reviewedCompanyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  rating: { type: Number, required: true },
  comment: { type: String }
}, { timestamps: { createdAt: true, updatedAt: false } });

ReviewSchema.index({ purchaseOrderId: 1, reviewerCompanyId: 1, reviewedCompanyId: 1 }, { unique: true });

export const Review = mongoose.models.Review || mongoose.model('Review', ReviewSchema);

// PlatformConfig
const PlatformConfigSchema = new Schema({
  commissionBps: { type: Number, default: 500 },
  poAcceptHours: { type: Number, default: 48 },
  grnAutoAcceptDays: { type: Number, default: 7 },
  platformState: { type: String, default: 'Maharashtra' }
}, { timestamps: true });

export const PlatformConfig = mongoose.models.PlatformConfig || mongoose.model('PlatformConfig', PlatformConfigSchema);
