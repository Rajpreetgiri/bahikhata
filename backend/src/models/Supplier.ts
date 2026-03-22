import mongoose, { Document, Schema } from 'mongoose';

export interface ISupplier extends Document {
  merchantId: mongoose.Types.ObjectId;
  name: string;
  phone?: string;
  email?: string;
  companyName?: string;
  totalDue: number; // positive = merchant owes supplier
  lastTransactionAt?: Date;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SupplierSchema = new Schema<ISupplier>(
  {
    merchantId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 100 },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    companyName: { type: String, trim: true },
    totalDue: { type: Number, default: 0 },
    lastTransactionAt: { type: Date },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

SupplierSchema.index({ merchantId: 1, isDeleted: 1 });
SupplierSchema.index({ merchantId: 1, totalDue: -1 });
SupplierSchema.index({ merchantId: 1, lastTransactionAt: -1 });

export default mongoose.model<ISupplier>('Supplier', SupplierSchema);
