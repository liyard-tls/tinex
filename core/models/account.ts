export type AccountType = 'bank' | 'cash' | 'credit_card' | 'investment' | 'savings' | 'other';
export type Currency = 'USD' | 'EUR' | 'GBP' | 'JPY' | 'CAD' | 'AUD' | 'CHF' | 'CNY' | 'UAH';

export interface Account {
  id: string;
  userId: string;
  name: string;
  type: AccountType;
  currency: Currency;
  balance: number;
  color?: string;
  icon?: string;
  isDefault: boolean;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAccountInput {
  name: string;
  type: AccountType;
  currency: Currency;
  balance: number;
  color?: string;
  icon?: string;
  isDefault?: boolean;
  notes?: string;
}

export interface UpdateAccountInput {
  id: string;
  name?: string;
  type?: AccountType;
  currency?: Currency;
  balance?: number;
  color?: string;
  icon?: string;
  isDefault?: boolean;
  notes?: string;
}

export const DEFAULT_ACCOUNTS: Omit<CreateAccountInput, 'userId'>[] = [
  {
    name: 'Cash USD',
    type: 'cash',
    currency: 'USD',
    balance: 0,
    isDefault: true,
  },
  {
    name: 'Main Bank',
    type: 'bank',
    currency: 'USD',
    balance: 0,
    isDefault: false,
  },
];

export const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank', label: 'Bank Account' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'savings', label: 'Savings' },
  { value: 'investment', label: 'Investment' },
  { value: 'other', label: 'Other' },
];

export const CURRENCIES: { value: Currency; label: string; symbol: string }[] = [
  { value: 'USD', label: 'US Dollar', symbol: '$' },
  { value: 'EUR', label: 'Euro', symbol: '€' },
  { value: 'GBP', label: 'British Pound', symbol: '£' },
  { value: 'JPY', label: 'Japanese Yen', symbol: '¥' },
  { value: 'CAD', label: 'Canadian Dollar', symbol: 'C$' },
  { value: 'AUD', label: 'Australian Dollar', symbol: 'A$' },
  { value: 'CHF', label: 'Swiss Franc', symbol: 'CHF' },
  { value: 'CNY', label: 'Chinese Yuan', symbol: '¥' },
  { value: 'UAH', label: 'Ukrainian Hryvnia', symbol: '₴' },
];
