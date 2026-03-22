import mongoose, { Document, Schema } from 'mongoose';

// Pricing: Fast2SMS cost ₹0.25/SMS → we charge ₹0.37/SMS (48% markup)
// sms_100:  100 SMS = ₹37  (30 days validity)
// sms_500:  500 SMS = ₹185 (60 days validity)
// sms_2000: 2000 SMS = ₹740 (90 days validity)
export type SMSPackPlan = 'sms_100' | 'sms_500' | 'sms_2000';

export interface ISMSPack extends Document {
  merchantId: mongoose.Types.ObjectId;
  plan: SMSPackPlan;
  totalSMS: number;
  usedSMS: number;
  purchasedAt: Date;
  expiresAt: Date;
  isActive: boolean;
  razorpayPaymentId: string;
}

const SMSPackSchema = new Schema<ISMSPack>(
  {
    merchantId:        { type: Schema.Types.ObjectId, ref: 'User', required: true },
    plan:              { type: String, enum: ['sms_100', 'sms_500', 'sms_2000'], required: true },
    totalSMS:          { type: Number, required: true },
    usedSMS:           { type: Number, default: 0 },
    purchasedAt:       { type: Date, default: Date.now },
    expiresAt:         { type: Date, required: true },
    isActive:          { type: Boolean, default: true },
    razorpayPaymentId: { type: String, required: true },
  },
  { timestamps: true }
);

SMSPackSchema.index({ merchantId: 1, isActive: 1 });

export default mongoose.model<ISMSPack>('SMSPack', SMSPackSchema);
