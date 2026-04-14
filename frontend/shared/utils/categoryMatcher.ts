import { Transaction, Category } from '@/core/models';

/**
 * Auto-detect category for a transaction based on existing transactions
 * Matches by description similarity
 */
export function detectCategoryFromDescription(
  description: string,
  type: 'income' | 'expense',
  existingTransactions: Transaction[]
): string | null {
  if (!description || existingTransactions.length === 0) {
    return null;
  }

  // Normalize description for comparison
  const normalizedDesc = normalizeDescription(description);

  // Find matching transactions
  const matches = existingTransactions.filter(txn => {
    if (txn.type !== type) return false; // Only match same type
    if (!txn.categoryId) return false; // Only use categorized transactions

    const txnDesc = normalizeDescription(txn.description);

    // Exact match
    if (txnDesc === normalizedDesc) return true;

    // Contains match (for longer descriptions)
    // Only match if the shorter string is at least 5 chars to avoid false positives
    const shorterLen = Math.min(normalizedDesc.length, txnDesc.length);
    if (shorterLen >= 5) {
      if (txnDesc.includes(normalizedDesc) || normalizedDesc.includes(txnDesc)) {
        return true;
      }
    }

    // Word-based similarity
    const similarity = calculateSimilarity(normalizedDesc, txnDesc);
    return similarity > 0.7; // 70% similarity threshold
  });

  if (matches.length === 0) {
    return null;
  }

  // Return the most common category from matches
  const categoryCount = new Map<string, number>();
  matches.forEach(txn => {
    const count = categoryCount.get(txn.categoryId) || 0;
    categoryCount.set(txn.categoryId, count + 1);
  });

  // Get category with highest count
  let maxCount = 0;
  let mostCommonCategory: string | null = null;
  categoryCount.forEach((count, categoryId) => {
    if (count > maxCount) {
      maxCount = count;
      mostCommonCategory = categoryId;
    }
  });

  return mostCommonCategory;
}

/**
 * Match description directly with category names
 * Uses fuzzy matching to find the best matching category
 */
export function matchCategoryByName(
  description: string,
  categories: Category[],
  type: 'income' | 'expense'
): string | null {
  if (!description || categories.length === 0) {
    return null;
  }

  const normalizedDesc = normalizeDescription(description);
  const filteredCategories = categories.filter(cat => cat.type === type);

  if (filteredCategories.length === 0) {
    return null;
  }

  // Find best matching category
  let bestMatch: { categoryId: string; score: number } | null = null;

  for (const category of filteredCategories) {
    const normalizedCatName = normalizeDescription(category.name);

    // Exact match - highest priority
    if (normalizedDesc === normalizedCatName || normalizedCatName === normalizedDesc) {
      return category.id;
    }

    // Check if description contains category name or vice versa
    if (normalizedDesc.includes(normalizedCatName)) {
      const score = normalizedCatName.length / normalizedDesc.length;
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { categoryId: category.id, score: score + 0.5 }; // Bonus for contains match
      }
      continue;
    }

    if (normalizedCatName.includes(normalizedDesc)) {
      const score = normalizedDesc.length / normalizedCatName.length;
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { categoryId: category.id, score: score + 0.5 };
      }
      continue;
    }

    // Fuzzy matching using Levenshtein distance
    const distance = levenshteinDistance(normalizedDesc, normalizedCatName);
    const maxLen = Math.max(normalizedDesc.length, normalizedCatName.length);
    const similarity = 1 - (distance / maxLen);

    // Only consider matches with at least 60% similarity
    if (similarity >= 0.6) {
      if (!bestMatch || similarity > bestMatch.score) {
        bestMatch = { categoryId: category.id, score: similarity };
      }
    }
  }

  // Return best match if score is high enough (at least 60%)
  if (bestMatch && bestMatch.score >= 0.6) {
    return bestMatch.categoryId;
  }

  return null;
}

/**
 * Normalize description for comparison
 * - Convert to lowercase
 * - Remove extra spaces
 * - Remove special characters
 */
function normalizeDescription(desc: string): string {
  return desc
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // Replace special chars with space
    .replace(/\s+/g, ' ') // Collapse multiple spaces
    .trim();
}

/**
 * Calculate Levenshtein distance between two strings
 * Returns the minimum number of edits needed to transform str1 into str2
 */
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;

  // Create a matrix to store distances
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  // Initialize first row and column
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  // Fill the matrix
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,     // deletion
          dp[i][j - 1] + 1,     // insertion
          dp[i - 1][j - 1] + 1  // substitution
        );
      }
    }
  }

  return dp[m][n];
}

/**
 * Check if two words are similar using Levenshtein distance
 * Returns true if edit distance is less than 30% of the longer word
 */
function areWordsSimilar(word1: string, word2: string): boolean {
  // Exact match
  if (word1 === word2) return true;

  // Substring match (e.g., "glovoapp" contains "glovo")
  if (word1.includes(word2) || word2.includes(word1)) return true;

  // Fuzzy match using Levenshtein distance
  const distance = levenshteinDistance(word1, word2);
  const maxLen = Math.max(word1.length, word2.length);

  // Allow up to 30% difference (e.g., "glovo" vs "glovoapp" = 3/8 = 37.5%)
  // For short words, be more strict
  const threshold = maxLen <= 5 ? 0.2 : 0.35;

  return distance / maxLen <= threshold;
}

/**
 * Calculate similarity between two strings using enhanced word matching
 * Returns a value between 0 and 1
 *
 * Improvements over basic Jaccard:
 * - Exact word matches get full score (1.0)
 * - Substring matches get high score (0.85)
 * - Fuzzy matches get medium score (0.7)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const words1 = str1.split(' ').filter(w => w.length > 2); // Ignore short words
  const words2 = str2.split(' ').filter(w => w.length > 2);

  if (words1.length === 0 || words2.length === 0) {
    return 0;
  }

  // Track which words in words2 have been matched to avoid double-counting
  const matched2 = new Set<number>();
  let totalScore = 0;

  // For each word in words1, find best match in words2
  words1.forEach(w1 => {
    let bestScore = 0;
    let bestIdx = -1;

    words2.forEach((w2, idx) => {
      if (matched2.has(idx)) return; // Already matched

      let score = 0;
      if (w1 === w2) {
        score = 1.0; // Exact match
      } else if (Math.min(w1.length, w2.length) >= 4 && (w1.includes(w2) || w2.includes(w1))) {
        score = 0.85; // Contains match - only if shorter word is at least 4 chars
      } else if (areWordsSimilar(w1, w2)) {
        score = 0.7; // Fuzzy match
      }

      if (score > bestScore) {
        bestScore = score;
        bestIdx = idx;
      }
    });

    if (bestIdx >= 0) {
      matched2.add(bestIdx);
      totalScore += bestScore;
    }
  });

  // Normalize by the average of both word counts (more balanced than max or min)
  const avgWordCount = (words1.length + words2.length) / 2;
  return totalScore / avgWordCount;
}
