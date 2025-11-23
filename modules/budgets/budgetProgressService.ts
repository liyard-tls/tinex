/**
 * Budget Progress Service
 * Calculates budget progress by analyzing transactions
 */

import { Budget, BudgetProgress, Transaction, Currency } from '@/core/models';
import { transactionRepository } from '@/core/repositories/TransactionRepository';
import { convertCurrency } from '@/shared/services/currencyService';

/**
 * Calculate budget progress for a single budget
 */
export async function calculateBudgetProgress(
  budget: Budget,
  userId: string,
  userCurrency: Currency
): Promise<BudgetProgress> {
  // Get transactions for the budget period and category
  const transactions = await transactionRepository.getByDateRange(
    userId,
    budget.startDate,
    budget.endDate || new Date()
  );

  // Filter transactions by category and type (only expenses)
  const categoryTransactions = transactions.filter(
    (t) => t.categoryId === budget.categoryId && t.type === 'expense'
  );

  // Calculate total spent (convert to budget currency if needed)
  let totalSpent = 0;

  for (const transaction of categoryTransactions) {
    if (transaction.currency === userCurrency) {
      totalSpent += transaction.amount;
    } else {
      // Convert transaction amount to user currency
      const converted = await convertCurrency(
        transaction.amount,
        transaction.currency,
        userCurrency
      );
      totalSpent += converted;
    }
  }

  // Calculate progress
  const percentage = Math.round((totalSpent / budget.amount) * 100);
  const remaining = budget.amount - totalSpent;
  const isOverBudget = totalSpent > budget.amount;
  const shouldAlert = percentage >= budget.alertThreshold;

  return {
    budget,
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
