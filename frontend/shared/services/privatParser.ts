import { formatDateForHash } from '../utils/dateHelpers';

export interface ParsedTransaction {
  date: Date;
  description: string;
  amount: number; // Absolute value
  currency: string;
  type: 'income' | 'expense';
  hash: string; // For duplicate detection
}

export interface PrivatStatementData {
  period: string;
  cardNumber: string;
  transactions: ParsedTransaction[];
}

/**
 * Parse Privat Bank statement PDF and extract transactions
 */
export async function parsePrivatPDF(
  fileBuffer: Buffer
): Promise<PrivatStatementData> {
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

    console.log('[Privat Parser] First 500 chars of text:', text.substring(0, 500));
    console.log('[Privat Parser] Text contains lines:', text.split('\n').length);

    // Extract card number (format: 545708******2220)
    const cardMatch = text.match(/(\d{6}\*+\d{4})/);
    const cardNumber = cardMatch ? cardMatch[1] : '';
    console.log('[Privat Parser] Card number:', cardNumber);

    // Extract period from "from 25.06.2025"
    const periodMatch = text.match(/from\s+(\d{2}\.\d{2}\.\d{4})/);
    const period = periodMatch ? periodMatch[1] : '';
    console.log('[Privat Parser] Period:', period);

    // Parse transactions
    const transactions = parseTransactions(text);
    console.log('[Privat Parser] Found transactions:', transactions.length);

    return {
      period,
      cardNumber,
      transactions,
    };
  } catch (error) {
    console.error('Error parsing Privat Bank PDF:', error);
    console.error('Error name:', (error as Error)?.name);
    console.error('Error message:', (error as Error)?.message);
    console.error('Error stack:', (error as Error)?.stack);
    throw error;
  }
}

/**
 * Parse transactions from PDF text
 * Format:
 * 22.11.2025
 * 20:35
 * 545708******2220
 * Contract No. SAMDNWFC000129164
 * 316
 * from 25.06.2025
 * KYIVSKYI METROPOLITEN,
 * KYIV
 * -8,00
 * UAH -8,00 0,00 0,00 545,55
 */
