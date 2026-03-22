import mongoose, { Document, Schema } from 'mongoose';

export type TransactionType = 'gave' | 'got';
export type PaymentMethod = 'cash' | 'upi' | 'card' | 'cheque' | 'bank_transfer' | 'other';

export interface ITransaction extends Document {
  customerId: mongoose.Types.ObjectId;
  merchantId: mongoose.Types.ObjectId;
  type: TransactionType;
  amount: number;
  note?: string;
  photoUrl?: string;
  paymentMethod?: PaymentMethod;
  dueDate?: Date;
  createdAt: Date;
}

const TransactionSchema = new Schema<ITransaction>(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    merchantId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['gave', 'got'], required: true },
    amount: { type: Number, required: true, min: 0.01 },
    note: { type: String, trim: true },
    photoUrl: { type: String },
    paymentMethod: { type: String, enum: ['cash', 'upi', 'card', 'cheque', 'bank_transfer', 'other'] },
    dueDate: { type: Date },
  },
  { timestamps: true }
);

TransactionSchema.index({ customerId: 1, createdAt: -1 });
TransactionSchema.index({ merchantId: 1, createdAt: -1 });

export default mongoose.model<ITransaction>('Transaction', TransactionSchema);
