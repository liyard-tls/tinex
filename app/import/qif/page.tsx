'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import BottomNav from '@/shared/components/layout/BottomNav';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/components/ui/Card';
import { Button } from '@/shared/components/ui';
import { Upload, FileText, AlertCircle, ChevronRight, ArrowLeft, Plus, X } from 'lucide-react';
import { parseQIFFile, QIFParseResult } from '@/modules/parsers/implementations/qif';
import { accountRepository } from '@/core/repositories/AccountRepository';
import { Account, CreateAccountInput } from '@/core/models';
import { cn } from '@/shared/utils/cn';
import AddAccountForm from '@/modules/accounts/AddAccountForm';

type Step = 'upload' | 'map-accounts' | 'preview';

interface AccountMapping {
  qifAccountName: string;
  qifAccountType: string;
  appAccountId: string;
  transactionCount: number;
}

export default function QIFImportPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string>('');
  const [parseResult, setParseResult] = useState<QIFParseResult | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountMappings, setAccountMappings] = useState<AccountMapping[]>([]);
  const [showCreateAccount, setShowCreateAccount] = useState(false);
  const [creatingForQifAccount, setCreatingForQifAccount] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUserId(currentUser.uid);
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
    } catch (error) {
      console.error('Failed to load accounts:', error);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.toLowerCase().endsWith('.qif')) {
        setError('Please select a QIF file');
        return;
      }
      setFile(selectedFile);
      setError('');
      setParseResult(null);
    }
  };

  const handleParseFile = async () => {
    if (!file) return;

    setParsing(true);
    setError('');

    try {
      const result = await parseQIFFile(file);

      if (result.accounts.length === 0) {
        throw new Error('No accounts found in QIF file');
      }

      setParseResult(result);

      // Initialize account mappings
      const mappings: AccountMapping[] = result.accounts.map((acc) => {
        // Try to auto-match by name
        const matchedAccount = accounts.find(
          (a) => a.name.toLowerCase() === acc.account.name.toLowerCase()
        );

        return {
          qifAccountName: acc.account.name,
          qifAccountType: acc.account.type,
          appAccountId: matchedAccount?.id || '',
          transactionCount: acc.transactions.length,
        };
      });

      setAccountMappings(mappings);
      setStep('map-accounts');
    } catch (err) {
      console.error('Error parsing QIF file:', err);
      setError(err instanceof Error ? err.message : 'Failed to parse QIF file');
    } finally {
      setParsing(false);
    }
  };

  const updateAccountMapping = (qifAccountName: string, appAccountId: string) => {
    setAccountMappings((prev) =>
      prev.map((m) =>
        m.qifAccountName === qifAccountName ? { ...m, appAccountId } : m
      )
    );
  };

  const handleCreateAccount = async (data: CreateAccountInput) => {
    if (!userId) return;

    try {
      const newAccountId = await accountRepository.create(userId, data);

      // Reload accounts
      const userAccounts = await accountRepository.getByUserId(userId);
      setAccounts(userAccounts);

      // Auto-select the new account for the QIF account we were creating for
      if (creatingForQifAccount) {
        updateAccountMapping(creatingForQifAccount, newAccountId);
      }

      setShowCreateAccount(false);
      setCreatingForQifAccount(null);
    } catch (error) {
      console.error('Failed to create account:', error);
      throw error;
    }
  };

  const openCreateAccountPanel = (qifAccountName: string) => {
    setCreatingForQifAccount(qifAccountName);
    setShowCreateAccount(true);
  };

  const handleProceedToPreview = () => {
    if (!parseResult) return;

    // Filter accounts that have mappings
    const mappedAccounts = accountMappings.filter((m) => m.appAccountId);

    if (mappedAccounts.length === 0) {
      setError('Please map at least one account');
      return;
    }

    // Store data in session storage for preview page
    const previewData = {
      accounts: parseResult.accounts
        .filter((acc) =>
          mappedAccounts.some((m) => m.qifAccountName === acc.account.name)
        )
        .map((acc) => ({
          ...acc,
          appAccountId: mappedAccounts.find(
            (m) => m.qifAccountName === acc.account.name
          )?.appAccountId,
          transactions: acc.transactions.map((t) => ({
            ...t,
            date: t.date.toISOString(),
          })),
        })),
      mappings: mappedAccounts,
      timestamp: Date.now(),
    };

    sessionStorage.setItem('qifImportData', JSON.stringify(previewData));
    router.push('/import/qif/preview');
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
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/import')}
            className="h-8 w-8 p-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Import from HomeBank</h1>
            <p className="text-sm text-muted-foreground">
              Import QIF file with multiple accounts
            </p>
          </div>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-2 mb-6">
          <div
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-full text-sm',
              step === 'upload'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            )}
          >
            <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs">
              1
            </span>
            Upload
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <div
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-full text-sm',
              step === 'map-accounts'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            )}
          >
            <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs">
              2
            </span>
            Map Accounts
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <div
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-full text-sm',
              step === 'preview'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            )}
          >
            <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs">
              3
            </span>
            Preview
          </div>
        </div>

        {/* Step 1: Upload */}
        {step === 'upload' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Upload QIF File</CardTitle>
              <CardDescription>
                Select a QIF file exported from HomeBank
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <label
                    htmlFor="file-upload"
                    className={cn(
                      'flex-1 flex items-center justify-center gap-2 px-4 py-6 border-2 border-dashed rounded-lg cursor-pointer transition-colors',
                      file
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary hover:bg-primary/5'
                    )}
                  >
                    <Upload className="h-5 w-5" />
                    <span className="text-sm">
                      {file ? file.name : 'Choose QIF file'}
                    </span>
                    <input
                      id="file-upload"
                      type="file"
                      accept=".qif"
                      onChange={handleFileChange}
                      className="hidden"
                      disabled={parsing}
                    />
                  </label>
                </div>

                {file && (
                  <Button
                    onClick={handleParseFile}
                    disabled={parsing}
                    className="w-full"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    {parsing ? 'Parsing...' : 'Parse File'}
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
        )}

        {/* Step 2: Map Accounts */}
        {step === 'map-accounts' && parseResult && (
          <>
            <Card className="mb-4">
              <CardHeader>
                <CardTitle className="text-base">Map Accounts</CardTitle>
                <CardDescription>
                  Match QIF accounts to your existing accounts. Found{' '}
                  {parseResult.accounts.length} account(s) with{' '}
                  {parseResult.totalTransactions} transactions.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {accountMappings.map((mapping) => (
                    <div
                      key={mapping.qifAccountName}
                      className="p-3 bg-muted/50 rounded-lg space-y-2"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <p className="font-medium">{mapping.qifAccountName}</p>
                          <p className="text-xs text-muted-foreground">
                            {mapping.qifAccountType} • {mapping.transactionCount}{' '}
                            transactions
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        <select
                          value={mapping.appAccountId}
                          onChange={(e) =>
                            updateAccountMapping(
                              mapping.qifAccountName,
                              e.target.value
                            )
                          }
                          className="flex-1 px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                          <option value="">Skip this account</option>
                          {accounts.map((account) => (
                            <option key={account.id} value={account.id}>
                              {account.name} ({account.currency})
                            </option>
                          ))}
                        </select>
                      </div>
                      {!mapping.appAccountId && (
                        <button
                          onClick={() => openCreateAccountPanel(mapping.qifAccountName)}
                          className="w-full flex items-center justify-center gap-2 py-2 text-sm text-primary hover:bg-primary/10 rounded-md transition-colors"
                        >
                          <Plus className="h-4 w-4" />
                          Create new account for &quot;{mapping.qifAccountName}&quot;
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {error && (
                  <div className="flex items-start gap-2 p-3 mt-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                    <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-destructive">{error}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setStep('upload')}
                className="flex-1"
              >
                Back
              </Button>
              <Button onClick={handleProceedToPreview} className="flex-1">
                Continue
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </>
        )}

        {/* Instructions */}
        {step === 'upload' && (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-base">Instructions</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                <li>Export your data from HomeBank as QIF file</li>
                <li>Upload the QIF file here</li>
                <li>Map accounts from the file to your existing accounts</li>
                <li>Preview and import transactions for each account</li>
                <li>Transfers between accounts will use Transfer Out/In categories</li>
              </ol>
              <div className="mt-4 p-3 bg-muted/50 rounded-md">
                <p className="text-xs text-muted-foreground">
                  <strong>How to export from HomeBank:</strong>
                  <br />
                  1. Open HomeBank
                  <br />
                  2. Go to File → Export → QIF Exchange format
                  <br />
                  3. Select all accounts and save the file
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Create Account Side Panel */}
      {showCreateAccount && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-50"
            onClick={() => {
              setShowCreateAccount(false);
              setCreatingForQifAccount(null);
            }}
          />
          {/* Panel */}
          <div className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-background border-l border-border z-50 shadow-xl animate-in slide-in-from-right overflow-y-auto">
            <div className="p-4 border-b border-border flex items-center justify-between sticky top-0 bg-background">
              <div>
                <h3 className="font-semibold">Create New Account</h3>
                {creatingForQifAccount && (
                  <p className="text-xs text-muted-foreground mt-1">
                    For: {creatingForQifAccount}
                  </p>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => {
                  setShowCreateAccount(false);
                  setCreatingForQifAccount(null);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-4">
              <AddAccountForm
                onSubmit={handleCreateAccount}
                onCancel={() => {
                  setShowCreateAccount(false);
                  setCreatingForQifAccount(null);
                }}
              />
            </div>
          </div>
        </>
      )}

      <BottomNav />
    </div>
  );
}
