import {
  AnalyticsPreset,
  CreateAnalyticsPresetInput,
  UpdateAnalyticsPresetInput,
} from '@/core/models';
import { apiFetch } from './client';

class AnalyticsPresetApiRepository {
  async create(userId: string, input: CreateAnalyticsPresetInput): Promise<string> {
    const preset = await apiFetch<AnalyticsPreset>('/api/v1/analytics-presets', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return preset.id;
  }

  async getById(id: string): Promise<AnalyticsPreset | null> {
    try {
      return await apiFetch<AnalyticsPreset>(`/api/v1/analytics-presets/${id}`);
    } catch {
      return null;
    }
  }

  async getByUserId(_userId: string): Promise<AnalyticsPreset[]> {
    return apiFetch<AnalyticsPreset[]>('/api/v1/analytics-presets');
  }

  async update(input: UpdateAnalyticsPresetInput): Promise<void> {
    const { id, ...data } = input;
    await apiFetch(`/api/v1/analytics-presets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async delete(id: string): Promise<void> {
    await apiFetch(`/api/v1/analytics-presets/${id}`, { method: 'DELETE' });
  }

  async deleteAllForUser(_userId: string): Promise<void> {
    const presets = await this.getByUserId(_userId);
    await Promise.all(presets.map((p) => this.delete(p.id)));
  }
}

export const analyticsPresetRepository = new AnalyticsPresetApiRepository();
