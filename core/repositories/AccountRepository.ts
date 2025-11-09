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
import { Account, CreateAccountInput, UpdateAccountInput } from '@/core/models';
import { FIREBASE_COLLECTIONS } from '@/shared/config/constants';

export class AccountRepository {
  private collectionName = FIREBASE_COLLECTIONS.ACCOUNTS;

  /**
   * Create a new account
   */
  async create(userId: string, input: CreateAccountInput): Promise<string> {
    const account: any = {
      userId,
      name: input.name,
      type: input.type,
      currency: input.currency,
      balance: input.balance,
      isDefault: input.isDefault || false,
      createdAt: Timestamp.fromDate(new Date()),
      updatedAt: Timestamp.fromDate(new Date()),
    };

    // Only add optional fields if they have values
    if (input.color) account.color = input.color;
    if (input.icon) account.icon = input.icon;
    if (input.notes) account.notes = input.notes;

    const docRef = await addDoc(collection(db, this.collectionName), account);

    return docRef.id;
  }

  /**
   * Get account by ID
   */
  async getById(id: string): Promise<Account | null> {
    const docSnap = await getDocs(
      query(collection(db, this.collectionName), where('__name__', '==', id))
    );

    if (docSnap.empty) return null;

    const data = docSnap.docs[0].data();
    return this.mapToAccount(id, data);
  }

  /**
   * Get all accounts for a user
   */
  async getByUserId(userId: string): Promise<Account[]> {
    const q = query(
      collection(db, this.collectionName),
      where('userId', '==', userId),
      orderBy('isDefault', 'desc'),
      orderBy('createdAt', 'asc')
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => this.mapToAccount(doc.id, doc.data()));
  }

  /**
   * Get default account for a user
   */
  async getDefaultAccount(userId: string): Promise<Account | null> {
    const q = query(
      collection(db, this.collectionName),
      where('userId', '==', userId),
      where('isDefault', '==', true)
    );

    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) return null;

    const doc = querySnapshot.docs[0];
    return this.mapToAccount(doc.id, doc.data());
  }

  /**
   * Update an account
   */
  async update(input: UpdateAccountInput): Promise<void> {
    const { id, ...updateData } = input;
    const docRef = doc(db, this.collectionName, id);

    const updates: any = {
      ...updateData,
      updatedAt: Timestamp.fromDate(new Date()),
    };

    await updateDoc(docRef, updates);
  }

  /**
   * Update account balance
   */
  async updateBalance(id: string, newBalance: number): Promise<void> {
    const docRef = doc(db, this.collectionName, id);
    await updateDoc(docRef, {
      balance: newBalance,
      updatedAt: Timestamp.fromDate(new Date()),
    });
  }

  /**
   * Set account as default (and unset others)
   */
  async setDefault(userId: string, accountId: string): Promise<void> {
    // Get all user accounts
    const accounts = await this.getByUserId(userId);

    // Update all accounts
    const updates = accounts.map(async (account) => {
      const docRef = doc(db, this.collectionName, account.id);
      await updateDoc(docRef, {
        isDefault: account.id === accountId,
        updatedAt: Timestamp.fromDate(new Date()),
      });
    });

    await Promise.all(updates);
  }

  /**
   * Delete an account
   */
  async delete(id: string): Promise<void> {
    const docRef = doc(db, this.collectionName, id);
    await deleteDoc(docRef);
  }

  /**
   * Delete all accounts for a user
   */
  async deleteAllForUser(userId: string): Promise<void> {
    const q = query(collection(db, this.collectionName), where('userId', '==', userId));
    const snapshot = await getDocs(q);

    const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);
  }

  /**
   * Get total balance across all accounts
   */
  async getTotalBalance(userId: string): Promise<number> {
    const accounts = await this.getByUserId(userId);
    return accounts.reduce((sum, account) => sum + account.balance, 0);
  }

  /**
   * Map Firestore data to Account model
   */
  private mapToAccount(id: string, data: any): Account {
    return {
      id,
      userId: data.userId,
      name: data.name,
      type: data.type,
      currency: data.currency,
      balance: data.balance,
      color: data.color,
      icon: data.icon,
      isDefault: data.isDefault || false,
      notes: data.notes,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    };
  }
}

// Singleton instance
export const accountRepository = new AccountRepository();
