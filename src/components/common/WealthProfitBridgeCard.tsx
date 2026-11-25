import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRightLeft, CheckCircle2, Coins, PiggyBank, Shield, TrendingUp } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext.tsx';
import { getExchangeRate } from '../../utils/currency.ts';
import { loadManagedClosedTrades } from '../../utils/paperTradeManager.ts';
import { PAPER_POSITIONS_EVENT } from '../../utils/portfolioGuard.ts';
import { CLOUD_TRADING_HYDRATED_EVENT } from '../../utils/tradingCloudSync.ts';

const BRIDGE_ALLOCATED_USD_KEY = 'njia_wealth_bridge_allocated_usd';
const BRIDGE_SPLIT_KEY = 'njia_wealth_bridge_split_v1';

interface SplitConfig {
  mmfPct: number;
  emergencyPct: number;
  incomePct: number;
}

function readAllocatedUsd(): number {
  if (typeof window === 'undefined') return 0;
  try {
    return Math.max(0, Number(parseFloat(localStorage.getItem(BRIDGE_ALLOCATED_USD_KEY) || '0')) || 0);
  } catch {
    return 0;
  }
}

function readSplitConfig(): SplitConfig {
  if (typeof window === 'undefined') return { mmfPct: 50, emergencyPct: 25, incomePct: 25 };
  try {
    const raw = localStorage.getItem(BRIDGE_SPLIT_KEY);
    if (!raw) return { mmfPct: 50, emergencyPct: 25, incomePct: 25 };
    const parsed = JSON.parse(raw);
    const mmfPct = Math.max(0, Math.min(100, Number(parsed.mmfPct) || 0));
    const emergencyPct = Math.max(0, Math.min(100 - mmfPct, Number(parsed.emergencyPct) || 0));
    const incomePct = Math.max(0, 100 - mmfPct - emergencyPct);
    return { mmfPct, emergencyPct, incomePct };
  } catch {
    return { mmfPct: 50, emergencyPct: 25, incomePct: 25 };
  }
}

