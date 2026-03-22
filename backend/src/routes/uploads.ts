import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { Router, Response } from 'express';
import multer from 'multer';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { sendSuccess } from '../utils/response';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, and WebP images are allowed'));
    }
  },
});

const router = Router();
router.use(authenticate);

// POST /api/uploads/photo  — multipart/form-data, field name "photo"
router.post(
  '/photo',
  upload.single('photo'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.file) {
      throw AppError.badRequest('No file uploaded', 'NO_FILE');
    }
    const photoUrl = `/uploads/${req.file.filename}`;
    sendSuccess(res, { photoUrl }, 201);
  })
);

export default router;
