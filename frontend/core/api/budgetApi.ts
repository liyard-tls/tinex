import { Budget, CreateBudgetInput, UpdateBudgetInput } from '@/core/models';
import { apiFetch } from './client';

class BudgetApiRepository {
  async create(userId: string, input: CreateBudgetInput, currency: string): Promise<string> {
    const budget = await apiFetch<Budget>('/api/v1/budgets', {
      method: 'POST',
      body: JSON.stringify({ ...input, currency }),
    });
    return budget.id;
  }

  async getById(id: string): Promise<Budget | null> {
    try {
      return await apiFetch<Budget>(`/api/v1/budgets/${id}`);
    } catch {
      return null;
    }
  }

  async getByUserId(_userId: string): Promise<Budget[]> {
    return apiFetch<Budget[]>('/api/v1/budgets');
  }

  async getByCategoryId(userId: string, categoryId: string): Promise<Budget[]> {
    return apiFetch<Budget[]>(`/api/v1/budgets/by-category/${categoryId}`);
  }

  async existsForCategoryAndPeriod(
    userId: string,
    categoryId: string,
    period: string,
    excludeId?: string
  ): Promise<boolean> {
    const budgets = await this.getByCategoryId(userId, categoryId);
    return budgets.some(
      (b) => b.period === period && b.isActive && b.id !== excludeId
    );
  }

  async update(input: UpdateBudgetInput): Promise<void> {
    const { id, ...data } = input;
    await apiFetch(`/api/v1/budgets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Soft delete (legacy alias)
  async delete(id: string): Promise<void> {
    await apiFetch(`/api/v1/budgets/${id}`, { method: 'DELETE' });
  }

  async deletePermanently(id: string): Promise<void> {
    await apiFetch(`/api/v1/budgets/${id}/hard`, { method: 'DELETE' });
  }

  async deleteAllForUser(_userId: string): Promise<void> {
    const budgets = await this.getByUserId(_userId);
    await Promise.all(budgets.map((b) => this.deletePermanently(b.id)));
  }
}

export const budgetRepository = new BudgetApiRepository();
