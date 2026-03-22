import mongoose, { Document, Schema } from 'mongoose';

export type EmployeeStatus = 'active' | 'inactive';
export type SalaryType = 'monthly' | 'daily';

export interface IEmployee extends Document {
  merchantId: mongoose.Types.ObjectId;
  name: string;
  phone?: string;
  role?: string;
  salaryType: SalaryType;
  salaryAmount: number;    // monthly amount or daily rate
  joinDate?: Date;
  status: EmployeeStatus;
  advanceBalance: number;  // total advance given, deducted at salary time
  createdAt: Date;
  updatedAt: Date;
}

const EmployeeSchema = new Schema<IEmployee>(
  {
    merchantId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    role: { type: String, trim: true },
    salaryType: { type: String, enum: ['monthly', 'daily'], default: 'monthly' },
    salaryAmount: { type: Number, required: true, min: 0 },
    joinDate: { type: Date },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    advanceBalance: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

export default mongoose.model<IEmployee>('Employee', EmployeeSchema);
