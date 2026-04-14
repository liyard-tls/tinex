import { ChatMessage, CreateChatMessageInput } from '@/core/models';
import { apiFetch } from './client';

class ChatMessageApiRepository {
  async create(userId: string, input: CreateChatMessageInput): Promise<string> {
    const msg = await apiFetch<ChatMessage>('/api/v1/chat-messages', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return msg.id;
  }

  async getRecentByUserId(userId: string, messageLimit = 50): Promise<ChatMessage[]> {
    return apiFetch<ChatMessage[]>(`/api/v1/chat-messages?limit=${messageLimit}`);
  }

  async delete(id: string): Promise<void> {
    await apiFetch(`/api/v1/chat-messages/${id}`, { method: 'DELETE' });
  }

  async deleteAllForUser(_userId: string): Promise<void> {
    await apiFetch('/api/v1/chat-messages', { method: 'DELETE' });
  }
}

export const chatMessageRepository = new ChatMessageApiRepository();
