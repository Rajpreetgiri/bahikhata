import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { HydratedDocument } from 'mongoose';
import { body, validationResult } from 'express-validator';
import User, { IUser } from '../models/User';
import OTP from '../models/OTP';
import RefreshToken from '../models/RefreshToken';
import { sendOTP } from '../services/email';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { sendSuccess } from '../utils/response';

// Access token: short-lived (1 hour). Refresh token: long-lived (30 days).
const ACCESS_TOKEN_EXPIRY  = '1h';
const REFRESH_TOKEN_EXPIRY_DAYS = 30;
const REFRESH_TOKEN_EXPIRY_MS   = REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

async function issueTokenPair(userId: string): Promise<{ accessToken: string; refreshToken: string }> {
  const accessToken = jwt.sign({ userId }, process.env.JWT_SECRET!, { expiresIn: ACCESS_TOKEN_EXPIRY });

  // Generate a cryptographically random refresh token
  const rawRefresh = crypto.randomBytes(40).toString('hex');
  const expiresAt  = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS);

  await RefreshToken.create({ userId, tokenHash: hashToken(rawRefresh), expiresAt });

  return { accessToken, refreshToken: rawRefresh };
}

const router = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateOTP(): string {
  // crypto.randomInt is cryptographically secure (unlike Math.random)
  return crypto.randomInt(100000, 1000000).toString();
}

function formatUser(user: HydratedDocument<IUser>) {
  return {
    id: user._id,
    email: user.email,
    businessName: user.businessName,
    ownerName: user.ownerName,
    phone: user.phone,
    fcmToken: user.fcmToken,
    businessCategory: user.businessCategory,
    businessAddress: user.businessAddress,
    gstNumber: user.gstNumber,
    upiId: user.upiId,
    isOnboarded: user.isOnboarded,
    accountType: user.accountType,
    staffMerchantId: user.staffMerchantId,
    staffRole: user.staffRole,
    createdAt: user.createdAt,
  };
}

function validateRequest(req: Request, res: Response): boolean {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: errors.array()[0].msg },
    });
    return false;
  }
  return true;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// POST /api/auth/send-otp
router.post(
  '/send-otp',
  [body('email').isEmail().normalizeEmail().withMessage('Valid email is required')],
  asyncHandler(async (req: Request, res: Response) => {
    if (!validateRequest(req, res)) return;

    const { email } = req.body as { email: string };

    await OTP.deleteMany({ email, used: false });

    const otp = generateOTP();
    const hashedOTP = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await OTP.create({ email, otp: hashedOTP, expiresAt, used: false });
    await sendOTP(email, otp);

    sendSuccess(res, { email }, 200);
  })
);

// POST /api/auth/verify-otp
const MAX_OTP_ATTEMPTS = 5;

router.post(
  '/verify-otp',
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('otp').isLength({ min: 6, max: 6 }).isNumeric().withMessage('OTP must be 6 digits'),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    if (!validateRequest(req, res)) return;

    const { email, otp } = req.body as { email: string; otp: string };

    const otpRecord = await OTP.findOne({
      email,
      used: false,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (!otpRecord) {
      throw AppError.badRequest('OTP expired or not found. Please request a new one.', 'OTP_EXPIRED');
    }

    // Brute-force guard: invalidate OTP after too many wrong attempts
    if (otpRecord.attempts >= MAX_OTP_ATTEMPTS) {
      otpRecord.used = true;
      await otpRecord.save();
      throw AppError.badRequest('Too many incorrect attempts. Please request a new OTP.', 'OTP_MAX_ATTEMPTS');
    }

    const isMatch = await bcrypt.compare(otp, otpRecord.otp);
    if (!isMatch) {
      otpRecord.attempts += 1;
      await otpRecord.save();
      const remaining = MAX_OTP_ATTEMPTS - otpRecord.attempts;
      throw AppError.badRequest(
        remaining > 0 ? `Invalid OTP. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.` : 'Invalid OTP. OTP has been invalidated.',
        'OTP_INVALID'
      );
    }

    otpRecord.used = true;
    await otpRecord.save();

    // Find all merchant accounts for this email (multiple businesses support)
    const merchants = await User.find({ email, accountType: 'merchant' });

    if (merchants.length === 0) {
      // Check if user exists with any accountType (defensive: handles legacy/edge-case docs)
      const anyExisting = await User.findOne({ email });
      if (anyExisting) {
        // Fix accountType if it wasn't saved correctly, then log in
        if (anyExisting.accountType !== 'merchant') {
          anyExisting.accountType = 'merchant';
          await anyExisting.save();
        }
        const { accessToken, refreshToken } = await issueTokenPair(String(anyExisting._id));
        return sendSuccess(res, { token: accessToken, refreshToken, user: formatUser(anyExisting), isNewUser: false });
      }

      // Truly new user — create first merchant account
      try {
        const newUser = await User.create({ email, accountType: 'merchant' });
        const { accessToken, refreshToken } = await issueTokenPair(String(newUser._id));
        return sendSuccess(res, { token: accessToken, refreshToken, user: formatUser(newUser), isNewUser: true });
      } catch (createErr: unknown) {
        // Handle race condition or stale unique index: if duplicate key, just log the user in
        const mongoErr = createErr as { code?: number };
        if (mongoErr?.code === 11000) {
          const existing = await User.findOne({ email });
          if (existing) {
            const { accessToken, refreshToken } = await issueTokenPair(String(existing._id));
            return sendSuccess(res, { token: accessToken, refreshToken, user: formatUser(existing), isNewUser: false });
          }
        }
        throw createErr;
      }
    }

    if (merchants.length === 1) {
      // Single business — log in directly
      const { accessToken, refreshToken } = await issueTokenPair(String(merchants[0]._id));
      return sendSuccess(res, { token: accessToken, refreshToken, user: formatUser(merchants[0]), isNewUser: false });
    }

    // Multiple businesses — return selection list with a short-lived selection token
    const eligibleIds = merchants.map((m) => String(m._id));
    const selectionToken = jwt.sign({ email, eligibleIds }, process.env.JWT_SECRET!, { expiresIn: '10m' });
    return sendSuccess(res, {
      needsBusinessSelect: true,
      selectionToken,
      businesses: merchants.map((m) => ({
        id: m._id,
        businessName: m.businessName || '(Unnamed)',
        ownerName: m.ownerName,
        isOnboarded: m.isOnboarded,
      })),
    });
  })
);

