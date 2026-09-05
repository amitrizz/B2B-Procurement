import mongoose, { Schema } from 'mongoose';

const ChatAnswerSchema = new Schema(
  {
    label: { type: String, required: true, trim: true },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { _id: true }
);

const ChatQuestionSchema = new Schema(
  {
    purpose: {
      type: String,
      enum: ['ORDER_STATUS', 'REPEAT_ORDER'],
      required: true,
    },
    questionText: { type: String, required: true, trim: true },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    answers: { type: [ChatAnswerSchema], default: [] },
  },
  { timestamps: true }
);

ChatQuestionSchema.index({ purpose: 1, sortOrder: 1, isActive: 1 });

export function getChatQuestionModel() {
  return mongoose.models.ChatQuestion || mongoose.model('ChatQuestion', ChatQuestionSchema);
}
