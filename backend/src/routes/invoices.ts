import { Router, Response } from 'express';
import mongoose from 'mongoose';
import Invoice, { IInvoice } from '../models/Invoice';
import Product from '../models/Product';
import Transaction from '../models/Transaction';
import Customer from '../models/Customer';
import Counter from '../models/Counter';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { sendSuccess } from '../utils/response';
import { generateInvoicePdf } from '../services/pdf';
import { round2, moneyMul, moneyPct } from '../utils/money';
import { idempotencyCheck } from '../middleware/idempotency';
import { createMerchantNotification } from '../utils/notificationHelper';

const router = Router();
router.use(authenticate);

// GET /api/invoices — paginated, optional ?status= &customerId= &search= &dateFrom= &dateTo=
router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 30));

    const filter: Record<string, unknown> = { merchantId: req.userId };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.customerId && mongoose.isValidObjectId(req.query.customerId as string)) {
      filter.customerId = req.query.customerId;
    }

    // Date range filter
    if (req.query.dateFrom || req.query.dateTo) {
      const dateFilter: Record<string, Date> = {};
      if (req.query.dateFrom) {
        const d = new Date(req.query.dateFrom as string);
        if (!isNaN(d.getTime())) dateFilter.$gte = d;
      }
      if (req.query.dateTo) {
        const endOfDay = new Date(req.query.dateTo as string);
        if (!isNaN(endOfDay.getTime())) {
          endOfDay.setHours(23, 59, 59, 999);
          dateFilter.$lte = endOfDay;
        }
      }
      if (Object.keys(dateFilter).length) filter.createdAt = dateFilter;
    }

    // Search by invoiceNumber or customer name
    if (req.query.search) {
      const searchStr = (req.query.search as string).trim();
      if (searchStr) {
        const escapedSearch = searchStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const searchRegex = new RegExp(escapedSearch, 'i');
        const matchedCustomers = await Customer.find(
          { merchantId: req.userId, isDeleted: false, name: searchRegex },
          { _id: 1 }
        );
        const customerIds = matchedCustomers.map((c) => c._id);
        filter.$or = [
          { invoiceNumber: searchRegex },
          { customerId: { $in: customerIds } },
        ];
      }
    }

    const total = await Invoice.countDocuments(filter);
    const invoices = await Invoice.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('customerId', 'name phone email');

    // Use nested format so axios interceptor preserves meta alongside data
    sendSuccess(res, { data: invoices, meta: { total, page, pages: Math.ceil(total / limit) } });
  })
);

