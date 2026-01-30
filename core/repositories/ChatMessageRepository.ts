import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ChatMessage, CreateChatMessageInput } from '@/core/models';
import { FIREBASE_COLLECTIONS } from '@/shared/config/constants';

export class ChatMessageRepository {
  private collectionName = FIREBASE_COLLECTIONS.CHAT_MESSAGES;

  /**
   * Create a new chat message
   */
  async create(userId: string, input: CreateChatMessageInput): Promise<string> {
    const message = {
      userId,
      role: input.role,
      content: input.content,
      createdAt: Timestamp.fromDate(new Date()),
    };

    const docRef = await addDoc(collection(db, this.collectionName), message);
    return docRef.id;
  }

  /**
   * Get recent messages for a user (for chat history)
   * Note: We fetch all messages and sort/limit on client to avoid composite index requirement
   */
  async getRecentByUserId(userId: string, messageLimit = 50): Promise<ChatMessage[]> {
    const q = query(
      collection(db, this.collectionName),
      where('userId', '==', userId)
    );

    const querySnapshot = await getDocs(q);
    const messages = querySnapshot.docs
      .map((d) => this.mapToMessage(d.id, d.data()))
      .sort((a, b) => {
        const dateA = a.createdAt instanceof Date ? a.createdAt : new Date();
        const dateB = b.createdAt instanceof Date ? b.createdAt : new Date();
        return dateA.getTime() - dateB.getTime();
      });

    // Return only the last N messages
    return messages.slice(-messageLimit);
  }

  /**
   * Delete a message
   */
  async delete(id: string): Promise<void> {
    const docRef = doc(db, this.collectionName, id);
    await deleteDoc(docRef);
  }

  /**
   * Delete all messages for a user (clear chat history)
   */
  async deleteAllForUser(userId: string): Promise<void> {
    const q = query(collection(db, this.collectionName), where('userId', '==', userId));
    const snapshot = await getDocs(q);

    const deletePromises = snapshot.docs.map((d) => deleteDoc(d.ref));
    await Promise.all(deletePromises);
  }

  /**
   * Map Firestore data to ChatMessage model
   */
  private mapToMessage(id: string, data: Record<string, unknown>): ChatMessage {
    return {
      id,
      userId: data.userId as string,
      role: data.role as 'user' | 'assistant',
      content: data.content as string,
      createdAt: (data.createdAt as { toDate: () => Date })?.toDate() || new Date(),
    };
  }
}

// Singleton instance
export const chatMessageRepository = new ChatMessageRepository();
