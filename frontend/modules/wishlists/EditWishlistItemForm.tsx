'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/shared/components/ui';
import Input from '@/shared/components/ui/Input';
import { WishlistItem, Category, CURRENCIES, Currency, UpdateWishlistItemInput } from '@/core/models';
import { cn } from '@/shared/utils/cn';
import { MoreHorizontal, Trash2 } from 'lucide-react';
import { CATEGORY_ICONS } from '@/shared/config/icons';

interface EditWishlistItemFormProps {
  item: WishlistItem;
  categories: Category[];
  onSubmit: (data: UpdateWishlistItemInput) => Promise<void>;
  onDelete: () => Promise<void>;
  onCancel: () => void;
}

export default function EditWishlistItemForm({
  item,
  categories,
  onSubmit,
  onDelete,
  onCancel,
}: EditWishlistItemFormProps) {
  const [loading, setLoading] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(item.categoryId);

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<UpdateWishlistItemInput>({
    defaultValues: {
      name: item.name,
      amount: item.amount,
      currency: item.currency,
      categoryId: item.categoryId,
      isConfirmed: item.isConfirmed,
    }
  });

  const handleFormSubmit = async (data: UpdateWishlistItemInput) => {
    setLoading(true);
    try {
      await onSubmit({
        ...data,
        amount: Number(data.amount),
      });
    } catch (error) {
      console.error('Failed to update item:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = async () => {
    if (!confirm('Are you sure you want to delete this item?')) return;

    setLoading(true);
    try {
      await onDelete();
    } catch (error) {
      console.error('Failed to delete item:', error);
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium mb-1">
          Item Name *
        </label>
        <Input
          id="name"
          {...register('name', { required: 'Name is required' })}
          placeholder="e.g., MacBook Pro, Camera Lens"
        />
        {errors.name && (
          <p className="text-xs text-destructive mt-1">{errors.name.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="amount" className="block text-sm font-medium mb-1">
            Amount *
          </label>
          <Input
            id="amount"
            type="number"
            step="0.01"
            {...register('amount', {
              required: 'Amount is required',
              min: { value: 0, message: 'Amount must be positive' }
            })}
            placeholder="0.00"
          />
          {errors.amount && (
            <p className="text-xs text-destructive mt-1">{errors.amount.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="currency" className="block text-sm font-medium mb-1">
            Currency *
          </label>
          <select
            id="currency"
            {...register('currency', { required: 'Currency is required' })}
            className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
          >
            {CURRENCIES.map((currency) => (
              <option key={currency.value} value={currency.value}>
                {currency.symbol} {currency.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Category - Custom dropdown with icons */}
      <div className="relative">
        <input type="hidden" {...register('categoryId', { required: 'Category is required' })} />
        <label className="text-sm font-medium mb-1 block">Category *</label>
        <button
          type="button"
          onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
          className={cn(
            "flex h-9 w-full items-center justify-between rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
            errors.categoryId ? "border-destructive" : "border-input"
          )}
          disabled={loading}
        >
          {selectedCategoryId ? (
            <div className="flex items-center gap-2">
              {(() => {
                const cat = categories.find(c => c.id === selectedCategoryId);
                if (!cat) return 'Select category';
                const IconComponent = CATEGORY_ICONS[cat.icon as keyof typeof CATEGORY_ICONS] || MoreHorizontal;
                return (
                  <>
                    <div
                      className="w-5 h-5 rounded flex items-center justify-center"
                      style={{ backgroundColor: `${cat.color}20` }}
                    >
                      <IconComponent className="h-3 w-3" style={{ color: cat.color }} />
                    </div>
                    <span>{cat.name}</span>
                  </>
                );
              })()}
            </div>
          ) : (
            <span className="text-muted-foreground">Select category</span>
          )}
          <svg
            className={cn("h-4 w-4 transition-transform", showCategoryDropdown && "rotate-180")}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Dropdown menu */}
        {showCategoryDropdown && (
          <div className="absolute z-10 mt-1 w-full rounded-md border border-border bg-background shadow-lg max-h-60 overflow-auto">
            {categories.map((cat) => {
              const IconComponent = CATEGORY_ICONS[cat.icon as keyof typeof CATEGORY_ICONS] || MoreHorizontal;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setSelectedCategoryId(cat.id);
                    setValue('categoryId', cat.id, { shouldValidate: true });
                    setShowCategoryDropdown(false);
                  }}
                  className={cn(
                    "flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-muted transition-colors",
                    selectedCategoryId === cat.id && "bg-muted"
                  )}
                >
                  <div
                    className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${cat.color}20` }}
                  >
                    <IconComponent className="h-4 w-4" style={{ color: cat.color }} />
                  </div>
                  <span>{cat.name}</span>
                </button>
              );
            })}
          </div>
        )}

        {errors.categoryId && (
          <p className="mt-1 text-xs text-destructive">{errors.categoryId.message}</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="isConfirmed"
          {...register('isConfirmed')}
          className="h-4 w-4 rounded border-input"
        />
        <label htmlFor="isConfirmed" className="text-sm">
          Mark as confirmed (planning to buy soon)
        </label>
      </div>

      <div className="flex gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={loading}
          className="flex-1"
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="destructive"
          onClick={handleDeleteClick}
          disabled={loading}
          className="gap-2"
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </Button>
        <Button type="submit" disabled={loading} className="flex-1">
          {loading ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </form>
  );
}
