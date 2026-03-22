import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { HydratedDocument } from 'mongoose';
import User, { IUser } from '../models/User';
import { AppError } from '../utils/AppError';

export interface AuthRequest extends Request {
  user?: HydratedDocument<IUser>;
  userId?: string;       // effective merchant ID (staffMerchantId for staff, own _id for merchant)
  staffRole?: string;    // 'admin' | 'viewer' | undefined (undefined = is merchant)
}

export const authenticate = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return next(AppError.unauthorized('No token provided', 'NO_TOKEN'));
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };

    const user = await User.findById(decoded.userId);
    if (!user) {
      return next(AppError.unauthorized('User not found', 'USER_NOT_FOUND'));
    }

    req.user = user;

    // Staff accounts: use employer's merchantId as effective userId
    if (user.accountType === 'staff' && user.staffMerchantId) {
      req.userId = user.staffMerchantId.toString();
      req.staffRole = user.staffRole;
    } else {
      req.userId = user._id.toString();
    }

    next();
  } catch (err) {
    // Let JWT errors (JsonWebTokenError, TokenExpiredError) flow to errorHandler
    next(err);
  }
};

/** Middleware: only staff with role 'admin' (or the merchant themselves) can write */
export const requireAdmin = (req: AuthRequest, _res: Response, next: NextFunction): void => {
  // staffRole undefined → is the merchant → always allowed
  if (!req.staffRole || req.staffRole === 'admin') return next();
  next(AppError.forbidden('Viewer staff cannot perform write operations', 'STAFF_READ_ONLY'));
};
