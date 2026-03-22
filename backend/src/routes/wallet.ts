import { Router, Response } from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import mongoose from 'mongoose';
import Wallet from '../models/Wallet';
import WalletTransaction from '../models/WalletTransaction';
import SMSPack from '../models/SMSPack';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { sendSuccess } from '../utils/response';

const router = Router();
router.use(authenticate);

const razorpay = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

// ─── Helper: get or create wallet ────────────────────────────────────────────
async function getWallet(merchantId: string) {
  return Wallet.findOneAndUpdate(
    { merchantId },
    { $setOnInsert: { merchantId, balance: 0 } },
    { upsert: true, new: true }
  );
}

// ─── Helper: deduct from wallet (atomic) ─────────────────────────────────────
export async function deductWalletBalance(
  merchantId: string,
  amount: number,
  description: string,
  channel: 'sms' | 'whatsapp'
): Promise<void> {
  const wallet = await Wallet.findOneAndUpdate(
    { merchantId, balance: { $gte: amount } },
    { $inc: { balance: -amount } },
    { new: true }
  );

  if (!wallet) {
    // Check if wallet exists at all
    const existing = await Wallet.findOne({ merchantId });
    const balance = existing?.balance ?? 0;
    throw AppError.badRequest(
      `Insufficient wallet balance. Current: ₹${balance.toFixed(2)}, Required: ₹${amount.toFixed(2)}. Please add money.`,
      'INSUFFICIENT_BALANCE'
    );
  }

  await WalletTransaction.create({
    merchantId,
    type: 'debit',
    amount,
    balanceAfter: wallet.balance,
    description,
    channel,
  });
}

// ─── Helper: use SMS pack credit ─────────────────────────────────────────────
export async function useSMSPackCredit(merchantId: string): Promise<boolean> {
  const now = new Date();
  const pack = await SMSPack.findOneAndUpdate(
    {
      merchantId,
      isActive: true,
      expiresAt: { $gt: now },
      $expr: { $lt: ['$usedSMS', '$totalSMS'] },
    },
    { $inc: { usedSMS: 1 } },
    { new: true }
  );

  if (!pack) return false;

  // Deactivate if exhausted
  if (pack.usedSMS >= pack.totalSMS) {
    await SMSPack.findByIdAndUpdate(pack._id, { isActive: false });
  }

  return true;
}

// ─── GET /api/wallet — balance + active pack ─────────────────────────────────
router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const wallet = await getWallet(req.userId!);
    const now = new Date();

    const activePack = await SMSPack.findOne({
      merchantId: req.userId,
      isActive: true,
      expiresAt: { $gt: now },
    }).lean();

    sendSuccess(res, {
      balance: wallet.balance,
      activePack: activePack
        ? {
            plan: activePack.plan,
            remaining: activePack.totalSMS - activePack.usedSMS,
            total: activePack.totalSMS,
            expiresAt: activePack.expiresAt,
          }
        : null,
    });
  })
);

// ─── GET /api/wallet/history ─────────────────────────────────────────────────
router.get(
  '/history',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const page  = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(50, parseInt(req.query.limit as string, 10) || 20);

    const [txns, total] = await Promise.all([
      WalletTransaction.find({ merchantId: req.userId })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      WalletTransaction.countDocuments({ merchantId: req.userId }),
    ]);

    // Use nested format so axios interceptor (res.data = res.data.data) preserves meta
    sendSuccess(res, { data: txns, meta: { total, page, pages: Math.ceil(total / limit) } });
  })
);

// ─── POST /api/wallet/create-order — initiate top-up ────────────────────────
router.post(
  '/create-order',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const amount = parseFloat(req.body.amount);
    if (!amount || isNaN(amount) || amount < 20) {
      throw AppError.badRequest('Minimum top-up amount is ₹20', 'INVALID_AMOUNT');
    }
    if (amount > 100_000) {
      throw AppError.badRequest('Maximum top-up amount per transaction is ₹1,00,000', 'INVALID_AMOUNT');
    }

    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100), // paise
      currency: 'INR',
      notes: { merchantId: req.userId!, type: 'wallet_topup' },
    });

    sendSuccess(res, {
      orderId: order.id,
      amount,
      currency: 'INR',
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  })
);

