'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import BottomNav from '@/shared/components/layout/BottomNav';
import PageHeader from '@/shared/components/layout/PageHeader';
import Modal from '@/shared/components/ui/Modal';
import { Plus, Clock, FolderOpen } from 'lucide-react';
import { Budget, BudgetProgress, Category, Currency } from '@/core/models';
import { budgetRepository } from '@/core/repositories/BudgetRepository';
import { categoryRepository } from '@/core/repositories/CategoryRepository';
import BudgetList from '@/modules/budgets/BudgetList';
import BudgetForm from '@/modules/budgets/BudgetForm';
import { calculateBudgetsProgress } from '@/modules/budgets/budgetProgressService';

type GroupMode = 'period' | 'category';

export default function BudgetsPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ uid: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [budgetProgress, setBudgetProgress] = useState<BudgetProgress[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [userCurrency] = useState<Currency>('USD');
  const [groupMode, setGroupMode] = useState<GroupMode>('period');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);

  // Authentication
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loadData = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Load budgets and categories in parallel
      const [budgetsData, categoriesData] = await Promise.all([
        budgetRepository.getByUserId(user.uid),
        categoryRepository.getByUserId(user.uid),
      ]);

      setBudgets(budgetsData);
      setCategories(categoriesData);

      // Calculate progress for all budgets
      const progress = await calculateBudgetsProgress(
        budgetsData,
        user.uid,
        userCurrency
      );

      setBudgetProgress(progress);
    } catch (error) {
      console.error('Failed to load budgets:', error);
    } finally {
      setLoading(false);
    }
  }, [user, userCurrency]);

  // Load data
  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, loadData]);

  const handleAddBudget = () => {
    setEditingBudget(null);
    setShowAddModal(true);
  };

  const handleEditBudget = (budgetId: string) => {
    const budget = budgets.find((b) => b.id === budgetId);
    if (budget) {
      setEditingBudget(budget);
      setShowAddModal(true);
    }
  };

  const handleDeleteBudget = async (budgetId: string) => {
    if (!confirm('Are you sure you want to delete this budget?')) {
      return;
    }

    try {
      await budgetRepository.delete(budgetId);
      await loadData();
    } catch (error) {
      console.error('Failed to delete budget:', error);
    }
  };

  const handleFormSuccess = async () => {
    setShowAddModal(false);
    setEditingBudget(null);
    await loadData();
  };

  const handleFormCancel = () => {
    setShowAddModal(false);
    setEditingBudget(null);
  };

  const handleBudgetClick = (categoryId: string, startDate: Date, endDate: Date) => {
    // Navigate to category page with budget period dates
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];
    router.push(
      `/transactions/category/${categoryId}?startDate=${startDateStr}&endDate=${endDateStr}&returnTo=/budgets`
    );
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Please sign in to view budgets</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <PageHeader
        title="Budgets"
        rightElement={
          <div className="flex items-center gap-1">
            <button
              onClick={() => setGroupMode('period')}
              className={`p-2 rounded-xl transition-colors ${
                groupMode === 'period'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-white/[0.06]'
              }`}
              aria-label="Group by period"
              title="Group by time period"
            >
              <Clock className="h-4 w-4" />
            </button>
            <button
              onClick={() => setGroupMode('category')}
              className={`p-2 rounded-xl transition-colors ${
                groupMode === 'category'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-white/[0.06]'
              }`}
              aria-label="Group by category"
              title="Group by category"
            >
              <FolderOpen className="h-4 w-4" />
            </button>
          </div>
        }
      />

      <main className="px-4 py-4">
        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading budgets...</p>
          </div>
        ) : (
          <BudgetList
            budgets={budgetProgress}
            categories={categories}
            currency={userCurrency}
            groupBy={groupMode}
            onEdit={handleEditBudget}
            onDelete={handleDeleteBudget}
            onClick={handleBudgetClick}
          />
        )}
      </main>

      {/* Add Budget FAB */}
      <button
        onClick={handleAddBudget}
        className="fixed bottom-20 right-4 w-14 h-14 bg-primary text-primary-foreground rounded-full shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors z-30"
        aria-label="Add budget"
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* Add/Edit Budget Modal */}
      <Modal isOpen={showAddModal} onClose={handleFormCancel}>
        <BudgetForm
          userId={user.uid}
          currency={userCurrency}
          categories={categories}
          budget={editingBudget || undefined}
          onSuccess={handleFormSuccess}
          onCancel={handleFormCancel}
        />
      </Modal>

      <BottomNav />
    </div>
  );
}
