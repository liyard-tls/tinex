import { Timestamp } from 'firebase/firestore';
import { Currency } from './account';

/**
 * User Settings Model
 * Stores user preferences including base currency for conversions
 */
export interface UserSettings {
  id: string; // Document ID (same as userId)
  userId: string;
  baseCurrency: Currency; // Main currency for displaying totals and analytics
  activeAnalyticsPresetId?: string; // Currently selected analytics preset (null = All Categories)
  seenVersion?: string; // Last app version user has seen (for What's New popup)
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Input for creating user settings
 */
export interface CreateUserSettingsInput {
  baseCurrency: Currency;
}

/**
 * Input for updating user settings
 */
export interface UpdateUserSettingsInput {
  baseCurrency?: Currency;
  activeAnalyticsPresetId?: string | null;
  seenVersion?: string;
}
