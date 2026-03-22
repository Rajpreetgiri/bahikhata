import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import mongoose from 'mongoose';
import Expense, { ExpenseCategory } from '../models/Expense';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { sendSuccess } from '../utils/response';

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'rent', 'salary', 'electricity', 'raw_material',
  'transport', 'marketing', 'maintenance', 'other',
];
const MAX_AMOUNT = 10_000_000; // ₹1 crore cap

const router = Router();
router.use(authenticate);

function requireValidObjectId(id: string): void {
  if (!mongoose.isValidObjectId(id)) {
    throw AppError.badRequest('Invalid ID format', 'INVALID_ID');
  }
}

// GET /api/expenses
// Query: ?page, limit, category, dateFrom, dateTo
router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const merchantId = req.userId!;
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 30));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = { merchantId };

    if (req.query.category) {
      const cat = req.query.category as string;
      if (!EXPENSE_CATEGORIES.includes(cat as ExpenseCategory)) {
        throw AppError.badRequest(`Invalid category. Must be one of: ${EXPENSE_CATEGORIES.join(', ')}`, 'INVALID_CATEGORY');
      }
      filter.category = cat;
    }

    if (req.query.dateFrom || req.query.dateTo) {
      const dateFilter: Record<string, Date> = {};
      if (req.query.dateFrom) {
        const d = new Date(req.query.dateFrom as string);
        if (isNaN(d.getTime())) throw AppError.badRequest('Invalid dateFrom', 'INVALID_DATE');
        dateFilter.$gte = d;
      }
      if (req.query.dateTo) {
        const end = new Date(req.query.dateTo as string);
        if (isNaN(end.getTime())) throw AppError.badRequest('Invalid dateTo', 'INVALID_DATE');
        end.setHours(23, 59, 59, 999);
        dateFilter.$lte = end;
      }
      filter.date = dateFilter;
    }

    const [expenses, total] = await Promise.all([
      Expense.find(filter).sort({ date: -1, createdAt: -1 }).skip(skip).limit(limit),
      Expense.countDocuments(filter),
    ]);

    // Use nested format so axios interceptor (res.data = res.data.data) preserves meta
    sendSuccess(res, { data: expenses, meta: { total, page, pages: Math.ceil(total / limit) } });
  })
);

// GET /api/expenses/summary — total per category for current month
router.get(
  '/summary',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const merchantId = new mongoose.Types.ObjectId(req.userId!);

    let dateFrom: Date;
    if (req.query.dateFrom) {
      dateFrom = new Date(req.query.dateFrom as string);
      if (isNaN(dateFrom.getTime())) throw AppError.badRequest('Invalid dateFrom', 'INVALID_DATE');
    } else {
      dateFrom = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    }

    let dateTo: Date;
    if (req.query.dateTo) {
      dateTo = new Date(req.query.dateTo as string);
      if (isNaN(dateTo.getTime())) throw AppError.badRequest('Invalid dateTo', 'INVALID_DATE');
      dateTo.setHours(23, 59, 59, 999);
    } else {
      dateTo = new Date();
    }

    const rows = await Expense.aggregate([
      { $match: { merchantId, date: { $gte: dateFrom, $lte: dateTo } } },
      { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ]);

    const grandTotal = rows.reduce((s, r) => s + r.total, 0);

    sendSuccess(res, { categories: rows, grandTotal, dateFrom, dateTo });
  })
);

// POST /api/expenses
router.post(
  '/',
  [
    body('amount').isFloat({ gt: 0, max: MAX_AMOUNT }).withMessage(`Amount must be between ₹0.01 and ₹${MAX_AMOUNT.toLocaleString()}`),
    body('category').isIn(EXPENSE_CATEGORIES).withMessage(`Category must be one of: ${EXPENSE_CATEGORIES.join(', ')}`),
    body('date').notEmpty().withMessage('Date is required').custom((v) => {
      const d = new Date(v);
      if (isNaN(d.getTime())) throw new Error('Invalid date');
      return true;
    }),
  ],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) throw AppError.badRequest(errors.array()[0].msg, 'VALIDATION_ERROR');

    const { amount, category, note, paymentMethod, date } = req.body as {
      amount: number;
      category: string;
      note?: string;
      paymentMethod?: string;
      date: string;
    };

    const expense = await Expense.create({
      merchantId: req.userId,
      amount,
      category,
      note,
      paymentMethod,
      date: new Date(date),
    });

    sendSuccess(res, expense, 201);
  })
);

// PUT /api/expenses/:id
router.put(
  '/:id',
  [
    body('amount').optional().isFloat({ gt: 0, max: MAX_AMOUNT }).withMessage(`Amount must be between ₹0.01 and ₹${MAX_AMOUNT.toLocaleString()}`),
    body('category').optional().isIn(EXPENSE_CATEGORIES).withMessage(`Category must be one of: ${EXPENSE_CATEGORIES.join(', ')}`),
  ],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    requireValidObjectId(req.params.id);
    const errors = validationResult(req);
    if (!errors.isEmpty()) throw AppError.badRequest(errors.array()[0].msg, 'VALIDATION_ERROR');

    const { amount, category, note, paymentMethod, date } = req.body as {
      amount?: number;
      category?: string;
      note?: string;
      paymentMethod?: string;
      date?: string;
    };

    const expense = await Expense.findOneAndUpdate(
      { _id: req.params.id, merchantId: req.userId },
      { $set: { amount, category, note, paymentMethod, ...(date ? { date: new Date(date) } : {}) } },
      { new: true, runValidators: true }
    );
    if (!expense) throw AppError.notFound('Expense not found', 'EXPENSE_NOT_FOUND');

    sendSuccess(res, expense);
  })
);

// DELETE /api/expenses/:id
router.delete(
  '/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    requireValidObjectId(req.params.id);

    const expense = await Expense.findOneAndDelete({ _id: req.params.id, merchantId: req.userId });
    if (!expense) throw AppError.notFound('Expense not found', 'EXPENSE_NOT_FOUND');

    sendSuccess(res, { message: 'Expense deleted' });
  })
);

export default router;