// POST /api/auth/refresh  — rotate refresh token, issue new access token
router.post(
  '/refresh',
  asyncHandler(async (req: Request, res: Response) => {
    const { refreshToken } = req.body as { refreshToken?: string };
    if (!refreshToken) throw AppError.badRequest('refreshToken is required', 'MISSING_REFRESH_TOKEN');

    const tokenHash = hashToken(refreshToken);
    const record = await RefreshToken.findOne({ tokenHash, expiresAt: { $gt: new Date() } });
    if (!record) throw AppError.unauthorized('Invalid or expired refresh token', 'INVALID_REFRESH_TOKEN');

    const user = await User.findById(record.userId);
    if (!user) throw AppError.unauthorized('User not found', 'USER_NOT_FOUND');

    // Rotate: delete old token, issue new pair
    await RefreshToken.findByIdAndDelete(record._id);
    const { accessToken, refreshToken: newRefreshToken } = await issueTokenPair(String(user._id));

    sendSuccess(res, { token: accessToken, refreshToken: newRefreshToken, user: formatUser(user) });
  })
);

// POST /api/auth/logout  — revoke refresh token
router.post(
  '/logout',
  asyncHandler(async (req: Request, res: Response) => {
    const { refreshToken } = req.body as { refreshToken?: string };
    if (refreshToken) {
      await RefreshToken.findOneAndDelete({ tokenHash: hashToken(refreshToken) });
    }
    sendSuccess(res, { message: 'Logged out successfully' });
  })
);

// GET /api/auth/me
router.get(
  '/me',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    sendSuccess(res, formatUser(req.user!));
  })
);

// PUT /api/auth/profile
router.put(
  '/profile',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const {
      businessName,
      ownerName,
      phone,
      fcmToken,
      businessCategory,
      businessAddress,
      gstNumber,
      upiId,
      isOnboarded,
    } = req.body as Partial<IUser>;

    const user = req.user!;

    if (businessName !== undefined) user.businessName = businessName;
    if (ownerName !== undefined) user.ownerName = ownerName;
    if (phone !== undefined) user.phone = phone;
    if (fcmToken !== undefined) user.fcmToken = fcmToken;
    if (businessCategory !== undefined) user.businessCategory = businessCategory;
    if (businessAddress !== undefined) user.businessAddress = businessAddress;
    if (gstNumber !== undefined) user.gstNumber = gstNumber;
    if (upiId !== undefined) user.upiId = upiId || undefined;
    if (isOnboarded !== undefined) user.isOnboarded = isOnboarded;

    await user.save();
    sendSuccess(res, formatUser(user));
  })
);

