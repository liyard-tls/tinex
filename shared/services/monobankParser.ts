import Papa from 'papaparse';
import { formatDateForHash } from '../utils/dateHelpers';

export interface ParsedTransaction {
  date: Date;
  description: string;
  amount: number; // Absolute value
  currency: string;
  type: 'income' | 'expense';
  hash: string; // For duplicate detection
}

export interface MonobankStatementData {
  transactions: ParsedTransaction[];
}

/**
 * Parse Monobank CSV export and extract transactions
 *
 * CSV Format:
 * "Date and time",Description,MCC,"Card currency amount, (UAH)","Operation amount","Operation currency","Exchange rate","Commission, (UAH)","Cashback amount, (UAH)",Balance
 * "04.11.2025 17:15:38","414960****0703",4829,-318.94,-318.94,UAH,—,9.94,—,69741.62
 */
export async function parseMonobankCSV(file: File): Promise<MonobankStatementData> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const transactions = parseTransactions(results.data);
          resolve({ transactions });
        } catch (error) {
          reject(error);
        }
      },
      error: (error) => {
        reject(new Error(`Failed to parse CSV: ${error.message}`));
      },
    });
  });
}

/**
 * Parse transactions from CSV data
 */
function parseTransactions(data: Papa.ParseResult<unknown>['data']): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];

  for (const row of data) {
    try {
      // Type assertion for CSV row
      const record = row as Record<string, string>;

      // Extract fields (column names from CSV header)
      const dateTimeStr = record['Date and time'];
      const description = record['Description'];
      const amountStr = record['Card currency amount, (UAH)'];

      // Skip if essential fields are missing
      if (!dateTimeStr || !description || !amountStr) {
        continue;
      }

      // Parse date and time: "04.11.2025 17:15:38"
      const dateTime = parseMonobankDateTime(dateTimeStr);
      if (!dateTime) {
        console.warn(`Failed to parse date: ${dateTimeStr}`);
        continue;
      }

      // Parse amount (negative = expense, positive = income)
      const amountValue = parseFloat(amountStr);
      if (isNaN(amountValue)) {
        console.warn(`Failed to parse amount: ${amountStr}`);
        continue;
      }

      const amount = Math.abs(amountValue);
      const type: 'income' | 'expense' = amountValue < 0 ? 'expense' : 'income';
      const currency = 'UAH'; // Monobank uses Ukrainian Hryvnia

      // Create unique hash for duplicate detection
      const hash = createTransactionHash(dateTime, description, amount, currency);

      transactions.push({
        date: dateTime,
        description: description.trim(),
        amount,
        currency,
        type,
        hash,
      });
    } catch (error) {
      console.error('Error parsing transaction row:', row, error);
      // Continue to next row
    }
  }

  return transactions;
}

/**
 * Parse Monobank date/time format: "04.11.2025 17:15:38"
 * Returns Date object or null if parsing fails
 */
function parseMonobankDateTime(dateTimeStr: string): Date | null {
  try {
    // Format: "DD.MM.YYYY HH:MM:SS"
    const match = dateTimeStr.match(/^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/);

    if (!match) {
      return null;
    }

    const [, day, month, year, hour, minute, second] = match;

    const date = new Date(
      parseInt(year),
      parseInt(month) - 1, // Month is 0-indexed
      parseInt(day),
      parseInt(hour),
      parseInt(minute),
      parseInt(second)
    );

    // Validate date
    if (isNaN(date.getTime())) {
      return null;
    }

    return date;
  } catch (error) {
    return null;
  }
}

/**
 * Create a unique hash for transaction duplicate detection
 * Hash combines: date + description + amount + currency
 * IMPORTANT: Uses local date/time string (not UTC)
 */
function createTransactionHash(
  date: Date,
  description: string,
  amount: number,
  currency: string
): string {
  // Format date as YYYY-MM-DD HH:MM (local time)
  const dateStr = formatDateForHash(date);
  const str = `${dateStr}-${description}-${amount}-${currency}`;

  // Simple hash function
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  return hash.toString(16);
}
