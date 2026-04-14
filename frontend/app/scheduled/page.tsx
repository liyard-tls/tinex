'use client';

import { useState, useCallback } from 'react';
import { Plus, Play, Trash2, Pencil, CalendarClock, Loader2, MoreHorizontal, RefreshCw } from 'lucide-react';
import BottomNav from '@/shared/components/layout/BottomNav';
import PageHeader from '@/shared/components/layout/PageHeader';
import { Card, CardContent } from '@/shared/components/ui/Card';
import BottomSheet from '@/shared/components/ui/BottomSheet';
import { Button } from '@/shared/components/ui';
import { useAuth } from '@/app/_providers/AuthProvider';
import { useAppData } from '@/app/_providers/AppDataProvider';
import {
  ScheduledTransaction,
  CreateScheduledTransactionInput,
  RECURRENCE_LABELS,
} from '@/core/models';
import { scheduledTransactionRepository, advanceNextDate } from '@/core/repositories/ScheduledTransactionRepository';
import { transactionRepository } from '@/core/repositories/TransactionRepository';
import { CATEGORY_ICONS } from '@/shared/config/icons';
import { cn } from '@/shared/utils/cn';
import AddScheduledForm, { ADD_SCHEDULED_FORM_ID } from '@/modules/transactions/AddScheduledForm';

