'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import BottomNav from '@/shared/components/layout/BottomNav';
import { Card, CardContent, CardTitle } from '@/shared/components/ui/Card';
import { Button } from '@/shared/components/ui';
import {
  DollarSign,
  Briefcase,
  TrendingUp,
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
  Filter,
} from 'lucide-react';
import { transactionRepository } from '@/core/repositories/TransactionRepository';
import { categoryRepository } from '@/core/repositories/CategoryRepository';
import { tagRepository } from '@/core/repositories/TagRepository';
import { accountRepository } from '@/core/repositories/AccountRepository';
import { Transaction, Category, Tag, Account } from '@/core/models';
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

export default function TransactionsPage() {
  const [user, setUser] = useState<{ uid: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
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

  const filteredTransactions = transactions.filter((txn) => {
    if (filterType === 'all') return true;
    return txn.type === filterType;
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

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border">
        <div className="px-4 py-3">
          <h1 className="text-xl font-bold">All Transactions</h1>
          <p className="text-xs text-muted-foreground">
            {filteredTransactions.length} transaction{filteredTransactions.length !== 1 ? 's' : ''}
          </p>
        </div>
      </header>

      <main className="px-4 py-4 space-y-4">
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
                        const IconComponent = category
                          ? ICONS[category.icon as keyof typeof ICONS] || MoreHorizontal
                          : MoreHorizontal;
                        const transactionTags = tags.filter((t) => txn.tags?.includes(t.id));

                        return (
                          <div
                            key={txn.id}
                            className="flex items-center gap-3 p-3 relative overflow-hidden hover:bg-muted/30 transition-colors"
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
                              className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ml-2"
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
                              <p className="text-sm font-medium truncate">{txn.description}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <p className="text-xs text-muted-foreground">
                                  {new Date(txn.date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                                </p>
                                <span className="text-xs text-muted-foreground">•</span>
                                <p className="text-xs text-muted-foreground">
                                  {getAccountName(txn.accountId)}
                                </p>
                                {category && (
                                  <span className="text-xs text-muted-foreground">•</span>
                                )}
                                {category && (
                                  <p className="text-xs text-muted-foreground">{category.name}</p>
                                )}
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
                              {txn.type === 'income' ? '+' : '-'}${txn.amount.toFixed(2)}
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

      <BottomNav />
    </div>
  );
}
