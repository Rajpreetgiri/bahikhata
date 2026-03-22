import mongoose, { Document, Schema } from 'mongoose';

export type RouteTransferStatus = 'initiated' | 'settled' | 'failed' | 'reversed';

export interface IRouteTransfer extends Document {
  merchantId: mongoose.Types.ObjectId;
  paymentDbId: mongoose.Types.ObjectId; // our Payment._id
  razorpayPaymentId: string;            // "pay_XXXXX" from webhook
  razorpayLinkedAccountId: string;      // "acc_XXXXX"
  razorpayTransferId?: string;          // "trf_XXXXX" from Razorpay response
  grossAmountRs: number;                // what customer paid
  platformFeeRs: number;               // platform commission
  netAmountRs: number;                  // sent to merchant
  status: RouteTransferStatus;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

const RouteTransferSchema = new Schema<IRouteTransfer>(
  {
    merchantId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    paymentDbId: { type: Schema.Types.ObjectId, ref: 'Payment', required: true },
    razorpayPaymentId: { type: String, required: true },
    razorpayLinkedAccountId: { type: String, required: true },
    razorpayTransferId: { type: String },
    grossAmountRs: { type: Number, required: true, min: 0 },
    platformFeeRs: { type: Number, required: true, min: 0 },
    netAmountRs: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ['initiated', 'settled', 'failed', 'reversed'],
      default: 'initiated',
    },
    errorMessage: { type: String },
  },
  { timestamps: true }
);

RouteTransferSchema.index({ merchantId: 1, createdAt: -1 });
RouteTransferSchema.index({ razorpayPaymentId: 1 }, { unique: true });

export default mongoose.model<IRouteTransfer>('RouteTransfer', RouteTransferSchema);
