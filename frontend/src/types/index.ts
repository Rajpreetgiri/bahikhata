export const BUSINESS_CATEGORIES = [
  { id: 'automobile',     label: 'Automobile'           },
  { id: 'cloth',          label: 'Cloth / Garments'     },
  { id: 'dairy',          label: 'Dairy / Milk'         },
  { id: 'electronics',    label: 'Electronics'          },
  { id: 'grocery',        label: 'Grocery / Sabzi'      },
  { id: 'hardware',       label: 'Hardware / Tools'     },
  { id: 'kirana',         label: 'Kirana Store'         },
  { id: 'pastry',         label: 'Pastry / Bakery'      },
  { id: 'pharmacy',       label: 'Pharmacy / Medical'   },
  { id: 'professional',   label: 'Professional'         },
  { id: 'restaurant',     label: 'Restaurant / Dhaba'   },
  { id: 'seeds_chemical', label: 'Seeds / Chemical'     },
  { id: 'other',          label: 'Other'                },
] as const;

export type BusinessCategoryId = typeof BUSINESS_CATEGORIES[number]['id'];

export type AccountType = 'merchant' | 'staff';
export type StaffRole = 'admin' | 'viewer';

export interface User {
  id: string;
  email: string;
  businessName: string;
  ownerName: string;
  phone?: string;
  fcmToken?: string;
  businessCategory?: BusinessCategoryId;
  businessAddress?: string;
  gstNumber?: string;
  upiId?: string;
  isOnboarded: boolean;
  accountType?: AccountType;
  staffMerchantId?: string;
  staffRole?: StaffRole;
  createdAt?: string;
}

export interface BusinessSummary {
  id: string;
  businessName: string;
  ownerName: string;
  businessCategory?: string;
  isOnboarded: boolean;
  createdAt: string;
}

export interface StaffMember {
  id: string;
  email: string;
  name: string;
  role: StaffRole;
  joinedAt: string;
}

export interface Customer {
  _id: string;
  merchantId: string;
  name: string;
  phone?: string;
  email?: string;
  totalOutstanding: number;
  lastTransactionAt?: string;
  lastPaymentAmount?: number;
  isDeleted: boolean;
  creditLimit?: number;
  riskFlag: boolean;
  createdAt: string;
}

export type PaymentMethod = 'cash' | 'upi' | 'card' | 'cheque' | 'bank_transfer' | 'other';

export interface Transaction {
  _id: string;
  customerId: string;
  merchantId: string;
  type: 'gave' | 'got';
  amount: number;
  note?: string;
  photoUrl?: string;
  paymentMethod?: PaymentMethod;
  dueDate?: string;
  createdAt: string;
}

export interface Reminder {
  _id: string;
  customerId: string | PopulatedCustomer;
  merchantId: string;
  channel: 'email' | 'whatsapp' | 'sms' | 'ivr';
  status: 'sent' | 'failed';
  triggerType: 'manual' | 'auto';
  sentAt: string;
  errorMessage?: string;
}

// Populated version returned by reminder history API
export interface PopulatedCustomer {
  _id: string;
  name: string;
  phone?: string;
  email?: string;
}

export interface Payment {
  _id: string;
  customerId: string;
  merchantId: string;
  razorpayPaymentLinkId: string;
  razorpayPaymentLinkUrl: string;
  amount: number;
  status: 'pending' | 'paid';
  createdAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pages: number;
}

// ── Inventory ────────────────────────────────────────────────────────────────

export type StockUnit = 'piece' | 'kg' | 'gram' | 'litre' | 'ml' | 'pack' | 'box' | 'dozen' | 'metre';

export const STOCK_UNITS: { value: StockUnit; label: string }[] = [
  { value: 'piece', label: 'Piece' },
  { value: 'kg', label: 'Kg' },
  { value: 'gram', label: 'Gram' },
  { value: 'litre', label: 'Litre' },
  { value: 'ml', label: 'mL' },
  { value: 'pack', label: 'Pack' },
  { value: 'box', label: 'Box' },
  { value: 'dozen', label: 'Dozen' },
  { value: 'metre', label: 'Metre' },
];

