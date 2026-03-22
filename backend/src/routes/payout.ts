import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import PayoutAccount from '../models/PayoutAccount';
import RouteTransfer from '../models/RouteTransfer';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { sendSuccess, sendPaginated } from '../utils/response';
import { createLinkedAccount, fetchLinkedAccount } from '../services/razorpay';

const router = Router();
router.use(authenticate);

/** Mask PAN: first 5 chars visible, middle 4 masked, last char visible — e.g. "ABCDE****A" */
function maskPan(pan: string): string {
  if (!pan || pan.length < 10) return pan;
  return pan.slice(0, 5) + '****' + pan.slice(-1);
}

/** Mask bank account number: show only last 4 digits */
function maskAccountNumber(num: string): string {
  if (!num) return num;
  return '****' + num.slice(-4);
}

/** Build safe account object (never expose pan raw or bankAccountNumberFull) */
function safeAccount(doc: InstanceType<typeof PayoutAccount>) {
  const obj = doc.toObject();
  delete obj.bankAccountNumberFull;
  if (obj.pan) obj.pan = maskPan(obj.pan as string);
  return obj;
}

// GET /api/payout — get current merchant's payout account
router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const account = await PayoutAccount.findOne({ merchantId: req.userId });
    if (!account) {
      // Return a default empty state (not_connected) so frontend can render the connect form
      return sendSuccess(res, { razorpayAccountStatus: 'not_connected', platformFeePercent: 0, totalRouteTransfers: 0, totalAmountRouted: 0 });
    }
    sendSuccess(res, safeAccount(account));
  })
);

// POST /api/payout/connect — collect legal info + bank + UPI → create Razorpay linked account
router.post(
  '/connect',
  [
    body('legalBusinessName').trim().notEmpty().withMessage('Legal business name is required'),
    body('pan')
      .trim()
      .notEmpty()
      .withMessage('PAN is required')
      .matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i)
      .withMessage('Invalid PAN format (e.g. ABCDE1234F)'),
    body('city').trim().notEmpty().withMessage('City is required'),
    body('state').trim().notEmpty().withMessage('State is required'),
    body('postalCode')
      .trim()
      .notEmpty()
      .withMessage('Postal code is required')
      .matches(/^\d{6}$/)
      .withMessage('Postal code must be 6 digits'),
  ],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) throw AppError.badRequest(errors.array()[0].msg, 'VALIDATION_ERROR');

    const {
      legalBusinessName, pan, city, state, postalCode,
      bankAccountName, bankAccountNumber, bankIfsc, bankName,
      upiId,
    } = req.body as {
      legalBusinessName: string; pan: string; city: string;
      state: string; postalCode: string;
      bankAccountName?: string; bankAccountNumber?: string;
      bankIfsc?: string; bankName?: string; upiId?: string;
    };

    // Check if already connected
    const existing = await PayoutAccount.findOne({ merchantId: req.userId });
    if (existing?.razorpayAccountId && existing.razorpayAccountStatus !== 'not_connected') {
      throw AppError.conflict('Payout account already connected. Disconnect first to reconnect.', 'ALREADY_CONNECTED');
    }

    // Create Razorpay linked account
    const merchant = req.user!;
    let razorpayAccountId: string | undefined;
    let rzpStatus = 'created';

    try {
      const result = await createLinkedAccount({
        email: merchant.email,
        legalBusinessName: legalBusinessName.trim(),
        pan: pan.trim().toUpperCase(),
        city: city.trim(),
        state: state.trim().toUpperCase(),
        postalCode: postalCode.trim(),
        description: merchant.businessName || legalBusinessName,
      });
      razorpayAccountId = result.id;
      rzpStatus = result.status;
    } catch (err: unknown) {
      // If Razorpay fails (e.g. test mode, not activated), store details without account ID
      console.error('[Payout] Razorpay linked account creation failed:', err instanceof Error ? err.message : err);
      // Don't throw — store info and let user retry via sync-status or reconnect
    }

    const defaultFee = parseFloat(process.env.RAZORPAY_PLATFORM_FEE_PERCENT ?? '0');

    const account = await PayoutAccount.findOneAndUpdate(
      { merchantId: req.userId },
      {
        $set: {
          merchantId: req.userId,
          legalBusinessName: legalBusinessName.trim(),
          pan: pan.trim().toUpperCase(),
          businessCity: city.trim(),
          businessState: state.trim().toUpperCase(),
          businessPostalCode: postalCode.trim(),
          ...(bankAccountName && { bankAccountName: bankAccountName.trim() }),
          ...(bankAccountNumber && {
            bankAccountNumberFull: bankAccountNumber.trim(),
            bankAccountNumber: maskAccountNumber(bankAccountNumber.trim()),
          }),
          ...(bankIfsc && { bankIfsc: bankIfsc.trim().toUpperCase() }),
          ...(bankName && { bankName: bankName.trim() }),
          ...(upiId && { upiId: upiId.trim().toLowerCase() }),
          ...(razorpayAccountId && { razorpayAccountId }),
          razorpayAccountStatus: razorpayAccountId ? 'created' : 'not_connected',
          platformFeePercent: defaultFee,
        },
      },
      { upsert: true, new: true }
    );

    sendSuccess(res, safeAccount(account!), 201);
  })
);

