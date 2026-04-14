import {
  Transaction,
  CreateTransactionInput,
  UpdateTransactionInput,
} from '@/core/models';
import { apiFetch } from './client';

interface TransactionStats {
  income: number;
  expenses: number;
  balance: number;
  transactionCount: number;
}

class TransactionApiRepository {
  // NOTE: currency arg matches legacy signature; it's sent as part of input to the API.
  async create(
    userId: string,
    input: CreateTransactionInput,
    currency: string
  ): Promise<string> {
    const tx = await apiFetch<Transaction>('/api/v1/transactions', {
      method: 'POST',
      body: JSON.stringify({ ...input, currency, tagIds: input.tags ?? [] }),
    });
    return tx.id;
  }

  async getById(id: string): Promise<Transaction | null> {
    try {
      return await apiFetch<Transaction>(`/api/v1/transactions/${id}`);
    } catch {
      return null;
    }
  }

  async getByUserId(
    _userId: string,
    options?: { limitCount?: number; orderByField?: string; orderDirection?: 'asc' | 'desc' }
  ): Promise<Transaction[]> {
    const params = new URLSearchParams();
    if (options?.limitCount) params.set('limit', String(options.limitCount));
    if (options?.orderByField) params.set('orderBy', options.orderByField);
    if (options?.orderDirection) params.set('orderDir', options.orderDirection);
    const qs = params.toString();
    return apiFetch<Transaction[]>(`/api/v1/transactions${qs ? `?${qs}` : ''}`);
  }

  async getByAccountId(accountId: string, _userId: string): Promise<Transaction[]> {
    return apiFetch<Transaction[]>(`/api/v1/transactions/by-account/${accountId}`);
  }

  async getByCategoryId(userId: string, categoryId: string): Promise<Transaction[]> {
    return apiFetch<Transaction[]>(`/api/v1/transactions/by-category/${categoryId}`);
  }

  async getByDateRange(userId: string, startDate: Date, endDate: Date): Promise<Transaction[]> {
    const params = new URLSearchParams({
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    });
    return apiFetch<Transaction[]>(`/api/v1/transactions/range?${params}`);
  }

  async update(input: UpdateTransactionInput): Promise<void> {
    const { id, ...data } = input;
    await apiFetch(`/api/v1/transactions/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ ...data, tagIds: (data as any).tags }),
    });
  }

  async delete(id: string): Promise<void> {
    await apiFetch(`/api/v1/transactions/${id}`, { method: 'DELETE' });
  }

  async deleteAllForUser(_userId: string): Promise<void> {
    const txs = await this.getByUserId(_userId);
    await Promise.all(txs.map((t) => this.delete(t.id)));
  }

  async getStats(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<TransactionStats> {
    const params = new URLSearchParams({
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    });
    return apiFetch<TransactionStats>(`/api/v1/transactions/stats?${params}`);
  }
}

export const transactionRepository = new TransactionApiRepository();
