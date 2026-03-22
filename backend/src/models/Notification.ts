import mongoose, { Document, Schema } from 'mongoose';

export type NotificationType =
  | 'reminder_sent'       // email/sms/whatsapp reminder sent to customer
  | 'bulk_reminder'       // bulk reminder batch completed
  | 'transaction_gave'    // merchant gave credit to customer (udhari)
  | 'transaction_got'     // merchant received payment from customer
  | 'invoice_credit'      // credit invoice created
  | 'invoice_paid'        // instant-paid invoice created
  | 'invoice_settled'     // invoice marked as fully paid
  | 'invoice_partial'     // partial payment recorded on invoice
  | 'admin_broadcast';    // admin-sent message (default for old records)

export interface INotification extends Document {
  // null = broadcast to ALL merchants; otherwise targeted to one merchant
  merchantId: mongoose.Types.ObjectId | null;
  type: NotificationType;
  title: string;
  body: string;
  // Flexible metadata: customerId, amount, invoiceNumber, channel, etc.
  metadata: Record<string, unknown>;
  readBy: mongoose.Types.ObjectId[];
  createdAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    merchantId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    type: {
      type: String,
      enum: [
        'reminder_sent', 'bulk_reminder',
        'transaction_gave', 'transaction_got',
        'invoice_credit', 'invoice_paid', 'invoice_settled', 'invoice_partial',
        'admin_broadcast',
      ],
      default: 'admin_broadcast',
    },
    title:    { type: String, required: true, trim: true },
    body:     { type: String, required: true, trim: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
    readBy:   [{ type: Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

NotificationSchema.index({ merchantId: 1, createdAt: -1 });

export default mongoose.model<INotification>('Notification', NotificationSchema);
