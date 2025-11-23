export type BudgetPeriod = 'day' | 'week' | 'month' | 'year';

export interface Budget {
  id: string;
  userId: string;
  categoryId: string;
  amount: number;
  period: BudgetPeriod;
  startDate: Date;
  endDate?: Date; // null means ongoing
  alertThreshold: number; // Percentage (e.g., 80 means alert at 80%)
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateBudgetInput {
  categoryId: string;
  amount: number;
  period: BudgetPeriod;
  startDate: Date;
  endDate?: Date;
  alertThreshold?: number;
}

export interface UpdateBudgetInput extends Partial<CreateBudgetInput> {
  id: string;
  isActive?: boolean;
}

export interface BudgetProgress {
  budget: Budget;
  spent: number;
  remaining: number;
  percentage: number;
  isOverBudget: boolean;
  shouldAlert: boolean;
}
