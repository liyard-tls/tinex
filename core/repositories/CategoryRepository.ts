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
import { Category, CreateCategoryInput, UpdateCategoryInput, DEFAULT_CATEGORIES, SYSTEM_CATEGORIES } from '@/core/models';
import { FIREBASE_COLLECTIONS } from '@/shared/config/constants';

export class CategoryRepository {
  private collectionName = FIREBASE_COLLECTIONS.CATEGORIES;

  /**
   * Create a new category
   */
  async create(userId: string, input: CreateCategoryInput): Promise<string> {
    const category: any = {
      userId,
      name: input.name,
      type: input.type,
      icon: input.icon,
      color: input.color,
      isDefault: false,
      createdAt: Timestamp.fromDate(new Date()),
      updatedAt: Timestamp.fromDate(new Date()),
    };

    if (input.parentId) category.parentId = input.parentId;

    const docRef = await addDoc(collection(db, this.collectionName), category);
    return docRef.id;
  }

  /**
   * Get category by ID
   */
  async getById(id: string): Promise<Category | null> {
    const q = query(collection(db, this.collectionName), where('__name__', '==', id));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) return null;

    const data = querySnapshot.docs[0].data();
    return this.mapToCategory(id, data);
  }

  /**
   * Get all categories for a user
   */
  async getByUserId(userId: string): Promise<Category[]> {
    const q = query(
      collection(db, this.collectionName),
      where('userId', '==', userId),
      orderBy('name', 'asc')
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => this.mapToCategory(doc.id, doc.data()));
  }

  /**
   * Get categories by type
   */
  async getByType(userId: string, type: 'income' | 'expense'): Promise<Category[]> {
    const q = query(
      collection(db, this.collectionName),
      where('userId', '==', userId),
      where('type', '==', type),
      orderBy('name', 'asc')
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => this.mapToCategory(doc.id, doc.data()));
  }

  /**
   * Update a category
   */
  async update(input: UpdateCategoryInput): Promise<void> {
    const { id, ...updateData } = input;

    // Check if this is a system category
    const category = await this.getById(id);
    if (category && this.isSystemCategory(category.name)) {
      throw new Error('Cannot update system category');
    }

    const docRef = doc(db, this.collectionName, id);

    const updates: any = {
      ...updateData,
      updatedAt: Timestamp.fromDate(new Date()),
    };

    await updateDoc(docRef, updates);
  }

  /**
   * Delete a category
   */
  async delete(id: string): Promise<void> {
    // Check if this is a system category
    const category = await this.getById(id);
    if (category && this.isSystemCategory(category.name)) {
      throw new Error('Cannot delete system category');
    }

    const docRef = doc(db, this.collectionName, id);
    await deleteDoc(docRef);
  }

  /**
   * Check if a category is a system category
   */
  private isSystemCategory(categoryName: string): boolean {
    return Object.values(SYSTEM_CATEGORIES).includes(categoryName as any);
  }

  /**
   * Delete all categories for a user
   */
  async deleteAllForUser(userId: string): Promise<void> {
    const q = query(collection(db, this.collectionName), where('userId', '==', userId));
    const snapshot = await getDocs(q);

    const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);
  }

  /**
   * Create default categories for a new user
   */
  async createDefaultCategories(userId: string): Promise<void> {
    const createPromises = DEFAULT_CATEGORIES.map(category =>
      this.create(userId, {
        name: category.name,
        type: category.type,
        icon: category.icon,
        color: category.color,
      })
    );
    await Promise.all(createPromises);
  }

  /**
   * Map Firestore data to Category model
   */
  private mapToCategory(id: string, data: any): Category {
    return {
      id,
      userId: data.userId,
      name: data.name,
      type: data.type,
      icon: data.icon,
      color: data.color,
      parentId: data.parentId,
      isDefault: data.isDefault || false,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    };
  }
}

// Singleton instance
export const categoryRepository = new CategoryRepository();