export interface Product {
  _id: string;
  merchantId: string;
  name: string;
  sku?: string;
  unit: StockUnit;
  sellingPrice: number;
  purchasePrice?: number;
  stock: number;
  lowStockThreshold: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ── Invoices ─────────────────────────────────────────────────────────────────

export type InvoiceStatus = 'unpaid' | 'partially_paid' | 'paid' | 'cancelled' | 'returned';
export type InvoicePaymentMode = 'credit' | 'paid';

export interface InvoiceItem {
  productId: string;
  productName: string;
  unit: StockUnit;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Invoice {
  _id: string;
  merchantId: string;
  customerId: string | PopulatedCustomer;
  invoiceNumber: string;
  items: InvoiceItem[];
  subtotal: number;
  gstPercent?: number;
  gstAmount?: number;
  totalAmount: number;
  paidAmount: number;
  status: InvoiceStatus;
  paymentMode: InvoicePaymentMode; // 'credit' = udhari, 'paid' = immediate payment
  dueDate?: string;
  paidAt?: string;
  transactionId?: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Suppliers ─────────────────────────────────────────────────────────────────

export interface Supplier {
  _id: string;
  merchantId: string;
  name: string;
  phone?: string;
  email?: string;
  companyName?: string;
  totalDue: number; // positive = merchant owes supplier
  lastTransactionAt?: string;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierTransaction {
  _id: string;
  supplierId: string;
  merchantId: string;
  type: 'bought' | 'paid';
  amount: number;
  note?: string;
  photoUrl?: string;
  createdAt: string;
  updatedAt: string;
}

// ── History / Unified Ledger ──────────────────────────────────────────────────

export interface HistoryEntry {
  _id: string;
  type: 'gave' | 'got' | 'bought' | 'paid';
  amount: number;
  note?: string;
  partyKind: 'customer' | 'supplier';
  party: { _id: string; name: string; phone?: string; companyName?: string };
  createdAt: string;
}

export interface HistorySummary {
  totalGave: number;
  totalGot: number;
  totalBought: number;
  totalPaid: number;
}

export interface HistoryResponse {
  data: HistoryEntry[];
  meta: { total: number; page: number; pages: number };
  summary: HistorySummary;
}

// ── Wallet ────────────────────────────────────────────────────────────────────

export type SMSPackPlan = 'sms_100' | 'sms_500' | 'sms_2000';

export interface SMSPlan {
  plan: SMSPackPlan;
  price: number;       // in ₹
  totalSMS: number;
  validityDays: number;
  label: string;
  pricePerSMS: number;
}

export interface WalletInfo {
  balance: number;
  activePack: {
    plan: SMSPackPlan;
    remaining: number;
    total: number;
    expiresAt: string;
  } | null;
}

export interface WalletTransaction {
  _id: string;
  type: 'credit' | 'debit';
  amount: number;
  balanceAfter: number;
  description: string;
  channel: 'razorpay' | 'sms' | 'whatsapp' | 'pack_purchase' | 'refund';
  createdAt: string;
}

// ── Expenses ──────────────────────────────────────────────────────────────────

export type ExpenseCategory =
  | 'rent'
  | 'salary'
  | 'electricity'
  | 'raw_material'
  | 'transport'
  | 'marketing'
  | 'maintenance'
  | 'other';

export const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string; iconName: string }[] = [
  { value: 'rent',         label: 'Rent / Kiraya',        iconName: 'Building2'      },
  { value: 'salary',       label: 'Staff Salary',          iconName: 'Users'          },
  { value: 'electricity',  label: 'Electricity / Bijli',   iconName: 'Zap'            },
  { value: 'raw_material', label: 'Raw Material',          iconName: 'Package'        },
  { value: 'transport',    label: 'Transport',             iconName: 'Truck'          },
  { value: 'marketing',    label: 'Marketing / Ads',       iconName: 'Megaphone'      },
  { value: 'maintenance',  label: 'Repairs / Maintenance', iconName: 'Wrench'         },
  { value: 'other',        label: 'Other',                 iconName: 'MoreHorizontal' },
];

export interface Expense {
  _id: string;
  merchantId: string;
  amount: number;
  category: ExpenseCategory;
  note?: string;
  paymentMethod?: PaymentMethod;
  date: string;
  createdAt: string;
}

// ── Cashbook ──────────────────────────────────────────────────────────────────

export type CashEntryType = 'in' | 'out';

export interface CashEntry {
  _id: string;
  merchantId: string;
  type: CashEntryType;
  amount: number;
  note?: string;
  date: string;
  createdAt: string;
}

export interface CashbookSummary {
  totalIn: number;
  totalOut: number;
  netCash: number;
  count: number;
}

// ── Scheduled Reminders ───────────────────────────────────────────────────────

export interface ScheduledReminder {
  _id: string;
  merchantId: string;
  offsetDays: number;
  channels: ('email' | 'sms' | 'whatsapp')[];
  isEnabled: boolean;
  createdAt: string;
}

// ── PagarKhata / Payroll ──────────────────────────────────────────────────────

export type SalaryType = 'monthly' | 'daily';
export type EmployeeStatus = 'active' | 'inactive';
export type AttendanceStatus = 'present' | 'absent' | 'half_day' | 'holiday';

export interface Employee {
  _id: string;
  merchantId: string;
  name: string;
  phone?: string;
  role?: string;
  salaryType: SalaryType;
  salaryAmount: number;
  joinDate?: string;
  status: EmployeeStatus;
  advanceBalance: number;
  createdAt: string;
}

export interface AttendanceRecord {
  _id: string;
  employeeId: string;
  date: string;
  status: AttendanceStatus;
  note?: string;
}

export interface AttendanceSummary {
  present: number;
  halfDay: number;
  absent: number;
  effectiveDays: number;
  netSalary: number;
}

// ── Payout / Razorpay Route ───────────────────────────────────────────────────

export type PayoutAccountStatus = 'not_connected' | 'created' | 'kyc_pending' | 'active' | 'suspended';

export interface PayoutAccount {
  _id?: string;
  razorpayAccountId?: string;
  razorpayAccountStatus: PayoutAccountStatus;
  razorpayActivatedAt?: string;
  legalBusinessName?: string;
  pan?: string;               // masked from API e.g. "ABCDE****A"
  businessCity?: string;
  businessState?: string;
  businessPostalCode?: string;
  bankAccountName?: string;
  bankAccountNumber?: string; // masked "****4321"
  bankIfsc?: string;
  bankName?: string;
  upiId?: string;
  platformFeePercent: number;
  totalRouteTransfers: number;
  totalAmountRouted: number;
  lastTransferAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface RouteTransfer {
  _id: string;
  razorpayPaymentId: string;
  razorpayTransferId?: string;
  grossAmountRs: number;
  platformFeeRs: number;
  netAmountRs: number;
  status: 'initiated' | 'settled' | 'failed' | 'reversed';
  errorMessage?: string;
  createdAt: string;
}
