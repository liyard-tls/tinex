/**
 * QIF (Quicken Interchange Format) Parser
 *
 * Parses QIF files exported from HomeBank and similar applications.
 *
 * QIF Format Reference:
 * - !Account - Account header
 * - N - Account name
 * - T - Account type (Bank, Cash, etc.)
 * - ^ - End of record
 * - !Type:Bank or !Type:Cash - Transaction type header
 * - D - Date (YYYY/MM/DD)
 * - T - Amount (negative = expense, positive = income)
 * - C - Cleared status
 * - P - Payee
 * - M - Memo/Description
 * - L - Category (or [AccountName] for transfers)
 */

export interface QIFAccount {
  name: string;
  type: string; // Bank, Cash, etc.
}

export interface QIFTransaction {
  date: Date;
  amount: number;
  payee: string;
  memo: string;
  category: string;
  isTransfer: boolean;
  transferAccount?: string; // If transfer, the target account name
  type: 'income' | 'expense';
  hash: string;
}

export interface QIFAccountData {
  account: QIFAccount;
  transactions: QIFTransaction[];
}

export interface QIFParseResult {
  accounts: QIFAccountData[];
  totalTransactions: number;
}

/**
 * Generate a unique hash for transaction duplicate detection
 */
function generateHash(accountName: string, date: Date, amount: number, memo: string): string {
  const str = `${accountName}|${date.toISOString().split('T')[0]}|${amount}|${memo}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `qif-${Math.abs(hash).toString(16)}`;
}

/**
 * Parse a QIF date string (YYYY/MM/DD format)
 */
function parseQIFDate(dateStr: string): Date {
  // Format: YYYY/MM/DD
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // JS months are 0-indexed
    const day = parseInt(parts[2], 10);
    return new Date(year, month, day, 12, 0, 0); // Set to noon to avoid timezone issues
  }
  return new Date(dateStr);
}

/**
 * Check if category represents a transfer to another account
 * Transfers are marked as [AccountName] in QIF format
 */
function isTransferCategory(category: string): boolean {
  return category.startsWith('[') && category.endsWith(']');
}

/**
 * Extract account name from transfer category
 */
function extractTransferAccount(category: string): string {
  if (isTransferCategory(category)) {
    return category.slice(1, -1); // Remove [ and ]
  }
  return '';
}

/**
 * Parse QIF file content
 */
export function parseQIF(content: string): QIFParseResult {
  const lines = content.split('\n').map(line => line.trim());
  const accounts: QIFAccountData[] = [];

  let currentAccount: QIFAccount | null = null;
  let currentTransactions: QIFTransaction[] = [];
  let inTransaction = false;

  // Current transaction being built
  let txDate = '';
  let txAmount = 0;
  let txPayee = '';
  let txMemo = '';
  let txCategory = '';

  const resetTransaction = () => {
    txDate = '';
    txAmount = 0;
    txPayee = '';
    txMemo = '';
    txCategory = '';
  };

  const saveTransaction = () => {
    if (txDate && currentAccount) {
      const date = parseQIFDate(txDate);
      const isTransfer = isTransferCategory(txCategory);
      const transferAccount = isTransfer ? extractTransferAccount(txCategory) : undefined;

      // Skip "(null)" memos
      const cleanMemo = txMemo === '(null)' ? '' : txMemo;

      // Determine description: prefer memo, fallback to payee
      const description = cleanMemo || txPayee || 'No description';

      const transaction: QIFTransaction = {
        date,
        amount: Math.abs(txAmount),
        payee: txPayee,
        memo: cleanMemo,
        category: isTransfer ? '' : txCategory,
        isTransfer,
        transferAccount,
        type: txAmount >= 0 ? 'income' : 'expense',
        hash: generateHash(currentAccount.name, date, txAmount, description),
      };

      currentTransactions.push(transaction);
    }
    resetTransaction();
  };

  const saveAccount = () => {
    if (currentAccount && currentTransactions.length > 0) {
      accounts.push({
        account: currentAccount,
        transactions: [...currentTransactions],
      });
    }
    currentTransactions = [];
  };

  for (const line of lines) {
    if (!line) continue;

    // Account header
    if (line === '!Account') {
      // Save previous account if exists
      if (inTransaction) {
        saveTransaction();
      }
      saveAccount();
      currentAccount = { name: '', type: '' };
      inTransaction = false;
      continue;
    }

    // Transaction type header
    if (line.startsWith('!Type:')) {
      inTransaction = true;
      continue;
    }

    // End of record
    if (line === '^') {
      if (inTransaction && txDate) {
        saveTransaction();
      }
      continue;
    }

    const code = line[0];
    const value = line.slice(1);

    if (!inTransaction && currentAccount) {
      // Account fields
      switch (code) {
        case 'N':
          currentAccount.name = value;
          break;
        case 'T':
          currentAccount.type = value;
          break;
      }
    } else if (inTransaction) {
      // Transaction fields
      switch (code) {
        case 'D':
          txDate = value;
          break;
        case 'T':
          txAmount = parseFloat(value) || 0;
          break;
        case 'P':
          txPayee = value;
          break;
        case 'M':
          txMemo = value;
          break;
        case 'L':
          txCategory = value;
          break;
      }
    }
  }

  // Save last transaction and account
  if (inTransaction && txDate) {
    saveTransaction();
  }
  saveAccount();

  const totalTransactions = accounts.reduce((sum, acc) => sum + acc.transactions.length, 0);

  return {
    accounts,
    totalTransactions,
  };
}

/**
 * Read and parse a QIF file
 */
export async function parseQIFFile(file: File): Promise<QIFParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const result = parseQIF(content);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read QIF file'));
    };

    reader.readAsText(file);
  });
}
