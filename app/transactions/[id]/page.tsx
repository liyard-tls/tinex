"use client";
import { MoreHorizontal, ArrowLeft, Trash2 } from 'lucide-react';
import { useEffect, useState } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import BottomNav from "@/shared/components/layout/BottomNav";
import { Button } from "@/shared/components/ui";
import { Input } from "@/shared/components/ui";
import AccountSelect from "@/shared/components/ui/AccountSelect";

import { transactionRepository } from "@/core/repositories/TransactionRepository";
import { accountRepository } from "@/core/repositories/AccountRepository";
import { categoryRepository } from "@/core/repositories/CategoryRepository";
import { Transaction, Account, Category, CURRENCIES } from "@/core/models";
import { formatDate } from "date-fns";
import { cn } from "@/shared/utils/cn";
import { CATEGORY_ICONS } from '@/shared/config/icons';


export default function TransactionDetailPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const transactionId = params.id as string;
  const returnTo = searchParams.get('returnTo');

  const [user, setUser] = useState<{ uid: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Helper function to get currency symbol
  const getCurrencySymbol = (currency: string) => {
    return CURRENCIES.find((c) => c.value === currency)?.symbol || currency;
  };

  // Form state
  const [formData, setFormData] = useState({
    type: "expense" as "income" | "expense" | "transfer",
    amount: "",
    description: "",
    date: "",
    time: "",
    accountId: "",
    categoryId: "",
    merchantName: "",
    notes: "",
    excludeFromAnalytics: false,
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser({ uid: currentUser.uid });
        await loadData(currentUser.uid);
      } else {
        router.push("/auth");
      }
      setLoading(false);
    });

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, transactionId]);

  const loadData = async (userId: string) => {
    try {
      // Load transaction
      const txn = await transactionRepository.getById(transactionId);
      if (!txn || txn.userId !== userId) {
        router.push("/transactions");
        return;
      }

      setTransaction(txn);
      setSelectedTags(txn.tags || []);

      // Load accounts and categories
      const [userAccounts, userCategories] = await Promise.all([
        accountRepository.getByUserId(userId),
        categoryRepository.getByUserId(userId),
      ]);

      setAccounts(userAccounts);
      setCategories(userCategories);

      // Populate form
      const txnDate = txn.date;
      setFormData({
        type: txn.type,
        amount: txn.amount.toString(),
        description: txn.description,
        date: formatDate(txnDate, "yyyy-MM-dd"),
        time: formatDate(txnDate, "HH:mm"),
        accountId: txn.accountId,
        categoryId: txn.categoryId || "",
        merchantName: txn.merchantName || "",
        notes: txn.notes || "",
        excludeFromAnalytics: txn.excludeFromAnalytics || false,
      });
    } catch (error) {
      console.error("Failed to load transaction:", error);
      router.push("/transactions");
    }
  };

  // Auto-save effect
  useEffect(() => {
    // Skip auto-save on initial load
    if (isInitialLoad) {
      setIsInitialLoad(false);
      return;
    }

    const autoSave = async () => {
      if (!user || !transaction) return;
      if (saving) return; // Prevent concurrent saves

      setSaving(true);
      try {
        const dateTime = new Date(`${formData.date}T${formData.time}`);

        await transactionRepository.update({
          id: transactionId,
          type: formData.type,
          amount: parseFloat(formData.amount),
          description: formData.description,
          date: dateTime,
          accountId: formData.accountId,
          categoryId: formData.categoryId || "",
          merchantName: formData.merchantName,
          notes: formData.notes,
          tags: selectedTags,
          excludeFromAnalytics: formData.excludeFromAnalytics,
        });
      } catch (error) {
        console.error("Failed to save transaction:", error);
      } finally {
        setSaving(false);
      }
    };

    // Debounce auto-save by 1 second
    const timeoutId = setTimeout(() => {
      if (transaction) {
        autoSave();
      }
    }, 1000);

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData, selectedTags]);

  const handleDelete = async () => {
    if (!user || !transaction) return;

    if (!confirm("Are you sure you want to delete this transaction?")) {
      return;
    }

    setDeleting(true);
    try {
      await transactionRepository.delete(transactionId);
      router.push(returnTo || "/transactions");
    } catch (error) {
      console.error("Failed to delete transaction:", error);
      alert("Failed to delete transaction");
    } finally {
      setDeleting(false);
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

  if (!transaction) {
    return null;
  }

  const category = categories.find((c) => c.id === formData.categoryId);
  const IconComponent = category
    ? CATEGORY_ICONS[category.icon as keyof typeof CATEGORY_ICONS] || MoreHorizontal
    : MoreHorizontal;

  return (
    <div className="min-h-screen bg-background relative">
      <div className="container max-w-2xl mx-auto p-4 pb-20 relative">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="ghost"
            onClick={() => router.push(returnTo || "/transactions")}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          {saving && (
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          )}
        </div>

        {/* Hero Section with Icon and Amount */}
        <div className="bg-card rounded-2xl overflow-hidden mb-4 relative">
          {/* Background gradient */}
          <div
            className="absolute top-0 left-0 right-0 h-36"
            style={{
              background: category
                ? `linear-gradient(180deg, ${category.color}30 0%, ${category.color}10 100%)`
                : "linear-gradient(180deg, #6b728030 0%, #6b728010 100%)",
            }}
          />

          {/* Content */}
          <div className="relative z-10 pt-28 pb-6 px-6">
            {/* Category Icon */}
            <div className="flex justify-center mb-4">
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center"
                style={{
                  backgroundColor: category ? category.color : "#6b7280",
                }}
              >
                <IconComponent className="h-10 w-10 text-white" />
              </div>
            </div>

            {/* Amount */}
            <div className="text-center mb-2">
              <p
                className={cn(
                  "text-5xl font-bold",
                  formData.type === "income"
                    ? "text-success"
                    : "text-destructive"
                )}
              >
                {formData.type === "income" ? "+" : "-"}
                {transaction?.currency
                  ? getCurrencySymbol(transaction.currency)
                  : "$"}
                {formData.amount}
              </p>
            </div>

            {/* Description and Date */}
            <div className="text-center">
              <p className="text-base font-medium mb-1">
                {formData.description}
              </p>
              <p className="text-sm text-muted-foreground">
                {formatDate(
                  new Date(`${formData.date}T${formData.time}`),
                  "HH:mm:ss, dd.MM.yy"
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Details Cards */}
        <div className="space-y-3">
          {/* Details Card */}
          <div className="bg-card rounded-2xl p-4">
            <div className="space-y-3">
              {/* Type */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Type</span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={
                      formData.type === "expense" ? "default" : "outline"
                    }
                    onClick={() =>
                      setFormData({ ...formData, type: "expense" })
                    }
                  >
                    Expense
                  </Button>
                  <Button
                    size="sm"
                    variant={formData.type === "income" ? "default" : "outline"}
                    onClick={() => setFormData({ ...formData, type: "income" })}
                  >
                    Income
                  </Button>
                </div>
              </div>

              <div className="h-px bg-border" />

              {/* Category */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Category</span>
                <select
                  value={formData.categoryId}
                  onChange={(e) =>
                    setFormData({ ...formData, categoryId: e.target.value })
                  }
                  className="px-3 py-1.5 text-sm bg-background border border-border rounded-md"
                >
                  <option value="">No category</option>
                  {categories
                    .filter((c) => c.type === formData.type)
                    .map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                </select>
              </div>

              <div className="h-px bg-border" />

              {/* Account */}
              <div>
                <AccountSelect
                  accounts={accounts}
                  value={formData.accountId}
                  onChange={(accountId) => {
                    setFormData({ ...formData, accountId });
                    // Update transaction currency when account changes
                    const selectedAccount = accounts.find(acc => acc.id === accountId);
                    if (selectedAccount && transaction) {
                      // Update transaction currency in database
                      transactionRepository.update({
                        id: transactionId,
                        accountId: accountId,
                        currency: selectedAccount.currency,
                      }).catch((error) => {
                        console.error('Failed to update currency:', error);
                      });
                      // Update local transaction state
                      setTransaction({
                        ...transaction,
                        currency: selectedAccount.currency,
                        accountId: accountId,
                      });
                    }
                  }}
                  label=""
                />
              </div>

              <div className="h-px bg-border" />

              {/* Amount */}
              <div className="flex items-center">
                <span className="text-sm text-muted-foreground">Amount</span>
                <div className="ml-auto">
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) =>
                      setFormData({ ...formData, amount: e.target.value })
                    }
                    className="w-32 h-8 text-sm text-right"
                  />
                </div>
              </div>

              <div className="h-px bg-border" />

              {/* Description */}
              <div>
                <label className="text-sm text-muted-foreground block mb-2">
                  Description
                </label>
                <Input
                  type="text"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="w-full"
                />
              </div>

              <div className="h-px bg-border" />

              {/* Merchant */}
              <div>
                <label className="text-sm text-muted-foreground block mb-2">
                  Merchant
                </label>
                <Input
                  type="text"
                  value={formData.merchantName}
                  onChange={(e) =>
                    setFormData({ ...formData, merchantName: e.target.value })
                  }
                  placeholder="Optional"
                  className="w-full"
                />
              </div>

              <div className="h-px bg-border" />

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-muted-foreground block mb-2">
                    Date
                  </label>
                  <Input
                    type="date"
                    value={formData.date}
                    onChange={(e) =>
                      setFormData({ ...formData, date: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground block mb-2">
                    Time
                  </label>
                  <Input
                    type="time"
                    value={formData.time}
                    onChange={(e) =>
                      setFormData({ ...formData, time: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="h-px bg-border" />

              {/* Notes */}
              <div>
                <label className="text-sm text-muted-foreground block mb-2">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  placeholder="Add notes..."
                  className="w-full min-h-[80px] px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="h-px bg-border" />

              {/* Exclude from Analytics */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium">Exclude from Analytics</span>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    This transaction won't be included in analytics calculations
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.excludeFromAnalytics}
                    onChange={(e) =>
                      setFormData({ ...formData, excludeFromAnalytics: e.target.checked })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-muted peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>
            </div>
          </div>

          {/* Delete Button */}
          <button
            onClick={handleDelete}
            disabled={deleting || saving}
            className="w-full bg-card rounded-2xl p-4 flex items-center justify-center gap-2 text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            <span className="text-sm font-medium">
              {deleting ? "Deleting..." : "Delete Transaction"}
            </span>
          </button>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
