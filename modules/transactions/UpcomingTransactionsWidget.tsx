'use client';

import { Play, CalendarClock, ChevronRight, RefreshCw, Clock } from 'lucide-react';
import { ScheduledTransaction, Transaction, Account, Category, RECURRENCE_LABELS } from '@/core/models';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/Card';
import { CATEGORY_ICONS } from '@/shared/config/icons';
import { cn } from '@/shared/utils/cn';
import { MoreHorizontal } from 'lucide-react';
import Link from 'next/link';

interface UpcomingTransactionsWidgetProps {
  scheduledTransactions: ScheduledTransaction[];
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  onExecute: (scheduled: ScheduledTransaction) => Promise<void>;
  onViewAll: () => void;
}

function formatDate(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays < 0) return 'Overdue';
  if (diffDays < 7) return `In ${diffDays} days`;
  return date.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
}

export default function UpcomingTransactionsWidget({
  scheduledTransactions,
  transactions,
  accounts,
  categories,
  onExecute,
  onViewAll,
}: UpcomingTransactionsWidgetProps) {
  const now = new Date();

  const scheduled = [...scheduledTransactions]
    .sort((a, b) => a.nextDate.getTime() - b.nextDate.getTime())
    .slice(0, 3);

  const futureTxns = transactions
    .filter((t) => {
      const d = t.date instanceof Date ? t.date : (t.date as { toDate: () => Date }).toDate();
      return d > now;
    })
    .sort((a, b) => {
      const da = a.date instanceof Date ? a.date : (a.date as { toDate: () => Date }).toDate();
      const db2 = b.date instanceof Date ? b.date : (b.date as { toDate: () => Date }).toDate();
      return da.getTime() - db2.getTime();
    })
    .slice(0, 3);

  if (scheduled.length === 0 && futureTxns.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-primary" />
            Upcoming
          </CardTitle>
          <button
            onClick={onViewAll}
            className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            All
            <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      </CardHeader>
      <CardContent className="p-0">

        {/* Scheduled section */}
        {scheduled.length > 0 && (
          <>
            <div className="px-4 py-1.5 flex items-center gap-1.5">
              <RefreshCw className="h-3 w-3 text-muted-foreground/60" />
              <span className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">Recurring</span>
            </div>
            <div className="divide-y divide-white/[0.05]">
              {scheduled.map((s) => {
                const category = categories.find((c) => c.id === s.categoryId);
                const account = accounts.find((a) => a.id === s.accountId);
                const Icon = category?.icon
                  ? CATEGORY_ICONS[category.icon as keyof typeof CATEGORY_ICONS] || MoreHorizontal
                  : MoreHorizontal;
                const color = category?.color || '#6b7280';
                const isOverdue = s.nextDate < now;

                return (
                  <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${color}22` }}
                    >
                      <Icon className="h-4 w-4" style={{ color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{s.description}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={cn('text-xs', isOverdue ? 'text-destructive' : 'text-muted-foreground')}>
                          {formatDate(s.nextDate)}
                        </span>
                        {s.recurrence !== 'once' && (
                          <>
                            <span className="text-muted-foreground/40 text-xs">·</span>
                            <span className="text-xs text-muted-foreground">{RECURRENCE_LABELS[s.recurrence]}</span>
                          </>
                        )}
                        {account && (
                          <>
                            <span className="text-muted-foreground/40 text-xs">·</span>
                            <span className="text-xs text-muted-foreground truncate">{account.name}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={cn('text-sm font-semibold', s.type === 'income' ? 'text-success' : 'text-destructive')}>
                        {s.type === 'income' ? '+' : '-'}{s.amount.toLocaleString()} {s.currency}
                      </span>
                      <button
                        onClick={() => onExecute(s)}
                        className="w-7 h-7 rounded-full bg-primary/10 hover:bg-primary/20 flex items-center justify-center transition-colors"
                        title="Execute now"
                      >
                        <Play className="h-3 w-3 text-primary" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Future transactions section */}
        {futureTxns.length > 0 && (
          <>
            {scheduled.length > 0 && <div className="border-t border-white/[0.05]" />}
            <div className="px-4 py-1.5 flex items-center gap-1.5">
              <Clock className="h-3 w-3 text-muted-foreground/60" />
              <span className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">Future</span>
            </div>
            <div className="divide-y divide-white/[0.05]">
              {futureTxns.map((t) => {
                const txnDate = t.date instanceof Date ? t.date : (t.date as { toDate: () => Date }).toDate();
                const category = categories.find((c) => c.id === t.categoryId);
                const account = accounts.find((a) => a.id === t.accountId);
                const Icon = category?.icon
                  ? CATEGORY_ICONS[category.icon as keyof typeof CATEGORY_ICONS] || MoreHorizontal
                  : MoreHorizontal;
                const color = category?.color || '#6b7280';

                return (
                  <Link
                    key={t.id}
                    href={`/transactions/${t.id}?returnTo=/dashboard`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors"
                  >
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${color}22` }}
                    >
                      <Icon className="h-4 w-4" style={{ color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{t.description}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-xs text-muted-foreground">{formatDate(txnDate)}</span>
                        {account && (
                          <>
                            <span className="text-muted-foreground/40 text-xs">·</span>
                            <span className="text-xs text-muted-foreground truncate">{account.name}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <span className={cn('text-sm font-semibold flex-shrink-0', t.type === 'income' ? 'text-success' : 'text-destructive')}>
                      {t.type === 'income' ? '+' : '-'}{t.amount.toLocaleString()} {t.currency}
                    </span>
                  </Link>
                );
              })}
            </div>
          </>
        )}

      </CardContent>
    </Card>
  );
}
