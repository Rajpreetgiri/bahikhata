import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { adminAuth } from '../middleware/adminAuth';
import { issueAdminToken } from '../middleware/adminAuth';
import { logSecurityEvent } from '../middleware/securityLogger';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { sendSuccess } from '../utils/response';

// Models
import User from '../models/User';
import Customer from '../models/Customer';
import Supplier from '../models/Supplier';
import Transaction from '../models/Transaction';
import SupplierTransaction from '../models/SupplierTransaction';
import Invoice from '../models/Invoice';
import Wallet from '../models/Wallet';
import WalletTransaction from '../models/WalletTransaction';
import Reminder from '../models/Reminder';
import Notification from '../models/Notification';
import Payment from '../models/Payment';
import Product from '../models/Product';
import Expense from '../models/Expense';

const router = Router();

// ─── POST /api/admin/login ────────────────────────────────────────────────────
router.post(
  '/login',
  asyncHandler(async (req: Request, res: Response) => {
    const { username, password } = req.body as { username?: string; password?: string };

    const validUsername = process.env.ADMIN_USERNAME!;
    const validPassword = process.env.ADMIN_PASSWORD!;

    if (!username || !password || username !== validUsername || password !== validPassword) {
      logSecurityEvent(req, 'ADMIN_LOGIN_FAILED', `username=${username ?? 'missing'}`);
      throw AppError.unauthorized('Invalid admin credentials', 'ADMIN_UNAUTHORIZED');
    }

    logSecurityEvent(req, 'ADMIN_LOGIN_SUCCESS', `username=${username}`);
    const token = issueAdminToken();
    sendSuccess(res, { token });
  })
);

// ─── All routes below require admin auth ──────────────────────────────────────
router.use(adminAuth);

// ─── GET /api/admin/stats ─────────────────────────────────────────────────────
// Platform-wide overview numbers
router.get(
  '/stats',
  asyncHandler(async (_req: Request, res: Response) => {
    const [
      totalMerchants,
      onboardedMerchants,
      totalCustomers,
      totalSuppliers,
      totalTransactions,
      totalInvoices,
      txSumResult,
      walletSumResult,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isOnboarded: true }),
      Customer.countDocuments({ isDeleted: false }),
      Supplier.countDocuments({ isDeleted: false }),
      Transaction.countDocuments(),
      Invoice.countDocuments(),
      Transaction.aggregate([
        { $group: { _id: '$type', total: { $sum: '$amount' } } },
      ]),
      Wallet.aggregate([{ $group: { _id: null, total: { $sum: '$balance' } } }]),
    ]);

    const gave = txSumResult.find((r) => r._id === 'gave')?.total ?? 0;
    const got = txSumResult.find((r) => r._id === 'got')?.total ?? 0;
    const walletBalance = walletSumResult[0]?.total ?? 0;

    sendSuccess(res, {
      merchants: { total: totalMerchants, onboarded: onboardedMerchants },
      customers: totalCustomers,
      suppliers: totalSuppliers,
      transactions: totalTransactions,
      invoices: totalInvoices,
      volume: { gave, got, net: got - gave },
      walletBalance,
    });
  })
);

// ─── GET /api/admin/chart/merchants ──────────────────────────────────────────
// New merchant registrations time-series (last N days)
router.get(
  '/chart/merchants',
  asyncHandler(async (req: Request, res: Response) => {
    const days = Math.min(parseInt(String(req.query.days ?? '30'), 10), 365);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const data = await User.aggregate([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { date: '$_id', count: 1, _id: 0 } },
    ]);

    sendSuccess(res, data);
  })
);

