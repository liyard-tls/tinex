'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import BottomNav from '@/shared/components/layout/BottomNav';
import { Card, CardContent } from '@/shared/components/ui/Card';
import { Button } from '@/shared/components/ui';
import {
  ArrowLeft,
  ChevronRight,
  ChevronLeft,
  Download,
  MoreHorizontal,
  X,
  Plus,
} from 'lucide-react';
import { QIFTransaction } from '@/modules/parsers/implementations/qif';
import { transactionRepository } from '@/core/repositories/TransactionRepository';
import { importedTransactionRepository } from '@/core/repositories/ImportedTransactionRepository';
import { categoryRepository } from '@/core/repositories/CategoryRepository';
import { accountRepository } from '@/core/repositories/AccountRepository';
import { Category, Account, CURRENCIES, SYSTEM_CATEGORIES, CreateCategoryInput, CategoryType } from '@/core/models';
import { cn } from '@/shared/utils/cn';
import { CATEGORY_ICONS, ICON_OPTIONS } from '@/shared/config/icons';
import { matchCategoryByName } from '@/shared/utils/categoryMatcher';

const CATEGORY_COLORS = [
  '#ef4444', // red
  '#f59e0b', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#10b981', // emerald
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#a855f7', // purple
  '#ec4899', // pink
  '#6b7280', // gray
];

interface StoredAccountData {
  account: {
    name: string;
    type: string;
  };
  appAccountId: string;
  transactions: (Omit<QIFTransaction, 'date'> & { date: string })[];
}

interface StoredQIFData {
  accounts: StoredAccountData[];
  mappings: {
    qifAccountName: string;
    appAccountId: string;
    transactionCount: number;
  }[];
  timestamp: number;
}

interface EditableTransaction extends QIFTransaction {
  index: number;
  categoryId?: string;
  autoCategoryDetected?: boolean;
  selected: boolean;
}

interface AccountPreviewData {
  qifAccountName: string;
  appAccountId: string;
  appAccount?: Account;
  transactions: EditableTransaction[];
}

