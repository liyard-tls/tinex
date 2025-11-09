'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import BottomNav from '@/shared/components/layout/BottomNav';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/components/ui/Card';
import { Button } from '@/shared/components/ui';
import Modal from '@/shared/components/ui/Modal';
import FAB from '@/shared/components/ui/FAB';
import AddAccountForm from '@/modules/accounts/AddAccountForm';
import { Plus, Wallet, Trash2, Tag, FolderOpen, ChevronRight, Upload } from 'lucide-react';
import { accountRepository } from '@/core/repositories/AccountRepository';
import { Account, CreateAccountInput, CURRENCIES } from '@/core/models';

export default function SettingsPage() {
  const [user, setUser] = useState<{ uid: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser({ uid: currentUser.uid });
        await loadAccounts(currentUser.uid);
      } else {
        router.push('/auth');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  const loadAccounts = async (userId: string) => {
    try {
      const userAccounts = await accountRepository.getByUserId(userId);
      setAccounts(userAccounts);
    } catch (error) {
      console.error('Failed to load accounts:', error);
    }
  };

  const handleAddAccount = async (data: CreateAccountInput) => {
    if (!user) return;

    try {
      await accountRepository.create(user.uid, data);
      await loadAccounts(user.uid);
      setShowAddAccount(false);
    } catch (error) {
      console.error('Failed to add account:', error);
      throw error;
    }
  };

  const handleDeleteAccount = async (accountId: string) => {
    if (!user) return;
    if (!confirm('Are you sure you want to delete this account?')) return;

    try {
      await accountRepository.delete(accountId);
      await loadAccounts(user.uid);
    } catch (error) {
      console.error('Failed to delete account:', error);
    }
  };

  const handleSetDefault = async (accountId: string) => {
    if (!user) return;

    try {
      await accountRepository.setDefault(user.uid, accountId);
      await loadAccounts(user.uid);
    } catch (error) {
      console.error('Failed to set default account:', error);
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

  const getCurrencySymbol = (currency: string) => {
    return CURRENCIES.find((c) => c.value === currency)?.symbol || currency;
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border">
        <div className="px-4 py-3">
          <h1 className="text-xl font-bold">Settings</h1>
        </div>
      </header>

      <main className="px-4 py-4 space-y-4">
        {/* Accounts Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Accounts</CardTitle>
                <CardDescription>Manage your accounts and balances</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAddAccount(true)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {accounts.length === 0 && (
              <div className="text-center py-8">
                <Wallet className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">No accounts yet</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => setShowAddAccount(true)}
                >
                  Create Your First Account
                </Button>
              </div>
            )}

            {accounts.map((account) => (
              <div
                key={account.id}
                className="flex items-center justify-between p-3 rounded-md border border-border bg-card"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">
                        {account.name}
                        {account.isDefault && (
                          <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-primary/20 text-primary">
                            Default
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {account.type.replace('_', ' ')}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm font-semibold mt-1 ml-6">
                    {getCurrencySymbol(account.currency)} {account.balance.toFixed(2)}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {!account.isDefault && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => handleSetDefault(account.id)}
                    >
                      Set Default
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                    onClick={() => handleDeleteAccount(account.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Data Management */}
        <Card>
          <CardHeader>
            <CardTitle>Data Management</CardTitle>
            <CardDescription>Manage categories and tags for your transactions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              variant="outline"
              className="w-full justify-between"
              onClick={() => router.push('/categories')}
            >
              <div className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4" />
                <div className="text-left">
                  <p className="text-sm font-medium">Categories</p>
                  <p className="text-xs text-muted-foreground">Organize transactions by category</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4" />
            </Button>

            <Button
              variant="outline"
              className="w-full justify-between"
              onClick={() => router.push('/tags')}
            >
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4" />
                <div className="text-left">
                  <p className="text-sm font-medium">Tags</p>
                  <p className="text-xs text-muted-foreground">Label transactions with custom tags</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4" />
            </Button>

            <Button
              variant="outline"
              className="w-full justify-between"
              onClick={() => router.push('/import')}
            >
              <div className="flex items-center gap-2">
                <Upload className="h-4 w-4" />
                <div className="text-left">
                  <p className="text-sm font-medium">Import Transactions</p>
                  <p className="text-xs text-muted-foreground">Import from bank statements (PDF)</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>

        {/* Other Settings Placeholder */}
        <Card>
          <CardHeader>
            <CardTitle>Preferences</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Additional settings will be implemented here.
            </p>
          </CardContent>
        </Card>
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
