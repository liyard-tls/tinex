// Redirected to Go+PostgreSQL API client
export { scheduledTransactionRepository } from '@/core/api/scheduledApi';

// advanceNextDate helper — kept here for components that import it
export function advanceNextDate(current: Date, recurrence: string): Date {
  switch (recurrence) {
    case 'daily':
      return new Date(current.getFullYear(), current.getMonth(), current.getDate() + 1);
    case 'weekly':
      return new Date(current.getFullYear(), current.getMonth(), current.getDate() + 7);
    case 'monthly':
      return new Date(current.getFullYear(), current.getMonth() + 1, current.getDate());
    case 'yearly':
      return new Date(current.getFullYear() + 1, current.getMonth(), current.getDate());
    default:
      return current;
  }
}