function parseTransactions(text: string): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];

  // Split text into lines
  const lines = text.split('\n').map(line => line.trim());

  console.log('[Privat Parser] Total lines to parse:', lines.length);
  console.log('[Privat Parser] First 10 lines:', lines.slice(0, 10));

  let i = 0;
  let dateMatchCount = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Look for date pattern (DD.MM.YYYY)
    const dateMatch = line.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);

    if (dateMatch) {
      dateMatchCount++;
      console.log('[Privat Parser] Found date at line', i, ':', line);
      console.log('[Privat Parser] Next 15 lines:', lines.slice(i + 1, i + 16));
      const [, day, month, year] = dateMatch;

      // Next line should be time (HH:MM)
      if (i + 1 < lines.length) {
        const timeMatch = lines[i + 1].match(/^(\d{2}):(\d{2})$/);

        if (!timeMatch) {
          console.log('[Privat Parser] No time match for line', i + 1, ':', lines[i + 1]);
        }

        if (timeMatch) {
          const [, hour, minute] = timeMatch;

          // Skip card number and contract lines
          let descriptionStart = i + 2;

          // Skip lines that look like card numbers or contract numbers
          // These appear in order: card -> contract -> reference -> from date
          while (descriptionStart < lines.length) {
            const skipLine = lines[descriptionStart];
            if (
              skipLine.match(/^\d{6}\*+\d{4}$/) ||                    // Card number: 545708******2220
              skipLine.match(/^Contract No\./i) ||                     // Contract: Contract No. ...
              skipLine.includes('Contract No.') ||                     // Contract (if part of longer line)
              skipLine.match(/^\d{1,4}$/) ||                          // Reference number: 316
              skipLine.match(/^from\s+\d{2}\.\d{2}\.\d{4}$/i) ||      // From date: from 25.06.2025 (ONLY date after "from")
              skipLine.match(/SAMDNWFC\d+/)                           // Contract number pattern
            ) {
              console.log('[Privat Parser] Skipping line:', skipLine);
              descriptionStart++;
            } else {
              break;
            }
          }

          console.log('[Privat Parser] Description starts at line', descriptionStart, ':', lines[descriptionStart]);

          // Collect description lines until we hit amount
          let description = '';
          let j = descriptionStart;
          let foundAmount = false;

          while (j < lines.length && j < descriptionStart + 20) {
            const currentLine = lines[j];

            // Check if this is the amount line (format: -8,00 or +8,00 or 1 000,00 with spaces)
            // OR if the line contains text followed by amount (e.g., "from ANDRII KURTYSHANOV 300,00")
            const amountOnlyMatch = currentLine.match(/^([-+]?\d+(?:\s\d{3})*,\d{2})$/);
            const textWithAmountMatch = currentLine.match(/^(.+?)\s+([-+]?\d+(?:\s\d{3})*,\d{2})$/);

            if (amountOnlyMatch || textWithAmountMatch) {
              // If line has text + amount, add text to description
              if (textWithAmountMatch) {
                if (description) {
                  description += ' ' + textWithAmountMatch[1];
                } else {
                  description = textWithAmountMatch[1];
                }
              }

              const amountStr = (amountOnlyMatch ? amountOnlyMatch[1] : textWithAmountMatch![2]).replace(/\s/g, ''); // Remove spaces from amount

              // Next line should be currency code (e.g., "UAH")
              if (j + 1 < lines.length) {
                const currencyLine = lines[j + 1];
                const currencyMatch = currencyLine.match(/^([A-Z]{3})$/);

                if (currencyMatch) {
                  const currency = currencyMatch[1];

                  // Parse date and time
                  const date = new Date(
                    parseInt(year),
                    parseInt(month) - 1,
                    parseInt(day),
                    parseInt(hour),
                    parseInt(minute)
                  );

                  // Parse amount (replace comma with dot for parsing)
                  const parsedAmountStr = amountStr.replace(',', '.');
                  const amountValue = parseFloat(parsedAmountStr);
                  const amount = Math.abs(amountValue);
                  const type: 'income' | 'expense' = amountValue < 0 ? 'expense' : 'income';

                  // Clean up description: remove extra spaces and commas
                  const cleanDescription = description.trim().replace(/,\s*$/, '');

                  // Create unique hash for duplicate detection
                  const hash = createTransactionHash(date, cleanDescription, amount, currency);

                  console.log('[Privat Parser] ✅ Successfully parsed transaction:', {
                    lineNumber: i,
                    date: date.toISOString(),
                    description: cleanDescription,
                    amount,
                    currency,
                    type
                  });

                  transactions.push({
                    date,
                    description: cleanDescription,
                    amount,
                    currency,
                    type,
                    hash,
                  });

                  foundAmount = true;
                  i = j + 1; // Skip to after currency line
                  break;
                }
              }
            } else if (currentLine && !currentLine.match(/^\d{2}\.\d{2}\.\d{4}$/)) {
              // Add to description if it's not a new date
              if (description) {
                description += ' ' + currentLine;
              } else {
                description = currentLine;
              }
            }

            j++;
          }

          if (!foundAmount) {
            console.log('[Privat Parser] ❌ Could not find amount for transaction starting at line', i);
            console.log('[Privat Parser] Description collected:', description);
            console.log('[Privat Parser] Checked lines from', descriptionStart, 'to', Math.min(descriptionStart + 20, lines.length - 1));
            i++;
            continue;
          }
        } else {
          console.log('[Privat Parser] ❌ No time match after date at line', i);
        }
      }
    }

    i++;
  }

  console.log('[Privat Parser] Date matches found:', dateMatchCount);
  console.log('[Privat Parser] Transactions parsed:', transactions.length);

  return transactions;
}

/**
 * Create a unique hash for transaction duplicate detection
 * Hash combines: date + description + amount + currency
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
