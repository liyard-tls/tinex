'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import BottomNav from '@/shared/components/layout/BottomNav';
import { Button } from '@/shared/components/ui';
import { Input } from '@/shared/components/ui';
import {
  ArrowLeft,
  Trash2,
  Edit,
  Save,
  X,
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
} from 'lucide-react';
import { transactionRepository } from '@/core/repositories/TransactionRepository';
import { accountRepository } from '@/core/repositories/AccountRepository';
import { categoryRepository } from '@/core/repositories/CategoryRepository';
import { tagRepository } from '@/core/repositories/TagRepository';
import { Transaction, Account, Category, Tag } from '@/core/models';
import { formatDate } from 'date-fns';
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

export default function TransactionDetailPage() {
  const router = useRouter();
  const params = useParams();
  const transactionId = params.id as string;

  const [user, setUser] = useState<{ uid: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Form state
  const [formData, setFormData] = useState({
    type: 'expense' as 'income' | 'expense' | 'transfer',
    amount: '',
    description: '',
    date: '',
    time: '',
    accountId: '',
    categoryId: '',
    merchantName: '',
    notes: '',
  });

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
  }, [router, transactionId]);

  const loadData = async (userId: string) => {
    try {
      // Load transaction
      const txn = await transactionRepository.getById(transactionId);
      if (!txn || txn.userId !== userId) {
        router.push('/transactions');
        return;
      }

      setTransaction(txn);
      setSelectedTags(txn.tags || []);

      // Load accounts, categories, and tags
      const [userAccounts, userCategories, userTags] = await Promise.all([
        accountRepository.getByUserId(userId),
        categoryRepository.getByUserId(userId),
        tagRepository.getByUserId(userId),
      ]);

      setAccounts(userAccounts);
      setCategories(userCategories);
      setTags(userTags);

      // Populate form
      const txnDate = txn.date;
      setFormData({
        type: txn.type,
        amount: txn.amount.toString(),
        description: txn.description,
        date: formatDate(txnDate, 'yyyy-MM-dd'),
        time: formatDate(txnDate, 'HH:mm'),
        accountId: txn.accountId,
        categoryId: txn.categoryId || '',
        merchantName: txn.merchantName || '',
        notes: txn.notes || '',
      });
    } catch (error) {
      console.error('Failed to load transaction:', error);
      router.push('/transactions');
    }
  };

  const handleSave = async () => {
    if (!user || !transaction) return;

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
        categoryId: formData.categoryId || '',
        merchantName: formData.merchantName,
        notes: formData.notes,
        tags: selectedTags,
      });

      await loadData(user.uid);
      setEditMode(false);
    } catch (error) {
      console.error('Failed to save transaction:', error);
      alert('Failed to save transaction');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (!transaction) return;

    // Reset form to original values
    const txnDate = transaction.date;
    setFormData({
      type: transaction.type,
      amount: transaction.amount.toString(),
      description: transaction.description,
      date: formatDate(txnDate, 'yyyy-MM-dd'),
      time: formatDate(txnDate, 'HH:mm'),
      accountId: transaction.accountId,
      categoryId: transaction.categoryId || '',
      merchantName: transaction.merchantName || '',
      notes: transaction.notes || '',
    });
    setSelectedTags(transaction.tags || []);
    setEditMode(false);
  };

  const handleDelete = async () => {
    if (!user || !transaction) return;

    if (!confirm('Are you sure you want to delete this transaction?')) {
      return;
    }

    setDeleting(true);
    try {
      await transactionRepository.delete(transactionId);
      router.push('/transactions');
    } catch (error) {
      console.error('Failed to delete transaction:', error);
      alert('Failed to delete transaction');
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleTag = (tagId: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
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
  const account = accounts.find((a) => a.id === formData.accountId);
  const IconComponent = category
    ? ICONS[category.icon as keyof typeof ICONS] || MoreHorizontal
    : MoreHorizontal;

  return (
    <div className="min-h-screen bg-background relative">
      <div className="container max-w-2xl mx-auto p-4 pb-20 relative">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="ghost"
            onClick={() => router.push('/transactions')}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          {!editMode ? (
            <Button
              variant="outline"
              onClick={() => setEditMode(true)}
              className="gap-2"
            >
              <Edit className="h-4 w-4" />
              Edit
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="ghost" onClick={handleCancel} disabled={saving}>
                <X className="h-4 w-4" />
              </Button>
              <Button onClick={handleSave} disabled={saving} className="gap-2">
                <Save className="h-4 w-4" />
                {saving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          )}
        </div>

        {/* Hero Section with Icon and Amount */}
        <div className="bg-card rounded-2xl overflow-hidden mb-4 relative">
          {/* Background gradient */}
          <div
            className="absolute top-0 left-0 right-0 h-48"
            style={{
              background: category
                ? `linear-gradient(180deg, ${category.color}30 0%, ${category.color}10 100%)`
                : 'linear-gradient(180deg, #6b728030 0%, #6b728010 100%)',
            }}
          />

          {/* Content */}
          <div className="relative z-10 pt-36 pb-6 px-6">
            {/* Category Icon */}
            <div className="flex justify-center mb-4">
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center"
                style={{
                  backgroundColor: category ? category.color : '#6b7280',
                }}
              >
                <IconComponent
                  className="h-10 w-10 text-white"
                />
              </div>
            </div>

            {/* Amount */}
            <div className="text-center mb-2">
              <p
                className={cn(
                  'text-5xl font-bold',
                  formData.type === 'income' ? 'text-success' : 'text-foreground'
                )}
              >
                {formData.type === 'income' ? '+' : '-'}${formData.amount}
              </p>
            </div>

            {/* Description and Date */}
            <div className="text-center">
              <p className="text-base font-medium mb-1">{formData.description}</p>
              <p className="text-sm text-muted-foreground">
                {formatDate(new Date(formData.date), 'HH:mm:ss, dd.MM.yy')}
              </p>
            </div>
          </div>
        </div>

        {/* Details Cards */}
        <div className="space-y-3 pl-12 pr-12">
          {/* Main Details Card */}
          <div className="bg-card rounded-2xl p-4">
            <div className="space-y-3">
              {/* Type */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Type</span>
                {editMode ? (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={formData.type === 'expense' ? 'default' : 'outline'}
                      onClick={() => setFormData({ ...formData, type: 'expense' })}
                    >
                      Expense
                    </Button>
                    <Button
                      size="sm"
                      variant={formData.type === 'income' ? 'default' : 'outline'}
                      onClick={() => setFormData({ ...formData, type: 'income' })}
                    >
                      Income
                    </Button>
                  </div>
                ) : (
                  <span className="text-sm font-medium capitalize">{formData.type}</span>
                )}
              </div>

              <div className="h-px bg-border" />

              {/* Category */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Category</span>
                {editMode ? (
                  <select
                    value={formData.categoryId}
                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
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
                ) : (
                  <span className="text-sm font-medium">{category?.name || 'Uncategorized'}</span>
                )}
              </div>

              <div className="h-px bg-border" />

              {/* Account */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Account</span>
                {editMode ? (
                  <select
                    value={formData.accountId}
                    onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
                    className="px-3 py-1.5 text-sm bg-background border border-border rounded-md"
                  >
                    <option value="">Select account</option>
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({acc.currency})
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-sm font-medium">
                    {account?.name || 'Unknown'}
                  </span>
                )}
              </div>

              <div className="h-px bg-border" />

              {/* Amount */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Amount</span>
                {editMode ? (
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="w-32 h-8 text-sm"
                  />
                ) : (
                  <span className="text-sm font-medium">
                    ${parseFloat(formData.amount).toFixed(2)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Additional Details Card */}
          {editMode && (
            <div className="bg-card rounded-2xl p-4">
              <div className="space-y-3">
                {/* Description */}
                <div>
                  <label className="text-sm text-muted-foreground block mb-2">Description</label>
                  <Input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full"
                  />
                </div>

                <div className="h-px bg-border" />

                {/* Merchant */}
                <div>
                  <label className="text-sm text-muted-foreground block mb-2">Merchant</label>
                  <Input
                    type="text"
                    value={formData.merchantName}
                    onChange={(e) => setFormData({ ...formData, merchantName: e.target.value })}
                    placeholder="Optional"
                    className="w-full"
                  />
                </div>

                <div className="h-px bg-border" />

                {/* Date & Time */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm text-muted-foreground block mb-2">Date</label>
                    <Input
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground block mb-2">Time</label>
                    <Input
                      type="time"
                      value={formData.time}
                      onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                    />
                  </div>
                </div>

                <div className="h-px bg-border" />

                {/* Tags */}
                <div>
                  <label className="text-sm text-muted-foreground block mb-2">Tags</label>
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => {
                      const isSelected = selectedTags.includes(tag.id);
                      return (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => handleToggleTag(tag.id)}
                          className={cn(
                            'px-3 py-1 rounded-full text-xs font-medium transition-all',
                            isSelected ? 'ring-2 ring-offset-1' : 'opacity-60 hover:opacity-100'
                          )}
                          style={{
                            backgroundColor: isSelected ? tag.color : `${tag.color}40`,
                            color: isSelected ? '#ffffff' : tag.color,
                          }}
                        >
                          {tag.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="h-px bg-border" />

                {/* Notes */}
                <div>
                  <label className="text-sm text-muted-foreground block mb-2">Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Add notes..."
                    className="w-full min-h-[80px] px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Delete Button */}
          {editMode && (
            <button
              onClick={handleDelete}
              disabled={deleting || saving}
              className="w-full bg-card rounded-2xl p-4 flex items-center justify-center gap-2 text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              <span className="text-sm font-medium">{deleting ? 'Deleting...' : 'Delete Transaction'}</span>
            </button>
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
