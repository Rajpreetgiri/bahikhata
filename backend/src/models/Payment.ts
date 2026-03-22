import mongoose, { Document, Schema } from 'mongoose';

export type PaymentStatus = 'pending' | 'paid';

export interface IPayment extends Document {
  customerId: mongoose.Types.ObjectId;
  merchantId: mongoose.Types.ObjectId;
  razorpayPaymentLinkId: string;
  razorpayPaymentLinkUrl: string;
  amount: number;
  status: PaymentStatus;
  createdAt: Date;
}

const PaymentSchema = new Schema<IPayment>(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    merchantId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    razorpayPaymentLinkId: { type: String, required: true, unique: true },
    razorpayPaymentLinkUrl: { type: String, required: true },
    amount: { type: Number, required: true, min: 0.01 },
    status: { type: String, enum: ['pending', 'paid'], default: 'pending' },
  },
  { timestamps: true }
);

PaymentSchema.index({ customerId: 1, createdAt: -1 });
PaymentSchema.index({ merchantId: 1, status: 1 });
// Index for webhook idempotency lookups (razorpayPaymentLinkId is already unique above, but
// this composite helps the webhook filter by both fields efficiently)
PaymentSchema.index({ razorpayPaymentLinkId: 1, status: 1 });

export default mongoose.model<IPayment>('Payment', PaymentSchema);
