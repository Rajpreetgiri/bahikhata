import mongoose, { Document, Schema } from 'mongoose';

export type PayoutAccountStatus = 'not_connected' | 'created' | 'kyc_pending' | 'active' | 'suspended';

export interface IPayoutAccount extends Document {
  merchantId: mongoose.Types.ObjectId;

  // Razorpay Route linked account
  razorpayAccountId?: string;
  razorpayAccountStatus: PayoutAccountStatus;
  razorpayActivatedAt?: Date;

  // Legal info submitted to Razorpay for KYC
  legalBusinessName?: string;
  pan?: string;             // stored as-is, NEVER returned raw in API responses
  businessCity?: string;
  businessState?: string;   // 2-letter e.g. "MH"
  businessPostalCode?: string;

  // Bank account (platform record; settlement managed by Razorpay post-KYC)
  bankAccountName?: string;
  bankAccountNumber?: string;     // masked "****4321" — safe to return
  bankAccountNumberFull?: string; // full number — NEVER returned in API responses
  bankIfsc?: string;
  bankName?: string;

  // UPI
  upiId?: string;

  // Platform commission
  platformFeePercent: number;

  // Cumulative stats
  totalRouteTransfers: number;
  totalAmountRouted: number; // net ₹ sent to merchant
  lastTransferAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

const PayoutAccountSchema = new Schema<IPayoutAccount>(
  {
    merchantId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },

    razorpayAccountId: { type: String, trim: true },
    razorpayAccountStatus: {
      type: String,
      enum: ['not_connected', 'created', 'kyc_pending', 'active', 'suspended'],
      default: 'not_connected',
    },
    razorpayActivatedAt: { type: Date },

    legalBusinessName: { type: String, trim: true },
    pan: { type: String, trim: true, uppercase: true },
    businessCity: { type: String, trim: true },
    businessState: { type: String, trim: true, uppercase: true },
    businessPostalCode: { type: String, trim: true },

    bankAccountName: { type: String, trim: true },
    bankAccountNumber: { type: String, trim: true },    // masked
    bankAccountNumberFull: { type: String, trim: true }, // full
    bankIfsc: { type: String, trim: true, uppercase: true },
    bankName: { type: String, trim: true },

    upiId: { type: String, trim: true, lowercase: true },

    platformFeePercent: { type: Number, default: 0, min: 0, max: 100 },

    totalRouteTransfers: { type: Number, default: 0 },
    totalAmountRouted: { type: Number, default: 0 },
    lastTransferAt: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.model<IPayoutAccount>('PayoutAccount', PayoutAccountSchema);
