/**
 * Money arithmetic utilities.
 * JavaScript's IEEE-754 floating point causes subtle drift with financial math.
 * e.g., 0.1 + 0.2 === 0.30000000000000004
 * We use Math.round × 100 to keep 2-decimal precision without external deps.
 */

/** Round to exactly 2 decimal places */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Add two monetary values without floating point drift */
export function moneyAdd(a: number, b: number): number {
  return Math.round((a + b) * 100) / 100;
}

/** Subtract monetary values without floating point drift */
export function moneySub(a: number, b: number): number {
  return Math.round((a - b) * 100) / 100;
}

/** Multiply amount by a scalar (e.g. quantity × price, or amount × gstPct/100) */
export function moneyMul(amount: number, factor: number): number {
  return Math.round(amount * factor * 100) / 100;
}

/** Calculate percentage of an amount (e.g. GST, platform fee) */
export function moneyPct(amount: number, percent: number): number {
  return Math.round(amount * percent) / 100;
}
