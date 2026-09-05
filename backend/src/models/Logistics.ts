import mongoose, { Schema } from 'mongoose';

// TransporterDocument
const TransporterDocumentSchema = new Schema({
  transporterId: { type: Schema.Types.ObjectId, ref: 'Transporter', required: true },
  documentType: { type: String, required: true },
  fileId: { type: String, required: true },
  verified: { type: Boolean, default: false }
});

export const TransporterDocument = mongoose.models.TransporterDocument || mongoose.model('TransporterDocument', TransporterDocumentSchema);

// DeliveryOrder
const DeliveryOrderSchema = new Schema({
  deliveryNumber: { type: String, required: true, unique: true },
  purchaseOrderId: { type: Schema.Types.ObjectId, ref: 'PurchaseOrder', required: true, unique: true },
  transporterId: { type: Schema.Types.ObjectId, ref: 'Transporter' },
  status: { type: String, default: 'CREATED' },
  deliveryCharge: { type: Number, default: 0 },
  pickupAddressSnapshot: { type: String },
  dropAddressSnapshot: { type: String },
  podFileId: { type: String },
  otpHash: { type: String },
  otp: { type: String }, // Legacy Plaintext OTP
  pickupOtp: { type: String },
  pickupOtpHash: { type: String },
  deliveryOtp: { type: String },
  deliveryOtpHash: { type: String }
}, { timestamps: { createdAt: true, updatedAt: false } });

export const DeliveryOrder = mongoose.models.DeliveryOrder || mongoose.model('DeliveryOrder', DeliveryOrderSchema);

// Transporter
const TransporterSchema = new Schema({
  name: { type: String, required: true },
  contactPhone: { type: String, required: true },
  serviceAreas: { type: String },
  vehicleTypes: { type: String },
  status: { type: String, default: 'PENDING' },
  bankAccountRef: { type: String }
}, { timestamps: { createdAt: true, updatedAt: false } });

export const Transporter = mongoose.models.Transporter || mongoose.model('Transporter', TransporterSchema);
