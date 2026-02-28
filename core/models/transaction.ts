import { Currency } from './account';

export type TransactionType = 'income' | 'expense' | 'transfer';

export interface Transaction {
  id: string;
  userId: string;
  accountId: string; // Reference to account
  amount: number;
  currency: Currency; // Currency from the account
  type: TransactionType;
  categoryId: string;
  description: string;
  date: Date;
  tags: string[];
  sourceId?: string; // Reference to import source
  sourceName?: string; // Bank name or manual entry
  merchantName?: string;
  notes?: string;
  excludeFromAnalytics?: boolean; // If true, exclude from analytics calculations
  exchangeRate?: number; // Rate used at time of transfer (fromCurrency → toCurrency), stored on Transfer Out txn
  fee?: number; // Transaction fee in the same currency as the transaction
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTransactionInput {
  accountId: string;
  amount: number;
  type: TransactionType;
  categoryId: string;
  description: string;
  date: Date;
  tags?: string[];
  sourceName?: string;
  merchantName?: string;
  notes?: string;
  excludeFromAnalytics?: boolean;
  exchangeRate?: number; // Rate used at time of transfer
  fee?: number; // Transaction fee in the same currency
}

export interface UpdateTransactionInput extends Partial<CreateTransactionInput> {
  id: string;
  currency?: Currency;
  exchangeRate?: number;
  fee?: number;
}
