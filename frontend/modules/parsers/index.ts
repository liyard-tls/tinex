// Core parser infrastructure
export * from './core/ParserInterface';
export { parserRegistry } from './core/ParserRegistry';
export { ParserFactory } from './core/ParserFactory';

// Parser implementations
export * from './implementations/csv';
export * from './implementations/qif';

// Utilities
export * from './utils/dateNormalizer';
export * from './utils/amountParser';
export * from './utils/categoryDetector';

// Initialize and register default parsers
import { parserRegistry } from './core/ParserRegistry';
import { GenericCSVParser } from './implementations/csv';

// Auto-register parsers when module is imported
export function initializeParsers() {
  // Register generic CSV parser
  parserRegistry.register(new GenericCSVParser());

  // Register bank-specific parsers here as they are implemented
  // parserRegistry.register(new ChaseCSVParser());
  // parserRegistry.register(new WellsFargoCSVParser());

  console.log(`Initialized ${parserRegistry.count} parser(s)`);
}

// Auto-initialize
if (typeof window !== 'undefined') {
  initializeParsers();
}
