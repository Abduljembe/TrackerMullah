import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  Landmark,
  ArrowUpRight,
  Clock,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  DollarSign,
  RefreshCw,
} from 'lucide-react';

interface CentralBankPolicy {
  currency: string;
  bank: string;
  bankShort: string;
  rate: number;
  previousRate: number;
  yield2y?: number | null;
  spreadVs2yBps?: number | null;
  stance: 'HAWKISH' | 'NEUTRAL' | 'DOVISH';
  impliedNextMove: string;
  nextMeeting: string;
  daysUntilMeeting?: number | null;
  pairShortcut: string;
  note: string;
}

const FALLBACK_BANKS: CentralBankPolicy[] = [
  {
    currency: 'KES',
    bank: 'Central Bank of Kenya',
    bankShort: 'CBK',
    rate: 8.75,
    previousRate: 8.75,
    yield2y: null,
    spreadVs2yBps: null,
    stance: 'NEUTRAL',
    impliedNextMove: 'Official CBK Rate Benchmark',
    nextMeeting: 'Scheduled',
    daysUntilMeeting: null,
    pairShortcut: 'USD/KES',
    note: 'Awaiting live sync...',
  },
  {
    currency: 'USD',
    bank: 'Federal Reserve',
    bankShort: 'FOMC',
    rate: 4.0,
    previousRate: 4.0,
    yield2y: 4.65,
    spreadVs2yBps: 65,
    stance: 'HAWKISH',
    impliedNextMove: '+65 bps above policy',
    nextMeeting: 'Scheduled',
    daysUntilMeeting: null,
    pairShortcut: 'EUR/USD',
    note: 'Awaiting live sync...',
  },
];

interface CentralBankCarryDeskProps {
  currentTicker?: string;
  onSelectPair?: (pair: string) => void;
}

