import { Router, Response } from 'express';
import QRCode from 'qrcode';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';

const router = Router();
router.use(authenticate);

// GET /api/qr/merchant  — returns PNG of merchant's UPI QR code
router.get(
  '/merchant',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const merchant = req.user!;

    if (!merchant.upiId) {
      throw AppError.badRequest('UPI ID not set. Please update your profile with a UPI ID.', 'UPI_ID_MISSING');
    }

    // UPI deep link format: upi://pay?pa=VPA&pn=Name&am=0&cu=INR
    const upiUrl = `upi://pay?pa=${encodeURIComponent(merchant.upiId)}&pn=${encodeURIComponent(merchant.businessName)}&am=0&cu=INR`;

    const pngBuffer = await QRCode.toBuffer(upiUrl, {
      type: 'png',
      width: 400,
      margin: 2,
      color: { dark: '#1f2937', light: '#ffffff' },
    });

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `inline; filename="qr_${merchant.businessName.replace(/\s+/g, '_')}.png"`);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(pngBuffer);
  })
);

export default router;
