import { Router, Response } from 'express';
import mongoose from 'mongoose';
import Customer from '../models/Customer';
import Transaction from '../models/Transaction';
import Invoice from '../models/Invoice';
import { generateCustomerStatement, generateBusinessSummary } from '../services/pdf';
import { generateCustomerExcel, generateBusinessExcel } from '../services/excel';
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

function parseDateRange(query: Record<string, unknown>): { dateFilter: Record<string, Date>; dateFrom?: Date; dateTo?: Date } {
  const dateFilter: Record<string, Date> = {};
  let dateFrom: Date | undefined;
  let dateTo: Date | undefined;
  if (query.dateFrom) {
    dateFrom = new Date(query.dateFrom as string);
    dateFilter.$gte = dateFrom;
  }
  if (query.dateTo) {
    dateTo = new Date(query.dateTo as string);
    dateTo.setHours(23, 59, 59, 999);
    dateFilter.$lte = dateTo;
  }
  return { dateFilter, dateFrom, dateTo };
}

// GET /api/reports/customer/:id/pdf
router.get(
  '/customer/:id/pdf',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    requireValidObjectId(req.params.id);

    const customer = await Customer.findOne({
      _id: req.params.id,
      merchantId: req.userId,
      isDeleted: false,
    });
    if (!customer) throw AppError.notFound('Customer not found', 'CUSTOMER_NOT_FOUND');

    const { dateFilter, dateFrom, dateTo } = parseDateRange(req.query as Record<string, unknown>);

    const txQuery: Record<string, unknown> = { customerId: customer._id };
    if (Object.keys(dateFilter).length) txQuery.createdAt = dateFilter;

    const transactions = await Transaction.find(txQuery).sort({ createdAt: -1 });
    const pdfBuffer = await generateCustomerStatement(req.user!, customer, transactions, dateFrom, dateTo);

    const filename = `${customer.name.replace(/\s+/g, '_')}_statement.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  })
);

// GET /api/reports/business/pdf
router.get(
  '/business/pdf',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const customers = await Customer.find({
      merchantId: req.userId,
      isDeleted: false,
    }).sort({ totalOutstanding: -1 });

    const { dateFrom, dateTo } = parseDateRange(req.query as Record<string, unknown>);
    const pdfBuffer = await generateBusinessSummary(req.user!, customers, dateFrom, dateTo);

    const filename = `business_summary_${new Date().toISOString().split('T')[0]}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  })
);

// GET /api/reports/customer/:id/excel
router.get(
  '/customer/:id/excel',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    requireValidObjectId(req.params.id);

    const customer = await Customer.findOne({
      _id: req.params.id,
      merchantId: req.userId,
      isDeleted: false,
    });
    if (!customer) throw AppError.notFound('Customer not found', 'CUSTOMER_NOT_FOUND');

    const { dateFilter, dateFrom, dateTo } = parseDateRange(req.query as Record<string, unknown>);

    const txQuery: Record<string, unknown> = { customerId: customer._id };
    if (Object.keys(dateFilter).length) txQuery.createdAt = dateFilter;

    const transactions = await Transaction.find(txQuery).sort({ createdAt: -1 });
    const buffer = await generateCustomerExcel(req.user!, customer, transactions, dateFrom, dateTo);

    const filename = `${customer.name.replace(/\s+/g, '_')}_statement.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  })
);

// GET /api/reports/business/excel
router.get(
  '/business/excel',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const customers = await Customer.find({
      merchantId: req.userId,
      isDeleted: false,
    }).sort({ totalOutstanding: -1 });

    const { dateFrom, dateTo } = parseDateRange(req.query as Record<string, unknown>);
    const buffer = await generateBusinessExcel(req.user!, customers, dateFrom, dateTo);

    const filename = `business_summary_${new Date().toISOString().split('T')[0]}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  })
);

// GET /api/reports/gst-summary?year=2024
router.get(
  '/gst-summary',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const year = parseInt(req.query.year as string, 10) || new Date().getFullYear();
    const startDate = new Date(year, 0, 1);          // Jan 1
    const endDate = new Date(year, 11, 31, 23, 59, 59, 999); // Dec 31

    const rows = await Invoice.aggregate<{
      month: number;
      totalSales: number;
      totalGst: number;
      invoiceCount: number;
    }>([
      {
        $match: {
          merchantId: new mongoose.Types.ObjectId(req.userId!),
          status: { $in: ['paid', 'partially_paid', 'unpaid'] },
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: { $month: '$createdAt' },
          totalSales: { $sum: '$subtotal' },
          totalGst: { $sum: { $ifNull: ['$gstAmount', 0] } },
          invoiceCount: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          month: '$_id',
          totalSales: { $round: ['$totalSales', 2] },
          totalGst: { $round: ['$totalGst', 2] },
          invoiceCount: 1,
        },
      },
    ]);

    sendSuccess(res, { year, months: rows });
  })
);

export default router;
