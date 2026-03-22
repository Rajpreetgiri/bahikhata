import mongoose, { Document, Schema } from 'mongoose';

export interface ICustomer extends Document {
  merchantId: mongoose.Types.ObjectId;
  name: string;
  phone?: string;
  email?: string;
  totalOutstanding: number; // positive = merchant gave (they owe), negative = merchant got (overpaid)
  lastTransactionAt?: Date;
  lastPaymentAmount?: number;  // last 'got' transaction amount
  isDeleted: boolean;
  creditLimit?: number; // max credit allowed; 0 or undefined = no limit
  riskFlag: boolean;    // manually flagged as risky/defaulter
  createdAt: Date;
}

const CustomerSchema = new Schema<ICustomer>(
  {
    merchantId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    totalOutstanding: { type: Number, default: 0 },
    lastTransactionAt: { type: Date },
    lastPaymentAmount: { type: Number },
    isDeleted: { type: Boolean, default: false },
    creditLimit: { type: Number, min: 0 },
    riskFlag: { type: Boolean, default: false },
  },
  { timestamps: true }
);

CustomerSchema.index({ merchantId: 1, isDeleted: 1 });
CustomerSchema.index({ merchantId: 1, totalOutstanding: -1 });
CustomerSchema.index({ merchantId: 1, name: 1 }); // for invoice search by customer name

export default mongoose.model<ICustomer>('Customer', CustomerSchema);
