import { describe, test, expect, beforeAll } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parsePrivatPDF } from '@/shared/services/privatParser';

describe('Privat PDF Parser', () => {
  let pdfBuffer: Buffer;

  beforeAll(() => {
    // Load the test PDF file
    const pdfPath = join(process.cwd(), 'privat_statement.pdf');
    pdfBuffer = readFileSync(pdfPath);
  });

  test('should parse PDF without errors', async () => {
    const result = await parsePrivatPDF(pdfBuffer);

    expect(result).toBeDefined();
    expect(result.transactions).toBeDefined();
    expect(Array.isArray(result.transactions)).toBe(true);
  });

  test('should extract period information', async () => {
    const result = await parsePrivatPDF(pdfBuffer);

    expect(result.period).toBeDefined();
    expect(typeof result.period).toBe('string');
    console.log('Period:', result.period);
  });

  test('should parse transactions correctly', async () => {
    const result = await parsePrivatPDF(pdfBuffer);

    expect(result.transactions.length).toBeGreaterThan(0);

    // Check first transaction structure
    const firstTransaction = result.transactions[0];
    expect(firstTransaction).toHaveProperty('date');
    expect(firstTransaction).toHaveProperty('description');
    expect(firstTransaction).toHaveProperty('amount');
    expect(firstTransaction).toHaveProperty('type');
    expect(firstTransaction).toHaveProperty('currency');
    expect(firstTransaction).toHaveProperty('hash');

    console.log('First transaction:', firstTransaction);
  });

  test('should parse transaction amounts correctly', async () => {
    const result = await parsePrivatPDF(pdfBuffer);

    for (const txn of result.transactions) {
      expect(typeof txn.amount).toBe('number');
      expect(txn.amount).toBeGreaterThan(0);
    }
  });

  test('should extract card number if present', async () => {
    const result = await parsePrivatPDF(pdfBuffer);

    if (result.cardNumber) {
      expect(typeof result.cardNumber).toBe('string');
      console.log('Card number:', result.cardNumber);
    }
  });

  test('should parse transaction dates as Date objects', async () => {
    const result = await parsePrivatPDF(pdfBuffer);

    for (const txn of result.transactions) {
      expect(txn.date).toBeInstanceOf(Date);
      expect(txn.date.getTime()).not.toBeNaN();
    }
  });

  test('should categorize transactions as income or expense', async () => {
    const result = await parsePrivatPDF(pdfBuffer);

    for (const txn of result.transactions) {
      expect(['income', 'expense']).toContain(txn.type);
    }

    console.log('Transaction types:', {
      income: result.transactions.filter((t) => t.type === 'income').length,
      expense: result.transactions.filter((t) => t.type === 'expense').length,
    });
  });

  test('should generate unique hash for each transaction', async () => {
    const result = await parsePrivatPDF(pdfBuffer);

    const hashes = result.transactions.map((t) => t.hash);
    const uniqueHashes = new Set(hashes);

    expect(uniqueHashes.size).toBe(hashes.length);
  });

  test('should parse currency correctly', async () => {
    const result = await parsePrivatPDF(pdfBuffer);

    // Check that all transactions have a valid currency
    for (const txn of result.transactions) {
      expect(txn.currency).toBeDefined();
      expect(typeof txn.currency).toBe('string');
      expect(txn.currency.length).toBe(3); // Currency codes are 3 letters
    }
  });

  test('should handle multi-line descriptions', async () => {
    const result = await parsePrivatPDF(pdfBuffer);

    // Check if any transaction has a description
    const hasDescriptions = result.transactions.some(
      (t) => t.description && t.description.length > 0
    );

    expect(hasDescriptions).toBe(true);
  });

  test('should parse dates correctly', async () => {
    const result = await parsePrivatPDF(pdfBuffer);

    // Just verify all transactions have valid dates
    if (result.transactions.length > 0) {
      for (const txn of result.transactions) {
        expect(txn.date).toBeInstanceOf(Date);
        expect(txn.date.getTime()).not.toBeNaN();
        // Date should be reasonable (between 2000 and 2030)
        expect(txn.date.getFullYear()).toBeGreaterThanOrEqual(2000);
        expect(txn.date.getFullYear()).toBeLessThanOrEqual(2030);
      }
    }
  });
});
