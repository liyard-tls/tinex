/**
 * Simple rule-based category detection
 * Can be enhanced with ML in the future
 */

interface CategoryRule {
  category: string;
  keywords: string[];
}

const CATEGORY_RULES: CategoryRule[] = [
  // Food & Dining
  {
    category: 'Food & Dining',
    keywords: [
      'restaurant', 'cafe', 'coffee', 'starbucks', 'mcdonald', 'burger',
      'pizza', 'food', 'dining', 'delivery', 'uber eats', 'doordash',
      'grubhub', 'postmates', 'bakery', 'bar', 'pub', 'lunch', 'dinner'
    ],
  },
  // Shopping
  {
    category: 'Shopping',
    keywords: [
      'amazon', 'walmart', 'target', 'ebay', 'store', 'shop', 'mall',
      'clothing', 'shoes', 'fashion', 'retail', 'purchase', 'buy'
    ],
  },
  // Transport
  {
    category: 'Transport',
    keywords: [
      'uber', 'lyft', 'taxi', 'gas', 'fuel', 'parking', 'transit',
      'metro', 'bus', 'train', 'airline', 'flight', 'car', 'vehicle',
      'toll', 'transportation'
    ],
  },
  // Bills & Utilities
  {
    category: 'Bills & Utilities',
    keywords: [
      'electric', 'water', 'gas', 'internet', 'phone', 'mobile',
      'utility', 'bill', 'payment', 'insurance', 'rent', 'mortgage',
      'subscription', 'netflix', 'spotify', 'hulu'
    ],
  },
  // Entertainment
  {
    category: 'Entertainment',
    keywords: [
      'movie', 'cinema', 'theater', 'concert', 'event', 'ticket',
      'game', 'gaming', 'entertainment', 'music', 'streaming'
    ],
  },
  // Healthcare
  {
    category: 'Healthcare',
    keywords: [
      'pharmacy', 'doctor', 'hospital', 'medical', 'health', 'dental',
      'clinic', 'prescription', 'medicine', 'cvs', 'walgreens'
    ],
  },
  // Education
  {
    category: 'Education',
    keywords: [
      'school', 'university', 'college', 'course', 'tuition', 'education',
      'book', 'learning', 'training', 'udemy', 'coursera'
    ],
  },
  // Income
  {
    category: 'Salary',
    keywords: [
      'salary', 'payroll', 'wage', 'income', 'deposit', 'direct dep',
      'payment received'
    ],
  },
];

/**
 * Detect category based on transaction description
 * @param description - Transaction description or merchant name
 * @returns string | null - Suggested category name or null
 */
export function detectCategory(description: string): string | null {
  if (!description) return null;

  const lowerDesc = description.toLowerCase();

  for (const rule of CATEGORY_RULES) {
    for (const keyword of rule.keywords) {
      if (lowerDesc.includes(keyword.toLowerCase())) {
        return rule.category;
      }
    }
  }

  return null;
}

/**
 * Get confidence score for category detection
 * @param description - Transaction description
 * @param category - Suggested category
 * @returns number - Confidence score (0-1)
 */
export function getCategoryConfidence(
  description: string,
  category: string
): number {
  if (!description || !category) return 0;

  const lowerDesc = description.toLowerCase();
  const rule = CATEGORY_RULES.find((r) => r.category === category);

  if (!rule) return 0;

  let matchCount = 0;
  for (const keyword of rule.keywords) {
    if (lowerDesc.includes(keyword.toLowerCase())) {
      matchCount++;
    }
  }

  // Simple confidence calculation based on keyword matches
  return Math.min(matchCount * 0.3, 1);
}

/**
 * Get all possible category suggestions with confidence
 * @param description - Transaction description
 * @returns Array of {category, confidence} sorted by confidence
 */
export function getSuggestedCategories(
  description: string
): Array<{ category: string; confidence: number }> {
  if (!description) return [];

  const suggestions: Array<{ category: string; confidence: number }> = [];
  const lowerDesc = description.toLowerCase();

  for (const rule of CATEGORY_RULES) {
    let matchCount = 0;
    for (const keyword of rule.keywords) {
      if (lowerDesc.includes(keyword.toLowerCase())) {
        matchCount++;
      }
    }

    if (matchCount > 0) {
      suggestions.push({
        category: rule.category,
        confidence: Math.min(matchCount * 0.3, 1),
      });
    }
  }

  return suggestions.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Add custom category rule
 * @param category - Category name
 * @param keywords - Array of keywords
 */
export function addCategoryRule(category: string, keywords: string[]): void {
  const existingRule = CATEGORY_RULES.find((r) => r.category === category);

  if (existingRule) {
    // Add to existing keywords
    existingRule.keywords.push(...keywords);
  } else {
    // Create new rule
    CATEGORY_RULES.push({ category, keywords });
  }
}
