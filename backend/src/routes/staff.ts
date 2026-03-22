import { Router, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import User from '../models/User';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { sendSuccess } from '../utils/response';
import { sendStaffInvite } from '../services/email';

const router = Router();
router.use(authenticate);

// GET /api/staff — list all staff members for this merchant
router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const merchantId = req.userId!;
    const staffList = await User.find({
      staffMerchantId: merchantId,
      accountType: 'staff',
    }).select('_id email ownerName staffRole createdAt');

    sendSuccess(res, staffList.map((s) => ({
      id: s._id,
      email: s.email,
      name: s.ownerName || s.email,
      role: s.staffRole,
      joinedAt: s.createdAt,
    })));
  })
);

// POST /api/staff/invite — send invite email to a staff member
router.post(
  '/invite',
  requireAdmin,
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('role').isIn(['admin', 'viewer']).withMessage('role must be admin or viewer'),
  ],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) throw AppError.badRequest(errors.array()[0].msg, 'VALIDATION_ERROR');

    const { email, role } = req.body as { email: string; role: 'admin' | 'viewer' };
    const merchantId = req.userId!;

    // Check staff limit (max 5)
    const staffCount = await User.countDocuments({ staffMerchantId: merchantId, accountType: 'staff' });
    if (staffCount >= 5) throw AppError.badRequest('Maximum 5 staff members allowed', 'STAFF_LIMIT');

    // Check if already a staff for this merchant
    const existing = await User.findOne({ email, staffMerchantId: merchantId, accountType: 'staff' });
    if (existing) throw AppError.conflict('This email is already a staff member', 'ALREADY_STAFF');

    // Generate raw invite token (unguessable), hash for storage
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = await bcrypt.hash(rawToken, 10);
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48h

    // Upsert a pending staff user (find-or-create by email+pending merchant combo)
    let staffUser = await User.findOne({ email, accountType: 'staff', staffPendingMerchantId: merchantId });
    if (!staffUser) {
      staffUser = await User.create({
        email,
        accountType: 'staff',
        staffPendingMerchantId: merchantId,
        staffPendingRole: role,
        staffInviteToken: hashedToken,
        staffInviteExpiresAt: expiresAt,
      });
    } else {
      staffUser.staffPendingRole = role;
      staffUser.staffInviteToken = hashedToken;
      staffUser.staffInviteExpiresAt = expiresAt;
      await staffUser.save();
    }

    // Send invite email
    const merchant = await User.findById(merchantId).select('businessName');
    await sendStaffInvite(email, merchant?.businessName || 'Your business', role, rawToken);

    sendSuccess(res, { message: `Invitation sent to ${email}` }, 201);
  })
);

// POST /api/staff/accept-invite — staff clicks invite link, accepts with token
router.post(
  '/accept-invite',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { inviteToken, name } = req.body as { inviteToken?: string; name?: string };
    if (!inviteToken) throw AppError.badRequest('inviteToken is required', 'MISSING_TOKEN');

    // Find pending staff users and check token against each (small set — acceptable)
    const candidates = await User.find({
      accountType: 'staff',
      staffMerchantId: { $exists: false },  // not yet accepted
      staffPendingMerchantId: { $exists: true },
      staffInviteExpiresAt: { $gt: new Date() },
    });

    let matchedUser = null;
    for (const candidate of candidates) {
      if (candidate.staffInviteToken && await bcrypt.compare(inviteToken, candidate.staffInviteToken)) {
        matchedUser = candidate;
        break;
      }
    }

    if (!matchedUser) throw AppError.badRequest('Invalid or expired invite token', 'INVALID_INVITE');

    // Activate staff account
    matchedUser.staffMerchantId = matchedUser.staffPendingMerchantId!;
    matchedUser.staffRole = matchedUser.staffPendingRole;
    matchedUser.staffPendingMerchantId = undefined;
    matchedUser.staffPendingRole = undefined;
    matchedUser.staffInviteToken = undefined;
    matchedUser.staffInviteExpiresAt = undefined;
    if (name) matchedUser.ownerName = name;
    matchedUser.isOnboarded = true;
    await matchedUser.save();

    // Issue JWT for the staff user (their own userId, auth middleware handles merchantId mapping)
    const accessToken = jwt.sign({ userId: String(matchedUser._id) }, process.env.JWT_SECRET!, { expiresIn: '1h' });

    sendSuccess(res, {
      token: accessToken,
      user: {
        id: matchedUser._id,
        email: matchedUser.email,
        name: matchedUser.ownerName,
        role: matchedUser.staffRole,
        merchantId: matchedUser.staffMerchantId,
      },
    });
  })
);

// PATCH /api/staff/:staffId/role — change staff role
router.patch(
  '/:staffId/role',
  requireAdmin,
  [body('role').isIn(['admin', 'viewer']).withMessage('role must be admin or viewer')],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) throw AppError.badRequest(errors.array()[0].msg, 'VALIDATION_ERROR');

    const { role } = req.body as { role: 'admin' | 'viewer' };
    const staffUser = await User.findOneAndUpdate(
      { _id: req.params.staffId, staffMerchantId: req.userId, accountType: 'staff' },
      { staffRole: role },
      { new: true }
    );
    if (!staffUser) throw AppError.notFound('Staff member not found', 'NOT_FOUND');

    sendSuccess(res, { id: staffUser._id, role: staffUser.staffRole });
  })
);

// DELETE /api/staff/:staffId — remove staff member
router.delete(
  '/:staffId',
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const deleted = await User.findOneAndDelete({
      _id: req.params.staffId,
      staffMerchantId: req.userId,
      accountType: 'staff',
    });
    if (!deleted) throw AppError.notFound('Staff member not found', 'NOT_FOUND');

    sendSuccess(res, { message: 'Staff member removed' });
  })
);

export default router;
