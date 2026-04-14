import Papa from 'papaparse';
import { BankParser, ParserConfig, ValidationResult } from '../../core/ParserInterface';
import { ParsedTransaction } from '@/core/models';
import { parseFlexibleDate } from '../../utils/dateNormalizer';
import { parseAmount, determineTransactionType, getAbsoluteAmount } from '../../utils/amountParser';
import { detectCategory } from '../../utils/categoryDetector';

interface CSVRow {
  [key: string]: string;
}

export class GenericCSVParser implements BankParser {
  readonly id = 'generic-csv';
  readonly name = 'Generic CSV Parser';
  readonly bankName = 'Generic';
  readonly supportedFormats = ['csv'];

  config: ParserConfig = {
    dateColumn: 'Date',
    amountColumn: 'Amount',
    descriptionColumn: 'Description',
    dateFormat: undefined,
    hasHeader: true,
    delimiter: ',',
  };

  constructor(config?: Partial<ParserConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  async supports(file: File): Promise<boolean> {
    // Check file extension
    if (!file.name.toLowerCase().endsWith('.csv')) {
      return false;
    }

    // Try to parse first few lines to validate CSV format
    try {
      const text = await this.readFileAsText(file, 1024);
      const result = Papa.parse(text, {
        delimiter: this.config.delimiter,
        preview: 2,
      });

      return result.data.length > 0 && !result.errors.length;
    } catch {
      return false;
    }
  }

  async parse(file: File): Promise<ParsedTransaction[]> {
    const text = await this.readFileAsText(file);

    return new Promise((resolve, reject) => {
      Papa.parse<CSVRow>(text, {
        header: this.config.hasHeader,
        delimiter: this.config.delimiter,
        skipEmptyLines: true,
        complete: (results) => {
          try {
            const transactions = this.parseRows(results.data);
            resolve(transactions);
          } catch (error) {
            reject(error);
          }
        },
        error: (error: any) => {
          reject(new Error(`CSV parsing error: ${error.message}`));
        },
      });
    });
  }

  validate(transactions: ParsedTransaction[]): ValidationResult {
    const errors: any[] = [];
    const warnings: any[] = [];

    if (transactions.length === 0) {
      errors.push({
        message: 'No transactions found in file',
      });
    }

    transactions.forEach((transaction, index) => {
      if (!transaction.date || isNaN(transaction.date.getTime())) {
        errors.push({
          row: index + 1,
          field: 'date',
          message: 'Invalid or missing date',
        });
      }

      if (transaction.amount === 0) {
        warnings.push({
          row: index + 1,
          message: 'Transaction amount is zero',
        });
      }

      if (!transaction.description || transaction.description.trim() === '') {
        warnings.push({
          row: index + 1,
          message: 'Missing description',
        });
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  getFormatDescription(): string {
    return `Generic CSV format with columns: ${this.config.dateColumn}, ${this.config.amountColumn}, ${this.config.descriptionColumn}`;
  }

  private parseRows(rows: CSVRow[]): ParsedTransaction[] {
    const transactions: ParsedTransaction[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      try {
        const transaction = this.parseRow(row);
        if (transaction) {
          transactions.push(transaction);
        }
      } catch (error) {
        console.warn(`Failed to parse row ${i + 1}:`, error);
        // Continue parsing other rows
      }
    }

    return transactions;
  }

  private parseRow(row: CSVRow): ParsedTransaction | null {
    const dateStr = row[this.config.dateColumn!];
    const amountStr = row[this.config.amountColumn!];
    const description = row[this.config.descriptionColumn!];

    // Parse date
    const date = parseFlexibleDate(dateStr, this.config.dateFormat);
    if (!date) {
      throw new Error(`Invalid date: ${dateStr}`);
    }

    // Parse amount
    const amount = parseAmount(amountStr);
    if (amount === null) {
      throw new Error(`Invalid amount: ${amountStr}`);
    }

    // Determine transaction type
    const type = determineTransactionType(amount);

    // Detect category
    const categoryGuess = detectCategory(description);

    return {
      date,
      amount: getAbsoluteAmount(amount),
      type,
      description: description?.trim() || 'Unknown',
      merchantName: description?.trim(),
      categoryGuess: categoryGuess || undefined,
      rawData: row,
    };
  }

  private readFileAsText(file: File, maxLength?: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        const text = e.target?.result as string;
        resolve(maxLength ? text.substring(0, maxLength) : text);
      };

      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };

      if (maxLength) {
        reader.readAsText(file.slice(0, maxLength));
      } else {
        reader.readAsText(file);
      }
    });
  }
}
