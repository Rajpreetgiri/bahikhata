import mongoose, { Document, Schema } from 'mongoose';

export type CashEntryType = 'in' | 'out';

export interface ICashEntry extends Document {
  merchantId: mongoose.Types.ObjectId;
  type: CashEntryType;
  amount: number;
  note?: string;
  date: Date;
  createdAt: Date;
}

const CashEntrySchema = new Schema<ICashEntry>(
  {
    merchantId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['in', 'out'], required: true },
    amount: { type: Number, required: true, min: 0.01, max: 10_000_000 },
    note: { type: String, trim: true },
    date: { type: Date, required: true },
  },
  { timestamps: true }
);

CashEntrySchema.index({ merchantId: 1, date: -1 });

export default mongoose.model<ICashEntry>('CashEntry', CashEntrySchema);
