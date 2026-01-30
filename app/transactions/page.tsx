'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import BottomNav from '@/shared/components/layout/BottomNav';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import TransactionListItem from '@/shared/components/ui/TransactionListItem';
import { Filter, X, MoreHorizontal, ArrowLeft, Loader2 } from 'lucide-react';
import { transactionRepository } from '@/core/repositories/TransactionRepository';
import { categoryRepository } from '@/core/repositories/CategoryRepository';
import { tagRepository } from '@/core/repositories/TagRepository';
import { accountRepository } from '@/core/repositories/AccountRepository';
import { Transaction, Category, Tag, Account, SYSTEM_CATEGORIES } from '@/core/models';
import { CATEGORY_ICONS } from '@/shared/config/icons';

function TransactionsContent() {
  const [user, setUser] = useState<{ uid: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [showCategorySheet, setShowCategorySheet] = useState(false);
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
    e.stopPropagation();
    setSelectedTransaction(txn);
    setShowCategorySheet(true);
  };

  const handleCategoryChange = async (categoryId: string) => {
    if (!user || !selectedTransaction) return;

    try {
      await transactionRepository.update({
        id: selectedTransaction.id,
        categoryId: categoryId,
      });
      setShowCategorySheet(false);
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
    if (showIgnored) {
      const systemCategoryIds = categories
        .filter(
          (cat) =>
            cat.name === SYSTEM_CATEGORIES.TRANSFER_OUT ||
            cat.name === SYSTEM_CATEGORIES.TRANSFER_IN
        )
        .map((cat) => cat.id);

      const isIgnored = txn.excludeFromAnalytics || systemCategoryIds.includes(txn.categoryId);
      if (!isIgnored) {
        return false;
      }
    }

    if (filterType !== 'all' && txn.type !== filterType) {
      return false;
    }

    if (urlCategoryId && txn.categoryId !== urlCategoryId) {
      return false;
    }

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
  const groupedTransactions = filteredTransactions.reduce(
    (groups, txn) => {
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
    },
    {} as Record<string, Transaction[]>
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-sm text-muted-foreground">Loading transactions...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const hasActiveFilters = urlCategoryId || (urlStartDate && urlEndDate) || showIgnored;
  const filteredCategory = urlCategoryId ? categories.find((c) => c.id === urlCategoryId) : null;

  const clearFilters = () => {
    if (returnTo) {
      router.push(returnTo);
    } else {
      router.push('/transactions');
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container flex h-14 max-w-screen-2xl items-center px-4">
          <div className="flex items-center gap-3 flex-1">
            {hasActiveFilters && (
              <Button variant="ghost" size="icon" onClick={clearFilters}>
                <ArrowLeft className="h-4 w-4" />
                <span className="sr-only">Go back</span>
              </Button>
            )}
            <div className="flex-1">
              <h1 className="text-lg font-semibold md:text-xl">All Transactions</h1>
              <p className="text-xs text-muted-foreground">
                {filteredTransactions.length} transaction
                {filteredTransactions.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container max-w-screen-2xl px-4 py-6 space-y-6">
        {/* Active Filter Banner */}
        {hasActiveFilters && (
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1 flex-1">
                  <p className="text-sm font-medium">Filtered View</p>
                  <div className="flex flex-wrap gap-2">
                    {showIgnored && (
                      <Badge variant="secondary" className="text-xs">
                        Ignored only
                      </Badge>
                    )}
                    {filteredCategory && (
                      <Badge variant="secondary" className="text-xs">
                        {filteredCategory.name}
                      </Badge>
                    )}
                    {urlStartDate && urlEndDate && (
                      <Badge variant="secondary" className="text-xs">
                        {new Date(urlStartDate).toLocaleDateString()} -{' '}
                        {new Date(urlEndDate).toLocaleDateString()}
                      </Badge>
                    )}
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="h-4 w-4 mr-2" />
                  Clear
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filter Tabs */}
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
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Filter className="h-16 w-16 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Transactions</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                {filterType === 'all'
                  ? 'Start adding transactions to see them here'
                  : `No ${filterType} transactions found`}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedTransactions).map(([date, txns]) => (
              <div key={date} className="space-y-3">
                <div className="flex items-center gap-4">
                  <h2 className="text-sm font-semibold text-muted-foreground">{date}</h2>
                  <Separator className="flex-1" />
                </div>
                <Card>
                  <CardContent className="p-0 divide-y">
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
                            const params = new URLSearchParams();
                            if (urlCategoryId) params.set('categoryId', urlCategoryId);
                            if (urlStartDate) params.set('startDate', urlStartDate);
                            if (urlEndDate) params.set('endDate', urlEndDate);
                            if (returnTo) params.set('returnTo', returnTo);

                            const returnUrl = params.toString()
                              ? `/transactions?${params.toString()}`
                              : '/transactions';

                            router.push(
                              `/transactions/${txn.id}?returnTo=${encodeURIComponent(returnUrl)}`
                            );
                          }}
                          onCategoryIconClick={handleCategoryIconClick}
                        />
                      );
                    })}
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Category Selection Sheet */}
      <Sheet open={showCategorySheet} onOpenChange={setShowCategorySheet}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Change Category</SheetTitle>
            {selectedTransaction && (
              <SheetDescription className="truncate">{selectedTransaction.description}</SheetDescription>
            )}
          </SheetHeader>
          <div className="mt-6 space-y-2">
            {categories.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No categories available
              </p>
            ) : (
              categories.map((cat) => {
                const CatIcon =
                  CATEGORY_ICONS[cat.icon as keyof typeof CATEGORY_ICONS] || MoreHorizontal;
                const isSelected = selectedTransaction?.categoryId === cat.id;
                return (
                  <Button
                    key={cat.id}
                    variant={isSelected ? 'secondary' : 'ghost'}
                    className="w-full justify-start h-auto py-3"
                    onClick={() => handleCategoryChange(cat.id)}
                  >
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center mr-3"
                      style={{ backgroundColor: `${cat.color}20` }}
                    >
                      <CatIcon className="h-5 w-5" style={{ color: cat.color }} />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-medium">{cat.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{cat.type}</p>
                    </div>
                    {isSelected && (
                      <Badge variant="outline" className="ml-2">
                        Current
                      </Badge>
                    )}
                  </Button>
                );
              })
            )}
          </div>
        </SheetContent>
      </Sheet>

      <BottomNav />
    </div>
  );
}

export default function TransactionsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
        </div>
      }
    >
      <TransactionsContent />
    </Suspense>
  );
}