// ─── GET /api/admin/chart/transactions ───────────────────────────────────────
// Transaction volume time-series (last N days)
router.get(
  '/chart/transactions',
  asyncHandler(async (req: Request, res: Response) => {
    const days = Math.min(parseInt(String(req.query.days ?? '30'), 10), 365);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const data = await Transaction.aggregate([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            type: '$type',
          },
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.date': 1 } },
      {
        $project: {
          date: '$_id.date',
          type: '$_id.type',
          total: 1,
          count: 1,
          _id: 0,
        },
      },
    ]);

    sendSuccess(res, data);
  })
);

// ─── GET /api/admin/chart/revenue ─────────────────────────────────────────────
// Invoice revenue time-series (paid invoices)
router.get(
  '/chart/revenue',
  asyncHandler(async (req: Request, res: Response) => {
    const days = Math.min(parseInt(String(req.query.days ?? '30'), 10), 365);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const data = await Invoice.aggregate([
      { $match: { status: 'paid', paidAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$paidAt' } },
          revenue: { $sum: '$totalAmount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { date: '$_id', revenue: 1, count: 1, _id: 0 } },
    ]);

    sendSuccess(res, data);
  })
);

// ─── GET /api/admin/merchants ─────────────────────────────────────────────────
// Paginated list of all merchants with stats
router.get(
  '/merchants',
  asyncHandler(async (req: Request, res: Response) => {
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10));
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10)));
    const skip = (page - 1) * limit;
    const search = (req.query.search as string | undefined)?.trim();

    const matchStage = search
      ? {
          $match: {
            $or: [
              { businessName: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
              { email: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
              { ownerName: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
            ],
          },
        }
      : null;

    const pipeline: mongoose.PipelineStage[] = [
      ...(matchStage ? [matchStage] : []),
      {
        $lookup: {
          from: 'customers',
          let: { mid: '$_id' },
          pipeline: [
            { $match: { $expr: { $and: [{ $eq: ['$merchantId', '$$mid'] }, { $eq: ['$isDeleted', false] }] } } },
            { $count: 'n' },
          ],
          as: '_cust',
        },
      },
      {
        $lookup: {
          from: 'suppliers',
          let: { mid: '$_id' },
          pipeline: [
            { $match: { $expr: { $and: [{ $eq: ['$merchantId', '$$mid'] }, { $eq: ['$isDeleted', false] }] } } },
            { $count: 'n' },
          ],
          as: '_sup',
        },
      },
      {
        $lookup: {
          from: 'transactions',
          let: { mid: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$merchantId', '$$mid'] } } },
            { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
          ],
          as: '_tx',
        },
      },
      {
        $lookup: {
          from: 'wallets',
          localField: '_id',
          foreignField: 'merchantId',
          as: '_wallet',
        },
      },
      {
        $project: {
          email: 1,
          businessName: 1,
          ownerName: 1,
          phone: 1,
          businessCategory: 1,
          isOnboarded: 1,
          createdAt: 1,
          customerCount: { $ifNull: [{ $arrayElemAt: ['$_cust.n', 0] }, 0] },
          supplierCount: { $ifNull: [{ $arrayElemAt: ['$_sup.n', 0] }, 0] },
          txCount: { $ifNull: [{ $arrayElemAt: ['$_tx.count', 0] }, 0] },
          txVolume: { $ifNull: [{ $arrayElemAt: ['$_tx.total', 0] }, 0] },
          walletBalance: { $ifNull: [{ $arrayElemAt: ['$_wallet.balance', 0] }, 0] },
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $facet: {
          data: [{ $skip: skip }, { $limit: limit }],
          total: [{ $count: 'n' }],
        },
      },
    ];

    const [result] = await User.aggregate(pipeline);
    const total = result?.total?.[0]?.n ?? 0;
    sendSuccess(res, {
      merchants: result?.data ?? [],
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  })
);

// ─── GET /api/admin/merchants/:id ─────────────────────────────────────────────
router.get(
  '/merchants/:id',
  asyncHandler(async (req: Request, res: Response) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw AppError.badRequest('Invalid merchant ID');

    const merchant = await User.findById(req.params.id).lean();
    if (!merchant) throw AppError.notFound('Merchant not found', 'MERCHANT_NOT_FOUND');

    const [customers, suppliers, txStats, wallet] = await Promise.all([
      Customer.countDocuments({ merchantId: req.params.id, isDeleted: false }),
      Supplier.countDocuments({ merchantId: req.params.id, isDeleted: false }),
      Transaction.aggregate([
        { $match: { merchantId: new mongoose.Types.ObjectId(req.params.id) } },
        { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      Wallet.findOne({ merchantId: req.params.id }).lean(),
    ]);

    const gave = txStats.find((r) => r._id === 'gave')?.total ?? 0;
    const got = txStats.find((r) => r._id === 'got')?.total ?? 0;
    const txCount = txStats.reduce((s, r) => s + r.count, 0);

    sendSuccess(res, {
      merchant,
      stats: { customers, suppliers, txCount, txVolume: { gave, got }, walletBalance: wallet?.balance ?? 0 },
    });
  })
);

// ─── GET /api/admin/merchants/:id/customers ───────────────────────────────────
router.get(
  '/merchants/:id/customers',
  asyncHandler(async (req: Request, res: Response) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw AppError.badRequest('Invalid merchant ID');
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10));
    const limit = Math.min(50, parseInt(String(req.query.limit ?? '20'), 10));
    const skip = (page - 1) * limit;

    const [customers, total] = await Promise.all([
      Customer.find({ merchantId: req.params.id, isDeleted: false })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Customer.countDocuments({ merchantId: req.params.id, isDeleted: false }),
    ]);
    sendSuccess(res, { customers, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  })
);

// ─── GET /api/admin/merchants/:id/suppliers ───────────────────────────────────
router.get(
  '/merchants/:id/suppliers',
  asyncHandler(async (req: Request, res: Response) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw AppError.badRequest('Invalid merchant ID');
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10));
    const limit = Math.min(50, parseInt(String(req.query.limit ?? '20'), 10));
    const skip = (page - 1) * limit;

    const [suppliers, total] = await Promise.all([
      Supplier.find({ merchantId: req.params.id, isDeleted: false })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Supplier.countDocuments({ merchantId: req.params.id, isDeleted: false }),
    ]);
    sendSuccess(res, { suppliers, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  })
);

// ─── GET /api/admin/merchants/:id/transactions ────────────────────────────────
router.get(
  '/merchants/:id/transactions',
  asyncHandler(async (req: Request, res: Response) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw AppError.badRequest('Invalid merchant ID');
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10));
    const limit = Math.min(100, parseInt(String(req.query.limit ?? '20'), 10));
    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      Transaction.find({ merchantId: req.params.id })
        .populate('customerId', 'name phone')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Transaction.countDocuments({ merchantId: req.params.id }),
    ]);
    sendSuccess(res, { transactions, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  })
);

// ─── GET /api/admin/merchants/:id/deep-stats ─────────────────────────────────
// Full financial + inventory intelligence for one merchant
router.get(
  '/merchants/:id/deep-stats',
  asyncHandler(async (req: Request, res: Response) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw AppError.badRequest('Invalid merchant ID');
    const mid = new mongoose.Types.ObjectId(req.params.id);
    const now = new Date();
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const lastYearStart = new Date(now.getFullYear() - 1, 0, 1);
    const lastYearEnd = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    const [
      inventoryStats,
      topProducts,
      revenueThisYear,
      revenueLastYear,
      revenueThisMonth,
      monthlyRevenue,
      invoiceSummary,
      expensesThisYear,
      expensesByCategory,
      outstandingSummary,
      supplierDue,
      txSummaryThisYear,
      cogsResult,
    ] = await Promise.all([
      // 1. Inventory aggregate
      Product.aggregate([
        { $match: { merchantId: mid, isActive: true } },
        {
          $group: {
            _id: null,
            totalProducts: { $sum: 1 },
            outOfStock: { $sum: { $cond: [{ $lte: ['$stock', 0] }, 1, 0] } },
            lowStock: {
              $sum: {
                $cond: [
                  { $and: [{ $gt: ['$stock', 0] }, { $lte: ['$stock', '$lowStockThreshold'] }] },
                  1, 0,
                ],
              },
            },
            stockValue: { $sum: { $multiply: ['$stock', '$sellingPrice'] } },
            stockCostValue: {
              $sum: { $multiply: ['$stock', { $ifNull: ['$purchasePrice', '$sellingPrice'] }] },
            },
          },
        },
      ]),

      // 2. Top 10 products by stock value
      Product.aggregate([
        { $match: { merchantId: mid, isActive: true, stock: { $gt: 0 } } },
        {
          $project: {
            name: 1, unit: 1, stock: 1, sellingPrice: 1, purchasePrice: 1,
            lowStockThreshold: 1,
            stockValue: { $multiply: ['$stock', '$sellingPrice'] },
          },
        },
        { $sort: { stockValue: -1 } },
        { $limit: 10 },
      ]),

      // 3. Revenue this year (paid invoices)
      Invoice.aggregate([
        { $match: { merchantId: mid, status: 'paid', paidAt: { $gte: yearStart } } },
        { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
      ]),

      // 4. Revenue last year
      Invoice.aggregate([
        { $match: { merchantId: mid, status: 'paid', paidAt: { $gte: lastYearStart, $lte: lastYearEnd } } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } },
      ]),

      // 5. Revenue this month
      Invoice.aggregate([
        { $match: { merchantId: mid, status: 'paid', paidAt: { $gte: monthStart } } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } },
      ]),

      // 6. Monthly revenue — last 12 months
      Invoice.aggregate([
        { $match: { merchantId: mid, status: 'paid', paidAt: { $gte: twelveMonthsAgo } } },
        {
          $group: {
            _id: { year: { $year: '$paidAt' }, month: { $month: '$paidAt' } },
            revenue: { $sum: '$totalAmount' },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
        { $project: { year: '$_id.year', month: '$_id.month', revenue: 1, count: 1, _id: 0 } },
      ]),

      // 7. Invoice status summary
      Invoice.aggregate([
        { $match: { merchantId: mid } },
        { $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$totalAmount' } } },
      ]),

      // 8. Total expenses this year
      Expense.aggregate([
        { $match: { merchantId: mid, date: { $gte: yearStart } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),

      // 9. Expenses by category this year
      Expense.aggregate([
        { $match: { merchantId: mid, date: { $gte: yearStart } } },
        { $group: { _id: '$category', total: { $sum: '$amount' } } },
        { $sort: { total: -1 } },
      ]),

      // 10. Customer outstanding summary
      Customer.aggregate([
        { $match: { merchantId: mid, isDeleted: false } },
        {
          $group: {
            _id: null,
            totalOwed: { $sum: { $max: ['$totalOutstanding', 0] } },       // customers owe merchant
            totalAdvances: { $sum: { $abs: { $min: ['$totalOutstanding', 0] } } }, // merchant owes customers
            activeCustomers: { $sum: 1 },
          },
        },
      ]),

      // 11. Supplier due
      Supplier.aggregate([
        { $match: { merchantId: mid, isDeleted: false } },
        { $group: { _id: null, totalDue: { $sum: { $max: ['$totalDue', 0] } } } },
      ]),

      // 12. Transaction summary this year (gave/got)
      Transaction.aggregate([
        { $match: { merchantId: mid, createdAt: { $gte: yearStart } } },
        { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),

      // 13. COGS estimate from paid invoices this year
      // Join invoice items → products to get purchasePrice
      Invoice.aggregate([
        { $match: { merchantId: mid, status: 'paid', paidAt: { $gte: yearStart } } },
        { $unwind: '$items' },
        {
          $lookup: {
            from: 'products',
            localField: 'items.productId',
            foreignField: '_id',
            as: '_product',
          },
        },
        { $unwind: { path: '$_product', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: null,
            cogs: {
              $sum: {
                $multiply: [
                  '$items.quantity',
                  { $ifNull: ['$_product.purchasePrice', { $multiply: ['$items.unitPrice', 0.6] }] },
                ],
              },
            },
          },
        },
      ]),
    ]);

    // Reshape results
    const inv = inventoryStats[0] ?? { totalProducts: 0, outOfStock: 0, lowStock: 0, stockValue: 0, stockCostValue: 0 };
    const revThisYear = revenueThisYear[0]?.total ?? 0;
    const revLastYear = revenueLastYear[0]?.total ?? 0;
    const revThisMonth = revenueThisMonth[0]?.total ?? 0;
    const expThisYear = expensesThisYear[0]?.total ?? 0;
    const cogs = cogsResult[0]?.cogs ?? 0;
    const grossProfit = revThisYear - cogs;
    const netProfit = grossProfit - expThisYear;

    const invSummary: Record<string, { count: number; total: number }> = {};
    for (const row of invoiceSummary) {
      invSummary[row._id] = { count: row.count, total: row.total };
    }

    const gaveThisYear = txSummaryThisYear.find((r) => r._id === 'gave')?.total ?? 0;
    const gotThisYear = txSummaryThisYear.find((r) => r._id === 'got')?.total ?? 0;

    sendSuccess(res, {
      inventory: {
        totalProducts: inv.totalProducts,
        outOfStock: inv.outOfStock,
        lowStock: inv.lowStock,
        stockValue: inv.stockValue,
        stockCostValue: inv.stockCostValue,
        potentialMargin: inv.stockValue - inv.stockCostValue,
        topProducts,
      },
      revenue: {
        thisYear: revThisYear,
        lastYear: revLastYear,
        thisMonth: revThisMonth,
        yoyGrowth: revLastYear > 0 ? parseFloat(((revThisYear - revLastYear) / revLastYear * 100).toFixed(1)) : null,
        monthly: monthlyRevenue,
      },
      profit: {
        cogs,
        grossProfit,
        grossMargin: revThisYear > 0 ? parseFloat((grossProfit / revThisYear * 100).toFixed(1)) : 0,
        expenses: expThisYear,
        netProfit,
        netMargin: revThisYear > 0 ? parseFloat((netProfit / revThisYear * 100).toFixed(1)) : 0,
      },
      invoices: {
        total: Object.values(invSummary).reduce((s, r) => s + r.count, 0),
        byStatus: invSummary,
      },
      expenses: {
        thisYear: expThisYear,
        byCategory: expensesByCategory,
      },
      outstanding: {
        totalOwed: outstandingSummary[0]?.totalOwed ?? 0,
        totalAdvances: outstandingSummary[0]?.totalAdvances ?? 0,
        activeCustomers: outstandingSummary[0]?.activeCustomers ?? 0,
        supplierDue: supplierDue[0]?.totalDue ?? 0,
      },
      transactions: {
        gaveThisYear,
        gotThisYear,
      },
    });
  })
);

// ─── GET /api/admin/merchants/:id/products ────────────────────────────────────
router.get(
  '/merchants/:id/products',
  asyncHandler(async (req: Request, res: Response) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw AppError.badRequest('Invalid merchant ID');
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10));
    const limit = Math.min(50, parseInt(String(req.query.limit ?? '20'), 10));
    const skip = (page - 1) * limit;

    const [products, total] = await Promise.all([
      Product.find({ merchantId: req.params.id, isActive: true })
        .sort({ stock: 1 })  // low stock first
        .skip(skip)
        .limit(limit)
        .lean(),
      Product.countDocuments({ merchantId: req.params.id, isActive: true }),
    ]);
    sendSuccess(res, { products, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  })
);

// ─── GET /api/admin/customers ─────────────────────────────────────────────────
// Cross-merchant customer list
router.get(
  '/customers',
  asyncHandler(async (req: Request, res: Response) => {
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10));
    const limit = Math.min(50, parseInt(String(req.query.limit ?? '20'), 10));
    const skip = (page - 1) * limit;
    const search = (req.query.search as string | undefined)?.trim();

    const filter: Record<string, unknown> = { isDeleted: false };
    if (search) {
      const esc = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { name: { $regex: esc, $options: 'i' } },
        { phone: { $regex: esc, $options: 'i' } },
      ];
    }

    const [customers, total] = await Promise.all([
      Customer.find(filter)
        .populate('merchantId', 'businessName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Customer.countDocuments(filter),
    ]);
    sendSuccess(res, { customers, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  })
);

// ─── GET /api/admin/transactions ──────────────────────────────────────────────
router.get(
  '/transactions',
  asyncHandler(async (req: Request, res: Response) => {
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10));
    const limit = Math.min(100, parseInt(String(req.query.limit ?? '20'), 10));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};
    if (req.query.type) filter.type = req.query.type;
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
      if (Object.keys(dateFilter).length) filter.createdAt = dateFilter;
    }

    const [transactions, total] = await Promise.all([
      Transaction.find(filter)
        .populate('merchantId', 'businessName email')
        .populate('customerId', 'name phone')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Transaction.countDocuments(filter),
    ]);
    sendSuccess(res, { transactions, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  })
);

// ─── GET /api/admin/invoices ──────────────────────────────────────────────────
router.get(
  '/invoices',
  asyncHandler(async (req: Request, res: Response) => {
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10));
    const limit = Math.min(100, parseInt(String(req.query.limit ?? '20'), 10));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};
    if (req.query.status) filter.status = req.query.status;

    const [invoices, total] = await Promise.all([
      Invoice.find(filter)
        .populate('merchantId', 'businessName email')
        .populate('customerId', 'name phone')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Invoice.countDocuments(filter),
    ]);
    sendSuccess(res, { invoices, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  })
);

// ─── GET /api/admin/wallets ────────────────────────────────────────────────────
router.get(
  '/wallets',
  asyncHandler(async (req: Request, res: Response) => {
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10));
    const limit = Math.min(50, parseInt(String(req.query.limit ?? '20'), 10));
    const skip = (page - 1) * limit;

    const [result] = await Wallet.aggregate([
      {
        $lookup: {
          from: 'users',
          localField: 'merchantId',
          foreignField: '_id',
          as: 'merchant',
        },
      },
      { $unwind: { path: '$merchant', preserveNullAndEmptyArrays: false } },
      { $sort: { balance: -1 } },
      {
        $facet: {
          data: [
            { $skip: skip },
            { $limit: limit },
            {
              $project: {
                balance: 1,
                updatedAt: 1,
                'merchant._id': 1,
                'merchant.businessName': 1,
                'merchant.email': 1,
              },
            },
          ],
          total: [{ $count: 'n' }],
          sum: [{ $group: { _id: null, total: { $sum: '$balance' } } }],
        },
      },
    ]);

    sendSuccess(res, {
      wallets: result?.data ?? [],
      totalBalance: result?.sum?.[0]?.total ?? 0,
      pagination: {
        page,
        limit,
        total: result?.total?.[0]?.n ?? 0,
        totalPages: Math.ceil((result?.total?.[0]?.n ?? 0) / limit),
      },
    });
  })
);

// ─── GET /api/admin/reminders ─────────────────────────────────────────────────
router.get(
  '/reminders',
  asyncHandler(async (req: Request, res: Response) => {
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10));
    const limit = Math.min(100, parseInt(String(req.query.limit ?? '20'), 10));
    const skip = (page - 1) * limit;

    const [reminders, total] = await Promise.all([
      Reminder.find()
        .populate('merchantId', 'businessName email')
        .populate('customerId', 'name phone')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Reminder.countDocuments(),
    ]);
    sendSuccess(res, { reminders, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  })
);

// ─── GET /api/admin/payments ──────────────────────────────────────────────────
router.get(
  '/payments',
  asyncHandler(async (req: Request, res: Response) => {
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10));
    const limit = Math.min(100, parseInt(String(req.query.limit ?? '20'), 10));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};
    if (req.query.status) filter.status = req.query.status;

    const [payments, total] = await Promise.all([
      Payment.find(filter)
        .populate('merchantId', 'businessName email')
        .populate('customerId', 'name phone')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Payment.countDocuments(filter),
    ]);
    sendSuccess(res, { payments, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  })
);

// ─── GET /api/admin/revenue ───────────────────────────────────────────────────
// Monthly revenue breakdown (paid invoices)
router.get(
  '/revenue',
  asyncHandler(async (req: Request, res: Response) => {
    const year = parseInt(String(req.query.year ?? new Date().getFullYear()), 10);

    const data = await Invoice.aggregate([
      {
        $match: {
          status: 'paid',
          paidAt: {
            $gte: new Date(`${year}-01-01`),
            $lte: new Date(`${year}-12-31T23:59:59.999Z`),
          },
        },
      },
      {
        $group: {
          _id: { $month: '$paidAt' },
          revenue: { $sum: '$totalAmount' },
          gst: { $sum: { $ifNull: ['$gstAmount', 0] } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { month: '$_id', revenue: 1, gst: 1, count: 1, _id: 0 } },
    ]);

    sendSuccess(res, data);
  })
);

// ─── POST /api/admin/notifications/send ──────────────────────────────────────
// Broadcast notification to a specific merchant or all merchants
router.post(
  '/notifications/send',
  asyncHandler(async (req: Request, res: Response) => {
    const { merchantId, title, body, type = 'admin_broadcast' } = req.body as {
      merchantId?: string;
      title: string;
      body: string;
      type?: string;
    };

    if (!title?.trim() || !body?.trim()) {
      throw AppError.badRequest('title and body are required');
    }

    if (merchantId) {
      // Send to one merchant
      if (!mongoose.isValidObjectId(merchantId)) throw AppError.badRequest('Invalid merchantId');
      const merchant = await User.findById(merchantId);
      if (!merchant) throw AppError.notFound('Merchant not found', 'MERCHANT_NOT_FOUND');

      await Notification.create({ merchantId, title, body, type, read: false });
      sendSuccess(res, { sent: 1 });
    } else {
      // Broadcast to all onboarded merchants
      const merchants = await User.find({ isOnboarded: true }, { _id: 1 }).lean();
      const docs = merchants.map((m) => ({ merchantId: m._id, title, body, type, read: false }));
      if (docs.length === 0) {
        sendSuccess(res, { sent: 0 });
        return;
      }
      await Notification.insertMany(docs, { ordered: false });
      sendSuccess(res, { sent: docs.length });
    }
  })
);

// ─── GET /api/admin/activity ──────────────────────────────────────────────────
// Recent activity feed (last 50 transactions + invoices combined)
router.get(
  '/activity',
  asyncHandler(async (_req: Request, res: Response) => {
    const [recentTx, recentInvoices] = await Promise.all([
      Transaction.find()
        .populate('merchantId', 'businessName')
        .populate('customerId', 'name')
        .sort({ createdAt: -1 })
        .limit(25)
        .lean(),
      Invoice.find()
        .populate('merchantId', 'businessName')
        .populate('customerId', 'name')
        .sort({ createdAt: -1 })
        .limit(25)
        .lean(),
    ]);

    const feed = [
      ...recentTx.map((t) => ({ kind: 'transaction', ...t })),
      ...recentInvoices.map((i) => ({ kind: 'invoice', ...i })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 50);

    sendSuccess(res, feed);
  })
);

export default router;
