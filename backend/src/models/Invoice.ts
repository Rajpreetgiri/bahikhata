import mongoose, { Document, Schema } from 'mongoose';
import { StockUnit } from './Product';

export interface IInvoiceItem {
  productId: mongoose.Types.ObjectId;
  productName: string; // snapshot at time of creation
  unit: StockUnit;     // snapshot
  quantity: number;
  unitPrice: number;   // snapshot
  total: number;
}

export type InvoiceStatus = 'unpaid' | 'partially_paid' | 'paid' | 'cancelled' | 'returned';

export type InvoicePaymentMode = 'credit' | 'paid';

export interface IInvoice extends Document {
  merchantId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  invoiceNumber: string; // e.g. "INV-001"
  items: IInvoiceItem[];
  subtotal: number;
  gstPercent?: number;
  gstAmount?: number;
  totalAmount: number;
  status: InvoiceStatus;
  paymentMode: InvoicePaymentMode; // 'credit' = udhari, 'paid' = immediate payment
  paidAmount: number; // cumulative amount received (partial payments)
  dueDate?: Date;
  paidAt?: Date;
  transactionId?: mongoose.Types.ObjectId;
  note?: string;
  createdAt: Date;
  updatedAt: Date;
}

const InvoiceItemSchema = new Schema<IInvoiceItem>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    productName: { type: String, required: true },
    unit: { type: String, required: true },
    quantity: { type: Number, required: true, min: 0.001 },
    unitPrice: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const InvoiceSchema = new Schema<IInvoice>(
  {
    merchantId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    invoiceNumber: { type: String, required: true },
    items: { type: [InvoiceItemSchema], required: true, validate: (v: unknown[]) => v.length >= 1 },
    subtotal: { type: Number, required: true, min: 0 },
    gstPercent: { type: Number, min: 0 },
    gstAmount: { type: Number, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    paidAmount: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ['unpaid', 'partially_paid', 'paid', 'cancelled', 'returned'], default: 'unpaid' },
    paymentMode: { type: String, enum: ['credit', 'paid'], default: 'credit' },
    dueDate: { type: Date },
    paidAt: { type: Date },
    transactionId: { type: Schema.Types.ObjectId, ref: 'Transaction' },
    note: { type: String, trim: true },
  },
  { timestamps: true }
);

InvoiceSchema.index({ merchantId: 1, createdAt: -1 });
InvoiceSchema.index({ merchantId: 1, customerId: 1 });
InvoiceSchema.index({ merchantId: 1, status: 1 });
InvoiceSchema.index({ merchantId: 1, invoiceNumber: 1 }, { unique: true });

export default mongoose.model<IInvoice>('Invoice', InvoiceSchema);
