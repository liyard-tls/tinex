import { ParsedTransaction } from '@/core/models';

export interface ParserConfig {
  dateFormat?: string;
  amountColumn?: string;
  descriptionColumn?: string;
  [key: string]: any;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  row?: number;
  field?: string;
  message: string;
}

export interface ValidationWarning {
  row?: number;
  message: string;
}

/**
 * Base interface that all bank parsers must implement
 * This enables plug-and-play architecture for adding new banks
 */
export interface BankParser {
  /**
   * Unique identifier for this parser
   */
  readonly id: string;

  /**
   * Human-readable name (e.g., "Chase Bank CSV Parser")
   */
  readonly name: string;

  /**
   * Bank or institution name
   */
  readonly bankName: string;

  /**
   * File types this parser supports
   */
  readonly supportedFormats: string[];

  /**
   * Optional configuration for the parser
   */
  config?: ParserConfig;

  /**
   * Check if this parser can handle the given file
   * @param file - The file to check
   * @returns Promise<boolean>
   */
  supports(file: File): Promise<boolean>;

  /**
   * Parse the file and extract transactions
   * @param file - The file to parse
   * @returns Promise<ParsedTransaction[]>
   */
  parse(file: File): Promise<ParsedTransaction[]>;

  /**
   * Validate the parsed transactions
   * @param transactions - Transactions to validate
   * @returns ValidationResult
   */
  validate(transactions: ParsedTransaction[]): ValidationResult;

  /**
   * Get example file format or template
   * @returns string - Description or example of expected format
   */
  getFormatDescription(): string;
}
