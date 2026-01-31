/**
 * Application Version Configuration
 *
 * HOW TO UPDATE:
 * 1. Change APP_VERSION to the new version number
 * 2. Add a new entry at the TOP of CHANGELOG array
 * 3. Set isHighlight: true for entries shown in the "What's New" popup
 *
 * Version format: MAJOR.MINOR.PATCH
 * - MAJOR: Breaking changes or major features
 * - MINOR: New features, enhancements
 * - PATCH: Bug fixes, small improvements
 */

export const APP_VERSION = '1.1.0';

export interface ChangelogEntry {
  version: string;
  date: string; // Format: YYYY-MM-DD
  title: string; // Short title for the version
  changes: {
    type: 'feature' | 'improvement' | 'fix' | 'breaking';
    text: string;
    isHighlight?: boolean; // Show in "What's New" popup
  }[];
}

/**
 * Changelog entries - newest first
 *
 * To add a new version:
 * 1. Add new entry at the TOP of this array
 * 2. Update APP_VERSION constant above
 * 3. Mark important changes with isHighlight: true
 */
export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.1.0',
    date: '2025-01-31',
    title: 'Smarter Transactions',
    changes: [
      { type: 'feature', text: 'What\'s New popup on app updates', isHighlight: true },
      { type: 'feature', text: 'Changelog page in Menu' },
      { type: 'improvement', text: 'Smarter category suggestions when adding transactions', isHighlight: true },
      { type: 'improvement', text: 'Better navigation after deleting a transaction' },
      { type: 'fix', text: 'Fixed error when deleting transactions' },
    ],
  },
  {
    version: '1.0.0',
    date: '2025-01-31',
    title: 'Initial Release',
    changes: [
      { type: 'feature', text: 'Transaction tracking with categories and tags', isHighlight: true },
      { type: 'feature', text: 'Multi-currency support with automatic conversion', isHighlight: true },
      { type: 'feature', text: 'Bank statement import (PDF, CSV)', isHighlight: true },
      { type: 'feature', text: 'AI-powered financial assistant', isHighlight: true },
      { type: 'feature', text: 'Analytics and spending insights' },
      { type: 'feature', text: 'Budget management' },
      { type: 'feature', text: 'Wishlists' },
      { type: 'feature', text: 'Dark theme optimized for mobile' },
    ],
  },
];

/**
 * Get the latest changelog entry
 */
export function getLatestChangelog(): ChangelogEntry | null {
  return CHANGELOG[0] || null;
}

/**
 * Get highlighted changes for the "What's New" popup
 */
export function getHighlightedChanges(): ChangelogEntry['changes'] {
  const latest = getLatestChangelog();
  if (!latest) return [];
  return latest.changes.filter(c => c.isHighlight);
}

/**
 * Get change type label and color
 */
export function getChangeTypeConfig(type: ChangelogEntry['changes'][0]['type']) {
  switch (type) {
    case 'feature':
      return { label: 'New', color: 'bg-emerald-500/20 text-emerald-400' };
    case 'improvement':
      return { label: 'Improved', color: 'bg-blue-500/20 text-blue-400' };
    case 'fix':
      return { label: 'Fixed', color: 'bg-amber-500/20 text-amber-400' };
    case 'breaking':
      return { label: 'Changed', color: 'bg-red-500/20 text-red-400' };
    default:
      return { label: 'Update', color: 'bg-gray-500/20 text-gray-400' };
  }
}
