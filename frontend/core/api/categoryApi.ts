import { Category, CreateCategoryInput, UpdateCategoryInput } from '@/core/models';
import { apiFetch } from './client';

class CategoryApiRepository {
  async create(userId: string, input: CreateCategoryInput): Promise<string> {
    const cat = await apiFetch<Category>('/api/v1/categories', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return cat.id;
  }

  async getById(id: string): Promise<Category | null> {
    try {
      return await apiFetch<Category>(`/api/v1/categories/${id}`);
    } catch {
      return null;
    }
  }

  async getByUserId(_userId: string): Promise<Category[]> {
    return apiFetch<Category[]>('/api/v1/categories');
  }

  async getByType(userId: string, type: 'income' | 'expense'): Promise<Category[]> {
    return apiFetch<Category[]>(`/api/v1/categories/type/${type}`);
  }

  async update(input: UpdateCategoryInput): Promise<void> {
    const { id, ...data } = input;
    await apiFetch(`/api/v1/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async delete(id: string): Promise<void> {
    await apiFetch(`/api/v1/categories/${id}`, { method: 'DELETE' });
  }

  async deleteAllForUser(_userId: string): Promise<void> {
    const cats = await this.getByUserId(_userId);
    await Promise.all(cats.filter((c) => !c.isDefault).map((c) => this.delete(c.id)));
  }

  async createDefaultCategories(userId: string): Promise<void> {
    await apiFetch('/api/v1/categories/defaults', { method: 'POST' });
  }
}

export const categoryRepository = new CategoryApiRepository();
