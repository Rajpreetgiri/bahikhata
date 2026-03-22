import mongoose, { Document, Schema } from 'mongoose';

export type AttendanceStatus = 'present' | 'absent' | 'half_day' | 'holiday';

export interface IAttendance extends Document {
  merchantId: mongoose.Types.ObjectId;
  employeeId: mongoose.Types.ObjectId;
  date: Date;
  status: AttendanceStatus;
  note?: string;
  createdAt: Date;
}

const AttendanceSchema = new Schema<IAttendance>(
  {
    merchantId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    date: { type: Date, required: true },
    status: { type: String, enum: ['present', 'absent', 'half_day', 'holiday'], required: true },
    note: { type: String, trim: true },
  },
  { timestamps: true }
);

// Unique: one attendance record per employee per day
AttendanceSchema.index({ employeeId: 1, date: 1 }, { unique: true });

export default mongoose.model<IAttendance>('Attendance', AttendanceSchema);
