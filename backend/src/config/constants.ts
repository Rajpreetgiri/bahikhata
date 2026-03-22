// ─── Application-wide constants ───────────────────────────────────────────────
// Centralised here to avoid magic numbers scattered across the codebase.

// OTP
export const OTP_EXPIRY_MINUTES = 10;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_LENGTH = 6;

// JWT
export const JWT_EXPIRY = '7d';

// Rate limits (values are also set in index.ts; keep in sync)
export const RATE_LIMIT = {
  OTP_SEND: { windowMs: 60 * 60 * 1000, max: 5 },        // 5/hr
  OTP_VERIFY: { windowMs: 15 * 60 * 1000, max: 10 },     // 10/15min
  REMINDERS: { windowMs: 60 * 60 * 1000, max: 30 },      // 30/hr
  BULK_REMINDER: { windowMs: 60 * 60 * 1000, max: 3 },   // 3/hr
  PAYMENT_LINK: { windowMs: 60 * 60 * 1000, max: 20 },   // 20/hr
  ADMIN_LOGIN: { windowMs: 15 * 60 * 1000, max: 10 },    // 10/15min
  GENERAL: { windowMs: 15 * 60 * 1000, max: 300 },       // 300/15min
} as const;

// Amount bounds (₹)
export const AMOUNT = {
  MIN: 0.01,
  MAX_TRANSACTION: 10_000_000,   // ₹1 crore
  MAX_EXPENSE: 10_000_000,       // ₹1 crore
  MIN_PARTIAL_PAY: 1,            // ₹1 minimum partial payment
  MIN_WALLET_TOPUP: 20,          // ₹20 minimum top-up
  MAX_WALLET_TOPUP: 100_000,     // ₹1 lakh per top-up
} as const;

// Pagination
export const PAGINATION = {
  DEFAULT_LIMIT: 30,
  MAX_LIMIT: 100,
  MAX_WALLET_HISTORY: 50,
  RECENT_TRANSACTIONS: 10,
} as const;

// Wallet / SMS pricing
export const WALLET = {
  SMS_RATE_RS: 0.50,             // ₹0.50 per SMS from wallet
  SMS_PACK_RATE_RS: 0.15,        // effective cost with SMS pack
} as const;

// Admin JWT
export const ADMIN_TOKEN_EXPIRY = '8h';
