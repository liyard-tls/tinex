'use client';

import { useEffect, useState, useMemo, Suspense } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import BottomNav from '@/shared/components/layout/BottomNav';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/components/ui/Card';
import { Button } from '@/shared/components/ui';
import { Filter, X, MoreHorizontal, ArrowLeft, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import Input from '@/shared/components/ui/Input';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart, ReferenceLine } from 'recharts';
import { transactionRepository } from '@/core/repositories/TransactionRepository';
import { categoryRepository } from '@/core/repositories/CategoryRepository';
import { tagRepository } from '@/core/repositories/TagRepository';
import { accountRepository } from '@/core/repositories/AccountRepository';
import { userSettingsRepository } from '@/core/repositories/UserSettingsRepository';
import { budgetRepository } from '@/core/repositories/BudgetRepository';
import { Transaction, Category, Tag, Account, CURRENCIES, UserSettings, Currency, BudgetProgress } from '@/core/models';
import { cn } from '@/shared/utils/cn';
import { CATEGORY_ICONS } from '@/shared/config/icons';
import { formatCurrency, convertCurrency } from '@/shared/services/currencyService';
import { SpendingInsights } from '@/modules/analytics';
import BudgetCard from '@/modules/budgets/BudgetCard';
import { calculateCategoryBudgetsProgress } from '@/modules/budgets/budgetProgressService';

// Helper function to get currency symbol
const getCurrencySymbol = (currency: string) => {
  return CURRENCIES.find((c) => c.value === currency)?.symbol || currency;
};

// Custom Tooltip Component
interface TooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: {
      week: string;
      amount: number;
      currency?: string;
    };
  }>;
}

function CustomTooltip({ active, payload }: TooltipProps) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const currency = (data.currency || 'USD') as Currency;
    return (
      <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
        <p className="text-xs text-muted-foreground mb-1">{data.week}</p>
        <p className="text-sm font-semibold text-destructive">
          {formatCurrency(data.amount, currency)}
        </p>
      </div>
    );
  }
  return null;
}

