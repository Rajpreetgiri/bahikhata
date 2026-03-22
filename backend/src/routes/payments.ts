import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import Customer from '../models/Customer';
import Payment from '../models/Payment';
import Transaction from '../models/Transaction';
import User from '../models/User';
import PayoutAccount from '../models/PayoutAccount';
import RouteTransfer from '../models/RouteTransfer';
import { createPaymentLink, verifyWebhookSignature, initiateRouteTransfer } from '../services/razorpay';
import { round2, moneyPct } from '../utils/money';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { sendSuccess } from '../utils/response';

const router = Router();

// ─── Razorpay webhook — raw body, no auth ─────────────────────────────────────
// IMPORTANT: This route must be mounted BEFORE express.json() in index.ts
router.post(
  '/webhook',
  asyncHandler(async (req: Request, res: Response) => {
    const signature = req.headers['x-razorpay-signature'] as string;
    if (!signature) throw AppError.badRequest('Missing x-razorpay-signature header', 'MISSING_SIGNATURE');

    const rawBody = (req.body as Buffer).toString('utf-8');

    let isValid: boolean;
    try {
      isValid = verifyWebhookSignature(rawBody, signature);
    } catch {
      throw AppError.internal('Webhook secret not configured', 'WEBHOOK_MISCONFIGURED');
    }

    if (!isValid) throw AppError.badRequest('Invalid webhook signature', 'INVALID_SIGNATURE');

    let event: {
      event: string;
      payload?: {
        payment_link?: { entity?: { id?: string; notes?: { merchantId?: string; customerId?: string } } };
        payment?: { entity?: { id?: string; amount?: number } };
        account?: { entity?: { id?: string } };
      };
    };
    try {
      event = JSON.parse(rawBody);
    } catch {
      throw AppError.badRequest('Invalid JSON body', 'INVALID_JSON');
    }

    // ── payment_link.paid ──────────────────────────────────────────────────────
    if (event.event === 'payment_link.paid') {
      const linkEntity = event.payload?.payment_link?.entity;
      const paymentEntity = event.payload?.payment?.entity;

      const razorpayPaymentLinkId = linkEntity?.id;
      const merchantId = linkEntity?.notes?.merchantId;
      const customerId = linkEntity?.notes?.customerId;
      const amountPaid = paymentEntity?.amount ? paymentEntity.amount / 100 : 0; // paise → rupees
      const razorpayPaymentId = paymentEntity?.id; // used for route transfer

      if (razorpayPaymentLinkId && merchantId && customerId && amountPaid > 0) {
        let savedPaymentId: mongoose.Types.ObjectId | undefined;

        const session = await mongoose.startSession();
        try {
          await session.withTransaction(async () => {
            const updatedPayment = await Payment.findOneAndUpdate(
              { razorpayPaymentLinkId, status: 'pending' },
              { $set: { status: 'paid' } },
              { new: true, session }
            );

            // Only create ledger entry if payment was actually transitioned (idempotency guard)
            if (updatedPayment) {
              savedPaymentId = updatedPayment._id as mongoose.Types.ObjectId;

              await Transaction.create(
                [{ customerId, merchantId, type: 'got', amount: amountPaid, note: 'Razorpay payment received' }],
                { session }
              );

              await Customer.findByIdAndUpdate(
                customerId,
                {
                  $inc: { totalOutstanding: -amountPaid },
                  $set: { lastTransactionAt: new Date(), lastPaymentAmount: amountPaid },
                },
                { session }
              );
            }
          });
        } catch (err) {
          console.error('[Webhook] Processing error:', err);
        } finally {
          await session.endSession();
        }

        // Push notification removed — app uses in-app notifications only

        // ── Razorpay Route Transfer (fire-and-forget) ────────────────────────
        if (razorpayPaymentId && savedPaymentId) {
          PayoutAccount.findOne({
            merchantId,
            razorpayAccountStatus: 'active',
            razorpayAccountId: { $exists: true, $ne: null },
          }).then(async (payoutAccount) => {
            if (!payoutAccount?.razorpayAccountId) return;

            const feePercent = payoutAccount.platformFeePercent ?? 0;
            const platformFeeRs = moneyPct(amountPaid, feePercent);
            const netAmountRs   = round2(amountPaid - platformFeeRs);
            const netPaise      = Math.round(netAmountRs * 100);

            // Record transfer attempt
            const rtDoc = await RouteTransfer.create({
              merchantId,
              paymentDbId: savedPaymentId,
              razorpayPaymentId,
              razorpayLinkedAccountId: payoutAccount.razorpayAccountId,
              grossAmountRs: amountPaid,
              platformFeeRs,
              netAmountRs,
              status: 'initiated',
            });

            // Initiate transfer
            initiateRouteTransfer(razorpayPaymentId, payoutAccount.razorpayAccountId!, netPaise)
              .then(async (transfer) => {
                await RouteTransfer.findByIdAndUpdate(rtDoc._id, {
                  razorpayTransferId: transfer.id,
                  status: 'settled',
                });
                await PayoutAccount.findOneAndUpdate(
                  { merchantId },
                  {
                    $inc: { totalRouteTransfers: 1, totalAmountRouted: netAmountRs },
                    $set: { lastTransferAt: new Date() },
                  }
                );
              })
              .catch(async (err: unknown) => {
                await RouteTransfer.findByIdAndUpdate(rtDoc._id, {
                  status: 'failed',
                  errorMessage: err instanceof Error ? err.message : String(err),
                });
              });
          }).catch((err) => {
            console.error('[Webhook] PayoutAccount lookup error:', err);
          });
        }
      }
    }

    // ── account.activated ─────────────────────────────────────────────────────
    if (event.event === 'account.activated') {
      const accountId = event.payload?.account?.entity?.id;
      if (accountId) {
        await PayoutAccount.findOneAndUpdate(
          { razorpayAccountId: accountId },
          { razorpayAccountStatus: 'active', razorpayActivatedAt: new Date() }
        ).catch(() => {});
      }
    }

    // ── account.suspended ─────────────────────────────────────────────────────
    if (event.event === 'account.suspended') {
      const accountId = event.payload?.account?.entity?.id;
      if (accountId) {
        await PayoutAccount.findOneAndUpdate(
          { razorpayAccountId: accountId },
          { razorpayAccountStatus: 'suspended' }
        ).catch(() => {});
      }
    }

    // Always 200 so Razorpay stops retrying
    res.json({ received: true });
  })
);

