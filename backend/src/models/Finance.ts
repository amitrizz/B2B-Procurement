import mongoose, { Schema } from 'mongoose';

// InvoiceLine
const InvoiceLineSchema = new Schema({
  invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice', required: true },
  description: { type: String, required: true },
  hsnCode: { type: String },
  qty: { type: Number, required: true },
  unitPrice: { type: Number, required: true },
  taxable: { type: Number, required: true },
  taxRateBps: { type: Number, default: 1800 },
  taxAmount: { type: Number, required: true }
});

export const InvoiceLine = mongoose.models.InvoiceLine || mongoose.model('InvoiceLine', InvoiceLineSchema);

// Payment
const PaymentSchema = new Schema({
  invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice', required: true },
  amount: { type: Number, required: true },
  method: { type: String, required: true },
  utrNumber: { type: String },
  proofFileId: { type: String },
  status: { type: String, default: 'CREATED' },
  heldAt: { type: Date },
  releasedAt: { type: Date }
}, { timestamps: true });

export const Payment = mongoose.models.Payment || mongoose.model('Payment', PaymentSchema);

// LedgerEntry
const LedgerEntrySchema = new Schema({
  paymentId: { type: Schema.Types.ObjectId, ref: 'Payment' },
  companyId: { type: Schema.Types.ObjectId, ref: 'Company' },
  type: { type: String, required: true },
  amount: { type: Number, required: true }
}, { timestamps: { createdAt: true, updatedAt: false } });

export const LedgerEntry = mongoose.models.LedgerEntry || mongoose.model('LedgerEntry', LedgerEntrySchema);

// CreditNote
const CreditNoteSchema = new Schema({
  cnNumber: { type: String, required: true, unique: true },
  invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice', required: true },
  amount: { type: Number, required: true },
  reason: { type: String }
}, { timestamps: { createdAt: true, updatedAt: false } });

export const CreditNote = mongoose.models.CreditNote || mongoose.model('CreditNote', CreditNoteSchema);

// Invoice
const InvoiceSchema = new Schema({
  number: { type: String, required: true, unique: true },
  type: { type: String, required: true },
  purchaseOrderId: { type: Schema.Types.ObjectId, ref: 'PurchaseOrder' },
  payerCompanyId: { type: Schema.Types.ObjectId, ref: 'Company' },
  payeeCompanyId: { type: Schema.Types.ObjectId, ref: 'Company' },
  payeeType: { type: String },
  sellerGstin: { type: String },
  buyerGstin: { type: String },
  placeOfSupplyState: { type: String },
  taxable: { type: Number, required: true },
  cgstAmount: { type: Number, default: 0 },
  sgstAmount: { type: Number, default: 0 },
  igstAmount: { type: Number, default: 0 },
  total: { type: Number, required: true },
  status: { type: String, default: 'UNPAID' },
  irn: { type: String },
  ackNo: { type: String },
  signedQr: { type: String }
}, { timestamps: true });

export const Invoice = mongoose.models.Invoice || mongoose.model('Invoice', InvoiceSchema);
