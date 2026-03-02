import { Currency } from './account';
import { TransactionType } from './transaction';

export type RecurrenceType = 'once' | 'daily' | 'weekly' | 'monthly' | 'yearly';

export const RECURRENCE_LABELS: Record<RecurrenceType, string> = {
  once:    'Once',
  daily:   'Daily',
  weekly:  'Weekly',
  monthly: 'Monthly',
  yearly:  'Yearly',
};

export interface ScheduledTransaction {
  id: string;
  userId: string;
  accountId: string;
  type: TransactionType;
  amount: number;
  currency: Currency;
  description: string;
  categoryId: string;
  tags: string[];
  fee?: number;
  // Scheduling
  nextDate: Date;
  recurrence: RecurrenceType;
  endDate?: Date;
  // Status
  isActive: boolean;
  lastExecutedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateScheduledTransactionInput {
  accountId: string;
  type: TransactionType;
  amount: number;
  description: string;
  categoryId: string;
  tags?: string[];
  fee?: number;
  nextDate: Date;
  recurrence: RecurrenceType;
  endDate?: Date;
}

export interface UpdateScheduledTransactionInput {
  id: string;
  accountId?: string;
  type?: TransactionType;
  amount?: number;
  description?: string;
  categoryId?: string;
  tags?: string[];
  fee?: number;
  nextDate?: Date;
  recurrence?: RecurrenceType;
  endDate?: Date;
  isActive?: boolean;
  lastExecutedAt?: Date;
}
