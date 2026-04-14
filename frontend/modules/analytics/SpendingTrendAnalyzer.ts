/**
 * Spending Trend Analyzer Module
 * Analyzes spending patterns and provides insights
 */

export type TrendDirection = "increasing" | "decreasing" | "stable";

export interface SpendingInsight {
  trend: TrendDirection;
  trendEmoji: string;
  averageAmount: number;
  message: string;
  comparisonText: string;
}

interface WeekData {
  week: string;
  amount: number;
  currency: string;
}

/**
 * Analyzes spending trend from chart data
 * @param chartData Array of weekly spending data
 * @returns Spending insights with trend and recommendations
 */
export function analyzeSpendingTrend(
  chartData: WeekData[]
): SpendingInsight | null {
  if (!chartData || chartData.length === 0) {
    return null;
  }

  // Filter out weeks with zero spending
  const nonZeroWeeks = chartData.filter((week) => week.amount > 0);

  // If no weeks with spending, return null
  if (nonZeroWeeks.length === 0) {
    return null;
  }

  // Calculate average for weeks with spending
  const totalAmount = nonZeroWeeks.reduce((sum, week) => sum + week.amount, 0);
  const averageAmount = totalAmount / nonZeroWeeks.length;

  // Split data into two halves for comparison (only non-zero weeks)
  const midpoint = Math.floor(nonZeroWeeks.length / 2);
  const firstHalf = nonZeroWeeks.slice(0, midpoint);
  const secondHalf = nonZeroWeeks.slice(midpoint);

  // If either half is empty, can't calculate trend
  if (firstHalf.length === 0 || secondHalf.length === 0) {
    return null;
  }

  const firstHalfAvg =
    firstHalf.reduce((sum, week) => sum + week.amount, 0) / firstHalf.length;
  const secondHalfAvg =
    secondHalf.reduce((sum, week) => sum + week.amount, 0) / secondHalf.length;

  // Calculate percentage change
  const percentageChange =
    ((secondHalfAvg - firstHalfAvg) / (firstHalfAvg || 1)) * 100;

  // Determine trend (threshold: 10% change to avoid noise)
  let trend: TrendDirection;
  let trendEmoji: string;
  let message: string;

  if (percentageChange > 10) {
    trend = "increasing";
    trendEmoji = "↗️";
    message = "Consider reviewing your budget for this category";
  } else if (percentageChange < -10) {
    trend = "decreasing";
    trendEmoji = "↘️";
    message = "Great job reducing spending in this category!";
  } else {
    trend = "stable";
    trendEmoji = "➡️";
    message = "Your spending is consistent in this category";
  }

  // Format comparison text
  const changeDirection = percentageChange > 0 ? "+" : "";
  const comparisonText = `${changeDirection}${percentageChange.toFixed(
    1
  )}% compared to previous weeks`;

  return {
    trend,
    trendEmoji,
    averageAmount,
    message,
    comparisonText,
  };
}

/**
 * Finds the week with highest spending
 * @param chartData Array of weekly spending data
 * @returns Index and data of peak week, or null if empty
 */
export function findPeakWeek(
  chartData: WeekData[]
): { week: string; amount: number } | null {
  if (!chartData || chartData.length === 0) {
    return null;
  }

  // Filter out weeks with zero spending
  const nonZeroWeeks = chartData.filter((week) => week.amount > 0);

  if (nonZeroWeeks.length === 0) {
    return null;
  }

  let peakWeek = nonZeroWeeks[0];

  for (const week of nonZeroWeeks) {
    if (week.amount > peakWeek.amount) {
      peakWeek = week;
    }
  }

  return {
    week: peakWeek.week,
    amount: peakWeek.amount,
  };
}

/**
 * Calculates recent trend (last 4 weeks vs previous 4 weeks)
 * @param chartData Array of weekly spending data (should have at least 8 weeks)
 * @returns Recent trend comparison or null if insufficient data
 */
export function calculateRecentTrend(chartData: WeekData[]): {
  lastFourAvg: number;
  previousFourAvg: number;
  percentageChange: number;
} | null {
  if (!chartData || chartData.length < 8) {
    return null;
  }

  // Filter out weeks with zero spending
  const nonZeroWeeks = chartData.filter((week) => week.amount > 0);

  if (nonZeroWeeks.length < 4) {
    return null;
  }

  const lastFour = nonZeroWeeks.slice(-4);
  const previousFour = nonZeroWeeks.slice(-8, -4);

  if (previousFour.length === 0) {
    return null;
  }

  const lastFourAvg =
    lastFour.reduce((sum, week) => sum + week.amount, 0) / lastFour.length;
  const previousFourAvg =
    previousFour.reduce((sum, week) => sum + week.amount, 0) /
    previousFour.length;

  const percentageChange =
    ((lastFourAvg - previousFourAvg) / (previousFourAvg || 1)) * 100;

  return {
    lastFourAvg,
    previousFourAvg,
    percentageChange,
  };
}
