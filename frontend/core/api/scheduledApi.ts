import {
  ScheduledTransaction,
  CreateScheduledTransactionInput,
  UpdateScheduledTransactionInput,
} from '@/core/models';
import { apiFetch } from './client';

class ScheduledTransactionApiRepository {
  async create(
    userId: string,
    input: CreateScheduledTransactionInput,
    currency: string
  ): Promise<string> {
    const s = await apiFetch<ScheduledTransaction>('/api/v1/scheduled', {
      method: 'POST',
      body: JSON.stringify({ ...input, currency, tagIds: input.tags ?? [] }),
    });
    return s.id;
  }

  async getByUserId(_userId: string): Promise<ScheduledTransaction[]> {
    return apiFetch<ScheduledTransaction[]>('/api/v1/scheduled');
  }

  async getUpcoming(userId: string, days: number): Promise<ScheduledTransaction[]> {
    return apiFetch<ScheduledTransaction[]>(`/api/v1/scheduled/upcoming?days=${days}`);
  }

  async update(input: UpdateScheduledTransactionInput): Promise<void> {
    const { id, ...data } = input;
    await apiFetch(`/api/v1/scheduled/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ ...data, tagIds: (data as any).tags }),
    });
  }

  async delete(id: string): Promise<void> {
    await apiFetch(`/api/v1/scheduled/${id}`, { method: 'DELETE' });
  }

  async deleteAllForUser(_userId: string): Promise<void> {
    const list = await this.getByUserId(_userId);
    await Promise.all(list.map((s) => this.delete(s.id)));
  }
}

export const scheduledTransactionRepository = new ScheduledTransactionApiRepository();
