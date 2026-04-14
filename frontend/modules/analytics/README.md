# Analytics Module

This module provides spending analysis and insights functionality.

## Components

### SpendingInsights
Displays trend analysis and spending recommendations based on chart data.

**Props:**
- `chartData`: Array of weekly spending data
- `currency`: Base currency for formatting

**Usage:**
```tsx
import { SpendingInsights } from '@/modules/analytics';

<SpendingInsights
  chartData={chartData}
  currency={userSettings.baseCurrency}
/>
```

## Utilities

### analyzeSpendingTrend(chartData)
Analyzes spending patterns and returns insights with trend direction and recommendations.

**Note**: Automatically filters out weeks with zero spending to avoid skewing analysis when users haven't used the app during certain periods.

**Returns:**
```typescript
{
  trend: 'increasing' | 'decreasing' | 'stable',
  trendEmoji: string,
  averageAmount: number,
  message: string,
  comparisonText: string
}
```

### findPeakWeek(chartData)
Finds the week with highest spending.

**Returns:**
```typescript
{
  week: string,
  amount: number
} | null
```

### calculateRecentTrend(chartData)
Calculates trend comparison between last 4 weeks and previous 4 weeks.

**Returns:**
```typescript
{
  lastFourAvg: number,
  previousFourAvg: number,
  percentageChange: number
} | null
```

## Data Format

All functions expect chart data in this format:
```typescript
interface WeekData {
  week: string;      // Week label (e.g., "15 лис")
  amount: number;    // Total spending amount (in base currency)
  currency: string;  // Currency code (e.g., "USD")
}
```
