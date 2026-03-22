import axios from 'axios';

const FAST2SMS_API_KEY = process.env.FAST2SMS_API_KEY!;

/**
 * Send a single SMS via Fast2SMS.
 * For DLT-registered templates, change route to 'dlt' and add template_id + sender_id.
 * Phase 1 uses Quick SMS (route 'q') for testing — switch to DLT before production.
 */
export async function sendSMS(phone: string, message: string): Promise<void> {
  if (!FAST2SMS_API_KEY) {
    throw new Error('FAST2SMS_API_KEY not configured in environment');
  }

  // Clean phone: remove +91 or 0 prefix, keep 10 digits
  const cleaned = phone.replace(/\D/g, '').replace(/^(91|0)/, '').slice(-10);
  if (cleaned.length !== 10) {
    throw new Error(`Invalid phone number: ${phone}`);
  }

  const response = await axios.post(
    'https://www.fast2sms.com/dev/bulkV2',
    {
      route: 'q',           // 'q' = Quick SMS (testing); change to 'dlt' for production
      message,
      language: 'english',
      flash: 0,
      numbers: cleaned,
    },
    {
      headers: {
        authorization: FAST2SMS_API_KEY,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    }
  );

  if (!response.data?.return) {
    throw new Error(response.data?.message ?? 'Fast2SMS: unknown error');
  }
}

/**
 * Build a standard SMS reminder message (plain text, concise for SMS limits).
 */
export function buildReminderMessage(
  customerName: string,
  amount: number,
  businessName: string,
  paymentLink?: string
): string {
  const base = `Dear ${customerName}, your outstanding dues of Rs.${amount.toLocaleString('en-IN')} to ${businessName} are pending.`;
  if (paymentLink) {
    return `${base} Pay now: ${paymentLink}`;
  }
  return `${base} Please clear at the earliest. Thank you.`;
}

/**
 * Build a WhatsApp message string (richer, conversational tone).
 * Returns both the text and the wa.me deep-link URL.
 */
export function buildWhatsAppReminderUrl(
  phone: string,
  customerName: string,
  amount: number,
  businessName: string,
  paymentLink?: string
): string {
  // Normalise phone → E.164 without '+'
  const cleaned = phone.replace(/\D/g, '').replace(/^0+/, '');
  const e164 = cleaned.startsWith('91') ? cleaned : `91${cleaned}`;

  let message =
    `Namaste ${customerName} ji 🙏\n\n` +
    `Aapka *${businessName}* mein ₹${amount.toLocaleString('en-IN')} ka outstanding balance pending hai.\n\n` +
    `Kripaya jald se jald payment karein. Shukriya!`;

  if (paymentLink) {
    message += `\n\nOnline pay karein: ${paymentLink}`;
  }

  return `https://wa.me/${e164}?text=${encodeURIComponent(message)}`;
}
