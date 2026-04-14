/**
 * Budget List Component
 * Displays budgets grouped by period or category
 */

'use client';

import { useMemo } from 'react';
import { BudgetProgress, Category, BudgetPeriod } from '@/core/models';
import BudgetCard from './BudgetCard';
import { getPeriodLabel } from './budgetUtils';

type GroupMode = 'period' | 'category';

interface BudgetListProps {
  budgets: BudgetProgress[];
  categories: Category[];
  currency: string;
  groupBy: GroupMode;
  onEdit?: (budgetId: string) => void;
  onDelete?: (budgetId: string) => void;
  onClick?: (categoryId: string, startDate: Date, endDate: Date) => void;
}

interface GroupedBudgets {
  [key: string]: BudgetProgress[];
}

export default function BudgetList({
  budgets,
  categories,
  currency,
  groupBy,
  onEdit,
  onDelete,
  onClick,
}: BudgetListProps) {
  // Group budgets based on selected mode
  const groupedBudgets = useMemo<GroupedBudgets>(() => {
    const groups: GroupedBudgets = {};

    budgets.forEach((budgetProgress) => {
      let key: string;

      if (groupBy === 'period') {
        key = budgetProgress.budget.period;
      } else {
        key = budgetProgress.budget.categoryId;
      }

      if (!groups[key]) {
        groups[key] = [];
      }

      groups[key].push(budgetProgress);
    });

    return groups;
  }, [budgets, groupBy]);

  // Get label for group header
  const getGroupLabel = (key: string): string => {
    if (groupBy === 'period') {
      return getPeriodLabel(key as BudgetPeriod);
    } else {
      const category = categories.find((c) => c.id === key);
      return category?.name || 'Unknown Category';
    }
  };

  // Sort groups by priority
  const sortedGroupKeys = useMemo(() => {
    const keys = Object.keys(groupedBudgets);

    if (groupBy === 'period') {
      // Sort by period duration: day, week, month, year
      const periodOrder: { [key: string]: number } = {
        day: 1,
        week: 2,
        month: 3,
        year: 4,
      };
      return keys.sort((a, b) => periodOrder[a] - periodOrder[b]);
    } else {
      // Sort alphabetically by category name
      return keys.sort((a, b) => {
        const labelA = getGroupLabel(a);
        const labelB = getGroupLabel(b);
        return labelA.localeCompare(labelB);
      });
    }
  }, [groupedBudgets, groupBy, categories]);

  if (budgets.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No budgets yet</p>
        <p className="text-sm text-muted-foreground mt-1">
          Create a budget to start tracking your spending
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {sortedGroupKeys.map((groupKey) => {
        const groupBudgets = groupedBudgets[groupKey];

        return (
          <div key={groupKey}>
            {/* Group Header */}
            <h3 className="text-sm font-semibold text-foreground mb-3 px-1">
              {getGroupLabel(groupKey)}
              <span className="text-muted-foreground ml-2">
                ({groupBudgets.length})
              </span>
            </h3>

            {/* Budget Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {groupBudgets.map((budgetProgress) => {
                const category = categories.find(
                  (c) => c.id === budgetProgress.budget.categoryId
                );

                if (!category) return null;

                return (
                  <BudgetCard
                    key={budgetProgress.budget.id}
                    budgetProgress={budgetProgress}
                    category={category}
                    currency={currency}
                    onEdit={
                      onEdit
                        ? () => onEdit(budgetProgress.budget.id)
                        : undefined
                    }
                    onDelete={
                      onDelete
                        ? () => onDelete(budgetProgress.budget.id)
                        : undefined
                    }
                    onClick={
                      onClick
                        ? () =>
                            onClick(
                              budgetProgress.budget.categoryId,
                              budgetProgress.budget.startDate,
                              budgetProgress.budget.endDate || new Date()
                            )
                        : undefined
                    }
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
