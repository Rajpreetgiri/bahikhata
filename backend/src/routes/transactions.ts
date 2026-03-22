import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import mongoose from 'mongoose';
import Transaction from '../models/Transaction';
import Customer from '../models/Customer';
import Invoice from '../models/Invoice';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { sendSuccess, sendPaginated } from '../utils/response';
import { idempotencyCheck } from '../middleware/idempotency';
import { createMerchantNotification } from '../utils/notificationHelper';

const router = Router();
router.use(authenticate);

// GET /api/transactions/recent?limit=5  — last N transactions for dashboard
router.get(
  '/recent',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const limit = Math.min(10, parseInt(req.query.limit as string, 10) || 5);
    const transactions = await Transaction.find({ merchantId: req.userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('customerId', 'name phone');
    sendSuccess(res, transactions);
  })
);

// GET /api/transactions/customer/:customerId  (paginated)
router.get(
  '/customer/:customerId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!mongoose.isValidObjectId(req.params.customerId)) {
      throw AppError.badRequest('Invalid customer ID', 'INVALID_ID');
    }

    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 30));

    // Verify merchant owns this customer
    const customer = await Customer.findOne({
      _id: req.params.customerId,
      merchantId: req.userId,
      isDeleted: false,
    });
    if (!customer) throw AppError.notFound('Customer not found', 'CUSTOMER_NOT_FOUND');

    const total = await Transaction.countDocuments({ customerId: req.params.customerId });
    const transactions = await Transaction.find({ customerId: req.params.customerId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    sendPaginated(res, transactions, { total, page, pages: Math.ceil(total / limit) });
  })
);

// POST /api/transactions
router.post(
  '/',
  idempotencyCheck,
  [
    body('customerId').notEmpty().withMessage('customerId is required'),
    body('type').isIn(['gave', 'got']).withMessage('type must be "gave" or "got"'),
    body('amount').isFloat({ min: 0.01, max: 10_000_000 }).withMessage('amount must be between ₹0.01 and ₹1,00,00,000'),
  ],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw AppError.badRequest(errors.array()[0].msg, 'VALIDATION_ERROR');
    }

    const { customerId, type, amount, note, photoUrl, paymentMethod, dueDate } = req.body as {
      customerId: string;
      type: 'gave' | 'got';
      amount: number;
      note?: string;
      photoUrl?: string;
      paymentMethod?: string;
      dueDate?: string;
    };
    const parsedAmount = parseFloat(String(amount));

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const customer = await Customer.findOne({
        _id: customerId,
        merchantId: req.userId,
        isDeleted: false,
      }).session(session);
      if (!customer) {
        await session.abortTransaction();
        throw AppError.notFound('Customer not found', 'CUSTOMER_NOT_FOUND');
      }

      let parsedDueDate: Date | undefined;
      if (dueDate) {
        const d = new Date(dueDate);
        if (!isNaN(d.getTime())) parsedDueDate = d;
      }

      const [transaction] = await Transaction.create(
        [{ customerId, merchantId: req.userId, type, amount: parsedAmount, note, photoUrl, paymentMethod, dueDate: parsedDueDate }],
        { session }
      );

      // 'gave' → outstanding increases; 'got' → outstanding decreases
      const delta = type === 'gave' ? parsedAmount : -parsedAmount;
      const customerUpdate: Record<string, unknown> = {
        $inc: { totalOutstanding: delta },
        $set: { lastTransactionAt: new Date() },
      };
      if (type === 'got') {
        (customerUpdate.$set as Record<string, unknown>).lastPaymentAmount = parsedAmount;
      }
      await Customer.findByIdAndUpdate(customerId, customerUpdate, { session });

      await session.commitTransaction();

      // In-app notification (non-fatal, outside transaction)
      const isGave = type === 'gave';
      await createMerchantNotification({
        merchantId: req.userId!,
        type: isGave ? 'transaction_gave' : 'transaction_got',
        title: isGave ? 'Udhari Diya' : 'Payment Mila',
        body: isGave
          ? `₹${parsedAmount.toLocaleString('en-IN')} given to ${customer.name} on credit${note ? ` — ${note}` : ''}`
          : `₹${parsedAmount.toLocaleString('en-IN')} received from ${customer.name}${note ? ` — ${note}` : ''}`,
        metadata: {
          customerId: customer._id.toString(),
          customerName: customer.name,
          amount: parsedAmount,
          type,
          note: note ?? null,
          paymentMethod: paymentMethod ?? null,
        },
      });

      sendSuccess(res, transaction, 201);
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  })
);

// DELETE /api/transactions/:id
router.delete(
  '/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      throw AppError.badRequest('Invalid transaction ID', 'INVALID_ID');
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const transaction = await Transaction.findOne({
        _id: req.params.id,
        merchantId: req.userId,
      }).session(session);
      if (!transaction) {
        await session.abortTransaction();
        throw AppError.notFound('Transaction not found', 'TRANSACTION_NOT_FOUND');
      }

      // Block deletion if this transaction is linked to an invoice
      const linkedInvoice = await Invoice.findOne({ transactionId: transaction._id }).session(session);
      if (linkedInvoice) {
        await session.abortTransaction();
        throw AppError.badRequest(
          `This transaction is linked to invoice ${linkedInvoice.invoiceNumber}. Cancel the invoice instead.`,
          'LINKED_TO_INVOICE'
        );
      }

      // Reverse the balance delta
      const reverseDelta = transaction.type === 'gave' ? -transaction.amount : transaction.amount;
      await Customer.findByIdAndUpdate(
        transaction.customerId,
        { $inc: { totalOutstanding: reverseDelta } },
        { session }
      );

      await Transaction.findByIdAndDelete(req.params.id).session(session);
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
