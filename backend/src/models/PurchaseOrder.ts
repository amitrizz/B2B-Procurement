import mongoose, { Schema } from 'mongoose';

// PurchaseOrderItem
const PurchaseOrderItemSchema = new Schema({
  purchaseOrderId: { type: Schema.Types.ObjectId, ref: 'PurchaseOrder', required: true },
  rfqItemId: { type: Schema.Types.ObjectId, ref: 'RFQItem', required: true },
  bidId: { type: Schema.Types.ObjectId, ref: 'Bid', required: true },
  quantity: { type: Number, required: true },
  unitPrice: { type: Number, required: true },
  materialOption: { type: String, required: true },
  taxRateBps: { type: Number, default: 1800 },
  taxAmount: { type: Number, required: true }
});

export const PurchaseOrderItem = mongoose.models.PurchaseOrderItem || mongoose.model('PurchaseOrderItem', PurchaseOrderItemSchema);

// PurchaseOrderRevision
const PurchaseOrderRevisionSchema = new Schema({
  purchaseOrderId: { type: Schema.Types.ObjectId, ref: 'PurchaseOrder', required: true },
  version: { type: Number, required: true },
  snapshot: { type: String, required: true }
}, { timestamps: { createdAt: true, updatedAt: false } });

export const PurchaseOrderRevision = mongoose.models.PurchaseOrderRevision || mongoose.model('PurchaseOrderRevision', PurchaseOrderRevisionSchema);

// GoodsReceipt
const GoodsReceiptSchema = new Schema({
  purchaseOrderId: { type: Schema.Types.ObjectId, ref: 'PurchaseOrder', required: true },
  decision: { type: String, required: true },
  notes: { type: String },
  createdByUserId: { type: Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: { createdAt: true, updatedAt: false } });

export const GoodsReceipt = mongoose.models.GoodsReceipt || mongoose.model('GoodsReceipt', GoodsReceiptSchema);

// PurchaseOrder
const PurchaseOrderSchema = new Schema({
  poNumber: { type: String, required: true, unique: true },
  rfqId: { type: Schema.Types.ObjectId, ref: 'RFQ' },
  buyerCompanyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  supplierCompanyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  status: { type: String, default: 'CREATED' },
  totalAmount: { type: Number, required: true },
  taxAmount: { type: Number, required: true },
  commissionAmount: { type: Number, required: true },
  deliveryCharge: { type: Number, default: 0 },
  placeOfSupplyState: { type: String },
  cgstAmount: { type: Number, default: 0 },
  sgstAmount: { type: Number, default: 0 },
  igstAmount: { type: Number, default: 0 },
  orderType: { type: String, default: 'PRODUCTION' },
  paymentTermsDays: { type: Number, default: 30 },
  escrowRequired: { type: Boolean, default: true },
  sourcePurchaseOrderId: { type: Schema.Types.ObjectId, ref: 'PurchaseOrder' },
  sourceChatThreadId: { type: Schema.Types.ObjectId, ref: 'CompanyChatThread' },
  expectedDeliveryDate: { type: Date },
  version: { type: Number, default: 0 },
  workImageId: { type: String },
  workImage20: { type: String },
  workImage40: { type: String },
  workImage60: { type: String },
  workImage80: { type: String },
  milestoneApproved: { type: String }
}, { timestamps: true });

export const PurchaseOrder = mongoose.models.PurchaseOrder || mongoose.model('PurchaseOrder', PurchaseOrderSchema);
