import { BankParser } from './ParserInterface';
import { parserRegistry } from './ParserRegistry';
import { ParsedTransaction } from '@/core/models';

export class ParserFactory {
  /**
   * Parse a file using the best matching parser
   * @param file - The file to parse
   * @returns Promise<ParsedTransaction[]>
   * @throws Error if no compatible parser is found
   */
  static async parse(file: File): Promise<ParsedTransaction[]> {
    const parser = await parserRegistry.findCompatibleParser(file);

    if (!parser) {
      throw new Error(
        `No compatible parser found for file: ${file.name}. ` +
        `Supported formats: ${this.getSupportedFormats().join(', ')}`
      );
    }

    console.log(`Using parser: ${parser.name} for file: ${file.name}`);
    return parser.parse(file);
  }

  /**
   * Parse a file using a specific parser
   * @param file - The file to parse
   * @param parserId - The ID of the parser to use
   * @returns Promise<ParsedTransaction[]>
   * @throws Error if parser not found
   */
  static async parseWithParser(
    file: File,
    parserId: string
  ): Promise<ParsedTransaction[]> {
    const parser = parserRegistry.getParser(parserId);

    if (!parser) {
      throw new Error(`Parser not found: ${parserId}`);
    }

    const isSupported = await parser.supports(file);
    if (!isSupported) {
      throw new Error(
        `Parser "${parser.name}" does not support file: ${file.name}`
      );
    }

    return parser.parse(file);
  }

  /**
   * Get all supported file formats across all parsers
   * @returns string[]
   */
  static getSupportedFormats(): string[] {
    const formats = new Set<string>();
    parserRegistry.getAllParsers().forEach((parser) => {
      parser.supportedFormats.forEach((format) => formats.add(format));
    });
    return Array.from(formats);
  }

  /**
   * Get available parsers info
   * @returns Array of parser info objects
   */
  static getAvailableParsers() {
    return parserRegistry.getAllParsers().map((parser) => ({
      id: parser.id,
      name: parser.name,
      bankName: parser.bankName,
      supportedFormats: parser.supportedFormats,
      description: parser.getFormatDescription(),
    }));
  }
}

export default ParserFactory;
