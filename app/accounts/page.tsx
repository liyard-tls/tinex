'use client';
import { MoreHorizontal, Plus, Wallet, ArrowRight, Tag as TagIcon, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import BottomNav from '@/shared/components/layout/BottomNav';
import PageHeader from '@/shared/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/Card';
import { Button } from '@/shared/components/ui';
import Modal from '@/shared/components/ui/Modal';
import FAB from '@/shared/components/ui/FAB';
import AddAccountForm from '@/modules/accounts/AddAccountForm';

import { accountRepository } from '@/core/repositories/AccountRepository';
import { CreateAccountInput, CURRENCIES } from '@/core/models';
import { formatCurrency } from '@/shared/services/currencyService';
import { cn } from '@/shared/utils/cn';
import { CATEGORY_ICONS } from '@/shared/config/icons';
import { useAuth } from '@/app/_providers/AuthProvider';
import { useAppData } from '@/app/_providers/AppDataProvider';


export default function AccountsPage() {
  const router = useRouter();
  const { user, authLoading } = useAuth();
  const { accounts, transactions, categories, dataLoading, refreshAccounts } = useAppData();
  const [showAddAccount, setShowAddAccount] = useState(false);

  const handleAddAccount = async (data: CreateAccountInput) => {
    if (!user) return;

    try {
      await accountRepository.create(user.uid, data);
      await refreshAccounts();
      setShowAddAccount(false);
    } catch (error) {
      console.error('Failed to add account:', error);
      throw error;
    }
  };

  if (authLoading || dataLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const getCurrencySymbol = (currency: string) => {
    return CURRENCIES.find((c) => c.value === currency)?.symbol || currency;
  };

  const getCategoryById = (categoryId: string) => {
    return categories.find((c) => c.id === categoryId);
  };

  // Sort transactions by date (newest first)
  const sortedTransactions = [...transactions].sort((a, b) => {
    const dateA = a.date instanceof Date ? a.date : new Date(a.date);
    const dateB = b.date instanceof Date ? b.date : new Date(b.date);
    return dateB.getTime() - dateA.getTime();
  });

  return (
    <div className="min-h-screen bg-background pb-20">
      <PageHeader title="Accounts" description="Manage your accounts" />

      <main className="px-4 py-4 space-y-4">
        {/* Accounts List - Compact */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your Accounts</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {accounts.length === 0 ? (
              <div className="text-center py-8 px-4">
                <Wallet className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground mb-3">No accounts yet</p>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setShowAddAccount(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Account
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {accounts.map((account) => {
                  const IconComponent = account.icon
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
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div
                          className="h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: `${accountColor}20` }}
                        >
                          <IconComponent className="h-4 w-4" style={{ color: accountColor }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-medium truncate">{account.name}</h3>
                            {account.isDefault && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-primary/20 text-primary flex-shrink-0">
                                Default
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground capitalize">
                            {account.type.replace('_', ' ')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="text-right">
                          <p className={cn(
                            "text-sm font-bold",
                            account.balance < 0 && "text-destructive"
                          )}>
                            {getCurrencySymbol(account.currency)} {account.balance.toFixed(2)}
                          </p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </Link>
                  );
                })}
                {/* Add Account Button inside card */}
                <button
                  onClick={() => setShowAddAccount(true)}
                  className="w-full p-3 flex items-center justify-center gap-2 text-sm text-primary hover:bg-muted/30 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Add Account
                </button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Categories Button */}
        <div className="mt-6">
          <Link href="/categories">
            <Button variant="outline" className="w-full">
              <TagIcon className="h-4 w-4 mr-2" />
              Manage Categories
            </Button>
          </Link>
        </div>

        {/* All Transactions */}
        {transactions.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">All Transactions</CardTitle>
                <Link href="/transactions">
                  <Button variant="ghost" size="sm" className="h-8 text-xs">
                    View All
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {sortedTransactions.slice(0, 10).map((transaction) => {
                  const category = getCategoryById(transaction.categoryId);
                  const account = accounts.find((a) => a.id === transaction.accountId);
                  const txnDate = transaction.date instanceof Date ? transaction.date : new Date(transaction.date);
                  const IconComponent = category
                    ? CATEGORY_ICONS[category.icon as keyof typeof CATEGORY_ICONS] || MoreHorizontal
                    : MoreHorizontal;

                  return (
                    <div
                      key={transaction.id}
                      onClick={() => router.push(`/transactions/${transaction.id}`)}
                      className="flex items-center gap-3 p-3 relative overflow-hidden hover:bg-muted/30 transition-colors cursor-pointer"
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
                        style={{
                          backgroundColor: category ? `${category.color}20` : '#6b728020',
                        }}
                      >
                        <IconComponent
                          className="h-5 w-5"
                          style={{ color: category?.color || '#6b7280' }}
                        />
                      </div>

                      {/* Transaction details */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{transaction.description}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-xs text-muted-foreground">
                            {txnDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                          </p>
                          <span className="text-xs text-muted-foreground">•</span>
                          <p className="text-xs text-muted-foreground">
                            {account?.name || 'Unknown'}
                          </p>
                          {category && (
                            <span className="text-xs text-muted-foreground">•</span>
                          )}
                          {category && (
                            <p className="text-xs text-muted-foreground">{category.name}</p>
                          )}
                        </div>
                      </div>

                      {/* Amount */}
                      <p
                        className={cn(
                          'text-sm font-semibold flex-shrink-0',
                          transaction.type === 'income' ? 'text-success' : 'text-destructive'
                        )}
                      >
                        {transaction.type === 'income' ? '+' : '-'}
                        {formatCurrency(transaction.amount, transaction.currency)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty State for Transactions */}
        {transactions.length === 0 && accounts.length > 0 && (
          <Card>
            <CardContent className="text-center py-8">
              <p className="text-sm text-muted-foreground">No transactions yet</p>
              <Link href="/transactions">
                <Button variant="default" size="sm" className="mt-3">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Transaction
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Floating Action Button */}
      <FAB
        className="bottom-24 right-4"
        onClick={() => setShowAddAccount(true)}
      >
        <Plus className="h-6 w-6" />
      </FAB>

      {/* Add Account Modal */}
      <Modal
        isOpen={showAddAccount}
        onClose={() => setShowAddAccount(false)}
        title="Add Account"
      >
        <AddAccountForm
          onSubmit={handleAddAccount}
          onCancel={() => setShowAddAccount(false)}
        />
      </Modal>

      <BottomNav />
    </div>
  );
}
