import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import mongoose from 'mongoose';
import Customer from '../models/Customer';
import Transaction from '../models/Transaction';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { sendSuccess } from '../utils/response';

const router = Router();
router.use(authenticate);

function requireValidObjectId(id: string): void {
  if (!mongoose.isValidObjectId(id)) {
    throw AppError.badRequest('Invalid ID format', 'INVALID_ID');
  }
}

// GET /api/customers
router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const customers = await Customer.find({
      merchantId: req.userId,
      isDeleted: false,
    }).sort({ totalOutstanding: -1, lastTransactionAt: -1 });

    sendSuccess(res, customers);
  })
);

// POST /api/customers
router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('phone').optional({ checkFalsy: true }).trim().matches(/^[\d\s\-+().]{7,20}$/).withMessage('Invalid phone number'),
    body('email').optional({ checkFalsy: true }).trim().isEmail().withMessage('Invalid email address'),
    body('creditLimit').optional().isFloat({ min: 0 }).withMessage('creditLimit must be a non-negative number'),
  ],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw AppError.badRequest(errors.array()[0].msg, 'VALIDATION_ERROR');
    }

    const { name, phone, email, creditLimit } = req.body as {
      name: string; phone?: string; email?: string; creditLimit?: number;
    };

    const customer = await Customer.create({
      merchantId: req.userId,
      name,
      phone: phone || undefined,
      email: email || undefined,
      creditLimit: creditLimit !== undefined ? parseFloat(String(creditLimit)) : undefined,
    });
    sendSuccess(res, customer, 201);
  })
);

// GET /api/customers/leaderboard — must be before /:id to avoid Express treating "leaderboard" as an ID
router.get(
  '/leaderboard',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const Invoice = (await import('../models/Invoice')).default;
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 30));
    const sortField = req.query.sortBy === 'invoiceCount' ? 'invoiceCount' : 'totalInvoiced';

    const data = await Invoice.aggregate([
      {
        $match: {
          merchantId: new mongoose.Types.ObjectId(req.userId!),
          status: { $in: ['paid', 'partially_paid', 'unpaid'] },
        },
      },
      {
        $group: {
          _id: '$customerId',
          totalInvoiced: { $sum: '$totalAmount' },
          invoiceCount: { $sum: 1 },
          paidCount: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, 1, 0] } },
          lastInvoiceAt: { $max: '$createdAt' },
        },
      },
      {
        $lookup: {
          from: 'customers',
          localField: '_id',
          foreignField: '_id',
          as: 'customer',
        },
      },
      { $unwind: '$customer' },
      { $match: { 'customer.isDeleted': false } },
      { $sort: { [sortField]: -1 } },
      { $limit: limit },
      {
        $project: {
          _id: 0,
          customerId: '$_id',
          name: '$customer.name',
          phone: '$customer.phone',
          totalOutstanding: '$customer.totalOutstanding',
          totalInvoiced: 1,
          invoiceCount: 1,
          paidCount: 1,
          lastInvoiceAt: 1,
          isGoodCustomer: {
            $and: [
              { $gte: ['$invoiceCount', 10] },
              { $eq: ['$invoiceCount', '$paidCount'] },
            ],
          },
        },
      },
    ]);

    sendSuccess(res, data);
  })
);

// GET /api/customers/:id
router.get(
  '/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    requireValidObjectId(req.params.id);

    const customer = await Customer.findOne({
      _id: req.params.id,
      merchantId: req.userId,
      isDeleted: false,
    });
    if (!customer) throw AppError.notFound('Customer not found', 'CUSTOMER_NOT_FOUND');

    const transactions = await Transaction.find({ customerId: customer._id })
      .sort({ createdAt: -1 })
      .limit(50);

    sendSuccess(res, { customer, transactions });
  })
);

// PUT /api/customers/:id
router.put(
  '/:id',
  [
    body('phone').optional({ checkFalsy: true }).trim().matches(/^[\d\s\-+().]{7,20}$/).withMessage('Invalid phone number'),
    body('email').optional({ checkFalsy: true }).trim().isEmail().withMessage('Invalid email address'),
    body('creditLimit').optional().isFloat({ min: 0 }).withMessage('creditLimit must be a non-negative number'),
  ],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    requireValidObjectId(req.params.id);

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw AppError.badRequest(errors.array()[0].msg, 'VALIDATION_ERROR');
    }

    const { name, phone, email, creditLimit, riskFlag } = req.body as {
      name?: string; phone?: string; email?: string; creditLimit?: number; riskFlag?: boolean;
    };

    const update: Record<string, unknown> = {};
    if (name !== undefined) update.name = name;
    if (phone !== undefined) update.phone = phone || undefined;
    if (email !== undefined) update.email = email || undefined;
    if (creditLimit !== undefined) update.creditLimit = creditLimit ? parseFloat(String(creditLimit)) : undefined;
    if (riskFlag !== undefined) update.riskFlag = Boolean(riskFlag);

    const customer = await Customer.findOneAndUpdate(
      { _id: req.params.id, merchantId: req.userId, isDeleted: false },
      { $set: update },
      { new: true, runValidators: true }
    );
    if (!customer) throw AppError.notFound('Customer not found', 'CUSTOMER_NOT_FOUND');

    sendSuccess(res, customer);
  })
);

// PATCH /api/customers/:id/risk-flag — toggle risk flag
router.patch(
  '/:id/risk-flag',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    requireValidObjectId(req.params.id);

    const { riskFlag } = req.body as { riskFlag: boolean };
    if (typeof riskFlag !== 'boolean') throw AppError.badRequest('riskFlag must be a boolean', 'VALIDATION_ERROR');

    const customer = await Customer.findOneAndUpdate(
      { _id: req.params.id, merchantId: req.userId, isDeleted: false },
      { $set: { riskFlag } },
      { new: true }
    );
    if (!customer) throw AppError.notFound('Customer not found', 'CUSTOMER_NOT_FOUND');

    sendSuccess(res, customer);
  })
);

// DELETE /api/customers/:id  (soft delete)
router.delete(
  '/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    requireValidObjectId(req.params.id);

    const customer = await Customer.findOneAndUpdate(
      { _id: req.params.id, merchantId: req.userId, isDeleted: false },
      { $set: { isDeleted: true } },
      { new: true }
    );
    if (!customer) throw AppError.notFound('Customer not found', 'CUSTOMER_NOT_FOUND');

    sendSuccess(res, { message: 'Customer deleted' });
  })
);

export default router;
