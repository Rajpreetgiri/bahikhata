import mongoose, { Document, Schema } from 'mongoose';

export type StockUnit = 'piece' | 'kg' | 'gram' | 'litre' | 'ml' | 'pack' | 'box' | 'dozen' | 'metre';

export interface IProduct extends Document {
  merchantId: mongoose.Types.ObjectId;
  name: string;
  sku?: string;
  unit: StockUnit;
  sellingPrice: number;
  purchasePrice?: number;
  stock: number;
  lowStockThreshold: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema = new Schema<IProduct>(
  {
    merchantId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true },
    sku: { type: String, trim: true, uppercase: true },
    unit: {
      type: String,
      enum: ['piece', 'kg', 'gram', 'litre', 'ml', 'pack', 'box', 'dozen', 'metre'],
      default: 'piece',
    },
    sellingPrice: { type: Number, required: true, min: 0 },
    purchasePrice: { type: Number, min: 0 },
    stock: { type: Number, default: 0, min: 0 },
    lowStockThreshold: { type: Number, default: 5, min: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

ProductSchema.index({ merchantId: 1, isActive: 1 });
ProductSchema.index({ merchantId: 1, stock: 1 });
// Unique SKU per merchant (sparse so null/undefined is allowed for multiple docs)
ProductSchema.index({ merchantId: 1, sku: 1 }, { unique: true, sparse: true });

export default mongoose.model<IProduct>('Product', ProductSchema);