export const CentralBankCarryDesk: React.FC<CentralBankCarryDeskProps> = ({
  currentTicker = 'EUR/USD',
  onSelectPair,
}) => {
  const [lotSize, setLotSize] = useState<number>(0.1);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [banks, setBanks] = useState<CentralBankPolicy[]>(FALLBACK_BANKS);
  const [feedSource, setFeedSource] = useState<string>('syncing');
  const [fetchedAt, setFetchedAt] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const loadLiveCentralBanks = useCallback(async (force = false) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/macro/central-banks${force ? '?force=1' : ''}`);
      if (res.ok) {
        const data = await res.json();
        if (data?.success && Array.isArray(data.banks) && data.banks.length > 0) {
          setBanks(data.banks);
          setFeedSource(data.source || 'tradingview_macro_live');
          setFetchedAt(data.fetchedAt || new Date().toISOString());
        }
      }
    } catch {
      // keep existing state cleanly
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLiveCentralBanks(false);
    const refreshId = setInterval(() => loadLiveCentralBanks(false), 5 * 60 * 1000);
    const clockId = setInterval(() => setNowMs(Date.now()), 30000);
    return () => {
      clearInterval(refreshId);
      clearInterval(clockId);
    };
  }, [loadLiveCentralBanks]);

  const bankMap = useMemo(() => {
    const map: Record<string, CentralBankPolicy> = {};
    for (const b of banks) {
      map[b.currency] = b;
    }
    return map;
  }, [banks]);

  const rolloverInfo = useMemo(() => {
    const now = new Date(nowMs);
    const utcDay = now.getUTCDay();
    const isWednesdayTripleSwap = utcDay === 3;

    const nextRollover = new Date(nowMs);
    nextRollover.setUTCHours(22, 0, 0, 0);
    if (now.getUTCHours() >= 22) {
      nextRollover.setUTCDate(nextRollover.getUTCDate() + 1);
    }
    const diffMinutes = Math.max(0, Math.round((nextRollover.getTime() - nowMs) / 60000));
    const hrs = Math.floor(diffMinutes / 60);
    const mins = diffMinutes % 60;

    return {
      isWednesdayTripleSwap,
      countdownText: `${hrs}h ${mins}m`,
      multiplier: isWednesdayTripleSwap ? 3 : 1,
    };
  }, [nowMs]);

  const activeCarry = useMemo(() => {
    const clean = currentTicker.toUpperCase().replace(/\s+/g, '');
    let base = 'EUR';
    let quote = 'USD';

    if (clean.includes('/')) {
      const [b, q] = clean.split('/');
      base = b || 'EUR';
      quote = q || 'USD';
    } else if (clean.length === 6) {
      base = clean.slice(0, 3);
      quote = clean.slice(3, 6);
    }

    const isGold = base === 'XAU';
    const basePolicy = isGold
      ? { currency: 'XAU', bankShort: 'Gold (Non-Yielding)', rate: 0.0, stance: 'NEUTRAL' as const }
      : bankMap[base] || { currency: base, bankShort: base, rate: 4.0, stance: 'NEUTRAL' as const };
    const quotePolicy = bankMap[quote] || { currency: quote, bankShort: quote, rate: 4.0, stance: 'NEUTRAL' as const };

    const spreadPct = Number((basePolicy.rate - quotePolicy.rate).toFixed(2));
    const grossDailyPerLot = ((Math.abs(spreadPct) / 100) * 100000) / 365;
    const brokerMarkupPerLot = isGold ? 6.4 : 2.15;
    const positiveDaily = Math.max(0.25, grossDailyPerLot - brokerMarkupPerLot * 0.45);
    const negativeDaily = -(grossDailyPerLot + brokerMarkupPerLot);

    const longDaily = (spreadPct > 0.35 ? positiveDaily : negativeDaily) * lotSize * rolloverInfo.multiplier;
    const shortDaily = (spreadPct < -0.35 ? positiveDaily : negativeDaily) * lotSize * rolloverInfo.multiplier;

    const preferredCarrySide =
      isGold
        ? 'SHORT (Avoid Long USD Funding Cost)'
        : spreadPct > 0.35
        ? `LONG ${base}/${quote}`
        : spreadPct < -0.35
        ? `SHORT ${base}/${quote}`
        : 'NEUTRAL (Flat Differential)';

    return {
      pairLabel: `${base}/${quote}`,
      basePolicy,
      quotePolicy,
      spreadPct,
      longDaily: Number(longDaily.toFixed(2)),
      shortDaily: Number(shortDaily.toFixed(2)),
      preferredCarrySide,
    };
  }, [currentTicker, lotSize, rolloverInfo.multiplier, bankMap]);

  return (
    <div className="rounded-2xl bg-[#090e1a] border border-[#162540] p-5 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#141f33] pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-500/12 border border-teal-500/30 flex items-center justify-center text-[#0df2c9] shrink-0">
            <Landmark className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-baseline gap-2">
              <h3 className="text-base font-bold text-white">
                Central Bank Policy, Carry &amp; Swap Matrix
              </h3>
              <span className="text-[11px] font-mono text-[#0df2c9]">
                {feedSource === 'tradingview_macro_live'
                  ? 'Live Sovereign & CB Feed'
                  : isLoading
                  ? 'Syncing live macro...'
                  : 'Baseline Cache'}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Live G10/CBK policy rates, 2-Year Sovereign bond pricing, and overnight rollover carry
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
          <div className="flex items-center gap-1.5 text-slate-300">
            <Clock className="w-3.5 h-3.5 text-[#0df2c9]" />
            <span>NY Rollover: {rolloverInfo.countdownText}</span>
          </div>
          {rolloverInfo.isWednesdayTripleSwap && (
            <span className="flex items-center gap-1 text-amber-300 font-semibold">
              <AlertTriangle className="w-3.5 h-3.5" />
              3x Wednesday Swap
            </span>
          )}
          <button
            type="button"
            onClick={() => loadLiveCentralBanks(true)}
            disabled={isLoading}
            title="Refresh live central bank & 2Y bond rates"
            className="p-1.5 rounded-lg bg-[#0e192d] hover:bg-[#152440] border border-[#1d3153] text-slate-300 hover:text-white cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-[#0df2c9]' : ''}`} />
          </button>
        </div>
      </div>

      {/* Active Pair Carry & Swap Analyzer */}
      <div className="p-4 rounded-xl bg-[#0c1424] border border-[#182744] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-mono text-slate-400">
              Active Pair Carry Spread · {activeCarry.pairLabel}
              {fetchedAt ? ` · Updated ${new Date(fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
            </div>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mt-1">
              <span className="text-lg font-bold text-white font-mono">
                {activeCarry.basePolicy.currency} {activeCarry.basePolicy.rate.toFixed(2)}% vs{' '}
                {activeCarry.quotePolicy.currency} {activeCarry.quotePolicy.rate.toFixed(2)}%
              </span>
              <span
                className={`text-sm font-mono font-bold ${
                  activeCarry.spreadPct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                ({activeCarry.spreadPct >= 0 ? '+' : ''}
                {activeCarry.spreadPct.toFixed(2)}% differential)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-mono">Volume:</span>
            {[0.1, 0.5, 1.0].map((lots) => (
              <button
                key={lots}
                type="button"
                onClick={() => setLotSize(lots)}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold border transition-colors cursor-pointer ${
                  lotSize === lots
                    ? 'bg-[#0df2c9]/15 text-[#0df2c9] border-[#0df2c9]/40'
                    : 'bg-[#08101d] text-slate-400 hover:text-white border-[#1b2c4a]'
                }`}
              >
                {lots.toFixed(1)}L
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-3 rounded-lg bg-[#080f1c] border border-[#16243d]">
            <div className="text-[11px] text-slate-400 flex items-center justify-between">
              <span>Est. Long Swap ({rolloverInfo.multiplier}x)</span>
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div
              className={`text-base font-bold font-mono mt-1 ${
                activeCarry.longDaily >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {activeCarry.longDaily >= 0 ? '+' : '-'}${Math.abs(activeCarry.longDaily).toFixed(2)} / night
            </div>
          </div>

          <div className="p-3 rounded-lg bg-[#080f1c] border border-[#16243d]">
            <div className="text-[11px] text-slate-400 flex items-center justify-between">
              <span>Est. Short Swap ({rolloverInfo.multiplier}x)</span>
              <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
            </div>
            <div
              className={`text-base font-bold font-mono mt-1 ${
                activeCarry.shortDaily >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {activeCarry.shortDaily >= 0 ? '+' : '-'}${Math.abs(activeCarry.shortDaily).toFixed(2)} / night
            </div>
          </div>

          <div className="p-3 rounded-lg bg-[#080f1c] border border-[#16243d]">
            <div className="text-[11px] text-slate-400 flex items-center justify-between">
              <span>Institutional Carry Tail</span>
              <DollarSign className="w-3.5 h-3.5 text-[#0df2c9]" />
            </div>
            <div className="text-sm font-bold text-[#0df2c9] mt-1 font-mono truncate">
              {activeCarry.preferredCarrySide}
            </div>
          </div>
        </div>
      </div>

      {/* Live Central Bank Matrix Table */}
      <div className="rounded-xl border border-[#162540] overflow-hidden bg-[#070b13]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#141f33] bg-[#0a1120] text-slate-400 font-mono text-[11px]">
                <th className="py-2.5 px-4">Currency / Bank</th>
                <th className="py-2.5 px-3 text-right">Live Policy Rate</th>
                <th className="py-2.5 px-3 text-right">2Y Bond Yield</th>
                <th className="py-2.5 px-3">Bond-Implied Stance</th>
                <th className="py-2.5 px-3">Next Decision</th>
                <th className="py-2.5 px-4 hidden lg:table-cell">Live Pricing Note</th>
                <th className="py-2.5 px-3 text-right">Focus</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#141f33]/70">
              {banks.map((bank) => (
                <tr key={bank.currency} className="hover:bg-[#0e1729] transition-colors">
                  <td className="py-2.5 px-4">
                    <div className="font-bold text-white font-mono">
                      {bank.currency} · {bank.bankShort}
                    </div>
                    <div className="text-[11px] text-slate-400">{bank.bank}</div>
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono">
                    <div className="font-bold text-white">{bank.rate.toFixed(2)}%</div>
                    <div className="text-[10px] text-slate-500">Prev {bank.previousRate.toFixed(2)}%</div>
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-200">
                    {bank.yield2y !== null && bank.yield2y !== undefined ? `${bank.yield2y.toFixed(2)}%` : '—'}
                  </td>
                  <td className="py-2.5 px-3 font-mono">
                    <div
                      className={`font-semibold ${
                        bank.stance === 'HAWKISH'
                          ? 'text-emerald-400'
                          : bank.stance === 'DOVISH'
                          ? 'text-rose-400'
                          : 'text-slate-300'
                      }`}
                    >
                      {bank.stance}
                    </div>
                    <div className="text-[10px] text-slate-400 whitespace-nowrap">{bank.impliedNextMove}</div>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-slate-300 whitespace-nowrap">
                    {bank.nextMeeting}
                    {typeof bank.daysUntilMeeting === 'number' ? ` (${bank.daysUntilMeeting}d)` : ''}
                  </td>
                  <td className="py-2.5 px-4 text-slate-400 hidden lg:table-cell max-w-xs truncate">
                    {bank.note}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    {onSelectPair && (
                      <button
                        type="button"
                        onClick={() => onSelectPair(bank.pairShortcut)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#101c31] hover:bg-[#172846] border border-[#1d3153] text-[11px] font-mono text-[#0df2c9] cursor-pointer whitespace-nowrap"
                      >
                        <span>{bank.pairShortcut}</span>
                        <ArrowUpRight className="w-3 h-3" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
