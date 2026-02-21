'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
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
} from 'lucide-react';
import { userSettingsRepository } from '@/core/repositories/UserSettingsRepository';
import { transactionRepository } from '@/core/repositories/TransactionRepository';
import { accountRepository } from '@/core/repositories/AccountRepository';
import { categoryRepository } from '@/core/repositories/CategoryRepository';
import { tagRepository } from '@/core/repositories/TagRepository';
import { importedTransactionRepository } from '@/core/repositories/ImportedTransactionRepository';
import { UserSettings, Currency, CURRENCIES } from '@/core/models';

export default function ProfilePage() {
  const [user, setUser] = useState<{ uid: string; email: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
  const [clearing, setClearing] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<Event | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser({ uid: currentUser.uid, email: currentUser.email });
        await loadUserSettings(currentUser.uid);
      } else {
        router.push('/auth');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

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

  const loadUserSettings = async (userId: string) => {
    try {
      const settings = await userSettingsRepository.getOrCreate(userId);
      setUserSettings(settings);
    } catch (error) {
      console.error('Failed to load user settings:', error);
    }
  };

  const handleBaseCurrencyChange = async (currency: Currency) => {
    if (!user) return;

    try {
      await userSettingsRepository.update(user.uid, { baseCurrency: currency });
      await loadUserSettings(user.uid);
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

  const handleSignOut = async () => {
    if (!confirm('Are you sure you want to sign out?')) return;

    try {
      await signOut(auth);
      router.push('/auth');
    } catch (error) {
      console.error('Failed to sign out:', error);
      alert('Failed to sign out. Please try again.');
    }
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

      alert('Categories regenerated successfully.');
    } catch (error) {
      console.error('Failed to regenerate categories:', error);
      alert('Failed to regenerate categories. Please try again.');
    } finally {
      setClearing(false);
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
