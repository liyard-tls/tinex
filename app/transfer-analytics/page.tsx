'use client';

import { useEffect, useState, useMemo } from 'react';
import { Loader2, TrendingDown, TrendingUp, ArrowRightLeft, Trophy, AlertCircle, ExternalLink, Link2, Link2Off, Check } from 'lucide-react';
import Link from 'next/link';
import BottomNav from '@/shared/components/layout/BottomNav';
import PageHeader from '@/shared/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/Card';
import { useAuth } from '@/app/_providers/AuthProvider';
import { useAppData } from '@/app/_providers/AppDataProvider';
import { formatCurrency, convertCurrency } from '@/shared/services/currencyService';
import { Currency, SYSTEM_CATEGORIES, Transaction } from '@/core/models';
import { transactionRepository } from '@/core/repositories/TransactionRepository';
import { cn } from '@/shared/utils/cn';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';

// ─── Types ───────────────────────────────────────────────────────────────────

interface TransferPair {
  outTxn: Transaction;
  inTxn: Transaction;
  sentAmount: number;
  sentCurrency: Currency;
  receivedAmount: number;
  receivedCurrency: Currency;
  // Converted to base currency
  sentBase: number;
  receivedBase: number;
  feeBase: number;        // fee in base currency (0 if no fee)
  diff: number;           // receivedBase - sentBase - feeBase  (negative = loss)
  diffPct: number;        // diff / sentBase * 100
  actualRate: number;     // receivedAmount / sentAmount  (same currencies = 0)
  marketRate: number;     // market rate between the two currencies at the time
  date: Date;
}

interface CurrencyPairStat {
  pair: string;
  totalLoss: number;
  count: number;
}

