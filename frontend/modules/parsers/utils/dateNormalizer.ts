import { parse, isValid } from 'date-fns';

/**
 * Common date formats used by different banks
 */
const COMMON_DATE_FORMATS = [
  'MM/dd/yyyy',
  'dd/MM/yyyy',
  'yyyy-MM-dd',
  'MM-dd-yyyy',
  'dd-MM-yyyy',
  'MMM dd, yyyy',
  'dd MMM yyyy',
  'MM/dd/yy',
  'dd/MM/yy',
  'yyyy/MM/dd',
  'M/d/yyyy',
  'd/M/yyyy',
];

/**
 * Try to parse a date string using multiple format attempts
 * @param dateString - The date string to parse
 * @param preferredFormat - Optional preferred format to try first
 * @returns Date | null
 */
export function parseFlexibleDate(
  dateString: string,
  preferredFormat?: string
): Date | null {
  if (!dateString || typeof dateString !== 'string') {
    return null;
  }

  const cleanedDate = dateString.trim();

  // Try preferred format first
  if (preferredFormat) {
    const date = parse(cleanedDate, preferredFormat, new Date());
    if (isValid(date)) {
      return date;
    }
  }

  // Try common formats
  for (const format of COMMON_DATE_FORMATS) {
    try {
      const date = parse(cleanedDate, format, new Date());
      if (isValid(date)) {
        return date;
      }
    } catch {
      continue;
    }
  }

  // Try native Date parsing as last resort
  try {
    const date = new Date(cleanedDate);
    if (isValid(date)) {
      return date;
    }
  } catch {
    // Fall through
  }

  return null;
}

/**
 * Validate if a date string can be parsed
 * @param dateString - The date string to validate
 * @returns boolean
 */
export function isValidDateString(dateString: string): boolean {
  return parseFlexibleDate(dateString) !== null;
}

/**
 * Convert various date formats to ISO string
 * @param dateString - The date string to convert
 * @returns string | null
 */
export function normalizeToISOString(dateString: string): string | null {
  const date = parseFlexibleDate(dateString);
  return date ? date.toISOString() : null;
}
