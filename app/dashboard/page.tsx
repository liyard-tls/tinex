"use client";

import { Plus, LogOut, Wallet, TrendingUp, TrendingDown, Upload, Loader2, ArrowUpRight, ArrowRightLeft } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import BottomNav from "@/shared/components/layout/BottomNav";
import PageHeader from "@/shared/components/layout/PageHeader";
import FAB from "@/shared/components/ui/FAB";
import AddTransactionForm from "@/modules/transactions/AddTransactionForm";
import AddTransferForm from "@/modules/transactions/AddTransferForm";
import TransactionListItem from "@/shared/components/ui/TransactionListItem";
import WhatsNewPopup from "@/shared/components/ui/WhatsNewPopup";
import { useAuth } from "@/app/_providers/AuthProvider";
import { useAppData } from "@/app/_providers/AppDataProvider";

import { transactionRepository } from "@/core/repositories/TransactionRepository";
import { wishlistItemRepository } from "@/core/repositories/WishlistItemRepository";
import {
  CreateTransactionInput,
  WishlistItem,
  SYSTEM_CATEGORIES,
  CURRENCIES,
} from "@/core/models";
import {
  convertMultipleCurrencies,
  convertCurrency,
  formatCurrency,
} from "@/shared/services/currencyService";
import { cn } from "@/lib/utils";
import { CATEGORY_ICONS } from "@/shared/config/icons";

const getCurrencySymbol = (currency: string) => {
  return CURRENCIES.find((c) => c.value === currency)?.symbol || currency;
};

