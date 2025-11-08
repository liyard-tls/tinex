'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/shared/components/ui';
import Input from '@/shared/components/ui/Input';
import { CreateTransactionInput, TransactionType, Account } from '@/core/models';
import { DEFAULT_CATEGORIES } from '@/core/models/category';
import { CURRENCIES } from '@/core/models/account';
import { cn } from '@/shared/utils/cn';

interface AddTransactionFormProps {
  onSubmit: (data: CreateTransactionInput, currency: string) => Promise<void>;
  onCancel: () => void;
  accounts: Account[];
}

export default function AddTransactionForm({ onSubmit, onCancel, accounts }: AddTransactionFormProps) {
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState<TransactionType>('expense');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [selectedCurrency, setSelectedCurrency] = useState<string>('USD');

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm<CreateTransactionInput>();

  // Set default account
  useEffect(() => {
    if (accounts.length > 0) {
      const defaultAccount = accounts.find((acc) => acc.isDefault) || accounts[0];
      setSelectedAccountId(defaultAccount.id);
      setSelectedCurrency(defaultAccount.currency);
      setValue('accountId', defaultAccount.id);
    }
  }, [accounts, setValue]);

  const handleAccountChange = (accountId: string) => {
    setSelectedAccountId(accountId);
    const account = accounts.find((acc) => acc.id === accountId);
    if (account) {
      setSelectedCurrency(account.currency);
    }
  };

  const handleFormSubmit = async (data: CreateTransactionInput) => {
    setLoading(true);
    try {
      await onSubmit(
        {
          ...data,
          accountId: selectedAccountId,
          type,
          amount: Math.abs(Number(data.amount)),
          date: new Date(data.date),
        },
        selectedCurrency
      );
      reset();
    } catch (error) {
      console.error('Failed to add transaction:', error);
    } finally {
      setLoading(false);
    }
  };

  const categories = DEFAULT_CATEGORIES.filter((cat) => cat.type === type);
  const currencySymbol = CURRENCIES.find((c) => c.value === selectedCurrency)?.symbol || '$';

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      {/* Type Toggle */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setType('expense')}
          className={cn(
            'flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors',
            type === 'expense'
              ? 'bg-destructive text-destructive-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          )}
        >
          Expense
        </button>
        <button
          type="button"
          onClick={() => setType('income')}
          className={cn(
            'flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors',
            type === 'income'
              ? 'bg-success text-success-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          )}
        >
          Income
        </button>
      </div>

      {/* Account Selector */}
      <div>
        <label className="text-xs font-medium mb-1.5 block">Account</label>
        <select
          value={selectedAccountId}
          onChange={(e) => handleAccountChange(e.target.value)}
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          disabled={loading || accounts.length === 0}
        >
          {accounts.length === 0 && <option value="">No accounts available</option>}
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name} ({account.currency})
            </option>
          ))}
        </select>
        {accounts.length === 0 && (
          <p className="mt-1 text-xs text-muted-foreground">
            Create an account first to add transactions
          </p>
        )}
      </div>

      {/* Amount */}
      <div>
        <label className="text-xs font-medium mb-1.5 block">
          Amount ({currencySymbol})
        </label>
        <Input
          type="number"
          step="0.01"
          placeholder="0.00"
          {...register('amount', {
            required: 'Amount is required',
            min: { value: 0.01, message: 'Amount must be greater than 0' },
          })}
          error={errors.amount?.message}
          disabled={loading || accounts.length === 0}
        />
      </div>

      {/* Description */}
      <div>
        <label className="text-xs font-medium mb-1.5 block">Description</label>
        <Input
          type="text"
          placeholder="e.g., Grocery shopping"
          {...register('description', {
            required: 'Description is required',
          })}
          error={errors.description?.message}
          disabled={loading}
        />
      </div>

      {/* Category */}
      <div>
        <label className="text-xs font-medium mb-1.5 block">Category</label>
        <select
          {...register('categoryId', { required: 'Category is required' })}
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          disabled={loading}
        >
          <option value="">Select category</option>
          {categories.map((cat, index) => (
            <option key={index} value={cat.name}>
              {cat.name}
            </option>
          ))}
        </select>
        {errors.categoryId && (
          <p className="mt-1 text-xs text-destructive">{errors.categoryId.message}</p>
        )}
      </div>

      {/* Date */}
      <div>
        <label className="text-xs font-medium mb-1.5 block">Date</label>
        <Input
          type="date"
          {...register('date', { required: 'Date is required' })}
          defaultValue={new Date().toISOString().split('T')[0]}
          error={errors.date?.message}
          disabled={loading}
        />
      </div>

      {/* Merchant (optional) */}
      <div>
        <label className="text-xs font-medium mb-1.5 block">Merchant (Optional)</label>
        <Input
          type="text"
          placeholder="e.g., Walmart"
          {...register('merchantName')}
          disabled={loading}
        />
      </div>

      {/* Notes (optional) */}
      <div>
        <label className="text-xs font-medium mb-1.5 block">Notes (Optional)</label>
        <textarea
          {...register('notes')}
          placeholder="Add any additional notes..."
          className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          disabled={loading}
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={onCancel}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button type="submit" className="flex-1" isLoading={loading} disabled={loading}>
          Add Transaction
        </Button>
      </div>
    </form>
  );
}
