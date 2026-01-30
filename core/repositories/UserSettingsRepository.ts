import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { FIREBASE_COLLECTIONS } from '@/shared/config/constants';
import {
  UserSettings,
  CreateUserSettingsInput,
  UpdateUserSettingsInput,
} from '../models/user-settings';

class UserSettingsRepository {
  private collectionName = FIREBASE_COLLECTIONS.USER_SETTINGS;

  /**
   * Get user settings by user ID
   * Returns null if settings don't exist yet
   */
  async get(userId: string): Promise<UserSettings | null> {
    try {
      const docRef = doc(db, this.collectionName, userId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return null;
      }

      const data = docSnap.data();
      return {
        id: docSnap.id,
        userId: data.userId,
        baseCurrency: data.baseCurrency,
        activeAnalyticsPresetId: data.activeAnalyticsPresetId,
        createdAt: data.createdAt as Timestamp,
        updatedAt: data.updatedAt as Timestamp,
      };
    } catch (error) {
      console.error('Error getting user settings:', error);
      throw error;
    }
  }

  /**
   * Get user settings or create default if doesn't exist
   */
  async getOrCreate(userId: string): Promise<UserSettings> {
    const settings = await this.get(userId);

    if (settings) {
      return settings;
    }

    // Create default settings
    return await this.create(userId, { baseCurrency: 'USD' });
  }

  /**
   * Create user settings
   */
  async create(
    userId: string,
    input: CreateUserSettingsInput
  ): Promise<UserSettings> {
    try {
      const docRef = doc(db, this.collectionName, userId);

      const now = serverTimestamp();
      const data = {
        userId,
        baseCurrency: input.baseCurrency,
        createdAt: now,
        updatedAt: now,
      };

      await setDoc(docRef, data);

      // Return created settings with current timestamp
      return {
        id: userId,
        userId,
        baseCurrency: input.baseCurrency,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };
    } catch (error) {
      console.error('Error creating user settings:', error);
      throw error;
    }
  }

  /**
   * Update user settings
   */
  async update(
    userId: string,
    input: UpdateUserSettingsInput
  ): Promise<void> {
    try {
      const docRef = doc(db, this.collectionName, userId);

      const data: Record<string, unknown> = {
        updatedAt: serverTimestamp(),
      };

      if (input.baseCurrency !== undefined) {
        data.baseCurrency = input.baseCurrency;
      }

      if (input.activeAnalyticsPresetId !== undefined) {
        data.activeAnalyticsPresetId = input.activeAnalyticsPresetId;
      }

      await updateDoc(docRef, data);
    } catch (error) {
      console.error('Error updating user settings:', error);
      throw error;
    }
  }

  /**
   * Delete user settings
   */
  async delete(userId: string): Promise<void> {
    try {
      const docRef = doc(db, this.collectionName, userId);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting user settings:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const userSettingsRepository = new UserSettingsRepository();
