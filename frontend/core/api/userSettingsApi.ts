import { UserSettings, CreateUserSettingsInput, UpdateUserSettingsInput } from '@/core/models';
import { apiFetch } from './client';

class UserSettingsApiRepository {
  async get(userId: string): Promise<UserSettings | null> {
    try {
      return await apiFetch<UserSettings>('/api/v1/settings');
    } catch {
      return null;
    }
  }

  async getOrCreate(userId: string): Promise<UserSettings> {
    return apiFetch<UserSettings>('/api/v1/settings');
  }

  async create(userId: string, input: CreateUserSettingsInput): Promise<UserSettings> {
    // Settings are auto-created via GET; update with provided values
    await apiFetch('/api/v1/settings', {
      method: 'PUT',
      body: JSON.stringify(input),
    });
    return apiFetch<UserSettings>('/api/v1/settings');
  }

  async update(userId: string, input: UpdateUserSettingsInput): Promise<void> {
    await apiFetch('/api/v1/settings', {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  }

  async delete(userId: string): Promise<void> {
    await apiFetch('/api/v1/settings', { method: 'DELETE' });
  }
}

export const userSettingsRepository = new UserSettingsApiRepository();