export const WealthProfitBridgeCard: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const {
    currency,
    exchangeRates,
    formatCurrency,
    addIncome,
    addInvestment,
    depositToEmergencyFund,
    setActiveTab,
  } = useFinance();

  const [closedTrades, setClosedTrades] = useState(() => loadManagedClosedTrades());
  const [allocatedUsd, setAllocatedUsd] = useState<number>(() => readAllocatedUsd());
  const [split, setSplit] = useState<SplitConfig>(() => readSplitConfig());
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => {
      setClosedTrades(loadManagedClosedTrades());
      setAllocatedUsd(readAllocatedUsd());
    };
    window.addEventListener(PAPER_POSITIONS_EVENT, sync);
    window.addEventListener(CLOUD_TRADING_HYDRATED_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(PAPER_POSITIONS_EVENT, sync);
      window.removeEventListener(CLOUD_TRADING_HYDRATED_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const totalRealizedUsd = useMemo(() => {
    return Math.round(closedTrades.reduce((sum, t) => sum + (Number(t.pnl) || 0), 0) * 100) / 100;
  }, [closedTrades]);

  const unallocatedProfitUsd = Math.max(0, Math.round((totalRealizedUsd - allocatedUsd) * 100) / 100);
  const usdToActiveRate = getExchangeRate('USD', currency, exchangeRates);
  const unallocatedActive = Math.round(unallocatedProfitUsd * usdToActiveRate * 100) / 100;
  const totalRealizedActive = Math.round(totalRealizedUsd * usdToActiveRate * 100) / 100;

  const updateSplit = (field: 'mmfPct' | 'emergencyPct', rawVal: number) => {
    const val = Math.max(0, Math.min(100, Math.round(rawVal)));
    setSplit((prev) => {
      const nextMmf = field === 'mmfPct' ? val : Math.min(prev.mmfPct, 100 - val);
      const nextEmerg = field === 'emergencyPct' ? val : Math.min(prev.emergencyPct, 100 - nextMmf);
      const nextIncome = Math.max(0, 100 - nextMmf - nextEmerg);
      const next = { mmfPct: nextMmf, emergencyPct: nextEmerg, incomePct: nextIncome };
      try {
        localStorage.setItem(BRIDGE_SPLIT_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const handleTransferToWealth = () => {
    if (unallocatedProfitUsd <= 0) return;

    const today = new Date().toISOString().split('T')[0];
    const mmfAmt = Math.round(unallocatedActive * (split.mmfPct / 100) * 100) / 100;
    const emergAmt = Math.round(unallocatedActive * (split.emergencyPct / 100) * 100) / 100;
    const cashAmt = Math.max(0, Math.round((unallocatedActive - mmfAmt - emergAmt) * 100) / 100);

    if (mmfAmt > 0) {
      addInvestment({
        name: `Trading Profit Sweep (${today})`,
        assetClass: 'Money Market Fund (MMF)',
        currentValue: mmfAmt,
        investedAmount: mmfAmt,
        expectedAnnualYieldPercent: 14.5,
        provider: 'CIC / Trading Reserve',
      });
    }
    if (emergAmt > 0) {
      depositToEmergencyFund(emergAmt);
    }
    if (cashAmt > 0) {
      addIncome({
        source: `Forex & Signal Profits Sweep (${today})`,
        amount: cashAmt,
        category: 'Business',
        frequency: 'one-time',
        date: today,
        paymentMethod: 'Bank Transfer',
        notes: `Transferred $${unallocatedProfitUsd.toFixed(2)} realized trading profits into personal wealth stack.`,
      });
    }

    const nextAllocated = Math.round((allocatedUsd + unallocatedProfitUsd) * 100) / 100;
    setAllocatedUsd(nextAllocated);
    try {
      localStorage.setItem(BRIDGE_ALLOCATED_USD_KEY, String(nextAllocated));
    } catch {}

    setNotice(
      `Allocated ${formatCurrency(unallocatedActive)} across MMF (${split.mmfPct}%), Emergency (${split.emergencyPct}%), and Cash Income (${split.incomePct}%).`
    );
    setTimeout(() => setNotice(null), 5000);
  };

  return (
    <div className="rounded-2xl bg-[#0c1424] border border-[#182742] p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#142036] pb-3.5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-teal-500/15 border border-teal-500/35 flex items-center justify-center text-[#0df2c9] shrink-0">
            <ArrowRightLeft className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Trading Profits to Wealth Bridge</h3>
            <p className="text-xs text-slate-400">
              Sweep realized Forex &amp; Signal journal gains straight into investments, emergency runway, and income.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleTransferToWealth}
          disabled={unallocatedProfitUsd <= 0}
          className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold text-xs transition-colors cursor-pointer disabled:cursor-not-allowed whitespace-nowrap shrink-0"
        >
          {unallocatedProfitUsd > 0
            ? `Sweep ${formatCurrency(unallocatedActive)} to Wealth`
            : 'All Net Profits Swept'}
        </button>
      </div>

      {notice && (
        <div className="px-3 py-2 rounded-lg bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3 rounded-xl bg-[#080f1d] border border-[#142036]">
          <span className="text-[11px] text-slate-400 block">Journal Net Profit</span>
          <div
            className={`text-lg font-bold font-mono tabular-nums mt-0.5 ${
              totalRealizedUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {totalRealizedUsd >= 0 ? '+' : ''}
            {formatCurrency(totalRealizedActive)}
          </div>
          <span className="text-[11px] text-slate-500 font-mono tabular-nums">
            ${totalRealizedUsd.toFixed(2)} USD ({closedTrades.length} trades)
          </span>
        </div>

        <div className="p-3 rounded-xl bg-[#080f1d] border border-[#142036]">
          <span className="text-[11px] text-slate-400 block">Ready to Sweep</span>
          <div className="text-lg font-bold font-mono tabular-nums text-[#0df2c9] mt-0.5">
            {formatCurrency(unallocatedActive)}
          </div>
          <span className="text-[11px] text-slate-500 font-mono tabular-nums">
            ${unallocatedProfitUsd.toFixed(2)} USD unallocated
          </span>
        </div>

        <div className="p-3 rounded-xl bg-[#080f1d] border border-[#142036]">
          <span className="text-[11px] text-slate-400 block">Total Swept to Wealth</span>
          <div className="text-lg font-bold font-mono tabular-nums text-amber-300 mt-0.5">
            {formatCurrency(Math.round(allocatedUsd * usdToActiveRate * 100) / 100)}
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('investments')}
            className="text-[11px] text-teal-400 hover:text-teal-300 cursor-pointer mt-0.5"
          >
            View in Investments →
          </button>
        </div>
      </div>

      {!compact && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-xs">
          <div className="p-3 rounded-xl bg-[#091120] border border-[#142036] space-y-1.5">
            <div className="flex items-center justify-between text-slate-300">
              <span className="flex items-center gap-1.5 font-medium">
                <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                MMF / Investments
              </span>
              <span className="font-mono tabular-nums text-amber-300 font-bold">{split.mmfPct}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={split.mmfPct}
              onChange={(e) => updateSplit('mmfPct', Number(e.target.value))}
              aria-label="MMF allocation percentage"
              className="w-full accent-amber-400 cursor-pointer"
            />
          </div>

          <div className="p-3 rounded-xl bg-[#091120] border border-[#142036] space-y-1.5">
            <div className="flex items-center justify-between text-slate-300">
              <span className="flex items-center gap-1.5 font-medium">
                <Shield className="w-3.5 h-3.5 text-indigo-400" />
                Emergency Runway
              </span>
              <span className="font-mono tabular-nums text-indigo-300 font-bold">{split.emergencyPct}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={split.emergencyPct}
              onChange={(e) => updateSplit('emergencyPct', Number(e.target.value))}
              aria-label="Emergency fund allocation percentage"
              className="w-full accent-indigo-400 cursor-pointer"
            />
          </div>

          <div className="p-3 rounded-xl bg-[#091120] border border-[#142036] flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-300">
              <span className="flex items-center gap-1.5 font-medium">
                <Coins className="w-3.5 h-3.5 text-emerald-400" />
                Cash / Tax Draw
              </span>
              <span className="font-mono tabular-nums text-emerald-300 font-bold">{split.incomePct}%</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
              <PiggyBank className="w-3 h-3 shrink-0" />
              Auto-balances remaining profit split.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
