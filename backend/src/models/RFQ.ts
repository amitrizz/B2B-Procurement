import mongoose, { Schema } from 'mongoose';

// RFQItem
const RFQItemSchema = new Schema({
  rfqId: { type: Schema.Types.ObjectId, ref: 'RFQ', required: true },
  componentName: { type: String, required: true },
  drawingFileId: { type: String, required: true },
  drawingRevision: { type: String },
  quantity: { type: Number, required: true },
  unit: { type: String, required: true },
  specification: { type: String },
  hsnCode: { type: String, required: true },
  materialOptionPreference: { type: String, default: 'BOTH' },
  expectedTimeDays: { type: Number },
  processTags: [{ type: String }]
});

export const RFQItem = mongoose.models.RFQItem || mongoose.model('RFQItem', RFQItemSchema);

// RfqQuestion
const RfqQuestionSchema = new Schema({
  rfqId: { type: Schema.Types.ObjectId, ref: 'RFQ', required: true },
  supplierId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  question: { type: String, required: true },
  answer: { type: String },
  answeredAt: { type: Date }
}, { timestamps: { createdAt: true, updatedAt: false } });

export const RfqQuestion = mongoose.models.RfqQuestion || mongoose.model('RfqQuestion', RfqQuestionSchema);

// RFQ
const RFQSchema = new Schema({
  buyerCompanyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  rfqNumber: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  description: { type: String },
  category: { type: String },
  status: { type: String, default: 'DRAFT' },
  bidStartAt: { type: Date },
  bidEndAt: { type: Date },
  requiredDeliveryDate: { type: Date },
  deliveryAddressId: { type: Schema.Types.ObjectId, ref: 'CompanyAddress' },
  expectedBudget: { type: Number },
  buyerPrId: { type: Schema.Types.ObjectId, ref: 'PurchaseRequisition' },
  sourcePurchaseOrderId: { type: Schema.Types.ObjectId, ref: 'PurchaseOrder' },
  sourceChatThreadId: { type: Schema.Types.ObjectId, ref: 'CompanyChatThread' },
  invitedSupplierCompanyId: { type: Schema.Types.ObjectId, ref: 'Company' },
  version: { type: Number, default: 0 }
}, { timestamps: true });

export const RFQ = mongoose.models.RFQ || mongoose.model('RFQ', RFQSchema);
