import mongoose, { Schema } from 'mongoose';

// Delete cached model if it exists to prevent dev-server caching issues
if (mongoose.models && mongoose.models.AuthOtp) {
  delete mongoose.models.AuthOtp;
}

const AuthOtpSchema = new Schema({
  email: { 
    type: String, 
    required: true, 
    lowercase: true, 
    trim: true, 
    index: true 
  },
  otp: { 
    type: String, 
    required: true 
  },
  type: { 
    type: String, 
    enum: ['LOGIN', 'REGISTER'], 
    required: true 
  },
  payload: { 
    type: Schema.Types.Mixed 
  },
  expiresAt: { 
    type: Date, 
    required: true 
  }
}, { 
  timestamps: true, 
  collection: 'AuthOtp' 
});

// TTL index to automatically remove expired OTP records
AuthOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const AuthOtp = mongoose.models.AuthOtp || mongoose.model('AuthOtp', AuthOtpSchema);
