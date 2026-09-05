import mongoose, { Schema } from 'mongoose';

const CompanyChatThreadSchema = new Schema(
  {
    purchaseOrderId: { type: Schema.Types.ObjectId, ref: 'PurchaseOrder', required: true },
    purpose: {
      type: String,
      enum: ['ORDER_STATUS', 'REPEAT_ORDER'],
      required: true,
      default: 'ORDER_STATUS',
    },
    buyerCompanyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    supplierCompanyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    lastMessageAt: { type: Date, default: Date.now },
    lastMessagePreview: { type: String, default: '' },
  },
  { timestamps: true }
);

CompanyChatThreadSchema.index(
  { purchaseOrderId: 1, purpose: 1 },
  { unique: true, name: 'purchaseOrderId_1_purpose_1' }
);

CompanyChatThreadSchema.index({ buyerCompanyId: 1, lastMessageAt: -1 });
CompanyChatThreadSchema.index({ supplierCompanyId: 1, lastMessageAt: -1 });

const CompanyChatMessageSchema = new Schema(
  {
    threadId: { type: Schema.Types.ObjectId, ref: 'CompanyChatThread', required: true },
    senderCompanyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    senderUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    messageType: { type: String, enum: ['QUESTION', 'ANSWER'] },
    questionId: { type: Schema.Types.ObjectId, ref: 'ChatQuestion' },
    answerId: { type: Schema.Types.ObjectId },
    templateKey: { type: String, required: true },
    label: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

CompanyChatMessageSchema.index({ threadId: 1, createdAt: 1 });

function getOrRegisterModel<T>(name: string, schema: Schema<T>, requiredPath?: string): mongoose.Model<T> {
  const existing = mongoose.models[name];
  if (existing && requiredPath && !existing.schema.path(requiredPath)) {
    delete mongoose.models[name];
  }
  return mongoose.models[name] || mongoose.model<T>(name, schema);
}

/** Always resolves a model that includes the purpose field (avoids stale hot-reload cache). */
export function getCompanyChatThreadModel() {
  return getOrRegisterModel('CompanyChatThread', CompanyChatThreadSchema, 'purpose');
}

export function getCompanyChatMessageModel() {
  return getOrRegisterModel('CompanyChatMessage', CompanyChatMessageSchema, 'messageType');
}