// PATCH /api/payout/upi — update UPI ID only
router.patch(
  '/upi',
  [body('upiId').trim().notEmpty().withMessage('UPI ID is required')],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) throw AppError.badRequest(errors.array()[0].msg, 'VALIDATION_ERROR');

    const account = await PayoutAccount.findOneAndUpdate(
      { merchantId: req.userId },
      { $set: { upiId: (req.body.upiId as string).trim().toLowerCase() } },
      { upsert: true, new: true }
    );
    sendSuccess(res, safeAccount(account!));
  })
);

// PATCH /api/payout/bank — update bank account details
router.patch(
  '/bank',
  [
    body('bankAccountName').trim().notEmpty().withMessage('Account holder name is required'),
    body('bankAccountNumber').trim().notEmpty().withMessage('Account number is required'),
    body('bankIfsc')
      .trim()
      .notEmpty()
      .withMessage('IFSC is required')
      .matches(/^[A-Z]{4}0[A-Z0-9]{6}$/i)
      .withMessage('Invalid IFSC format (e.g. SBIN0001234)'),
  ],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) throw AppError.badRequest(errors.array()[0].msg, 'VALIDATION_ERROR');

    const { bankAccountName, bankAccountNumber, bankIfsc, bankName } = req.body as {
      bankAccountName: string; bankAccountNumber: string; bankIfsc: string; bankName?: string;
    };

    const account = await PayoutAccount.findOneAndUpdate(
      { merchantId: req.userId },
      {
        $set: {
          bankAccountName: bankAccountName.trim(),
          bankAccountNumberFull: bankAccountNumber.trim(),
          bankAccountNumber: maskAccountNumber(bankAccountNumber.trim()),
          bankIfsc: bankIfsc.trim().toUpperCase(),
          ...(bankName && { bankName: bankName.trim() }),
        },
      },
      { upsert: true, new: true }
    );
    sendSuccess(res, safeAccount(account!));
  })
);

// PATCH /api/payout/fee — update platform fee percent
router.patch(
  '/fee',
  [
    body('platformFeePercent')
      .isFloat({ min: 0, max: 100 })
      .withMessage('platformFeePercent must be between 0 and 100'),
  ],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) throw AppError.badRequest(errors.array()[0].msg, 'VALIDATION_ERROR');

    const account = await PayoutAccount.findOneAndUpdate(
      { merchantId: req.userId },
      { $set: { platformFeePercent: parseFloat(req.body.platformFeePercent) } },
      { upsert: true, new: true }
    );
    sendSuccess(res, safeAccount(account!));
  })
);

// POST /api/payout/sync-status — re-fetch status from Razorpay
router.post(
  '/sync-status',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const account = await PayoutAccount.findOne({ merchantId: req.userId });
    if (!account?.razorpayAccountId) {
      throw AppError.badRequest('No Razorpay account connected', 'NO_ACCOUNT');
    }

    const result = await fetchLinkedAccount(account.razorpayAccountId);

    // Map Razorpay status to our internal status
    const statusMap: Record<string, typeof account.razorpayAccountStatus> = {
      created: 'created',
      activated: 'active',
      suspended: 'suspended',
    };
    const newStatus = statusMap[result.status] ?? account.razorpayAccountStatus;

    account.razorpayAccountStatus = newStatus;
    if (newStatus === 'active' && !account.razorpayActivatedAt) {
      account.razorpayActivatedAt = new Date();
    }
    await account.save();

    sendSuccess(res, safeAccount(account));
  })
);

// GET /api/payout/transfers — paginated route transfer history
router.get(
  '/transfers',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));

    const total = await RouteTransfer.countDocuments({ merchantId: req.userId });
    const transfers = await RouteTransfer.find({ merchantId: req.userId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    sendPaginated(res, transfers, { total, page, pages: Math.ceil(total / limit) });
  })
);

// DELETE /api/payout/disconnect — remove linked account connection
router.delete(
  '/disconnect',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await PayoutAccount.findOneAndUpdate(
      { merchantId: req.userId },
      {
        $unset: { razorpayAccountId: 1, razorpayActivatedAt: 1 },
        $set: { razorpayAccountStatus: 'not_connected' },
      }
    );
    sendSuccess(res, { message: 'Payout account disconnected' });
  })
);

export default router;
