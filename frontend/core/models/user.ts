export interface User {
  id: string;
  email: string;
  displayName: string;
  photoURL?: string;
  currency: string;
  timezone: string;
  preferences: UserPreferences;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  language: string;
  dateFormat: string;
  firstDayOfWeek: number; // 0 = Sunday, 1 = Monday
  notifications: {
    budgetAlerts: boolean;
    weeklyReport: boolean;
    monthlyReport: boolean;
  };
  defaultView: 'dashboard' | 'transactions' | 'budgets';
}

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  theme: 'dark',
  language: 'en',
  dateFormat: 'MM/DD/YYYY',
  firstDayOfWeek: 1,
  notifications: {
    budgetAlerts: true,
    weeklyReport: false,
    monthlyReport: true,
  },
  defaultView: 'dashboard',
};
