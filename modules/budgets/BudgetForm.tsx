/**
 * Budget Form Component
 * Form for creating and editing budgets
 */

'use client';

import { useState, useEffect } from 'react';
import { BudgetPeriod, Category, Budget } from '@/core/models';
import { budgetRepository } from '@/core/repositories/BudgetRepository';
import Button from '@/shared/components/ui/Button';
import CategorySelect from '@/shared/components/ui/CategorySelect';
import { BUDGET_PERIODS } from '@/shared/config/constants';
import { getCurrentPeriodDates, getPeriodLabel } from './budgetUtils';

interface BudgetFormProps {
  userId: string;
  currency: string;
  categories: Category[];
  budget?: Budget; // For editing
  onSuccess: () => void;
  onCancel: () => void;
}

export default function BudgetForm({
  userId,
  currency,
  categories,
  budget,
  onSuccess,
  onCancel,
}: BudgetFormProps) {
  const [categoryId, setCategoryId] = useState(budget?.categoryId || '');
  const [period, setPeriod] = useState<BudgetPeriod>(budget?.period || 'month');
  const [amount, setAmount] = useState(budget?.amount.toString() || '');
  const [alertThreshold, setAlertThreshold] = useState(
    budget?.alertThreshold?.toString() || '80'
  );
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Reset form when budget prop changes
  useEffect(() => {
    if (budget) {
      setCategoryId(budget.categoryId);
      setPeriod(budget.period);
      setAmount(budget.amount.toString());
      setAlertThreshold(budget.alertThreshold?.toString() || '80');
    }
  }, [budget]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!categoryId) {
      setError('Please select a category');
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    const numThreshold = parseFloat(alertThreshold);
    if (isNaN(numThreshold) || numThreshold < 0 || numThreshold > 100) {
      setError('Alert threshold must be between 0 and 100');
      return;
    }

    setLoading(true);

    try {
      // Check for duplicate category + period combination (except when editing the same budget)
      const exists = await budgetRepository.existsForCategoryAndPeriod(
        userId,
        categoryId,
        period,
        budget?.id // Exclude current budget when editing
      );

      if (exists) {
        const category = categories.find((c) => c.id === categoryId);
        setError(
          `A ${getPeriodLabel(period).toLowerCase()} budget for ${
            category?.name || 'this category'
          } already exists`
        );
        setLoading(false);
        return;
      }

      const periodDates = getCurrentPeriodDates(period);

      if (budget) {
        // Update existing budget
        await budgetRepository.update({
          id: budget.id,
          categoryId,
          period,
          amount: numAmount,
          startDate: periodDates.start,
          endDate: periodDates.end,
          alertThreshold: numThreshold,
        });
      } else {
        // Create new budget
        await budgetRepository.create(
          userId,
          {
            categoryId,
            period,
            amount: numAmount,
            startDate: periodDates.start,
            endDate: periodDates.end,
            alertThreshold: numThreshold,
          },
          currency
        );
      }

      onSuccess();
    } catch (err) {
      console.error('Failed to save budget:', err);
      setError('Failed to save budget. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-foreground mb-4">
          {budget ? 'Edit Budget' : 'Create Budget'}
        </h2>
      </div>

      {/* Category Selection */}
      <CategorySelect
        categories={categories}
        value={categoryId}
        onChange={setCategoryId}
        error={!categoryId && error ? 'Category is required' : undefined}
        disabled={loading}
        required
      />

      {/* Period Selection */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          Period
        </label>
        <div className="grid grid-cols-2 gap-2">
          {BUDGET_PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                period === p
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
              disabled={loading}
            >
              {getPeriodLabel(p)}
            </button>
          ))}
        </div>
      </div>

      {/* Amount Input */}
      <div>
        <label
          htmlFor="amount"
          className="block text-sm font-medium text-foreground mb-2"
        >
          Target Amount ({currency})
        </label>
        <input
          id="amount"
          type="number"
          step="0.01"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full px-3 py-2 bg-background border border-input rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="0.00"
          disabled={loading}
        />
      </div>

      {/* Alert Threshold - Hidden but logic preserved */}
      <input type="hidden" value={alertThreshold} />

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2 pt-2">
        <Button
          type="submit"
          className="flex-1"
          disabled={loading}
        >
          {loading ? 'Saving...' : budget ? 'Update Budget' : 'Create Budget'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={loading}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
