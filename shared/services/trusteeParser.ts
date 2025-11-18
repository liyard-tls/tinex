import { formatDateForHash } from '../utils/dateHelpers';

export interface ParsedTransaction {
  date: Date;
  description: string;
  amount: number; // Absolute value
  currency: string;
  type: 'income' | 'expense';
  hash: string; // For duplicate detection
}

export interface TrusteeStatementData {
  period: string;
  cardNumber: string;
  transactions: ParsedTransaction[];
}

/**
 * Parse Trustee bank statement PDF and extract transactions
 */
export async function parseTrusteePDF(
  fileBuffer: Buffer
): Promise<TrusteeStatementData> {
  try {
    // Use require for CommonJS module (pdf-parse v1.1.1)
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pdf = require('pdf-parse');

    console.log('PDF parse function type:', typeof pdf);
    console.log('Buffer type:', fileBuffer instanceof Buffer);
    console.log('Buffer length:', fileBuffer?.length);

    const data = await pdf(fileBuffer);

    console.log('PDF parsed successfully');
    console.log('Text length:', data.text?.length);

    const text = data.text;

    // Extract period
    const periodMatch = text.match(/Per Period:\s*(\d{4}\.\d{2}\.\d{2}\s*-\s*\d{4}\.\d{2}\.\d{2})/);
    const period = periodMatch ? periodMatch[1] : '';

    // Extract card number
    const cardMatch = text.match(/Card number:\s*(\*+\d+)/);
    const cardNumber = cardMatch ? cardMatch[1] : '';

    // Parse transactions
    const transactions = parseTransactions(text);

    return {
      period,
      cardNumber,
      transactions,
    };
  } catch (error) {
    console.error('Error parsing Trustee PDF:', error);
    console.error('Error name:', (error as Error)?.name);
    console.error('Error message:', (error as Error)?.message);
    console.error('Error stack:', (error as Error)?.stack);
    throw error; // Throw original error to see full details
  }
}

/**
 * Parse transactions from PDF text
 */
function parseTransactions(text: string): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];

  // Split text into lines
  const lines = text.split('\n');

  // Find the start of transactions table (after "Sum" header)
  let inTransactionSection = false;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();

    // Detect start of transaction section
    if (line.includes('Date and time of') || line.includes('operation')) {
      inTransactionSection = true;
      i++;
      continue;
    }

    // Stop at footer
    if (line.includes('The document is electronically generated')) {
      break;
    }

    if (inTransactionSection && line) {
      // Try to parse transaction line
      // Format: "2025.11.01, 15:41147 VELMART 31 KIEV UKR-2.18 EUR"
      // Note: No space between time and description in actual PDF
      const transactionMatch = line.match(
        /^(\d{4}\.\d{2}\.\d{2}),\s*(\d{2}:\d{2})(.+?)([-+]?\d+\.?\d*)\s+([A-Z]{3})$/
      );

      if (transactionMatch) {
        const [, dateStr, timeStr, description, amountStr, currency] = transactionMatch;

        // Parse date and time
        const [year, month, day] = dateStr.split('.').map(Number);
        const [hour, minute] = timeStr.split(':').map(Number);
        const date = new Date(year, month - 1, day, hour, minute);

        // Parse amount (negative means expense)
        const amountValue = parseFloat(amountStr);
        const amount = Math.abs(amountValue);
        const type: 'income' | 'expense' = amountValue < 0 ? 'expense' : 'income';

        // Create unique hash for duplicate detection
        const hash = createTransactionHash(date, description.trim(), amount, currency);

        transactions.push({
          date,
          description: description.trim(),
          amount,
          currency,
          type,
          hash,
        });
      } else {
        // Handle multi-line descriptions (some transactions span multiple lines)
        const multiLineMatch = line.match(/^(\d{4}\.\d{2}\.\d{2}),\s*(\d{2}:\d{2})(.+)$/);
        if (multiLineMatch) {
          const [, dateStr, timeStr, descStart] = multiLineMatch;

          // Look ahead for amount and currency on next line(s)
          // Increased from 3 to 10 lines to handle very long descriptions
          let fullDescription = descStart;
          let j = i + 1;
          let foundAmount = false;

          while (j < lines.length && j < i + 10) {
            const nextLine = lines[j].trim();

            // Stop if we hit another transaction or footer
            if (nextLine.match(/^\d{4}\.\d{2}\.\d{2},\s*\d{2}:\d{2}/) ||
                nextLine.includes('The document is electronically generated')) {
              break;
            }

            const amountMatch = nextLine.match(/^(.+?)\s+([-+]?\d+\.?\d*)\s+([A-Z]{3})$/);

            if (amountMatch) {
              const [, descEnd, amountStr, currency] = amountMatch;
              fullDescription += ' ' + descEnd;

              // Parse date and time
              const [year, month, day] = dateStr.split('.').map(Number);
              const [hour, minute] = timeStr.split(':').map(Number);
              const date = new Date(year, month - 1, day, hour, minute);

              // Parse amount
              const amountValue = parseFloat(amountStr);
              const amount = Math.abs(amountValue);
              const type: 'income' | 'expense' = amountValue < 0 ? 'expense' : 'income';

              // Create unique hash
              const hash = createTransactionHash(date, fullDescription.trim(), amount, currency);

              transactions.push({
                date,
                description: fullDescription.trim(),
                amount,
                currency,
                type,
                hash,
              });

              foundAmount = true;
              i = j; // Skip processed lines
              break;
            } else if (nextLine) {
              fullDescription += ' ' + nextLine;
            }
            j++;
          }

          if (!foundAmount) {
            // If we didn't find amount, just continue
            i++;
            continue;
          }
        }
      }
    }

    i++;
  }

  return transactions;
}

/**
 * Create a unique hash for transaction duplicate detection
 * Hash combines: date + description + amount + currency
 * IMPORTANT: Uses local date/time string (not UTC) to match exactly what's in the PDF
 */
function createTransactionHash(
  date: Date,
  description: string,
  amount: number,
  currency: string
): string {
  // Format date as YYYY-MM-DD HH:MM (local time, matching PDF format)
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

/**
 * Convert currency to user's account currency if needed
 */
export function normalizeAmount(amount: number, fromCurrency: string, toCurrency: string): number {
  // For now, return as-is if currencies match
  // In future, can integrate with currency conversion service
  if (fromCurrency === toCurrency) {
    return amount;
  }

  // Return original amount (will need conversion service)
  return amount;
}
