import Razorpay from 'razorpay';
import type { PaymentLinks } from 'razorpay/dist/types/paymentLink';
import crypto from 'crypto';
import axios from 'axios';

function getRazorpay(): Razorpay {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw new Error('RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET not configured');
  }
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
}

export interface PaymentLinkResult {
  id: string;
  url: string;
}

export async function createPaymentLink(
  amountInRupees: number,
  customerName: string,
  merchantId: string,
  customerId: string,
  customerPhone?: string,
  customerEmail?: string
): Promise<PaymentLinkResult> {
  const rzp = getRazorpay();

  const payload: PaymentLinks.RazorpayPaymentLinkCreateRequestBody = {
    amount: Math.round(amountInRupees * 100), // Razorpay uses paise
    currency: 'INR',
    description: 'Outstanding dues payment',
    customer: {
      name: customerName,
      ...(customerPhone && { contact: `+91${customerPhone.replace(/\D/g, '').slice(-10)}` }),
      ...(customerEmail && { email: customerEmail }),
    },
    notify: {
      sms: !!customerPhone,
      email: !!customerEmail,
    },
    reminder_enable: true,
    notes: {
      merchantId,
      customerId,
    },
    callback_url: `${process.env.FRONTEND_URL ?? 'http://localhost:5173'}/payment-success`,
    callback_method: 'get',
  };
  const link = await rzp.paymentLink.create(payload);

  return { id: link.id, url: link.short_url };
}

// ── Razorpay Route (Linked Accounts) ─────────────────────────────────────────

function getRzpAxios() {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw new Error('RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET not configured');
  }
  return axios.create({
    baseURL: 'https://api.razorpay.com',
    auth: {
      username: process.env.RAZORPAY_KEY_ID,
      password: process.env.RAZORPAY_KEY_SECRET,
    },
    headers: { 'Content-Type': 'application/json' },
  });
}

export interface LinkedAccountResult {
  id: string;
  status: string;
}

/**
 * Create a Razorpay Linked Account for a merchant (Route product).
 * Razorpay sends KYC email to the provided email address.
 * Requires Route product to be activated in Razorpay Dashboard.
 */
export async function createLinkedAccount(params: {
  email: string;
  legalBusinessName: string;
  pan: string;
  city: string;
  state: string;
  postalCode: string;
  description: string;
}): Promise<LinkedAccountResult> {
  const rzpAxios = getRzpAxios();
  const res = await rzpAxios.post('/v2/accounts', {
    email: params.email,
    profile: {
      category: 'others',
      subcategory: 'others',
      description: params.description.slice(0, 255),
      addresses: {
        registered: {
          street1: params.description.slice(0, 100),
          city: params.city,
          state: params.state.toUpperCase(),
          postal_code: parseInt(params.postalCode, 10),
          country: 'IN',
        },
      },
    },
    legal_business_name: params.legalBusinessName,
    business_type: 'route',
    legal_info: {
      pan: params.pan.toUpperCase(),
    },
  });
  return { id: res.data.id, status: res.data.status ?? 'created' };
}

/**
 * Fetch current status of a Razorpay linked account.
 */
export async function fetchLinkedAccount(accountId: string): Promise<LinkedAccountResult> {
  const rzpAxios = getRzpAxios();
  const res = await rzpAxios.get(`/v2/accounts/${accountId}`);
  return { id: res.data.id, status: res.data.status ?? 'created' };
}

/**
 * Initiate a Route transfer from a captured Razorpay payment to a linked account.
 * netAmountPaise must be in paise (₹ × 100).
 */
export async function initiateRouteTransfer(
  razorpayPaymentId: string,
  linkedAccountId: string,
  netAmountPaise: number
): Promise<{ id: string; status: string }> {
  const rzp = getRazorpay();
  // rzp.payments.transfer isn't in the official TS types — use explicit cast with full return type
  type TransferItem = { id: string; status: string };
  type TransferResponse = { id: string; status: string } | { entity: string; count: number; items: TransferItem[] };
  const paymentsWithTransfer = rzp.payments as unknown as {
    transfer: (id: string, body: unknown) => Promise<TransferResponse>;
  };
  const res = await paymentsWithTransfer.transfer(razorpayPaymentId, {
    transfers: [
      {
        account: linkedAccountId,
        amount: netAmountPaise,
        currency: 'INR',
        on_hold: 0,
      },
    ],
  });
  // Razorpay returns either the transfer object directly or a list wrapper
  const transfer: TransferItem = 'items' in res ? res.items[0] : res as TransferItem;
  return { id: transfer.id, status: transfer.status ?? 'initiated' };
}

// ─────────────────────────────────────────────────────────────────────────────

export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  if (!process.env.RAZORPAY_WEBHOOK_SECRET) {
    throw new Error('RAZORPAY_WEBHOOK_SECRET not configured');
  }
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');
  return expected === signature;
}
