import mongoose, { Document, Schema } from 'mongoose';

export interface IWallet extends Document {
  merchantId: mongoose.Types.ObjectId;
  balance: number; // in rupees, 2 decimal precision
  updatedAt: Date;
}

const WalletSchema = new Schema<IWallet>(
  {
    merchantId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    balance: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

export default mongoose.model<IWallet>('Wallet', WalletSchema);
