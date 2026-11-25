import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CalendarClock,
  ShieldCheck,
  Volume2,
  Wallet,
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext.tsx';
import { fetchSharedCalendarEvents, CalendarNewsEvent } from '../../utils/newsGuard.ts';
import {
  emitMullahProactiveSpeech,
  loadManagedClosedTrades,
  loadManagedPaperPositions,
} from '../../utils/paperTradeManager.ts';
import { evaluatePropTradeBlock, loadPropConfig } from '../../utils/propGuardian.ts';
import { PAPER_POSITIONS_EVENT } from '../../utils/portfolioGuard.ts';
import { CLOUD_TRADING_HYDRATED_EVENT } from '../../utils/tradingCloudSync.ts';
import { getExchangeRate } from '../../utils/currency.ts';

export const MorningBriefingCard: React.FC = () => {
  const {
    currency,
    exchangeRates,
    formatCurrency,
    dailySafeToSpend,
    setActiveTab,
  } = useFinance();

  const [openPositions, setOpenPositions] = useState(() => loadManagedPaperPositions());
  const [closedTrades, setClosedTrades] = useState(() => loadManagedClosedTrades());
  const [propConfig, setPropConfig] = useState(() => loadPropConfig());
  const [propBlock, setPropBlock] = useState(() => evaluatePropTradeBlock());
  const [highImpactNews, setHighImpactNews] = useState<CalendarNewsEvent[]>([]);
  const [daemonStats, setDaemonStats] = useState<{ isRunning: boolean; ticksProcessed: number } | null>(null);

  useEffect(() => {
    const syncAll = () => {
      setOpenPositions(loadManagedPaperPositions());
      setClosedTrades(loadManagedClosedTrades());
      setPropConfig(loadPropConfig());
      setPropBlock(evaluatePropTradeBlock());
    };
    window.addEventListener(PAPER_POSITIONS_EVENT, syncAll);
    window.addEventListener(CLOUD_TRADING_HYDRATED_EVENT, syncAll);
    window.addEventListener('storage', syncAll);

    fetchSharedCalendarEvents()
      .then((evts) => {
        const now = Date.now();
        const upcoming = evts
          .filter((e) => String(e.impact || '').toUpperCase() === 'HIGH' && e.isoDate && new Date(e.isoDate).getTime() >= now - 15 * 60000)
          .slice(0, 3);
        setHighImpactNews(upcoming);
      })
      .catch(() => {});

    const fetchDaemon = () => {
      fetch('/api/ea/daemon-status')
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d?.success) {
            setDaemonStats({ isRunning: Boolean(d.isRunning), ticksProcessed: Number(d.ticksProcessed || 0) });
          }
        })
        .catch(() => {});
    };
    fetchDaemon();
    const timer = setInterval(fetchDaemon, 10000);

    return () => {
      window.removeEventListener(PAPER_POSITIONS_EVENT, syncAll);
      window.removeEventListener(CLOUD_TRADING_HYDRATED_EVENT, syncAll);
      window.removeEventListener('storage', syncAll);
      clearInterval(timer);
    };
  }, []);

  const floatingUsd = useMemo(
    () => Math.round(openPositions.reduce((s, p) => s + (Number(p.pnl) || 0), 0) * 100) / 100,
    [openPositions]
  );

  const winRate = useMemo(() => {
    if (closedTrades.length === 0) return 0;
    const wins = closedTrades.filter((t) => t.outcome === 'WIN').length;
    return Math.round((wins / closedTrades.length) * 100);
  }, [closedTrades]);

  const usdToActive = getExchangeRate('USD', currency, exchangeRates);
  const dailyLossLimitUsd = ((propConfig.dailyStartingEquity || propConfig.accountSize) * propConfig.maxDailyLossPercent) / 100;
  const dailyHeadroomUsd = Math.max(0, propBlock.dailyLossBufferRemaining);
  const dailyHeadroomPct = dailyLossLimitUsd > 0 ? Math.min(100, Math.max(0, Math.round((dailyHeadroomUsd / dailyLossLimitUsd) * 100))) : 100;

  const nextNews = highImpactNews[0];
  const nextNewsMinutes = nextNews?.isoDate ? Math.round((new Date(nextNews.isoDate).getTime() - Date.now()) / 60000) : null;

  const handleSpeakBriefing = () => {
    const newsPart = nextNews
      ? `Next high impact news is ${nextNews.currency} ${nextNews.title} in ${Math.max(1, nextNewsMinutes || 0)} minutes.`
      : 'No imminent high impact news warnings right now.';
    const tradesPart =
      openPositions.length > 0
        ? `You have ${openPositions.length} open paper position${openPositions.length > 1 ? 's' : ''} with floating P and L of ${floatingUsd} dollars.`
        : `No open paper positions right now. Journal win rate is ${winRate} percent across ${closedTrades.length} trades.`;
    const financePart =
      dailySafeToSpend > 0
        ? `Your safe to spend today is ${formatCurrency(dailySafeToSpend)}.`
        : 'Record monthly income to unlock your daily safe to spend limit.';

    emitMullahProactiveSpeech(
      `Executive briefing: ${tradesPart} Prop drawdown buffer is ${dailyHeadroomPct} percent. ${newsPart} ${financePart}`
    );
  };

  return (
    <div className="rounded-2xl bg-[#0c1424] border border-[#182844] p-4 sm:p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#142036] pb-3">
        <div>
          <h2 className="text-sm sm:text-base font-bold text-white">Executive Morning Briefing</h2>
          <p className="text-xs text-slate-400">
            Unified market schedule, open positions, prop firm headroom, and daily budget allowance.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleSpeakBriefing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#112036] hover:bg-[#172b47] border border-teal-500/40 text-[#0df2c9] text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>Speak Briefing</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('stocks')}
            className="px-3 py-1.5 rounded-lg bg-teal-500/15 hover:bg-teal-500/25 border border-teal-500/40 text-teal-300 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
          >
            Open Pro Radar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* 1. Open Positions & Cloud Engine */}
        <div
          onClick={() => setActiveTab('stocks')}
          className="p-3.5 rounded-xl bg-[#080f1d] border border-[#142036] hover:border-teal-500/40 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-[#0df2c9]" />
              Open Paper &amp; Journal
            </span>
            <span className="font-mono text-[11px] text-slate-400">
              {daemonStats?.isRunning ? '24/7 ON' : 'Standby'}
            </span>
          </div>
          <div className="mt-1.5 flex items-baseline justify-between gap-2">
            <span className="text-lg font-bold font-mono tabular-nums text-white">
              {openPositions.length} Open
            </span>
            <span
              className={`text-sm font-bold font-mono tabular-nums ${
                floatingUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {floatingUsd >= 0 ? '+' : ''}
              {formatCurrency(Math.round(floatingUsd * usdToActive * 100) / 100)}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 font-mono tabular-nums mt-0.5">
            {closedTrades.length} closed · {winRate}% win rate
          </p>
        </div>

        {/* 2. High-Impact News Countdown */}
        <div
          onClick={() => setActiveTab('forex-suite')}
          className="p-3.5 rounded-xl bg-[#080f1d] border border-[#142036] hover:border-amber-500/40 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <CalendarClock className="w-3.5 h-3.5 text-amber-400" />
              Red-Folder News
            </span>
            {nextNews && <span className="text-[11px] font-mono text-amber-300">{nextNews.currency}</span>}
          </div>
          <div className="mt-1.5 text-sm font-bold text-white truncate">
            {nextNews ? nextNews.title : 'Clear Macro Window'}
          </div>
          <p className="text-[11px] text-slate-500 font-mono tabular-nums mt-1">
            {nextNews && nextNewsMinutes !== null
              ? nextNewsMinutes > 0
                ? `Releases in ${nextNewsMinutes}m`
                : 'Release window active'
              : 'No high-impact USD/EUR/GBP events imminent'}
          </p>
        </div>

        {/* 3. Prop Firm Drawdown Shield */}
        <div
          onClick={() => setActiveTab('forex-suite')}
          className="p-3.5 rounded-xl bg-[#080f1d] border border-[#142036] hover:border-emerald-500/40 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              {propBlock.blocked ? (
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
              ) : (
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              )}
              Prop Drawdown Guard
            </span>
            <span className="font-mono text-[11px] text-slate-400 tabular-nums">{dailyHeadroomPct}% left</span>
          </div>
          <div className={`mt-1.5 text-lg font-bold font-mono tabular-nums ${propBlock.blocked ? 'text-rose-400' : 'text-emerald-400'}`}>
            {propBlock.blocked ? 'LOCKED' : `$${dailyHeadroomUsd.toFixed(0)} Buffer`}
          </div>
          <p className="text-[11px] text-slate-500 font-mono tabular-nums mt-0.5">
            Daily cap: ${dailyLossLimitUsd.toFixed(0)}
          </p>
        </div>

        {/* 4. Cashflow Safe-to-Spend Today */}
        <div
          onClick={() => setActiveTab('budget')}
          className="p-3.5 rounded-xl bg-[#080f1d] border border-[#142036] hover:border-cyan-500/40 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5 text-cyan-400" />
              Safe to Spend Today
            </span>
          </div>
          <div className="mt-1.5 text-lg font-bold font-mono tabular-nums text-cyan-300">
            {dailySafeToSpend > 0 ? formatCurrency(dailySafeToSpend) : 'Set Budget'}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Synced with monthly cashflow &amp; M-Pesa ledger
          </p>
        </div>
      </div>
    </div>
  );
};
