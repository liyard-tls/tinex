'use client';
import { MoreHorizontal, Plus, LogOut, Wallet, TrendingUp, TrendingDown, Upload } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Button } from '@/shared/components/ui';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/Card';
import BottomNav from '@/shared/components/layout/BottomNav';
import FAB from '@/shared/components/ui/FAB';
import Modal from '@/shared/components/ui/Modal';
import AddTransactionForm from '@/modules/transactions/AddTransactionForm';

import { transactionRepository } from '@/core/repositories/TransactionRepository';
import { accountRepository } from '@/core/repositories/AccountRepository';
import { categoryRepository } from '@/core/repositories/CategoryRepository';
import { tagRepository } from '@/core/repositories/TagRepository';
import { userSettingsRepository } from '@/core/repositories/UserSettingsRepository';
import { CreateTransactionInput, Transaction, Account, Category, Tag, UserSettings } from '@/core/models';
import { convertMultipleCurrencies, convertCurrency, formatCurrency } from '@/shared/services/currencyService';
import { cn } from '@/shared/utils/cn';
import { CATEGORY_ICONS } from '@/shared/config/icons';


export default function DashboardPage() {
  const [user, setUser] = useState<{ uid: string; email: string; displayName?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddTransaction, setShowAddTransaction] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
  const [stats, setStats] = useState({ income: 0, expenses: 0, balance: 0, transactionCount: 0 });
  const [totalBalance, setTotalBalance] = useState<number>(0);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser({
          uid: currentUser.uid,
          email: currentUser.email || '',
          displayName: currentUser.displayName || undefined,
        });
        await loadData(currentUser.uid);
      } else {
        router.push('/auth');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  const loadData = async (userId: string) => {
    try {
      // Load user settings first to get base currency
      const settings = await userSettingsRepository.getOrCreate(userId);
      setUserSettings(settings);

      // Load transactions first to calculate transaction counts per account
      const allTxns = await transactionRepository.getByUserId(userId);

      // Load accounts
      const userAccounts = await accountRepository.getByUserId(userId);

      // Calculate transaction count per account
      const accountsWithCount = userAccounts.map(account => ({
        ...account,
        transactionCount: allTxns.filter(txn => txn.accountId === account.id).length,
      }));

      // Sort by transaction count and take top 3
      const topAccounts = accountsWithCount
        .sort((a, b) => b.transactionCount - a.transactionCount)
        .slice(0, 3);

      setAccounts(topAccounts);

      // Calculate total balance in base currency
      if (userAccounts.length > 0) {
        const balancesConverted = await convertMultipleCurrencies(
          userAccounts.map((acc) => ({ amount: acc.balance, currency: acc.currency })),
          settings.baseCurrency
        );
        setTotalBalance(balancesConverted);
      } else {
        setTotalBalance(0);
      }

      // Load categories and tags
      const [userCategories, userTags] = await Promise.all([
        categoryRepository.getByUserId(userId),
        tagRepository.getByUserId(userId),
      ]);

      // If no categories exist, create default categories
      if (userCategories.length === 0) {
        await categoryRepository.createDefaultCategories(userId);
        // Reload categories after creating defaults
        const updatedCategories = await categoryRepository.getByUserId(userId);
        setCategories(updatedCategories);
      } else {
        setCategories(userCategories);
      }

      setTags(userTags);

      // Load recent transactions (limited to 10)
      const txns = await transactionRepository.getByUserId(userId, { limitCount: 10 });
      setTransactions(txns);

      // Get current month stats with currency conversion
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const endOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);
      endOfMonth.setHours(23, 59, 59, 999);

      // Filter transactions by month
      const monthTxns = allTxns.filter(txn => {
        // Convert Firestore Timestamp to Date if needed
        const txnDate = txn.date instanceof Date ? txn.date :
          (txn.date as { toDate: () => Date }).toDate();
        return txnDate >= startOfMonth && txnDate <= endOfMonth;
      });

      // Convert all transactions to base currency and calculate stats
      let income = 0;
      let expenses = 0;

      for (const txn of monthTxns) {
        const convertedAmount = await convertCurrency(txn.amount, txn.currency, settings.baseCurrency);
        if (txn.type === 'income') {
          income += convertedAmount;
        } else if (txn.type === 'expense') {
          expenses += convertedAmount;
        }
      }

      setStats({
        income,
        expenses,
        balance: income - expenses,
        transactionCount: monthTxns.length,
      });
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };

  const handleAddTransaction = async (data: CreateTransactionInput, currency: string) => {
    if (!user) return;

    try {
      await transactionRepository.create(user.uid, data, currency);

      // Reload data to reflect balance changes (repository handles balance updates automatically)
      await loadData(user.uid);
      setShowAddTransaction(false);
      setShowQuickActions(false);
    } catch (error) {
      console.error('Failed to add transaction:', error);
      throw error;
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.push('/');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

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
      {/* Compact Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border">
        <div className="px-4 py-3 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold">TineX</h1>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-4 py-4 space-y-4">
        {/* Balance Card */}
        <Card className={cn(
          "bg-gradient-to-br",
          totalBalance >= 0
            ? "from-primary/20 to-primary/5"
            : "from-destructive/20 to-destructive/5"
        )}>
          <CardHeader>
            <CardDescription>Total Balance ({userSettings?.baseCurrency || 'USD'})</CardDescription>
            <CardTitle className={cn(
              "text-3xl",
              totalBalance < 0 && "text-destructive"
            )}>
              {formatCurrency(totalBalance, userSettings?.baseCurrency || 'USD')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1 text-muted-foreground">
                <Wallet className="h-3 w-3" />
                <span>{accounts.length} account{accounts.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="flex items-center gap-1 text-success">
                <TrendingUp className="h-3 w-3" />
                <span>Income: {formatCurrency(stats.income, userSettings?.baseCurrency || 'USD')}</span>
              </div>
              <div className="flex items-center gap-1 text-destructive">
                <TrendingDown className="h-3 w-3" />
                <span>Expenses: {formatCurrency(stats.expenses, userSettings?.baseCurrency || 'USD')}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Accounts Overview - Top 3 by transaction count */}
        {accounts.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Top Accounts</CardTitle>
                <Link href="/accounts">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                  >
                    View All
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {accounts.map((account) => {
                  const AccountIcon = account.icon
                    ? CATEGORY_ICONS[account.icon as keyof typeof CATEGORY_ICONS] || Wallet
                    : Wallet;
                  const accountColor = account.color || '#6b7280';

                  return (
                  <Link
                    key={account.id}
                    href={`/accounts/${account.id}`}
                    className="block p-3 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div
                          className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: `${accountColor}20` }}
                        >
                          <AccountIcon className="h-4 w-4" style={{ color: accountColor }} />
                        </div>
                        <p className="text-sm font-medium truncate">{account.name}</p>
                      </div>
                      <p className="text-sm font-semibold flex-shrink-0">
                        {account.currency} {account.balance.toFixed(2)}
                      </p>
                    </div>
                  </Link>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* No Accounts Warning */}
        {accounts.length === 0 && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardHeader>
              <CardTitle className="text-base">No Accounts</CardTitle>
              <CardDescription>
                Create an account to start tracking transactions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="default"
                className="w-full"
                onClick={() => router.push('/settings')}
              >
                <Wallet className="h-4 w-4 mr-2" />
                Create Your First Account
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>This Month</CardDescription>
              <CardTitle className="text-2xl text-destructive">
                {formatCurrency(stats.expenses, userSettings?.baseCurrency || 'USD')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Spent</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Transactions</CardDescription>
              <CardTitle className="text-2xl">{stats.transactionCount}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">This month</p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Transactions */}
        {transactions.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Recent Transactions</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => router.push('/transactions')}
                >
                  View All
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {transactions.slice(0, 5).map((txn) => {
                const category = categories.find((c) => c.id === txn.categoryId);
                const IconComponent = category
                  ? CATEGORY_ICONS[category.icon as keyof typeof CATEGORY_ICONS] || MoreHorizontal
                  : MoreHorizontal;
                const transactionTags = tags.filter((t) => txn.tags?.includes(t.id));

                return (
                  <div
                    key={txn.id}
                    onClick={() => router.push(`/transactions/${txn.id}`)}
                    className="flex items-center gap-3 p-3 rounded-md bg-muted/30 relative overflow-hidden cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    {/* Side gradient bar */}
                    {category && (
                      <div
                        className="absolute left-0 top-0 bottom-0 w-1"
                        style={{
                          background: `linear-gradient(to bottom, ${category.color}, ${category.color}80)`,
                        }}
                      />
                    )}

                    {/* Category icon */}
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ml-2"
                      style={{ backgroundColor: category ? `${category.color}20` : '#6b728020' }}
                    >
                      <IconComponent
                        className="h-5 w-5"
                        style={{ color: category?.color || '#6b7280' }}
                      />
                    </div>

                    {/* Transaction details */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{txn.description}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-xs text-muted-foreground">
                          {new Date(txn.date).toLocaleDateString()} {new Date(txn.date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                        </p>
                        {transactionTags.length > 0 && (
                          <div className="flex gap-1 flex-wrap">
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
                    </div>

                    {/* Amount */}
                    <p
                      className={`text-sm font-semibold flex-shrink-0 ${
                        txn.type === 'income' ? 'text-success' : 'text-destructive'
                      }`}
                    >
                      {txn.type === 'income' ? '+' : '-'}${txn.amount.toFixed(2)}
                    </p>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {transactions.length === 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Get Started</CardTitle>
              <CardDescription>Add your first transaction to start tracking</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="default"
                className="w-full"
                onClick={() => setShowAddTransaction(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Transaction
              </Button>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Floating Action Button */}
      <FAB
        className="bottom-24 right-4"
        onClick={() => setShowQuickActions(!showQuickActions)}
      >
        <Plus className="h-6 w-6" />
      </FAB>

      {/* Quick Actions Menu */}
      {showQuickActions && (
        <div className="fixed bottom-40 right-4 z-40 flex flex-col gap-2">
          <button
            onClick={() => {
              setShowAddTransaction(true);
              setShowQuickActions(false);
            }}
            className="flex items-center gap-2 bg-card border border-border rounded-lg px-4 py-3 shadow-lg hover:bg-accent transition-colors"
          >
            <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center">
              <Plus className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-sm font-medium">Add Transaction</span>
          </button>
          <button
            onClick={() => router.push('/import')}
            className="flex items-center gap-2 bg-card border border-border rounded-lg px-4 py-3 shadow-lg hover:bg-accent transition-colors"
          >
            <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center">
              <Upload className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-sm font-medium">Import Statement</span>
          </button>
        </div>
      )}

      {/* Add Transaction Modal */}
      <Modal
        isOpen={showAddTransaction}
        onClose={() => setShowAddTransaction(false)}
        title="Add Transaction"
      >
        <AddTransactionForm
          onSubmit={handleAddTransaction}
          onCancel={() => setShowAddTransaction(false)}
          accounts={accounts}
        />
      </Modal>

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
