import mongoose, { Document, Schema } from 'mongoose';

export const BUSINESS_CATEGORIES = [
  'kirana',
  'grocery',
  'restaurant',
  'pharmacy',
  'cloth',
  'electronics',
  'hardware',
  'dairy',
  'automobile',
  'professional',
  'pastry',
  'seeds_chemical',
  'other',
] as const;

export type BusinessCategory = typeof BUSINESS_CATEGORIES[number];

export type AccountType = 'merchant' | 'staff';
export type StaffRole = 'admin' | 'viewer';

export interface IUser extends Document {
  email: string;
  businessName: string;
  ownerName: string;
  phone?: string;
  fcmToken?: string;
  businessCategory?: BusinessCategory;
  businessAddress?: string;
  gstNumber?: string;
  upiId?: string;
  isOnboarded: boolean;
  // Staff / multi-business
  accountType: AccountType;
  staffMerchantId?: mongoose.Types.ObjectId;
  staffRole?: StaffRole;
  staffInviteToken?: string;   // hashed invite token
  staffPendingMerchantId?: mongoose.Types.ObjectId;
  staffPendingRole?: StaffRole;
  staffInviteExpiresAt?: Date;
  createdAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    // Not unique — multiple businesses can share same email
    email: { type: String, required: true, lowercase: true, trim: true },
    // Not required at DB level — filled during onboarding
    businessName: { type: String, default: '', trim: true },
    ownerName: { type: String, default: '', trim: true },
    phone: { type: String, trim: true },
    fcmToken: { type: String },
    businessCategory: { type: String, enum: BUSINESS_CATEGORIES },
    businessAddress: { type: String, trim: true },
    gstNumber: { type: String, trim: true, uppercase: true },
    upiId: { type: String, trim: true },
    isOnboarded: { type: Boolean, default: false },
    // Staff / multi-business
    accountType: { type: String, enum: ['merchant', 'staff'], default: 'merchant' },
    staffMerchantId: { type: Schema.Types.ObjectId, ref: 'User' },
    staffRole: { type: String, enum: ['admin', 'viewer'] },
    staffInviteToken: { type: String },       // hashed bcrypt token
    staffPendingMerchantId: { type: Schema.Types.ObjectId, ref: 'User' },
    staffPendingRole: { type: String, enum: ['admin', 'viewer'] },
    staffInviteExpiresAt: { type: Date },
  },
  { timestamps: true }
);

// Compound index: email is no longer globally unique (multiple businesses per email allowed)
// but (email, accountType) combo helps lookup efficiency
UserSchema.index({ email: 1, accountType: 1 });

export default mongoose.model<IUser>('User', UserSchema);
