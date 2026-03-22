import mongoose, { Document, Schema } from 'mongoose';

export interface ICounter extends Document {
  merchantId: mongoose.Types.ObjectId;
  type: string;
  seq: number;
}

const CounterSchema = new Schema<ICounter>({
  merchantId: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
  type: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

CounterSchema.index({ merchantId: 1, type: 1 }, { unique: true });

export default mongoose.model<ICounter>('Counter', CounterSchema);
