'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import BottomNav from '@/shared/components/layout/BottomNav';
import PageHeader from '@/shared/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/Card';
import { Button } from '@/shared/components/ui';
import {
  User,
  Globe,
  Download,
  Smartphone,
  Tag,
  FolderOpen,
  Upload,
  LogOut,
  Trash2,
  AlertTriangle,
  RefreshCw,
  Loader2,
  DatabaseBackup,
  HardDriveUpload,
  ArrowLeftRight,
} from 'lucide-react';
import { addDoc, collection, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { FIREBASE_COLLECTIONS } from '@/shared/config/constants';
import { userSettingsRepository } from '@/core/repositories/UserSettingsRepository';
import { transactionRepository } from '@/core/repositories/TransactionRepository';
import { accountRepository } from '@/core/repositories/AccountRepository';
import { categoryRepository } from '@/core/repositories/CategoryRepository';
import { tagRepository } from '@/core/repositories/TagRepository';
import { importedTransactionRepository } from '@/core/repositories/ImportedTransactionRepository';
import { budgetRepository } from '@/core/repositories/BudgetRepository';
import { wishlistRepository } from '@/core/repositories/WishlistRepository';
import { wishlistItemRepository } from '@/core/repositories/WishlistItemRepository';
import { scheduledTransactionRepository } from '@/core/repositories/ScheduledTransactionRepository';
import { Currency, CURRENCIES } from '@/core/models';
import { useAuth } from '@/app/_providers/AuthProvider';
import { useAppData } from '@/app/_providers/AppDataProvider';
import { convertCurrency } from '@/shared/services/currencyService';

export default function ProfilePage() {
  const { user, authLoading, signOut } = useAuth();
  const { userSettings, dataLoading, accounts, refreshUserSettings, refreshCategories, refreshTransactions } = useAppData();
  const [clearing, setClearing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [converting, setConverting] = useState(false);
  const [showCurrencyConverter, setShowCurrencyConverter] = useState(false);
  const [convertAccountId, setConvertAccountId] = useState('');
  const [convertToCurrency, setConvertToCurrency] = useState<Currency>('USD');
  const [installPrompt, setInstallPrompt] = useState<Event | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);

  // PWA Install event listener
  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleBaseCurrencyChange = async (currency: Currency) => {
    if (!user) return;

    try {
      await userSettingsRepository.update(user.uid, { baseCurrency: currency });
      await refreshUserSettings();
    } catch (error) {
      console.error('Failed to update base currency:', error);
      alert('Failed to update base currency. Please try again.');
    }
  };

  const handleInstallApp = async () => {
    if (!installPrompt) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const promptEvent = installPrompt as any;
    promptEvent.prompt();

    const { outcome } = await promptEvent.userChoice;

    if (outcome === 'accepted') {
      setIsInstalled(true);
    }

    setInstallPrompt(null);
  };

  const handleExportData = async () => {
    if (!user) return;
    setExporting(true);
    try {
      const [
        transactions,
        accounts,
        categories,
        tags,
        budgets,
        wishlists,
        wishlistItems,
        scheduledTransactions,
        settings,
      ] = await Promise.all([
        transactionRepository.getByUserId(user.uid),
        accountRepository.getByUserId(user.uid),
        categoryRepository.getByUserId(user.uid),
        tagRepository.getByUserId(user.uid),
        budgetRepository.getByUserId(user.uid),
        wishlistRepository.getAll(user.uid),
        wishlistItemRepository.getByUserId(user.uid),
        scheduledTransactionRepository.getByUserId(user.uid),
        userSettingsRepository.get(user.uid),
      ]);

      const backup = {
        exportedAt: new Date().toISOString(),
        version: '1',
        userId: user.uid,
        data: {
          transactions,
          accounts,
          categories,
          tags,
          budgets,
          wishlists,
          wishlistItems,
          scheduledTransactions,
          userSettings: settings,
        },
      };

      const json = JSON.stringify(backup, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tinex-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export data:', error);
      alert('Failed to export data. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const handleImportData = async (file: File) => {
    if (!user) return;

    const confirmText = 'IMPORT ALL DATA';
    const userInput = prompt(
      `⚠️ WARNING: This will overwrite ALL existing data with the backup.\n\n` +
      `Type "${confirmText}" to confirm:`
    );

    if (userInput !== confirmText) {
      if (userInput !== null) alert('Import cancelled.');
      return;
    }

    setClearing(true);
    try {
      const text = await file.text();
      const backup = JSON.parse(text);

      if (!backup.version || !backup.data) {
        alert('Invalid backup file.');
        return;
      }

      const d = backup.data;

      // Delete all existing data (sequentially to avoid race conditions;
      // transactionRepository.deleteAllForUser already handles importedTransactions)
      const steps: Array<[string, () => Promise<void>]> = [
        ['transactions', () => transactionRepository.deleteAllForUser(user.uid)],
        ['accounts', () => accountRepository.deleteAllForUser(user.uid)],
        ['categories', () => categoryRepository.deleteAllForUser(user.uid)],
        ['tags', () => tagRepository.deleteAllForUser(user.uid)],
        ['budgets', () => budgetRepository.deleteAllForUser(user.uid)],
        ['wishlists', () => wishlistRepository.deleteAllForUser(user.uid)],
        ['wishlistItems', () => wishlistItemRepository.deleteAllForUser(user.uid)],
        ['scheduledTransactions', () => scheduledTransactionRepository.deleteAllForUser(user.uid)],
      ];
      for (const [name, fn] of steps) {
        console.log(`[import] deleting ${name}...`);
        await fn();
        console.log(`[import] deleted ${name}`);
      }

      // Helper: convert ISO date strings back to Firestore Timestamps
      const ts = (v: string | null | undefined): Timestamp | null => {
        if (!v) return null;
        const d = new Date(v);
        return isNaN(d.getTime()) ? null : Timestamp.fromDate(d);
      };

      // Restore with fresh Firestore IDs (addDoc) and remap cross-references
      const accountIdMap = new Map<string, string>(); // oldId -> newId
      const categoryIdMap = new Map<string, string>();
      const tagIdMap = new Map<string, string>();
      const wishlistIdMap = new Map<string, string>();

      console.log(`[import] restoring ${d.accounts?.length ?? 0} accounts...`);
      for (const a of d.accounts ?? []) {
        const ref = await addDoc(collection(db, FIREBASE_COLLECTIONS.ACCOUNTS), {
          userId: user.uid, name: a.name, type: a.type, currency: a.currency,
          balance: a.balance, isDefault: a.isDefault,
          ...(a.color && { color: a.color }),
          ...(a.icon && { icon: a.icon }),
          ...(a.isSaving !== undefined && { isSaving: a.isSaving }),
          ...(a.notes && { notes: a.notes }),
          createdAt: ts(a.createdAt) ?? Timestamp.now(),
          updatedAt: ts(a.updatedAt) ?? Timestamp.now(),
        });
        accountIdMap.set(a.id, ref.id);
      }

      console.log(`[import] restoring ${d.categories?.length ?? 0} categories...`);
      for (const c of d.categories ?? []) {
        const ref = await addDoc(collection(db, FIREBASE_COLLECTIONS.CATEGORIES), {
          userId: user.uid, name: c.name, type: c.type, icon: c.icon,
          color: c.color, isDefault: c.isDefault ?? false,
          ...(c.parentId && { parentId: c.parentId }),
          createdAt: ts(c.createdAt) ?? Timestamp.now(),
          updatedAt: ts(c.updatedAt) ?? Timestamp.now(),
        });
        categoryIdMap.set(c.id, ref.id);
      }

      console.log(`[import] restoring ${d.tags?.length ?? 0} tags...`);
      for (const t of d.tags ?? []) {
        const ref = await addDoc(collection(db, FIREBASE_COLLECTIONS.TAGS), {
          userId: user.uid, name: t.name, color: t.color,
          createdAt: ts(t.createdAt) ?? Timestamp.now(),
          updatedAt: ts(t.updatedAt) ?? Timestamp.now(),
        });
        tagIdMap.set(t.id, ref.id);
      }

      console.log(`[import] restoring ${d.transactions?.length ?? 0} transactions...`);
      // pairId links Transfer Out ↔ Transfer In pairs; remap to new pair UUIDs
      const pairIdMap = new Map<string, string>();
      for (const t of d.transactions ?? []) {
        const newAccountId = accountIdMap.get(t.accountId) ?? t.accountId;
        const newCategoryId = categoryIdMap.get(t.categoryId) ?? t.categoryId;
        const newTags = (t.tags ?? []).map((tid: string) => tagIdMap.get(tid) ?? tid);

        let newPairId: string | undefined;
        if (t.pairId) {
          if (!pairIdMap.has(t.pairId)) {
            pairIdMap.set(t.pairId, crypto.randomUUID());
          }
          newPairId = pairIdMap.get(t.pairId);
        }

        const txData: Record<string, unknown> = {
          userId: user.uid, accountId: newAccountId, amount: t.amount,
          currency: t.currency, type: t.type, categoryId: newCategoryId,
          description: t.description, date: ts(t.date) ?? Timestamp.now(),
          tags: newTags,
          createdAt: ts(t.createdAt) ?? Timestamp.now(),
          updatedAt: ts(t.updatedAt) ?? Timestamp.now(),
        };
        if (t.sourceName) txData.sourceName = t.sourceName;
        if (t.merchantName) txData.merchantName = t.merchantName;
        if (t.notes) txData.notes = t.notes;
        if (t.excludeFromAnalytics !== undefined) txData.excludeFromAnalytics = t.excludeFromAnalytics;
        if (t.exchangeRate !== undefined) txData.exchangeRate = t.exchangeRate;
        if (t.fee !== undefined) txData.fee = t.fee;
        if (newPairId) txData.pairId = newPairId;
        await addDoc(collection(db, FIREBASE_COLLECTIONS.TRANSACTIONS), txData);
      }

      console.log(`[import] restoring ${d.budgets?.length ?? 0} budgets...`);
      for (const b of d.budgets ?? []) {
        const newCategoryId = categoryIdMap.get(b.categoryId) ?? b.categoryId;
        await addDoc(collection(db, FIREBASE_COLLECTIONS.BUDGETS), {
          userId: user.uid, categoryId: newCategoryId, amount: b.amount,
          period: b.period, startDate: ts(b.startDate) ?? Timestamp.now(),
          alertThreshold: b.alertThreshold ?? 80, isActive: b.isActive ?? true,
          ...(b.endDate && { endDate: ts(b.endDate) }),
          createdAt: ts(b.createdAt) ?? Timestamp.now(),
          updatedAt: ts(b.updatedAt) ?? Timestamp.now(),
        });
      }

      console.log(`[import] restoring ${d.wishlists?.length ?? 0} wishlists...`);
      for (const w of d.wishlists ?? []) {
        const ref = await addDoc(collection(db, FIREBASE_COLLECTIONS.WISHLISTS), {
          userId: user.uid, name: w.name,
          ...(w.description && { description: w.description }),
          createdAt: ts(w.createdAt) ?? Timestamp.now(),
          updatedAt: ts(w.updatedAt) ?? Timestamp.now(),
        });
        wishlistIdMap.set(w.id, ref.id);
      }

      console.log(`[import] restoring ${d.wishlistItems?.length ?? 0} wishlist items...`);
      for (const item of d.wishlistItems ?? []) {
        const newWishlistId = wishlistIdMap.get(item.wishlistId) ?? item.wishlistId;
        const newCategoryId = categoryIdMap.get(item.categoryId) ?? item.categoryId;
        await addDoc(collection(db, FIREBASE_COLLECTIONS.WISHLIST_ITEMS), {
          userId: user.uid, wishlistId: newWishlistId, name: item.name,
          amount: item.amount, currency: item.currency, categoryId: newCategoryId,
          isConfirmed: item.isConfirmed ?? false,
          addedAt: ts(item.addedAt) ?? Timestamp.now(),
          createdAt: ts(item.createdAt) ?? Timestamp.now(),
          updatedAt: ts(item.updatedAt) ?? Timestamp.now(),
        });
      }

      console.log(`[import] restoring ${d.scheduledTransactions?.length ?? 0} scheduled transactions...`);
      for (const s of d.scheduledTransactions ?? []) {
        const newAccountId = accountIdMap.get(s.accountId) ?? s.accountId;
        const newCategoryId = categoryIdMap.get(s.categoryId) ?? s.categoryId;
        const newTags = (s.tags ?? []).map((tid: string) => tagIdMap.get(tid) ?? tid);
        await addDoc(collection(db, FIREBASE_COLLECTIONS.SCHEDULED_TRANSACTIONS), {
          userId: user.uid, accountId: newAccountId, type: s.type,
          amount: s.amount, currency: s.currency, description: s.description,
          categoryId: newCategoryId, tags: newTags,
          nextDate: ts(s.nextDate) ?? Timestamp.now(),
          recurrence: s.recurrence, isActive: s.isActive ?? true,
          ...(s.fee !== undefined && { fee: s.fee }),
          ...(s.endDate && { endDate: ts(s.endDate) }),
          ...(s.lastExecutedAt && { lastExecutedAt: ts(s.lastExecutedAt) }),
          createdAt: ts(s.createdAt) ?? Timestamp.now(),
          updatedAt: ts(s.updatedAt) ?? Timestamp.now(),
        });
      }

      console.log('[import] restoring user settings...');
      if (d.userSettings?.baseCurrency) {
        await userSettingsRepository.update(user.uid, { baseCurrency: d.userSettings.baseCurrency });
      }

      alert('Data imported successfully.');
      window.location.reload();
    } catch (error) {
      console.error('Failed to import data:', error);
      alert('Failed to import data. Please check the backup file and try again.');
    } finally {
      setClearing(false);
    }
  };

  const handleConvertAccountCurrency = async () => {
    if (!user || !convertAccountId) return;
    const account = accounts.find(a => a.id === convertAccountId);
    if (!account) return;

    const confirmText = 'CONVERT CURRENCY';
    const userInput = prompt(
      `⚠️ This will convert account "${account.name}" (${account.currency}) and ALL its transactions to ${convertToCurrency}.\n\n` +
      `Type "${confirmText}" to confirm:`
    );
    if (userInput !== confirmText) {
      if (userInput !== null) alert('Conversion cancelled.');
      return;
    }

    setConverting(true);
    try {
      const txns = await transactionRepository.getByAccountId(convertAccountId, user.uid);

      for (const txn of txns) {
        const newAmount = await convertCurrency(txn.amount, txn.currency, convertToCurrency);
        await updateDoc(doc(db, FIREBASE_COLLECTIONS.TRANSACTIONS, txn.id), {
          amount: newAmount,
          currency: convertToCurrency,
          updatedAt: Timestamp.now(),
        });
      }

      const newBalance = await convertCurrency(account.balance, account.currency, convertToCurrency);
      await updateDoc(doc(db, FIREBASE_COLLECTIONS.ACCOUNTS, account.id), {
        balance: newBalance,
        currency: convertToCurrency,
        updatedAt: Timestamp.now(),
      });

      alert(`Converted ${txns.length} transaction(s). Account "${account.name}" is now in ${convertToCurrency}.`);
      window.location.reload();
    } catch (error) {
      console.error('Currency conversion failed:', error);
      alert('Conversion failed. Please try again.');
    } finally {
      setConverting(false);
    }
  };

  const handleSignOut = async () => {
    if (!confirm('Are you sure you want to sign out?')) return;
    await signOut();
  };

  const handleDeleteTransactions = async () => {
    if (!user) return;

    const confirmText = 'DELETE TRANSACTIONS';
    const userInput = prompt(
      `⚠️ WARNING: This will permanently delete ALL transactions.\n\n` +
      `Type "${confirmText}" to confirm:`
    );

    if (userInput !== confirmText) {
      if (userInput !== null) {
        alert('Deletion cancelled.');
      }
      return;
    }

    setClearing(true);
    try {
      await Promise.all([
        transactionRepository.deleteAllForUser(user.uid),
        importedTransactionRepository.deleteAllForUser(user.uid),
      ]);

      await refreshTransactions();
      alert('All transactions deleted successfully.');
    } catch (error) {
      console.error('Failed to delete transactions:', error);
      alert('Failed to delete transactions. Please try again.');
    } finally {
      setClearing(false);
    }
  };

  const handleClearAllData = async () => {
    if (!user) return;

    const confirmText = 'DELETE ALL DATA';
    const userInput = prompt(
      `⚠️ WARNING: This will permanently delete ALL your data!\n\n` +
      `Type "${confirmText}" to confirm:`
    );

    if (userInput !== confirmText) {
      if (userInput !== null) {
        alert('Deletion cancelled.');
      }
      return;
    }

    setClearing(true);
    try {
      await Promise.all([
        transactionRepository.deleteAllForUser(user.uid),
        accountRepository.deleteAllForUser(user.uid),
        categoryRepository.deleteAllForUser(user.uid),
        tagRepository.deleteAllForUser(user.uid),
        importedTransactionRepository.deleteAllForUser(user.uid),
      ]);

      alert('All data deleted successfully.');
      window.location.reload();
    } catch (error) {
      console.error('Failed to clear all data:', error);
      alert('Failed to delete all data. Please try again.');
    } finally {
      setClearing(false);
    }
  };

  const handleRegenerateCategories = async () => {
    if (!user) return;

    const confirmText = 'REGENERATE';
    const userInput = prompt(
      `This will delete all existing categories and recreate the default categories.\n\n` +
      `Type "${confirmText}" to confirm:`
    );

    if (userInput !== confirmText) {
      if (userInput !== null) {
        alert('Regeneration cancelled.');
      }
      return;
    }

    setClearing(true);
    try {
      // Delete all existing categories
      await categoryRepository.deleteAllForUser(user.uid);

      // Create default categories
      await categoryRepository.createDefaultCategories(user.uid);

      await refreshCategories();
      alert('Categories regenerated successfully.');
    } catch (error) {
      console.error('Failed to regenerate categories:', error);
      alert('Failed to regenerate categories. Please try again.');
    } finally {
      setClearing(false);
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

  return (
    <div className="min-h-screen bg-background pb-20">
      <PageHeader title="Profile" description="Account settings and preferences" />

      <main className="px-4 py-4 space-y-4">
        {/* User Info */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center">
                <User className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user.email || 'User'}</p>
                <p className="text-xs text-muted-foreground">TineX Account</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Settings</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {/* Base Currency */}
              <div className="p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Display Currency</span>
                </div>
                <select
                  value={userSettings?.baseCurrency || 'USD'}
                  onChange={(e) => handleBaseCurrencyChange(e.target.value as Currency)}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md"
                >
                  {CURRENCIES.map((currency) => (
                    <option key={currency.value} value={currency.value}>
                      {currency.symbol} {currency.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* PWA Install */}
              <div className="p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Smartphone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">App Installation</span>
                </div>
                {isInstalled ? (
                  <p className="text-xs text-success flex items-center gap-1">
                    <Download className="h-3 w-3" />
                    App installed
                  </p>
                ) : installPrompt ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={handleInstallApp}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Install App
                  </Button>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Use browser menu to install
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              <Link
                href="/categories"
                className="flex items-center justify-between p-3 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <FolderOpen className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Manage Categories</span>
                </div>
              </Link>

              <Link
                href="/tags"
                className="flex items-center justify-between p-3 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Manage Tags</span>
                </div>
              </Link>

              <Link
                href="/import"
                className="flex items-center justify-between p-3 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Upload className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Import Transactions</span>
                </div>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Account Actions */}
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-2 p-3 text-sm hover:bg-muted/30 transition-colors"
              >
                <LogOut className="h-4 w-4 text-muted-foreground" />
                Sign Out
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Dev Panel */}
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-sm text-destructive">Dev Panel</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <input
              ref={importFileRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImportData(file);
                e.target.value = '';
              }}
            />

            <Button
              variant="outline"
              size="sm"
              className="w-full text-blue-400 hover:text-blue-400 border-blue-400/50"
              onClick={() => setShowCurrencyConverter(!showCurrencyConverter)}
              disabled={converting || clearing || exporting}
            >
              <ArrowLeftRight className="h-4 w-4 mr-2" />
              Convert Account Currency
            </Button>

            {showCurrencyConverter && (
              <div className="space-y-2 p-3 rounded-lg bg-muted/30 border border-border">
                <select
                  value={convertAccountId}
                  onChange={(e) => setConvertAccountId(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md"
                >
                  <option value="">Select account...</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>
                  ))}
                </select>
                <select
                  value={convertToCurrency}
                  onChange={(e) => setConvertToCurrency(e.target.value as Currency)}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md"
                >
                  {CURRENCIES.filter(c => {
                    const acct = accounts.find(a => a.id === convertAccountId);
                    return !acct || c.value !== acct.currency;
                  }).map(c => (
                    <option key={c.value} value={c.value}>{c.label} ({c.symbol})</option>
                  ))}
                </select>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={handleConvertAccountCurrency}
                  disabled={!convertAccountId || converting}
                >
                  {converting ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Converting...</>
                  ) : 'Convert'}
                </Button>
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              className="w-full text-blue-400 hover:text-blue-400 border-blue-400/50"
              onClick={handleExportData}
              disabled={exporting || clearing}
            >
              <DatabaseBackup className="h-4 w-4 mr-2" />
              {exporting ? 'Exporting...' : 'Export All Data'}
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="w-full text-blue-400 hover:text-blue-400 border-blue-400/50"
              onClick={() => importFileRef.current?.click()}
              disabled={clearing || exporting}
            >
              <HardDriveUpload className="h-4 w-4 mr-2" />
              Import All Data
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="w-full text-primary hover:text-primary border-primary/50"
              onClick={handleRegenerateCategories}
              disabled={clearing}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Regenerate Categories
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="w-full text-destructive hover:text-destructive border-destructive/50"
              onClick={handleDeleteTransactions}
              disabled={clearing}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete All Transactions
            </Button>

            <Button
              variant="destructive"
              size="sm"
              className="w-full"
              onClick={handleClearAllData}
              disabled={clearing}
            >
              <AlertTriangle className="h-4 w-4 mr-2" />
              Clear All Data
            </Button>
          </CardContent>
        </Card>
      </main>

      <BottomNav />
    </div>
  );
}
