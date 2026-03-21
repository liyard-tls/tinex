/**
 * Budget Progress Service
 * Calculates budget progress by analyzing transactions
 */

import { Budget, BudgetProgress, Currency } from '@/core/models';
import { transactionRepository } from '@/core/repositories/TransactionRepository';
import { convertMultipleCurrencies } from '@/shared/services/currencyService';
import { getCurrentPeriodDates } from './budgetUtils';

/**
 * Calculate budget progress for a single budget
 */
export async function calculateBudgetProgress(
  budget: Budget,
  userId: string,
  userCurrency: Currency
): Promise<BudgetProgress> {
  // Recalculate period dates based on current date
  // This ensures weekly/monthly budgets always show the current week/month
  const currentPeriod = getCurrentPeriodDates(budget.period);

  // Get transactions for the current period and category
  const transactions = await transactionRepository.getByDateRange(
    userId,
    currentPeriod.start,
    currentPeriod.end
  );

  // Filter transactions by category and type (only expenses)
  const categoryTransactions = transactions.filter(
    (t) => t.categoryId === budget.categoryId && t.type === 'expense'
  );

  // Calculate total spent (convert all to user currency in a single fetch)
  const totalSpent = await convertMultipleCurrencies(
    categoryTransactions.map((t) => ({ amount: t.amount, currency: t.currency })),
    userCurrency
  );

  // Calculate progress
  const percentage = Math.round((totalSpent / budget.amount) * 100);
  const remaining = budget.amount - totalSpent;
  const isOverBudget = totalSpent > budget.amount;
  const shouldAlert = percentage >= budget.alertThreshold;

  // Update budget with current period dates
  const updatedBudget = {
    ...budget,
    startDate: currentPeriod.start,
    endDate: currentPeriod.end,
  };

  return {
    budget: updatedBudget,
    spent: totalSpent,
    remaining,
    percentage,
    isOverBudget,
    shouldAlert,
  };
}

/**
 * Calculate progress for multiple budgets
 */
export async function calculateBudgetsProgress(
  budgets: Budget[],
  userId: string,
  userCurrency: Currency
): Promise<BudgetProgress[]> {
  const progressPromises = budgets.map((budget) =>
    calculateBudgetProgress(budget, userId, userCurrency)
  );

  return Promise.all(progressPromises);
}

/**
 * Calculate progress for budgets of a specific category
 */
export async function calculateCategoryBudgetsProgress(
  budgets: Budget[],
  categoryId: string,
  userId: string,
  userCurrency: Currency
): Promise<BudgetProgress[]> {
  const categoryBudgets = budgets.filter((b) => b.categoryId === categoryId);
  return calculateBudgetsProgress(categoryBudgets, userId, userCurrency);
}
