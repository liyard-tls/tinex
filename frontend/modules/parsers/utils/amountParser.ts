/**
 * Parse amount from various string formats
 * Handles: $1,234.56, (1234.56), -1234.56, 1.234,56 (EU format)
 */
export function parseAmount(amountString: string | number): number | null {
  if (typeof amountString === 'number') {
    return amountString;
  }

  if (!amountString || typeof amountString !== 'string') {
    return null;
  }

  // Remove whitespace
  let cleaned = amountString.trim();

  if (cleaned === '' || cleaned === '-') {
    return null;
  }

  // Handle parentheses as negative (accounting format)
  const isNegativeParens = cleaned.startsWith('(') && cleaned.endsWith(')');
  if (isNegativeParens) {
    cleaned = '-' + cleaned.slice(1, -1);
  }

  // Remove currency symbols
  cleaned = cleaned.replace(/[$€£¥₹]/g, '');

  // Remove spaces
  cleaned = cleaned.replace(/\s/g, '');

  // Detect format: comma or period as decimal separator
  const hasComma = cleaned.includes(',');
  const hasPeriod = cleaned.includes('.');

  if (hasComma && hasPeriod) {
    // Both present - determine which is decimal separator
    const lastComma = cleaned.lastIndexOf(',');
    const lastPeriod = cleaned.lastIndexOf('.');

    if (lastPeriod > lastComma) {
      // Period is decimal separator (US format: 1,234.56)
      cleaned = cleaned.replace(/,/g, '');
    } else {
      // Comma is decimal separator (EU format: 1.234,56)
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    }
  } else if (hasComma && !hasPeriod) {
    // Only comma - could be thousands separator or decimal
    const parts = cleaned.split(',');
    if (parts.length === 2 && parts[1].length <= 2) {
      // Likely decimal separator (EU format)
      cleaned = cleaned.replace(',', '.');
    } else {
      // Likely thousands separator
      cleaned = cleaned.replace(/,/g, '');
    }
  }

  // Parse as float
  const amount = parseFloat(cleaned);

  return isNaN(amount) ? null : amount;
}

/**
 * Determine if amount represents income or expense
 * @param amount - The amount to check
 * @param invertSign - Some banks invert the sign (deposits are negative)
 * @returns 'income' | 'expense'
 */
export function determineTransactionType(
  amount: number,
  invertSign: boolean = false
): 'income' | 'expense' {
  const effectiveAmount = invertSign ? -amount : amount;
  return effectiveAmount >= 0 ? 'income' : 'expense';
}

/**
 * Get absolute value of amount (always positive)
 * @param amount - The amount
 * @returns number
 */
export function getAbsoluteAmount(amount: number): number {
  return Math.abs(amount);
}

/**
 * Format amount for display
 * @param amount - The amount to format
 * @param currency - Currency code (default: USD)
 * @returns string
 */
export function formatAmount(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}

/**
 * Validate if a string can be parsed as an amount
 * @param amountString - The string to validate
 * @returns boolean
 */
export function isValidAmount(amountString: string | number): boolean {
  const parsed = parseAmount(amountString);
  return parsed !== null && !isNaN(parsed);
}
