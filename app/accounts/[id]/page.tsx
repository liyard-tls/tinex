'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import BottomNav from '@/shared/components/layout/BottomNav';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/components/ui/Card';
import { Button } from '@/shared/components/ui';
import Modal from '@/shared/components/ui/Modal';
import { ArrowLeft, Wallet, Trash2, TrendingUp, TrendingDown } from 'lucide-react';
import { accountRepository } from '@/core/repositories/AccountRepository';
import { transactionRepository } from '@/core/repositories/TransactionRepository';
import { Account, Transaction, CURRENCIES } from '@/core/models';

export default function AccountDetailPage() {
  const params = useParams();
  const accountId = params.id as string;
  const router = useRouter();
  const [user, setUser] = useState<{ uid: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState<Account | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser({ uid: currentUser.uid });
        await loadAccountData(accountId, currentUser.uid);
      } else {
        router.push('/auth');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router, accountId]);

  const loadAccountData = async (accountId: string, userId: string) => {
    try {
      // Load account details
      const accountData = await accountRepository.getById(accountId);
      if (accountData && accountData.userId === userId) {
        setAccount(accountData);
      } else {
        router.push('/accounts');
        return;
      }

      // Load transactions for this account
      const accountTransactions = await transactionRepository.getByAccountId(accountId);
      setTransactions(accountTransactions);
    } catch (error) {
      console.error('Failed to load account data:', error);
    }
  };

  const handleSetDefault = async () => {
    if (!user || !account) return;

    try {
      await accountRepository.setDefault(user.uid, account.id);
      await loadAccountData(accountId, user.uid);
    } catch (error) {
      console.error('Failed to set default account:', error);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user || !account) return;

    try {
      await accountRepository.delete(account.id);
      router.push('/accounts');
    } catch (error) {
      console.error('Failed to delete account:', error);
    }
  };

  const getCurrencySymbol = (currency: string) => {
    return CURRENCIES.find((c) => c.value === currency)?.symbol || currency;
  };

  const getIncomeTotal = () => {
    return transactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
  };

  const getExpenseTotal = () => {
    return transactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
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

  if (!user || !account) return null;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border">
        <div className="px-4 py-3 flex items-center gap-3">
          <Link href="/accounts">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold">{account.name}</h1>
            <p className="text-xs text-muted-foreground capitalize">
              {account.type.replace('_', ' ')}
            </p>
          </div>
        </div>
      </header>

      <main className="px-4 py-4 space-y-4">
        {/* Account Balance Card */}
        <Card className="bg-gradient-to-br from-primary/20 to-primary/5">
          <CardHeader>
            <CardDescription>Current Balance</CardDescription>
            <CardTitle className="text-3xl">
              {getCurrencySymbol(account.currency)} {account.balance.toFixed(2)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1 text-success">
                <TrendingUp className="h-3 w-3" />
                <span>Income: {getCurrencySymbol(account.currency)}{getIncomeTotal().toFixed(2)}</span>
              </div>
              <div className="flex items-center gap-1 text-destructive">
                <TrendingDown className="h-3 w-3" />
                <span>Expenses: {getCurrencySymbol(account.currency)}{getExpenseTotal().toFixed(2)}</span>
              </div>
            </div>
            {account.isDefault && (
              <div className="mt-3">
                <span className="text-xs px-2 py-1 rounded bg-primary/20 text-primary">
                  Default Account
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Account Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Account Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Currency</span>
              <span className="text-sm font-medium">
                {CURRENCIES.find((c) => c.value === account.currency)?.label} ({account.currency})
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Type</span>
              <span className="text-sm font-medium capitalize">
                {account.type.replace('_', ' ')}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Transactions</span>
              <span className="text-sm font-medium">{transactions.length}</span>
            </div>
            {account.notes && (
              <div className="pt-2 border-t border-border">
                <p className="text-sm text-muted-foreground mb-1">Notes</p>
                <p className="text-sm">{account.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Account Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Account Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {!account.isDefault && (
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={handleSetDefault}
              >
                <Wallet className="h-4 w-4 mr-2" />
                Set as Default Account
              </Button>
            )}
            <Button
              variant="outline"
              className="w-full justify-start text-destructive hover:text-destructive"
              onClick={() => setShowDeleteConfirm(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Account
            </Button>
          </CardContent>
        </Card>

        {/* Transactions List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Transactions</CardTitle>
              <span className="text-xs text-muted-foreground">{transactions.length} total</span>
            </div>
          </CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground">No transactions yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {transactions.map((txn) => (
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
                      {txn.type === 'income' ? '+' : '-'}
                      {getCurrencySymbol(txn.currency)}
                      {txn.amount.toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete Account"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete <strong>{account.name}</strong>? This action cannot be undone.
          </p>
          {transactions.length > 0 && (
            <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20">
              <p className="text-sm text-destructive">
                Warning: This account has {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}.
                Deleting it may affect your financial records.
              </p>
            </div>
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setShowDeleteConfirm(false)}
            >
              Cancel
            </Button>
            <Button
              variant="default"
              className="flex-1 bg-destructive hover:bg-destructive/90"
              onClick={handleDeleteAccount}
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>

      <BottomNav />
    </div>
  );
}
