'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/shared/components/ui';
import Input from '@/shared/components/ui/Input';
import { CreateAccountInput, AccountType, Currency, ACCOUNT_TYPES, CURRENCIES } from '@/core/models';
import { cn } from '@/shared/utils/cn';

interface AddAccountFormProps {
  onSubmit: (data: CreateAccountInput) => Promise<void>;
  onCancel: () => void;
}

export default function AddAccountForm({ onSubmit, onCancel }: AddAccountFormProps) {
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<CreateAccountInput>();

  const handleFormSubmit = async (data: CreateAccountInput) => {
    setLoading(true);
    try {
      await onSubmit({
        ...data,
        balance: Number(data.balance),
      });
      reset();
    } catch (error) {
      console.error('Failed to add account:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      {/* Account Name */}
      <div>
        <label className="text-xs font-medium mb-1.5 block">Account Name</label>
        <Input
          type="text"
          placeholder="e.g., Main Bank Account"
          {...register('name', {
            required: 'Account name is required',
          })}
          error={errors.name?.message}
          disabled={loading}
        />
      </div>

      {/* Account Type */}
      <div>
        <label className="text-xs font-medium mb-1.5 block">Account Type</label>
        <select
          {...register('type', { required: 'Account type is required' })}
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          disabled={loading}
        >
          <option value="">Select type</option>
          {ACCOUNT_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
        {errors.type && (
          <p className="mt-1 text-xs text-destructive">{errors.type.message}</p>
        )}
      </div>

      {/* Currency */}
      <div>
        <label className="text-xs font-medium mb-1.5 block">Currency</label>
        <select
          {...register('currency', { required: 'Currency is required' })}
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          disabled={loading}
        >
          <option value="">Select currency</option>
          {CURRENCIES.map((currency) => (
            <option key={currency.value} value={currency.value}>
              {currency.symbol} - {currency.label}
            </option>
          ))}
        </select>
        {errors.currency && (
          <p className="mt-1 text-xs text-destructive">{errors.currency.message}</p>
        )}
      </div>

      {/* Initial Balance */}
      <div>
        <label className="text-xs font-medium mb-1.5 block">Initial Balance</label>
        <Input
          type="number"
          step="0.01"
          placeholder="0.00"
          {...register('balance', {
            required: 'Initial balance is required',
          })}
          error={errors.balance?.message}
          disabled={loading}
        />
      </div>

      {/* Default Account Checkbox */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="isDefault"
          {...register('isDefault')}
          className="h-4 w-4 rounded border-input"
          disabled={loading}
        />
        <label htmlFor="isDefault" className="text-sm">
          Set as default account
        </label>
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
          Create Account
        </Button>
      </div>
    </form>
  );
}
