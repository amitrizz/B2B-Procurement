import mongoose, { Schema } from 'mongoose';

// CompanyAddress
const CompanyAddressSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  state: { type: String, required: true },
  addressLine1: { type: String, required: true },
  addressLine2: { type: String },
  city: { type: String, required: true },
  pincode: { type: String, required: true },
  isPrimary: { type: Boolean, default: false }
});

export const CompanyAddress = mongoose.models.CompanyAddress || mongoose.model('CompanyAddress', CompanyAddressSchema);

// CompanyDocument
const CompanyDocumentSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  documentType: { type: String, required: true },
  fileId: { type: String, required: true },
  verified: { type: Boolean, default: false }
});

export const CompanyDocument = mongoose.models.CompanyDocument || mongoose.model('CompanyDocument', CompanyDocumentSchema);

// CompanyBankAccount
const CompanyBankAccountSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, unique: true },
  accountName: { type: String, required: true },
  ifsc: { type: String, required: true },
  accountNumberLast4: { type: String, required: true },
  accountNumberHash: { type: String, required: true },
  isPrimary: { type: Boolean, default: false }
}, { timestamps: true, collection: 'CompanyBankAccount' });

export const CompanyBankAccount = mongoose.models.CompanyBankAccount || mongoose.model('CompanyBankAccount', CompanyBankAccountSchema);

// CompanyCapability
const CompanyCapabilitySchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  processes: [{ type: String }],
  verifiedAt: { type: Date }
}, { timestamps: true, collection: 'CompanyCapability' });

export const CompanyCapability = mongoose.models.CompanyCapability || mongoose.model('CompanyCapability', CompanyCapabilitySchema);

// Company
const CompanySchema = new Schema({
  gstin: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  pan: { type: String },
  phone: { type: String },
  status: { type: String, default: 'PENDING' },
  kycRejectReason: { type: String },
  drawingsNdaAcceptedAt: { type: Date },
  requirePr: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

if (mongoose.models.Company) {
  delete mongoose.models.Company;
}
export const Company = mongoose.model('Company', CompanySchema);
