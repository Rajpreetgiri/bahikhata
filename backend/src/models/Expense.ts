import mongoose, { Document, Schema } from 'mongoose';

export type ExpenseCategory =
  | 'rent'
  | 'salary'
  | 'electricity'
  | 'raw_material'
  | 'transport'
  | 'marketing'
  | 'maintenance'
  | 'other';

export interface IExpense extends Document {
  merchantId: mongoose.Types.ObjectId;
  amount: number;
  category: ExpenseCategory;
  note?: string;
  paymentMethod?: 'cash' | 'upi' | 'card' | 'cheque' | 'bank_transfer' | 'other';
  date: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ExpenseSchema = new Schema<IExpense>(
  {
    merchantId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true, min: 0.01 },
    category: {
      type: String,
      enum: ['rent', 'salary', 'electricity', 'raw_material', 'transport', 'marketing', 'maintenance', 'other'],
      required: true,
    },
    note: { type: String, trim: true },
    paymentMethod: {
      type: String,
      enum: ['cash', 'upi', 'card', 'cheque', 'bank_transfer', 'other'],
    },
    date: { type: Date, required: true },
  },
  { timestamps: true }
);

ExpenseSchema.index({ merchantId: 1, date: -1 });

export default mongoose.model<IExpense>('Expense', ExpenseSchema);
