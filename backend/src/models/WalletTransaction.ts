import mongoose, { Document, Schema } from 'mongoose';

export type WalletTxType = 'credit' | 'debit';
export type WalletTxChannel = 'razorpay' | 'sms' | 'whatsapp' | 'pack_purchase' | 'refund';

export interface IWalletTransaction extends Document {
  merchantId: mongoose.Types.ObjectId;
  type: WalletTxType;
  amount: number;        // rupees (always positive)
  balanceAfter: number;  // wallet balance after this tx
  description: string;
  channel: WalletTxChannel;
  razorpayPaymentId?: string;
  createdAt: Date;
}

const WalletTransactionSchema = new Schema<IWalletTransaction>(
  {
    merchantId:        { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type:              { type: String, enum: ['credit', 'debit'], required: true },
    amount:            { type: Number, required: true, min: 0.01 },
    balanceAfter:      { type: Number, required: true },
    description:       { type: String, required: true, trim: true },
    channel:           { type: String, enum: ['razorpay', 'sms', 'whatsapp', 'pack_purchase', 'refund'], required: true },
    razorpayPaymentId: { type: String },
  },
  { timestamps: true }
);

WalletTransactionSchema.index({ merchantId: 1, createdAt: -1 });
// Sparse unique index so idempotency check via razorpayPaymentId is fast and safe
WalletTransactionSchema.index({ razorpayPaymentId: 1 }, { unique: true, sparse: true });

export default mongoose.model<IWalletTransaction>('WalletTransaction', WalletTransactionSchema);
