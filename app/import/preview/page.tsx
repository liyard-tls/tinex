'use client';
import { MoreHorizontal, ArrowLeft, Download, Save, Edit2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import BottomNav from '@/shared/components/layout/BottomNav';
import { Card, CardContent } from '@/shared/components/ui/Card';
import { Button } from '@/shared/components/ui';
import { Input } from '@/shared/components/ui';

import { ParsedTransaction } from '@/shared/services/trusteeParser';
import { transactionRepository } from '@/core/repositories/TransactionRepository';
import { importedTransactionRepository } from '@/core/repositories/ImportedTransactionRepository';
import { categoryRepository } from '@/core/repositories/CategoryRepository';
import { Category, CURRENCIES } from '@/core/models';
import { cn } from '@/shared/utils/cn';
import { CATEGORY_ICONS } from '@/shared/config/icons';
import { detectCategoryFromDescription } from '@/shared/utils/categoryMatcher';

// Helper function to get currency symbol
const getCurrencySymbol = (currency: string) => {
  return CURRENCIES.find((c) => c.value === currency)?.symbol || currency;
};


interface EditableTransaction extends ParsedTransaction {
  index: number;
  editing?: boolean;
  categoryId?: string;
  autoCategoryDetected?: boolean; // Track if category was auto-detected
}

export default function ImportPreviewPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ uid: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [transactions, setTransactions] = useState<EditableTransaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accountId, setAccountId] = useState('');
  const [source, setSource] = useState<'trustee' | 'monobank'>('trustee');
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [showCategoryPanel, setShowCategoryPanel] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<EditableTransaction | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser({ uid: currentUser.uid });

        // Load categories first
        const userCategories = await categoryRepository.getByUserId(currentUser.uid);
        setCategories(userCategories);

        await loadParsedTransactions(currentUser.uid);
      } else {
        router.push('/auth');
      }
      setLoading(false);
    });

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const loadParsedTransactions = async (userId: string) => {
    const stored = sessionStorage.getItem('parsedTransactions');
    if (!stored) {
      router.push('/import');
      return;
    }

    try {
      const data = JSON.parse(stored);

      // Load existing transactions for category matching
      const existingTransactions = await transactionRepository.getByUserId(userId);

      const txns: EditableTransaction[] = data.transactions.map((t: ParsedTransaction & { date: string }, idx: number) => {
        // Auto-detect category based on description
        const detectedCategoryId = detectCategoryFromDescription(
          t.description,
          t.type,
          existingTransactions
        );

        return {
          ...t,
          date: new Date(t.date),
          index: idx,
          categoryId: detectedCategoryId || '', // Use detected or empty
          autoCategoryDetected: !!detectedCategoryId, // Mark as auto-detected
        };
      });

      setTransactions(txns);
      setAccountId(data.accountId);
      setSource(data.source || 'trustee'); // Load source from sessionStorage

      // Select all by default
      setSelectedIndices(new Set(txns.map((_, idx) => idx)));
    } catch (error) {
      console.error('Failed to load parsed transactions:', error);
      router.push('/import');
    }
  };

  const toggleSelection = (index: number) => {
    const newSelected = new Set(selectedIndices);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedIndices(newSelected);
  };

  const toggleEdit = (index: number) => {
    setTransactions(txns =>
      txns.map(t =>
        t.index === index ? { ...t, editing: !t.editing } : t
      )
    );
  };

  const updateTransaction = (index: number, field: keyof EditableTransaction, value: string | number | Date) => {
    setTransactions(txns =>
      txns.map(t =>
        t.index === index ? { ...t, [field]: value } : t
      )
    );
  };

  const handleCategoryIconClick = (e: React.MouseEvent, txn: EditableTransaction) => {
    e.stopPropagation(); // Prevent toggling selection
    setSelectedTransaction(txn);
    setShowCategoryPanel(true);
  };

  const handleCategoryChange = (categoryId: string) => {
    if (!selectedTransaction) return;

    // Update category and remove auto-detection flag
    setTransactions(txns =>
      txns.map(t =>
        t.index === selectedTransaction.index
          ? { ...t, categoryId, autoCategoryDetected: false }
          : t
      )
    );
    setShowCategoryPanel(false);
    setSelectedTransaction(null);
  };

  const handleImport = async () => {
    if (!user) return;

    const selectedTransactions = transactions.filter(t => selectedIndices.has(t.index));
    if (selectedTransactions.length === 0) {
      alert('Please select at least one transaction to import');
      return;
    }

    setImporting(true);

    try {
      // Get existing hashes for the current source
      const existingHashes = await importedTransactionRepository.getImportedHashes(
        user.uid,
        source
      );

      let imported = 0;
      let duplicates = 0;
      let failed = 0;
      const duplicateDetails: Array<{
        description: string;
        amount: number;
        date: string;
        hash: string;
      }> = [];

      for (const parsed of selectedTransactions) {
        try {
          // Check for duplicate
          if (existingHashes.has(parsed.hash)) {
            duplicates++;
            duplicateDetails.push({
              description: parsed.description,
              amount: parsed.amount,
              date: parsed.date.toLocaleDateString(),
              hash: parsed.hash.substring(0, 8), // Show first 8 chars of hash
            });
            continue;
          }

          // Create transaction
          const transactionId = await transactionRepository.create(
            user.uid,
            {
              accountId,
              type: parsed.type,
              amount: parsed.amount,
              description: parsed.description,
              date: parsed.date,
              merchantName: parsed.description,
              categoryId: parsed.categoryId || '',
              tags: [],
            },
            parsed.currency
          );

          // Record import
          await importedTransactionRepository.create({
            userId: user.uid,
            transactionId,
            hash: parsed.hash,
            source: source, // Use dynamic source
            importDate: new Date(),
          });

          imported++;
        } catch (err) {
          console.error('Failed to import transaction:', err);
          failed++;
        }
      }

      // Clear session storage
      sessionStorage.removeItem('parsedTransactions');

      // Show results with duplicate details
      let message = `Import complete!\n\nImported: ${imported}\nDuplicates: ${duplicates}\nFailed: ${failed}`;

      if (duplicates > 0) {
        message += '\n\n--- Duplicate Transactions ---';
        duplicateDetails.forEach((dup, idx) => {
          message += `\n${idx + 1}. ${dup.description}\n   ${dup.amount} | ${dup.date}\n   Hash: ${dup.hash}...`;
        });
      }

      alert(message);
      router.push('/transactions');
    } catch (error) {
      console.error('Error importing transactions:', error);
      alert('Failed to import transactions');
    } finally {
      setImporting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container max-w-2xl mx-auto p-4 pb-20">
          <p className="text-center text-muted-foreground">Loading...</p>
        </div>
        <BottomNav />
      </div>
    );
  }

  const selectedCount = selectedIndices.size;
  const autoCategorizedCount = transactions.filter(t => t.autoCategoryDetected).length;

  // Group transactions by date
  const groupedTransactions = transactions.reduce((groups, txn) => {
    const date = txn.date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(txn);
    return groups;
  }, {} as Record<string, EditableTransaction[]>);

  return (
    <div className="min-h-screen bg-background pb-32">
      <div className="container max-w-2xl mx-auto p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="ghost"
            onClick={() => router.push('/import')}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <h1 className="text-xl font-bold">Review Transactions</h1>
          <div className="w-16"></div>
        </div>

        {/* Selection Summary */}
        <Card className="mb-4">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-sm font-medium">
                  {selectedCount} of {transactions.length} selected
                </p>
                <p className="text-xs text-muted-foreground">
                  Tap transactions to select/deselect
                </p>
              </div>
              <Button
                onClick={() => setSelectedIndices(
                  selectedIndices.size === transactions.length
                    ? new Set()
                    : new Set(transactions.map((_, idx) => idx))
                )}
                variant="outline"
                size="sm"
              >
                {selectedIndices.size === transactions.length ? 'Deselect All' : 'Select All'}
              </Button>
            </div>
            {autoCategorizedCount > 0 && (
              <div className="pt-2 border-t border-border">
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary font-medium">
                    Auto
                  </span>
                  {autoCategorizedCount} transaction{autoCategorizedCount !== 1 ? 's' : ''} auto-categorized based on previous transactions
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Transactions List grouped by date */}
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
                        ? CATEGORY_ICONS[category.icon as keyof typeof CATEGORY_ICONS] || MoreHorizontal
                        : MoreHorizontal;
                      const isSelected = selectedIndices.has(txn.index);

                      return txn.editing ? (
                        // Edit mode
                        <div key={txn.index} className="p-3 space-y-3 bg-muted/30">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-medium">Edit Transaction</p>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleEdit(txn.index)}
                            >
                              <Save className="h-4 w-4" />
                            </Button>
                          </div>

                          <div>
                            <label className="text-xs text-muted-foreground">Description</label>
                            <Input
                              value={txn.description}
                              onChange={(e) => updateTransaction(txn.index, 'description', e.target.value)}
                              className="mt-1"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-xs text-muted-foreground">Amount</label>
                              <Input
                                type="number"
                                step="0.01"
                                value={txn.amount}
                                onChange={(e) => updateTransaction(txn.index, 'amount', parseFloat(e.target.value))}
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground">Currency</label>
                              <Input
                                value={txn.currency}
                                onChange={(e) => updateTransaction(txn.index, 'currency', e.target.value)}
                                className="mt-1"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="text-xs text-muted-foreground">Category</label>
                            <select
                              value={txn.categoryId || ''}
                              onChange={(e) => updateTransaction(txn.index, 'categoryId', e.target.value)}
                              className="w-full mt-1 px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                            >
                              <option value="">No category</option>
                              {categories
                                .filter((c) => c.type === txn.type)
                                .map((cat) => (
                                  <option key={cat.id} value={cat.id}>
                                    {cat.name}
                                  </option>
                                ))}
                            </select>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <Button
                              variant={txn.type === 'expense' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => updateTransaction(txn.index, 'type', 'expense')}
                            >
                              Expense
                            </Button>
                            <Button
                              variant={txn.type === 'income' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => updateTransaction(txn.index, 'type', 'income')}
                            >
                              Income
                            </Button>
                          </div>
                        </div>
                      ) : (
                        // View mode
                        <div
                          key={txn.index}
                          onClick={() => toggleSelection(txn.index)}
                          className={cn(
                            'flex items-center gap-3 p-3 relative overflow-hidden hover:bg-muted/30 transition-colors cursor-pointer',
                            !isSelected && 'opacity-60'
                          )}
                        >
                          {category && (
                            <div
                              className="absolute left-0 top-0 bottom-0 w-1"
                              style={{
                                background: `linear-gradient(to bottom, ${category.color}, ${category.color}80)`,
                              }}
                            />
                          )}

                          <div
                            onClick={(e) => handleCategoryIconClick(e, txn)}
                            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ml-2 hover:ring-2 hover:ring-primary/50 transition-all cursor-pointer"
                            style={{
                              backgroundColor: category ? `${category.color}20` : '#6b728020',
                            }}
                            title="Click to change category"
                          >
                            <IconComponent
                              className="h-5 w-5"
                              style={{ color: category?.color || '#6b7280' }}
                            />
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{txn.description}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <p className="text-xs text-muted-foreground">
                                {txn.date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                              </p>
                              {category && (
                                <>
                                  <span className="text-xs text-muted-foreground">•</span>
                                  <p className="text-xs text-muted-foreground">{category.name}</p>
                                  {txn.autoCategoryDetected && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary font-medium">
                                      Auto
                                    </span>
                                  )}
                                </>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <p
                              className={cn(
                                'text-sm font-semibold flex-shrink-0',
                                txn.type === 'income' ? 'text-success' : 'text-destructive'
                              )}
                            >
                              {txn.type === 'income' ? '+' : '-'}
                              {getCurrencySymbol(txn.currency)} {txn.amount.toFixed(2)}
                            </p>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleEdit(txn.index);
                              }}
                              className="h-8 w-8 p-0"
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      </div>

      {/* Sticky Import Button */}
      <div className="fixed bottom-20 left-0 right-0 p-4 bg-background/95 backdrop-blur border-t border-border">
        <div className="container max-w-2xl mx-auto">
          <Button
            onClick={handleImport}
            disabled={importing || selectedCount === 0}
            className="w-full gap-2"
          >
            <Download className="h-4 w-4" />
            {importing ? 'Importing...' : `Import ${selectedCount} Transaction${selectedCount !== 1 ? 's' : ''}`}
          </Button>
        </div>
      </div>

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
                categories
                  .filter((c) => selectedTransaction && c.type === selectedTransaction.type)
                  .map((cat) => {
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
                          className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
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