// POST /api/auth/select-business — choose one business after multi-business OTP verify
router.post(
  '/select-business',
  asyncHandler(async (req: Request, res: Response) => {
    const { selectionToken, businessId } = req.body as { selectionToken?: string; businessId?: string };
    if (!selectionToken || !businessId) throw AppError.badRequest('selectionToken and businessId are required', 'MISSING_PARAMS');

    let payload: { email: string; eligibleIds: string[] };
    try {
      payload = jwt.verify(selectionToken, process.env.JWT_SECRET!) as typeof payload;
    } catch {
      throw AppError.unauthorized('Selection token expired or invalid', 'INVALID_SELECTION_TOKEN');
    }

    if (!payload.eligibleIds.includes(businessId)) {
      throw AppError.forbidden('Business not in eligible list', 'INELIGIBLE_BUSINESS');
    }

    const user = await User.findById(businessId);
    if (!user) throw AppError.notFound('Business not found', 'NOT_FOUND');

    const { accessToken, refreshToken } = await issueTokenPair(String(user._id));
    sendSuccess(res, { token: accessToken, refreshToken, user: formatUser(user) });
  })
);

// POST /api/auth/create-business — add a new business for an existing verified email
router.post(
  '/create-business',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const email = req.user!.email;
    const count = await User.countDocuments({ email, accountType: 'merchant' });
    if (count >= 5) throw AppError.badRequest('Maximum 5 businesses per email', 'MAX_BUSINESSES');

    const newBusiness = await User.create({ email, accountType: 'merchant' });
    const { accessToken, refreshToken } = await issueTokenPair(String(newBusiness._id));
    sendSuccess(res, { token: accessToken, refreshToken, user: formatUser(newBusiness), isNewUser: true }, 201);
  })
);

// GET /api/auth/businesses — list all merchant accounts for logged-in user's email
router.get(
  '/businesses',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const email = req.user!.email;
    const businesses = await User.find({ email, accountType: 'merchant' }).select(
      '_id businessName ownerName businessCategory isOnboarded createdAt'
    );
    sendSuccess(res, businesses.map((b) => ({
      id: b._id,
      businessName: b.businessName || '(Unnamed)',
      ownerName: b.ownerName,
      businessCategory: b.businessCategory,
      isOnboarded: b.isOnboarded,
      createdAt: b.createdAt,
    })));
  })
);

// DELETE /api/auth/account — GDPR: permanently delete merchant + all their data
// Requires OTP confirmation step — user must have a valid session
router.delete(
  '/account',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { confirmPhrase } = req.body as { confirmPhrase?: string };
    // Require explicit confirmation to prevent accidental deletion
    if (confirmPhrase !== 'DELETE MY ACCOUNT') {
      throw AppError.badRequest(
        'To confirm deletion, send confirmPhrase: "DELETE MY ACCOUNT"',
        'CONFIRMATION_REQUIRED'
      );
    }

    const userId = req.userId!;

    // Lazy-load models to avoid circular imports
    const [
      Customer, Transaction, Invoice, Product,
      Supplier, SupplierTransaction, Reminder,
      Payment, Expense, Notification, Wallet,
      WalletTransaction, SMSPack, Counter,
      PayoutAccount, RouteTransfer,
    ] = await Promise.all([
      import('../models/Customer').then((m) => m.default),
      import('../models/Transaction').then((m) => m.default),
      import('../models/Invoice').then((m) => m.default),
      import('../models/Product').then((m) => m.default),
      import('../models/Supplier').then((m) => m.default),
      import('../models/SupplierTransaction').then((m) => m.default),
      import('../models/Reminder').then((m) => m.default),
      import('../models/Payment').then((m) => m.default),
      import('../models/Expense').then((m) => m.default),
      import('../models/Notification').then((m) => m.default),
      import('../models/Wallet').then((m) => m.default),
      import('../models/WalletTransaction').then((m) => m.default),
      import('../models/SMSPack').then((m) => m.default),
      import('../models/Counter').then((m) => m.default),
      import('../models/PayoutAccount').then((m) => m.default),
      import('../models/RouteTransfer').then((m) => m.default),
    ]);

    // Cascade delete all merchant data
    await Promise.all([
      Customer.deleteMany({ merchantId: userId }),
      Transaction.deleteMany({ merchantId: userId }),
      Invoice.deleteMany({ merchantId: userId }),
      Product.deleteMany({ merchantId: userId }),
      Supplier.deleteMany({ merchantId: userId }),
      SupplierTransaction.deleteMany({ merchantId: userId }),
      Reminder.deleteMany({ merchantId: userId }),
      Payment.deleteMany({ merchantId: userId }),
      Expense.deleteMany({ merchantId: userId }),
      Notification.deleteMany({ merchantId: userId }),
      Wallet.deleteMany({ merchantId: userId }),
      WalletTransaction.deleteMany({ merchantId: userId }),
      SMSPack.deleteMany({ merchantId: userId }),
      Counter.deleteMany({ merchantId: userId }),
      PayoutAccount.deleteMany({ merchantId: userId }),
      RouteTransfer.deleteMany({ merchantId: userId }),
      RefreshToken.deleteMany({ userId }),
    ]);

    // Finally delete the user
    await User.findByIdAndDelete(userId);

    sendSuccess(res, { message: 'Account and all associated data permanently deleted.' });
  })
);

export default router;
