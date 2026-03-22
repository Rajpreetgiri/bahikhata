import mongoose, { Document, Schema } from 'mongoose';

export type ReminderChannel = 'email' | 'sms' | 'whatsapp';

export interface IScheduledReminder extends Document {
  merchantId: mongoose.Types.ObjectId;
  // negative = before due date, 0 = on due date, positive = after due date
  // e.g. -3 = send 3 days before due, 7 = send 7 days after due
  offsetDays: number;
  channels: ReminderChannel[];
  isEnabled: boolean;
  createdAt: Date;
}

const ScheduledReminderSchema = new Schema<IScheduledReminder>(
  {
    merchantId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    offsetDays: { type: Number, required: true },
    channels: [{ type: String, enum: ['email', 'sms', 'whatsapp'] }],
    isEnabled: { type: Boolean, default: true },
  },
  { timestamps: true }
);

ScheduledReminderSchema.index({ merchantId: 1 });

export default mongoose.model<IScheduledReminder>('ScheduledReminder', ScheduledReminderSchema);