// ─── Authenticated routes ─────────────────────────────────────────────────────
router.use(authenticate);

// POST /api/payments/create-link
router.post(
  '/create-link',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { customerId, amount } = req.body as { customerId: string; amount: number };

    if (!customerId || !amount || parseFloat(String(amount)) <= 0) {
      throw AppError.badRequest('customerId and a valid amount are required', 'VALIDATION_ERROR');
    }

    const customer = await Customer.findOne({
      _id: customerId,
      merchantId: req.userId,
      isDeleted: false,
    });
    if (!customer) throw AppError.notFound('Customer not found', 'CUSTOMER_NOT_FOUND');

    const { id, url } = await createPaymentLink(
      parseFloat(String(amount)),
      customer.name,
      req.userId!,
      customerId,
      customer.phone,
      customer.email
    );

    const payment = await Payment.create({
      customerId,
      merchantId: req.userId,
      razorpayPaymentLinkId: id,
      razorpayPaymentLinkUrl: url,
      amount: parseFloat(String(amount)),
      status: 'pending',
    });

    sendSuccess(res, payment, 201);
  })
);

// PATCH /api/payments/:id/mark-paid — manually reconcile a pending payment link
router.patch(
  '/:id/mark-paid',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      throw AppError.badRequest('Invalid payment ID', 'INVALID_ID');
    }

    const payment = await Payment.findOne({ _id: req.params.id, merchantId: req.userId });
    if (!payment) throw AppError.notFound('Payment not found', 'PAYMENT_NOT_FOUND');
    if (payment.status === 'paid') throw AppError.badRequest('Payment is already marked as paid', 'ALREADY_PAID');

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await Payment.findByIdAndUpdate(payment._id, { $set: { status: 'paid' } }, { session });
        await Transaction.create(
          [{ customerId: payment.customerId, merchantId: req.userId, type: 'got', amount: payment.amount, note: 'Payment link — manually reconciled' }],
          { session }
        );
        await Customer.findByIdAndUpdate(
          payment.customerId,
          { $inc: { totalOutstanding: -payment.amount }, $set: { lastTransactionAt: new Date() } },
          { session }
        );
      });
    } finally {
      await session.endSession();
    }

    const updated = await Payment.findById(payment._id);
    sendSuccess(res, updated);
  })
);

// GET /api/payments/:customerId
router.get(
  '/:customerId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!mongoose.isValidObjectId(req.params.customerId)) {
      throw AppError.badRequest('Invalid customer ID', 'INVALID_ID');
    }

    const payments = await Payment.find({
      customerId: req.params.customerId,
      merchantId: req.userId,
    }).sort({ createdAt: -1 });

    sendSuccess(res, payments);
  })
);

export default router;
