import {
  collection,
  addDoc,
  deleteDoc,
  query,
  where,
  getDocs,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  ImportedTransaction,
  CreateImportedTransactionInput,
} from '../models/imported-transaction';

const COLLECTION_NAME = 'importedTransactions';

/**
 * Repository for managing imported transactions
 * Used for duplicate detection and tracking import history
 */
class ImportedTransactionRepository {
  /**
   * Create a new imported transaction record
   */
  async create(input: CreateImportedTransactionInput): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, COLLECTION_NAME), {
        ...input,
        importDate: Timestamp.fromDate(input.importDate),
        createdAt: Timestamp.fromDate(new Date()),
      });
      return docRef.id;
    } catch (error) {
      console.error('Error creating imported transaction:', error);
      throw error;
    }
  }

  /**
   * Check if a transaction hash already exists for a user
   * Returns true if duplicate found
   */
  async isDuplicate(userId: string, hash: string, source: string): Promise<boolean> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('userId', '==', userId),
        where('hash', '==', hash),
        where('source', '==', source)
      );

      const snapshot = await getDocs(q);
      return !snapshot.empty;
    } catch (error) {
      console.error('Error checking duplicate:', error);
      throw error;
    }
  }

  /**
   * Get all imported transaction hashes for a user and source
   */
  async getImportedHashes(userId: string, source: string): Promise<Set<string>> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('userId', '==', userId),
        where('source', '==', source)
      );

      const snapshot = await getDocs(q);
      const hashes = new Set<string>();

      snapshot.forEach((doc) => {
        const data = doc.data();
        hashes.add(data.hash);
      });

      return hashes;
    } catch (error) {
      console.error('Error getting imported hashes:', error);
      throw error;
    }
  }

  /**
   * Get all imported transactions for a user
   */
  async getByUserId(userId: string): Promise<ImportedTransaction[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('userId', '==', userId)
      );

      const snapshot = await getDocs(q);
      const transactions: ImportedTransaction[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        transactions.push({
          id: doc.id,
          userId: data.userId,
          transactionId: data.transactionId,
          hash: data.hash,
          source: data.source,
          importDate: data.importDate?.toDate() || new Date(),
          createdAt: data.createdAt?.toDate() || new Date(),
        });
      });

      return transactions;
    } catch (error) {
      console.error('Error getting imported transactions:', error);
      throw error;
    }
  }

  /**
   * Batch create imported transaction records
   */
  async createBatch(inputs: CreateImportedTransactionInput[]): Promise<void> {
    try {
      const promises = inputs.map((input) => this.create(input));
      await Promise.all(promises);
    } catch (error) {
      console.error('Error creating batch imported transactions:', error);
      throw error;
    }
  }

  /**
   * Delete all imported transactions for a user
   */
  async deleteAllForUser(userId: string): Promise<void> {
    try {
      const q = query(collection(db, COLLECTION_NAME), where('userId', '==', userId));
      const snapshot = await getDocs(q);

      const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
    } catch (error) {
      console.error('Error deleting all imported transactions:', error);
      throw error;
    }
  }
}

export const importedTransactionRepository = new ImportedTransactionRepository();
