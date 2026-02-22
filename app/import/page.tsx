"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import BottomNav from "@/shared/components/layout/BottomNav";
import PageHeader from "@/shared/components/layout/PageHeader";
import { useAuth } from "@/app/_providers/AuthProvider";
import { useAppData } from "@/app/_providers/AppDataProvider";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/shared/components/ui/Card";
import { Button } from "@/shared/components/ui";
import { Upload, FileText, AlertCircle } from "lucide-react";
import {
  ParsedTransaction as TrusteeParsedTransaction,
  TrusteeStatementData,
} from "@/shared/services/trusteeParser";
import {
  ParsedTransaction as MonobankParsedTransaction,
  parseMonobankCSV,
} from "@/shared/services/monobankParser";
import {
  ParsedTransaction as PrivatParsedTransaction,
  PrivatStatementData,
} from "@/shared/services/privatParser";
import { cn } from "@/shared/utils/cn";

// Unified interface
type ParsedTransaction =
  | TrusteeParsedTransaction
  | MonobankParsedTransaction
  | PrivatParsedTransaction;
type BankType = "trustee" | "monobank" | "privat";

/**
 * Detect bank type from PDF content using API
 */
async function detectPdfBankType(file: File): Promise<"trustee" | "privat"> {
  try {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/detect-bank", {
      method: "POST",
      body: formData,
    });

    const result = await response.json();

    if (result.success && result.bank) {
      console.log("[PDF Detection] Detected bank type:", result.bank);
      return result.bank;
    }

    // Default to trustee if detection failed
    console.log(
      "[PDF Detection] Could not determine bank type, defaulting to Trustee",
    );
    return "trustee";
  } catch (error) {
    console.error("[PDF Detection] Error detecting bank type:", error);
    // Default to Trustee on error
    return "trustee";
  }
}

