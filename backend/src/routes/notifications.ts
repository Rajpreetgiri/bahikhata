import { Router, Response } from 'express';
import mongoose from 'mongoose';
import Notification from '../models/Notification';
import { authenticate, AuthRequest } from '../middleware/auth';
import { adminAuth, AdminRequest } from '../middleware/adminAuth';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { sendSuccess } from '../utils/response';

const router = Router();

// ─── Merchant routes (authenticated) ─────────────────────────────────────────

// GET /api/notifications
// Returns notifications targeted to this merchant + broadcasts, with isRead flag
router.get(
  '/',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const mid = new mongoose.Types.ObjectId(req.userId!);

    const notifications = await Notification.find({
      $or: [{ merchantId: mid }, { merchantId: null }],
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const result = notifications.map((n) => ({
      ...n,
      isRead: n.readBy.some((id) => id.equals(mid)),
    }));

    const unreadCount = result.filter((n) => !n.isRead).length;

    sendSuccess(res, { notifications: result, unreadCount });
  })
);

// POST /api/notifications/:id/read
router.post(
  '/:id/read',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      throw AppError.badRequest('Invalid ID', 'INVALID_ID');
    }
    const mid = new mongoose.Types.ObjectId(req.userId!);

    await Notification.findByIdAndUpdate(req.params.id, {
      $addToSet: { readBy: mid },
    });

    sendSuccess(res, { ok: true });
  })
);

// POST /api/notifications/read-all
router.post(
  '/read-all',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const mid = new mongoose.Types.ObjectId(req.userId!);

    await Notification.updateMany(
      { $or: [{ merchantId: mid }, { merchantId: null }], readBy: { $ne: mid } },
      { $addToSet: { readBy: mid } }
    );

    sendSuccess(res, { ok: true });
  })
);

// ─── Admin routes (protected by JWT admin token — see /api/admin/login) ────────

// POST /api/notifications/admin/send
// Body: { title, body, merchantId? }  — merchantId omitted = broadcast
router.post(
  '/admin/send',
  adminAuth,
  asyncHandler(async (req: AdminRequest, res: Response) => {
    const { title, body, merchantId } = req.body as {
      title: string;
      body: string;
      merchantId?: string;
    };

    if (!title?.trim() || !body?.trim()) {
      throw AppError.badRequest('title and body are required', 'VALIDATION_ERROR');
    }

    const notification = await Notification.create({
      merchantId: merchantId && mongoose.isValidObjectId(merchantId)
        ? new mongoose.Types.ObjectId(merchantId)
        : null,
      title: title.trim(),
      body: body.trim(),
    });

    sendSuccess(res, notification, 201);
  })
);

// GET /api/notifications/admin/list — list all notifications (admin view)
router.get(
  '/admin/list',
  adminAuth,
  asyncHandler(async (_req: AdminRequest, res: Response) => {
    const notifications = await Notification.find().sort({ createdAt: -1 }).limit(100).lean();
    sendSuccess(res, notifications);
  })
);

export default router;