export default function ScheduledPage() {
  const { user } = useAuth();
  const {
    scheduledTransactions,
    accounts,
    categories,
    tags,
    refreshScheduledTransactions,
    refreshTransactions,
    refreshAccounts,
  } = useAppData();

  const [showSheet, setShowSheet] = useState(false);
  const [editingItem, setEditingItem] = useState<ScheduledTransaction | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleAdd = async (data: CreateScheduledTransactionInput, currency: string) => {
    if (!user) return;
    await scheduledTransactionRepository.create(user.uid, data, currency);
    await refreshScheduledTransactions();
    setShowSheet(false);
    setEditingItem(null);
  };

  const handleEdit = async (data: CreateScheduledTransactionInput) => {
    if (!user || !editingItem) return;
    await scheduledTransactionRepository.update({
      id: editingItem.id,
      ...data,
    });
    await refreshScheduledTransactions();
    setShowSheet(false);
    setEditingItem(null);
  };

  const openEdit = (s: ScheduledTransaction) => {
    setEditingItem(s);
    setShowSheet(true);
  };

  const handleDelete = async (s: ScheduledTransaction) => {
    setDeletingId(s.id);
    try {
      await scheduledTransactionRepository.delete(s.id);
      await refreshScheduledTransactions();
    } catch (e) {
      console.error('Failed to delete scheduled transaction', e);
    } finally {
      setDeletingId(null);
    }
  };

  const handleExecute = useCallback(async (s: ScheduledTransaction) => {
    if (!user) return;
    setExecutingId(s.id);
    try {
      // Create the real transaction
      await transactionRepository.create(
        user.uid,
        {
          accountId: s.accountId,
          type: s.type,
          amount: s.amount,
          description: s.description,
          categoryId: s.categoryId,
          date: new Date(),
          tags: s.tags,
          fee: s.fee,
        },
        s.currency,
      );

      if (s.recurrence === 'once') {
        await scheduledTransactionRepository.update({ id: s.id, isActive: false, lastExecutedAt: new Date() });
      } else {
        const nextDate = advanceNextDate(s.nextDate, s.recurrence);
        const expired = s.endDate ? nextDate > s.endDate : false;
        await scheduledTransactionRepository.update({
          id: s.id,
          nextDate,
          isActive: !expired,
          lastExecutedAt: new Date(),
        });
      }

      await Promise.all([refreshTransactions(), refreshAccounts(), refreshScheduledTransactions()]);
    } catch (e) {
      console.error('Failed to execute scheduled transaction', e);
    } finally {
      setExecutingId(null);
    }
  }, [user, refreshTransactions, refreshAccounts, refreshScheduledTransactions]);

  if (!user) return null;

  const overdue = scheduledTransactions.filter((s) => s.nextDate < new Date());
  const upcoming = scheduledTransactions.filter((s) => s.nextDate >= new Date());

  return (
    <div className="min-h-screen bg-background pb-24">
      <PageHeader
        title="Scheduled"
        description="Recurring and future transactions"
        rightElement={
          <Button
            variant="ghost"
            onClick={() => { setEditingItem(null); setShowSheet(true); }}
            className="text-muted-foreground hover:text-foreground"
          >
            <Plus className="h-4 w-4" />
          </Button>
        }
      />

      <main className="container max-w-screen-2xl px-4 py-5 space-y-5">

        {scheduledTransactions.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <CalendarClock className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground mb-1">No scheduled transactions</p>
              <p className="text-xs text-muted-foreground/60 mb-4">
                Create recurring payments or reminders for future expenses
              </p>
              <Button onClick={() => setShowSheet(true)} size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Add Scheduled
              </Button>
            </CardContent>
          </Card>
        )}

        {overdue.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-destructive uppercase tracking-wider px-0.5 mb-2">Overdue</p>
            <div className="space-y-2">
              {overdue.map((s) => (
                <ScheduledItem
                  key={s.id}
                  item={s}
                  categories={categories}
                  accounts={accounts}
                  executingId={executingId}
                  deletingId={deletingId}
                  onExecute={handleExecute}
                  onEdit={openEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </div>
        )}

        {upcoming.length > 0 && (
          <div>
            {overdue.length > 0 && (
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-0.5 mb-2">Upcoming</p>
            )}
            <div className="space-y-2">
              {upcoming.map((s) => (
                <ScheduledItem
                  key={s.id}
                  item={s}
                  categories={categories}
                  accounts={accounts}
                  executingId={executingId}
                  deletingId={deletingId}
                  onExecute={handleExecute}
                  onEdit={openEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Add / Edit Sheet */}
      <BottomSheet
        open={showSheet}
        onClose={() => { setShowSheet(false); setEditingItem(null); }}
        title={editingItem ? 'Edit Scheduled' : 'New Scheduled Transaction'}
        footer={
          <Button
            type="submit"
            form={ADD_SCHEDULED_FORM_ID}
            className="w-full"
            disabled={formLoading}
          >
            {formLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {editingItem ? 'Save Changes' : 'Schedule'}
          </Button>
        }
      >
        <AddScheduledForm
          onSubmit={editingItem ? handleEdit : handleAdd}
          onCancel={() => { setShowSheet(false); setEditingItem(null); }}
          accounts={accounts}
          categories={categories}
          tags={tags}
          initialData={editingItem ?? undefined}
          onLoadingChange={setFormLoading}
        />
      </BottomSheet>

      <BottomNav />
    </div>
  );
}

// ── Sub-component ────────────────────────────────────────────────────────────

interface ScheduledItemProps {
  item: ScheduledTransaction;
  categories: ReturnType<typeof useAppData>['categories'];
  accounts: ReturnType<typeof useAppData>['accounts'];
  executingId: string | null;
  deletingId: string | null;
  onExecute: (s: ScheduledTransaction) => Promise<void>;
  onEdit: (s: ScheduledTransaction) => void;
  onDelete: (s: ScheduledTransaction) => void;
}

function ScheduledItem({ item, categories, accounts, executingId, deletingId, onExecute, onEdit, onDelete }: ScheduledItemProps) {
  const category = categories.find((c) => c.id === item.categoryId);
  const account = accounts.find((a) => a.id === item.accountId);
  const Icon = category?.icon
    ? CATEGORY_ICONS[category.icon as keyof typeof CATEGORY_ICONS] || MoreHorizontal
    : MoreHorizontal;
  const color = category?.color || '#6b7280';
  const isOverdue = item.nextDate < new Date();
  const isExecuting = executingId === item.id;
  const isDeleting = deletingId === item.id;

  const nextLabel = item.nextDate.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex items-center gap-3 px-4 py-3">
          {/* Icon */}
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${color}22` }}
          >
            <Icon className="h-5 w-5" style={{ color }} />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{item.description}</p>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <span className={cn('text-xs', isOverdue ? 'text-destructive' : 'text-muted-foreground')}>
                {nextLabel}
              </span>
              <span className="text-muted-foreground/40 text-xs">·</span>
              <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
                {item.recurrence !== 'once' && <RefreshCw className="h-2.5 w-2.5" />}
                {RECURRENCE_LABELS[item.recurrence]}
              </span>
              {account && (
                <>
                  <span className="text-muted-foreground/40 text-xs">·</span>
                  <span className="text-xs text-muted-foreground truncate">{account.name}</span>
                </>
              )}
            </div>
          </div>

          {/* Amount */}
          <div className="text-right flex-shrink-0">
            <p className={cn('text-sm font-semibold', item.type === 'income' ? 'text-success' : 'text-destructive')}>
              {item.type === 'income' ? '+' : '-'}{item.amount.toLocaleString()} {item.currency}
            </p>
            {item.fee && item.fee > 0 && (
              <p className="text-xs text-muted-foreground">fee {item.fee} {item.currency}</p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 px-4 pb-3 border-t border-white/[0.05] pt-2">
          <button
            onClick={() => onExecute(item)}
            disabled={isExecuting || isDeleting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-xs font-medium text-primary transition-colors disabled:opacity-50"
          >
            {isExecuting
              ? <Loader2 className="h-3 w-3 animate-spin" />
              : <Play className="h-3 w-3" />
            }
            Execute
          </button>
          <button
            onClick={() => onEdit(item)}
            disabled={isExecuting || isDeleting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-xs font-medium text-muted-foreground transition-colors disabled:opacity-50"
          >
            <Pencil className="h-3 w-3" />
            Edit
          </button>
          <button
            onClick={() => onDelete(item)}
            disabled={isExecuting || isDeleting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-destructive/10 hover:text-destructive text-xs font-medium text-muted-foreground transition-colors disabled:opacity-50 ml-auto"
          >
            {isDeleting
              ? <Loader2 className="h-3 w-3 animate-spin" />
              : <Trash2 className="h-3 w-3" />
            }
            Delete
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
