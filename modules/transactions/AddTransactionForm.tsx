'use client';

import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Button } from '@/shared/components/ui';
import Input from '@/shared/components/ui/Input';
import AccountSelect from '@/shared/components/ui/AccountSelect';
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
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
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
    setShowCategoryDropdown(false);
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

      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
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

      {/* Account Selector */}
      <AccountSelect
        accounts={accounts}
        value={selectedAccountId}
        onChange={handleAccountChange}
        disabled={loading}
        required
      />

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
            onChange: (e) => handleDescriptionChange(e.target.value),
          })}
          error={errors.description?.message}
          disabled={loading}
        />
      </div>

      {/* Category - Custom dropdown with icons */}
      <div className="relative">
        <input type="hidden" {...register('categoryId', { required: 'Category is required' })} />
        <label className="text-xs font-medium mb-1.5 block">Category</label>
        <button
          type="button"
          onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
          className={cn(
            "flex h-9 w-full items-center justify-between rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
            errors.categoryId ? "border-destructive" : "border-input"
          )}
          disabled={loading}
        >
          {selectedCategoryId ? (
            <div className="flex items-center gap-2">
              {(() => {
                const cat = filteredCategories.find(c => c.id === selectedCategoryId);
                if (!cat) return 'Select category';
                const IconComponent = CATEGORY_ICONS[cat.icon as keyof typeof CATEGORY_ICONS] || MoreHorizontal;
                return (
                  <>
                    <div
                      className="w-5 h-5 rounded flex items-center justify-center"
                      style={{ backgroundColor: `${cat.color}20` }}
                    >
                      <IconComponent className="h-3 w-3" style={{ color: cat.color }} />
                    </div>
                    <span>{cat.name}</span>
                  </>
                );
              })()}
            </div>
          ) : (
            <span className="text-muted-foreground">Select category</span>
          )}
          <svg
            className={cn("h-4 w-4 transition-transform", showCategoryDropdown && "rotate-180")}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Dropdown menu */}
        {showCategoryDropdown && (
          <div className="absolute z-10 mt-1 w-full rounded-md border border-border bg-background shadow-lg max-h-60 overflow-auto">
            {filteredCategories.map((cat) => {
              const IconComponent = CATEGORY_ICONS[cat.icon as keyof typeof CATEGORY_ICONS] || MoreHorizontal;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => handleCategorySelect(cat.id)}
                  className={cn(
                    "flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-muted transition-colors",
                    selectedCategoryId === cat.id && "bg-muted"
                  )}
                >
                  <div
                    className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${cat.color}20` }}
                  >
                    <IconComponent className="h-4 w-4" style={{ color: cat.color }} />
                  </div>
                  <span>{cat.name}</span>
                </button>
              );
            })}
          </div>
        )}

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

      {/* Fee (optional) */}
      <div>
        <label className="text-xs font-medium mb-1.5 block">Fee (Optional)</label>
        <Input
          type="number"
          step="0.01"
          min="0"
          placeholder={`0.00 (${currencySymbol})`}
          {...register('fee', {
            min: { value: 0, message: 'Fee must be 0 or greater' },
          })}
          error={errors.fee?.message}
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
    </>
  );
}