// POST /api/invoices — create invoice
// paymentMode: 'credit' (default) — udhari, goods on credit; 'paid' — customer paid immediately
router.post(
  '/',
  idempotencyCheck,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const {
      customerId,
      items,
      gstPercent,
      dueDate,
      note,
      paymentMode = 'credit',
    } = req.body as {
      customerId: string;
      items: Array<{ productId: string; quantity: number }>;
      gstPercent?: number;
      dueDate?: string;
      note?: string;
      paymentMode?: 'credit' | 'paid';
    };

    if (!customerId || !mongoose.isValidObjectId(customerId)) {
      throw AppError.badRequest('Valid customerId is required', 'INVALID_CUSTOMER');
    }
    if (!Array.isArray(items) || items.length === 0) {
      throw AppError.badRequest('At least one item is required', 'INVALID_ITEMS');
    }
    if (!['credit', 'paid'].includes(paymentMode)) {
      throw AppError.badRequest('paymentMode must be credit or paid', 'INVALID_PAYMENT_MODE');
    }

    // Verify customer belongs to merchant
    const customer = await Customer.findOne({
      _id: customerId,
      merchantId: req.userId,
      isDeleted: false,
    });
    if (!customer) throw AppError.notFound('Customer not found', 'CUSTOMER_NOT_FOUND');

    // ── Credit limit enforcement (only for credit mode) ──────────────────────
    // Computed after we know totalAmount, so we re-check below after building items.
    // We store a reference to customer for the check after totalAmount is computed.

    // Validate all products
    const productIds = items.map((i) => {
      if (!mongoose.isValidObjectId(i.productId)) throw AppError.badRequest(`Invalid productId: ${i.productId}`, 'INVALID_PRODUCT');
      return i.productId;
    });

    const products = await Product.find({
      _id: { $in: productIds },
      merchantId: req.userId,
      isActive: true,
    });

    if (products.length !== productIds.length) {
      throw AppError.badRequest('One or more products not found or inactive', 'PRODUCT_NOT_FOUND');
    }

    const productMap = new Map(products.map((p) => [String(p._id), p]));

    // Build invoice items with snapshots
    const invoiceItems = items.map((item) => {
      const product = productMap.get(item.productId)!;
      const quantity = parseFloat(String(item.quantity));
      if (quantity <= 0) throw AppError.badRequest(`Quantity must be > 0 for ${product.name}`, 'INVALID_QUANTITY');
      const unitPrice = product.sellingPrice;
      return {
        productId: product._id,
        productName: product.name,
        unit: product.unit,
        quantity,
        unitPrice,
        total: moneyMul(quantity, unitPrice),
      };
    });

    // Compute totals
    const subtotal = round2(invoiceItems.reduce((s, i) => s + i.total, 0));
    const gstPct = gstPercent !== undefined ? parseFloat(String(gstPercent)) : 0;
    if (gstPct < 0 || gstPct > 100) throw AppError.badRequest('GST percent must be between 0 and 100', 'INVALID_GST');
    const gstAmount = gstPct > 0 ? moneyPct(subtotal, gstPct) : 0;
    const totalAmount = round2(subtotal + gstAmount);

    // ── Credit limit check (for credit invoices) ────────────────────────────
    if (paymentMode === 'credit' && customer.creditLimit && customer.creditLimit > 0) {
      const projectedOutstanding = customer.totalOutstanding + totalAmount;
      if (projectedOutstanding > customer.creditLimit) {
        throw AppError.badRequest(
          `Invoice ₹${totalAmount} would breach customer's credit limit of ₹${customer.creditLimit}. Current outstanding: ₹${customer.totalOutstanding}`,
          'CREDIT_LIMIT_EXCEEDED'
        );
      }
    }

    // Pre-validate stock availability before touching DB
    for (const item of items) {
      const product = productMap.get(item.productId)!;
      const qty = parseFloat(String(item.quantity));
      if (product.stock < qty) {
        throw AppError.badRequest(`Insufficient stock for "${product.name}" (available: ${product.stock})`, 'INSUFFICIENT_STOCK');
      }
    }

    // Generate invoice number — atomic counter (outside session: gaps are acceptable, no duplicates)
    const counter = await Counter.findOneAndUpdate(
      { merchantId: req.userId, type: 'invoice' },
      { $inc: { seq: 1 } },
      { upsert: true, new: true }
    );
    const invoiceNumber = `INV-${String(counter.seq).padStart(3, '0')}`;

    const isPaid = paymentMode === 'paid';
    let createdInvoiceId: mongoose.Types.ObjectId | null = null;

    // Wrap stock deduction + invoice + transaction + customer update in a single session
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        // Deduct stock atomically per item — conditional update prevents negative stock
        for (const item of items) {
          const qty = parseFloat(String(item.quantity));
          const updated = await Product.findOneAndUpdate(
            { _id: item.productId, merchantId: req.userId, isActive: true, stock: { $gte: qty } },
            { $inc: { stock: -qty } },
            { new: true, session }
          );
          if (!updated) {
            const pName = productMap.get(item.productId)?.name ?? item.productId;
            const currentProduct = await Product.findById(item.productId).select('stock').lean().session(session);
            const available = currentProduct?.stock ?? 0;
            throw AppError.badRequest(
              `Insufficient stock for "${pName}" (available: ${available}, requested: ${qty})`,
              'INSUFFICIENT_STOCK'
            );
          }
        }

        // Create invoice
        const [invoice] = await Invoice.create(
          [{
            merchantId: req.userId,
            customerId,
            invoiceNumber,
            items: invoiceItems,
            subtotal,
            gstPercent: gstPct > 0 ? gstPct : undefined,
            gstAmount: gstAmount > 0 ? gstAmount : undefined,
            totalAmount,
            paymentMode,
            status: isPaid ? 'paid' : 'unpaid',
            paidAt: isPaid ? new Date() : undefined,
            dueDate: dueDate ? new Date(dueDate) : undefined,
            note,
          }],
          { session }
        );
        createdInvoiceId = invoice._id as mongoose.Types.ObjectId;

        // Create ledger transaction + update customer outstanding
        if (isPaid) {
          const [txn] = await Transaction.create(
            [{ customerId, merchantId: req.userId, type: 'got', amount: totalAmount, note: `Invoice ${invoiceNumber} — Paid` }],
            { session }
          );
          await Invoice.findByIdAndUpdate(invoice._id, { transactionId: txn._id }, { session });
          await Customer.findByIdAndUpdate(customerId, { $set: { lastTransactionAt: new Date() } }, { session });
        } else {
          const [txn] = await Transaction.create(
            [{ customerId, merchantId: req.userId, type: 'gave', amount: totalAmount, note: `Invoice ${invoiceNumber} — Credit` }],
            { session }
          );
          await Invoice.findByIdAndUpdate(invoice._id, { transactionId: txn._id }, { session });
          await Customer.findByIdAndUpdate(
            customerId,
            { $inc: { totalOutstanding: totalAmount }, $set: { lastTransactionAt: new Date() } },
            { session }
          );
        }
      });
    } finally {
      await session.endSession();
    }

    // Return fully populated invoice
    const populated = await Invoice.findById(createdInvoiceId).populate('customerId', 'name phone email');

    // In-app notification
    await createMerchantNotification({
      merchantId: req.userId!,
      type: isPaid ? 'invoice_paid' : 'invoice_credit',
      title: isPaid ? 'Invoice — Cash Sale' : 'Invoice — Udhari',
      body: isPaid
        ? `₹${totalAmount.toLocaleString('en-IN')} cash invoice (${invoiceNumber}) created for ${customer.name}`
        : `₹${totalAmount.toLocaleString('en-IN')} credit invoice (${invoiceNumber}) created for ${customer.name}`,
      metadata: {
        customerId: customer._id.toString(),
        customerName: customer.name,
        invoiceNumber,
        amount: totalAmount,
        paymentMode,
      },
    });

    sendSuccess(res, populated, 201);
  })
);

