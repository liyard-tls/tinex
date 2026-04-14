export type ImportSourceType = 'csv' | 'pdf' | 'api';
export type ImportStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface ImportSource {
  id: string;
  userId: string;
  name: string; // Bank name or custom name
  type: ImportSourceType;
  parserId: string; // Which parser to use
  lastImportDate?: Date;
  totalImports: number;
  isActive: boolean;
  config?: Record<string, any>; // Parser-specific configuration
  createdAt: Date;
  updatedAt: Date;
}

export interface ImportJob {
  id: string;
  userId: string;
  sourceId: string;
  fileName: string;
  fileUrl: string;
  status: ImportStatus;
  totalRecords: number;
  processedRecords: number;
  failedRecords: number;
  errors?: ImportError[];
  createdAt: Date;
  completedAt?: Date;
}

export interface ImportError {
  row: number;
  field?: string;
  message: string;
  data?: any;
}

export interface ParsedTransaction {
  amount: number;
  type: 'income' | 'expense';
  description: string;
  date: Date;
  merchantName?: string;
  categoryGuess?: string; // AI/rule-based category suggestion
  rawData?: Record<string, any>; // Original parsed data
}
