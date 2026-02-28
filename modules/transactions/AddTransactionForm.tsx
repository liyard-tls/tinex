'use client';

import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Button } from '@/shared/components/ui';
import Input from '@/shared/components/ui/Input';
import { CreateTransactionInput, TransactionType, Account, Category, Tag, Transaction } from '@/core/models';
import { categoryRepository } from '@/core/repositories/CategoryRepository';
import { tagRepository } from '@/core/repositories/TagRepository';
import { transactionRepository } from '@/core/repositories/TransactionRepository';
import { CURRENCIES } from '@/core/models/account';
import { cn } from '@/shared/utils/cn';
import { X, MoreHorizontal } from 'lucide-react';
import { createPortal } from 'react-dom';
import { CATEGORY_ICONS } from '@/shared/config/icons';
import { detectCategoryFromDescription, matchCategoryByName } from '@/shared/utils/categoryMatcher';
import Toast from '@/shared/components/ui/Toast';

export const ADD_TRANSACTION_FORM_ID = 'add-transaction-form';

interface AddTransactionFormProps {
  onSubmit: (data: CreateTransactionInput, currency: string) => Promise<void>;
  onCancel: () => void;
  accounts: Account[];
  onLoadingChange?: (loading: boolean) => void;
}

export default function AddTransactionForm({ onSubmit, onCancel, accounts, onLoadingChange }: AddTransactionFormProps) {
  const [loading, setLoading] = useState(false);
  useEffect(() => { onLoadingChange?.(loading); }, [loading, onLoadingChange]);

  const [type, setType] = useState<TransactionType>('expense');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [selectedCurrency, setSelectedCurrency] = useState<string>('USD');
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [existingTransactions, setExistingTransactions] = useState<Transaction[]>([]);
  const [categoryManuallySelected, setCategoryManuallySelected] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm<CreateTransactionInput & { time?: string }>();

  // Load categories, tags and existing transactions
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          const [userCategories, userTags, userTransactions] = await Promise.all([
            categoryRepository.getByUserId(currentUser.uid),
            tagRepository.getByUserId(currentUser.uid),
            transactionRepository.getByUserId(currentUser.uid),
          ]);
          setCategories(userCategories);
          setTags(userTags);
          setExistingTransactions(userTransactions);
        } catch (error) {
          console.error('Failed to load categories and tags:', error);
        }
      }
    });

    return () => unsubscribe();
  }, []);

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

  // Auto-suggest category based on description
  const handleDescriptionChange = useCallback((description: string) => {
    // Only auto-suggest if user hasn't manually selected a category
    if (categoryManuallySelected || !description || description.length < 3) {
      return;
    }

    // Only suggest for income/expense, not transfer
    if (type !== 'income' && type !== 'expense') {
      return;
    }

    // First try to match by category name (higher priority for direct name matches)
    let suggestedCategoryId = matchCategoryByName(
      description,
      categories,
      type
    );

    // If no match from category names, try to match by existing transactions
    if (!suggestedCategoryId) {
      suggestedCategoryId = detectCategoryFromDescription(
        description,
        type,
        existingTransactions
      );
    }

    if (suggestedCategoryId) {
      setSelectedCategoryId(suggestedCategoryId);
      setValue('categoryId', suggestedCategoryId, { shouldValidate: true });
    }
  }, [categoryManuallySelected, type, existingTransactions, categories, setValue]);

  // Handle manual category selection
  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategoryId(categoryId);
    setValue('categoryId', categoryId, { shouldValidate: true });
    setCategoryManuallySelected(true);
  };

  const handleFormSubmit = async (data: any) => {
    setLoading(true);
    try {
      // Combine date and time
      const dateStr = data.date;
      const timeStr = data.time || '00:00';
      const dateTime = new Date(`${dateStr}T${timeStr}`);

      await onSubmit(
        {
          ...data,
          accountId: selectedAccountId,
          type,
          amount: Math.abs(Number(data.amount)),
          date: dateTime,
          tags: selectedTags,
          fee: data.fee ? Math.abs(Number(data.fee)) : undefined,
        },
        selectedCurrency
      );

      // Show success message (Toast component handles auto-close)
      setSuccessMessage('Transaction added successfully!');

      // Reset form but keep account selected
      const currentAccount = selectedAccountId;
      const currentCurrency = selectedCurrency;
      reset();
      setSelectedTags([]);
      setSelectedCategoryId('');
      setCategoryManuallySelected(false);
      setSelectedAccountId(currentAccount);
      setSelectedCurrency(currentCurrency);
      setValue('accountId', currentAccount);

      // Set default date and time for next transaction
      // Note: form expects string format for date input, but type expects Date
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setValue('date', new Date().toISOString().split('T')[0] as any);
      setValue('time', new Date().toTimeString().slice(0, 5));

      // Reload transactions for better category suggestions
      const currentUser = auth.currentUser;
      if (currentUser) {
        const updatedTransactions = await transactionRepository.getByUserId(currentUser.uid);
        setExistingTransactions(updatedTransactions);
      }
    } catch (error) {
      console.error('Failed to add transaction:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleTag = (tagId: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const filteredCategories = categories.filter((cat) => cat.type === type);
  const currencySymbol = CURRENCIES.find((c) => c.value === selectedCurrency)?.symbol || '$';

  // Sort accounts and categories by usage frequency (last 30 days)
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recentTxns = existingTransactions.filter(
    (t) => (t.date instanceof Date ? t.date : (t.date as any).toDate?.() ?? new Date(t.date as any)).getTime() >= thirtyDaysAgo
  );

  const accountUsage: Record<string, number> = {};
  const categoryUsage: Record<string, number> = {};
  for (const t of recentTxns) {
    accountUsage[t.accountId] = (accountUsage[t.accountId] ?? 0) + 1;
    if (t.categoryId) categoryUsage[t.categoryId] = (categoryUsage[t.categoryId] ?? 0) + 1;
  }

  const sortedAccounts = [...accounts].sort((a, b) => (accountUsage[b.id] ?? 0) - (accountUsage[a.id] ?? 0));
  const sortedCategories = [...filteredCategories].sort((a, b) => (categoryUsage[b.id] ?? 0) - (categoryUsage[a.id] ?? 0));

  return (
    <>
      {/* Success Notification - Rendered via portal outside the form */}
      {successMessage && typeof document !== 'undefined' && createPortal(
        <Toast
          message={successMessage}
          type="success"
          onClose={() => setSuccessMessage(null)}
        />,
        document.body
      )}

      <form id={ADD_TRANSACTION_FORM_ID} onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
        {/* Type Toggle */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            setType('expense');
            setCategoryManuallySelected(false);
            setSelectedCategoryId('');
          }}
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
          onClick={() => {
            setType('income');
            setCategoryManuallySelected(false);
            setSelectedCategoryId('');
          }}
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

      {/* Account Gallery */}
      <div>
        <label className="text-xs font-medium mb-2 block">Account</label>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {sortedAccounts.map((acc) => {
            const IconComponent = CATEGORY_ICONS[acc.icon as keyof typeof CATEGORY_ICONS] || MoreHorizontal;
            const isSelected = selectedAccountId === acc.id;
            const color = acc.color || '#6b7280';
            return (
              <button
                key={acc.id}
                type="button"
                onClick={() => handleAccountChange(acc.id)}
                disabled={loading}
                className={cn(
                  'flex-shrink-0 flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-xl border transition-all',
                  'min-w-[72px] text-center',
                  isSelected
                    ? 'border-transparent shadow-sm'
                    : 'border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06]'
                )}
                style={isSelected ? { backgroundColor: `${color}22`, borderColor: `${color}60` } : {}}
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: `${color}22` }}
                >
                  <IconComponent className="h-4 w-4" style={{ color }} />
                </div>
                <span className="text-xs font-medium leading-tight truncate max-w-[64px]">{acc.name}</span>
                <span className="text-[10px] text-muted-foreground leading-none">
                  {CURRENCIES.find(c => c.value === acc.currency)?.symbol || acc.currency}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Amount + Fee */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs font-medium mb-1.5 block">Amount ({currencySymbol})</label>
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
        <div>
          <label className="text-xs font-medium mb-1.5 block">Fee ({currencySymbol})</label>
          <Input
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            {...register('fee', {
              min: { value: 0, message: 'Fee must be 0 or greater' },
            })}
            error={errors.fee?.message}
            disabled={loading}
          />
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="text-xs font-medium mb-1.5 block">Description</label>
        <Input
          type="text"
          placeholder="e.g., Grocery shopping"
          {...register('description', {
            required: 'Description is required',
            onChange: (e) => handleDescriptionChange(e.target.value),
          })}
          error={errors.description?.message}
          disabled={loading}
        />
      </div>

      {/* Category Gallery */}
      <div>
        <input type="hidden" {...register('categoryId', { required: 'Category is required' })} />
        <label className="text-xs font-medium mb-2 block">Category</label>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {sortedCategories.map((cat) => {
            const IconComponent = CATEGORY_ICONS[cat.icon as keyof typeof CATEGORY_ICONS] || MoreHorizontal;
            const isSelected = selectedCategoryId === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => handleCategorySelect(cat.id)}
                disabled={loading}
                className={cn(
                  'flex-shrink-0 flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-xl border transition-all',
                  'min-w-[64px] text-center',
                  isSelected
                    ? 'border-transparent shadow-sm'
                    : 'border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06]'
                )}
                style={isSelected ? { backgroundColor: `${cat.color}22`, borderColor: `${cat.color}60` } : {}}
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: `${cat.color}22` }}
                >
                  <IconComponent className="h-4 w-4" style={{ color: cat.color }} />
                </div>
                <span className="text-xs font-medium leading-tight truncate max-w-[56px]">{cat.name}</span>
              </button>
            );
          })}
        </div>
        {errors.categoryId && (
          <p className="mt-1 text-xs text-destructive">{errors.categoryId.message}</p>
        )}
      </div>

      {/* Tags */}
      {tags.length > 0 && (
        <div>
          <label className="text-xs font-medium mb-1.5 block">Tags (Optional)</label>
          <div className="flex flex-wrap gap-2 p-3 border border-input rounded-md bg-background min-h-[42px]">
            {tags.map((tag) => {
              const isSelected = selectedTags.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => handleToggleTag(tag.id)}
                  className={cn(
                    'px-3 py-1 rounded-full text-xs font-medium transition-all flex items-center gap-1',
                    isSelected ? 'ring-2 ring-offset-1 scale-105' : 'opacity-60 hover:opacity-100'
                  )}
                  style={{
                    backgroundColor: isSelected ? tag.color : `${tag.color}40`,
                    color: isSelected ? '#ffffff' : tag.color,
                  }}
                  disabled={loading}
                >
                  {tag.name}
                  {isSelected && <X className="h-3 w-3" />}
                </button>
              );
            })}
          </div>
          {selectedTags.length > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              {selectedTags.length} tag{selectedTags.length !== 1 ? 's' : ''} selected
            </p>
          )}
        </div>
      )}

      {/* Date and Time */}
      <div className="grid grid-cols-2 gap-2">
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
        <div>
          <label className="text-xs font-medium mb-1.5 block">Time</label>
          <Input
            type="time"
            {...register('time')}
            defaultValue={new Date().toTimeString().slice(0, 5)}
            disabled={loading}
          />
        </div>
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

      </form>
    </>
  );
}