// GET /api/invoices/:id
router.get(
  '/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw AppError.badRequest('Invalid invoice ID', 'INVALID_ID');

    const invoice = await Invoice.findOne({ _id: req.params.id, merchantId: req.userId }).populate(
      'customerId',
      'name phone email'
    );
    if (!invoice) throw AppError.notFound('Invoice not found', 'INVOICE_NOT_FOUND');

    sendSuccess(res, invoice);
  })
);

// PATCH /api/invoices/:id/mark-paid
// Works on unpaid or partially_paid credit invoices — records the REMAINING balance as received
router.patch(
  '/:id/mark-paid',
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw AppError.badRequest('Invalid invoice ID', 'INVALID_ID');

    const invoice = await Invoice.findOne({ _id: req.params.id, merchantId: req.userId });
    if (!invoice) throw AppError.notFound('Invoice not found', 'INVOICE_NOT_FOUND');
    if (!['unpaid', 'partially_paid'].includes(invoice.status)) {
      throw AppError.badRequest('Only unpaid or partially paid invoices can be marked as paid', 'INVALID_STATUS');
    }

    // Only collect what is still outstanding (handles partially_paid correctly)
    const remainingAmount = round2(invoice.totalAmount - invoice.paidAmount);

    const session = await mongoose.startSession();
    let savedInvoice = invoice;
    try {
      await session.withTransaction(async () => {
        // Create 'got' transaction — customer settling remaining balance
        const [transaction] = await Transaction.create(
          [{ customerId: invoice.customerId, merchantId: req.userId, type: 'got', amount: remainingAmount, note: `Invoice ${invoice.invoiceNumber} — Fully Paid` }],
          { session }
        );

        // Decrement customer outstanding by remaining (not total)
        await Customer.findByIdAndUpdate(
          invoice.customerId,
          { $inc: { totalOutstanding: -remainingAmount }, $set: { lastTransactionAt: new Date(), lastPaymentAmount: remainingAmount } },
          { session }
        );

        // Mark invoice paid
        savedInvoice = (await Invoice.findByIdAndUpdate(
          invoice._id,
          { $set: { status: 'paid', paidAt: new Date(), paidAmount: invoice.totalAmount, transactionId: transaction._id } },
          { new: true, session }
        ))!;
      });
    } finally {
      await session.endSession();
    }

    // In-app notification
    await createMerchantNotification({
      merchantId: req.userId!,
      type: 'invoice_settled',
      title: 'Invoice Fully Paid',
      body: `${invoice.invoiceNumber} — ₹${remainingAmount.toLocaleString('en-IN')} received, invoice fully settled`,
      metadata: {
        customerId: invoice.customerId?.toString(),
        invoiceNumber: invoice.invoiceNumber,
        amount: remainingAmount,
      },
    });

    sendSuccess(res, savedInvoice);
  })
);

