import mongoose, { Document, Schema } from 'mongoose';

export type SupplierTransactionType = 'bought' | 'paid';

export interface ISupplierTransaction extends Document {
  supplierId: mongoose.Types.ObjectId;
  merchantId: mongoose.Types.ObjectId;
  type: SupplierTransactionType;
  amount: number;
  note?: string;
  photoUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SupplierTransactionSchema = new Schema<ISupplierTransaction>(
  {
    supplierId: { type: Schema.Types.ObjectId, ref: 'Supplier', required: true },
    merchantId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['bought', 'paid'], required: true },
    amount: { type: Number, required: true, min: 0.01 },
    note: { type: String, trim: true, maxlength: 500 },
    photoUrl: { type: String },
  },
  { timestamps: true }
);

SupplierTransactionSchema.index({ supplierId: 1, createdAt: -1 });
SupplierTransactionSchema.index({ merchantId: 1, createdAt: -1 });

export default mongoose.model<ISupplierTransaction>('SupplierTransaction', SupplierTransactionSchema);
