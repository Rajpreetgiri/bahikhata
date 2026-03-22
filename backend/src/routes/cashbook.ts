import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import mongoose from 'mongoose';
import CashEntry from '../models/CashEntry';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { sendSuccess } from '../utils/response';

const router = Router();
router.use(authenticate);

// GET /api/cashbook?type=in|out&dateFrom=&dateTo=&page=&limit=
router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const page  = Math.max(1, parseInt(req.query.page  as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 30));

    const filter: Record<string, unknown> = { merchantId: req.userId };

    if (req.query.type === 'in' || req.query.type === 'out') {
      filter.type = req.query.type;
    }

    if (req.query.dateFrom || req.query.dateTo) {
      const dateFilter: Record<string, Date> = {};
      if (req.query.dateFrom) {
        const d = new Date(req.query.dateFrom as string);
        if (!isNaN(d.getTime())) dateFilter.$gte = d;
      }
      if (req.query.dateTo) {
        const d = new Date(req.query.dateTo as string);
        if (!isNaN(d.getTime())) { d.setHours(23, 59, 59, 999); dateFilter.$lte = d; }
      }
      if (Object.keys(dateFilter).length) filter.date = dateFilter;
    }

    const total = await CashEntry.countDocuments(filter);
    const entries = await CashEntry.find(filter)
      .sort({ date: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    sendSuccess(res, { data: entries, meta: { total, page, pages: Math.ceil(total / limit) } });
  })
);

// GET /api/cashbook/summary?dateFrom=&dateTo=
router.get(
  '/summary',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const matchFilter: Record<string, unknown> = {
      merchantId: new mongoose.Types.ObjectId(req.userId!),
    };

    if (req.query.dateFrom || req.query.dateTo) {
      const dateFilter: Record<string, Date> = {};
      if (req.query.dateFrom) {
        const d = new Date(req.query.dateFrom as string);
        if (!isNaN(d.getTime())) dateFilter.$gte = d;
      }
      if (req.query.dateTo) {
        const d = new Date(req.query.dateTo as string);
        if (!isNaN(d.getTime())) { d.setHours(23, 59, 59, 999); dateFilter.$lte = d; }
      }
      if (Object.keys(dateFilter).length) matchFilter.date = dateFilter;
    }

    const result = await CashEntry.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: null,
          totalIn: { $sum: { $cond: [{ $eq: ['$type', 'in'] }, '$amount', 0] } },
          totalOut: { $sum: { $cond: [{ $eq: ['$type', 'out'] }, '$amount', 0] } },
          count: { $sum: 1 },
        },
      },
    ]);

    const summary = result[0] ?? { totalIn: 0, totalOut: 0, count: 0 };
    sendSuccess(res, {
      totalIn: summary.totalIn,
      totalOut: summary.totalOut,
      netCash: summary.totalIn - summary.totalOut,
      count: summary.count,
    });
  })
);

// POST /api/cashbook
router.post(
  '/',
  [
    body('type').isIn(['in', 'out']).withMessage('type must be "in" or "out"'),
    body('amount').isFloat({ min: 0.01, max: 10_000_000 }).withMessage('amount must be between ₹0.01 and ₹1,00,00,000'),
    body('date').notEmpty().withMessage('date is required'),
  ],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw AppError.badRequest(errors.array()[0].msg, 'VALIDATION_ERROR');
    }

    const { type, amount, note, date } = req.body as {
      type: 'in' | 'out';
      amount: number;
      note?: string;
      date: string;
    };

    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      throw AppError.badRequest('Invalid date', 'VALIDATION_ERROR');
    }

    const entry = await CashEntry.create({
      merchantId: req.userId,
      type,
      amount: parseFloat(String(amount)),
      note: note || undefined,
      date: parsedDate,
    });

    sendSuccess(res, entry, 201);
  })
);

// PUT /api/cashbook/:id
router.put(
  '/:id',
  [
    body('amount').optional().isFloat({ min: 0.01, max: 10_000_000 }).withMessage('Invalid amount'),
  ],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      throw AppError.badRequest('Invalid ID', 'INVALID_ID');
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw AppError.badRequest(errors.array()[0].msg, 'VALIDATION_ERROR');
    }

    const { type, amount, note, date } = req.body as {
      type?: 'in' | 'out';
      amount?: number;
      note?: string;
      date?: string;
    };

    const update: Record<string, unknown> = {};
    if (type !== undefined) update.type = type;
    if (amount !== undefined) update.amount = parseFloat(String(amount));
    if (note !== undefined) update.note = note || undefined;
    if (date !== undefined) {
      const d = new Date(date);
      if (isNaN(d.getTime())) throw AppError.badRequest('Invalid date', 'VALIDATION_ERROR');
      update.date = d;
    }

    const entry = await CashEntry.findOneAndUpdate(
      { _id: req.params.id, merchantId: req.userId },
      { $set: update },
      { new: true, runValidators: true }
    );
    if (!entry) throw AppError.notFound('Entry not found', 'NOT_FOUND');

    sendSuccess(res, entry);
  })
);

// DELETE /api/cashbook/:id
router.delete(
  '/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      throw AppError.badRequest('Invalid ID', 'INVALID_ID');
    }

    const entry = await CashEntry.findOneAndDelete({ _id: req.params.id, merchantId: req.userId });
    if (!entry) throw AppError.notFound('Entry not found', 'NOT_FOUND');

    sendSuccess(res, { message: 'Entry deleted' });
  })
);

export default router;
