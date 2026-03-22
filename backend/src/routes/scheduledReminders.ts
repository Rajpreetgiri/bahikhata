import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import mongoose from 'mongoose';
import ScheduledReminder from '../models/ScheduledReminder';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { sendSuccess } from '../utils/response';

const router = Router();
router.use(authenticate);

// GET /api/scheduled-reminders
router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const rules = await ScheduledReminder.find({ merchantId: req.userId }).sort({ offsetDays: 1 });
    sendSuccess(res, rules);
  })
);

// POST /api/scheduled-reminders
router.post(
  '/',
  [
    body('offsetDays').isInt({ min: -30, max: 60 }).withMessage('offsetDays must be between -30 and 60'),
    body('channels').isArray({ min: 1 }).withMessage('At least one channel required'),
    body('channels.*').isIn(['email', 'sms', 'whatsapp']).withMessage('Invalid channel'),
  ],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw AppError.badRequest(errors.array()[0].msg, 'VALIDATION_ERROR');
    }

    const { offsetDays, channels } = req.body as { offsetDays: number; channels: string[] };

    // Prevent duplicate rules for same merchant + offsetDays
    const existing = await ScheduledReminder.findOne({ merchantId: req.userId, offsetDays });
    if (existing) {
      throw AppError.badRequest('A rule for this offset already exists', 'DUPLICATE_RULE');
    }

    const rule = await ScheduledReminder.create({
      merchantId: req.userId,
      offsetDays,
      channels,
      isEnabled: true,
    });

    sendSuccess(res, rule, 201);
  })
);

// PATCH /api/scheduled-reminders/:id  — toggle enabled or update channels
router.patch(
  '/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      throw AppError.badRequest('Invalid ID', 'INVALID_ID');
    }

    const { isEnabled, channels } = req.body as { isEnabled?: boolean; channels?: string[] };
    const update: Record<string, unknown> = {};
    if (typeof isEnabled === 'boolean') update.isEnabled = isEnabled;
    if (Array.isArray(channels) && channels.length > 0) update.channels = channels;

    const rule = await ScheduledReminder.findOneAndUpdate(
      { _id: req.params.id, merchantId: req.userId },
      { $set: update },
      { new: true }
    );
    if (!rule) throw AppError.notFound('Rule not found', 'NOT_FOUND');

    sendSuccess(res, rule);
  })
);

// DELETE /api/scheduled-reminders/:id
router.delete(
  '/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      throw AppError.badRequest('Invalid ID', 'INVALID_ID');
    }

    const rule = await ScheduledReminder.findOneAndDelete({ _id: req.params.id, merchantId: req.userId });
    if (!rule) throw AppError.notFound('Rule not found', 'NOT_FOUND');

    sendSuccess(res, { message: 'Rule deleted' });
  })
);

export default router;
