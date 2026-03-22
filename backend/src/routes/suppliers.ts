import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import mongoose from 'mongoose';
import Supplier from '../models/Supplier';
import SupplierTransaction from '../models/SupplierTransaction';
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

// GET /api/suppliers
router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const suppliers = await Supplier.find({
      merchantId: req.userId,
      isDeleted: false,
    }).sort({ totalDue: -1, lastTransactionAt: -1 });

    sendSuccess(res, suppliers);
  })
);

// POST /api/suppliers
router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('phone').optional({ checkFalsy: true }).trim().matches(/^[\d\s\-+().]{7,20}$/).withMessage('Invalid phone number'),
    body('email').optional({ checkFalsy: true }).trim().isEmail().withMessage('Invalid email address'),
  ],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw AppError.badRequest(errors.array()[0].msg, 'VALIDATION_ERROR');
    }

    const { name, phone, email, companyName } = req.body as {
      name: string;
      phone?: string;
      email?: string;
      companyName?: string;
    };

    const supplier = await Supplier.create({
      merchantId: req.userId,
      name,
      phone,
      email,
      companyName,
    });
    sendSuccess(res, supplier, 201);
  })
);

// GET /api/suppliers/:id
router.get(
  '/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    requireValidObjectId(req.params.id);

    const supplier = await Supplier.findOne({
      _id: req.params.id,
      merchantId: req.userId,
      isDeleted: false,
    });
    if (!supplier) throw AppError.notFound('Supplier not found', 'SUPPLIER_NOT_FOUND');

    const transactions = await SupplierTransaction.find({ supplierId: supplier._id })
      .sort({ createdAt: -1 })
      .limit(50);

    sendSuccess(res, { supplier, transactions });
  })
);

// PUT /api/suppliers/:id
router.put(
  '/:id',
  [
    body('phone').optional({ checkFalsy: true }).trim().matches(/^[\d\s\-+().]{7,20}$/).withMessage('Invalid phone number'),
    body('email').optional({ checkFalsy: true }).trim().isEmail().withMessage('Invalid email address'),
  ],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) throw AppError.badRequest(errors.array()[0].msg, 'VALIDATION_ERROR');
    requireValidObjectId(req.params.id);

    const { name, phone, email, companyName } = req.body as {
      name?: string;
      phone?: string;
      email?: string;
      companyName?: string;
    };

    const supplier = await Supplier.findOneAndUpdate(
      { _id: req.params.id, merchantId: req.userId, isDeleted: false },
      { $set: { name, phone, email, companyName } },
      { new: true, runValidators: true }
    );
    if (!supplier) throw AppError.notFound('Supplier not found', 'SUPPLIER_NOT_FOUND');

    sendSuccess(res, supplier);
  })
);

// DELETE /api/suppliers/:id  (soft delete)
router.delete(
  '/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    requireValidObjectId(req.params.id);

    const supplier = await Supplier.findOneAndUpdate(
      { _id: req.params.id, merchantId: req.userId, isDeleted: false },
      { $set: { isDeleted: true } },
      { new: true }
    );
    if (!supplier) throw AppError.notFound('Supplier not found', 'SUPPLIER_NOT_FOUND');

    sendSuccess(res, { message: 'Supplier deleted' });
  })
);

export default router;
