import { moneySchema } from '@signoff/api-client';
import type { Money } from '@signoff/api-client';

export type ParseAmountResult =
  | { ok: true; money: Money }
  | { ok: false; error: string };

const MAX_PERMITTED_AMOUNT = 100_000.0;

/**
 * Parses human amount input into a strongly typed USD Money value.
 * Handles commas, spaces, currency symbols, leading zeros, and decimal normalization.
 * Rejects zero, negatives, >2 decimal places, huge values, and invalid characters.
 */
export function parseAmountInput(raw: string): ParseAmountResult {
  if (typeof raw !== 'string') {
    return { ok: false, error: 'Amount input must be a string' };
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, error: 'Amount cannot be empty' };
  }

  // Check for negative sign
  if (trimmed.startsWith('-') || trimmed.includes('-')) {
    return { ok: false, error: 'Amount cannot be negative' };
  }

  // Strip leading dollar sign or currency symbol, and internal spaces
  let clean = trimmed.replace(/^\$\s*/, '').replace(/\s+/g, '');

  // Check if multiple decimal points exist
  const decimalCount = (clean.match(/\./g) ?? []).length;
  if (decimalCount > 1) {
    return { ok: false, error: 'Amount cannot contain multiple decimal points' };
  }

  // Handle commas: check if commas are used as thousands separators
  if (clean.includes(',')) {
    // Check for comma without dot where comma was meant as decimal or invalid thousand placement
    const parts = clean.split('.');
    const integerPart = parts[0] ?? '';
    // If thousands commas exist, verify format e.g. 1,000 or 1,234,567
    const commaRegex = /^\d{1,3}(,\d{3})*$/;
    if (!commaRegex.test(integerPart)) {
      return { ok: false, error: 'Invalid comma format in amount' };
    }
    clean = clean.replace(/,/g, '');
  }

  // Must match integer or decimal with up to 2 decimal places
  // Pattern: optional leading digits, optional dot, digits
  if (!/^\d*(\.\d+)?$/.test(clean) || clean === '.') {
    return { ok: false, error: 'Invalid amount format' };
  }

  let [dollars = '0', cents = ''] = clean.split('.');

  // Normalize leading zeros in dollars (e.g., '007' -> '7', '00' -> '0')
  dollars = dollars.replace(/^0+(?=\d)/, '');
  if (!dollars) {
    dollars = '0';
  }

  // Check decimal places
  if (cents.length > 2) {
    return { ok: false, error: 'Amount cannot have more than two decimal places' };
  }

  // Pad cents to strictly two digits
  if (cents.length === 0) {
    cents = '00';
  } else if (cents.length === 1) {
    cents = `${cents}0`;
  }

  const normalizedValue = `${dollars}.${cents}`;
  const numeric = parseFloat(normalizedValue);

  if (isNaN(numeric)) {
    return { ok: false, error: 'Invalid amount value' };
  }

  if (numeric === 0) {
    return { ok: false, error: 'Amount must be greater than zero' };
  }

  if (numeric > MAX_PERMITTED_AMOUNT) {
    return {
      ok: false,
      error: `Amount exceeds maximum permitted limit ($${MAX_PERMITTED_AMOUNT.toLocaleString('en-US', { minimumFractionDigits: 2 })})`,
    };
  }

  const parsedMoney = moneySchema.safeParse({
    value: normalizedValue,
    currency_code: 'USD',
  });
  if (!parsedMoney.success) {
    return { ok: false, error: 'Invalid amount value' };
  }

  return { ok: true, money: parsedMoney.data };
}
