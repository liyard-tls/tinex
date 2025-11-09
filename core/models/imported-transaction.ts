/**
 * Model for tracking imported transactions to prevent duplicates
 */
export interface ImportedTransaction {
  id: string;
  userId: string;
  transactionId: string; // Reference to the created transaction
  hash: string; // Unique hash of the imported data (date + description + amount + currency)
  source: string; // e.g., 'trustee', 'monobank', etc.
  importDate: Date;
  createdAt: Date;
}

export interface CreateImportedTransactionInput {
  userId: string;
  transactionId: string;
  hash: string;
  source: string;
  importDate: Date;
}
