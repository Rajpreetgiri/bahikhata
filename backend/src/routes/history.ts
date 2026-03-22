import { Router, Response } from 'express';
import mongoose from 'mongoose';
import Transaction from '../models/Transaction';
import SupplierTransaction from '../models/SupplierTransaction';
import Customer from '../models/Customer';
import Supplier from '../models/Supplier';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';

const router = Router();
router.use(authenticate);

interface FacetResult {
  data: Array<{
    _id: mongoose.Types.ObjectId;
    type: string;
    amount: number;
    note?: string;
    partyKind: 'customer' | 'supplier';
    party: { _id: mongoose.Types.ObjectId; name: string; phone?: string; companyName?: string };
    createdAt: Date;
  }>;
  total: Array<{ count: number }>;
  summary: Array<{ _id: string; total: number }>;
}

// GET /api/history
router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const merchantId = new mongoose.Types.ObjectId(req.userId!);

    const party = (req.query.party as string) || 'all';
    const partyId = (req.query.partyId as string) || null;
    const typeFilter = (req.query.type as string) || null;
    const search = (req.query.search as string)?.trim() || null;
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 30));
    const sortOrder = req.query.sortOrder === 'asc' ? (1 as const) : (-1 as const);

    if (!['customer', 'supplier', 'all'].includes(party)) {
      throw AppError.badRequest('party must be "customer", "supplier", or "all"', 'VALIDATION_ERROR');
    }

    // Date range
    const dateFilter: Record<string, Date> = {};
    if (req.query.dateFrom) {
      const d = new Date(req.query.dateFrom as string);
      if (!isNaN(d.getTime())) dateFilter.$gte = d;
    }
    if (req.query.dateTo) {
      const end = new Date(req.query.dateTo as string);
      if (!isNaN(end.getTime())) {
        end.setHours(23, 59, 59, 999);
        dateFilter.$lte = end;
      }
    }

    // Amount range
    const amountFilter: Record<string, number> = {};
    if (req.query.amountMin) {
      const v = parseFloat(req.query.amountMin as string);
      if (!isNaN(v)) amountFilter.$gte = v;
    }
    if (req.query.amountMax) {
      const v = parseFloat(req.query.amountMax as string);
      if (!isNaN(v)) amountFilter.$lte = v;
    }

    const isAmountSearch = !!(search && /^\d+(\.\d+)?$/.test(search));

    // Resolve name search → IDs
    let resolvedCustomerIds: mongoose.Types.ObjectId[] | null = null;
    let resolvedSupplierIds: mongoose.Types.ObjectId[] | null = null;

    if (partyId && mongoose.isValidObjectId(partyId)) {
      const pid = new mongoose.Types.ObjectId(partyId);
      if (party !== 'supplier') resolvedCustomerIds = [pid];
      if (party !== 'customer') resolvedSupplierIds = [pid];
    } else if (search && !isAmountSearch) {
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(escapedSearch, 'i');
      if (party !== 'supplier') {
        const hits = await Customer.find({ merchantId, isDeleted: false, name: searchRegex }, { _id: 1 });
        resolvedCustomerIds = hits.map((c) => c._id as mongoose.Types.ObjectId);
      }
      if (party !== 'customer') {
        const hits = await Supplier.find(
          { merchantId, isDeleted: false, $or: [{ name: searchRegex }, { companyName: searchRegex }] },
          { _id: 1 }
        );
        resolvedSupplierIds = hits.map((s) => s._id as mongoose.Types.ObjectId);
      }
    }

    // Decide which collections to query
    const needCustomer =
      party !== 'supplier' &&
      (!typeFilter || ['gave', 'got'].includes(typeFilter)) &&
      !(resolvedCustomerIds !== null && resolvedCustomerIds.length === 0);

    const needSupplier =
      party !== 'customer' &&
      (!typeFilter || ['bought', 'paid'].includes(typeFilter)) &&
      !(resolvedSupplierIds !== null && resolvedSupplierIds.length === 0);

    // Build match queries
    const customerMatch: Record<string, unknown> = { merchantId };
    if (typeFilter && ['gave', 'got'].includes(typeFilter)) customerMatch.type = typeFilter;
    if (Object.keys(dateFilter).length) customerMatch.createdAt = dateFilter;
    if (isAmountSearch) customerMatch.amount = parseFloat(search!);
    else if (Object.keys(amountFilter).length) customerMatch.amount = amountFilter;
    if (resolvedCustomerIds) customerMatch.customerId = { $in: resolvedCustomerIds };

    const supplierMatch: Record<string, unknown> = { merchantId };
    if (typeFilter && ['bought', 'paid'].includes(typeFilter)) supplierMatch.type = typeFilter;
    if (Object.keys(dateFilter).length) supplierMatch.createdAt = dateFilter;
    if (isAmountSearch) supplierMatch.amount = parseFloat(search!);
    else if (Object.keys(amountFilter).length) supplierMatch.amount = amountFilter;
    if (resolvedSupplierIds) supplierMatch.supplierId = { $in: resolvedSupplierIds };

    const skip = (page - 1) * limit;

    // Aggregation pipeline stages (reusable)
    const customerLookupStages = [
      { $match: customerMatch },
      { $lookup: { from: 'customers', localField: 'customerId', foreignField: '_id', as: '_p' } },
      { $addFields: { partyKind: 'customer', party: { $arrayElemAt: ['$_p', 0] } } },
      { $project: { _p: 0 } },
    ];

    const supplierLookupStages = [
      { $match: supplierMatch },
      { $lookup: { from: 'suppliers', localField: 'supplierId', foreignField: '_id', as: '_p' } },
      { $addFields: { partyKind: 'supplier', party: { $arrayElemAt: ['$_p', 0] } } },
      { $project: { _p: 0 } },
    ];

    const facetStages = [
      { $sort: { createdAt: sortOrder } },
      {
        $facet: {
          data: [
            { $skip: skip },
            { $limit: limit },
            {
              $project: {
                _id: 1, type: 1, amount: 1, note: 1, partyKind: 1, createdAt: 1,
                'party._id': 1, 'party.name': 1, 'party.phone': 1, 'party.companyName': 1,
              },
            },
          ],
          total: [{ $count: 'count' }],
          summary: [{ $group: { _id: '$type', total: { $sum: '$amount' } } }],
        },
      },
    ];

    let aggregateResult: FacetResult[];

    if (!needCustomer && !needSupplier) {
      aggregateResult = [{ data: [], total: [{ count: 0 }], summary: [] }];
    } else if (needCustomer && needSupplier) {
      // Use $unionWith to merge both collections at DB level
      aggregateResult = await Transaction.aggregate<FacetResult>([
        ...customerLookupStages,
        {
          $unionWith: {
            coll: 'suppliertransactions',
            pipeline: supplierLookupStages,
          },
        },
        ...facetStages,
      ]);
    } else if (needCustomer) {
      aggregateResult = await Transaction.aggregate<FacetResult>([
        ...customerLookupStages,
        ...facetStages,
      ]);
    } else {
      aggregateResult = await SupplierTransaction.aggregate<FacetResult>([
        ...supplierLookupStages,
        ...facetStages,
      ]);
    }

    const result = aggregateResult[0] ?? { data: [], total: [], summary: [] };
    const total = result.total[0]?.count ?? 0;
    const pages = Math.ceil(total / limit);

    const summaryMap = Object.fromEntries(result.summary.map((s) => [s._id, s.total]));

    // Wrap everything inside `data` so the axios interceptor (which does res.data = res.data.data)
    // preserves meta and summary alongside the entries array.
    res.json({
      success: true,
      data: {
        data: result.data,
        meta: { total, page, pages },
        summary: {
          totalGave: summaryMap['gave'] ?? 0,
          totalGot: summaryMap['got'] ?? 0,
          totalBought: summaryMap['bought'] ?? 0,
          totalPaid: summaryMap['paid'] ?? 0,
        },
      },
    });
  })
);

export default router;
