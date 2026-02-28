'use client';

import {
  Check, X, Trash2, Pencil, TrendingUp, TrendingDown,
  Wallet, PiggyBank, Settings2, Star, ChevronDown, ChevronUp,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';

import BottomNav from '@/shared/components/layout/BottomNav';
import { useAuth } from '@/app/_providers/AuthProvider';
import { useAppData } from '@/app/_providers/AppDataProvider';
import PageHeader from '@/shared/components/layout/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/Card';
import { Button } from '@/shared/components/ui';
import Modal from '@/shared/components/ui/Modal';
import Input from '@/shared/components/ui/Input';
import TransactionListItem from '@/shared/components/ui/TransactionListItem';
import { Badge } from '@/components/ui/badge';
import { accountRepository } from '@/core/repositories/AccountRepository';
import { transactionRepository } from '@/core/repositories/TransactionRepository';
import { categoryRepository } from '@/core/repositories/CategoryRepository';
import { tagRepository } from '@/core/repositories/TagRepository';
import { Account, Transaction, Category, Tag, CURRENCIES, ACCOUNT_TYPES, AccountType, getAccountDefaults } from '@/core/models';
import { CATEGORY_ICONS } from '@/shared/config/icons';
import { cn } from '@/shared/utils/cn';

const getCurrencySymbol = (currency: string) =>
  CURRENCIES.find((c) => c.value === currency)?.symbol || currency;

export default function AccountDetailPage() {
  const params = useParams();
  const accountId = params.id as string;
  const router = useRouter();
  const { user, authLoading } = useAuth();
  const { refreshAccounts, categories: ctxCategories, tags: ctxTags } = useAppData();
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState<Account | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>(ctxCategories);
  const [tags, setTags] = useState<Tag[]>(ctxTags);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editingBalance, setEditingBalance] = useState(false);
  const [newBalance, setNewBalance] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [settingsMounted, setSettingsMounted] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const [typeSelectorMounted, setTypeSelectorMounted] = useState(false);
  const [typeSelectorVisible, setTypeSelectorVisible] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;
    loadAccountData(accountId, user.uid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, accountId]);

  // Settings panel open/close with exit animation
  useEffect(() => {
    if (showSettings) {
      setSettingsMounted(true);
      const t = setTimeout(() => setSettingsVisible(true), 16);
      return () => clearTimeout(t);
    } else {
      setSettingsVisible(false);
      setShowTypeSelector(false);
      const t = setTimeout(() => setSettingsMounted(false), 220);
      return () => clearTimeout(t);
    }
  }, [showSettings]);

  // Type selector gallery open/close with exit animation
  useEffect(() => {
    if (showTypeSelector) {
      setTypeSelectorMounted(true);
      const t = setTimeout(() => setTypeSelectorVisible(true), 16);
      return () => clearTimeout(t);
    } else {
      setTypeSelectorVisible(false);
      const t = setTimeout(() => setTypeSelectorMounted(false), 240);
      return () => clearTimeout(t);
    }
  }, [showTypeSelector]);

  const loadAccountData = async (id: string, userId: string) => {
    setLoading(true);
    try {
      const accountData = await accountRepository.getById(id);
      if (accountData && accountData.userId === userId) {
        setAccount(accountData);
      } else {
        router.push('/accounts');
        return;
      }
      const [userCategories, userTags, accountTransactions] = await Promise.all([
        categoryRepository.getByUserId(userId),
        tagRepository.getByUserId(userId),
        transactionRepository.getByAccountId(id, userId),
      ]);
      setCategories(userCategories);
      setTags(userTags);
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
      await refreshAccounts();
      await loadAccountData(accountId, user.uid);
    } catch (error) {
      console.error('Failed to set default account:', error);
    }
  };

  const handleToggleSaving = async () => {
    if (!user || !account) return;
    try {
      await accountRepository.update({ id: account.id, isSaving: !account.isSaving });
      await refreshAccounts();
      await loadAccountData(accountId, user.uid);
    } catch (error) {
      console.error('Failed to toggle saving status:', error);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user || !account) return;
    try {
      await accountRepository.delete(account.id);
      await refreshAccounts();
      router.push('/accounts');
    } catch (error) {
      console.error('Failed to delete account:', error);
    }
  };

  const handleChangeType = async (newType: AccountType) => {
    if (!user || !account || account.type === newType) return;
    const defaults = getAccountDefaults(newType);
    try {
      await accountRepository.update({ id: account.id, type: newType, icon: defaults.icon, color: defaults.color });
      await refreshAccounts();
      await loadAccountData(accountId, user.uid);
    } catch (error) {
      console.error('Failed to change account type:', error);
    }
  };

  const handleSaveBalance = async () => {
    if (!user || !account) return;
    const parsed = parseFloat(newBalance);
    if (isNaN(parsed)) return;
    try {
      await accountRepository.updateBalance(account.id, parsed);
      await refreshAccounts();
      setEditingBalance(false);
      await loadAccountData(accountId, user.uid);
    } catch (error) {
      console.error('Failed to update balance:', error);
    }
  };

  const incomeTotal = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expenseTotal = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !account) return null;

  const AccountIcon = account.icon
    ? CATEGORY_ICONS[account.icon as keyof typeof CATEGORY_ICONS] || Wallet
    : Wallet;
  const accountColor = account.isSaving ? '#f59e0b' : (account.color || '#6b7280');
  const isNegative = account.balance < 0;
  const sym = getCurrencySymbol(account.currency);

  return (
    <div className="min-h-screen bg-background pb-24">
      <PageHeader
        title={account.name}
        description={account.type.replace('_', ' ')}
        backHref="/accounts"
        rightElement={
          <Button
            variant="ghost"
            onClick={() => setShowSettings(!showSettings)}
            className={cn(
              'text-muted-foreground hover:text-foreground transition-colors',
              showSettings && 'text-foreground'
            )}
          >
            <Settings2 className="h-4 w-4" />
          </Button>
        }
      />

      <main className="container max-w-screen-2xl px-4 py-5 space-y-5">

        {/* Balance Card */}
        <Card
          className={cn(
            'relative overflow-hidden shadow-xl',
            account.isSaving
              ? 'border-amber-500/25 bg-amber-500/[0.07] shadow-amber-500/10'
              : isNegative
                ? 'border-destructive/25 bg-destructive/[0.07] shadow-destructive/10'
                : 'border-primary/25 bg-primary/[0.07] shadow-primary/10'
          )}
        >
          {/* Glow orb */}
          <div
            className="absolute -top-10 -right-10 w-40 h-40 rounded-full blur-3xl opacity-20 pointer-events-none"
            style={{ backgroundColor: accountColor }}
          />

          <CardHeader className="pb-2 relative z-10">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs font-medium uppercase tracking-widest text-muted-foreground/70">
                Current Balance
              </CardDescription>
              <div className="flex items-center gap-2">
                {account.isDefault && (
                  <Badge variant="secondary" className="text-xs bg-white/[0.06] border-white/[0.08] text-muted-foreground">
                    Default
                  </Badge>
                )}
                {account.isSaving && (
                  <Badge variant="secondary" className="text-xs bg-amber-500/10 border-amber-500/20 text-amber-500">
                    Saving
                  </Badge>
                )}
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${accountColor}18`, boxShadow: `0 0 12px -2px ${accountColor}40` }}
                >
                  <AccountIcon className="h-4 w-4" style={{ color: accountColor }} />
                </div>
              </div>
            </div>

            {editingBalance ? (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xl text-muted-foreground">{sym}</span>
                <Input
                  type="number"
                  step="0.01"
                  value={newBalance}
                  onChange={(e) => setNewBalance(e.target.value)}
                  className="text-2xl font-bold h-12 flex-1"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveBalance();
                    if (e.key === 'Escape') setEditingBalance(false);
                  }}
                />
                <Button variant="ghost" size="sm" className="h-10 w-10 p-0 text-success" onClick={handleSaveBalance}>
                  <Check className="h-5 w-5" />
                </Button>
                <Button variant="ghost" size="sm" className="h-10 w-10 p-0 text-destructive" onClick={() => setEditingBalance(false)}>
                  <X className="h-5 w-5" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 mt-1">
                <CardTitle className={cn('text-4xl font-bold tracking-tight', isNegative && 'text-destructive')}>
                  {sym}{account.balance.toFixed(2)}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                  onClick={() => { setNewBalance(account.balance.toString()); setEditingBalance(true); }}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
            )}
          </CardHeader>

          <CardContent className="relative z-10">
            <div className="grid grid-cols-3 gap-3 pt-1">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <div className="w-6 h-6 rounded-md bg-white/[0.06] flex items-center justify-center">
                    <Wallet className="h-3 w-3" />
                  </div>
                  <span className="text-xs">Txns</span>
                </div>
                <span className="text-base font-semibold pl-0.5">{transactions.length}</span>
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-6 rounded-md bg-success/10 flex items-center justify-center">
                    <TrendingUp className="h-3 w-3 text-success" />
                  </div>
                  <span className="text-xs text-muted-foreground">Income</span>
                </div>
                <span className="text-base font-semibold pl-0.5 text-success">
                  {sym}{incomeTotal.toFixed(2)}
                </span>
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-6 rounded-md bg-destructive/10 flex items-center justify-center">
                    <TrendingDown className="h-3 w-3 text-destructive" />
                  </div>
                  <span className="text-xs text-muted-foreground">Spent</span>
                </div>
                <span className="text-base font-semibold pl-0.5 text-destructive">
                  {sym}{expenseTotal.toFixed(2)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Settings panel (collapsible, animated open + close) */}
        {settingsMounted && (
          <div
            className="grid transition-[grid-template-rows] duration-[250ms] ease-out"
            style={{ gridTemplateRows: settingsVisible ? '1fr' : '0fr' }}
          >
          <div className="overflow-hidden">
          <Card className="border-white/[0.08]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Account Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">

              {/* Info row */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                <div>
                  <p className="text-muted-foreground mb-0.5">Currency</p>
                  <p className="font-medium">{CURRENCIES.find(c => c.value === account.currency)?.label} ({account.currency})</p>
                </div>
                {/* Account Type — inline in the grid, gallery expands below spanning 2 cols */}
                {(() => {
                  const current = ACCOUNT_TYPES.find(t => t.value === account.type);
                  const CurrentIcon = current
                    ? CATEGORY_ICONS[current.defaultIcon as keyof typeof CATEGORY_ICONS] || Wallet
                    : Wallet;
                  const color = current?.defaultColor || '#6b7280';
                  return (
                    <button
                      type="button"
                      onClick={() => setShowTypeSelector(!showTypeSelector)}
                      className="text-left w-full"
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <p className="text-muted-foreground">Account Type</p>
                        {typeSelectorVisible
                          ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                          : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div
                          className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: `${color}22` }}
                        >
                          <CurrentIcon className="h-3 w-3" style={{ color }} />
                        </div>
                        <span className="font-medium">{current?.label ?? account.type}</span>
                      </div>
                    </button>
                  );
                })()}
                {/* Type gallery — spans full width when open, grid trick for smooth animation */}
                {typeSelectorMounted && (
                  <div
                    className="col-span-2 grid transition-[grid-template-rows] duration-250 ease-out"
                    style={{ gridTemplateRows: typeSelectorVisible ? '1fr' : '0fr' }}
                  >
                  <div className="overflow-hidden">
                  <div className="flex gap-2 overflow-x-auto pb-1 pt-0.5 scrollbar-hide">
                    {ACCOUNT_TYPES.map((t) => {
                      const TypeIcon = CATEGORY_ICONS[t.defaultIcon as keyof typeof CATEGORY_ICONS] || Wallet;
                      const isActive = account.type === t.value;
                      return (
                        <button
                          key={t.value}
                          type="button"
                          onClick={() => { handleChangeType(t.value); setShowTypeSelector(false); }}
                          className={cn(
                            'flex-shrink-0 flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-xl border transition-all',
                            'min-w-[64px] text-center',
                            isActive
                              ? 'border-transparent shadow-sm'
                              : 'border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06]'
                          )}
                          style={isActive ? { backgroundColor: `${t.defaultColor}22`, borderColor: `${t.defaultColor}60` } : {}}
                        >
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center"
                            style={{ backgroundColor: `${t.defaultColor}22` }}
                          >
                            <TypeIcon className="h-4 w-4" style={{ color: t.defaultColor }} />
                          </div>
                          <span className="text-xs font-medium leading-tight">{t.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  </div>
                  </div>
                )}
                {account.notes && (
                  <div className="col-span-2">
                    <p className="text-muted-foreground mb-0.5">Notes</p>
                    <p>{account.notes}</p>
                  </div>
                )}
              </div>

              {/* Action buttons — equal-width cards, centered */}
              <div className="flex gap-2 mt-1 border-t border-white/[0.06] pt-4">
                {!account.isDefault && (
                  <button
                    type="button"
                    onClick={handleSetDefault}
                    className="flex-1 flex flex-col items-center gap-2 p-3 rounded-xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] transition-all text-center"
                  >
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Star className="h-4 w-4 text-primary" />
                    </div>
                    <span className="text-xs text-muted-foreground leading-tight">Set Default</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleToggleSaving}
                  className={cn(
                    'flex-1 flex flex-col items-center gap-2 p-3 rounded-xl border transition-all text-center',
                    account.isSaving
                      ? 'border-amber-500/40 bg-amber-500/10'
                      : 'border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06]'
                  )}
                >
                  <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center">
                    <PiggyBank className="h-4 w-4 text-amber-500" />
                  </div>
                  <span className="text-xs text-muted-foreground leading-tight">
                    {account.isSaving ? 'Remove Saving' : 'Mark Saving'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex-1 flex flex-col items-center gap-2 p-3 rounded-xl border border-white/[0.08] bg-white/[0.03] hover:bg-destructive/10 hover:border-destructive/30 transition-all text-center"
                >
                  <div className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </div>
                  <span className="text-xs text-muted-foreground leading-tight">Delete</span>
                </button>
              </div>

            </CardContent>
          </Card>
          </div>
          </div>
        )}

        {/* Transactions */}
        {transactions.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between px-0.5">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Transactions
              </h2>
              <span className="text-xs text-muted-foreground">{transactions.length} total</span>
            </div>
            <Card>
              <CardContent className="p-0 divide-y divide-white/[0.05]">
                {transactions.map((txn) => {
                  const category = categories.find(c => c.id === txn.categoryId);
                  const transactionTags = tags.filter(t => txn.tags?.includes(t.id));
                  return (
                    <TransactionListItem
                      key={txn.id}
                      transaction={txn}
                      category={category}
                      tags={transactionTags}
                      returnTo={`/accounts/${accountId}`}
                    />
                  );
                })}
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">No Transactions</CardTitle>
              <CardDescription>No transactions recorded for this account yet</CardDescription>
            </CardHeader>
          </Card>
        )}
      </main>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title="Delete Account">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete <strong>{account.name}</strong>? This action cannot be undone.
          </p>
          {transactions.length > 0 && (
            <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20">
              <p className="text-sm text-destructive">
                Warning: This account has {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}.
              </p>
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
            <Button className="flex-1 bg-destructive hover:bg-destructive/90" onClick={handleDeleteAccount}>Delete</Button>
          </div>
        </div>
      </Modal>

      <BottomNav />
    </div>
  );
}
