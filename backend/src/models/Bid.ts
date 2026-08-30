import mongoose, { Schema } from 'mongoose';

const BidSchema = new Schema({
  bidNumber: { type: String, required: true, unique: true },
  rfqId: { type: Schema.Types.ObjectId, ref: 'RFQ', required: true },
  rfqItemId: { type: Schema.Types.ObjectId, ref: 'RFQItem', required: true },
  supplierCompanyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  quantity: { type: Number, required: true },
  priceWithoutMaterial: { type: Number, required: true },
  priceWithMaterial: { type: Number, required: true },
  materialOptionPreference: { type: String },
  estimatedTimeDays: { type: Number, required: true },
  proposedDeliveryDate: { type: Date },
  terms: { type: String },
  status: { type: String, default: 'SUBMITTED' },
  version: { type: Number, default: 0 }
}, { timestamps: true });

export const Bid = mongoose.models.Bid || mongoose.model('Bid', BidSchema);
