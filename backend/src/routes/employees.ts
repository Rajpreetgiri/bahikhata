import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import mongoose from 'mongoose';
import Employee from '../models/Employee';
import Attendance from '../models/Attendance';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { sendSuccess } from '../utils/response';

const router = Router();
router.use(authenticate);

// ── Employees ─────────────────────────────────────────────────────────────────

// GET /api/employees
router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const employees = await Employee.find({ merchantId: req.userId, status: { $ne: 'inactive' } })
      .sort({ name: 1 });
    sendSuccess(res, employees);
  })
);

// POST /api/employees
router.post(
  '/',
  [
    body('name').notEmpty().trim().withMessage('Name is required'),
    body('salaryType').isIn(['monthly', 'daily']).withMessage('salaryType must be monthly or daily'),
    body('salaryAmount').isFloat({ min: 0 }).withMessage('salaryAmount must be >= 0'),
  ],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) throw AppError.badRequest(errors.array()[0].msg, 'VALIDATION_ERROR');

    const { name, phone, role, salaryType, salaryAmount, joinDate } = req.body as {
      name: string; phone?: string; role?: string;
      salaryType: 'monthly' | 'daily'; salaryAmount: number; joinDate?: string;
    };

    const employee = await Employee.create({
      merchantId: req.userId,
      name,
      phone,
      role,
      salaryType,
      salaryAmount: parseFloat(String(salaryAmount)),
      joinDate: joinDate ? new Date(joinDate) : undefined,
    });

    sendSuccess(res, employee, 201);
  })
);

// PUT /api/employees/:id
router.put(
  '/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw AppError.badRequest('Invalid ID', 'INVALID_ID');

    const { name, phone, role, salaryType, salaryAmount, joinDate, status, advanceBalance } = req.body as {
      name?: string; phone?: string; role?: string;
      salaryType?: 'monthly' | 'daily'; salaryAmount?: number;
      joinDate?: string; status?: 'active' | 'inactive'; advanceBalance?: number;
    };

    const update: Record<string, unknown> = {};
    if (name !== undefined) update.name = name;
    if (phone !== undefined) update.phone = phone;
    if (role !== undefined) update.role = role;
    if (salaryType !== undefined) update.salaryType = salaryType;
    if (salaryAmount !== undefined) update.salaryAmount = parseFloat(String(salaryAmount));
    if (joinDate !== undefined) update.joinDate = new Date(joinDate);
    if (status !== undefined) update.status = status;
    if (advanceBalance !== undefined) update.advanceBalance = parseFloat(String(advanceBalance));

    const emp = await Employee.findOneAndUpdate(
      { _id: req.params.id, merchantId: req.userId },
      { $set: update },
      { new: true, runValidators: true }
    );
    if (!emp) throw AppError.notFound('Employee not found', 'NOT_FOUND');

    sendSuccess(res, emp);
  })
);

// DELETE /api/employees/:id — soft delete
router.delete(
  '/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw AppError.badRequest('Invalid ID', 'INVALID_ID');
    const emp = await Employee.findOneAndUpdate(
      { _id: req.params.id, merchantId: req.userId },
      { status: 'inactive' },
      { new: true }
    );
    if (!emp) throw AppError.notFound('Employee not found', 'NOT_FOUND');
    sendSuccess(res, { message: 'Employee deactivated' });
  })
);

// ── Attendance ─────────────────────────────────────────────────────────────────

// GET /api/employees/:id/attendance?month=YYYY-MM
router.get(
  '/:id/attendance',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw AppError.badRequest('Invalid ID', 'INVALID_ID');

    // Verify employee belongs to merchant
    const emp = await Employee.findOne({ _id: req.params.id, merchantId: req.userId });
    if (!emp) throw AppError.notFound('Employee not found', 'NOT_FOUND');

    const monthParam = req.query.month as string | undefined;
    let dateFilter: Record<string, Date> = {};
    if (monthParam) {
      const [year, month] = monthParam.split('-').map(Number);
      const from = new Date(year, month - 1, 1);
      const to = new Date(year, month, 0, 23, 59, 59, 999);
      dateFilter = { $gte: from, $lte: to };
    }

    const records = await Attendance.find({
      employeeId: req.params.id,
      merchantId: req.userId,
      ...(Object.keys(dateFilter).length ? { date: dateFilter } : {}),
    }).sort({ date: 1 });

    // Summary
    const present = records.filter((r) => r.status === 'present').length;
    const halfDay = records.filter((r) => r.status === 'half_day').length;
    const absent = records.filter((r) => r.status === 'absent').length;
    const effectiveDays = present + halfDay * 0.5;

    const netSalary = emp.salaryType === 'daily'
      ? effectiveDays * emp.salaryAmount
      : (emp.salaryAmount / (present + absent + halfDay || 1)) * effectiveDays;

    sendSuccess(res, {
      records,
      summary: { present, halfDay, absent, effectiveDays, netSalary: Math.round(netSalary * 100) / 100 },
      employee: { name: emp.name, salaryType: emp.salaryType, salaryAmount: emp.salaryAmount, advanceBalance: emp.advanceBalance },
    });
  })
);

// POST /api/employees/:id/attendance — mark or update attendance for a day
router.post(
  '/:id/attendance',
  [
    body('date').notEmpty().withMessage('date is required'),
    body('status').isIn(['present', 'absent', 'half_day', 'holiday']).withMessage('Invalid status'),
  ],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw AppError.badRequest('Invalid ID', 'INVALID_ID');
    const errors = validationResult(req);
    if (!errors.isEmpty()) throw AppError.badRequest(errors.array()[0].msg, 'VALIDATION_ERROR');

    const emp = await Employee.findOne({ _id: req.params.id, merchantId: req.userId });
    if (!emp) throw AppError.notFound('Employee not found', 'NOT_FOUND');

    const { date, status, note } = req.body as { date: string; status: string; note?: string };
    const parsedDate = new Date(date);
    parsedDate.setHours(0, 0, 0, 0);
    if (isNaN(parsedDate.getTime())) throw AppError.badRequest('Invalid date', 'VALIDATION_ERROR');

    const record = await Attendance.findOneAndUpdate(
      { employeeId: req.params.id, merchantId: req.userId, date: parsedDate },
      { status, note: note || undefined, merchantId: req.userId },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    sendSuccess(res, record, 201);
  })
);

// POST /api/employees/:id/advance — give salary advance
router.post(
  '/:id/advance',
  [body('amount').isFloat({ min: 1 }).withMessage('amount must be > 0')],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw AppError.badRequest('Invalid ID', 'INVALID_ID');
    const errors = validationResult(req);
    if (!errors.isEmpty()) throw AppError.badRequest(errors.array()[0].msg, 'VALIDATION_ERROR');

    const { amount } = req.body as { amount: number };
    const emp = await Employee.findOneAndUpdate(
      { _id: req.params.id, merchantId: req.userId },
      { $inc: { advanceBalance: parseFloat(String(amount)) } },
      { new: true }
    );
    if (!emp) throw AppError.notFound('Employee not found', 'NOT_FOUND');
    sendSuccess(res, { advanceBalance: emp.advanceBalance });
  })
);

export default router;
