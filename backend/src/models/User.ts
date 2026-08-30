import mongoose, { Schema } from 'mongoose';

// RefreshToken
const RefreshTokenSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  token: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true },
  revoked: { type: Boolean, default: false }
}, { timestamps: { createdAt: true, updatedAt: false }, collection: 'RefreshToken' });

export const RefreshToken = mongoose.models.RefreshToken || mongoose.model('RefreshToken', RefreshTokenSchema);

// Notification
const NotificationSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  read: { type: Boolean, default: false }
}, { timestamps: { createdAt: true, updatedAt: false }, collection: 'Notification' });

export const Notification = mongoose.models.Notification || mongoose.model('Notification', NotificationSchema);

// User
const UserSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company' },
  email: { type: String, required: true, unique: true },
  name: { type: String },
  passwordHash: { type: String, required: true },
  role: { type: String, required: true },
  emailVerified: { type: Boolean, default: false }
}, { timestamps: { createdAt: true, updatedAt: false }, collection: 'User' });

export const User = mongoose.models.User || mongoose.model('User', UserSchema);

// PushSubscription
const PushSubscriptionSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  endpoint: { type: String, required: true },
  keys: {
    p256dh: { type: String, required: true },
    auth: { type: String, required: true }
  }
}, { timestamps: true, collection: 'PushSubscription' });

export const PushSubscription = mongoose.models.PushSubscription || mongoose.model('PushSubscription', PushSubscriptionSchema);
