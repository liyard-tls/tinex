import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  AnalyticsPreset,
  CreateAnalyticsPresetInput,
  UpdateAnalyticsPresetInput,
} from '@/core/models';
import { FIREBASE_COLLECTIONS } from '@/shared/config/constants';

export class AnalyticsPresetRepository {
  private collectionName = FIREBASE_COLLECTIONS.ANALYTICS_PRESETS;

  /**
   * Create a new analytics preset
   */
  async create(userId: string, input: CreateAnalyticsPresetInput): Promise<string> {
    const preset = {
      userId,
      name: input.name,
      categoryIds: input.categoryIds,
      createdAt: Timestamp.fromDate(new Date()),
      updatedAt: Timestamp.fromDate(new Date()),
    };

    const docRef = await addDoc(collection(db, this.collectionName), preset);
    return docRef.id;
  }

  /**
   * Get preset by ID
   */
  async getById(id: string): Promise<AnalyticsPreset | null> {
    const q = query(collection(db, this.collectionName), where('__name__', '==', id));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) return null;

    const data = querySnapshot.docs[0].data();
    return this.mapToPreset(id, data);
  }

  /**
   * Get all presets for a user
   */
  async getByUserId(userId: string): Promise<AnalyticsPreset[]> {
    const q = query(
      collection(db, this.collectionName),
      where('userId', '==', userId),
      orderBy('name', 'asc')
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => this.mapToPreset(doc.id, doc.data()));
  }

  /**
   * Update a preset
   */
  async update(input: UpdateAnalyticsPresetInput): Promise<void> {
    const { id, ...updateData } = input;
    const docRef = doc(db, this.collectionName, id);

    const updates: Record<string, unknown> = {
      ...updateData,
      updatedAt: Timestamp.fromDate(new Date()),
    };

    await updateDoc(docRef, updates);
  }

  /**
   * Delete a preset
   */
  async delete(id: string): Promise<void> {
    const docRef = doc(db, this.collectionName, id);
    await deleteDoc(docRef);
  }

  /**
   * Delete all presets for a user
   */
  async deleteAllForUser(userId: string): Promise<void> {
    const q = query(collection(db, this.collectionName), where('userId', '==', userId));
    const snapshot = await getDocs(q);

    const deletePromises = snapshot.docs.map((doc) => deleteDoc(doc.ref));
    await Promise.all(deletePromises);
  }

  /**
   * Map Firestore data to AnalyticsPreset model
   */
  private mapToPreset(id: string, data: Record<string, unknown>): AnalyticsPreset {
    return {
      id,
      userId: data.userId as string,
      name: data.name as string,
      categoryIds: (data.categoryIds as string[]) || [],
      createdAt: (data.createdAt as { toDate: () => Date })?.toDate() || new Date(),
      updatedAt: (data.updatedAt as { toDate: () => Date })?.toDate() || new Date(),
    };
  }
}

// Singleton instance
export const analyticsPresetRepository = new AnalyticsPresetRepository();
