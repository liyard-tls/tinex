'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import BottomNav from '@/shared/components/layout/BottomNav';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/components/ui/Card';
import { Button } from '@/shared/components/ui';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Briefcase,
  Utensils,
  ShoppingBag,
  Car,
  FileText,
  Film,
  Heart,
  BookOpen,
  MoreHorizontal,
  Home,
  Smartphone,
  Coffee,
  Gift,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
} from 'lucide-react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { transactionRepository } from '@/core/repositories/TransactionRepository';
import { categoryRepository } from '@/core/repositories/CategoryRepository';
import { accountRepository } from '@/core/repositories/AccountRepository';
import { Transaction, Category, Account } from '@/core/models';
import { cn } from '@/shared/utils/cn';

// Icon mapping for categories
const ICONS = {
  DollarSign,
  Briefcase,
  TrendingUp,
  Plus,
  Utensils,
  ShoppingBag,
  Car,
  FileText,
  Film,
  Heart,
  BookOpen,
  MoreHorizontal,
  Home,
  Smartphone,
  Coffee,
  Gift,
};

// Custom Tooltip Component
interface TooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: {
      date: string;
      balance: number;
    };
  }>;
}

function CustomTooltip({ active, payload }: TooltipProps) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
        <p className="text-xs text-muted-foreground mb-1">{data.date}</p>
        <p className={cn(
          'text-sm font-semibold',
          data.balance >= 0 ? 'text-success' : 'text-destructive'
        )}>
          ${data.balance.toFixed(2)}
        </p>
      </div>
    );
  }
  return null;
}

