/**
 * Date helper utilities for handling timezone-aware dates
 *
 * Problem: Firestore Timestamp always stores dates in UTC, which causes timezone shifts
 * when we need to preserve exact local time (like from imported PDFs).
 *
 * Solution: Store date components separately to preserve exact local time.
 */

export interface DateComponents {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
}

/**
 * Extract date components from a Date object (using local timezone)
 */
export function extractDateComponents(date: Date): DateComponents {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1, // 0-11 -> 1-12
    day: date.getDate(),
    hour: date.getHours(),
    minute: date.getMinutes(),
  };
}

/**
 * Create a Date object from components (in local timezone)
 */
export function createDateFromComponents(components: DateComponents): Date {
  return new Date(
    components.year,
    components.month - 1, // 1-12 -> 0-11
    components.day,
    components.hour,
    components.minute
  );
}

/**
 * Format date components as YYYY-MM-DD HH:MM string (for hashing)
 */
export function formatDateComponents(components: DateComponents): string {
  const year = components.year;
  const month = String(components.month).padStart(2, '0');
  const day = String(components.day).padStart(2, '0');
  const hour = String(components.hour).padStart(2, '0');
  const minute = String(components.minute).padStart(2, '0');

  return `${year}-${month}-${day} ${hour}:${minute}`;
}

/**
 * Format date as YYYY-MM-DD HH:MM string from Date object (for hashing)
 */
export function formatDateForHash(date: Date): string {
  const components = extractDateComponents(date);
  return formatDateComponents(components);
}