// ─── POST /api/wallet/verify-payment — credit wallet after successful pay ────
router.post(
  '/verify-payment',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount } = req.body as {
      razorpay_order_id: string;
      razorpay_payment_id: string;
      razorpay_signature: string;
      amount: number; // rupees
    };

    // Verify signature
    const expected = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expected !== razorpay_signature) {
      throw AppError.badRequest('Payment verification failed', 'INVALID_SIGNATURE');
    }

    // Idempotency: check if already processed
    const existing = await WalletTransaction.findOne({ razorpayPaymentId: razorpay_payment_id });
    if (existing) {
      const wallet = await getWallet(req.userId!);
      return sendSuccess(res, { balance: wallet.balance, alreadyProcessed: true });
    }

    // Credit wallet atomically
    const wallet = await Wallet.findOneAndUpdate(
      { merchantId: req.userId },
      { $inc: { balance: amount }, $setOnInsert: { merchantId: req.userId } },
      { upsert: true, new: true }
    );

    await WalletTransaction.create({
      merchantId: req.userId,
      type: 'credit',
      amount,
      balanceAfter: wallet.balance,
      description: `Wallet top-up via Razorpay`,
      channel: 'razorpay',
      razorpayPaymentId: razorpay_payment_id,
    });

    sendSuccess(res, { balance: wallet.balance });
  })
);

// ─── POST /api/wallet/buy-pack/create-order ──────────────────────────────────
// Pricing: Fast2SMS cost ₹0.25/SMS → we charge ₹0.37/SMS (48% markup)
// sms_100:  100 SMS = ₹37  (30 days)
// sms_500:  500 SMS = ₹185 (60 days)
// sms_2000: 2000 SMS = ₹740 (90 days)
const PACK_CONFIG = {
  sms_100:  { price: 37,  totalSMS: 100,  validityDays: 30,  label: '100 SMS Pack  (₹0.37/SMS)' },
  sms_500:  { price: 185, totalSMS: 500,  validityDays: 60,  label: '500 SMS Pack  (₹0.37/SMS)' },
  sms_2000: { price: 740, totalSMS: 2000, validityDays: 90,  label: '2000 SMS Pack (₹0.37/SMS)' },
} as const;

// ─── GET /api/wallet/plans — list available SMS packs ────────────────────────
router.get(
  '/plans',
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    const plans = (Object.entries(PACK_CONFIG) as [string, typeof PACK_CONFIG[keyof typeof PACK_CONFIG]][]).map(
      ([key, cfg]) => ({
        plan: key,
        price: cfg.price,
        totalSMS: cfg.totalSMS,
        validityDays: cfg.validityDays,
        label: cfg.label,
        pricePerSMS: Number((cfg.price / cfg.totalSMS).toFixed(2)),
      })
    );
    sendSuccess(res, plans);
  })
);

router.post(
  '/buy-pack/create-order',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { plan } = req.body as { plan: keyof typeof PACK_CONFIG };
    if (!PACK_CONFIG[plan]) {
      throw AppError.badRequest('Invalid plan', 'INVALID_PLAN');
    }

    const config = PACK_CONFIG[plan];
    const order = await razorpay.orders.create({
      amount: config.price * 100,
      currency: 'INR',
      notes: { merchantId: req.userId!, type: 'sms_pack', plan },
    });

    sendSuccess(res, {
      orderId: order.id,
      amount: config.price,
      label: config.label,
      currency: 'INR',
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  })
);

// ─── POST /api/wallet/buy-pack/verify ────────────────────────────────────────
router.post(
  '/buy-pack/verify',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan } = req.body as {
      razorpay_order_id: string;
      razorpay_payment_id: string;
      razorpay_signature: string;
      plan: keyof typeof PACK_CONFIG;
    };

    const config = PACK_CONFIG[plan];
    if (!config) throw AppError.badRequest('Invalid plan', 'INVALID_PLAN');

    // Verify signature
    const expected = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expected !== razorpay_signature) {
      throw AppError.badRequest('Payment verification failed', 'INVALID_SIGNATURE');
    }

    // Idempotency
    const existing = await SMSPack.findOne({ razorpayPaymentId: razorpay_payment_id });
    if (existing) return sendSuccess(res, { pack: existing, alreadyProcessed: true });

    const now = new Date();
    const expiresAt = new Date(now.getTime() + config.validityDays * 24 * 60 * 60 * 1000);

    // Deactivate any existing active pack (one active pack at a time)
    await SMSPack.updateMany({ merchantId: req.userId, isActive: true }, { isActive: false });

    const pack = await SMSPack.create({
      merchantId: req.userId,
      plan,
      totalSMS: config.totalSMS,
      usedSMS: 0,
      purchasedAt: now,
      expiresAt,
      isActive: true,
      razorpayPaymentId: razorpay_payment_id,
    });

    sendSuccess(res, { pack }, 201);
  })
);

export default router;
