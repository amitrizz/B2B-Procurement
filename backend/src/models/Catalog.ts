import mongoose, { Schema } from 'mongoose';

// PurchaseRequisitionLine
const PurchaseRequisitionLineSchema = new Schema({
  prId: { type: Schema.Types.ObjectId, ref: 'PurchaseRequisition', required: true },
  componentName: { type: String, required: true },
  quantity: { type: Number, required: true },
  unit: { type: String, required: true },
  estimatedPrice: { type: Number, required: true }
});

export const PurchaseRequisitionLine = mongoose.models.PurchaseRequisitionLine || mongoose.model('PurchaseRequisitionLine', PurchaseRequisitionLineSchema);

// PurchaseRequisition
const PurchaseRequisitionSchema = new Schema({
  prNumber: { type: String, required: true, unique: true },
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  createdByUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  approverUserId: { type: Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, default: 'SUBMITTED' },
  title: { type: String },
  description: { type: String },
  totalEstimated: { type: Number, default: 0 }
}, { timestamps: true });

export const PurchaseRequisition = mongoose.models.PurchaseRequisition || mongoose.model('PurchaseRequisition', PurchaseRequisitionSchema);

// ApprovalRule
const ApprovalRuleSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  minPaise: { type: Number, required: true },
  maxPaise: { type: Number, required: true },
  role: { type: String, required: true }
}, { timestamps: { createdAt: true, updatedAt: false } });

export const ApprovalRule = mongoose.models.ApprovalRule || mongoose.model('ApprovalRule', ApprovalRuleSchema);

// CatalogItem
const CatalogItemSchema = new Schema({
  supplierCompanyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  name: { type: String, required: true },
  description: { type: String },
  hsnCode: { type: String, required: true },
  unitPrice: { type: Number, required: true },
  validTo: { type: Date, required: true }
}, { timestamps: true });

export const CatalogItem = mongoose.models.CatalogItem || mongoose.model('CatalogItem', CatalogItemSchema);

// CompanyComponent
const CompanyComponentSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  componentName: { type: String, required: true },
  description: { type: String },
  defaultUnit: { type: String, default: 'pcs' }
}, { timestamps: true });

CompanyComponentSchema.index({ companyId: 1, componentName: 1 }, { unique: true });

export const CompanyComponent = mongoose.models.CompanyComponent || mongoose.model('CompanyComponent', CompanyComponentSchema);

// CompanyCategory
const CompanyCategorySchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  categoryName: { type: String, required: true },
  description: { type: String }
}, { timestamps: true });

export const CompanyCategory = mongoose.models.CompanyCategory || mongoose.model('CompanyCategory', CompanyCategorySchema);
