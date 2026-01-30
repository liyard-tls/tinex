'use client';

import { useEffect, useState, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import BottomNav from '@/shared/components/layout/BottomNav';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/components/ui/Card';
import { Button } from '@/shared/components/ui';
import {
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  ChevronLeft,
  ChevronRight,
  X,
  MoreHorizontal,
} from 'lucide-react';
import Input from '@/shared/components/ui/Input';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { transactionRepository } from '@/core/repositories/TransactionRepository';
import { categoryRepository } from '@/core/repositories/CategoryRepository';
import { accountRepository } from '@/core/repositories/AccountRepository';
import { userSettingsRepository } from '@/core/repositories/UserSettingsRepository';
import { analyticsPresetRepository } from '@/core/repositories/AnalyticsPresetRepository';
import { Transaction, Category, Account, UserSettings, Currency, SYSTEM_CATEGORIES, AnalyticsPreset, ALL_CATEGORIES_PRESET_ID } from '@/core/models';
import { PresetSelector } from '@/modules/analytics';
import { formatCurrency, convertCurrency } from '@/shared/services/currencyService';
import { cn } from '@/shared/utils/cn';
import { CATEGORY_ICONS } from '@/shared/config/icons';

// Custom Tooltip Component
interface TooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: {
      date: string;
      balance: number;
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
        <p className="text-xs text-muted-foreground mb-1">{data.date}</p>
        <p className={cn(
          'text-sm font-semibold',
          data.balance >= 0 ? 'text-success' : 'text-destructive'
        )}>
          {formatCurrency(data.balance, currency)}
        </p>
      </div>
    );
  }
  return null;
}