// PATCH /api/invoices/:id/cancel
router.patch(
  '/:id/cancel',
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw AppError.badRequest('Invalid invoice ID', 'INVALID_ID');

    const invoice = await Invoice.findOne({ _id: req.params.id, merchantId: req.userId });
    if (!invoice) throw AppError.notFound('Invoice not found', 'INVOICE_NOT_FOUND');
    if (invoice.status === 'cancelled' || invoice.status === 'returned') {
      throw AppError.badRequest('Invoice already cancelled or returned', 'INVALID_STATUS');
    }
    if (invoice.status === 'paid') throw AppError.badRequest('Cannot cancel a paid invoice. Use Return instead.', 'INVALID_STATUS');

    const session = await mongoose.startSession();
    let cancelledInvoice = invoice;
    try {
      await session.withTransaction(async () => {
        // Restore stock atomically
        for (const item of invoice.items) {
          await Product.findByIdAndUpdate(item.productId, { $inc: { stock: item.quantity } }, { session });
        }

        // Reverse the outstanding balance:
        // For credit invoices: reverse totalAmount minus what was already collected (paidAmount)
        if (invoice.paymentMode === 'credit') {
          const outstandingToReverse = round2(invoice.totalAmount - invoice.paidAmount);
          if (outstandingToReverse > 0) {
            await Transaction.create(
              [{ customerId: invoice.customerId, merchantId: req.userId, type: 'got', amount: outstandingToReverse, note: `Invoice ${invoice.invoiceNumber} — Cancelled (reversal)` }],
              { session }
            );
            await Customer.findByIdAndUpdate(
              invoice.customerId,
              { $inc: { totalOutstanding: -outstandingToReverse }, $set: { lastTransactionAt: new Date() } },
              { session }
            );
          }
        }

        cancelledInvoice = (await Invoice.findByIdAndUpdate(
          invoice._id,
          { $set: { status: 'cancelled' } },
          { new: true, session }
        ))!;
      });
    } finally {
      await session.endSession();
    }

    sendSuccess(res, cancelledInvoice);
  })
);

// PATCH /api/invoices/:id/return — issue a return/refund for a fully-paid invoice
router.patch(
  '/:id/return',
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw AppError.badRequest('Invalid invoice ID', 'INVALID_ID');

    const invoice = await Invoice.findOne({ _id: req.params.id, merchantId: req.userId });
    if (!invoice) throw AppError.notFound('Invoice not found', 'INVOICE_NOT_FOUND');
    if (invoice.status !== 'paid') {
      throw AppError.badRequest(
        'Only fully paid invoices can be returned. For unpaid/partial, use Cancel.',
        'INVALID_STATUS'
      );
    }

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        // Restore stock for all items atomically
        for (const item of invoice.items) {
          await Product.findByIdAndUpdate(item.productId, { $inc: { stock: item.quantity } }, { session });
        }

        // Create a reversal transaction — customer now has credit (merchant owes them)
        await Transaction.create(
          [{ customerId: invoice.customerId, merchantId: req.userId, type: 'got', amount: invoice.totalAmount, note: `Invoice ${invoice.invoiceNumber} — Returned (refund)` }],
          { session }
        );

        // Outstanding decreases (may go negative = customer has credit)
        await Customer.findByIdAndUpdate(
          invoice.customerId,
          { $inc: { totalOutstanding: -invoice.totalAmount }, $set: { lastTransactionAt: new Date() } },
          { session }
        );

        await Invoice.findByIdAndUpdate(invoice._id, { $set: { status: 'returned' } }, { session });
      });
    } finally {
      await session.endSession();
    }

    const populated = await Invoice.findById(invoice._id).populate('customerId', 'name phone email');
    sendSuccess(res, populated);
  })
);

