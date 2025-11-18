'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import BottomNav from '@/shared/components/layout/BottomNav';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/components/ui/Card';
import { Button } from '@/shared/components/ui';
import { Upload, FileText, AlertCircle } from 'lucide-react';
import { ParsedTransaction as TrusteeParsedTransaction, TrusteeStatementData } from '@/shared/services/trusteeParser';
import { ParsedTransaction as MonobankParsedTransaction, parseMonobankCSV } from '@/shared/services/monobankParser';
import { accountRepository } from '@/core/repositories/AccountRepository';
import { Account } from '@/core/models';
import { cn } from '@/shared/utils/cn';

// Unified interface
type ParsedTransaction = TrusteeParsedTransaction | MonobankParsedTransaction;
type BankType = 'trustee' | 'monobank';

export default function ImportPage() {
  const [user, setUser] = useState<{ uid: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [importing, setImporting] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [bankType, setBankType] = useState<BankType>('trustee');
  const [parsedTransactions, setParsedTransactions] = useState<ParsedTransaction[]>([]);
  const [error, setError] = useState<string>('');
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser({ uid: currentUser.uid });
        await loadAccounts(currentUser.uid);
      } else {
        router.push('/auth');
      }
      setLoading(false);
    });

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // Update account selection when bank type changes
  useEffect(() => {
    if (user) {
      loadAccounts(user.uid);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bankType]);

  const loadAccounts = async (userId: string) => {
    try {
      const userAccounts = await accountRepository.getByUserId(userId);
      setAccounts(userAccounts);

      // Pre-select account based on bank type
      if (bankType === 'monobank') {
        // Pre-select UAH account for Monobank
        const uahAccount = userAccounts.find(acc => acc.currency === 'UAH');
        if (uahAccount) {
          setSelectedAccount(uahAccount.id);
        } else if (userAccounts.length > 0) {
          setSelectedAccount(userAccounts[0].id);
        }
      } else {
        // Pre-select EUR account for Trustee
        const eurAccount = userAccounts.find(acc => acc.currency === 'EUR');
        if (eurAccount) {
          setSelectedAccount(eurAccount.id);
        } else if (userAccounts.length > 0) {
          setSelectedAccount(userAccounts[0].id);
        }
      }
    } catch (error) {
      console.error('Failed to load accounts:', error);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Validate file type based on bank
      if (bankType === 'trustee' && selectedFile.type !== 'application/pdf') {
        setError('Please select a PDF file for Trustee bank');
        return;
      }
      if (bankType === 'monobank' && !selectedFile.name.endsWith('.csv')) {
        setError('Please select a CSV file for Monobank');
        return;
      }
      setFile(selectedFile);
      setError('');
      setParsedTransactions([]);
    }
  };

  const handleParseFile = async () => {
    if (!file || !user) return;

    setImporting(true);
    setError('');

    try {
      let transactions: ParsedTransaction[];

      if (bankType === 'monobank') {
        // Parse CSV client-side
        const statementData = await parseMonobankCSV(file);
        transactions = statementData.transactions;
      } else {
        // Parse PDF server-side (Trustee)
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/parse-pdf', {
          method: 'POST',
          body: formData,
        });

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || 'Failed to parse PDF');
        }

        const statementData: TrusteeStatementData = result.data;

        // Convert date strings back to Date objects
        transactions = statementData.transactions.map(txn => ({
          ...txn,
          date: new Date(txn.date),
        }));
      }

      setParsedTransactions(transactions);

      // Store in sessionStorage for preview page
      sessionStorage.setItem('parsedTransactions', JSON.stringify({
        transactions: transactions.map(t => ({
          ...t,
          date: t.date.toISOString(),
        })),
        accountId: selectedAccount,
        timestamp: Date.now(),
      }));

      setImporting(false);
    } catch (err) {
      console.error('Error parsing file:', err);
      setError(err instanceof Error ? err.message : 'Failed to parse file');
      setImporting(false);
    }
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container max-w-2xl mx-auto p-4 pb-20">
          <p className="text-center text-muted-foreground">Loading...</p>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-2xl mx-auto p-4 pb-20">
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-2">Import Transactions</h1>
          <p className="text-sm text-muted-foreground">
            Import transactions from bank statements
          </p>
        </div>

        {/* Bank Selection */}
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-base">Select Bank</CardTitle>
            <CardDescription>Choose your bank to import from</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  setBankType('trustee');
                  setFile(null);
                  setParsedTransactions([]);
                  setError('');
                  if (user) loadAccounts(user.uid);
                }}
                disabled={importing}
                className={cn(
                  'px-4 py-3 text-sm font-medium rounded-md transition-colors border-2',
                  bankType === 'trustee'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:border-primary/50'
                )}
              >
                Trustee (PDF)
              </button>
              <button
                onClick={() => {
                  setBankType('monobank');
                  setFile(null);
                  setParsedTransactions([]);
                  setError('');
                  if (user) loadAccounts(user.uid);
                }}
                disabled={importing}
                className={cn(
                  'px-4 py-3 text-sm font-medium rounded-md transition-colors border-2',
                  bankType === 'monobank'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:border-primary/50'
                )}
              >
                Monobank (CSV)
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Account Selection */}
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-base">Select Account</CardTitle>
            <CardDescription>Choose which account to import transactions into</CardDescription>
          </CardHeader>
          <CardContent>
            <select
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              disabled={importing}
            >
              <option value="">Select an account</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} ({account.currency})
                </option>
              ))}
            </select>
          </CardContent>
        </Card>

        {/* File Upload */}
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-base">Upload Statement</CardTitle>
            <CardDescription>
              {bankType === 'trustee'
                ? 'Select a Trustee PDF statement file to import'
                : 'Select a Monobank CSV export file to import'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <label
                  htmlFor="file-upload"
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed rounded-lg cursor-pointer transition-colors',
                    file
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary hover:bg-primary/5'
                  )}
                >
                  <Upload className="h-5 w-5" />
                  <span className="text-sm">
                    {file ? file.name : bankType === 'trustee' ? 'Choose PDF file' : 'Choose CSV file'}
                  </span>
                  <input
                    id="file-upload"
                    type="file"
                    accept={bankType === 'trustee' ? 'application/pdf' : '.csv'}
                    onChange={handleFileChange}
                    className="hidden"
                    disabled={importing}
                  />
                </label>
              </div>

              {file && !parsedTransactions.length && (
                <Button
                  onClick={handleParseFile}
                  disabled={!selectedAccount || importing}
                  className="w-full"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  {importing ? 'Parsing...' : 'Parse File'}
                </Button>
              )}

              {error && (
                <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Parsed Transactions Preview */}
        {parsedTransactions.length > 0 && (
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="text-base">Preview</CardTitle>
              <CardDescription>
                Found {parsedTransactions.length} transactions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
                {parsedTransactions.slice(0, 5).map((txn, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 bg-muted/50 rounded"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{txn.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {txn.date.toLocaleDateString()} {txn.date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                      </p>
                    </div>
                    <p className="text-sm font-semibold ml-2">
                      {txn.amount.toFixed(2)} {txn.currency}
                    </p>
                  </div>
                ))}
                {parsedTransactions.length > 5 && (
                  <p className="text-xs text-muted-foreground text-center">
                    + {parsedTransactions.length - 5} more transactions
                  </p>
                )}
              </div>

              <Button
                onClick={() => router.push(`/import/preview?count=${parsedTransactions.length}`)}
                className="w-full"
              >
                <FileText className="h-4 w-4 mr-2" />
                Review & Import
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Instructions</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
              <li>Select your bank (Trustee or Monobank)</li>
              <li>Select the account to import transactions into</li>
              <li>Upload your bank statement file ({bankType === 'trustee' ? 'PDF' : 'CSV'})</li>
              <li>Click "Parse File" to extract transactions</li>
              <li>Review the preview and click "Review & Import"</li>
              <li>Duplicate transactions will be automatically skipped</li>
              <li>Categories will be auto-detected based on previous transactions</li>
            </ol>
            {bankType === 'monobank' && (
              <div className="mt-4 p-3 bg-muted/50 rounded-md">
                <p className="text-xs text-muted-foreground">
                  <strong>How to export from Monobank:</strong>
                  <br />
                  1. Open Monobank app → Statement
                  <br />
                  2. Select period and account
                  <br />
                  3. Tap "Export" → Choose "CSV" format
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <BottomNav />
    </div>
  );
}
