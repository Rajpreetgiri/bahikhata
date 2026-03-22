import mongoose, { Document, Schema } from 'mongoose';

export type ReminderChannel = 'email' | 'push' | 'whatsapp' | 'sms' | 'ivr';
export type ReminderStatus = 'sent' | 'failed';
export type ReminderTriggerType = 'manual' | 'auto';

export interface IReminder extends Document {
  customerId: mongoose.Types.ObjectId;
  merchantId: mongoose.Types.ObjectId;
  channel: ReminderChannel;
  status: ReminderStatus;
  triggerType: ReminderTriggerType; // 'manual' = sent by merchant, 'auto' = system-triggered
  sentAt: Date;
  errorMessage?: string;
}

const ReminderSchema = new Schema<IReminder>(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    merchantId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    channel: { type: String, enum: ['email', 'push', 'whatsapp', 'sms', 'ivr'], required: true },
    status: { type: String, enum: ['sent', 'failed'], required: true },
    triggerType: { type: String, enum: ['manual', 'auto'], default: 'manual' },
    sentAt: { type: Date, default: Date.now },
    errorMessage: { type: String },
  },
  { timestamps: true }
);

ReminderSchema.index({ merchantId: 1, sentAt: -1 });

export default mongoose.model<IReminder>('Reminder', ReminderSchema);
