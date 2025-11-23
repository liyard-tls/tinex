/**
 * Budget Utilities
 * Helper functions for budget period calculations and progress tracking
 */

import { BudgetPeriod } from '@/core/models';

/**
 * Get the start and end dates for the current period
 */
export function getCurrentPeriodDates(period: BudgetPeriod, referenceDate: Date = new Date()): {
  start: Date;
  end: Date;
} {
  const now = new Date(referenceDate);
  now.setHours(0, 0, 0, 0);

  switch (period) {
    case 'day': {
      const start = new Date(now);
      const end = new Date(now);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }

    case 'week': {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
      const start = new Date(now.setDate(diff));
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }

    case 'month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      start.setHours(0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }

    case 'year': {
      const start = new Date(now.getFullYear(), 0, 1);
      start.setHours(0, 0, 0, 0);
      const end = new Date(now.getFullYear(), 11, 31);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }

    default:
      throw new Error(`Unknown period: ${period}`);
  }
}

/**
 * Get the label for a budget period
 */
export function getPeriodLabel(period: BudgetPeriod): string {
  switch (period) {
    case 'day':
      return 'Daily';
    case 'week':
      return 'Weekly';
    case 'month':
      return 'Monthly';
    case 'year':
      return 'Yearly';
    default:
      return period;
  }
}

/**
 * Calculate budget progress percentage
 */
export function calculateBudgetProgress(spent: number, target: number): number {
  if (target <= 0) return 0;
  return Math.round((spent / target) * 100);
}

/**
 * Get progress bar color based on percentage
 * Returns a color that transitions from green -> yellow -> orange -> red
 */
export function getProgressColor(percentage: number): string {
  if (percentage <= 50) {
    // Green (0-50%)
    return '#22c55e';
  } else if (percentage <= 75) {
    // Yellow/Amber (50-75%)
    return '#eab308';
  } else if (percentage <= 90) {
    // Orange (75-90%)
    return '#f97316';
  } else {
    // Red (90%+)
    return '#ef4444';
  }
}

/**
 * Format period range as string
 */
export function formatPeriodRange(start: Date, end: Date): string {
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
  };

  const formatDateWithYear = (date: Date) => {
    return date.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  // If same day
  if (start.toDateString() === end.toDateString()) {
    return formatDate(start);
  }

  // If same year
  if (start.getFullYear() === end.getFullYear()) {
    return `${formatDate(start)} - ${formatDate(end)}`;
  }

  // Different years
  return `${formatDateWithYear(start)} - ${formatDateWithYear(end)}`;
}

/**
 * Get the number of days remaining in the period
 */
export function getDaysRemaining(periodEnd: Date): number {
  const now = new Date();
  const diff = periodEnd.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}
