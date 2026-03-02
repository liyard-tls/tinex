'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/shared/components/ui';
import Input from '@/shared/components/ui/Input';
import {
  CreateScheduledTransactionInput,
  TransactionType,
  Account,
  Category,
  Tag,
  RecurrenceType,
  RECURRENCE_LABELS,
  ScheduledTransaction,
} from '@/core/models';
import { CURRENCIES } from '@/core/models/account';
import { cn } from '@/shared/utils/cn';
import { X, MoreHorizontal } from 'lucide-react';
import { CATEGORY_ICONS } from '@/shared/config/icons';

export const ADD_SCHEDULED_FORM_ID = 'add-scheduled-form';

interface AddScheduledFormProps {
  onSubmit: (data: CreateScheduledTransactionInput, currency: string) => Promise<void>;
  onCancel: () => void;
  accounts: Account[];
  categories: Category[];
  tags: Tag[];
  initialData?: ScheduledTransaction;
  onLoadingChange?: (loading: boolean) => void;
}

const RECURRENCES: RecurrenceType[] = ['once', 'daily', 'weekly', 'monthly', 'yearly'];

export default function AddScheduledForm({
  onSubmit,
  onCancel,
  accounts,
  categories,
  tags,
  initialData,
  onLoadingChange,
}: AddScheduledFormProps) {
  const [loading, setLoading] = useState(false);
  useEffect(() => { onLoadingChange?.(loading); }, [loading, onLoadingChange]);

  const [type, setType] = useState<TransactionType>(initialData?.type || 'expense');
  const [selectedAccountId, setSelectedAccountId] = useState<string>(initialData?.accountId || '');
  const [selectedCurrency, setSelectedCurrency] = useState<string>(initialData?.currency || 'USD');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(initialData?.categoryId || '');
  const [selectedTags, setSelectedTags] = useState<string[]>(initialData?.tags || []);
  const [recurrence, setRecurrence] = useState<RecurrenceType>(initialData?.recurrence || 'monthly');

  const { register, handleSubmit, formState: { errors }, setValue } = useForm<
    Omit<CreateScheduledTransactionInput, 'nextDate' | 'endDate' | 'recurrence'> & {
      nextDate: string;
      endDate?: string;
    }
  >();

  // Set default account
  useEffect(() => {
    if (accounts.length > 0 && !selectedAccountId) {
      const def = accounts.find((a) => a.isDefault) || accounts[0];
      setSelectedAccountId(def.id);
      setSelectedCurrency(def.currency);
      setValue('accountId', def.id);
    }
  }, [accounts, selectedAccountId, setValue]);

  const handleAccountChange = (accountId: string) => {
    setSelectedAccountId(accountId);
    const acc = accounts.find((a) => a.id === accountId);
    if (acc) setSelectedCurrency(acc.currency);
  };

  const handleFormSubmit = async (data: any) => {
    if (!selectedCategoryId) return;
    setLoading(true);
    try {
      const nextDate = new Date(data.nextDate + 'T00:00:00');
      const endDate = data.endDate ? new Date(data.endDate + 'T00:00:00') : undefined;

      await onSubmit(
        {
          accountId: selectedAccountId,
          type,
          amount: Math.abs(Number(data.amount)),
          description: data.description,
          categoryId: selectedCategoryId,
          tags: selectedTags,
          fee: data.fee ? Math.abs(Number(data.fee)) : undefined,
          nextDate,
          recurrence,
          endDate,
        },
        selectedCurrency,
      );
    } catch (error) {
      console.error('Failed to save scheduled transaction:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCategories = categories.filter((c) => c.type === type);
  const currencySymbol = CURRENCIES.find((c) => c.value === selectedCurrency)?.symbol || '$';
  const today = new Date().toISOString().split('T')[0];

  return (
    <form id={ADD_SCHEDULED_FORM_ID} onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      {/* Type Toggle */}
      <div className="flex gap-2">
        {(['expense', 'income'] as TransactionType[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => { setType(t); setSelectedCategoryId(''); }}
            className={cn(
              'flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors capitalize',
              type === t
                ? t === 'expense'
                  ? 'bg-destructive text-destructive-foreground'
                  : 'bg-success text-success-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80',
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Account Gallery */}
      <div>
        <label className="text-xs font-medium mb-2 block">Account</label>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {accounts.map((acc) => {
            const Icon = CATEGORY_ICONS[acc.icon as keyof typeof CATEGORY_ICONS] || MoreHorizontal;
            const isSelected = selectedAccountId === acc.id;
            const color = acc.color || '#6b7280';
            return (
              <button
                key={acc.id}
                type="button"
                onClick={() => handleAccountChange(acc.id)}
                disabled={loading}
                className={cn(
                  'flex-shrink-0 flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-xl border transition-all min-w-[72px] text-center',
                  isSelected ? 'border-transparent shadow-sm' : 'border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06]',
                )}
                style={isSelected ? { backgroundColor: `${color}22`, borderColor: `${color}60` } : {}}
              >
                <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: `${color}22` }}>
                  <Icon className="h-4 w-4" style={{ color }} />
                </div>
                <span className="text-xs font-medium leading-tight truncate max-w-[64px]">{acc.name}</span>
                <span className="text-[10px] text-muted-foreground leading-none">
                  {CURRENCIES.find((c) => c.value === acc.currency)?.symbol || acc.currency}
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
            type="number" step="0.01" placeholder="0.00"
            defaultValue={initialData?.amount}
            {...register('amount', { required: 'Amount is required', min: { value: 0.01, message: 'Must be > 0' } })}
            error={errors.amount?.message}
            disabled={loading}
          />
        </div>
        <div>
          <label className="text-xs font-medium mb-1.5 block">Fee ({currencySymbol})</label>
          <Input
            type="number" step="0.01" min="0" placeholder="0.00"
            defaultValue={initialData?.fee}
            {...register('fee')}
            disabled={loading}
          />
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="text-xs font-medium mb-1.5 block">Description</label>
        <Input
          type="text" placeholder="e.g., Netflix subscription"
          defaultValue={initialData?.description}
          {...register('description', { required: 'Description is required' })}
          error={errors.description?.message}
          disabled={loading}
        />
      </div>

      {/* Category Gallery */}
      <div>
        <label className="text-xs font-medium mb-2 block">Category</label>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {filteredCategories.map((cat) => {
            const Icon = CATEGORY_ICONS[cat.icon as keyof typeof CATEGORY_ICONS] || MoreHorizontal;
            const isSelected = selectedCategoryId === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategoryId(cat.id)}
                disabled={loading}
                className={cn(
                  'flex-shrink-0 flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-xl border transition-all min-w-[64px] text-center',
                  isSelected ? 'border-transparent shadow-sm' : 'border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06]',
                )}
                style={isSelected ? { backgroundColor: `${cat.color}22`, borderColor: `${cat.color}60` } : {}}
              >
                <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: `${cat.color}22` }}>
                  <Icon className="h-4 w-4" style={{ color: cat.color }} />
                </div>
                <span className="text-xs font-medium leading-tight truncate max-w-[56px]">{cat.name}</span>
              </button>
            );
          })}
        </div>
        {!selectedCategoryId && (
          <p className="mt-1 text-xs text-destructive">Category is required</p>
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
                  onClick={() => setSelectedTags((prev) =>
                    prev.includes(tag.id) ? prev.filter((id) => id !== tag.id) : [...prev, tag.id]
                  )}
                  disabled={loading}
                  className={cn(
                    'px-3 py-1 rounded-full text-xs font-medium transition-all flex items-center gap-1',
                    isSelected ? 'ring-2 ring-offset-1 scale-105' : 'opacity-60 hover:opacity-100',
                  )}
                  style={{ backgroundColor: isSelected ? tag.color : `${tag.color}40`, color: isSelected ? '#fff' : tag.color }}
                >
                  {tag.name}
                  {isSelected && <X className="h-3 w-3" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Recurrence */}
      <div>
        <label className="text-xs font-medium mb-2 block">Repeat</label>
        <div className="flex gap-2 flex-wrap">
          {RECURRENCES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRecurrence(r)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                recurrence === r
                  ? 'bg-primary/20 border-primary/60 text-primary'
                  : 'border-white/[0.08] bg-white/[0.03] text-muted-foreground hover:bg-white/[0.06]',
              )}
            >
              {RECURRENCE_LABELS[r]}
            </button>
          ))}
        </div>
      </div>

      {/* First Date + End Date */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs font-medium mb-1.5 block">
            {recurrence === 'once' ? 'Date' : 'First Date'}
          </label>
          <Input
            type="date"
            defaultValue={initialData?.nextDate ? initialData.nextDate.toISOString().split('T')[0] : today}
            {...register('nextDate', { required: 'Date is required' })}
            error={errors.nextDate?.message}
            disabled={loading}
          />
        </div>
        {recurrence !== 'once' && (
          <div>
            <label className="text-xs font-medium mb-1.5 block">End Date (Optional)</label>
            <Input
              type="date"
              defaultValue={initialData?.endDate ? initialData.endDate.toISOString().split('T')[0] : undefined}
              {...register('endDate')}
              disabled={loading}
            />
          </div>
        )}
      </div>
    </form>
  );
}
