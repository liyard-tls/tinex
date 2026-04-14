import {
  ImportedTransaction,
  CreateImportedTransactionInput,
} from '@/core/models';
import { apiFetch } from './client';

class ImportedTransactionApiRepository {
  async create(input: CreateImportedTransactionInput): Promise<string> {
    await this.createBatch([input]);
    return '';
  }

  async isDuplicate(userId: string, hash: string, source: string): Promise<boolean> {
    const hashes = await this.getImportedHashes(userId, source);
    return hashes.has(hash);
  }

  async getImportedHashes(userId: string, source: string): Promise<Set<string>> {
    const hashes = await apiFetch<string[]>(
      `/api/v1/imported-transactions/hashes?source=${encodeURIComponent(source)}`
    );
    return new Set(hashes ?? []);
  }

  async getByUserId(_userId: string): Promise<ImportedTransaction[]> {
    return [];
  }

  async createBatch(inputs: CreateImportedTransactionInput[]): Promise<void> {
    await apiFetch('/api/v1/imported-transactions/batch', {
      method: 'POST',
      body: JSON.stringify(inputs),
    });
  }

  async deleteByTransactionId(transactionId: string): Promise<void> {
    await apiFetch(`/api/v1/imported-transactions/by-transaction/${transactionId}`, {
      method: 'DELETE',
    });
  }

  async deleteAllForUser(_userId: string): Promise<void> {
    // Handled by cascade when transactions are deleted
  }
}

export const importedTransactionRepository = new ImportedTransactionApiRepository();
