import ScheduledReminder from '../models/ScheduledReminder';
import Transaction from '../models/Transaction';
import Customer from '../models/Customer';
import User from '../models/User';
import Reminder from '../models/Reminder';
import Payment from '../models/Payment';
import { sendReminder as sendEmailReminder } from './email';
import { sendSMS, buildReminderMessage } from './sms';
import { deductWalletBalance, useSMSPackCredit } from '../routes/wallet';

export function startScheduler(): void {
  // Run daily at 9:00 AM server time
  const now = new Date();
  const msUntilNext9am = getMsUntil9am(now);

  setTimeout(() => {
    runScheduledReminders().catch(console.error);
    // Then repeat every 24 hours
    setInterval(() => runScheduledReminders().catch(console.error), 24 * 60 * 60 * 1000);
  }, msUntilNext9am);

  console.log(`Scheduler started — next run in ${Math.round(msUntilNext9am / 60000)} minutes`);
}

function getMsUntil9am(now: Date): number {
  const next9am = new Date(now);
  next9am.setHours(9, 0, 0, 0);
  if (next9am <= now) {
    next9am.setDate(next9am.getDate() + 1);
  }
  return next9am.getTime() - now.getTime();
}

export async function runScheduledReminders(): Promise<void> {
  console.log('Running scheduled reminders...');

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  try {
    const rules = await ScheduledReminder.find({ isEnabled: true });
    if (rules.length === 0) return;

    for (const rule of rules) {
      // target dueDate = today - offsetDays
      // offsetDays = -3 → targetDate = today + 3 (3 days before due)
      // offsetDays =  7 → targetDate = today - 7 (7 days after due)
      const targetDate = new Date(today);
      targetDate.setDate(targetDate.getDate() - rule.offsetDays);

      const nextDay = new Date(targetDate);
      nextDay.setDate(nextDay.getDate() + 1);

      // Find unique customers who have 'gave' transactions due on targetDate
      const customerIds = await Transaction.distinct('customerId', {
        merchantId: rule.merchantId,
        type: 'gave',
        dueDate: { $gte: targetDate, $lt: nextDay },
      });

      if (customerIds.length === 0) continue;

      const merchant = await User.findById(rule.merchantId);
      if (!merchant) continue;

      for (const customerId of customerIds) {
        const customer = await Customer.findOne({
          _id: customerId,
          merchantId: rule.merchantId,
          isDeleted: false,
          totalOutstanding: { $gt: 0 },
        });
        if (!customer) continue;

        const payment = await Payment.findOne({ customerId: customer._id, status: 'pending' }).sort({ createdAt: -1 });
        const paymentLink = payment?.razorpayPaymentLinkUrl;

        for (const channel of rule.channels) {
          try {
            if (channel === 'email') {
              if (!customer.email) continue;
              await sendEmailReminder(
                customer.email,
                customer.name,
                merchant.businessName,
                customer.totalOutstanding,
                paymentLink
              );
            } else if (channel === 'sms') {
              if (!customer.phone) continue;
              const usedPack = await useSMSPackCredit(rule.merchantId.toString());
              if (!usedPack) {
                await deductWalletBalance(
                  rule.merchantId.toString(),
                  0.40,
                  `Auto SMS reminder to ${customer.name}`,
                  'sms'
                );
              }
              const message = buildReminderMessage(
                customer.name,
                customer.totalOutstanding,
                merchant.businessName,
                paymentLink
              );
              await sendSMS(customer.phone, message);
            }
            // whatsapp is client-side, cannot auto-send — skip silently

            await Reminder.create({
              customerId: customer._id,
              merchantId: rule.merchantId,
              channel,
              triggerType: 'auto',
              status: 'sent',
              sentAt: new Date(),
            });
          } catch (err) {
            const msg = err instanceof Error ? err.message : 'Unknown error';
            await Reminder.create({
              customerId: customer._id,
              merchantId: rule.merchantId,
              channel,
              triggerType: 'auto',
              status: 'failed',
              errorMessage: msg,
              sentAt: new Date(),
            }).catch(() => {});
          }
        }
      }
    }

    console.log('Scheduled reminders done');
  } catch (err) {
    console.error('Scheduler error:', err);
  }
}