function CategoryTransactionsContent() {
  const [user, setUser] = useState<{ uid: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
  const [budgetProgress, setBudgetProgress] = useState<BudgetProgress[]>([]);
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [showCategoryPanel, setShowCategoryPanel] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [chartData, setChartData] = useState<{ week: string; amount: number; currency: string }[]>([]);

  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const categoryId = params.id as string;
  const returnTo = searchParams.get('returnTo');

  // Week navigation state
  const getWeekDates = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Monday start
    const monday = new Date(d.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return { start: monday, end: sunday };
  };

  const [currentWeek, setCurrentWeek] = useState(() => {
    // Check URL parameters for date range
    const urlStartDate = searchParams.get('startDate');
    const urlEndDate = searchParams.get('endDate');

    if (urlStartDate && urlEndDate) {
      const start = new Date(urlStartDate);
      const end = new Date(urlEndDate);
      return { start, end };
    }

    return getWeekDates(new Date());
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser({ uid: currentUser.uid });
        await loadData(currentUser.uid);
      } else {
        router.push('/auth');
      }
      setLoading(false);
    });

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const loadData = async (userId: string) => {
    try {
      const [txns, userCategories, userTags, userAccounts, settings, userBudgets] = await Promise.all([
        transactionRepository.getByUserId(userId),
        categoryRepository.getByUserId(userId),
        tagRepository.getByUserId(userId),
        accountRepository.getByUserId(userId),
        userSettingsRepository.getOrCreate(userId),
        budgetRepository.getByUserId(userId),
      ]);

      setTransactions(txns);
      setCategories(userCategories);
      setTags(userTags);
      setAccounts(userAccounts);
      setUserSettings(settings);

      // Calculate budget progress for this category
      if (settings && userBudgets.length > 0) {
        const categoryBudgetProgress = await calculateCategoryBudgetsProgress(
          userBudgets,
          categoryId,
          userId,
          settings.baseCurrency
        );
        setBudgetProgress(categoryBudgetProgress);
      }
    } catch (error) {
      console.error('Failed to load transactions:', error);
    }
  };

  const category = categories.find((c) => c.id === categoryId);

  // Week navigation handlers
  const goToPreviousWeek = () => {
    const newStart = new Date(currentWeek.start);
    newStart.setDate(newStart.getDate() - 7);
    setCurrentWeek(getWeekDates(newStart));
  };

  const goToNextWeek = () => {
    const newStart = new Date(currentWeek.start);
    newStart.setDate(newStart.getDate() + 7);
    setCurrentWeek(getWeekDates(newStart));
  };

  const openDatePicker = () => {
    setCustomStartDate(currentWeek.start.toISOString().split('T')[0]);
    setCustomEndDate(currentWeek.end.toISOString().split('T')[0]);
    setShowDatePicker(true);
  };

  const applyCustomDates = () => {
    if (customStartDate && customEndDate) {
      const start = new Date(customStartDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(customEndDate);
      end.setHours(23, 59, 59, 999);
      setCurrentWeek({ start, end });
      setShowDatePicker(false);
    }
  };

  const formatDateRange = () => {
    const startStr = currentWeek.start.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
    const endStr = currentWeek.end.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${startStr} - ${endStr}`;
  };

  const getAccountName = (accountId: string) => {
    return accounts.find((acc) => acc.id === accountId)?.name || 'Unknown';
  };

  const handleCategoryIconClick = (e: React.MouseEvent, txn: Transaction) => {
    e.stopPropagation();
    setSelectedTransaction(txn);
    setShowCategoryPanel(true);
  };

  const handleCategoryChange = async (newCategoryId: string) => {
    if (!user || !selectedTransaction) return;

    try {
      await transactionRepository.update({
        id: selectedTransaction.id,
        categoryId: newCategoryId,
      });
      setShowCategoryPanel(false);
      setSelectedTransaction(null);
      await loadData(user.uid);
    } catch (error) {
      console.error('Failed to update category:', error);
    }
  };

  // Filter transactions by current week and category
  const { start, end } = currentWeek;
  const periodTransactions = useMemo(() => {
    return transactions.filter((txn) => {
      const txnDate = new Date(txn.date);
      const isInPeriod = txnDate >= start && txnDate <= end;
      const matchesCategory = txn.categoryId === categoryId;

      return isInPeriod && matchesCategory;
    });
  }, [transactions, start, end, categoryId]);

  const filteredTransactions = periodTransactions.filter((txn) => {
    if (filterType !== 'all' && txn.type !== filterType) {
      return false;
    }
    return true;
  });

  // Calculate chart data (last 16 weeks) with currency conversion
  useEffect(() => {
    const calculateChartData = async () => {
      if (!userSettings) return;

      const data: { week: string; amount: number; currency: string }[] = [];
      const now = new Date();

      for (let i = 15; i >= 0; i--) {
        const weekEnd = new Date(now);
        weekEnd.setDate(weekEnd.getDate() - (i * 7));
        const weekDates = getWeekDates(weekEnd);

        const weekTransactions = transactions.filter((txn) => {
          const txnDate = new Date(txn.date);
          return txnDate >= weekDates.start && txnDate <= weekDates.end && txn.categoryId === categoryId;
        });

        const weekLabel = weekDates.start.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });

        // Sum amounts for this week (convert to base currency)
        let weekAmount = 0;
        for (const txn of weekTransactions) {
          const converted = await convertCurrency(
            txn.amount,
            txn.currency,
            userSettings.baseCurrency
          );
          weekAmount += converted;
        }

        data.push({
          week: weekLabel,
          amount: weekAmount,
          currency: userSettings.baseCurrency,
        });
      }

      setChartData(data);
    };

    calculateChartData();
  }, [transactions, categoryId, userSettings, currentWeek]);

  // Find weekly budget for this category (if exists)
  const weeklyBudget = useMemo(() => {
    return budgetProgress.find((bp) => bp.budget.period === 'week');
  }, [budgetProgress]);

  // Group transactions by date
  const groupedTransactions = filteredTransactions.reduce((groups, txn) => {
    const date = new Date(txn.date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(txn);
    return groups;
  }, {} as Record<string, Transaction[]>);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-3"></div>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !category) return null;

  const IconComponent = CATEGORY_ICONS[category.icon as keyof typeof CATEGORY_ICONS] || MoreHorizontal;

  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border">
        <div className="px-4 py-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => router.push(returnTo || '/analytics')}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2 flex-1">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `${category.color}20` }}
              >
                <IconComponent className="h-4 w-4" style={{ color: category.color }} />
              </div>
              <div className="flex-1">
                <h1 className="text-xl font-bold">{category.name}</h1>
                <p className="text-xs text-muted-foreground">
                  {filteredTransactions.length} transaction{filteredTransactions.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="px-4 py-4 space-y-4">
        {/* Chart */}
        {chartData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Spending Trend</CardTitle>
              <CardDescription>Last 16 weeks</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={category.color} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={category.color} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} />
                  <XAxis
                    dataKey="week"
                    tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.6 }}
                    tickLine={false}
                    axisLine={{ stroke: 'currentColor', opacity: 0.1 }}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.6 }}
                    tickLine={false}
                    axisLine={{ stroke: 'currentColor', opacity: 0.1 }}
                    tickFormatter={(value) => {
                      const currency = userSettings?.baseCurrency || 'USD';
                      const symbol = getCurrencySymbol(currency);
                      return `${symbol}${value}`;
                    }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  {/* Weekly budget target line */}
                  {weeklyBudget && (
                    <ReferenceLine
                      y={weeklyBudget.budget.amount}
                      stroke="#eab308"
                      strokeDasharray="5 5"
                      strokeWidth={2}
                      label={{
                        value: `Target: ${formatCurrency(
                          weeklyBudget.budget.amount,
                          userSettings?.baseCurrency || 'USD'
                        )}`,
                        position: 'insideTopRight',
                        fill: '#eab308',
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                    />
                  )}
                  <Area
                    type="monotone"
                    dataKey="amount"
                    stroke={category.color}
                    strokeWidth={2}
                    fill="url(#colorAmount)"
                    dot={{ fill: category.color, r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Spending Insights */}
        {chartData.length > 0 && userSettings && (
          <SpendingInsights
            chartData={chartData}
            currency={userSettings.baseCurrency}
          />
        )}

        {/* Budgets for this category */}
        {budgetProgress.length > 0 && category && userSettings && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground px-1">
              Budgets
            </h2>
            <div className="grid grid-cols-1 gap-3">
              {budgetProgress.map((bp) => (
                <BudgetCard
                  key={bp.budget.id}
                  budgetProgress={bp}
                  category={category}
                  currency={userSettings.baseCurrency}
                  onClick={() => {
                    const startDateStr = bp.budget.startDate.toISOString().split('T')[0];
                    const endDateStr = (bp.budget.endDate || new Date())
                      .toISOString()
                      .split('T')[0];
                    router.push(
                      `/transactions/category/${categoryId}?startDate=${startDateStr}&endDate=${endDateStr}&returnTo=/budgets`
                    );
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Filter Buttons */}
        <div className="flex gap-2">
          <Button
            variant={filterType === 'all' ? 'default' : 'outline'}
            size="sm"
            className="flex-1"
            onClick={() => setFilterType('all')}
          >
            All
          </Button>
          <Button
            variant={filterType === 'income' ? 'default' : 'outline'}
            size="sm"
            className="flex-1"
            onClick={() => setFilterType('income')}
          >
            Income
          </Button>
          <Button
            variant={filterType === 'expense' ? 'default' : 'outline'}
            size="sm"
            className="flex-1"
            onClick={() => setFilterType('expense')}
          >
            Expense
          </Button>
        </div>

        {/* Transactions List */}
        {filteredTransactions.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Filter className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <CardTitle className="mb-2">No Transactions</CardTitle>
              <p className="text-sm text-muted-foreground">
                No transactions found for this period
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedTransactions).map(([date, txns]) => (
              <div key={date}>
                <h2 className="text-sm font-semibold text-muted-foreground mb-2 px-1">{date}</h2>
                <Card>
                  <CardContent className="p-0">
                    <div className="divide-y divide-border">
                      {txns.map((txn) => {
                        const transactionTags = tags.filter((t) => txn.tags?.includes(t.id));

                        return (
                          <div
                            key={txn.id}
                            onClick={() => {
                              router.push(`/transactions/${txn.id}?returnTo=${encodeURIComponent(`/transactions/category/${categoryId}?returnTo=${returnTo || '/analytics'}`)}`);
                            }}
                            className="flex items-center gap-3 p-3 relative overflow-hidden hover:bg-muted/30 transition-colors cursor-pointer"
                          >
                            {/* Side gradient bar */}
                            <div
                              className="absolute left-0 top-0 bottom-0 w-1"
                              style={{
                                background: `linear-gradient(to bottom, ${category.color}, ${category.color}80)`,
                              }}
                            />

                            {/* Category icon */}
                            <div
                              onClick={(e) => handleCategoryIconClick(e, txn)}
                              className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ml-2 hover:ring-2 hover:ring-primary/50 transition-all cursor-pointer"
                              style={{
                                backgroundColor: `${category.color}20`,
                              }}
                              title="Click to change category"
                            >
                              <IconComponent
                                className="h-5 w-5"
                                style={{ color: category.color }}
                              />
                            </div>

                            {/* Transaction details */}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{txn.description}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <p className="text-xs text-muted-foreground">
                                  {new Date(txn.date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                                </p>
                                <span className="text-xs text-muted-foreground">•</span>
                                <p className="text-xs text-muted-foreground">
                                  {getAccountName(txn.accountId)}
                                </p>
                              </div>
                              {transactionTags.length > 0 && (
                                <div className="flex gap-1 flex-wrap mt-1">
                                  {transactionTags.map((tag) => (
                                    <span
                                      key={tag.id}
                                      className="px-2 py-0.5 rounded-full text-xs"
                                      style={{
                                        backgroundColor: `${tag.color}20`,
                                        color: tag.color,
                                      }}
                                    >
                                      {tag.name}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Amount */}
                            <p
                              className={cn(
                                'text-sm font-semibold flex-shrink-0',
                                txn.type === 'income' ? 'text-success' : 'text-destructive'
                              )}
                            >
                              {txn.type === 'income' ? '+' : '-'}
                              {getCurrencySymbol(txn.currency)}
                              {txn.amount.toFixed(2)}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Category Selection Side Panel */}
      {showCategoryPanel && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-50"
            onClick={() => {
              setShowCategoryPanel(false);
              setSelectedTransaction(null);
            }}
          />
          <div className="fixed right-0 top-0 bottom-0 w-80 bg-background border-l border-border z-50 shadow-xl animate-in slide-in-from-right">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Change Category</h3>
                {selectedTransaction && (
                  <p className="text-xs text-muted-foreground mt-1 truncate">
                    {selectedTransaction.description}
                  </p>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => {
                  setShowCategoryPanel(false);
                  setSelectedTransaction(null);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-4 space-y-2 overflow-y-auto max-h-[calc(100vh-80px)]">
              {categories.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No categories available
                </p>
              ) : (
                categories.map((cat) => {
                  const CatIcon = CATEGORY_ICONS[cat.icon as keyof typeof CATEGORY_ICONS] || MoreHorizontal;
                  const isSelected = selectedTransaction?.categoryId === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => handleCategoryChange(cat.id)}
                      className={cn(
                        'w-full flex items-center gap-3 p-3 rounded-md transition-colors text-left',
                        isSelected
                          ? 'bg-primary/20 ring-2 ring-primary'
                          : 'hover:bg-muted/50'
                      )}
                    >
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: `${cat.color}20` }}
                      >
                        <CatIcon className="h-5 w-5" style={{ color: cat.color }} />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{cat.name}</p>
                        <p className="text-xs text-muted-foreground capitalize">{cat.type}</p>
                      </div>
                      {isSelected && (
                        <span className="text-xs px-2 py-1 rounded bg-primary/20 text-primary">
                          Current
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}

      {/* Week Navigation Panel */}
      <div className="fixed bottom-16 left-0 right-0 bg-background/95 backdrop-blur border-t border-border z-30">
        <div className="flex items-center justify-between px-4 py-3">
          <Button
            variant="ghost"
            size="sm"
            className="h-10 w-10 p-0"
            onClick={goToPreviousWeek}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <button
            onClick={openDatePicker}
            className="flex items-center gap-2 px-4 py-2 rounded-md hover:bg-muted transition-colors"
          >
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{formatDateRange()}</span>
          </button>
          <Button
            variant="ghost"
            size="sm"
            className="h-10 w-10 p-0"
            onClick={goToNextWeek}
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Date Picker Modal */}
      {showDatePicker && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-lg p-6 w-full max-w-md border border-border">
            <h3 className="text-lg font-semibold mb-4">Select Date Range</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Start Date</label>
                <Input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">End Date</label>
                <Input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowDatePicker(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={applyCustomDates}
                >
                  Apply
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}

export default function CategoryTransactionsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-3"></div>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    }>
      <CategoryTransactionsContent />
    </Suspense>
  );
}
