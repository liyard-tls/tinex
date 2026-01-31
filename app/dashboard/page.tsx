"use client";

import { Plus, LogOut, Wallet, TrendingUp, TrendingDown, Upload, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import BottomNav from "@/shared/components/layout/BottomNav";
import FAB from "@/shared/components/ui/FAB";
import AddTransactionForm from "@/modules/transactions/AddTransactionForm";
import TransactionListItem from "@/shared/components/ui/TransactionListItem";

import { transactionRepository } from "@/core/repositories/TransactionRepository";
import { accountRepository } from "@/core/repositories/AccountRepository";
import { categoryRepository } from "@/core/repositories/CategoryRepository";
import { tagRepository } from "@/core/repositories/TagRepository";
import { userSettingsRepository } from "@/core/repositories/UserSettingsRepository";
import { wishlistItemRepository } from "@/core/repositories/WishlistItemRepository";
import {
  CreateTransactionInput,
  Transaction,
  Account,
  Category,
  Tag,
  UserSettings,
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
  const [user, setUser] = useState<{
    uid: string;
    email: string;
    displayName?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddTransaction, setShowAddTransaction] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [allAccounts, setAllAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
  const [stats, setStats] = useState({
    income: 0,
    expenses: 0,
    balance: 0,
    transactionCount: 0,
  });
  const [totalBalance, setTotalBalance] = useState<number>(0);
  const [balanceWithFuture, setBalanceWithFuture] = useState<number>(0);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser({
          uid: currentUser.uid,
          email: currentUser.email || "",
          displayName: currentUser.displayName || undefined,
        });
        await loadData(currentUser.uid);
      } else {
        router.push("/auth");
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  const loadData = async (userId: string) => {
    try {
      const settings = await userSettingsRepository.getOrCreate(userId);
      setUserSettings(settings);

      const allTxns = await transactionRepository.getByUserId(userId);
      const userAccounts = await accountRepository.getByUserId(userId);

      // Convert all account balances to base currency for sorting
      const accountsWithConvertedBalance = await Promise.all(
        userAccounts.map(async (account) => {
          const convertedBalance = await convertCurrency(
            account.balance,
            account.currency,
            settings.baseCurrency
          );
          return {
            ...account,
            convertedBalance,
          };
        })
      );

      // Sort by absolute balance value (descending)
      const sortedAccounts = accountsWithConvertedBalance.sort(
        (a, b) => Math.abs(b.convertedBalance) - Math.abs(a.convertedBalance)
      );

      setAllAccounts(sortedAccounts);

      let accountsBalance = 0;
      if (userAccounts.length > 0) {
        accountsBalance = await convertMultipleCurrencies(
          userAccounts.map((acc) => ({
            amount: acc.balance,
            currency: acc.currency,
          })),
          settings.baseCurrency
        );
      }

      const now = new Date();
      const futureTxns = allTxns.filter((txn) => {
        const txnDate =
          txn.date instanceof Date ? txn.date : (txn.date as { toDate: () => Date }).toDate();
        return txnDate > now;
      });

      let futureAmount = 0;
      for (const txn of futureTxns) {
        const convertedAmount = await convertCurrency(
          txn.amount,
          txn.currency,
          settings.baseCurrency
        );
        if (txn.type === "income") {
          futureAmount += convertedAmount;
        } else if (txn.type === "expense") {
          futureAmount -= convertedAmount;
        }
      }

      const allWishlistItems = await wishlistItemRepository.getByUserId(userId);
      const confirmedItems = allWishlistItems.filter((item: WishlistItem) => item.isConfirmed);

      let confirmedWishlistTotal = 0;
      for (const item of confirmedItems) {
        const convertedAmount = await convertCurrency(
          item.amount,
          item.currency,
          settings.baseCurrency
        );
        confirmedWishlistTotal += convertedAmount;
      }

      // Calculate saving accounts total
      const savingAccounts = userAccounts.filter((acc) => acc.isSaving);
      let savingAccountsTotal = 0;
      if (savingAccounts.length > 0) {
        savingAccountsTotal = await convertMultipleCurrencies(
          savingAccounts.map((acc) => ({
            amount: acc.balance,
            currency: acc.currency,
          })),
          settings.baseCurrency
        );
      }

      setTotalBalance(accountsBalance);
      setBalanceWithFuture(accountsBalance - futureAmount - confirmedWishlistTotal - savingAccountsTotal);

      const [userCategories, userTags] = await Promise.all([
        categoryRepository.getByUserId(userId),
        tagRepository.getByUserId(userId),
      ]);

      if (userCategories.length === 0) {
        await categoryRepository.createDefaultCategories(userId);
        const updatedCategories = await categoryRepository.getByUserId(userId);
        setCategories(updatedCategories);
      } else {
        setCategories(userCategories);
      }

      setTags(userTags);

      const txns = await transactionRepository.getByUserId(userId, {
        limitCount: 10,
      });
      setTransactions(txns);

      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const endOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);
      endOfMonth.setHours(23, 59, 59, 999);

      const monthTxns = allTxns.filter((txn) => {
        const txnDate =
          txn.date instanceof Date ? txn.date : (txn.date as { toDate: () => Date }).toDate();
        return txnDate >= startOfMonth && txnDate <= endOfMonth;
      });

      const systemCategoryIds = userCategories
        .filter(
          (cat) =>
            cat.name === SYSTEM_CATEGORIES.TRANSFER_OUT ||
            cat.name === SYSTEM_CATEGORIES.TRANSFER_IN
        )
        .map((cat) => cat.id);

      const nonTransferTxns = monthTxns.filter(
        (txn) => !systemCategoryIds.includes(txn.categoryId)
      );

      let income = 0;
      let expenses = 0;

      for (const txn of nonTransferTxns) {
        const convertedAmount = await convertCurrency(
          txn.amount,
          txn.currency,
          settings.baseCurrency
        );
        if (txn.type === "income") {
          income += convertedAmount;
        } else if (txn.type === "expense") {
          expenses += convertedAmount;
        }
      }

      setStats({
        income,
        expenses,
        balance: income - expenses,
        transactionCount: nonTransferTxns.length,
      });
    } catch (error) {
      console.error("Failed to load data:", error);
    }
  };

  const getAccountName = (accountId: string) => {
    return allAccounts.find((acc) => acc.id === accountId)?.name || "Unknown";
  };

  const handleAddTransaction = async (data: CreateTransactionInput, currency: string) => {
    if (!user) return;

    try {
      await transactionRepository.create(user.uid, data, currency);
      await loadData(user.uid);
      // Don't close the form - user may want to add more transactions
      setShowQuickActions(false);
    } catch (error) {
      console.error("Failed to add transaction:", error);
      throw error;
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.push("/");
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-sm text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container flex h-14 max-w-screen-2xl items-center px-4">
          <div className="flex-1">
            <h1 className="text-lg font-semibold md:text-xl">TineX</h1>
            <p className="text-xs text-muted-foreground truncate max-w-[200px]">{user.email}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={handleSignOut}>
            <LogOut className="h-4 w-4" />
            <span className="sr-only">Sign out</span>
          </Button>
        </div>
      </header>

      <main className="container max-w-screen-2xl px-4 py-6 space-y-6">
        {/* Balance Card */}
        <Card
          className={cn(
            "bg-gradient-to-br border-2",
            balanceWithFuture >= 0
              ? "from-primary/20 to-primary/5 border-primary/20"
              : "from-destructive/20 to-destructive/5 border-destructive/20"
          )}
        >
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center justify-between">
              <span>Total Balance</span>
              <Badge variant="secondary" className="text-xs">
                {userSettings?.baseCurrency || "USD"}
              </Badge>
            </CardDescription>
            <CardTitle className={cn("text-3xl md:text-4xl", balanceWithFuture < 0 && "text-destructive")}>
              {formatCurrency(balanceWithFuture, userSettings?.baseCurrency || "USD")}
            </CardTitle>
            {balanceWithFuture !== totalBalance && (
              <p className="text-sm text-muted-foreground">
                Current: {formatCurrency(totalBalance, userSettings?.baseCurrency || "USD")}
              </p>
            )}
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Wallet className="h-3 w-3" />
                  <span className="text-xs">Accounts</span>
                </div>
                <span className="font-semibold">{allAccounts.length}</span>
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1 text-green-500">
                  <TrendingUp className="h-3 w-3" />
                  <span className="text-xs">Income</span>
                </div>
                <span className="font-semibold">
                  {formatCurrency(stats.income, userSettings?.baseCurrency || "USD")}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1 text-destructive">
                  <TrendingDown className="h-3 w-3" />
                  <span className="text-xs">Expenses</span>
                </div>
                <span className="font-semibold">
                  {formatCurrency(stats.expenses, userSettings?.baseCurrency || "USD")}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Accounts Section */}
        {allAccounts.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Accounts</h2>
              <Button variant="ghost" size="sm" onClick={() => router.push("/accounts")}>
                View All
              </Button>
            </div>
            <div className="overflow-x-auto pb-2 -mx-4 px-4">
              <div className="flex gap-3 min-w-max">
                {allAccounts.map((account) => {
                  const AccountIcon = account.icon
                    ? CATEGORY_ICONS[account.icon as keyof typeof CATEGORY_ICONS] || Wallet
                    : Wallet;
                  const accountColor = account.isSaving ? "#f59e0b" : (account.color || "#6b7280");
                  const isNegativeBalance = account.balance < 0;

                  return (
                    <Link key={account.id} href={`/accounts/${account.id}`} className="flex-shrink-0">
                      <Card className={cn(
                        "w-[160px] hover:bg-accent/50 transition-colors",
                        account.isSaving && "border-amber-500/50 bg-amber-500/5"
                      )}>
                        <CardContent className="p-4 space-y-3">
                          <div
                            className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto"
                            style={{ backgroundColor: `${accountColor}20` }}
                          >
                            <AccountIcon className="h-6 w-6" style={{ color: accountColor }} />
                          </div>
                          <div className="text-center space-y-1">
                            <p className="text-sm font-medium truncate">{account.name}</p>
                            <p className={cn(
                              "text-lg font-bold",
                              isNegativeBalance && "text-destructive"
                            )}>
                              {getCurrencySymbol(account.currency)}
                              {account.balance.toFixed(2)}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <Card className="border-destructive/50 bg-destructive/5">
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
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>This Month</CardDescription>
              <CardTitle className="text-2xl text-destructive">
                {formatCurrency(stats.expenses, userSettings?.baseCurrency || "USD")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Total spent</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Transactions</CardDescription>
              <CardTitle className="text-2xl">{stats.transactionCount}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">This month</p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Transactions */}
        {transactions.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Recent Transactions</h2>
              <Button variant="ghost" size="sm" onClick={() => router.push("/transactions")}>
                View All
              </Button>
            </div>
            <Card>
              <CardContent className="p-0 divide-y">
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
              <CardTitle>Get Started</CardTitle>
              <CardDescription>Add your first transaction to start tracking</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="default"
                className="w-full"
                onClick={() => setShowAddTransaction(true)}
              >
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
            className="fixed inset-0 bg-black/20 z-40"
            onClick={() => setShowQuickActions(false)}
          />
          <div className="fixed bottom-40 right-4 z-50 flex flex-col gap-2">
            <Button
              size="lg"
              onClick={() => {
                setShowAddTransaction(true);
                setShowQuickActions(false);
              }}
              className="gap-2 shadow-lg"
            >
              <Plus className="h-5 w-5" />
              Add Transaction
            </Button>
            <Button
              size="lg"
              variant="secondary"
              onClick={() => router.push("/import")}
              className="gap-2 shadow-lg"
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

      <BottomNav />
    </div>
  );
}
