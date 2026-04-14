import { Tag, CreateTagInput, UpdateTagInput } from '@/core/models';
import { apiFetch } from './client';

class TagApiRepository {
  async create(userId: string, input: CreateTagInput): Promise<string> {
    const tag = await apiFetch<Tag>('/api/v1/tags', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return tag.id;
  }

  async getById(id: string): Promise<Tag | null> {
    try {
      return await apiFetch<Tag>(`/api/v1/tags/${id}`);
    } catch {
      return null;
    }
  }

  async getByUserId(_userId: string): Promise<Tag[]> {
    return apiFetch<Tag[]>('/api/v1/tags');
  }

  async update(input: UpdateTagInput): Promise<void> {
    const { id, ...data } = input;
    await apiFetch(`/api/v1/tags/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async delete(id: string): Promise<void> {
    await apiFetch(`/api/v1/tags/${id}`, { method: 'DELETE' });
  }

  async deleteAllForUser(_userId: string): Promise<void> {
    const tags = await this.getByUserId(_userId);
    await Promise.all(tags.map((t) => this.delete(t.id)));
  }
}

export const tagRepository = new TagApiRepository();
