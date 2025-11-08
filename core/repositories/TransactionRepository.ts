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
  limit,
  Timestamp,
  QueryConstraint,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Transaction, CreateTransactionInput, UpdateTransactionInput } from '@/core/models';
import { FIREBASE_COLLECTIONS } from '@/shared/config/constants';

export class TransactionRepository {
  private collectionName = FIREBASE_COLLECTIONS.TRANSACTIONS;

  /**
   * Create a new transaction
   */
  async create(userId: string, input: CreateTransactionInput, currency: string): Promise<string> {
    const transaction: any = {
      userId,
      accountId: input.accountId,
      amount: input.amount,
      currency: currency,
      type: input.type,
      categoryId: input.categoryId,
      description: input.description,
      date: Timestamp.fromDate(input.date),
      tags: input.tags || [],
      createdAt: Timestamp.fromDate(new Date()),
      updatedAt: Timestamp.fromDate(new Date()),
    };

    // Only add optional fields if they have values
    if (input.sourceName) transaction.sourceName = input.sourceName;
    if (input.merchantName) transaction.merchantName = input.merchantName;
    if (input.notes) transaction.notes = input.notes;

    const docRef = await addDoc(collection(db, this.collectionName), transaction);

    return docRef.id;
  }

  /**
   * Get transaction by ID
   */
  async getById(id: string): Promise<Transaction | null> {
    const docRef = doc(db, this.collectionName, id);
    const docSnap = await getDocs(query(collection(db, this.collectionName), where('__name__', '==', id)));

    if (docSnap.empty) return null;

    const data = docSnap.docs[0].data();
    return this.mapToTransaction(id, data);
  }

  /**
   * Get all transactions for a user
   */
  async getByUserId(
    userId: string,
    options?: {
      limitCount?: number;
      orderByField?: string;
      orderDirection?: 'asc' | 'desc';
    }
  ): Promise<Transaction[]> {
    const constraints: QueryConstraint[] = [where('userId', '==', userId)];

    if (options?.orderByField) {
      constraints.push(orderBy(options.orderByField, options.orderDirection || 'desc'));
    } else {
      constraints.push(orderBy('date', 'desc'));
    }

    if (options?.limitCount) {
      constraints.push(limit(options.limitCount));
    }

    const q = query(collection(db, this.collectionName), ...constraints);
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => this.mapToTransaction(doc.id, doc.data()));
  }

  /**
   * Get transactions by account
   */
  async getByAccountId(accountId: string): Promise<Transaction[]> {
    const q = query(
      collection(db, this.collectionName),
      where('accountId', '==', accountId),
      orderBy('date', 'desc')
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => this.mapToTransaction(doc.id, doc.data()));
  }

  /**
   * Get transactions by category
   */
  async getByCategoryId(userId: string, categoryId: string): Promise<Transaction[]> {
    const q = query(
      collection(db, this.collectionName),
      where('userId', '==', userId),
      where('categoryId', '==', categoryId),
      orderBy('date', 'desc')
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => this.mapToTransaction(doc.id, doc.data()));
  }

  /**
   * Get transactions by date range
   */
  async getByDateRange(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<Transaction[]> {
    const q = query(
      collection(db, this.collectionName),
      where('userId', '==', userId),
      where('date', '>=', Timestamp.fromDate(startDate)),
      where('date', '<=', Timestamp.fromDate(endDate)),
      orderBy('date', 'desc')
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => this.mapToTransaction(doc.id, doc.data()));
  }

  /**
   * Update a transaction
   */
  async update(input: UpdateTransactionInput): Promise<void> {
    const { id, ...updateData } = input;
    const docRef = doc(db, this.collectionName, id);

    const updates: any = {
      ...updateData,
      updatedAt: Timestamp.fromDate(new Date()),
    };

    if (updateData.date) {
      updates.date = Timestamp.fromDate(updateData.date);
    }

    await updateDoc(docRef, updates);
  }

  /**
   * Delete a transaction
   */
  async delete(id: string): Promise<void> {
    const docRef = doc(db, this.collectionName, id);
    await deleteDoc(docRef);
  }

  /**
   * Get transaction statistics for a user
   */
  async getStats(userId: string, startDate: Date, endDate: Date) {
    const transactions = await this.getByDateRange(userId, startDate, endDate);

    const income = transactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    const expenses = transactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    return {
      income,
      expenses,
      balance: income - expenses,
      transactionCount: transactions.length,
    };
  }

  /**
   * Map Firestore data to Transaction model
   */
  private mapToTransaction(id: string, data: any): Transaction {
    return {
      id,
      userId: data.userId,
      accountId: data.accountId,
      amount: data.amount,
      currency: data.currency,
      type: data.type,
      categoryId: data.categoryId,
      description: data.description,
      date: data.date?.toDate() || new Date(),
      tags: data.tags || [],
      sourceId: data.sourceId,
      sourceName: data.sourceName,
      merchantName: data.merchantName,
      notes: data.notes,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    };
  }
}

// Singleton instance
export const transactionRepository = new TransactionRepository();
