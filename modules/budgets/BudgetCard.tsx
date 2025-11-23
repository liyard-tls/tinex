/**
 * Budget Card Component
 * Displays a budget with progress bar, spent amount, and remaining amount
 */

import { Category } from "@/core/models";
import { BudgetProgress } from "@/core/models/budget";
import { Card, CardContent } from "@/shared/components/ui/Card";
import { CATEGORY_ICONS } from "@/shared/config/icons";
import { MoreHorizontal, Edit, Trash2 } from "lucide-react";
import { formatCurrency } from "@/shared/services/currencyService";
import {
  getProgressColor,
  getPeriodLabel,
  formatPeriodRange,
} from "./budgetUtils";

interface BudgetCardProps {
  budgetProgress: BudgetProgress;
  category: Category;
  currency: string;
  onEdit?: () => void;
  onDelete?: () => void;
  onClick?: () => void;
}

export default function BudgetCard({
  budgetProgress,
  category,
  currency,
  onEdit,
  onDelete,
  onClick,
}: BudgetCardProps) {
  const IconComponent =
    CATEGORY_ICONS[category.icon as keyof typeof CATEGORY_ICONS] ||
    MoreHorizontal;
  const progressColor = getProgressColor(budgetProgress.percentage);
  const isOverBudget = budgetProgress.percentage > 100;

  return (
    <Card
      className="overflow-hidden cursor-pointer hover:bg-muted/30 transition-colors"
      onClick={onClick}
    >
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3 flex-1">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${category.color}20` }}
            >
              <IconComponent
                className="h-5 w-5"
                style={{ color: category.color }}
              />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-foreground">
                {category.name}
              </h3>
              <p className="text-xs text-muted-foreground">
                {getPeriodLabel(budgetProgress.budget.period) +
                  " | " +
                  formatPeriodRange(
                    new Date(budgetProgress.budget.startDate),
                    new Date(budgetProgress.budget.endDate || new Date())
                  )}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          {(onEdit || onDelete) && (
            <div
              className="flex items-center gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              {onEdit && (
                <button
                  onClick={onEdit}
                  className="p-2 hover:bg-muted rounded-md transition-colors"
                  aria-label="Edit budget"
                >
                  <Edit className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
              {onDelete && (
                <button
                  onClick={onDelete}
                  className="p-2 hover:bg-destructive/10 rounded-md transition-colors"
                  aria-label="Delete budget"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-muted-foreground">
              Spent: {formatCurrency(budgetProgress.spent, currency as any)}
            </span>
            <span
              className={
                isOverBudget
                  ? "text-destructive font-medium"
                  : "text-muted-foreground"
              }
            >
              {budgetProgress.percentage}%
            </span>
          </div>

          {/* Progress Bar */}
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full transition-all duration-300"
              style={{
                width: `${Math.min(budgetProgress.percentage, 100)}%`,
                backgroundColor: progressColor,
              }}
            />
          </div>

          {/* Budget Info */}
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-muted-foreground">
              Target:{" "}
              {formatCurrency(budgetProgress.budget.amount, currency as any)}
            </span>
            {budgetProgress.remaining > 0 ? (
              <span className="text-success font-medium">
                {formatCurrency(budgetProgress.remaining, currency as any)} left
              </span>
            ) : (
              <span className="text-destructive font-medium">
                Over by{" "}
                {formatCurrency(
                  Math.abs(budgetProgress.remaining),
                  currency as any
                )}
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
