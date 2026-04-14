'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import BottomNav from '@/shared/components/layout/BottomNav';
import { Card, CardContent, CardTitle } from '@/shared/components/ui/Card';
import { Button } from '@/shared/components/ui';
import TransactionListItem from '@/shared/components/ui/TransactionListItem';
import { Filter, X, MoreHorizontal, ArrowLeft } from 'lucide-react';
import { transactionRepository } from '@/core/repositories/TransactionRepository';
import { categoryRepository } from '@/core/repositories/CategoryRepository';
import { tagRepository } from '@/core/repositories/TagRepository';
import { accountRepository } from '@/core/repositories/AccountRepository';
import { Transaction, Category, Tag, Account, SYSTEM_CATEGORIES } from '@/core/models';
import { cn } from '@/shared/utils/cn';
import { CATEGORY_ICONS } from '@/shared/config/icons';

function TransactionsContent() {
  const [user, setUser] = useState<{ uid: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [showCategoryPanel, setShowCategoryPanel] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

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
      const [txns, userCategories, userTags, userAccounts] = await Promise.all([
        transactionRepository.getByUserId(userId),
        categoryRepository.getByUserId(userId),
        tagRepository.getByUserId(userId),
        accountRepository.getByUserId(userId),
      ]);

      setTransactions(txns);
      setCategories(userCategories);
      setTags(userTags);
      setAccounts(userAccounts);
    } catch (error) {
      console.error('Failed to load transactions:', error);
    }
  };

  const getAccountName = (accountId: string) => {
    return accounts.find((acc) => acc.id === accountId)?.name || 'Unknown';
  };

  const handleCategoryIconClick = (e: React.MouseEvent, txn: Transaction) => {
    e.stopPropagation(); // Prevent navigation to transaction detail
    setSelectedTransaction(txn);
    setShowCategoryPanel(true);
  };

  const handleCategoryChange = async (categoryId: string) => {
    if (!user || !selectedTransaction) return;

    try {
      await transactionRepository.update({
        id: selectedTransaction.id,
        categoryId: categoryId,
      });
      setShowCategoryPanel(false);
      setSelectedTransaction(null);
      await loadData(user.uid);
    } catch (error) {
      console.error('Failed to update category:', error);
    }
  };

  // Get URL params for filtering
  const urlCategoryId = searchParams.get('categoryId');
  const urlStartDate = searchParams.get('startDate');
  const urlEndDate = searchParams.get('endDate');
  const returnTo = searchParams.get('returnTo');
  const showIgnored = searchParams.get('ignored') === 'true';

  const filteredTransactions = transactions.filter((txn) => {
    // Apply ignored filter from URL
    if (showIgnored) {
      // Get system category IDs (Transfer Out, Transfer In)
      const systemCategoryIds = categories
        .filter(cat =>
          cat.name === SYSTEM_CATEGORIES.TRANSFER_OUT ||
          cat.name === SYSTEM_CATEGORIES.TRANSFER_IN
        )
        .map(cat => cat.id);

      // Only show transactions that are excluded from analytics
      const isIgnored = txn.excludeFromAnalytics || systemCategoryIds.includes(txn.categoryId);
      if (!isIgnored) {
        return false;
      }
    }

    // Apply type filter
    if (filterType !== 'all' && txn.type !== filterType) {
      return false;
    }

    // Apply category filter from URL
    if (urlCategoryId && txn.categoryId !== urlCategoryId) {
      return false;
    }

    // Apply date range filter from URL
    if (urlStartDate && urlEndDate) {
      const txnDate = new Date(txn.date);
      const startDate = new Date(urlStartDate);
      const endDate = new Date(urlEndDate);
      if (txnDate < startDate || txnDate > endDate) {
        return false;
      }
    }

    return true;
  });

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

  if (!user) return null;

  // Check if filters are active
  const hasActiveFilters = urlCategoryId || (urlStartDate && urlEndDate) || showIgnored;
  const filteredCategory = urlCategoryId ? categories.find(c => c.id === urlCategoryId) : null;

  const clearFilters = () => {
    if (returnTo) {
      router.push(returnTo);
    } else {
      router.push('/transactions');
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border">
        <div className="px-4 py-3">
          <div className="flex items-center gap-3">
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={clearFilters}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <div className="flex-1">
              <h1 className="text-xl font-bold">All Transactions</h1>
              <p className="text-xs text-muted-foreground">
                {filteredTransactions.length} transaction{filteredTransactions.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="px-4 py-4 space-y-4">
        {/* Active Filter Indicator */}
        {hasActiveFilters && (
          <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium">Filtered View</p>
              {showIgnored && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Ignored transactions only
                </p>
              )}
              {filteredCategory && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Category: {filteredCategory.name}
                </p>
              )}
              {urlStartDate && urlEndDate && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {new Date(urlStartDate).toLocaleDateString()} - {new Date(urlEndDate).toLocaleDateString()}
                </p>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="gap-2"
            >
              <X className="h-4 w-4" />
              Clear
            </Button>
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
                {filterType === 'all'
                  ? 'Start adding transactions to see them here'
                  : `No ${filterType} transactions found`}
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
                        const category = categories.find((c) => c.id === txn.categoryId);
                        const transactionTags = tags.filter((t) => txn.tags?.includes(t.id));

                        return (
                          <TransactionListItem
                            key={txn.id}
                            transaction={txn}
                            category={category}
                            tags={transactionTags}
                            accountName={getAccountName(txn.accountId)}
                            onClick={() => {
                              // Build return URL with current filters
                              const params = new URLSearchParams();
                              if (urlCategoryId) params.set('categoryId', urlCategoryId);
                              if (urlStartDate) params.set('startDate', urlStartDate);
                              if (urlEndDate) params.set('endDate', urlEndDate);
                              if (returnTo) params.set('returnTo', returnTo);

                              const returnUrl = params.toString()
                                ? `/transactions?${params.toString()}`
                                : '/transactions';

                              router.push(`/transactions/${txn.id}?returnTo=${encodeURIComponent(returnUrl)}`);
                            }}
                            onCategoryIconClick={handleCategoryIconClick}
                          />
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
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-50"
            onClick={() => {
              setShowCategoryPanel(false);
              setSelectedTransaction(null);
            }}
          />
          {/* Panel */}
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

      <BottomNav />
    </div>
  );
}

export default function TransactionsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-3"></div>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    }>
      <TransactionsContent />
    </Suspense>
  );
}