function ImportPageContent() {
  const { user, authLoading } = useAuth();
  const { accounts, dataLoading } = useAppData();
  const [selectedAccount, setSelectedAccount] = useState<string>("");
  const [importing, setImporting] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [bankType, setBankType] = useState<BankType>("trustee");
  const [parsedTransactions, setParsedTransactions] = useState<
    ParsedTransaction[]
  >([]);
  const [error, setError] = useState<string>("");
  const router = useRouter();
  const searchParams = useSearchParams();

  // Handle shared file
  useEffect(() => {
    const sharedFileUrl = searchParams.get("shared_file");
    console.log("[Import] Shared file URL from params:", sharedFileUrl);
    console.log(
      "[Import] All searchParams:",
      Array.from(searchParams.entries()),
    );

    const getFileFromCache = async (fileUrl: string) => {
      console.log("[Import] Attempting to get file from cache:", fileUrl);
      try {
        const cache = await caches.open("shared-files-cache");
        const response = await cache.match(fileUrl);
        if (response) {
          const blob = await response.blob();
          const fileName = decodeURIComponent(
            fileUrl.split("/").pop()?.split("_").slice(1).join("_") ||
              "shared-file",
          );
          const receivedFile = new File([blob], fileName, { type: blob.type });

          setFile(receivedFile);

          // Auto-detect bank type from file extension and content
          if (receivedFile.name.toLowerCase().endsWith(".csv")) {
            setBankType("monobank");
          } else if (receivedFile.name.toLowerCase().endsWith(".pdf")) {
            // Try to auto-detect PDF bank type by reading content
            const detectedBank = await detectPdfBankType(receivedFile);
            setBankType(detectedBank);
          }

          // Clean up the cache
          await cache.delete(fileUrl);
        }
      } catch (err) {
        console.error("Error retrieving shared file:", err);
        setError("Could not load shared file.");
      }
    };

    if (sharedFileUrl && typeof sharedFileUrl === "string") {
      // Ensure it's a string
      getFileFromCache(sharedFileUrl);
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "FILE_SHARED" && event.data.fileUrl) {
        getFileFromCache(event.data.fileUrl);
      }
    };

    navigator.serviceWorker.addEventListener("message", handleMessage);

    return () => {
      navigator.serviceWorker.removeEventListener("message", handleMessage);
    };
  }, [searchParams]); // Changed dependency

  // Pre-select account when bank type or accounts change
  useEffect(() => {
    if (accounts.length === 0) return;

    let preSelectedAccountId: string | undefined = undefined;

    if (bankType === "monobank" || bankType === "privat") {
      const uahAccount = accounts.find((acc) => acc.currency === "UAH");
      preSelectedAccountId = uahAccount?.id ?? accounts[0].id;
    } else if (bankType === "trustee") {
      const eurAccount = accounts.find((acc) => acc.currency === "EUR");
      preSelectedAccountId = eurAccount?.id ?? accounts[0].id;
    } else {
      preSelectedAccountId = accounts[0].id;
    }

    if (preSelectedAccountId) {
      setSelectedAccount(preSelectedAccountId);
    }
  }, [bankType, accounts]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Auto-detect bank type for PDF files
      if (
        selectedFile.type === "application/pdf" ||
        selectedFile.name.toLowerCase().endsWith(".pdf")
      ) {
        const detectedBank = await detectPdfBankType(selectedFile);
        console.log("[Import] Auto-detected bank type:", detectedBank);
        setBankType(detectedBank);
        setFile(selectedFile);
        setError("");
        setParsedTransactions([]);
        return;
      }

      // For CSV, assume Monobank
      if (selectedFile.name.toLowerCase().endsWith(".csv")) {
        console.log(
          "[Import] CSV file detected, setting bank type to Monobank",
        );
        setBankType("monobank");
        setFile(selectedFile);
        setError("");
        setParsedTransactions([]);
        return;
      }

      // Validate file type based on selected bank
      if (
        (bankType === "trustee" || bankType === "privat") &&
        selectedFile.type !== "application/pdf"
      ) {
        setError(
          `Please select a PDF file for ${bankType === "trustee" ? "Trustee" : "Privat Bank"}`,
        );
        return;
      }
      if (bankType === "monobank" && !selectedFile.name.endsWith(".csv")) {
        setError("Please select a CSV file for Monobank");
        return;
      }
      setFile(selectedFile);
      setError("");
      setParsedTransactions([]);
    }
  };

  // Wrap in useCallback to stabilize for useEffect dependency
  const handleParseFile = useCallback(async () => {
    if (!file || !user) {
      return;
    }

    setImporting(true);
    setError("");

    try {
      let transactions: ParsedTransaction[];

      if (bankType === "monobank") {
        // Parse CSV client-side
        const statementData = await parseMonobankCSV(file);
        transactions = statementData.transactions;
      } else {
        // Parse PDF server-side (Trustee or Privat)
        const formData = new FormData();
        formData.append("file", file);
        formData.append("bankType", bankType);

        const response = await fetch("/api/parse-pdf", {
          method: "POST",
          body: formData,
        });

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || "Failed to parse PDF");
        }

        const statementData: TrusteeStatementData | PrivatStatementData =
          result.data;

        // Convert date strings back to Date objects
        transactions = statementData.transactions.map((txn) => ({
          ...txn,
          date: new Date(txn.date),
        }));
      }

      setParsedTransactions(transactions);

      // Store in sessionStorage for preview page
      sessionStorage.setItem(
        "parsedTransactions",
        JSON.stringify({
          transactions: transactions.map((t) => ({
            ...t,
            date: t.date.toISOString(),
          })),
          accountId: selectedAccount,
          source: bankType, // Store the source (trustee or monobank)
          timestamp: Date.now(),
        }),
      );
    } catch (err) {
      console.error("Error parsing file:", err);
      setError(err instanceof Error ? err.message : "Failed to parse file");
    } finally {
      setImporting(false);
    }
  }, [file, user, bankType, selectedAccount]);

  // Automatically parse file when it's received from share target
  useEffect(() => {
    const isSharedFile = searchParams.get("shared_file");
    if (
      isSharedFile &&
      file &&
      selectedAccount &&
      !importing &&
      parsedTransactions.length === 0
    ) {
      handleParseFile();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    file,
    selectedAccount,
    searchParams,
    handleParseFile,
    importing,
    parsedTransactions,
  ]);

  if (authLoading || dataLoading) {
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
    <div className="min-h-screen bg-background pb-20">
      <PageHeader
        title="Import Transactions"
        description="Import transactions from bank statements"
      />
      <div className="container max-w-2xl mx-auto p-4">

        {/* HomeBank QIF Import */}
        {/* <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-base">Import from HomeBank</CardTitle>
            <CardDescription>
              Import QIF file with multiple accounts at once
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => router.push("/import/qif")}
              variant="outline"
              className="w-full"
            >
              <FileText className="h-4 w-4 mr-2" />
              Import QIF File
            </Button>
          </CardContent>
        </Card> */}

        {/* Bank Selection */}
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-base">Single Bank Statement</CardTitle>
            <CardDescription>Import from individual bank</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => {
                  setBankType("trustee");
                  setFile(null);
                  setParsedTransactions([]);
                  setError("");
                }}
                disabled={importing}
                className={cn(
                  "px-4 py-3 text-sm font-medium rounded-md transition-colors border-2",
                  bankType === "trustee"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:border-primary/50",
                )}
              >
                Trustee (PDF)
              </button>
              <button
                onClick={() => {
                  setBankType("monobank");
                  setFile(null);
                  setParsedTransactions([]);
                  setError("");
                }}
                disabled={importing}
                className={cn(
                  "px-4 py-3 text-sm font-medium rounded-md transition-colors border-2",
                  bankType === "monobank"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:border-primary/50",
                )}
              >
                Monobank (CSV)
              </button>
              <button
                onClick={() => {
                  setBankType("privat");
                  setFile(null);
                  setParsedTransactions([]);
                  setError("");
                }}
                disabled={importing}
                className={cn(
                  "px-4 py-3 text-sm font-medium rounded-md transition-colors border-2",
                  bankType === "privat"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:border-primary/50",
                )}
              >
                Privat (PDF)
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Account Selection */}
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-base">Select Account</CardTitle>
            <CardDescription>
              Choose which account to import transactions into
            </CardDescription>
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
              {bankType === "trustee"
                ? "Select a Trustee PDF statement file to import"
                : bankType === "monobank"
                  ? "Select a Monobank CSV export file to import"
                  : "Select a Privat Bank PDF statement file to import"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <label
                  htmlFor="file-upload"
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed rounded-lg cursor-pointer transition-colors",
                    file
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary hover:bg-primary/5",
                  )}
                >
                  <Upload className="h-5 w-5" />
                  <span className="text-sm">
                    {file
                      ? file.name
                      : bankType === "monobank"
                        ? "Choose CSV file"
                        : "Choose PDF file"}
                  </span>
                  <input
                    id="file-upload"
                    type="file"
                    accept={
                      bankType === "monobank" ? ".csv" : "application/pdf"
                    }
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
                  {importing ? "Parsing..." : "Parse File"}
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
                      <p className="text-sm font-medium truncate">
                        {txn.description}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {txn.date.toLocaleDateString()}{" "}
                        {txn.date.toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: false,
                        })}
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
                onClick={() =>
                  router.push(
                    `/import/preview?count=${parsedTransactions.length}`,
                  )
                }
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
              <li>Select your bank (Trustee, Monobank, or Privat Bank)</li>
              <li>Select the account to import transactions into</li>
              <li>
                Upload your bank statement file (
                {bankType === "monobank" ? "CSV" : "PDF"})
              </li>
              <li>Click "Parse File" to extract transactions</li>
              <li>Review the preview and click "Review & Import"</li>
              <li>Duplicate transactions will be automatically skipped</li>
              <li>
                Categories will be auto-detected based on previous transactions
              </li>
            </ol>
            {bankType === "monobank" && (
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

export default function ImportPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background">
          <div className="container max-w-2xl mx-auto p-4 pb-20">
            <p className="text-center text-muted-foreground">Loading...</p>
          </div>
          <BottomNav />
        </div>
      }
    >
      <ImportPageContent />
    </Suspense>
  );
}
