import mongoose, { Schema } from 'mongoose';

const MachineMasterSchema = new Schema({
  name: { type: String, required: true, trim: true },
  model: { type: String, trim: true },
  description: { type: String, trim: true },
  isActive: { type: Boolean, default: true }
}, { 
  timestamps: true,
  collection: 'MachineMaster'
});

export const MachineMaster = mongoose.models.MachineMaster || mongoose.model('MachineMaster', MachineMasterSchema);
