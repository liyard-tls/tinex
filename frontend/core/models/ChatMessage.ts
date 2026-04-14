import { Timestamp } from 'firebase/firestore';

/**
 * Chat Message Model
 * Stores AI assistant conversation messages
 */
export interface ChatMessage {
  id: string;
  userId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Timestamp | Date;
}

/**
 * Input for creating a chat message
 */
export interface CreateChatMessageInput {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Quick action for chat
 */
export interface QuickAction {
  id: string;
  label: string;
  prompt: string;
  icon: string;
}

/**
 * Default quick actions for the chat
 */
export const DEFAULT_QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'weekly-report',
    label: 'Weekly Report',
    prompt: 'Give me a report of my expenses for this week',
    icon: '📊',
  },
  {
    id: 'compare-month',
    label: 'Compare with Last Month',
    prompt: 'Compare my expenses this month with last month',
    icon: '📈',
  },
  {
    id: 'savings-tips',
    label: 'Savings Tips',
    prompt: 'Analyze my expenses and suggest where I can save money',
    icon: '💡',
  },
  {
    id: 'top-expenses',
    label: 'Top 5 Expenses',
    prompt: 'Show me the top 5 biggest expenses for the last month',
    icon: '🏆',
  },
];