interface ChartPoint {
  label: string;
  cumulative: number;
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; payload: { label: string } }>;
  baseCurrency: Currency;
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, baseCurrency }: TooltipProps) {
  if (active && payload && payload.length) {
    const value = payload[0].value;
    return (
      <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
        <p className="text-xs text-muted-foreground mb-1">{payload[0].payload.label}</p>
        <p className={cn('text-sm font-semibold', value >= 0 ? 'text-success' : 'text-destructive')}>
          {formatCurrency(value, baseCurrency)}
        </p>
      </div>
    );
  }
  return null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function diffColor(value: number) {
  if (Math.abs(value) < 0.005) return 'text-muted-foreground';
  return value > 0 ? 'text-success' : 'text-destructive';
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TransferAnalyticsPage() {
  const { user, authLoading } = useAuth();
  const { transactions, categories, userSettings, dataLoading, refreshTransactions } = useAppData();

  const baseCurrency = (userSettings?.baseCurrency || 'USD') as Currency;

  // ── Refresh transactions on mount (in case data was edited on another page) ──
  useEffect(() => {
    refreshTransactions();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Identify transfer category IDs ──────────────────────────────────────
  const { transferOutIds, transferInIds } = useMemo(() => {
    const out: string[] = [];
    const ins: string[] = [];
    for (const cat of categories) {
      if (cat.name === SYSTEM_CATEGORIES.TRANSFER_OUT) out.push(cat.id);
      if (cat.name === SYSTEM_CATEGORIES.TRANSFER_IN) ins.push(cat.id);
    }
    return { transferOutIds: out, transferInIds: ins };
  }, [categories]);

  // ── Raw transfer transactions ────────────────────────────────────────────
  const transferOuts = useMemo(
    () => transactions.filter((t) => transferOutIds.includes(t.categoryId)),
    [transactions, transferOutIds],
  );
  const transferIns = useMemo(
    () => transactions.filter((t) => transferInIds.includes(t.categoryId)),
    [transactions, transferInIds],
  );

  // ── Pair matching ────────────────────────────────────────────────────────
  // Priority 1: match by pairId (exact link, set at creation time)
  // Priority 2: time heuristic — closest Transfer In within 10 min (legacy/imported)
  const { rawPairs, unlinkedOuts, unlinkedIns } = useMemo(() => {
    const usedOutIds = new Set<string>();
    const usedInIds = new Set<string>();
    const pairs: Array<{ out: Transaction; in: Transaction }> = [];

    // Pass 1: match by pairId
    const pairIdMap = new Map<string, { out?: Transaction; in?: Transaction }>();
    for (const t of transferOuts) {
      if (t.pairId) {
        const entry = pairIdMap.get(t.pairId) || {};
        entry.out = t;
        pairIdMap.set(t.pairId, entry);
      }
    }
    for (const t of transferIns) {
      if (t.pairId) {
        const entry = pairIdMap.get(t.pairId) || {};
        entry.in = t;
        pairIdMap.set(t.pairId, entry);
      }
    }
    for (const { out, in: inTxn } of pairIdMap.values()) {
      if (out && inTxn) {
        usedOutIds.add(out.id);
        usedInIds.add(inTxn.id);
        pairs.push({ out, in: inTxn });
      }
    }

    // Unlinked: transfer txns that have no pairId match
    const unlinkedOuts = transferOuts.filter((t) => !usedOutIds.has(t.id));
    const unlinkedIns = transferIns.filter((t) => !usedInIds.has(t.id));

    return { rawPairs: pairs, unlinkedOuts, unlinkedIns };
  }, [transferOuts, transferIns]);

  // ── Manual linking state ─────────────────────────────────────────────────
  const [linkingOutId, setLinkingOutId] = useState<string | null>(null);
  const [savingLink, setSavingLink] = useState(false);
  const [unlinkingPairId, setUnlinkingPairId] = useState<string | null>(null);

  const handleLink = async (outTxn: Transaction, inTxn: Transaction) => {
    setSavingLink(true);
    try {
      const pairId = crypto.randomUUID();
      await Promise.all([
        transactionRepository.update({ id: outTxn.id, pairId }),
        transactionRepository.update({ id: inTxn.id, pairId }),
      ]);
      await refreshTransactions();
    } catch (e) {
      console.error('Failed to link pair', e);
    } finally {
      setSavingLink(false);
      setLinkingOutId(null);
    }
  };

  const handleUnlink = async (p: TransferPair) => {
    const key = p.outTxn.pairId || p.outTxn.id;
    setUnlinkingPairId(key);
    try {
      await Promise.all([
        transactionRepository.update({ id: p.outTxn.id, pairId: undefined }),
        transactionRepository.update({ id: p.inTxn.id, pairId: undefined }),
      ]);
      await refreshTransactions();
    } catch (e) {
      console.error('Failed to unlink pair', e);
    } finally {
      setUnlinkingPairId(null);
    }
  };

  // ── Convert pairs to base currency and compute stats ────────────────────
  const [pairs, setPairs] = useState<TransferPair[]>([]);
  const [loadingPairs, setLoadingPairs] = useState(false);

  useEffect(() => {
    if (!userSettings || rawPairs.length === 0) {
      setPairs([]);
      return;
    }

    let cancelled = false;
    setLoadingPairs(true);

    const compute = async () => {
      const result: TransferPair[] = [];

      for (const { out, in: inTxn } of rawPairs) {
        // Use stored exchangeRate (currency → baseCurrency) when available for historical accuracy.
        // exchangeRate = how many baseCurrency per 1 txnCurrency.
        // Fall back to current rate via convertCurrency for old transactions without stored rate.
        const sentBase =
          out.exchangeRate !== undefined
            ? out.amount * out.exchangeRate
            : await convertCurrency(out.amount, out.currency, baseCurrency);
        const receivedBase =
          inTxn.exchangeRate !== undefined
            ? inTxn.amount * inTxn.exchangeRate
            : await convertCurrency(inTxn.amount, inTxn.currency, baseCurrency);

        // Include fees in the loss calculation (fee is in outCurrency)
        const feeBase = out.fee
          ? out.exchangeRate !== undefined
            ? out.fee * out.exchangeRate
            : await convertCurrency(out.fee, out.currency, baseCurrency)
          : 0;

        const diff = receivedBase - sentBase - feeBase;
        const diffPct = sentBase !== 0 ? (diff / sentBase) * 100 : 0;

        // Actual rate (only meaningful if currencies differ)
        const actualRate =
          out.currency !== inTxn.currency && out.amount !== 0
            ? inTxn.amount / out.amount
            : 0;

        // Market rate = how many inCurrency per 1 outCurrency at time of transfer.
        // Both exchangeRates are stored as (baseCurrency per 1 currency).
        // marketRate = out.exchangeRate / inTxn.exchangeRate
        // Show only if both transactions have stored rates (new transactions).
        const hasStoredRates = out.exchangeRate !== undefined && inTxn.exchangeRate !== undefined;
        const marketRate =
          out.currency !== inTxn.currency && hasStoredRates && inTxn.exchangeRate! > 0
            ? out.exchangeRate! / inTxn.exchangeRate!
            : 0;

        result.push({
          outTxn: out,
          inTxn,
          sentAmount: out.amount,
          sentCurrency: out.currency,
          receivedAmount: inTxn.amount,
          receivedCurrency: inTxn.currency,
          sentBase,
          receivedBase,
          feeBase,
          diff,
          diffPct,
          actualRate,
          marketRate,
          date: out.date,
        });
      }

      if (!cancelled) {
        result.sort((a, b) => a.date.getTime() - b.date.getTime());
        setPairs(result);
        setLoadingPairs(false);
      }
    };

    compute();
    return () => { cancelled = true; };
  }, [rawPairs, userSettings, baseCurrency]);

  // ── Total loss ───────────────────────────────────────────────────────────
  const totalLoss = useMemo(
    () => pairs.reduce((sum, p) => sum + p.diff, 0),
    [pairs],
  );

  const totalTransferred = useMemo(
    () => pairs.reduce((sum, p) => sum + p.sentBase, 0),
    [pairs],
  );

  const lossPercent = totalTransferred > 0 ? (totalLoss / totalTransferred) * 100 : 0;

  // ── By currency pair ─────────────────────────────────────────────────────
  const byPair = useMemo((): CurrencyPairStat[] => {
    const map = new Map<string, CurrencyPairStat>();
    for (const p of pairs) {
      if (p.sentCurrency === p.receivedCurrency) continue; // same currency = no FX loss
      const key = `${p.sentCurrency} → ${p.receivedCurrency}`;
      const existing = map.get(key) || { pair: key, totalLoss: 0, count: 0 };
      existing.totalLoss += p.diff;
      existing.count += 1;
      map.set(key, existing);
    }
    return [...map.values()].sort((a, b) => a.totalLoss - b.totalLoss);
  }, [pairs]);

  // ── Running cumulative loss chart ────────────────────────────────────────
  const chartData = useMemo((): ChartPoint[] => {
    let cumulative = 0;
    return pairs.map((p) => {
      cumulative += p.diff;
      return {
        label: p.date.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' }),
        cumulative,
      };
    });
  }, [pairs]);

  // ── Best / Worst ─────────────────────────────────────────────────────────
  const best = useMemo(
    () => pairs.length > 0 ? pairs.reduce((a, b) => (a.diffPct > b.diffPct ? a : b)) : null,
    [pairs],
  );
  const worst = useMemo(
    () => pairs.length > 0 ? pairs.reduce((a, b) => (a.diffPct < b.diffPct ? a : b)) : null,
    [pairs],
  );

  // ── Loading / auth ────────────────────────────────────────────────────────
  if (authLoading || dataLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background pb-20">
      <PageHeader title="Transfer Analytics" description="Currency conversion costs and transfer history" />

      <main className="px-4 py-4 space-y-4">

        {/* ── Summary Cards ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground mb-1">Total Loss</p>
              <p className={cn('text-base font-bold', diffColor(totalLoss))}>
                {formatCurrency(totalLoss, baseCurrency)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground mb-1">% of Transferred</p>
              <p className={cn('text-base font-bold', diffColor(lossPercent))}>
                {lossPercent >= 0 ? '+' : ''}{lossPercent.toFixed(2)}%
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground mb-1">Transfers</p>
              <p className="text-base font-bold">{pairs.length}</p>
            </CardContent>
          </Card>
        </div>

        {loadingPairs && (
          <div className="flex items-center justify-center py-6 gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Calculating...</span>
          </div>
        )}

        {!loadingPairs && pairs.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center">
              <ArrowRightLeft className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No transfers found.</p>
              <p className="text-xs text-muted-foreground mt-1">
                Transfers are matched by Transfer Out / Transfer In categories within 10 minutes.
              </p>
            </CardContent>
          </Card>
        )}

        {pairs.length > 0 && (
          <>
            {/* ── Running Loss Trend ──────────────────────────────────────── */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Running Loss Trend</CardTitle>
              </CardHeader>
              <CardContent className="px-0 pb-2">
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v: number) => formatCurrency(v, baseCurrency)}
                      width={60}
                    />
                    <Tooltip content={<ChartTooltip baseCurrency={baseCurrency} />} />
                    <ReferenceLine y={0} stroke="hsl(var(--border))" strokeDasharray="4 2" />
                    <Line
                      type="monotone"
                      dataKey="cumulative"
                      stroke={totalLoss >= 0 ? 'hsl(var(--success))' : 'hsl(var(--destructive))'}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* ── Loss by Currency Pair ───────────────────────────────────── */}
            {byPair.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Loss by Currency Pair</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-border">
                    {byPair.map((stat) => (
                      <div key={stat.pair} className="flex items-center justify-between px-4 py-3">
                        <div>
                          <p className="text-sm font-medium">{stat.pair}</p>
                          <p className="text-xs text-muted-foreground">{stat.count} transfer{stat.count !== 1 ? 's' : ''}</p>
                        </div>
                        <p className={cn('text-sm font-semibold', diffColor(stat.totalLoss))}>
                          {formatCurrency(stat.totalLoss, baseCurrency)}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ── Best / Worst ────────────────────────────────────────────── */}
            {(best || worst) && (
              <div className="grid grid-cols-1 gap-3">
                {best && (
                  <Card className="border-success/30">
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-start gap-3">
                        <Trophy className="h-5 w-5 text-success mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-success mb-0.5">Best Transfer</p>
                          <p className="text-xs text-muted-foreground">
                            {best.date.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                          <p className="text-sm mt-1">
                            {best.sentAmount.toLocaleString()} {best.sentCurrency}
                            {best.sentCurrency !== best.receivedCurrency && (
                              <> → {best.receivedAmount.toLocaleString()} {best.receivedCurrency}</>
                            )}
                          </p>
                          {best.sentCurrency !== best.receivedCurrency && best.actualRate > 0 && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Rate: {best.actualRate.toFixed(4)}{best.marketRate > 0 ? ` (market: ${best.marketRate.toFixed(4)})` : ''}
                            </p>
                          )}
                          <p className={cn('text-sm font-semibold mt-1', diffColor(best.diff))}>
                            {best.diffPct >= 0 ? '+' : ''}{best.diffPct.toFixed(2)}% ({formatCurrency(best.diff, baseCurrency)})
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <Link href={`/transactions/${best.outTxn.id}?returnTo=/transfer-analytics`} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors">
                              <ExternalLink className="h-3 w-3" />Transfer Out
                            </Link>
                            <span className="text-muted-foreground/40">·</span>
                            <Link href={`/transactions/${best.inTxn.id}?returnTo=/transfer-analytics`} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors">
                              <ExternalLink className="h-3 w-3" />Transfer In
                            </Link>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {worst && worst !== best && (
                  <Card className="border-destructive/30">
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-destructive mb-0.5">Worst Transfer</p>
                          <p className="text-xs text-muted-foreground">
                            {worst.date.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                          <p className="text-sm mt-1">
                            {worst.sentAmount.toLocaleString()} {worst.sentCurrency}
                            {worst.sentCurrency !== worst.receivedCurrency && (
                              <> → {worst.receivedAmount.toLocaleString()} {worst.receivedCurrency}</>
                            )}
                          </p>
                          {worst.sentCurrency !== worst.receivedCurrency && worst.actualRate > 0 && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Rate: {worst.actualRate.toFixed(4)}{worst.marketRate > 0 ? ` (market: ${worst.marketRate.toFixed(4)})` : ''}
                            </p>
                          )}
                          <p className={cn('text-sm font-semibold mt-1', diffColor(worst.diff))}>
                            {worst.diffPct >= 0 ? '+' : ''}{worst.diffPct.toFixed(2)}% ({formatCurrency(worst.diff, baseCurrency)})
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <Link href={`/transactions/${worst.outTxn.id}?returnTo=/transfer-analytics`} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors">
                              <ExternalLink className="h-3 w-3" />Transfer Out
                            </Link>
                            <span className="text-muted-foreground/40">·</span>
                            <Link href={`/transactions/${worst.inTxn.id}?returnTo=/transfer-analytics`} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors">
                              <ExternalLink className="h-3 w-3" />Transfer In
                            </Link>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* ── Transfer History Timeline ────────────────────────────────── */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Transfer History</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {[...pairs].reverse().map((p, idx) => (
                    <div key={idx} className="px-4 py-3">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs text-muted-foreground">
                          {p.date.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                        <p className={cn('text-xs font-semibold', diffColor(p.diff))}>
                          {p.diffPct >= 0 ? '+' : ''}{p.diffPct.toFixed(2)}%
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-sm">
                          <span className="font-medium">{p.sentAmount.toLocaleString()} {p.sentCurrency}</span>
                          {p.sentCurrency !== p.receivedCurrency ? (
                            <>
                              <ArrowRightLeft className="h-3 w-3 inline mx-1 text-muted-foreground" />
                              <span className="font-medium">{p.receivedAmount.toLocaleString()} {p.receivedCurrency}</span>
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground ml-1">(same currency)</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <div className="text-xs text-muted-foreground">
                          {formatCurrency(p.sentBase, baseCurrency)} sent
                        </div>
                        <div className="flex items-center gap-1">
                          {Math.abs(p.diff) < 0.005
                            ? <ArrowRightLeft className="h-3 w-3 text-muted-foreground" />
                            : p.diff > 0
                              ? <TrendingUp className="h-3 w-3 text-success" />
                              : <TrendingDown className="h-3 w-3 text-destructive" />
                          }
                          <span className={cn('text-xs font-medium', diffColor(p.diff))}>
                            {formatCurrency(p.diff, baseCurrency)}
                          </span>
                        </div>
                      </div>
                      {p.sentCurrency !== p.receivedCurrency && p.actualRate > 0 && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Rate: {p.actualRate.toFixed(4)}{p.marketRate > 0 ? ` (market: ${p.marketRate.toFixed(4)})` : ' · no market rate'}
                        </p>
                      )}
                      {p.outTxn.fee !== undefined && p.outTxn.fee > 0 && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Fee: {p.outTxn.fee.toLocaleString()} {p.sentCurrency}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <Link
                          href={`/transactions/${p.outTxn.id}?returnTo=/transfer-analytics`}
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Transfer Out
                        </Link>
                        <span className="text-muted-foreground/40">·</span>
                        <Link
                          href={`/transactions/${p.inTxn.id}?returnTo=/transfer-analytics`}
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Transfer In
                        </Link>
                        <span className="text-muted-foreground/40">·</span>
                        <button
                          onClick={() => handleUnlink(p)}
                          disabled={unlinkingPairId === (p.outTxn.pairId || p.outTxn.id)}
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                        >
                          {unlinkingPairId === (p.outTxn.pairId || p.outTxn.id)
                            ? <Loader2 className="h-3 w-3 animate-spin" />
                            : <Link2Off className="h-3 w-3" />
                          }
                          Unlink
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* ── Unlinked Transfers ───────────────────────────────────────── */}
        {(unlinkedOuts.length > 0 || unlinkedIns.length > 0) && (
          <Card className="border-amber-500/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Link2 className="h-4 w-4 text-amber-500" />
                Unlinked Transfers
                <span className="text-xs font-normal text-muted-foreground">
                  — no matching pair found
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">

                {unlinkedOuts.map((out) => (
                  <div key={out.id} className="px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-destructive/80 bg-destructive/10 rounded px-1.5 py-0.5">Out</span>
                        <span className="text-xs text-muted-foreground">
                          {out.date.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                      <Link
                        href={`/transactions/${out.id}?returnTo=/transfer-analytics`}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
                    <p className="text-sm font-medium">{out.amount.toLocaleString()} {out.currency}</p>
                    <p className="text-xs text-muted-foreground mb-2">{out.description}</p>

                    {/* Link to a Transfer In */}
                    {linkingOutId === out.id ? (
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Select matching Transfer In:</p>
                        {unlinkedIns.length === 0 ? (
                          <p className="text-xs text-muted-foreground italic">No unlinked Transfer In transactions</p>
                        ) : (
                          unlinkedIns.map((inTxn) => (
                            <button
                              key={inTxn.id}
                              disabled={savingLink}
                              onClick={() => handleLink(out, inTxn)}
                              className="w-full flex items-center justify-between px-3 py-2 rounded-md border border-border hover:border-primary hover:bg-primary/5 transition-colors text-left"
                            >
                              <div>
                                <p className="text-xs font-medium">{inTxn.amount.toLocaleString()} {inTxn.currency}</p>
                                <p className="text-xs text-muted-foreground">
                                  {inTxn.date.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })} · {inTxn.description}
                                </p>
                              </div>
                              {savingLink
                                ? <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                                : <Check className="h-3 w-3 text-success" />
                              }
                            </button>
                          ))
                        )}
                        <button
                          onClick={() => setLinkingOutId(null)}
                          className="text-xs text-muted-foreground hover:text-foreground mt-1"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setLinkingOutId(out.id)}
                        className="flex items-center gap-1 text-xs text-amber-500 hover:text-amber-400 transition-colors"
                      >
                        <Link2 className="h-3 w-3" />
                        Link to Transfer In
                      </button>
                    )}
                  </div>
                ))}

                {unlinkedIns.map((inTxn) => (
                  <div key={inTxn.id} className="px-4 py-3 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-success/80 bg-success/10 rounded px-1.5 py-0.5">In</span>
                        <span className="text-xs text-muted-foreground">
                          {inTxn.date.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                      <p className="text-sm font-medium">{inTxn.amount.toLocaleString()} {inTxn.currency}</p>
                      <p className="text-xs text-muted-foreground">{inTxn.description}</p>
                    </div>
                    <Link
                      href={`/transactions/${inTxn.id}?returnTo=/transfer-analytics`}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors ml-4"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>
                ))}

              </div>
            </CardContent>
          </Card>
        )}

      </main>

      <BottomNav />
    </div>
  );
}
