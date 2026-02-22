'use client';
import { MoreHorizontal, Check, X, Trash2, Pencil, TrendingUp, TrendingDown, Wallet, PiggyBank } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';

import BottomNav from '@/shared/components/layout/BottomNav';
import { useAuth } from '@/app/_providers/AuthProvider';
import PageHeader from '@/shared/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/components/ui/Card';
import { Button } from '@/shared/components/ui';
import Modal from '@/shared/components/ui/Modal';

import Input from '@/shared/components/ui/Input';
import { accountRepository } from '@/core/repositories/AccountRepository';
import { transactionRepository } from '@/core/repositories/TransactionRepository';
import { categoryRepository } from '@/core/repositories/CategoryRepository';
import { tagRepository } from '@/core/repositories/TagRepository';
import { Account, Transaction, Category, Tag, CURRENCIES } from '@/core/models';
import { CATEGORY_ICONS } from '@/shared/config/icons';


export default function AccountDetailPage() {
  const params = useParams();
  const accountId = params.id as string;
  const router = useRouter();
  const { user, authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState<Account | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editingBalance, setEditingBalance] = useState(false);
  const [newBalance, setNewBalance] = useState('');

  useEffect(() => {
    if (!user?.uid) return;
    loadAccountData(accountId, user.uid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, accountId]);

  const loadAccountData = async (accountId: string, userId: string) => {
    setLoading(true);
    try {
      // Load account details
      const accountData = await accountRepository.getById(accountId);
      if (accountData && accountData.userId === userId) {
        setAccount(accountData);
        console.log('Account loaded:', accountData);
      } else {
        console.warn('Account not found or unauthorized');
        router.push('/accounts');
        return;
      }

      // Load categories and tags
      const [userCategories, userTags] = await Promise.all([
        categoryRepository.getByUserId(userId),
        tagRepository.getByUserId(userId),
      ]);
      setCategories(userCategories);
      setTags(userTags);

      // Load transactions for this account
      console.log('Loading transactions for account:', accountId);
      const accountTransactions = await transactionRepository.getByAccountId(accountId, userId);
      console.log('Transactions loaded:', accountTransactions.length, accountTransactions);
      setTransactions(accountTransactions);
    } catch (error) {
      console.error('Failed to load account data:', error);
    } finally {
      setLoading(false);
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

  const handleToggleSaving = async () => {
    if (!user || !account) return;

    try {
      await accountRepository.update({
        id: account.id,
        isSaving: !account.isSaving,
      });
      await loadAccountData(accountId, user.uid);
    } catch (error) {
      console.error('Failed to toggle saving status:', error);
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

  const handleEditBalance = () => {
    if (!account) return;
    setNewBalance(account.balance.toString());
    setEditingBalance(true);
  };

  const handleSaveBalance = async () => {
    if (!user || !account) return;

    const parsedBalance = parseFloat(newBalance);
    if (isNaN(parsedBalance)) {
      alert('Please enter a valid number');
      return;
    }

    try {
      await accountRepository.updateBalance(account.id, parsedBalance);
      setEditingBalance(false);
      await loadAccountData(accountId, user.uid);
    } catch (error) {
      console.error('Failed to update balance:', error);
    }
  };

  const handleCancelEditBalance = () => {
    setEditingBalance(false);
    setNewBalance('');
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

  if (authLoading || loading) {
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
      <PageHeader
        title={account.name}
        description={account.type.replace('_', ' ')}
        backHref="/accounts"
      />

      <main className="px-4 py-4 space-y-4">
        {/* Account Balance Card */}
        <Card className="bg-gradient-to-br from-primary/20 to-primary/5">
          <CardHeader>
            <CardDescription>Current Balance</CardDescription>
            {editingBalance ? (
              <div className="flex items-center gap-2">
                <span className="text-xl">{getCurrencySymbol(account.currency)}</span>
                <Input
                  type="number"
                  step="0.01"
                  value={newBalance}
                  onChange={(e) => setNewBalance(e.target.value)}
                  className="text-2xl font-bold h-12"
                  autoFocus
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-10 w-10 p-0 text-success"
                  onClick={handleSaveBalance}
                >
                  <Check className="h-5 w-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-10 w-10 p-0 text-destructive"
                  onClick={handleCancelEditBalance}
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <CardTitle className="text-3xl">
                  {getCurrencySymbol(account.currency)} {account.balance.toFixed(2)}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={handleEditBalance}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
            )}
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
            <div className="mt-3 flex flex-wrap gap-2">
              {account.isDefault && (
                <span className="text-xs px-2 py-1 rounded bg-primary/20 text-primary">
                  Default Account
                </span>
              )}
              {account.isSaving && (
                <span className="text-xs px-2 py-1 rounded bg-amber-500/20 text-amber-500">
                  Saving Account
                </span>
              )}
            </div>
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
              className={`w-full justify-start ${account.isSaving ? 'text-amber-500 hover:text-amber-500' : ''}`}
              onClick={handleToggleSaving}
            >
              <PiggyBank className="h-4 w-4 mr-2" />
              {account.isSaving ? 'Remove from Savings' : 'Mark as Saving Account'}
            </Button>
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
                {transactions.map((txn) => {
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
                        {txn.type === 'income' ? '+' : '-'}
                        {getCurrencySymbol(txn.currency)}
                        {txn.amount.toFixed(2)}
                      </p>
                    </div>
                  );
                })}
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
