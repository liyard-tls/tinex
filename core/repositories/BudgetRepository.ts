import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Budget, CreateBudgetInput, UpdateBudgetInput, BudgetProgress } from '@/core/models';
import { FIREBASE_COLLECTIONS } from '@/shared/config/constants';

export class BudgetRepository {
  private collectionName = FIREBASE_COLLECTIONS.BUDGETS;

  /**
   * Create a new budget
   */
  async create(userId: string, input: CreateBudgetInput, currency: string): Promise<string> {
    const budget: any = {
      userId,
      categoryId: input.categoryId,
      period: input.period,
      amount: input.amount,
      currency,
      startDate: Timestamp.fromDate(input.startDate || new Date()),
      alertThreshold: input.alertThreshold || 80,
      isActive: true,
      createdAt: Timestamp.fromDate(new Date()),
      updatedAt: Timestamp.fromDate(new Date()),
    };

    if (input.endDate) {
      budget.endDate = Timestamp.fromDate(input.endDate);
    }

    const docRef = await addDoc(collection(db, this.collectionName), budget);
    return docRef.id;
  }

  /**
   * Get budget by ID
   */
  async getById(id: string): Promise<Budget | null> {
    const q = query(collection(db, this.collectionName), where('__name__', '==', id));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) return null;

    const data = querySnapshot.docs[0].data();
    return this.mapToBudget(id, data);
  }

  /**
   * Get all budgets for a user
   */
  async getByUserId(userId: string): Promise<Budget[]> {
    const q = query(
      collection(db, this.collectionName),
      where('userId', '==', userId),
      where('isActive', '==', true)
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => this.mapToBudget(doc.id, doc.data()));
  }

  /**
   * Get budgets for a specific category
   */
  async getByCategoryId(userId: string, categoryId: string): Promise<Budget[]> {
    const q = query(
      collection(db, this.collectionName),
      where('userId', '==', userId),
      where('categoryId', '==', categoryId),
      where('isActive', '==', true)
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => this.mapToBudget(doc.id, doc.data()));
  }

  /**
   * Check if budget with same category and period exists
   */
  async existsForCategoryAndPeriod(
    userId: string,
    categoryId: string,
    period: string,
    excludeId?: string
  ): Promise<boolean> {
    const q = query(
      collection(db, this.collectionName),
      where('userId', '==', userId),
      where('categoryId', '==', categoryId),
      where('period', '==', period),
      where('isActive', '==', true)
    );
    const querySnapshot = await getDocs(q);

    if (excludeId) {
      return querySnapshot.docs.some((doc) => doc.id !== excludeId);
    }

    return !querySnapshot.empty;
  }

  /**
   * Update a budget
   */
  async update(input: UpdateBudgetInput): Promise<void> {
    const budgetRef = doc(db, this.collectionName, input.id);
    const updateData: any = {
      updatedAt: Timestamp.fromDate(new Date()),
    };

    if (input.amount !== undefined) updateData.amount = input.amount;
    if (input.period !== undefined) updateData.period = input.period;
    if (input.categoryId !== undefined) updateData.categoryId = input.categoryId;
    if (input.startDate !== undefined) updateData.startDate = Timestamp.fromDate(input.startDate);
    if (input.endDate !== undefined) updateData.endDate = Timestamp.fromDate(input.endDate);
    if (input.alertThreshold !== undefined) updateData.alertThreshold = input.alertThreshold;
    if (input.isActive !== undefined) updateData.isActive = input.isActive;

    await updateDoc(budgetRef, updateData);
  }

  /**
   * Delete a budget (soft delete by setting isActive to false)
   */
  async delete(id: string): Promise<void> {
    const budgetRef = doc(db, this.collectionName, id);
    await updateDoc(budgetRef, {
      isActive: false,
      updatedAt: Timestamp.fromDate(new Date()),
    });
  }

  /**
   * Permanently delete a budget
   */
  async deletePermanently(id: string): Promise<void> {
    await deleteDoc(doc(db, this.collectionName, id));
  }

  /**
   * Delete all budgets for a user
   */
  async deleteAllForUser(userId: string): Promise<void> {
    const q = query(collection(db, this.collectionName), where('userId', '==', userId));
    const querySnapshot = await getDocs(q);

    const deletePromises = querySnapshot.docs.map((doc) => deleteDoc(doc.ref));
    await Promise.all(deletePromises);
  }

  /**
   * Map Firestore data to Budget model
   */
  private mapToBudget(id: string, data: any): Budget {
    return {
      id,
      userId: data.userId,
      categoryId: data.categoryId,
      amount: data.amount,
      period: data.period,
      startDate: data.startDate?.toDate() || new Date(),
      endDate: data.endDate?.toDate(),
      alertThreshold: data.alertThreshold || 80,
      isActive: data.isActive !== undefined ? data.isActive : true,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    };
  }
}

// Singleton instance
export const budgetRepository = new BudgetRepository();