export default function AnalyticsPage() {
  const [user, setUser] = useState<{ uid: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [period, setPeriod] = useState<'week' | 'month' | 'year'>('month');
  const [chartSource, setChartSource] = useState<'total' | string>('total'); // 'total' or accountId
  const [showChart, setShowChart] = useState(true);
  const router = useRouter();

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
      const [txns, userCategories, userAccounts] = await Promise.all([
        transactionRepository.getByUserId(userId),
        categoryRepository.getByUserId(userId),
        accountRepository.getByUserId(userId),
      ]);

      setTransactions(txns);
      setCategories(userCategories);
      setAccounts(userAccounts);
    } catch (error) {
      console.error('Failed to load analytics data:', error);
    }
  };

  // Get date range based on period
  const getDateRange = () => {
    const now = new Date();
    let start: Date;

    if (period === 'week') {
      start = new Date(now);
      start.setDate(now.getDate() - 7);
    } else if (period === 'month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
      start = new Date(now.getFullYear(), 0, 1);
    }

    return { start, end: now };
  };

  // Filter transactions by period
  const { start, end } = getDateRange();
  const periodTransactions = transactions.filter((txn) => {
    const txnDate = new Date(txn.date);
    return txnDate >= start && txnDate <= end;
  });

  // Calculate totals
  const totalIncome = periodTransactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpenses = periodTransactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const netBalance = totalIncome - totalExpenses;

  // Category breakdown
  const categoryBreakdown = categories
    .map((cat) => {
      const catTransactions = periodTransactions.filter((t) => t.categoryId === cat.id);
      const total = catTransactions.reduce((sum, t) => sum + t.amount, 0);
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
    if (period === 'week') return 7;
    if (period === 'month') return new Date().getDate();
    // For year, calculate days from Jan 1 to today
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    return Math.ceil((now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  };

  const daysInPeriod = getDaysInPeriod();
  const avgDailyExpense = totalExpenses / daysInPeriod;
  const avgDailyIncome = totalIncome / daysInPeriod;

  // Savings rate
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;

  // Generate chart data
  const generateChartData = () => {
    const dataPoints: { date: string; balance: number }[] = [];
    const numPoints = period === 'week' ? 7 : period === 'month' ? 30 : 12;

    // Filter transactions by source
    let filteredTxns = periodTransactions;
    if (chartSource !== 'total') {
      filteredTxns = periodTransactions.filter((t) => t.accountId === chartSource);
    }

    // Sort transactions by date
    const sortedTxns = [...filteredTxns].sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Calculate cumulative balance for each point
    let runningBalance = 0;

    if (period === 'week' || period === 'month') {
      // Daily data points
      for (let i = 0; i < numPoints; i++) {
        const date = new Date(start);
        date.setDate(start.getDate() + i);

        // Sum all transactions up to this date
        const txnsUpToDate = sortedTxns.filter((t) =>
          new Date(t.date) <= date
        );

        runningBalance = txnsUpToDate.reduce((sum, t) => {
          return sum + (t.type === 'income' ? t.amount : -t.amount);
        }, 0);

        dataPoints.push({
          date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          balance: runningBalance,
        });
      }
    } else {
      // Monthly data points for year view
      for (let i = 0; i < 12; i++) {
        const date = new Date(start);
        date.setMonth(start.getMonth() + i);

        const txnsUpToDate = sortedTxns.filter((t) =>
          new Date(t.date) <= date
        );

        runningBalance = txnsUpToDate.reduce((sum, t) => {
          return sum + (t.type === 'income' ? t.amount : -t.amount);
        }, 0);

        dataPoints.push({
          date: date.toLocaleDateString('en-US', { month: 'short' }),
          balance: runningBalance,
        });
      }
    }

    return dataPoints;
  };

  const chartData = generateChartData();

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

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border">
        <div className="px-4 py-3">
          <h1 className="text-xl font-bold">Analytics</h1>
          <p className="text-xs text-muted-foreground">Financial insights and trends</p>
        </div>
      </header>

      <main className="px-4 py-4 space-y-4">
        {/* Period Selector */}
        <div className="flex gap-2">
          <Button
            variant={period === 'week' ? 'default' : 'outline'}
            size="sm"
            className="flex-1"
            onClick={() => setPeriod('week')}
          >
            Week
          </Button>
          <Button
            variant={period === 'month' ? 'default' : 'outline'}
            size="sm"
            className="flex-1"
            onClick={() => setPeriod('month')}
          >
            Month
          </Button>
          <Button
            variant={period === 'year' ? 'default' : 'outline'}
            size="sm"
            className="flex-1"
            onClick={() => setPeriod('year')}
          >
            Year
          </Button>
        </div>

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
                    tickFormatter={(value) => `$${value}`}
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
                    ${chartData[chartData.length - 1]?.balance.toFixed(2) || '0.00'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Change</p>
                  <p className={cn(
                    'text-lg font-bold',
                    (chartData[chartData.length - 1]?.balance - chartData[0]?.balance) >= 0 ? 'text-success' : 'text-destructive'
                  )}>
                    {(chartData[chartData.length - 1]?.balance - chartData[0]?.balance) >= 0 ? '+' : ''}
                    ${((chartData[chartData.length - 1]?.balance || 0) - (chartData[0]?.balance || 0)).toFixed(2)}
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
              <p className="text-2xl font-bold text-success">${totalIncome.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                ${avgDailyIncome.toFixed(2)}/day
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
              <p className="text-2xl font-bold text-destructive">${totalExpenses.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                ${avgDailyExpense.toFixed(2)}/day
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
                  {netBalance >= 0 ? '+' : ''}${netBalance.toFixed(2)}
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
                const IconComponent = ICONS[cat.icon as keyof typeof ICONS] || MoreHorizontal;

                return (
                  <div key={cat.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
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
                        <p className="text-sm font-semibold">${cat.total.toFixed(2)}</p>
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
                  </div>
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
                const IconComponent = ICONS[cat.icon as keyof typeof ICONS] || MoreHorizontal;
                const incomePercentage = totalIncome > 0 ? (cat.total / totalIncome) * 100 : 0;

                return (
                  <div key={cat.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
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
                      <p className="text-sm font-semibold text-success">${cat.total.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">
                        {incomePercentage.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                );
              })}
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

      <BottomNav />
    </div>
  );
}