export default function QIFPreviewPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ uid: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [categories, setCategories] = useState<Category[]>([]);
  const [accountsData, setAccountsData] = useState<AccountPreviewData[]>([]);
  const [currentAccountIndex, setCurrentAccountIndex] = useState(0);
  const [showCategoryPanel, setShowCategoryPanel] = useState(false);
  const [selectedTransaction, setSelectedTransaction] =
    useState<EditableTransaction | null>(null);
  const [showCreateCategory, setShowCreateCategory] = useState(false);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryIcon, setNewCategoryIcon] = useState('MoreHorizontal');
  const [newCategoryColor, setNewCategoryColor] = useState(CATEGORY_COLORS[0]);
  const [importResults, setImportResults] = useState<{
    imported: number;
    duplicates: number;
    failed: number;
  } | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser({ uid: currentUser.uid });

        // Load categories
        const userCategories = await categoryRepository.getByUserId(
          currentUser.uid
        );
        setCategories(userCategories);

        await loadStoredData(currentUser.uid, userCategories);
      } else {
        router.push('/auth');
      }
      setLoading(false);
    });

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const loadStoredData = async (userId: string, userCategories: Category[]) => {
    const stored = sessionStorage.getItem('qifImportData');
    if (!stored) {
      router.push('/import/qif');
      return;
    }

    try {
      const data: StoredQIFData = JSON.parse(stored);

      // Load app accounts
      const userAccounts = await accountRepository.getByUserId(userId);

      // Find Transfer Out and Transfer In categories
      const transferOutCategory = userCategories.find(
        (c) => c.name === SYSTEM_CATEGORIES.TRANSFER_OUT
      );
      const transferInCategory = userCategories.find(
        (c) => c.name === SYSTEM_CATEGORIES.TRANSFER_IN
      );

      // Process each account
      const processedAccounts: AccountPreviewData[] = data.accounts.map(
        (acc) => {
          const appAccount = userAccounts.find(
            (a) => a.id === acc.appAccountId
          );

          const transactions: EditableTransaction[] = acc.transactions.map(
            (t, idx) => {
              const txn: EditableTransaction = {
                ...t,
                date: new Date(t.date),
                index: idx,
                selected: true,
                categoryId: undefined,
                autoCategoryDetected: false,
              };

              // Handle transfers
              if (t.isTransfer) {
                if (t.type === 'expense') {
                  // Transfer Out
                  txn.categoryId = transferOutCategory?.id;
                } else {
                  // Transfer In
                  txn.categoryId = transferInCategory?.id;
                }
                txn.autoCategoryDetected = !!txn.categoryId;
              } else if (t.category) {
                // Try to match category from QIF to existing categories
                const matchedCategoryId = matchCategoryByName(
                  t.category,
                  userCategories,
                  t.type
                );
                if (matchedCategoryId) {
                  txn.categoryId = matchedCategoryId;
                  txn.autoCategoryDetected = true;
                }
              }

              return txn;
            }
          );

          return {
            qifAccountName: acc.account.name,
            appAccountId: acc.appAccountId,
            appAccount,
            transactions,
          };
        }
      );

      setAccountsData(processedAccounts);
    } catch (error) {
      console.error('Failed to load QIF data:', error);
      router.push('/import/qif');
    }
  };

  const currentAccount = accountsData[currentAccountIndex];
  const totalAccounts = accountsData.length;

  const toggleSelection = (index: number) => {
    setAccountsData((prev) =>
      prev.map((acc, accIdx) =>
        accIdx === currentAccountIndex
          ? {
              ...acc,
              transactions: acc.transactions.map((t) =>
                t.index === index ? { ...t, selected: !t.selected } : t
              ),
            }
          : acc
      )
    );
  };

  const toggleSelectAll = () => {
    if (!currentAccount) return;
    const allSelected = currentAccount.transactions.every((t) => t.selected);
    setAccountsData((prev) =>
      prev.map((acc, accIdx) =>
        accIdx === currentAccountIndex
          ? {
              ...acc,
              transactions: acc.transactions.map((t) => ({
                ...t,
                selected: !allSelected,
              })),
            }
          : acc
      )
    );
  };

  const handleCategoryIconClick = (
    e: React.MouseEvent,
    txn: EditableTransaction
  ) => {
    e.stopPropagation();
    setSelectedTransaction(txn);
    setShowCategoryPanel(true);
  };

  const handleCategoryChange = (categoryId: string) => {
    if (!selectedTransaction) return;

    setAccountsData((prev) =>
      prev.map((acc, accIdx) =>
        accIdx === currentAccountIndex
          ? {
              ...acc,
              transactions: acc.transactions.map((t) =>
                t.index === selectedTransaction.index
                  ? { ...t, categoryId, autoCategoryDetected: false }
                  : t
              ),
            }
          : acc
      )
    );
    setShowCategoryPanel(false);
    setSelectedTransaction(null);
  };

  const handleCreateCategory = async () => {
    if (!user || !newCategoryName.trim() || !selectedTransaction) return;

    setCreatingCategory(true);
    try {
      const categoryType: CategoryType = selectedTransaction.type;
      const newCategory: CreateCategoryInput = {
        name: newCategoryName.trim(),
        type: categoryType,
        icon: newCategoryIcon,
        color: newCategoryColor,
      };

      const newCategoryId = await categoryRepository.create(user.uid, newCategory);

      // Reload categories
      const userCategories = await categoryRepository.getByUserId(user.uid);
      setCategories(userCategories);

      // Auto-select the new category for the current transaction
      handleCategoryChange(newCategoryId);

      // Reset form
      setNewCategoryName('');
      setNewCategoryIcon('MoreHorizontal');
      setNewCategoryColor(CATEGORY_COLORS[0]);
      setShowCreateCategory(false);
    } catch (error) {
      console.error('Failed to create category:', error);
    } finally {
      setCreatingCategory(false);
    }
  };

  const handleImportCurrentAccount = async () => {
    if (!user || !currentAccount) return;

    const selectedTransactions = currentAccount.transactions.filter(
      (t) => t.selected
    );
    if (selectedTransactions.length === 0) {
      alert('Please select at least one transaction to import');
      return;
    }

    setImporting(true);
    setImportProgress({ current: 0, total: selectedTransactions.length });

    try {
      // Get account currency
      const currency = currentAccount.appAccount?.currency || 'EUR';

      // Get existing hashes
      const existingHashes = await importedTransactionRepository.getImportedHashes(
        user.uid,
        'homebank-qif'
      );

      // Find Transfer In/Out categories
      const transferOutCategory = categories.find(
        (c) => c.name === SYSTEM_CATEGORIES.TRANSFER_OUT
      );
      const transferInCategory = categories.find(
        (c) => c.name === SYSTEM_CATEGORIES.TRANSFER_IN
      );

      // Build a map of QIF account names to app account IDs
      const qifToAppAccountMap: Record<string, { id: string; currency: string }> = {};
      for (const accData of accountsData) {
        if (accData.appAccountId && accData.appAccount) {
          qifToAppAccountMap[accData.qifAccountName] = {
            id: accData.appAccountId,
            currency: accData.appAccount.currency,
          };
        }
      }

      let imported = 0;
      let duplicates = 0;
      let failed = 0;

      for (let i = 0; i < selectedTransactions.length; i++) {
        const txn = selectedTransactions[i];
        setImportProgress({ current: i + 1, total: selectedTransactions.length });

        try {
          if (existingHashes.has(txn.hash)) {
            duplicates++;
            continue;
          }

          // Build description - prefer memo, then category name, fallback to 'No description'
          // Don't use payee as description (it's usually just the account owner name)
          let description = txn.memo || '';

          // For transfers, use "To [Account]" or "From [Account]"
          if (txn.isTransfer && txn.transferAccount) {
            if (txn.type === 'expense') {
              description = `To ${txn.transferAccount}`;
            } else {
              description = `From ${txn.transferAccount}`;
            }
          } else if (!description) {
            // If no memo and not a transfer, use category name as description
            const category = categories.find((c) => c.id === txn.categoryId);
            description = category?.name || txn.category || 'No description';
          }

          const transactionId = await transactionRepository.create(
            user.uid,
            {
              accountId: currentAccount.appAccountId,
              type: txn.type,
              amount: txn.amount,
              description,
              date: txn.date,
              merchantName: txn.memo || description,
              categoryId: txn.categoryId || '',
              tags: [],
            },
            currency
          );

          await importedTransactionRepository.create({
            userId: user.uid,
            transactionId,
            hash: txn.hash,
            source: 'homebank-qif',
            importDate: new Date(),
          });

          // Auto-create paired transaction for transfers between mapped accounts
          if (txn.isTransfer && txn.transferAccount) {
            const targetAccount = qifToAppAccountMap[txn.transferAccount];
            if (targetAccount) {
              // Create the opposite transaction in the target account
              const pairedType = txn.type === 'expense' ? 'income' : 'expense';
              const pairedDescription = txn.type === 'expense'
                ? `From ${currentAccount.qifAccountName}`
                : `To ${currentAccount.qifAccountName}`;
              const pairedCategoryId = txn.type === 'expense'
                ? transferInCategory?.id
                : transferOutCategory?.id;

              // Create a unique hash for the paired transaction
              const pairedHash = `${txn.hash}-paired`;

              // Check if paired transaction already exists
              if (!existingHashes.has(pairedHash)) {
                const pairedTransactionId = await transactionRepository.create(
                  user.uid,
                  {
                    accountId: targetAccount.id,
                    type: pairedType,
                    amount: txn.amount,
                    description: pairedDescription,
                    date: txn.date,
                    merchantName: pairedDescription,
                    categoryId: pairedCategoryId || '',
                    tags: [],
                  },
                  targetAccount.currency
                );

                await importedTransactionRepository.create({
                  userId: user.uid,
                  transactionId: pairedTransactionId,
                  hash: pairedHash,
                  source: 'homebank-qif',
                  importDate: new Date(),
                });
              }
            }
          }

          imported++;
        } catch (err) {
          console.error('Failed to import transaction:', err);
          failed++;
        }
      }

      setImportResults({ imported, duplicates, failed });
      setImportProgress({ current: 0, total: 0 });

      // Move to next account or finish
      if (currentAccountIndex < totalAccounts - 1) {
        setTimeout(() => {
          setCurrentAccountIndex((prev) => prev + 1);
          setImportResults(null);
        }, 1500);
      } else {
        // All done
        setTimeout(() => {
          sessionStorage.removeItem('qifImportData');
          router.push('/transactions');
        }, 1500);
      }
    } catch (error) {
      console.error('Error importing transactions:', error);
      alert('Failed to import transactions');
    } finally {
      setImporting(false);
      setImportProgress({ current: 0, total: 0 });
    }
  };

  const getCurrencySymbol = (currency: string) => {
    return CURRENCIES.find((c) => c.value === currency)?.symbol || currency;
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

  if (!currentAccount) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container max-w-2xl mx-auto p-4 pb-20">
          <p className="text-center text-muted-foreground">No data found</p>
        </div>
        <BottomNav />
      </div>
    );
  }

  const selectedCount = currentAccount.transactions.filter(
    (t) => t.selected
  ).length;
  const autoCategorizedCount = currentAccount.transactions.filter(
    (t) => t.autoCategoryDetected
  ).length;

  // Group transactions by date
  const groupedTransactions = currentAccount.transactions.reduce(
    (groups, txn) => {
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
    },
    {} as Record<string, EditableTransaction[]>
  );

  return (
    <div className="min-h-screen bg-background pb-32">
      <div className="container max-w-2xl mx-auto p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <Button
            variant="ghost"
            onClick={() => router.push('/import/qif')}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <h1 className="text-lg font-bold">Import Transactions</h1>
          <div className="w-16"></div>
        </div>

        {/* Account Navigation */}
        <Card className="mb-4">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                disabled={currentAccountIndex === 0}
                onClick={() => setCurrentAccountIndex((prev) => prev - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="text-center">
                <p className="font-semibold">
                  {currentAccount.qifAccountName}
                </p>
                <p className="text-xs text-muted-foreground">
                  Account {currentAccountIndex + 1} of {totalAccounts} •{' '}
                  {currentAccount.appAccount?.name} (
                  {currentAccount.appAccount?.currency})
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                disabled={currentAccountIndex === totalAccounts - 1}
                onClick={() => setCurrentAccountIndex((prev) => prev + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Import Results */}
        {importResults && (
          <Card className="mb-4 border-primary">
            <CardContent className="p-4">
              <div className="text-center">
                <p className="font-semibold text-primary mb-2">
                  Import Complete!
                </p>
                <div className="flex justify-center gap-4 text-sm">
                  <span>Imported: {importResults.imported}</span>
                  <span className="text-muted-foreground">
                    Duplicates: {importResults.duplicates}
                  </span>
                  {importResults.failed > 0 && (
                    <span className="text-destructive">
                      Failed: {importResults.failed}
                    </span>
                  )}
                </div>
                {currentAccountIndex < totalAccounts - 1 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Moving to next account...
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Selection Summary */}
        <Card className="mb-4">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-sm font-medium">
                  {selectedCount} of {currentAccount.transactions.length}{' '}
                  selected
                </p>
                <p className="text-xs text-muted-foreground">
                  Tap transactions to select/deselect
                </p>
              </div>
              <Button onClick={toggleSelectAll} variant="outline" size="sm">
                {currentAccount.transactions.every((t) => t.selected)
                  ? 'Deselect All'
                  : 'Select All'}
              </Button>
            </div>
            {autoCategorizedCount > 0 && (
              <div className="pt-2 border-t border-border">
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary font-medium">
                    Auto
                  </span>
                  {autoCategorizedCount} transaction
                  {autoCategorizedCount !== 1 ? 's' : ''} auto-categorized
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Transactions List */}
        <div className="space-y-6">
          {Object.entries(groupedTransactions).map(([date, txns]) => (
            <div key={date}>
              <h2 className="text-sm font-semibold text-muted-foreground mb-2 px-1">
                {date}
              </h2>
              <Card>
                <CardContent className="p-0">
                  <div className="divide-y divide-border">
                    {txns.map((txn) => {
                      const category = categories.find(
                        (c) => c.id === txn.categoryId
                      );
                      const IconComponent = category
                        ? CATEGORY_ICONS[
                            category.icon as keyof typeof CATEGORY_ICONS
                          ] || MoreHorizontal
                        : MoreHorizontal;

                      return (
                        <div
                          key={txn.index}
                          onClick={() => toggleSelection(txn.index)}
                          className={cn(
                            'flex items-center gap-3 p-3 relative overflow-hidden hover:bg-muted/30 transition-colors cursor-pointer',
                            !txn.selected && 'opacity-60'
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
                              backgroundColor: category
                                ? `${category.color}20`
                                : '#6b728020',
                            }}
                            title="Click to change category"
                          >
                            <IconComponent
                              className="h-5 w-5"
                              style={{ color: category?.color || '#6b7280' }}
                            />
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {txn.isTransfer && txn.transferAccount
                                ? txn.type === 'expense'
                                  ? `To ${txn.transferAccount}`
                                  : `From ${txn.transferAccount}`
                                : txn.memo || category?.name || txn.category || 'No description'}
                            </p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              {category && (
                                <>
                                  <p className="text-xs text-muted-foreground">
                                    {category.name}
                                  </p>
                                  {txn.autoCategoryDetected && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary font-medium">
                                      Auto
                                    </span>
                                  )}
                                </>
                              )}
                              {txn.isTransfer && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-medium">
                                  Transfer
                                </span>
                              )}
                              {txn.category && !txn.isTransfer && (
                                <span className="text-[10px] text-muted-foreground/70 italic">
                                  QIF: {txn.category}
                                </span>
                              )}
                            </div>
                          </div>

                          <p
                            className={cn(
                              'text-sm font-semibold flex-shrink-0',
                              txn.type === 'income'
                                ? 'text-success'
                                : 'text-destructive'
                            )}
                          >
                            {txn.type === 'income' ? '+' : '-'}
                            {getCurrencySymbol(
                              currentAccount.appAccount?.currency || 'EUR'
                            )}{' '}
                            {txn.amount.toFixed(2)}
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
      </div>

      {/* Sticky Import Button */}
      <div className="fixed bottom-20 left-0 right-0 p-4 bg-background/95 backdrop-blur border-t border-border">
        <div className="container max-w-2xl mx-auto">
          {/* Progress Bar */}
          {importing && importProgress.total > 0 && (
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">Importing...</span>
                <span className="text-xs font-medium">
                  {importProgress.current}/{importProgress.total}
                </span>
              </div>
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-200"
                  style={{
                    width: `${(importProgress.current / importProgress.total) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}
          <Button
            onClick={handleImportCurrentAccount}
            disabled={importing || selectedCount === 0}
            className="w-full gap-2"
          >
            <Download className="h-4 w-4" />
            {importing
              ? `Importing ${importProgress.current}/${importProgress.total}...`
              : `Import ${selectedCount} Transaction${
                  selectedCount !== 1 ? 's' : ''
                }`}
          </Button>
          {currentAccountIndex < totalAccounts - 1 && !importing && (
            <p className="text-xs text-center text-muted-foreground mt-2">
              After import, you&apos;ll proceed to the next account
            </p>
          )}
        </div>
      </div>

      {/* Category Selection Side Panel */}
      {showCategoryPanel && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-50"
            onClick={() => {
              setShowCategoryPanel(false);
              setSelectedTransaction(null);
              setShowCreateCategory(false);
            }}
          />
          <div className="fixed right-0 top-0 bottom-0 w-80 bg-background border-l border-border z-50 shadow-xl animate-in slide-in-from-right">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="font-semibold">
                  {showCreateCategory ? 'Create Category' : 'Change Category'}
                </h3>
                {selectedTransaction && !showCreateCategory && (
                  <p className="text-xs text-muted-foreground mt-1 truncate">
                    {selectedTransaction.memo ||
                      selectedTransaction.payee ||
                      'No description'}
                  </p>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => {
                  if (showCreateCategory) {
                    setShowCreateCategory(false);
                  } else {
                    setShowCategoryPanel(false);
                    setSelectedTransaction(null);
                  }
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-4 space-y-2 overflow-y-auto max-h-[calc(100vh-80px)]">
              {showCreateCategory ? (
                /* Create Category Form */
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium mb-1.5">Name</label>
                    <input
                      type="text"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="Category name"
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-1.5">Icon</label>
                    <div className="grid grid-cols-6 gap-1.5 max-h-24 overflow-y-auto p-2 border border-border rounded-md">
                      {ICON_OPTIONS.slice(0, 30).map((iconName) => {
                        const IconComp = CATEGORY_ICONS[iconName as keyof typeof CATEGORY_ICONS];
                        return (
                          <button
                            key={iconName}
                            type="button"
                            onClick={() => setNewCategoryIcon(iconName)}
                            className={cn(
                              'p-1.5 rounded-md hover:bg-muted transition-colors',
                              newCategoryIcon === iconName && 'bg-primary text-primary-foreground'
                            )}
                          >
                            <IconComp className="h-4 w-4 mx-auto" />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-1.5">Color</label>
                    <div className="grid grid-cols-7 gap-1.5">
                      {CATEGORY_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setNewCategoryColor(c)}
                          className={cn(
                            'w-8 h-8 rounded-md transition-all',
                            newCategoryColor === c && 'ring-2 ring-offset-2 ring-primary scale-110'
                          )}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => setShowCreateCategory(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="flex-1"
                      disabled={creatingCategory || !newCategoryName.trim()}
                      onClick={handleCreateCategory}
                    >
                      {creatingCategory ? 'Creating...' : 'Create'}
                    </Button>
                  </div>
                </div>
              ) : (
                /* Category List */
                <>
                  {/* Create New Category Button */}
                  <button
                    onClick={() => setShowCreateCategory(true)}
                    className="w-full flex items-center gap-3 p-3 rounded-md transition-colors text-left border-2 border-dashed border-border hover:border-primary hover:bg-primary/5 mb-3"
                  >
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-primary/10">
                      <Plus className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-primary">Create new category</p>
                      <p className="text-xs text-muted-foreground">
                        Add a custom {selectedTransaction?.type} category
                      </p>
                    </div>
                  </button>

                  {categories
                    .filter(
                      (c) => selectedTransaction && c.type === selectedTransaction.type
                    )
                    .map((cat) => {
                      const CatIcon =
                        CATEGORY_ICONS[cat.icon as keyof typeof CATEGORY_ICONS] ||
                        MoreHorizontal;
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
                            <CatIcon
                              className="h-5 w-5"
                              style={{ color: cat.color }}
                            />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium">{cat.name}</p>
                            <p className="text-xs text-muted-foreground capitalize">
                              {cat.type}
                            </p>
                          </div>
                          {isSelected && (
                            <span className="text-xs px-2 py-1 rounded bg-primary/20 text-primary">
                              Current
                            </span>
                          )}
                        </button>
                      );
                    })}
                </>
              )}
            </div>
          </div>
        </>
      )}

      <BottomNav />
    </div>
  );
}
