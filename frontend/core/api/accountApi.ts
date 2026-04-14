import { Account, CreateAccountInput, UpdateAccountInput } from '@/core/models';
import { apiFetch } from './client';

class AccountApiRepository {
  async create(userId: string, input: CreateAccountInput): Promise<string> {
    const account = await apiFetch<Account>('/api/v1/accounts', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return account.id;
  }

  async getById(id: string): Promise<Account | null> {
    try {
      return await apiFetch<Account>(`/api/v1/accounts/${id}`);
    } catch {
      return null;
    }
  }

  async getByUserId(_userId: string): Promise<Account[]> {
    return apiFetch<Account[]>('/api/v1/accounts');
  }

  async getDefaultAccount(_userId: string): Promise<Account | null> {
    try {
      return await apiFetch<Account>('/api/v1/accounts/default');
    } catch {
      return null;
    }
  }

  async update(input: UpdateAccountInput): Promise<void> {
    const { id, ...data } = input;
    await apiFetch(`/api/v1/accounts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async updateBalance(id: string, newBalance: number): Promise<void> {
    await apiFetch(`/api/v1/accounts/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ balance: newBalance }),
    });
  }

  async setDefault(userId: string, accountId: string): Promise<void> {
    await apiFetch(`/api/v1/accounts/${accountId}/default`, { method: 'PUT' });
  }

  async delete(id: string): Promise<void> {
    await apiFetch(`/api/v1/accounts/${id}`, { method: 'DELETE' });
  }

  async deleteAllForUser(_userId: string): Promise<void> {
    const accounts = await this.getByUserId(_userId);
    await Promise.all(accounts.map((a) => this.delete(a.id)));
  }

  async getTotalBalance(_userId: string): Promise<number> {
    const res = await apiFetch<{ total: number }>('/api/v1/accounts/balance');
    return res.total;
  }
}

export const accountRepository = new AccountApiRepository();