export default function DashboardPage() {
  const { user, authLoading, signOut } = useAuth();
  const { transactions, accounts, categories, tags, userSettings, dataLoading, refreshTransactions } = useAppData();
  const [showAddTransaction, setShowAddTransaction] = useState(false);
  const [showAddTransfer, setShowAddTransfer] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [stats, setStats] = useState({
    income: 0,
    expenses: 0,
    balance: 0,
    transactionCount: 0,
  });
  const [allAccounts, setAllAccounts] = useState(accounts);
  const [totalBalance, setTotalBalance] = useState<number>(0);
  const [balanceWithFuture, setBalanceWithFuture] = useState<number>(0);
  const router = useRouter();

  const calculateDashboardData = useCallback(async () => {
    if (!userSettings || accounts.length === 0 && transactions.length === 0) return;

    try {
      const baseCurrency = userSettings.baseCurrency;

      // Sort accounts by converted balance
      const accountsWithConvertedBalance = await Promise.all(
        accounts.map(async (account) => {
          const convertedBalance = await convertCurrency(
            account.balance,
            account.currency,
            baseCurrency
          );
          return { ...account, convertedBalance };
        })
      );
      const sortedAccounts = accountsWithConvertedBalance.sort(
        (a, b) => Math.abs(b.convertedBalance) - Math.abs(a.convertedBalance)
      );
      setAllAccounts(sortedAccounts);

      // Total balance
      let accountsBalance = 0;
      if (accounts.length > 0) {
        accountsBalance = await convertMultipleCurrencies(
          accounts.map((acc) => ({ amount: acc.balance, currency: acc.currency })),
          baseCurrency
        );
      }

      // Future transactions
      const now = new Date();
      const futureTxns = transactions.filter((txn) => {
        const txnDate =
          txn.date instanceof Date ? txn.date : (txn.date as { toDate: () => Date }).toDate();
        return txnDate > now;
      });

      let futureAmount = 0;
      for (const txn of futureTxns) {
        const convertedAmount = await convertCurrency(txn.amount, txn.currency, baseCurrency);
        if (txn.type === "income") futureAmount += convertedAmount;
        else if (txn.type === "expense") futureAmount -= convertedAmount;
      }

      // Wishlist confirmed items (still fetched locally — not in context)
      const allWishlistItems = await wishlistItemRepository.getByUserId(user!.uid);
      const confirmedItems = allWishlistItems.filter((item: WishlistItem) => item.isConfirmed);

      let confirmedWishlistTotal = 0;
      for (const item of confirmedItems) {
        const convertedAmount = await convertCurrency(item.amount, item.currency, baseCurrency);
        confirmedWishlistTotal += convertedAmount;
      }

      // Saving accounts
      const savingAccounts = accounts.filter((acc) => acc.isSaving);
      let savingAccountsTotal = 0;
      if (savingAccounts.length > 0) {
        savingAccountsTotal = await convertMultipleCurrencies(
          savingAccounts.map((acc) => ({ amount: acc.balance, currency: acc.currency })),
          baseCurrency
        );
      }

      setTotalBalance(accountsBalance);
      setBalanceWithFuture(accountsBalance - futureAmount - confirmedWishlistTotal - savingAccountsTotal);

      // Month stats
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const endOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);
      endOfMonth.setHours(23, 59, 59, 999);

      const monthTxns = transactions.filter((txn) => {
        const txnDate =
          txn.date instanceof Date ? txn.date : (txn.date as { toDate: () => Date }).toDate();
        return txnDate >= startOfMonth && txnDate <= endOfMonth;
      });

      const systemCategoryIds = categories
        .filter((cat) => cat.name === SYSTEM_CATEGORIES.TRANSFER_OUT || cat.name === SYSTEM_CATEGORIES.TRANSFER_IN)
        .map((cat) => cat.id);

      const nonTransferTxns = monthTxns.filter((txn) => !systemCategoryIds.includes(txn.categoryId));

      let income = 0;
      let expenses = 0;
      for (const txn of nonTransferTxns) {
        const convertedAmount = await convertCurrency(txn.amount, txn.currency, baseCurrency);
        if (txn.type === "income") income += convertedAmount;
        else if (txn.type === "expense") expenses += convertedAmount;
      }

      setStats({ income, expenses, balance: income - expenses, transactionCount: nonTransferTxns.length });
    } catch (error) {
      console.error("Failed to calculate dashboard data:", error);
    }
  }, [user, accounts, transactions, categories, userSettings]);

  useEffect(() => {
    calculateDashboardData();
  }, [calculateDashboardData]);

  const getAccountName = (accountId: string) => {
    return allAccounts.find((acc) => acc.id === accountId)?.name || "Unknown";
  };

  const handleAddTransaction = async (data: CreateTransactionInput, currency: string) => {
    if (!user) return;
    try {
      await transactionRepository.create(user.uid, data, currency);
      await refreshTransactions();
      setShowQuickActions(false);
    } catch (error) {
      console.error("Failed to add transaction:", error);
      throw error;
    }
  };

  const handleSignOut = async () => {
    await signOut();
  };

  if (authLoading || dataLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-sm text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const isPositive = balanceWithFuture >= 0;
  const baseCurrency = userSettings?.baseCurrency || "USD";

  return (
    <div className="min-h-screen bg-background pb-24">
      <PageHeader
        title="TineX"
        rightElement={
          <Button variant="ghost" size="icon" onClick={handleSignOut} className="text-muted-foreground hover:text-foreground">
            <LogOut className="h-4 w-4" />
            <span className="sr-only">Sign out</span>
          </Button>
        }
      />

      <main className="container max-w-screen-2xl px-4 py-5 space-y-5">

        {/* Balance Card */}
        <Card
          className={cn(
            "relative overflow-hidden",
            isPositive
              ? "border-primary/25 bg-primary/[0.07] shadow-primary/10"
              : "border-destructive/25 bg-destructive/[0.07] shadow-destructive/10",
            "shadow-xl"
          )}
        >
          {/* Subtle glow orb top-right */}
          <div
            className={cn(
              "absolute -top-10 -right-10 w-40 h-40 rounded-full blur-3xl opacity-20",
              isPositive ? "bg-primary" : "bg-destructive"
            )}
          />
          <CardHeader className="pb-2 relative z-10">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs font-medium uppercase tracking-widest text-muted-foreground/70">
                Total Balance
              </CardDescription>
              <Badge variant="secondary" className="text-xs bg-white/[0.06] border-white/[0.08] text-muted-foreground">
                {baseCurrency}
              </Badge>
            </div>
            <CardTitle
              className={cn(
                "text-4xl md:text-5xl font-bold tracking-tight mt-1",
                !isPositive && "text-destructive"
              )}
            >
              {formatCurrency(balanceWithFuture, baseCurrency)}
            </CardTitle>
            {balanceWithFuture !== totalBalance && (
              <p className="text-xs text-muted-foreground mt-1">
                Current: {formatCurrency(totalBalance, baseCurrency)}
              </p>
            )}
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="grid grid-cols-3 gap-3 pt-1">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <div className="w-6 h-6 rounded-md bg-white/[0.06] flex items-center justify-center">
                    <Wallet className="h-3 w-3" />
                  </div>
                  <span className="text-xs">Accounts</span>
                </div>
                <span className="text-base font-semibold pl-0.5">{allAccounts.length}</span>
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-6 rounded-md bg-success/10 flex items-center justify-center">
                    <TrendingUp className="h-3 w-3 text-success" />
                  </div>
                  <span className="text-xs text-muted-foreground">Income</span>
                </div>
                <span className="text-base font-semibold pl-0.5 text-success">
                  {formatCurrency(stats.income, baseCurrency)}
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
                  {formatCurrency(stats.expenses, baseCurrency)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Accounts Section */}
        {allAccounts.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between px-0.5">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Accounts</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/accounts")}
                className="text-xs text-muted-foreground hover:text-foreground gap-1 h-7 px-2"
              >
                View All
                <ArrowUpRight className="h-3 w-3" />
              </Button>
            </div>
            <div className="overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
              <div className="flex gap-3 min-w-max">
                {allAccounts.map((account) => {
                  const AccountIcon = account.icon
                    ? CATEGORY_ICONS[account.icon as keyof typeof CATEGORY_ICONS] || Wallet
                    : Wallet;
                  const accountColor = account.isSaving ? "#f59e0b" : (account.color || "#6b7280");
                  const isNegativeBalance = account.balance < 0;

                  return (
                    <Link key={account.id} href={`/accounts/${account.id}`} className="flex-shrink-0">
                      <div
                        className={cn(
                          "w-[140px] rounded-2xl p-4 border backdrop-blur-sm transition-all duration-200",
                          "hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]",
                          account.isSaving
                            ? "border-amber-500/25 bg-amber-500/[0.05] hover:bg-amber-500/[0.08] shadow-amber-500/10"
                            : "border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] hover:border-primary/20",
                          "shadow-lg shadow-black/20"
                        )}
                      >
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
                          style={{
                            backgroundColor: `${accountColor}18`,
                            boxShadow: `0 0 12px -2px ${accountColor}40`,
                          }}
                        >
                          <AccountIcon className="h-4.5 w-4.5" style={{ color: accountColor }} />
                        </div>
                        <p className="text-xs text-muted-foreground truncate mb-0.5">{account.name}</p>
                        <p className={cn(
                          "text-sm font-bold tracking-tight",
                          isNegativeBalance ? "text-destructive" : "text-foreground"
                        )}>
                          {getCurrencySymbol(account.currency)}{account.balance.toFixed(2)}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <Card className="border-destructive/25 bg-destructive/[0.05]">
            <CardHeader>
              <CardTitle className="text-base">No Accounts</CardTitle>
              <CardDescription>Create an account to start tracking transactions</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="default" className="w-full" onClick={() => router.push("/settings")}>
                <Wallet className="h-4 w-4 mr-2" />
                Create Your First Account
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="border-destructive/20 bg-destructive/[0.04]">
            <CardHeader className="pb-1">
              <CardDescription className="text-xs">Spent this month</CardDescription>
              <CardTitle className="text-2xl font-bold text-destructive tracking-tight">
                {formatCurrency(stats.expenses, baseCurrency)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">of your expenses</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-1">
              <CardDescription className="text-xs">Transactions</CardDescription>
              <CardTitle className="text-2xl font-bold tracking-tight">{stats.transactionCount}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">This month</p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Transactions */}
        {transactions.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between px-0.5">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Recent</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/transactions")}
                className="text-xs text-muted-foreground hover:text-foreground gap-1 h-7 px-2"
              >
                View All
                <ArrowUpRight className="h-3 w-3" />
              </Button>
            </div>
            <Card>
              <CardContent className="p-0 divide-y divide-white/[0.05]">
                {transactions.slice(0, 5).map((txn) => {
                  const category = categories.find((c) => c.id === txn.categoryId);
                  const transactionTags = tags.filter((t) => txn.tags?.includes(t.id));
                  return (
                    <TransactionListItem
                      key={txn.id}
                      transaction={txn}
                      category={category}
                      tags={transactionTags}
                      accountName={getAccountName(txn.accountId)}
                      returnTo="/dashboard"
                    />
                  );
                })}
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Get Started</CardTitle>
              <CardDescription>Add your first transaction to start tracking</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="default" className="w-full" onClick={() => setShowAddTransaction(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Transaction
              </Button>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Floating Action Button */}
      <FAB className="bottom-24 right-4" onClick={() => setShowQuickActions(!showQuickActions)}>
        <Plus className="h-6 w-6" />
      </FAB>

      {/* Quick Actions Menu */}
      {showQuickActions && (
        <>
          <div
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
            onClick={() => setShowQuickActions(false)}
          />
          <div className="fixed bottom-40 right-4 z-50 flex flex-col gap-2">
            <Button
              size="lg"
              onClick={() => {
                setShowAddTransaction(true);
                setShowQuickActions(false);
              }}
              className="gap-2 shadow-xl shadow-primary/20"
            >
              <Plus className="h-5 w-5" />
              Add Transaction
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => {
                setShowAddTransfer(true);
                setShowQuickActions(false);
              }}
              className="gap-2 shadow-xl shadow-black/30"
            >
              <ArrowRightLeft className="h-5 w-5" />
              Add Transfer
            </Button>
            <Button
              size="lg"
              variant="secondary"
              onClick={() => router.push("/import")}
              className="gap-2 shadow-xl shadow-black/30"
            >
              <Upload className="h-5 w-5" />
              Import Statement
            </Button>
          </div>
        </>
      )}

      {/* Add Transaction Dialog */}
      <Dialog open={showAddTransaction} onOpenChange={setShowAddTransaction}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Transaction</DialogTitle>
          </DialogHeader>
          <AddTransactionForm
            onSubmit={handleAddTransaction}
            onCancel={() => setShowAddTransaction(false)}
            accounts={allAccounts}
          />
        </DialogContent>
      </Dialog>

      {/* Add Transfer Dialog */}
      <Dialog open={showAddTransfer} onOpenChange={setShowAddTransfer}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Transfer</DialogTitle>
          </DialogHeader>
          <AddTransferForm
            onSuccess={async () => {
              await refreshTransactions();
              setShowAddTransfer(false);
            }}
            onCancel={() => setShowAddTransfer(false)}
            accounts={allAccounts}
          />
        </DialogContent>
      </Dialog>

      <BottomNav />

      {user && <WhatsNewPopup userId={user.uid} />}
    </div>
  );
}
