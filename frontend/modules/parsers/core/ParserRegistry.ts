import { BankParser } from './ParserInterface';

/**
 * Central registry for all bank parsers
 * Allows dynamic registration and discovery of parsers
 */
class ParserRegistry {
  private parsers: Map<string, BankParser> = new Map();

  /**
   * Register a new parser
   * @param parser - The parser to register
   */
  register(parser: BankParser): void {
    if (this.parsers.has(parser.id)) {
      console.warn(`Parser with id "${parser.id}" already registered. Overwriting.`);
    }
    this.parsers.set(parser.id, parser);
    console.log(`Registered parser: ${parser.name} (${parser.id})`);
  }

  /**
   * Unregister a parser
   * @param parserId - The ID of the parser to unregister
   */
  unregister(parserId: string): boolean {
    return this.parsers.delete(parserId);
  }

  /**
   * Get a parser by ID
   * @param parserId - The parser ID
   * @returns BankParser | undefined
   */
  getParser(parserId: string): BankParser | undefined {
    return this.parsers.get(parserId);
  }

  /**
   * Get all registered parsers
   * @returns BankParser[]
   */
  getAllParsers(): BankParser[] {
    return Array.from(this.parsers.values());
  }

  /**
   * Find compatible parser for a given file
   * @param file - The file to check
   * @returns Promise<BankParser | null>
   */
  async findCompatibleParser(file: File): Promise<BankParser | null> {
    for (const parser of this.parsers.values()) {
      const isSupported = await parser.supports(file);
      if (isSupported) {
        return parser;
      }
    }
    return null;
  }

  /**
   * Get parsers by bank name
   * @param bankName - The bank name to filter by
   * @returns BankParser[]
   */
  getParsersByBank(bankName: string): BankParser[] {
    return Array.from(this.parsers.values()).filter(
      (parser) => parser.bankName.toLowerCase() === bankName.toLowerCase()
    );
  }

  /**
   * Get parsers by supported format
   * @param format - File format (e.g., 'csv', 'pdf')
   * @returns BankParser[]
   */
  getParsersByFormat(format: string): BankParser[] {
    return Array.from(this.parsers.values()).filter((parser) =>
      parser.supportedFormats.includes(format.toLowerCase())
    );
  }

  /**
   * Clear all registered parsers
   */
  clear(): void {
    this.parsers.clear();
  }

  /**
   * Get count of registered parsers
   */
  get count(): number {
    return this.parsers.size;
  }
}

// Singleton instance
export const parserRegistry = new ParserRegistry();

export default parserRegistry;
