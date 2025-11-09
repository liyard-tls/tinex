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
import { Tag, CreateTagInput, UpdateTagInput } from '@/core/models';
import { FIREBASE_COLLECTIONS } from '@/shared/config/constants';

export class TagRepository {
  private collectionName = FIREBASE_COLLECTIONS.TAGS || 'tags';

  /**
   * Create a new tag
   */
  async create(userId: string, input: CreateTagInput): Promise<string> {
    const tag: any = {
      userId,
      name: input.name,
      color: input.color,
      createdAt: Timestamp.fromDate(new Date()),
      updatedAt: Timestamp.fromDate(new Date()),
    };

    const docRef = await addDoc(collection(db, this.collectionName), tag);
    return docRef.id;
  }

  /**
   * Get tag by ID
   */
  async getById(id: string): Promise<Tag | null> {
    const docRef = doc(db, this.collectionName, id);
    const q = query(collection(db, this.collectionName), where('__name__', '==', id));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) return null;

    const data = querySnapshot.docs[0].data();
    return this.mapToTag(id, data);
  }

  /**
   * Get all tags for a user
   */
  async getByUserId(userId: string): Promise<Tag[]> {
    const q = query(
      collection(db, this.collectionName),
      where('userId', '==', userId),
      orderBy('name', 'asc')
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => this.mapToTag(doc.id, doc.data()));
  }

  /**
   * Update a tag
   */
  async update(input: UpdateTagInput): Promise<void> {
    const { id, ...updateData } = input;
    const docRef = doc(db, this.collectionName, id);

    const updates: any = {
      ...updateData,
      updatedAt: Timestamp.fromDate(new Date()),
    };

    await updateDoc(docRef, updates);
  }

  /**
   * Delete a tag
   */
  async delete(id: string): Promise<void> {
    const docRef = doc(db, this.collectionName, id);
    await deleteDoc(docRef);
  }

  /**
   * Map Firestore data to Tag model
   */
  private mapToTag(id: string, data: any): Tag {
    return {
      id,
      userId: data.userId,
      name: data.name,
      color: data.color,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    };
  }
}

// Singleton instance
export const tagRepository = new TagRepository();
