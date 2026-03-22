import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import mongoose from 'mongoose';
import SupplierTransaction from '../models/SupplierTransaction';
import Supplier from '../models/Supplier';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { sendSuccess, sendPaginated } from '../utils/response';

const router = Router();
router.use(authenticate);

// GET /api/supplier-transactions/supplier/:supplierId  (paginated)
router.get(
  '/supplier/:supplierId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!mongoose.isValidObjectId(req.params.supplierId)) {
      throw AppError.badRequest('Invalid supplier ID', 'INVALID_ID');
    }

    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 30));

    // Verify merchant owns this supplier
    const supplier = await Supplier.findOne({
      _id: req.params.supplierId,
      merchantId: req.userId,
      isDeleted: false,
    });
    if (!supplier) throw AppError.notFound('Supplier not found', 'SUPPLIER_NOT_FOUND');

    const total = await SupplierTransaction.countDocuments({ supplierId: req.params.supplierId });
    const transactions = await SupplierTransaction.find({ supplierId: req.params.supplierId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    sendPaginated(res, transactions, { total, page, pages: Math.ceil(total / limit) });
  })
);

// POST /api/supplier-transactions
router.post(
  '/',
  [
    body('supplierId').notEmpty().withMessage('supplierId is required'),
    body('type').isIn(['bought', 'paid']).withMessage('type must be "bought" or "paid"'),
    body('amount').isFloat({ min: 0.01 }).withMessage('amount must be a positive number'),
  ],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw AppError.badRequest(errors.array()[0].msg, 'VALIDATION_ERROR');
    }

    const { supplierId, type, amount, note, photoUrl } = req.body as {
      supplierId: string;
      type: 'bought' | 'paid';
      amount: number;
      note?: string;
      photoUrl?: string;
    };
    const parsedAmount = parseFloat(String(amount));

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const supplier = await Supplier.findOne({
        _id: supplierId,
        merchantId: req.userId,
        isDeleted: false,
      }).session(session);
      if (!supplier) {
        await session.abortTransaction();
        throw AppError.notFound('Supplier not found', 'SUPPLIER_NOT_FOUND');
      }

      const [transaction] = await SupplierTransaction.create(
        [{ supplierId, merchantId: req.userId, type, amount: parsedAmount, note, photoUrl }],
        { session }
      );

      // 'bought' → totalDue increases; 'paid' → totalDue decreases (floor at 0)
      if (type === 'bought') {
        await Supplier.findByIdAndUpdate(
          supplierId,
          { $inc: { totalDue: parsedAmount }, $set: { lastTransactionAt: new Date() } },
          { session }
        );
      } else {
        // Atomic: decrease but prevent going below 0
        const supplier = await Supplier.findById(supplierId).session(session);
        const safeDeduct = Math.min(parsedAmount, supplier?.totalDue ?? 0);
        await Supplier.findByIdAndUpdate(
          supplierId,
          { $inc: { totalDue: -safeDeduct }, $set: { lastTransactionAt: new Date() } },
          { session }
        );
      }

      await session.commitTransaction();
      sendSuccess(res, transaction, 201);
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  })
);

// DELETE /api/supplier-transactions/:id
router.delete(
  '/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      throw AppError.badRequest('Invalid transaction ID', 'INVALID_ID');
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const transaction = await SupplierTransaction.findOne({
        _id: req.params.id,
        merchantId: req.userId,
      }).session(session);
      if (!transaction) {
        await session.abortTransaction();
        throw AppError.notFound('Transaction not found', 'TRANSACTION_NOT_FOUND');
      }

      // Reverse the balance delta
      const reverseDelta = transaction.type === 'bought' ? -transaction.amount : transaction.amount;
      await Supplier.findByIdAndUpdate(
        transaction.supplierId,
        { $inc: { totalDue: reverseDelta } },
        { session }
      );

      await SupplierTransaction.findByIdAndDelete(req.params.id).session(session);
      await session.commitTransaction();

      sendSuccess(res, { message: 'Transaction deleted and balance reversed' });
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  })
);

export default router;
