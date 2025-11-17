'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import BottomNav from '@/shared/components/layout/BottomNav';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/components/ui/Card';
import { Button } from '@/shared/components/ui';
import { Upload, FileText, AlertCircle } from 'lucide-react';
import { ParsedTransaction, TrusteeStatementData } from '@/shared/services/trusteeParser';
import { accountRepository } from '@/core/repositories/AccountRepository';
import { Account } from '@/core/models';
import { cn } from '@/shared/utils/cn';

export default function ImportPage() {
  const [user, setUser] = useState<{ uid: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [importing, setImporting] = useState(false);
  const [file, setFile] = useState<File | null>(null);
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

  const loadAccounts = async (userId: string) => {
    try {
      const userAccounts = await accountRepository.getByUserId(userId);
      setAccounts(userAccounts);

      // Pre-select first EUR account if available
      const eurAccount = userAccounts.find(acc => acc.currency === 'EUR');
      if (eurAccount) {
        setSelectedAccount(eurAccount.id);
      } else if (userAccounts.length > 0) {
        setSelectedAccount(userAccounts[0].id);
      }
    } catch (error) {
      console.error('Failed to load accounts:', error);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== 'application/pdf') {
        setError('Please select a PDF file');
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
      // Create form data with the file
      const formData = new FormData();
      formData.append('file', file);

      // Call API to parse PDF (server-side)
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
      const transactions = statementData.transactions.map(txn => ({
        ...txn,
        date: new Date(txn.date),
      }));

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
            Import transactions from Trustee bank statements (PDF format)
          </p>
        </div>

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
            <CardDescription>Select a Trustee PDF statement file to import</CardDescription>
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
                    {file ? file.name : 'Choose PDF file'}
                  </span>
                  <input
                    id="file-upload"
                    type="file"
                    accept="application/pdf"
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
              <li>Select the account to import transactions into</li>
              <li>Upload your Trustee bank statement PDF file</li>
              <li>Click "Parse File" to extract transactions</li>
              <li>Review the preview and click "Import" to add transactions</li>
              <li>Duplicate transactions will be automatically skipped</li>
              <li>You can assign categories and tags to imported transactions later</li>
            </ol>
          </CardContent>
        </Card>
      </div>

      <BottomNav />
    </div>
  );
}
