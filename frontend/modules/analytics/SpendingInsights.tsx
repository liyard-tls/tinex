/**
 * Spending Insights Component
 * Displays trend analysis and recommendations
 */

import { Card, CardContent } from "@/shared/components/ui/Card";
import { formatCurrency } from "@/shared/services/currencyService";
import { Currency } from "@/core/models";
import { analyzeSpendingTrend, findPeakWeek } from "./SpendingTrendAnalyzer";

interface WeekData {
  week: string;
  amount: number;
  currency: string;
}

interface SpendingInsightsProps {
  chartData: WeekData[];
  currency: Currency;
}

export default function SpendingInsights({
  chartData,
  currency,
}: SpendingInsightsProps) {
  const insights = analyzeSpendingTrend(chartData);
  const peakWeek = findPeakWeek(chartData);

  if (!insights) {
    return null;
  }

  return (
    <Card className="bg-card/50">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div
            className="text-3xl"
            role="img"
            aria-label={`Trend ${insights.trend}`}
          >
            {insights.trendEmoji}
          </div>
          <div className="flex-1 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              💡 Spending Insights
            </h3>

            <ul className="space-y-1.5 text-sm">
              <li className="flex items-start gap-2 ">
                <span className="text-muted-foreground min-w-[4px]">•</span>
                <span className="text-muted-foreground">
                  <span className="font-medium text-foreground">Trend:</span>{" "}
                  Your spending is{" "}
                  <span
                    className={
                      insights.trend === "increasing"
                        ? "text-destructive font-medium"
                        : insights.trend === "decreasing"
                        ? "text-success font-medium"
                        : "text-foreground font-medium"
                    }
                  >
                    {insights.trend}
                  </span>{" "}
                  ({insights.comparisonText})
                </span>
              </li>

              <li className="flex items-start gap-2">
                <span className="text-muted-foreground min-w-[4px]">•</span>
                <span className="text-muted-foreground">
                  <span className="font-medium text-foreground">Average:</span>{" "}
                  {formatCurrency(insights.averageAmount, currency)} per week
                </span>
              </li>

              {peakWeek && peakWeek.amount > 0 && (
                <li className="flex items-start gap-2">
                  <span className="text-muted-foreground min-w-[4px]">•</span>
                  <span className="text-muted-foreground">
                    <span className="font-medium text-foreground">
                      Peak spending:
                    </span>{" "}
                    {formatCurrency(peakWeek.amount, currency)} on{" "}
                    {peakWeek.week}
                  </span>
                </li>
              )}

              <li className="flex items-start gap-2">
                <span className="text-muted-foreground min-w-[4px]">•</span>
                <span
                  className={
                    insights.trend === "increasing"
                      ? "text-amber-500"
                      : insights.trend === "decreasing"
                      ? "text-success"
                      : "text-muted-foreground"
                  }
                >
                  {insights.message}
                </span>
              </li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
