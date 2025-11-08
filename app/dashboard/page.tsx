'use client';

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
import { TrendingUp, TrendingDown, Plus, LogOut, Upload, Wallet } from 'lucide-react';
import { transactionRepository } from '@/core/repositories/TransactionRepository';
import { accountRepository } from '@/core/repositories/AccountRepository';
import { CreateTransactionInput, Transaction, Account } from '@/core/models';
import { convertMultipleCurrencies } from '@/shared/services/currencyService';

export default function DashboardPage() {
  const [user, setUser] = useState<{ uid: string; email: string; displayName?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddTransaction, setShowAddTransaction] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [stats, setStats] = useState({ income: 0, expenses: 0, balance: 0, transactionCount: 0 });
  const [totalBalanceUSD, setTotalBalanceUSD] = useState<number>(0);
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
      // Load accounts
      const userAccounts = await accountRepository.getByUserId(userId);
      setAccounts(userAccounts);

      // Calculate total balance in USD
      if (userAccounts.length > 0) {
        const balancesInUSD = await convertMultipleCurrencies(
          userAccounts.map((acc) => ({ amount: acc.balance, currency: acc.currency })),
          'USD'
        );
        setTotalBalanceUSD(balancesInUSD);
      } else {
        setTotalBalanceUSD(0);
      }

      // Load transactions
      const txns = await transactionRepository.getByUserId(userId, { limitCount: 10 });
      setTransactions(txns);

      // Get current month stats
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const endOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);
      const monthStats = await transactionRepository.getStats(userId, startOfMonth, endOfMonth);
      setStats(monthStats);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };

  const handleAddTransaction = async (data: CreateTransactionInput, currency: string) => {
    if (!user) return;

    try {
      await transactionRepository.create(user.uid, data, currency);

      // Update account balance
      const account = accounts.find((acc) => acc.id === data.accountId);
      if (account) {
        const balanceChange = data.type === 'income' ? data.amount : -data.amount;
        await accountRepository.updateBalance(account.id, account.balance + balanceChange);
      }

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
        <Card className="bg-gradient-to-br from-primary/20 to-primary/5">
          <CardHeader>
            <CardDescription>Total Balance (USD)</CardDescription>
            <CardTitle className="text-3xl">${totalBalanceUSD.toFixed(2)}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1 text-muted-foreground">
                <Wallet className="h-3 w-3" />
                <span>{accounts.length} account{accounts.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="flex items-center gap-1 text-success">
                <TrendingUp className="h-3 w-3" />
                <span>Income: ${stats.income.toFixed(2)}</span>
              </div>
              <div className="flex items-center gap-1 text-destructive">
                <TrendingDown className="h-3 w-3" />
                <span>Expenses: ${stats.expenses.toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Accounts Overview */}
        {accounts.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Accounts</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => router.push('/settings')}
                >
                  Manage
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {accounts.map((account) => (
                <Link
                  key={account.id}
                  href={`/accounts/${account.id}`}
                  className="flex items-center justify-between p-2 rounded-md bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{account.name}</p>
                      <p className="text-xs text-muted-foreground">{account.type}</p>
                    </div>
                  </div>
                  <p className="text-sm font-semibold">
                    {account.currency} {account.balance.toFixed(2)}
                  </p>
                </Link>
              ))}
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
                ${stats.expenses.toFixed(2)}
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
              <CardTitle>Recent Transactions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {transactions.slice(0, 5).map((txn) => (
                <div
                  key={txn.id}
                  className="flex items-center justify-between p-2 rounded-md bg-muted/30"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{txn.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(txn.date).toLocaleDateString()}
                    </p>
                  </div>
                  <p
                    className={`text-sm font-semibold ${
                      txn.type === 'income' ? 'text-success' : 'text-destructive'
                    }`}
                  >
                    {txn.type === 'income' ? '+' : '-'}${txn.amount.toFixed(2)}
                  </p>
                </div>
              ))}
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
