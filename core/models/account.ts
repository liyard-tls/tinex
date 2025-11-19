export type AccountType = 'bank' | 'cash' | 'credit_card' | 'investment' | 'savings' | 'other';
export type Currency = 'USD' | 'EUR' | 'GBP' | 'JPY' | 'CAD' | 'AUD' | 'CHF' | 'CNY' | 'UAH' | 'SGD';

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

export const ACCOUNT_TYPES: { value: AccountType; label: string; defaultIcon: string; defaultColor: string }[] = [
  { value: 'cash', label: 'Cash', defaultIcon: 'DollarSign', defaultColor: '#10b981' },
  { value: 'bank', label: 'Bank Account', defaultIcon: 'Briefcase', defaultColor: '#3b82f6' },
  { value: 'credit_card', label: 'Credit Card', defaultIcon: 'CreditCard', defaultColor: '#8b5cf6' },
  { value: 'savings', label: 'Savings', defaultIcon: 'PiggyBank', defaultColor: '#f59e0b' },
  { value: 'investment', label: 'Investment', defaultIcon: 'TrendingUp', defaultColor: '#06b6d4' },
  { value: 'other', label: 'Other', defaultIcon: 'Wallet', defaultColor: '#6b7280' },
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
  { value: 'SGD', label: 'Singapore Dollar', symbol: 'S$' },
];

// Helper function to get default icon and color for account type
export function getAccountDefaults(type: AccountType): { icon: string; color: string } {
  const accountType = ACCOUNT_TYPES.find(t => t.value === type);
  return {
    icon: accountType?.defaultIcon || 'Wallet',
    color: accountType?.defaultColor || '#6b7280'
  };
}
