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
}

export interface UpdateTransactionInput extends Partial<CreateTransactionInput> {
  id: string;
  currency?: Currency;
}
