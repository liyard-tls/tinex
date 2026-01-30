/**
 * Analytics Module
 * Export all analytics-related components and utilities
 */

export { default as SpendingInsights } from './SpendingInsights';
export { default as PresetSelector } from './PresetSelector';
export {
  analyzeSpendingTrend,
  findPeakWeek,
  calculateRecentTrend,
  type TrendDirection,
  type SpendingInsight,
} from './SpendingTrendAnalyzer';
