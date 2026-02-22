'use client';

import { useState } from 'react';
import BottomNav from '@/shared/components/layout/BottomNav';
import PageHeader from '@/shared/components/layout/PageHeader';
import { Card, CardContent } from '@/shared/components/ui/Card';
import { Button } from '@/shared/components/ui';
import Modal from '@/shared/components/ui/Modal';
import FAB from '@/shared/components/ui/FAB';
import { Plus, Trash2, Edit, MoreHorizontal, Loader2 } from 'lucide-react';
import { categoryRepository } from '@/core/repositories/CategoryRepository';
import { Category, CreateCategoryInput, CategoryType, SYSTEM_CATEGORIES } from '@/core/models';
import { CATEGORY_ICONS, ICON_OPTIONS } from '@/shared/config/icons';
import { useAuth } from '@/app/_providers/AuthProvider';
import { useAppData } from '@/app/_providers/AppDataProvider';

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

export default function CategoriesPage() {
  const { user, authLoading } = useAuth();
  const { categories, dataLoading, refreshCategories } = useAppData();
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const handleAddCategory = async (data: CreateCategoryInput) => {
    if (!user) return;

    try {
      await categoryRepository.create(user.uid, data);
      await refreshCategories();
      setShowAddCategory(false);
    } catch (error) {
      console.error('Failed to add category:', error);
      throw error;
    }
  };

  const handleUpdateCategory = async (data: CreateCategoryInput) => {
    if (!user || !editingCategory) return;

    try {
      await categoryRepository.update({ id: editingCategory.id, ...data });
      await refreshCategories();
      setEditingCategory(null);
    } catch (error) {
      console.error('Failed to update category:', error);
      throw error;
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    if (!user) return;
    if (!confirm('Are you sure you want to delete this category?')) return;

    try {
      await categoryRepository.delete(categoryId);
      await refreshCategories();
    } catch (error) {
      console.error('Failed to delete category:', error);
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

  // Helper to check if category is system category
  const isSystemCategory = (categoryName: string) => {
    const systemCategoryNames = Object.values(SYSTEM_CATEGORIES) as string[];
    return systemCategoryNames.includes(categoryName);
  };

  // Sort categories: system categories first, then alphabetically
  const sortCategories = (cats: Category[]) => {
    return [...cats].sort((a, b) => {
      const aIsSystem = isSystemCategory(a.name);
      const bIsSystem = isSystemCategory(b.name);

      if (aIsSystem && !bIsSystem) return -1;
      if (!aIsSystem && bIsSystem) return 1;
      return a.name.localeCompare(b.name);
    });
  };

  const incomeCategories = sortCategories(categories.filter((c) => c.type === 'income'));
  const expenseCategories = sortCategories(categories.filter((c) => c.type === 'expense'));

  return (
    <div className="min-h-screen bg-background pb-20">
      <PageHeader title="Categories" description="Organize your transactions" />

      <main className="px-4 py-4 space-y-6">
        {/* Income Categories */}
        <div>
          <h2 className="text-lg font-semibold mb-3 text-success">Income</h2>
          <div className="grid gap-2">
            {incomeCategories.map((category) => (
              <CategoryCard
                key={category.id}
                category={category}
                onEdit={() => setEditingCategory(category)}
                onDelete={() => handleDeleteCategory(category.id)}
              />
            ))}
          </div>
        </div>

        {/* Expense Categories */}
        <div>
          <h2 className="text-lg font-semibold mb-3 text-destructive">Expenses</h2>
          <div className="grid gap-2">
            {expenseCategories.map((category) => (
              <CategoryCard
                key={category.id}
                category={category}
                onEdit={() => setEditingCategory(category)}
                onDelete={() => handleDeleteCategory(category.id)}
              />
            ))}
          </div>
        </div>
      </main>

      <FAB className="bottom-24 right-4" onClick={() => setShowAddCategory(true)}>
        <Plus className="h-6 w-6" />
      </FAB>

      <Modal
        isOpen={showAddCategory}
        onClose={() => setShowAddCategory(false)}
        title="Create Category"
      >
        <CategoryForm
          onSubmit={handleAddCategory}
          onCancel={() => setShowAddCategory(false)}
        />
      </Modal>

      <Modal
        isOpen={!!editingCategory}
        onClose={() => setEditingCategory(null)}
        title="Edit Category"
      >
        {editingCategory && (
          <CategoryForm
            initialData={editingCategory}
            onSubmit={handleUpdateCategory}
            onCancel={() => setEditingCategory(null)}
          />
        )}
      </Modal>

      <BottomNav />
    </div>
  );
}

function CategoryCard({
  category,
  onEdit,
  onDelete,
}: {
  category: Category;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const IconComponent = CATEGORY_ICONS[category.icon as keyof typeof CATEGORY_ICONS] || MoreHorizontal;

  // Check if this is a system category
  const systemCategoryNames = Object.values(SYSTEM_CATEGORIES) as string[];
  const isSystem = systemCategoryNames.includes(category.name);

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${category.color}20` }}
            >
              <IconComponent className="h-5 w-5" style={{ color: category.color }} />
            </div>
            <div>
              <p className="text-sm font-medium">{category.name}</p>
              <p className="text-xs text-muted-foreground capitalize">{category.type}</p>
            </div>
          </div>

          {!isSystem && (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={onEdit}
              >
                <Edit className="h-4 w-4" />
              </Button>
              {!category.isDefault && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                  onClick={onDelete}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function CategoryForm({
  initialData,
  onSubmit,
  onCancel,
}: {
  initialData?: Category;
  onSubmit: (data: CreateCategoryInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initialData?.name || '');
  const [type, setType] = useState<CategoryType>(initialData?.type || 'expense');
  const [icon, setIcon] = useState(initialData?.icon || 'MoreHorizontal');
  const [color, setColor] = useState(initialData?.color || CATEGORY_COLORS[0]);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      await onSubmit({ name: name.trim(), type, icon, color });
      setName('');
      setIcon('MoreHorizontal');
      setColor(CATEGORY_COLORS[0]);
    } catch (error) {
      console.error('Failed to save category:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">Category Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="Enter category name"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Type</label>
        <div className="flex gap-2">
          <Button
            type="button"
            variant={type === 'income' ? 'default' : 'outline'}
            className="flex-1"
            onClick={() => setType('income')}
          >
            Income
          </Button>
          <Button
            type="button"
            variant={type === 'expense' ? 'default' : 'outline'}
            className="flex-1"
            onClick={() => setType('expense')}
          >
            Expense
          </Button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Icon</label>
        <div className="grid grid-cols-8 gap-2 max-h-32 overflow-y-auto p-2 border border-border rounded-md">
          {ICON_OPTIONS.map((iconName) => {
            const IconComp = CATEGORY_ICONS[iconName as keyof typeof CATEGORY_ICONS];
            return (
              <button
                key={iconName}
                type="button"
                onClick={() => setIcon(iconName)}
                className={`p-2 rounded-md hover:bg-muted transition-colors ${
                  icon === iconName ? 'bg-primary text-primary-foreground' : ''
                }`}
              >
                <IconComp className="h-5 w-5 mx-auto" />
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Color</label>
        <div className="grid grid-cols-7 gap-2">
          {CATEGORY_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={`w-10 h-10 rounded-md transition-all ${
                color === c ? 'ring-2 ring-offset-2 ring-primary scale-110' : ''
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      <div className="flex gap-2 pt-4">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" className="flex-1" disabled={loading || !name.trim()}>
          {loading ? 'Saving...' : initialData ? 'Update' : 'Create'}
        </Button>
      </div>
    </form>
  );
}