function AnalyticsContent() {
  const [user, setUser] = useState<{ uid: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
  const [presets, setPresets] = useState<AnalyticsPreset[]>([]);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [chartSource, setChartSource] = useState<'total' | string>('total'); // 'total' or accountId
  const [showChart, setShowChart] = useState(true);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [calculatingStats, setCalculatingStats] = useState(false);
  const [convertedStats, setConvertedStats] = useState({
    totalIncome: 0,
    totalExpenses: 0,
    categoryTotals: {} as Record<string, number>,
  });
  const router = useRouter();
  const searchParams = useSearchParams();

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
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

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
      const [txns, userCategories, userAccounts, settings, userPresets] = await Promise.all([
        transactionRepository.getByUserId(userId),
        categoryRepository.getByUserId(userId),
        accountRepository.getByUserId(userId),
        userSettingsRepository.getOrCreate(userId),
        analyticsPresetRepository.getByUserId(userId),
      ]);

      setTransactions(txns);
      setCategories(userCategories);
      setAccounts(userAccounts);
      setUserSettings(settings);
      setPresets(userPresets);

      // Set active preset from user settings
      if (settings.activeAnalyticsPresetId && settings.activeAnalyticsPresetId !== ALL_CATEGORIES_PRESET_ID) {
        setActivePresetId(settings.activeAnalyticsPresetId);
      } else {
        setActivePresetId(null);
      }
    } catch (error) {
      console.error('Failed to load analytics data:', error);
    }
  };

  // Preset handlers
  const handleSelectPreset = async (presetId: string | null) => {
    if (!user) return;
    setActivePresetId(presetId);
    try {
      await userSettingsRepository.update(user.uid, {
        activeAnalyticsPresetId: presetId || ALL_CATEGORIES_PRESET_ID,
      });
    } catch (error) {
      console.error('Failed to update active preset:', error);
    }
  };

  const handleCreatePreset = async (name: string, categoryIds: string[]) => {
    if (!user) return;
    try {
      const presetId = await analyticsPresetRepository.create(user.uid, { name, categoryIds });
      const newPreset: AnalyticsPreset = {
        id: presetId,
        userId: user.uid,
        name,
        categoryIds,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      setPresets((prev) => [...prev, newPreset]);
      // Automatically select the new preset
      await handleSelectPreset(presetId);
    } catch (error) {
      console.error('Failed to create preset:', error);
      throw error;
    }
  };

  const handleUpdatePreset = async (id: string, name: string, categoryIds: string[]) => {
    try {
      await analyticsPresetRepository.update({ id, name, categoryIds });
      setPresets((prev) =>
        prev.map((p) => (p.id === id ? { ...p, name, categoryIds, updatedAt: new Date() } : p))
      );
    } catch (error) {
      console.error('Failed to update preset:', error);
      throw error;
    }
  };

  const handleDeletePreset = async (id: string) => {
    if (!user) return;
    try {
      await analyticsPresetRepository.delete(id);
      setPresets((prev) => prev.filter((p) => p.id !== id));
      // If deleting the active preset, switch to All Categories
      if (activePresetId === id) {
        await handleSelectPreset(null);
      }
    } catch (error) {
      console.error('Failed to delete preset:', error);
      throw error;
    }
  };

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

  // Get active preset category IDs
  const activePresetCategoryIds = useMemo(() => {
    if (!activePresetId) return null; // null means all categories
    const preset = presets.find((p) => p.id === activePresetId);
    return preset?.categoryIds || null;
  }, [activePresetId, presets]);

  // Filter transactions by current week - use useMemo to prevent recreating array
  const { start, end } = currentWeek;
  const periodTransactions = useMemo(() => {
    // Get system category IDs (Transfer Out, Transfer In)
    const systemCategoryIds = categories
      .filter(cat =>
        cat.name === SYSTEM_CATEGORIES.TRANSFER_OUT ||
        cat.name === SYSTEM_CATEGORIES.TRANSFER_IN
      )
      .map(cat => cat.id);

    return transactions.filter((txn) => {
      const txnDate = new Date(txn.date);
      const isInPeriod = txnDate >= start && txnDate <= end;

      // Exclude if transaction is marked to exclude from analytics
      if (txn.excludeFromAnalytics) return false;

      // Exclude if transaction belongs to system transfer category
      if (systemCategoryIds.includes(txn.categoryId)) return false;

      // Filter by preset categories if a preset is active
      if (activePresetCategoryIds && !activePresetCategoryIds.includes(txn.categoryId)) {
        return false;
      }

      return isInPeriod;
    });
  }, [transactions, start, end, categories, activePresetCategoryIds]);

  // Calculate ignored transactions (excluded from analytics)
  const ignoredTransactions = useMemo(() => {
    // Get system category IDs (Transfer Out, Transfer In)
    const systemCategoryIds = categories
      .filter(cat =>
        cat.name === SYSTEM_CATEGORIES.TRANSFER_OUT ||
        cat.name === SYSTEM_CATEGORIES.TRANSFER_IN
      )
      .map(cat => cat.id);

    return transactions.filter((txn) => {
      const txnDate = new Date(txn.date);
      const isInPeriod = txnDate >= start && txnDate <= end;

      if (!isInPeriod) return false;

      // Include if transaction is marked to exclude from analytics
      if (txn.excludeFromAnalytics) return true;

      // Include if transaction belongs to system transfer category
      if (systemCategoryIds.includes(txn.categoryId)) return true;

      return false;
    });
  }, [transactions, start, end, categories]);

  // Calculate ignored transactions total
  const [ignoredTotal, setIgnoredTotal] = useState(0);

  useEffect(() => {
    const calculateIgnoredTotal = async () => {
      if (!userSettings || ignoredTransactions.length === 0) {
        setIgnoredTotal(0);
        return;
      }

      let total = 0;
      for (const txn of ignoredTransactions) {
        const convertedAmount = await convertCurrency(
          txn.amount,
          txn.currency,
          userSettings.baseCurrency
        );
        total += convertedAmount;
      }
      setIgnoredTotal(total);
    };

    calculateIgnoredTotal();
  }, [ignoredTransactions, userSettings]);

  // Calculate transfer losses
  // This is the difference between actual balance and what it would be without transfers
  const [transferLoss, setTransferLoss] = useState(0);

  useEffect(() => {
    const calculateTransferLoss = async () => {
      if (!userSettings || accounts.length === 0) {
        setTransferLoss(0);
        return;
      }

      // Get actual current balance (from accounts)
      let actualBalance = 0;
      for (const account of accounts) {
        const convertedBalance = await convertCurrency(
          account.balance,
          account.currency,
          userSettings.baseCurrency
        );
        actualBalance += convertedBalance;
      }

      // Calculate theoretical balance (without transfers)
      // Start from actual balance and add back transfer effects
      let theoreticalBalance = actualBalance;

      // Get transfer transactions
      const systemCategoryIds = categories
        .filter(cat =>
          cat.name === SYSTEM_CATEGORIES.TRANSFER_OUT ||
          cat.name === SYSTEM_CATEGORIES.TRANSFER_IN
        )
        .map(cat => cat.id);

      const transferTxns = transactions.filter((t) =>
        systemCategoryIds.includes(t.categoryId)
      );

      // Add back the transfer effects to see what balance would be without them
      for (const txn of transferTxns) {
        const convertedAmount = await convertCurrency(
          txn.amount,
          txn.currency,
          userSettings.baseCurrency
        );
        // Reverse the transfer effect
        theoreticalBalance -= (txn.type === 'income' ? convertedAmount : -convertedAmount);
      }

      // The difference is the loss (or gain) from transfers
      const loss = actualBalance - theoreticalBalance;
      setTransferLoss(loss);

      console.log('[Analytics] Transfer loss calculation:', {
        actualBalance,
        theoreticalBalance,
        loss,
        transferCount: transferTxns.length,
      });
    };

    calculateTransferLoss();
  }, [accounts, transactions, categories, userSettings]);

  // Convert transactions to base currency whenever period or transactions change
  useEffect(() => {
    const convertTransactions = async () => {
      if (!userSettings) {
        setConvertedStats({
          totalIncome: 0,
          totalExpenses: 0,
          categoryTotals: {},
        });
        setCalculatingStats(false);
        return;
      }

      if (periodTransactions.length === 0) {
        setConvertedStats({
          totalIncome: 0,
          totalExpenses: 0,
          categoryTotals: {},
        });
        setCalculatingStats(false);
        return;
      }

      setCalculatingStats(true);

      try {
        let income = 0;
        let expenses = 0;
        const categoryTotals: Record<string, number> = {};

        // Convert each transaction to base currency
        for (const txn of periodTransactions) {
          const convertedAmount = await convertCurrency(
            txn.amount,
            txn.currency,
            userSettings.baseCurrency
          );

          if (txn.type === 'income') {
            income += convertedAmount;
          } else if (txn.type === 'expense') {
            expenses += convertedAmount;
          }

          // Track category totals
          if (!categoryTotals[txn.categoryId]) {
            categoryTotals[txn.categoryId] = 0;
          }
          categoryTotals[txn.categoryId] += convertedAmount;
        }

        setConvertedStats({
          totalIncome: income,
          totalExpenses: expenses,
          categoryTotals,
        });
      } catch (error) {
        console.error('Failed to convert transactions:', error);
      } finally {
        setCalculatingStats(false);
      }
    };

    convertTransactions();
  }, [periodTransactions, userSettings]);

  // Use converted stats
  const totalIncome = convertedStats.totalIncome;
  const totalExpenses = convertedStats.totalExpenses;
  const netBalance = totalIncome - totalExpenses;

  // Category breakdown using converted totals
  const categoryBreakdown = categories
    .map((cat) => {
      const catTransactions = periodTransactions.filter((t) => t.categoryId === cat.id);
      const total = convertedStats.categoryTotals[cat.id] || 0;
      const count = catTransactions.length;
      const percentage =
        cat.type === 'expense' && totalExpenses > 0 ? (total / totalExpenses) * 100 : 0;

      return {
        ...cat,
        total,
        count,
        percentage,
      };
    })
    .filter((cat) => cat.total > 0)
    .sort((a, b) => b.total - a.total);

  const topExpenseCategories = categoryBreakdown.filter((c) => c.type === 'expense').slice(0, 5);
  const topIncomeCategories = categoryBreakdown.filter((c) => c.type === 'income').slice(0, 5);

  // Daily average
  const getDaysInPeriod = () => {
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  };

  const daysInPeriod = getDaysInPeriod();
  const avgDailyExpense = totalExpenses / daysInPeriod;
  const avgDailyIncome = totalIncome / daysInPeriod;

  // Savings rate
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;

  // Generate chart data with currency conversion
  const [chartData, setChartData] = useState<{ date: string; balance: number; currency?: string }[]>([]);

  // Memoize chart generation dependencies to prevent infinite loops
  const chartKey = useMemo(() => {
    return `${periodTransactions.length}-${chartSource}-${userSettings?.baseCurrency}-${start.getTime()}-${daysInPeriod}-${accounts.length}-${transactions.length}`;
  }, [periodTransactions.length, chartSource, userSettings?.baseCurrency, start, daysInPeriod, accounts.length, transactions.length]);

  useEffect(() => {
    const generateChartData = async () => {
      if (!userSettings) {
        setChartData([]);
        return;
      }

      const dataPoints: { date: string; balance: number; currency?: string }[] = [];

      // Filter relevant accounts
      let relevantAccounts = accounts;
      if (chartSource !== 'total') {
        relevantAccounts = accounts.filter((a) => a.id === chartSource);
      }

      // Get ALL transactions in period (including transfers and excluded ones)
      // because they affect the actual account balance
      const allTxnsInPeriod = transactions.filter((t) => {
        const txnDate = new Date(t.date);
        const isInPeriod = txnDate >= start && txnDate <= end;

        // Filter by account if specific account selected
        if (chartSource !== 'total' && t.accountId !== chartSource) {
          return false;
        }

        return isInPeriod;
      });

      // Calculate initial balance (account balances at start of period)
      // This represents the balance before the period started
      let initialBalance = 0;

      for (const account of relevantAccounts) {
        // Get current account balance (converted to base currency)
        const convertedBalance = await convertCurrency(
          account.balance,
          account.currency,
          userSettings.baseCurrency
        );

        // Get ALL transactions for this account from period start onwards
        // (including transfers and excluded) because they affect the balance
        const txnsFromPeriodStart = transactions.filter((t) =>
          t.accountId === account.id && new Date(t.date) >= start
        );

        // Subtract transactions that happened from period start onwards to get initial balance
        let balanceAtStart = convertedBalance;
        for (const t of txnsFromPeriodStart) {
          const convertedAmount = await convertCurrency(
            t.amount,
            t.currency,
            userSettings.baseCurrency
          );
          // Reverse the transaction effect to go back in time
          balanceAtStart -= (t.type === 'income' ? convertedAmount : -convertedAmount);
        }

        initialBalance += balanceAtStart;
      }

      // Debug logging
      console.log('[Analytics Chart] Initial balance calculation:', {
        initialBalance,
        accountsCount: relevantAccounts.length,
        allTransactionsInPeriod: allTxnsInPeriod.length,
        periodStart: start.toISOString(),
        periodEnd: end.toISOString(),
      });

      // Sort transactions by date
      const sortedTxns = [...allTxnsInPeriod].sort((a, b) =>
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      // Daily data points
      for (let i = 0; i < daysInPeriod; i++) {
        const date = new Date(start);
        date.setDate(start.getDate() + i);

        // Sum all transactions up to this date (converted to base currency)
        const txnsUpToDate = sortedTxns.filter((t) =>
          new Date(t.date) <= date
        );

        // Start with initial balance
        let runningBalance = initialBalance;
        for (const t of txnsUpToDate) {
          const convertedAmount = await convertCurrency(
            t.amount,
            t.currency,
            userSettings.baseCurrency
          );
          runningBalance += (t.type === 'income' ? convertedAmount : -convertedAmount);
        }

        dataPoints.push({
          date: date.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' }),
          balance: runningBalance,
          currency: userSettings.baseCurrency,
        });
      }

      // Debug: Log final balance
      if (dataPoints.length > 0) {
        console.log('[Analytics Chart] Final balance:', {
          finalBalance: dataPoints[dataPoints.length - 1].balance,
          firstBalance: dataPoints[0].balance,
          change: dataPoints[dataPoints.length - 1].balance - dataPoints[0].balance,
        });
      }

      setChartData(dataPoints);
    };

    generateChartData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartKey]);

  if (loading || calculatingStats) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-3"></div>
          <p className="text-sm text-muted-foreground">
            {loading ? 'Loading...' : 'Converting currencies...'}
          </p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border">
        <div className="px-4 py-3">
          <h1 className="text-xl font-bold">Analytics</h1>
          <p className="text-xs text-muted-foreground">Financial insights and trends</p>
        </div>
      </header>

      <main className="px-4 py-4 space-y-4 pb-32">
        {/* Preset Selector */}
        <PresetSelector
          presets={presets}
          activePresetId={activePresetId}
          categories={categories}
          onSelectPreset={handleSelectPreset}
          onCreatePreset={handleCreatePreset}
          onUpdatePreset={handleUpdatePreset}
          onDeletePreset={handleDeletePreset}
        />

        {/* Balance Trend Chart */}
        {showChart && chartData.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Balance Trend</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setShowChart(!showChart)}
                >
                  Hide
                </Button>
              </div>
              <CardDescription>
                {chartSource === 'total' ? 'All Accounts' : accounts.find(a => a.id === chartSource)?.name || 'Account'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Source Selector */}
              <div className="mb-4">
                <select
                  value={chartSource}
                  onChange={(e) => setChartSource(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="total">All Accounts (Total Balance)</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </div>

              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor={chartData[chartData.length - 1]?.balance >= 0 ? '#10b981' : '#ef4444'}
                        stopOpacity={0.3}
                      />
                      <stop
                        offset="95%"
                        stopColor={chartData[chartData.length - 1]?.balance >= 0 ? '#10b981' : '#ef4444'}
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} />
                  <XAxis
                    dataKey="date"
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
                      // Simple formatter for Y-axis - just show symbol and rounded value
                      const symbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'UAH' ? '₴' : '$';
                      return `${symbol}${value}`;
                    }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="balance"
                    stroke={chartData[chartData.length - 1]?.balance >= 0 ? '#10b981' : '#ef4444'}
                    strokeWidth={2}
                    fill="url(#colorBalance)"
                    dot={{ fill: chartData[chartData.length - 1]?.balance >= 0 ? '#10b981' : '#ef4444', r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </AreaChart>
              </ResponsiveContainer>

              <div className="flex justify-between items-center mt-3 pt-3 border-t border-border">
                <div>
                  <p className="text-xs text-muted-foreground">Current</p>
                  <p className={cn(
                    'text-lg font-bold',
                    chartData[chartData.length - 1]?.balance >= 0 ? 'text-success' : 'text-destructive'
                  )}>
                    {formatCurrency(
                      chartData[chartData.length - 1]?.balance || 0,
                      userSettings?.baseCurrency || 'USD'
                    )}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Change</p>
                  <p className={cn(
                    'text-lg font-bold',
                    (chartData[chartData.length - 1]?.balance - chartData[0]?.balance) >= 0 ? 'text-success' : 'text-destructive'
                  )}>
                    {(chartData[chartData.length - 1]?.balance - chartData[0]?.balance) >= 0 ? '+' : ''}
                    {formatCurrency(
                      Math.abs((chartData[chartData.length - 1]?.balance || 0) - (chartData[0]?.balance || 0)),
                      userSettings?.baseCurrency || 'USD'
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {!showChart && (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setShowChart(true)}
          >
            Show Balance Trend Chart
          </Button>
        )}

        {/* Overview Cards */}
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-success/20 flex items-center justify-center">
                  <ArrowUpRight className="h-4 w-4 text-success" />
                </div>
                <p className="text-xs text-muted-foreground">Income</p>
              </div>
              <p className="text-2xl font-bold text-success">
                {formatCurrency(totalIncome, userSettings?.baseCurrency || 'USD')}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {formatCurrency(avgDailyIncome, userSettings?.baseCurrency || 'USD')}/day
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-destructive/20 flex items-center justify-center">
                  <ArrowDownRight className="h-4 w-4 text-destructive" />
                </div>
                <p className="text-xs text-muted-foreground">Expenses</p>
              </div>
              <p className="text-2xl font-bold text-destructive">
                {formatCurrency(totalExpenses, userSettings?.baseCurrency || 'USD')}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {formatCurrency(avgDailyExpense, userSettings?.baseCurrency || 'USD')}/day
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Net Balance */}
        <Card className={cn(netBalance >= 0 ? 'bg-success/5' : 'bg-destructive/5')}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Net Balance</p>
                <p
                  className={cn(
                    'text-3xl font-bold',
                    netBalance >= 0 ? 'text-success' : 'text-destructive'
                  )}
                >
                  {netBalance >= 0 ? '+' : ''}
                  {formatCurrency(Math.abs(netBalance), userSettings?.baseCurrency || 'USD')}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground mb-1">Savings Rate</p>
                <p
                  className={cn(
                    'text-2xl font-bold',
                    savingsRate >= 0 ? 'text-success' : 'text-destructive'
                  )}
                >
                  {savingsRate.toFixed(1)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Top Expense Categories */}
        {topExpenseCategories.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top Expense Categories</CardTitle>
              <CardDescription>Where your money goes</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {topExpenseCategories.map((cat) => {
                const IconComponent = CATEGORY_ICONS[cat.icon as keyof typeof CATEGORY_ICONS] || MoreHorizontal;

                return (
                  <button
                    key={cat.id}
                    onClick={() => {
                      const startDate = currentWeek.start.toISOString();
                      const endDate = currentWeek.end.toISOString();

                      // Build returnTo URL with date parameters
                      const returnToParams = new URLSearchParams();
                      returnToParams.set('startDate', startDate);
                      returnToParams.set('endDate', endDate);
                      const returnTo = `/analytics?${returnToParams.toString()}`;

                      router.push(`/transactions/category/${cat.id}?startDate=${startDate}&endDate=${endDate}&returnTo=${encodeURIComponent(returnTo)}`);
                    }}
                    className="w-full space-y-2 text-left hover:bg-muted/30 p-2 -m-2 rounded-lg transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: `${cat.color}20` }}
                        >
                          <IconComponent className="h-4 w-4" style={{ color: cat.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{cat.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {cat.count} transaction{cat.count !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-semibold">
                          {formatCurrency(cat.total, userSettings?.baseCurrency || 'USD')}
                        </p>
                        <p className="text-xs text-muted-foreground">{cat.percentage.toFixed(1)}%</p>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${cat.percentage}%`,
                          backgroundColor: cat.color,
                        }}
                      />
                    </div>
                  </button>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Top Income Categories */}
        {topIncomeCategories.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Income Sources</CardTitle>
              <CardDescription>Where your money comes from</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {topIncomeCategories.map((cat) => {
                const IconComponent = CATEGORY_ICONS[cat.icon as keyof typeof CATEGORY_ICONS] || MoreHorizontal;
                const incomePercentage = totalIncome > 0 ? (cat.total / totalIncome) * 100 : 0;

                return (
                  <button
                    key={cat.id}
                    onClick={() => {
                      const startDate = currentWeek.start.toISOString();
                      const endDate = currentWeek.end.toISOString();

                      // Build returnTo URL with date parameters
                      const returnToParams = new URLSearchParams();
                      returnToParams.set('startDate', startDate);
                      returnToParams.set('endDate', endDate);
                      const returnTo = `/analytics?${returnToParams.toString()}`;

                      router.push(`/transactions/category/${cat.id}?startDate=${startDate}&endDate=${endDate}&returnTo=${encodeURIComponent(returnTo)}`);
                    }}
                    className="w-full space-y-2 text-left hover:bg-muted/30 p-2 -m-2 rounded-lg transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: `${cat.color}20` }}
                        >
                          <IconComponent className="h-5 w-5" style={{ color: cat.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{cat.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {cat.count} transaction{cat.count !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-semibold text-success">
                          {formatCurrency(cat.total, userSettings?.baseCurrency || 'USD')}
                        </p>
                        <p className="text-xs text-muted-foreground">{incomePercentage.toFixed(1)}%</p>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${incomePercentage}%`,
                          backgroundColor: cat.color,
                        }}
                      />
                    </div>
                  </button>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Ignored Transactions */}
        {ignoredTransactions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ignored Transactions</CardTitle>
              <CardDescription>Excluded from analytics</CardDescription>
            </CardHeader>
            <CardContent>
              <button
                onClick={() => {
                  const startDate = currentWeek.start.toISOString();
                  const endDate = currentWeek.end.toISOString();
                  const returnToParams = new URLSearchParams();
                  returnToParams.set('startDate', startDate);
                  returnToParams.set('endDate', endDate);
                  const returnTo = `/analytics?${returnToParams.toString()}`;
                  router.push(`/transactions?ignored=true&startDate=${startDate}&endDate=${endDate}&returnTo=${encodeURIComponent(returnTo)}`);
                }}
                className="w-full space-y-2 text-left hover:bg-muted/30 p-3 rounded-lg transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-muted">
                      <X className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">All Ignored</p>
                      <p className="text-xs text-muted-foreground">
                        {ignoredTransactions.length} transaction{ignoredTransactions.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold">
                      {formatCurrency(ignoredTotal, userSettings?.baseCurrency || 'USD')}
                    </p>
                  </div>
                </div>
              </button>
            </CardContent>
          </Card>
        )}

        {/* Transfer Loss Alert */}
        {Math.abs(transferLoss) > 0.01 && (
          <Card className={cn(
            "border-2",
            transferLoss < 0 ? "border-destructive/50 bg-destructive/5" : "border-success/50 bg-success/5"
          )}>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                {transferLoss < 0 ? (
                  <ArrowDownRight className="h-5 w-5 text-destructive" />
                ) : (
                  <ArrowUpRight className="h-5 w-5 text-success" />
                )}
                Transfer {transferLoss < 0 ? 'Loss' : 'Gain'}
              </CardTitle>
              <CardDescription>
                {transferLoss < 0
                  ? 'Money lost due to currency conversion and fees during transfers'
                  : 'Money gained during transfers (favorable exchange rates)'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {transferLoss < 0 ? 'Total Loss' : 'Total Gain'}
                  </p>
                  <p className={cn(
                    "text-2xl font-bold",
                    transferLoss < 0 ? "text-destructive" : "text-success"
                  )}>
                    {transferLoss < 0 ? '-' : '+'}
                    {formatCurrency(
                      Math.abs(transferLoss),
                      userSettings?.baseCurrency || 'USD'
                    )}
                  </p>
                </div>
                <div className="text-xs text-muted-foreground pt-2 border-t">
                  <p>
                    {transferLoss < 0
                      ? 'This represents the difference between your actual balance and what it would be without any transfers. Common causes: currency exchange rate losses, transfer fees, or timing of conversions.'
                      : 'You gained money from favorable exchange rates during transfers between accounts.'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Transaction Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Transaction Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Total Transactions</p>
              </div>
              <p className="text-sm font-semibold">{periodTransactions.length}</p>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-success" />
                <p className="text-sm text-muted-foreground">Income Transactions</p>
              </div>
              <p className="text-sm font-semibold text-success">
                {periodTransactions.filter((t) => t.type === 'income').length}
              </p>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-destructive" />
                <p className="text-sm text-muted-foreground">Expense Transactions</p>
              </div>
              <p className="text-sm font-semibold text-destructive">
                {periodTransactions.filter((t) => t.type === 'expense').length}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Empty State */}
        {periodTransactions.length === 0 && (
          <Card>
            <CardContent className="text-center py-12">
              <TrendingUp className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <CardTitle className="mb-2">No Data Available</CardTitle>
              <p className="text-sm text-muted-foreground mb-4">
                No transactions found for this period
              </p>
            </CardContent>
          </Card>
        )}
      </main>

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
            className="flex items-center gap-2 px-4 py-2 rounded-md hover:bg-muted/50 transition-colors"
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
        <>
          <div
            className="fixed inset-0 bg-black/50 z-50"
            onClick={() => setShowDatePicker(false)}
          />
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background border border-border rounded-lg shadow-xl z-50 w-80 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Select Date Range</h3>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setShowDatePicker(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Start Date</label>
                <Input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="w-full"
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">End Date</label>
                <Input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="w-full"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-4">
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
        </>
      )}

      <BottomNav />
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-3"></div>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    }>
      <AnalyticsContent />
    </Suspense>
  );
}
