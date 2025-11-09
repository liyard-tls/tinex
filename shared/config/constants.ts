/**
 * Application-wide constants
 */

export const APP_NAME = 'TineX';
export const APP_DESCRIPTION = 'Personal Finance Manager';

export const ROUTES = {
  HOME: '/',
  DASHBOARD: '/dashboard',
  TRANSACTIONS: '/transactions',
  BUDGETS: '/budgets',
  CATEGORIES: '/categories',
  SETTINGS: '/settings',
  AUTH: '/auth',
} as const;

export const FIREBASE_COLLECTIONS = {
  USERS: 'users',
  TRANSACTIONS: 'transactions',
  CATEGORIES: 'categories',
  BUDGETS: 'budgets',
  IMPORT_SOURCES: 'importSources',
  IMPORT_JOBS: 'importJobs',
  ACCOUNTS: 'accounts',
  TAGS: 'tags',
} as const;

export const DATE_FORMATS = {
  DISPLAY: 'MMM dd, yyyy',
  INPUT: 'yyyy-MM-dd',
  FULL: 'MMMM dd, yyyy',
  SHORT: 'MM/dd/yyyy',
} as const;

export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  INR: '₹',
} as const;

export const DEFAULT_CURRENCY = 'USD';

export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
} as const;

export const FILE_UPLOAD = {
  MAX_SIZE: 10 * 1024 * 1024, // 10MB
  ACCEPTED_FORMATS: {
    CSV: ['.csv', 'text/csv'],
    PDF: ['.pdf', 'application/pdf'],
  },
} as const;

export const BUDGET_PERIODS = ['weekly', 'monthly', 'yearly'] as const;

export const TRANSACTION_TYPES = ['income', 'expense', 'transfer'] as const;
