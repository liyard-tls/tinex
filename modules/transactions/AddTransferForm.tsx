'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { Button } from '@/shared/components/ui';
import Input from '@/shared/components/ui/Input';
import AccountSelect from '@/shared/components/ui/AccountSelect';
import { Account, Category, CURRENCIES, SYSTEM_CATEGORIES } from '@/core/models';
import { categoryRepository } from '@/core/repositories/CategoryRepository';
import { transactionRepository } from '@/core/repositories/TransactionRepository';
import { getExchangeRate } from '@/shared/services/currencyService';
import { cn } from '@/shared/utils/cn';
import Toast from '@/shared/components/ui/Toast';
import { createPortal } from 'react-dom';
import { ArrowRightLeft } from 'lucide-react';

interface TransferFormData {
  fromAccountId: string;
  fromAmount: string;
  toAccountId: string;
  toAmount: string;
  date: string;
  time: string;
  fee: string;
  notes: string;
}

interface AddTransferFormProps {
  onSuccess: () => Promise<void>;
  onCancel: () => void;
  accounts: Account[];
}

export default function AddTransferForm({ onSuccess, onCancel, accounts }: AddTransferFormProps) {
  const [loading, setLoading] = useState(false);
  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [autoFilledToAmount, setAutoFilledToAmount] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    reset,
  } = useForm<TransferFormData>({
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      time: new Date().toTimeString().slice(0, 5),
      fee: '',
      notes: '',
    },
  });

  const fromAmount = watch('fromAmount');

  // Load categories
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const cats = await categoryRepository.getByUserId(currentUser.uid);
        setCategories(cats);
      }
    });
    return () => unsubscribe();
  }, []);

  // Set default accounts
  useEffect(() => {
    if (accounts.length > 0) {
      const defaultAccount = accounts.find((a) => a.isDefault) || accounts[0];
      setFromAccountId(defaultAccount.id);
      setValue('fromAccountId', defaultAccount.id);

      const otherAccount = accounts.find((a) => a.id !== defaultAccount.id);
      if (otherAccount) {
        setToAccountId(otherAccount.id);
        setValue('toAccountId', otherAccount.id);
      }
    }
  }, [accounts, setValue]);

  // Auto-fill toAmount when fromAmount or accounts change (only for same currency)
  useEffect(() => {
    const fromAcc = accounts.find((a) => a.id === fromAccountId);
    const toAcc = accounts.find((a) => a.id === toAccountId);
    if (!fromAcc || !toAcc || !fromAmount) return;

    if (fromAcc.currency === toAcc.currency) {
      setValue('toAmount', fromAmount);
      setAutoFilledToAmount(true);
    } else if (autoFilledToAmount) {
      // Clear auto-filled value when currencies differ
      setValue('toAmount', '');
      setAutoFilledToAmount(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromAmount, fromAccountId, toAccountId]);

  const fromAccount = accounts.find((a) => a.id === fromAccountId);
  const toAccount = accounts.find((a) => a.id === toAccountId);
  const fromSymbol = CURRENCIES.find((c) => c.value === fromAccount?.currency)?.symbol || '';
  const toSymbol = CURRENCIES.find((c) => c.value === toAccount?.currency)?.symbol || '';

  const handleFormSubmit = async (data: TransferFormData) => {
    if (!fromAccountId || !toAccountId) return;
    if (fromAccountId === toAccountId) return;

    const fromAcc = accounts.find((a) => a.id === fromAccountId);
    const toAcc = accounts.find((a) => a.id === toAccountId);
    if (!fromAcc || !toAcc) return;

    setLoading(true);
    try {
      const dateTime = new Date(`${data.date}T${data.time}`);

      const transferOutCategory = categories.find((c) => c.name === SYSTEM_CATEGORIES.TRANSFER_OUT);
      const transferInCategory = categories.find((c) => c.name === SYSTEM_CATEGORIES.TRANSFER_IN);

      if (!transferOutCategory || !transferInCategory) {
        console.error('Transfer categories not found');
        return;
      }

      const fromAmount = Math.abs(Number(data.fromAmount));
      const toAmount = Math.abs(Number(data.toAmount));
      const fee = data.fee ? Math.abs(Number(data.fee)) : undefined;

      // Generate a shared pairId to link both transactions
      const pairId = crypto.randomUUID();

      // Fetch exchange rates for both accounts relative to a common base
      const fromExchangeRate = await getExchangeRate(fromAcc.currency, 'USD');
      const toExchangeRate = await getExchangeRate(toAcc.currency, 'USD');

      // Create Transfer Out transaction
      await transactionRepository.create(
        auth.currentUser!.uid,
        {
          accountId: fromAccountId,
          type: 'expense',
          amount: fromAmount,
          description: `To ${toAcc.name}`,
          date: dateTime,
          categoryId: transferOutCategory.id,
          tags: [],
          notes: data.notes || undefined,
          fee,
          exchangeRate: fromExchangeRate,
          pairId,
        },
        fromAcc.currency
      );

      // Create Transfer In transaction
      await transactionRepository.create(
        auth.currentUser!.uid,
        {
          accountId: toAccountId,
          type: 'income',
          amount: toAmount,
          description: `From ${fromAcc.name}`,
          date: dateTime,
          categoryId: transferInCategory.id,
          tags: [],
          notes: data.notes || undefined,
          exchangeRate: toExchangeRate,
          pairId,
        },
        toAcc.currency
      );

      setSuccessMessage('Transfer added successfully!');
      reset({
        date: new Date().toISOString().split('T')[0],
        time: new Date().toTimeString().slice(0, 5),
        fee: '',
        notes: '',
        fromAmount: '',
        toAmount: '',
      });
      setAutoFilledToAmount(false);

      await onSuccess();
    } catch (error) {
      console.error('Failed to create transfer:', error);
    } finally {
      setLoading(false);
    }
  };

  const sameCurrency = fromAccount?.currency === toAccount?.currency;

  return (
    <>
      {successMessage && typeof document !== 'undefined' && createPortal(
        <Toast message={successMessage} type="success" onClose={() => setSuccessMessage(null)} />,
        document.body
      )}

      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">

        {/* From account */}
        <div>
          <label className="text-xs font-medium mb-1.5 block">From Account</label>
          <AccountSelect
            accounts={accounts}
            value={fromAccountId}
            onChange={(id) => {
              setFromAccountId(id);
              setValue('fromAccountId', id);
            }}
            disabled={loading}
            required
          />
        </div>

        {/* From amount */}
        <div>
          <label className="text-xs font-medium mb-1.5 block">
            Amount Sent {fromSymbol ? `(${fromSymbol})` : ''}
          </label>
          <Input
            type="number"
            step="0.01"
            placeholder="0.00"
            {...register('fromAmount', {
              required: 'Amount is required',
              min: { value: 0.01, message: 'Amount must be greater than 0' },
            })}
            error={errors.fromAmount?.message}
            disabled={loading}
          />
        </div>

        {/* Arrow divider */}
        <div className="flex items-center justify-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <div className={cn(
            'w-8 h-8 rounded-full flex items-center justify-center',
            sameCurrency ? 'bg-primary/10' : 'bg-amber-500/10'
          )}>
            <ArrowRightLeft className={cn('h-4 w-4', sameCurrency ? 'text-primary' : 'text-amber-500')} />
          </div>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* To account */}
        <div>
          <label className="text-xs font-medium mb-1.5 block">To Account</label>
          <AccountSelect
            accounts={accounts.filter((a) => a.id !== fromAccountId)}
            value={toAccountId}
            onChange={(id) => {
              setToAccountId(id);
              setValue('toAccountId', id);
            }}
            disabled={loading}
            required
          />
        </div>

        {/* To amount */}
        <div>
          <label className="text-xs font-medium mb-1.5 block">
            Amount Received {toSymbol ? `(${toSymbol})` : ''}
            {!sameCurrency && (
              <span className="ml-1 text-amber-500 font-normal">· different currency</span>
            )}
          </label>
          <Input
            type="number"
            step="0.01"
            placeholder="0.00"
            {...register('toAmount', {
              required: 'Amount is required',
              min: { value: 0.01, message: 'Amount must be greater than 0' },
            })}
            error={errors.toAmount?.message}
            disabled={loading}
          />
        </div>

        {/* Date and Time */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs font-medium mb-1.5 block">Date</label>
            <Input
              type="date"
              {...register('date', { required: 'Date is required' })}
              error={errors.date?.message}
              disabled={loading}
            />
          </div>
          <div>
            <label className="text-xs font-medium mb-1.5 block">Time</label>
            <Input type="time" {...register('time')} disabled={loading} />
          </div>
        </div>

        {/* Fee */}
        <div>
          <label className="text-xs font-medium mb-1.5 block">
            Fee (Optional) {fromSymbol ? `(${fromSymbol})` : ''}
          </label>
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

        {/* Notes */}
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
          <Button type="button" variant="outline" className="flex-1" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" className="flex-1" isLoading={loading} disabled={loading || fromAccountId === toAccountId}>
            Add Transfer
          </Button>
        </div>
      </form>
    </>
  );
}
