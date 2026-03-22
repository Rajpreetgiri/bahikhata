import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import mongoose from 'mongoose';
import Product from '../models/Product';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { sendSuccess } from '../utils/response';

const router = Router();
router.use(authenticate);

const VALID_UNITS = ['piece', 'kg', 'gram', 'litre', 'ml', 'pack', 'box', 'dozen', 'metre'];

// GET /api/products — all active products sorted by name
router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const products = await Product.find({ merchantId: req.userId, isActive: true }).sort({ name: 1 });
    sendSuccess(res, products);
  })
);

// GET /api/products/low-stock — products at or below threshold (includes out-of-stock)
router.get(
  '/low-stock',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const products = await Product.find({
      merchantId: req.userId,
      isActive: true,
      $expr: { $lte: ['$stock', '$lowStockThreshold'] },
    }).sort({ stock: 1 });

    const outOfStock = products.filter((p) => p.stock <= 0).length;
    const lowStock   = products.filter((p) => p.stock > 0).length;

    sendSuccess(res, { products, summary: { outOfStock, lowStock, total: products.length } });
  })
);

// POST /api/products — create product
router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('Product name is required'),
    body('sellingPrice').isFloat({ min: 0 }).withMessage('sellingPrice must be >= 0'),
    body('unit').isIn(VALID_UNITS).withMessage(`unit must be one of: ${VALID_UNITS.join(', ')}`),
  ],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) throw AppError.badRequest(errors.array()[0].msg, 'VALIDATION_ERROR');

    const { name, sku, unit, sellingPrice, purchasePrice, stock, lowStockThreshold } = req.body as {
      name: string;
      sku?: string;
      unit: string;
      sellingPrice: number;
      purchasePrice?: number;
      stock?: number;
      lowStockThreshold?: number;
    };

    // Check SKU uniqueness per merchant
    if (sku) {
      const exists = await Product.findOne({ merchantId: req.userId, sku: sku.toUpperCase() });
      if (exists) throw AppError.conflict('A product with this SKU already exists', 'SKU_CONFLICT');
    }

    const product = await Product.create({
      merchantId: req.userId,
      name,
      sku: sku ? sku.toUpperCase() : undefined,
      unit,
      sellingPrice: parseFloat(String(sellingPrice)),
      purchasePrice: purchasePrice !== undefined ? parseFloat(String(purchasePrice)) : undefined,
      stock: stock !== undefined ? parseInt(String(stock), 10) : 0,
      lowStockThreshold: lowStockThreshold !== undefined ? parseInt(String(lowStockThreshold), 10) : 5,
    });

    sendSuccess(res, product, 201);
  })
);

// GET /api/products/:id
router.get(
  '/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw AppError.badRequest('Invalid product ID', 'INVALID_ID');

    const product = await Product.findOne({ _id: req.params.id, merchantId: req.userId, isActive: true });
    if (!product) throw AppError.notFound('Product not found', 'PRODUCT_NOT_FOUND');

    sendSuccess(res, product);
  })
);

// PUT /api/products/:id — update product details (not stock)
router.put(
  '/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw AppError.badRequest('Invalid product ID', 'INVALID_ID');

    const { name, sku, unit, sellingPrice, purchasePrice, lowStockThreshold } = req.body as {
      name?: string;
      sku?: string;
      unit?: string;
      sellingPrice?: number;
      purchasePrice?: number;
      lowStockThreshold?: number;
    };

    const product = await Product.findOne({ _id: req.params.id, merchantId: req.userId, isActive: true });
    if (!product) throw AppError.notFound('Product not found', 'PRODUCT_NOT_FOUND');

    // SKU conflict check
    if (sku && sku.toUpperCase() !== product.sku) {
      const exists = await Product.findOne({
        merchantId: req.userId,
        sku: sku.toUpperCase(),
        _id: { $ne: req.params.id },
      });
      if (exists) throw AppError.conflict('A product with this SKU already exists', 'SKU_CONFLICT');
    }

    if (name !== undefined) product.name = name.trim();
    if (sku !== undefined) product.sku = sku ? sku.toUpperCase() : undefined;
    if (unit !== undefined && VALID_UNITS.includes(unit)) product.unit = unit as typeof product.unit;
    if (sellingPrice !== undefined) product.sellingPrice = parseFloat(String(sellingPrice));
    if (purchasePrice !== undefined) product.purchasePrice = parseFloat(String(purchasePrice));
    if (lowStockThreshold !== undefined) product.lowStockThreshold = parseInt(String(lowStockThreshold), 10);

    await product.save();
    sendSuccess(res, product);
  })
);

// PATCH /api/products/:id/stock — manual stock adjustment (atomic, no race condition)
router.patch(
  '/:id/stock',
  [body('adjustment').isFloat().withMessage('adjustment must be a number')],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) throw AppError.badRequest(errors.array()[0].msg, 'VALIDATION_ERROR');

    if (!mongoose.isValidObjectId(req.params.id)) throw AppError.badRequest('Invalid product ID', 'INVALID_ID');

    const adjustment = parseFloat(String(req.body.adjustment));
    if (adjustment === 0) throw AppError.badRequest('Adjustment cannot be zero', 'INVALID_ADJUSTMENT');

    let updated;

    if (adjustment < 0) {
      // Atomic: only update if current stock >= |adjustment| (prevents negative stock, no race condition)
      updated = await Product.findOneAndUpdate(
        { _id: req.params.id, merchantId: req.userId, isActive: true, stock: { $gte: -adjustment } },
        { $inc: { stock: adjustment } },
        { new: true }
      );

      if (!updated) {
        // Check if product exists at all or stock was insufficient
        const product = await Product.findOne({ _id: req.params.id, merchantId: req.userId, isActive: true });
        if (!product) throw AppError.notFound('Product not found', 'PRODUCT_NOT_FOUND');
        throw AppError.badRequest(
          `Only ${product.stock} units available. Cannot remove ${Math.abs(adjustment)}.`,
          'INSUFFICIENT_STOCK'
        );
      }
    } else {
      updated = await Product.findOneAndUpdate(
        { _id: req.params.id, merchantId: req.userId, isActive: true },
        { $inc: { stock: adjustment } },
        { new: true }
      );
      if (!updated) throw AppError.notFound('Product not found', 'PRODUCT_NOT_FOUND');
    }

    sendSuccess(res, updated);
  })
);

// DELETE /api/products/:id — soft delete
router.delete(
  '/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw AppError.badRequest('Invalid product ID', 'INVALID_ID');

    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, merchantId: req.userId, isActive: true },
      { isActive: false },
      { new: true }
    );
    if (!product) throw AppError.notFound('Product not found', 'PRODUCT_NOT_FOUND');

    sendSuccess(res, { message: 'Product deleted' });
  })
);

export default router;