// PATCH /api/invoices/:id/partial-pay — record a partial payment
router.patch(
  '/:id/partial-pay',
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw AppError.badRequest('Invalid invoice ID', 'INVALID_ID');

    const invoice = await Invoice.findOne({ _id: req.params.id, merchantId: req.userId });
    if (!invoice) throw AppError.notFound('Invoice not found', 'INVOICE_NOT_FOUND');
    if (invoice.paymentMode !== 'credit') throw AppError.badRequest('Partial pay only works for credit invoices', 'INVALID_STATUS');
    if (invoice.status === 'cancelled') throw AppError.badRequest('Cannot pay a cancelled invoice', 'INVALID_STATUS');
    if (invoice.status === 'paid') throw AppError.badRequest('Invoice is already fully paid', 'INVALID_STATUS');

    const amount = parseFloat(String(req.body.amount));
    if (!amount || amount <= 0) throw AppError.badRequest('Amount must be a positive number', 'VALIDATION_ERROR');
    if (amount < 1) throw AppError.badRequest('Minimum payment amount is ₹1', 'VALIDATION_ERROR');

    const remaining = round2(invoice.totalAmount - invoice.paidAmount);
    if (amount > remaining) {
      throw AppError.badRequest(
        `Amount ₹${amount} exceeds remaining balance ₹${remaining}`,
        'AMOUNT_EXCEEDS_REMAINING'
      );
    }

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        // Create 'got' transaction for partial amount
        const [transaction] = await Transaction.create(
          [{ customerId: invoice.customerId, merchantId: req.userId, type: 'got', amount, note: `Invoice ${invoice.invoiceNumber} — Partial payment (₹${amount})` }],
          { session }
        );

        // Decrement customer outstanding by the partial amount
        await Customer.findByIdAndUpdate(
          invoice.customerId,
          { $inc: { totalOutstanding: -amount }, $set: { lastTransactionAt: new Date(), lastPaymentAmount: amount } },
          { session }
        );

        // Update paidAmount and status
        const newPaidAmount = round2(invoice.paidAmount + amount);
        const isFullyPaid = newPaidAmount >= invoice.totalAmount;
        await Invoice.findByIdAndUpdate(
          invoice._id,
          {
            $set: {
              paidAmount: newPaidAmount,
              status: isFullyPaid ? 'paid' : 'partially_paid',
              ...(isFullyPaid ? { paidAt: new Date(), transactionId: transaction._id } : {}),
            },
          },
          { session }
        );
      });
    } finally {
      await session.endSession();
    }

    const populated = await Invoice.findById(invoice._id).populate('customerId', 'name phone email');

    // In-app notification
    await createMerchantNotification({
      merchantId: req.userId!,
      type: 'invoice_partial',
      title: 'Partial Payment',
      body: `₹${amount.toLocaleString('en-IN')} received towards ${invoice.invoiceNumber} — ₹${(invoice.totalAmount - invoice.paidAmount - amount).toFixed(2)} still pending`,
      metadata: {
        customerId: invoice.customerId?.toString(),
        invoiceNumber: invoice.invoiceNumber,
        amount,
        totalAmount: invoice.totalAmount,
        remaining: round2(invoice.totalAmount - invoice.paidAmount - amount),
      },
    });

    sendSuccess(res, populated);
  })
);

// POST /api/invoices/:id/email — send invoice PDF to customer via email
router.post(
  '/:id/email',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw AppError.badRequest('Invalid invoice ID', 'INVALID_ID');

    const invoice = await Invoice.findOne({ _id: req.params.id, merchantId: req.userId }).populate<{
      customerId: { _id: mongoose.Types.ObjectId; name: string; phone?: string; email?: string };
    }>('customerId', 'name phone email');
    if (!invoice) throw AppError.notFound('Invoice not found', 'INVOICE_NOT_FOUND');

    const customer = invoice.customerId as { _id: mongoose.Types.ObjectId; name: string; email?: string };
    if (!customer.email) {
      throw AppError.badRequest('Customer has no email address on file', 'NO_EMAIL');
    }

    const User = (await import('../models/User')).default;
    const merchant = await User.findById(req.userId);
    if (!merchant) throw AppError.notFound('Merchant not found', 'USER_NOT_FOUND');

    const pdfBuffer = await generateInvoicePdf(merchant, invoice as unknown as IInvoice);

    const { sendInvoiceEmail } = await import('../services/email');
    await sendInvoiceEmail(
      customer.email,
      customer.name,
      merchant.businessName || merchant.ownerName,
      pdfBuffer,
      invoice.invoiceNumber,
      invoice.totalAmount
    );

    sendSuccess(res, { message: `Invoice emailed to ${customer.email}` });
  })
);

// GET /api/invoices/:id/pdf
router.get(
  '/:id/pdf',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw AppError.badRequest('Invalid invoice ID', 'INVALID_ID');

    const invoice = await Invoice.findOne({ _id: req.params.id, merchantId: req.userId }).populate<{
      customerId: { _id: mongoose.Types.ObjectId; name: string; phone?: string; email?: string };
    }>('customerId', 'name phone email');
    if (!invoice) throw AppError.notFound('Invoice not found', 'INVOICE_NOT_FOUND');

    const User = (await import('../models/User')).default;
    const merchant = await User.findById(req.userId);
    if (!merchant) throw AppError.notFound('Merchant not found', 'USER_NOT_FOUND');

    const pdfBuffer = await generateInvoicePdf(merchant, invoice as unknown as IInvoice);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoiceNumber}.pdf"`);
    res.send(pdfBuffer);
  })
);

export default router;
