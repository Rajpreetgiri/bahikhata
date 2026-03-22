import { Router, Response } from 'express';
import Customer from '../models/Customer';
import Reminder from '../models/Reminder';
import Payment from '../models/Payment';
import { sendReminder } from '../services/email';
import { sendSMS, buildReminderMessage, buildWhatsAppReminderUrl } from '../services/sms';
import { deductWalletBalance, useSMSPackCredit } from './wallet';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { sendSuccess, sendPaginated } from '../utils/response';
import { createMerchantNotification } from '../utils/notificationHelper';

const router = Router();
router.use(authenticate);

async function getLatestPaymentLink(customerId: string): Promise<string | undefined> {
  const payment = await Payment.findOne({ customerId, status: 'pending' }).sort({ createdAt: -1 });
  return payment?.razorpayPaymentLinkUrl;
}

// POST /api/reminders/send  — send to one customer
router.post(
  '/send',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { customerId, channels } = req.body as {
      customerId: string;
      channels: ('email' | 'sms' | 'whatsapp')[];
    };

    if (!customerId || !channels?.length) {
      throw AppError.badRequest('customerId and channels are required', 'VALIDATION_ERROR');
    }

    const validChannels = ['email', 'sms', 'whatsapp'];
    const invalidChannels = channels.filter((c) => !validChannels.includes(c));
    if (invalidChannels.length > 0) {
      throw AppError.badRequest(`Invalid channels: ${invalidChannels.join(', ')}. Allowed: email, sms, whatsapp`, 'INVALID_CHANNEL');
    }

    const customer = await Customer.findOne({
      _id: customerId,
      merchantId: req.userId,
      isDeleted: false,
    });
    if (!customer) throw AppError.notFound('Customer not found', 'CUSTOMER_NOT_FOUND');
    if (customer.totalOutstanding <= 0) {
      throw AppError.badRequest('No outstanding amount — reminder not needed', 'NO_OUTSTANDING');
    }

    const merchant = req.user!;
    const paymentLink = await getLatestPaymentLink(customerId);
    const results: { channel: string; status: string; error?: string; waUrl?: string }[] = [];

    for (const channel of channels) {
      try {
        if (channel === 'email') {
          if (!customer.email) {
            await Reminder.create({ customerId, merchantId: req.userId, channel, triggerType: 'manual', status: 'failed', errorMessage: 'No email on file' });
            results.push({ channel, status: 'failed', error: 'No email on file' });
            continue;
          }
          await sendReminder(customer.email, customer.name, merchant.businessName, customer.totalOutstanding, paymentLink);
          await Reminder.create({ customerId, merchantId: req.userId, channel, triggerType: 'manual', status: 'sent', sentAt: new Date() });
          results.push({ channel, status: 'sent' });

        } else if (channel === 'sms') {
          if (!customer.phone) {
            await Reminder.create({ customerId, merchantId: req.userId, channel, triggerType: 'manual', status: 'failed', errorMessage: 'No phone on file' });
            results.push({ channel, status: 'failed', error: 'No phone on file' });
            continue;
          }
          // Deduct credits: use SMS pack first, else deduct from wallet at ₹0.40/SMS (above pack rate)
          const usedPack = await useSMSPackCredit(req.userId!);
          if (!usedPack) {
            await deductWalletBalance(req.userId!, 0.40, `SMS reminder to ${customer.name}`, 'sms');
          }
          const message = buildReminderMessage(customer.name, customer.totalOutstanding, merchant.businessName, paymentLink);
          await sendSMS(customer.phone, message);
          await Reminder.create({ customerId, merchantId: req.userId, channel, triggerType: 'manual', status: 'sent', sentAt: new Date() });
          results.push({ channel, status: 'sent' });

        } else if (channel === 'whatsapp') {
          // WhatsApp: build wa.me deep-link — merchant taps it and WhatsApp opens with pre-filled message
          if (!customer.phone) {
            await Reminder.create({ customerId, merchantId: req.userId, channel, triggerType: 'manual', status: 'failed', errorMessage: 'No phone on file' });
            results.push({ channel, status: 'failed', error: 'No phone on file' });
            continue;
          }
          const waUrl = buildWhatsAppReminderUrl(
            customer.phone,
            customer.name,
            customer.totalOutstanding,
            merchant.businessName,
            paymentLink
          );
          // Log intent — actual message send happens client-side when merchant taps the link
          await Reminder.create({ customerId, merchantId: req.userId, channel, triggerType: 'manual', status: 'sent', sentAt: new Date() });
          results.push({ channel, status: 'sent', waUrl });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        await Reminder.create({ customerId, merchantId: req.userId, channel, triggerType: 'manual', status: 'failed', errorMessage: msg }).catch(() => {});
        results.push({ channel, status: 'failed', error: msg });
      }
    }

    // Create in-app notification for each successfully sent channel
    const sentChannels = results.filter((r) => r.status === 'sent').map((r) => r.channel);
    if (sentChannels.length > 0) {
      const channelLabel = sentChannels.join(', ');
      await createMerchantNotification({
        merchantId: req.userId!,
        type: 'reminder_sent',
        title: 'Reminder Sent',
        body: `${channelLabel} reminder sent to ${customer.name} for ₹${customer.totalOutstanding.toLocaleString('en-IN')}`,
        metadata: {
          customerId: customer._id.toString(),
          customerName: customer.name,
          amount: customer.totalOutstanding,
          channels: sentChannels,
        },
      });
    }

    sendSuccess(res, { results });
  })
);

// POST /api/reminders/bulk  — email all customers with outstanding > 0
router.post(
  '/bulk',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const customers = await Customer.find({
      merchantId: req.userId,
      isDeleted: false,
      totalOutstanding: { $gt: 0 },
      email: { $exists: true, $ne: '' },
    });

    const merchant = req.user!;
    let sent = 0;
    let failed = 0;

    for (const customer of customers) {
      try {
        const paymentLink = await getLatestPaymentLink(customer._id.toString());
        await sendReminder(customer.email!, customer.name, merchant.businessName, customer.totalOutstanding, paymentLink);
        await Reminder.create({ customerId: customer._id, merchantId: req.userId, channel: 'email', triggerType: 'manual', status: 'sent', sentAt: new Date() });
        sent++;
      } catch {
        await Reminder.create({ customerId: customer._id, merchantId: req.userId, channel: 'email', triggerType: 'manual', status: 'failed', sentAt: new Date() });
        failed++;
      }
    }

    // In-app notification
    await createMerchantNotification({
      merchantId: req.userId!,
      type: 'bulk_reminder',
      title: 'Bulk Reminders Sent',
      body: `Email reminders sent to ${sent} customer${sent !== 1 ? 's' : ''}${failed > 0 ? `, ${failed} failed` : ''}.`,
      metadata: { sent, failed, total: customers.length },
    });

    sendSuccess(res, { sent, failed, total: customers.length });
  })
);

// POST /api/reminders/ivr  — TEMPORARILY DISABLED (IVR feature coming soon)
router.post('/ivr', (_req, res) => {
  res.status(503).json({ success: false, error: { code: 'FEATURE_DISABLED', message: 'IVR voice call feature is coming soon.' } });
});

// GET /api/reminders/history  (paginated)
router.get(
  '/history',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 30));

    const total = await Reminder.countDocuments({ merchantId: req.userId });
    const reminders = await Reminder.find({ merchantId: req.userId })
      .sort({ sentAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('customerId', 'name phone email');

    sendPaginated(res, reminders, { total, page, pages: Math.ceil(total / limit) });
  })
);

export default router;
