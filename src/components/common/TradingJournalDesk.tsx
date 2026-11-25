import React, { useState, useMemo, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Award,
  Download,
  Search,
  CheckCircle2,
  XCircle,
  Activity,
  Zap,
  Trash2,
} from 'lucide-react';
import { ClosedTrade, Position, TradeMindset } from './PaperTradingDesk.tsx';
import { CLOUD_TRADING_HYDRATED_EVENT, scheduleTradingCloudPush } from '../../utils/tradingCloudSync.ts';
import { PAPER_POSITIONS_EVENT } from '../../utils/portfolioGuard.ts';
import {
  getAssetPriceDigits,
  isAutoOpenOnSignalEnabled,
  AUTO_SIGNAL_PAPER_TOGGLE_EVENT,
} from '../../utils/paperTradeManager.ts';
import { WealthProfitBridgeCard } from './WealthProfitBridgeCard.tsx';

interface TradingJournalDeskProps {
  currentTicker?: string;
}

function readRealClosedTrades(): ClosedTrade[] {
  if (typeof window === 'undefined') return [];
  try {
    const saved = localStorage.getItem('njia_paper_trades');
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readLiveOpenPositions(): Position[] {
  if (typeof window === 'undefined') return [];
  try {
    const saved = localStorage.getItem('njia_paper_positions');
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export const TradingJournalDesk: React.FC<TradingJournalDeskProps> = ({ currentTicker }) => {
  const [trades, setTrades] = useState<ClosedTrade[]>(() => readRealClosedTrades());
  const [openPositions, setOpenPositions] = useState<Position[]>(() => readLiveOpenPositions());
  const [autoEnabled, setAutoEnabled] = useState<boolean>(() => isAutoOpenOnSignalEnabled());
  const [sourceFilter, setSourceFilter] = useState<'ALL' | 'AUTO_SIGNAL' | 'MANUAL'>('ALL');
  const [filterTicker, setFilterTicker] = useState<'ALL' | 'CURRENT'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState<'ALL' | 'WIN' | 'LOSS'>('ALL');
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    const syncJournal = () => {
      setTrades(readRealClosedTrades());
      setOpenPositions(readLiveOpenPositions());
    };
    const syncAuto = () => setAutoEnabled(isAutoOpenOnSignalEnabled());
    window.addEventListener(CLOUD_TRADING_HYDRATED_EVENT, syncJournal);
    window.addEventListener(PAPER_POSITIONS_EVENT, syncJournal);
    window.addEventListener('storage', syncJournal);
    window.addEventListener(AUTO_SIGNAL_PAPER_TOGGLE_EVENT, syncAuto);
    return () => {
      window.removeEventListener(CLOUD_TRADING_HYDRATED_EVENT, syncJournal);
      window.removeEventListener(PAPER_POSITIONS_EVENT, syncJournal);
      window.removeEventListener('storage', syncJournal);
      window.removeEventListener(AUTO_SIGNAL_PAPER_TOGGLE_EVENT, syncAuto);
    };
  }, []);

  // Scoped trades for Strategy vs Manual analysis
  const scopedTrades = useMemo(() => {
    return trades.filter((t) => {
      if (sourceFilter === 'AUTO_SIGNAL' && !t.isAutoSignal) return false;
      if (sourceFilter === 'MANUAL' && t.isAutoSignal) return false;
      if (filterTicker === 'CURRENT' && currentTicker) {
        const cleanCur = currentTicker.toUpperCase().replace(/[/_\s-]/g, '');
        const cleanRow = t.ticker.toUpperCase().replace(/[/_\s-]/g, '');
        if (!cleanRow.includes(cleanCur)) return false;
      }
      return true;
    });
  }, [trades, sourceFilter, filterTicker, currentTicker]);

  // Trade analytics calculations on scopedTrades
  const stats = useMemo(() => {
    const totalTrades = scopedTrades.length;
    if (totalTrades === 0) {
      return {
        totalTrades: 0,
        winCount: 0,
        lossCount: 0,
        winRate: 0,
        grossProfit: 0,
        grossLoss: 0,
        netPnl: 0,
        profitFactor: 0,
        expectancy: 0,
        bestTrade: 0,
        worstTrade: 0,
        avgWin: 0,
        avgLoss: 0,
        maxDrawdown: 0,
        tpHits: 0,
        slHits: 0,
      };
    }

    const wins = scopedTrades.filter((t) => t.outcome === 'WIN');
    const losses = scopedTrades.filter((t) => t.outcome === 'LOSS');
    const grossProfit = wins.reduce((sum, t) => sum + Math.max(0, t.pnl), 0);
    const grossLoss = Math.abs(losses.reduce((sum, t) => sum + Math.min(0, t.pnl), 0));
    const netPnl = Math.round((grossProfit - grossLoss) * 100) / 100;
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 99.9 : 0;
    const winRate = Math.round((wins.length / totalTrades) * 100);
    const expectancy = Math.round((netPnl / totalTrades) * 100) / 100;

    const pnls = scopedTrades.map((t) => t.pnl);
    const bestTrade = pnls.length > 0 ? Math.max(...pnls) : 0;
    const worstTrade = pnls.length > 0 ? Math.min(...pnls) : 0;

    const avgWin = wins.length > 0 ? grossProfit / wins.length : 0;
    const avgLoss = losses.length > 0 ? grossLoss / losses.length : 0;

    let peak = 10000;
    let currentEqu = 10000;
    let maxDd = 0;

    const chronological = [...scopedTrades].reverse();
    chronological.forEach((t) => {
      currentEqu += t.pnl;
      if (currentEqu > peak) peak = currentEqu;
      const dd = ((peak - currentEqu) / peak) * 100;
      if (dd > maxDd) maxDd = dd;
    });

    const tpHits = scopedTrades.filter(
      (t) => t.closeReason === 'TP_HIT' || t.closeReason === 'TP1_PARTIAL' || (t.outcome === 'WIN' && t.ticker.includes('TP'))
    ).length;
    const slHits = scopedTrades.filter(
      (t) => t.closeReason === 'SL_HIT' || (t.outcome === 'LOSS' && t.ticker.includes('SL'))
    ).length;

    return {
      totalTrades,
      winCount: wins.length,
      lossCount: losses.length,
      winRate,
      grossProfit,
      grossLoss,
      netPnl,
      profitFactor: Math.round(profitFactor * 100) / 100,
      expectancy,
      bestTrade,
      worstTrade,
      avgWin: Math.round(avgWin * 100) / 100,
      avgLoss: Math.round(avgLoss * 100) / 100,
      maxDrawdown: Math.round(maxDd * 10) / 10,
      tpHits,
      slHits,
    };
  }, [scopedTrades]);

  // Per-strategy / timeframe profitability breakdown
  const strategyBreakdown = useMemo(() => {
    const map = new Map<string, { trades: number; wins: number; pnl: number }>();
    for (const t of scopedTrades) {
      const label = t.strategy || (t.isAutoSignal ? `Signal (${t.timeframe || '15m'})` : 'Manual Order');
      const cur = map.get(label) || { trades: 0, wins: 0, pnl: 0 };
      cur.trades += 1;
      if (t.outcome === 'WIN') cur.wins += 1;
      cur.pnl = Math.round((cur.pnl + t.pnl) * 100) / 100;
      map.set(label, cur);
    }
    return Array.from(map.entries())
      .map(([name, d]) => ({
        name,
        trades: d.trades,
        wins: d.wins,
        winRate: Math.round((d.wins / d.trades) * 100),
        pnl: d.pnl,
      }))
      .sort((a, b) => b.pnl - a.pnl)
      .slice(0, 4);
  }, [scopedTrades]);

  // Equity Curve generation for SVG plot
  const equityPoints = useMemo(() => {
    let balance = 10000;
    const points: Array<{ balance: number; label: string; tradePnl: number }> = [
      { balance: 10000, label: 'Start', tradePnl: 0 },
    ];

    const chronological = [...scopedTrades].reverse();
    chronological.forEach((t, idx) => {
      balance += t.pnl;
      points.push({
        balance,
        label: `#${idx + 1} (${t.ticker})`,
        tradePnl: t.pnl,
      });
    });

    return points;
  }, [scopedTrades]);

  // Filtered trades for table
  const filteredTrades = useMemo(() => {
    return scopedTrades.filter((t) => {
      if (outcomeFilter !== 'ALL' && t.outcome !== outcomeFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          t.ticker.toLowerCase().includes(q) ||
          t.direction.toLowerCase().includes(q) ||
          t.timestamp.toLowerCase().includes(q) ||
          (t.strategy || '').toLowerCase().includes(q) ||
          (t.timeframe || '').toLowerCase().includes(q) ||
          (t.mindset || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [scopedTrades, outcomeFilter, searchQuery]);

  // Psychology & Setup Grade analytics
  const psychologyStats = useMemo(() => {
    const disciplined = scopedTrades.filter((t) => !t.mindset || t.mindset === 'DISCIPLINED');
    const emotional = scopedTrades.filter((t) => t.mindset && t.mindset !== 'DISCIPLINED');

    const summarize = (list: ClosedTrade[]) => {
      const wins = list.filter((t) => t.outcome === 'WIN').length;
      const pnl = list.reduce((s, t) => s + t.pnl, 0);
      return {
        count: list.length,
        winRate: list.length > 0 ? Math.round((wins / list.length) * 100) : 0,
        pnl: Number(pnl.toFixed(2)),
      };
    };

    const aPlus = scopedTrades.filter((t) => !t.setupGrade || t.setupGrade === 'A+');
    const bOrC = scopedTrades.filter((t) => t.setupGrade === 'B' || t.setupGrade === 'C');

    return {
      disciplined: summarize(disciplined),
      emotional: summarize(emotional),
      aPlus: summarize(aPlus),
      bOrC: summarize(bOrC),
    };
  }, [scopedTrades]);

  const handleUpdateTradeMindset = (tradeId: string, nextMindset: TradeMindset) => {
    setTrades((prev) => {
      const updated = prev.map((t) => (t.id === tradeId ? { ...t, mindset: nextMindset } : t));
      try {
        localStorage.setItem('njia_paper_trades', JSON.stringify(updated));
        scheduleTradingCloudPush();
      } catch {
        // ignore storage failure
      }
      return updated;
    });
  };

  const handleClearJournal = () => {
    setTrades([]);
    setConfirmClear(false);
    try {
      localStorage.setItem('njia_paper_trades', JSON.stringify([]));
      window.dispatchEvent(new CustomEvent(PAPER_POSITIONS_EVENT));
      scheduleTradingCloudPush();
    } catch {
      // ignore storage errors
    }
  };

  // Export to CSV
  const handleExportCsv = () => {
    if (scopedTrades.length === 0) return;
    const header =
      'ID,Ticker,Direction,Lots,EntryPrice,ExitPrice,Currency,PnL,PnLPercent,Source,Strategy,Timeframe,CloseReason,Timestamp,Outcome\n';
    const rows = scopedTrades
      .map(
        (t) =>
          `"${t.id}","${t.ticker}","${t.direction}",${t.lots},${t.entryPrice},${t.exitPrice},"${t.currency}",${t.pnl},${t.pnlPercent}%,"${t.isAutoSignal ? 'AUTO_SIGNAL' : 'MANUAL'}","${t.strategy || ''}","${t.timeframe || ''}","${t.closeReason || 'MANUAL'}","${t.timestamp}","${t.outcome}"`
      )
      .join('\n');

    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `mullahtracker_forex_journal_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // SVG Chart Geometry
  const minEquity = Math.min(...equityPoints.map((p) => p.balance), 9800);
  const maxEquity = Math.max(...equityPoints.map((p) => p.balance), 10500);
  const range = maxEquity - minEquity || 1;

  const svgWidth = 600;
  const svgHeight = 160;
  const svgPadding = 20;

  const pathD = equityPoints
    .map((p, i) => {
      const x = svgPadding + (i / (equityPoints.length - 1 || 1)) * (svgWidth - svgPadding * 2);
      const y = svgHeight - svgPadding - ((p.balance - minEquity) / range) * (svgHeight - svgPadding * 2);
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');

  const areaD = `${pathD} L ${(svgWidth - svgPadding).toFixed(1)} ${(svgHeight - svgPadding).toFixed(1)} L ${svgPadding.toFixed(1)} ${(svgHeight - svgPadding).toFixed(1)} Z`;

  const autoTradeCount = trades.filter((t) => t.isAutoSignal).length;
  const manualTradeCount = trades.length - autoTradeCount;
  const liveFloatingPnl = Math.round(openPositions.reduce((s, p) => s + (p.pnl || 0), 0) * 100) / 100;

  const edgeVerdict =
    stats.totalTrades === 0
      ? null
      : stats.netPnl > 0 && stats.profitFactor >= 1.15
      ? { label: 'PROFITABLE STRATEGY EDGE', tone: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/35' }
      : stats.netPnl >= 0
      ? { label: 'BREAKEVEN / BUILDING SAMPLE', tone: 'text-cyan-300 bg-cyan-500/15 border-cyan-500/35' }
      : { label: 'NEGATIVE EXPECTANCY — REVIEW SL/TP', tone: 'text-rose-300 bg-rose-500/15 border-rose-500/35' };

  return (
    <div className="rounded-2xl bg-[#090e1a] border border-[#162540] overflow-hidden space-y-5 p-5">
      {/* Top Banner & Export */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#141f33] pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#0df2c9]/15 border border-[#0df2c9]/30 flex items-center justify-center text-[#0df2c9]">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-bold text-white">Forex Strategy Performance Journal</h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#0df2c9]/20 text-[#0df2c9] border border-[#0df2c9]/30 font-bold">
                LIVE AUDITED
              </span>
              {edgeVerdict && (
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded border font-bold ${edgeVerdict.tone}`}>
                  {edgeVerdict.label}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              Every signal auto-opens on Paper Trade and records TP/SL outcomes here to verify strategy profitability
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {trades.length > 0 && (
            confirmClear ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleClearJournal}
                  className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white cursor-pointer"
                >
                  Confirm Clear
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  className="px-2.5 py-2 rounded-xl bg-[#121c2e] text-xs text-slate-300 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#121c2e] hover:bg-rose-950/50 border border-[#1e2f4a] hover:border-rose-500/40 text-xs font-semibold text-slate-300 hover:text-rose-300 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Log</span>
              </button>
            )
          )}

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={scopedTrades.length === 0}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#121c2e] border border-[#1e2f4a] text-xs font-semibold transition-colors ${
              scopedTrades.length === 0
                ? 'opacity-45 text-slate-500 cursor-not-allowed'
                : 'hover:bg-[#1a2942] text-slate-200 cursor-pointer'
            }`}
          >
            <Download className="w-3.5 h-3.5 text-[#0df2c9]" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Live Active Open Trades Strip */}
      <div className="p-3.5 rounded-xl bg-[#0c1424] border border-[#182744] space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-[#0df2c9]" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Live Open Paper Trades ({openPositions.length})
            </span>
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                autoEnabled
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              Auto-Signal Execution: {autoEnabled ? 'ACTIVE' : 'PAUSED'}
            </span>
          </div>
          {openPositions.length > 0 && (
            <span
              className={`text-xs font-mono font-bold ${
                liveFloatingPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              Floating: {liveFloatingPnl >= 0 ? '+' : '-'}${Math.abs(liveFloatingPnl).toFixed(2)}
            </span>
          )}
        </div>

        {openPositions.length === 0 ? (
          <p className="text-xs text-slate-400">
            No live open positions right now. Indicated BUY/SELL signals automatically open here and log into the journal when TP1, TP2, or SL executes.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {openPositions.slice(0, 6).map((pos) => {
              const d = getAssetPriceDigits(pos.ticker, pos.market, pos.entryPrice);
              return (
                <div
                  key={pos.id}
                  className="p-2.5 rounded-lg bg-[#070b13] border border-[#172846] flex items-center justify-between gap-2 text-xs font-mono"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-white">{pos.ticker}</span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                          pos.direction === 'LONG' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                        }`}
                      >
                        {pos.direction === 'LONG' ? 'BUY' : 'SELL'}
                      </span>
                      {pos.timeframe && (
                        <span className="text-[9px] px-1 py-0.2 rounded bg-[#0df2c9]/15 text-[#0df2c9]">
                          {pos.timeframe}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                      Entry {pos.entryPrice.toFixed(d)} · SL {pos.stopLoss ? pos.stopLoss.toFixed(d) : '—'} · TP {pos.takeProfit ? pos.takeProfit.toFixed(d) : '—'}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`font-bold ${pos.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {pos.pnl >= 0 ? '+' : '-'}${Math.abs(pos.pnl).toFixed(2)}
                    </div>
                    <div className="text-[10px] text-slate-500">{pos.lots}L</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Strategy Source & Asset Scope Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 p-1 bg-[#070b13] border border-[#162540] rounded-xl">
          <button
            type="button"
            onClick={() => setSourceFilter('ALL')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              sourceFilter === 'ALL'
                ? 'bg-[#0df2c9]/20 text-[#0df2c9] border border-[#0df2c9]/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            All Trades ({trades.length})
          </button>
          <button
            type="button"
            onClick={() => setSourceFilter('AUTO_SIGNAL')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              sourceFilter === 'AUTO_SIGNAL'
                ? 'bg-[#0df2c9]/20 text-[#0df2c9] border border-[#0df2c9]/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Auto Signal Strategy ({autoTradeCount})
          </button>
          <button
            type="button"
            onClick={() => setSourceFilter('MANUAL')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              sourceFilter === 'MANUAL'
                ? 'bg-[#0df2c9]/20 text-[#0df2c9] border border-[#0df2c9]/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Manual ({manualTradeCount})
          </button>
        </div>

        {currentTicker && (
          <div className="flex items-center gap-1 p-1 bg-[#070b13] border border-[#162540] rounded-xl">
            <button
              type="button"
              onClick={() => setFilterTicker('ALL')}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono cursor-pointer ${
                filterTicker === 'ALL' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              All Pairs
            </button>
            <button
              type="button"
              onClick={() => setFilterTicker('CURRENT')}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono cursor-pointer ${
                filterTicker === 'CURRENT' ? 'bg-slate-800 text-[#0df2c9]' : 'text-slate-400 hover:text-white'
              }`}
            >
              {currentTicker} Only
            </button>
          </div>
        )}
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3.5 rounded-xl bg-[#0d1627] border border-[#1a2b48]">
          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Win Rate</span>
          <div className="text-xl font-extrabold font-mono text-emerald-400 mt-0.5">
            {stats.winRate}%
          </div>
          <span className="text-[10px] text-slate-500">
            {stats.winCount}W / {stats.lossCount}L ({stats.totalTrades} closed)
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-[#0d1627] border border-[#1a2b48]">
          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Profit Factor</span>
          <div className={`text-xl font-extrabold font-mono mt-0.5 ${stats.profitFactor >= 1.2 ? 'text-cyan-400' : 'text-amber-300'}`}>
            {stats.profitFactor}x
          </div>
          <span className="text-[10px] text-slate-500">
            TP Hits: {stats.tpHits} · SL: {stats.slHits}
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-[#0d1627] border border-[#1a2b48]">
          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Net PnL</span>
          <div
            className={`text-xl font-extrabold font-mono mt-0.5 ${
              stats.netPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {stats.netPnl >= 0 ? '+' : '-'}${Math.abs(stats.netPnl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span className="text-[10px] text-slate-500">
            Gross: +${Math.round(stats.grossProfit)}
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-[#0d1627] border border-[#1a2b48]">
          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Expectancy / Trade</span>
          <div className={`text-xl font-extrabold font-mono mt-0.5 ${stats.expectancy >= 0 ? 'text-emerald-300' : 'text-rose-400'}`}>
            {stats.expectancy >= 0 ? '+' : '-'}${Math.abs(stats.expectancy).toFixed(2)}
          </div>
          <span className="text-[10px] text-slate-500">
            Avg Win: +${stats.avgWin}
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-[#0d1627] border border-[#1a2b48]">
          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Best / Worst</span>
          <div className="text-sm font-extrabold font-mono text-emerald-300 mt-1">
            +${stats.bestTrade.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[11px] font-mono text-rose-400">
            -${Math.abs(stats.worstTrade).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-[#0d1627] border border-[#1a2b48]">
          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Max Drawdown</span>
          <div className="text-xl font-extrabold font-mono text-amber-400 mt-0.5">
            {stats.maxDrawdown}%
          </div>
          <span className="text-[10px] text-slate-500">
            Safety buffer: 10%
          </span>
        </div>
      </div>

      {/* Strategy & Timeframe Profitability Breakdown */}
      {strategyBreakdown.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {strategyBreakdown.map((item) => (
            <div key={item.name} className="p-3 rounded-xl bg-[#0c1424] border border-[#182744]">
              <div className="text-[11px] font-mono text-slate-300 truncate" title={item.name}>
                {item.name}
              </div>
              <div className="flex items-baseline justify-between mt-1 font-mono">
                <span className="text-sm font-bold text-[#0df2c9]">{item.winRate}% Win</span>
                <span className={`text-xs font-bold ${item.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {item.pnl >= 0 ? '+' : '-'}${Math.abs(item.pnl).toFixed(2)}
                </span>
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                {item.wins}/{item.trades} winning fills
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Visual Equity Curve Chart */}
      <div className="p-4 rounded-xl bg-[#0c1424] border border-[#182744] space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#0df2c9]" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">Strategy Equity Progression</span>
          </div>
          <div className="flex items-center gap-3 text-xs font-mono text-slate-400">
            <span>Start: <strong className="text-slate-200">$10,000</strong></span>
            <span>Current: <strong className={equityPoints[equityPoints.length - 1].balance >= 10000 ? 'text-emerald-400' : 'text-rose-400'}>${equityPoints[equityPoints.length - 1].balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
          </div>
        </div>

        <div className="relative w-full h-[160px] overflow-hidden rounded-lg bg-[#070b13] border border-[#142036]">
          <svg className="w-full h-full" viewBox={`0 0 ${svgWidth} ${svgHeight}`} preserveAspectRatio="none">
            <defs>
              <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0df2c9" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#0df2c9" stopOpacity="0.0" />
              </linearGradient>
            </defs>
            <line x1="0" y1={svgHeight * 0.25} x2={svgWidth} y2={svgHeight * 0.25} stroke="#142036" strokeDasharray="3 3" />
            <line x1="0" y1={svgHeight * 0.5} x2={svgWidth} y2={svgHeight * 0.5} stroke="#142036" strokeDasharray="3 3" />
            <line x1="0" y1={svgHeight * 0.75} x2={svgWidth} y2={svgHeight * 0.75} stroke="#142036" strokeDasharray="3 3" />

            <path d={areaD} fill="url(#equityGrad)" />
            <path d={pathD} fill="none" stroke="#0df2c9" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </div>
      </div>

      {/* Discipline & Mindset Expectancy Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-[#0c1424] border border-[#182744]">
          <div className="text-[11px] font-mono text-slate-400">Disciplined Mindset</div>
          <div className="flex items-baseline justify-between mt-1 font-mono">
            <span className="text-base font-bold text-emerald-400">
              {psychologyStats.disciplined.winRate}% Win
            </span>
            <span className={psychologyStats.disciplined.pnl >= 0 ? 'text-xs text-emerald-300' : 'text-xs text-rose-300'}>
              {psychologyStats.disciplined.pnl >= 0 ? '+' : '-'}${Math.abs(psychologyStats.disciplined.pnl).toFixed(2)}
            </span>
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">{psychologyStats.disciplined.count} trades</div>
        </div>

        <div className="p-3.5 rounded-xl bg-[#0c1424] border border-[#182744]">
          <div className="text-[11px] font-mono text-slate-400">Emotional (FOMO / Revenge)</div>
          <div className="flex items-baseline justify-between mt-1 font-mono">
            <span className="text-base font-bold text-rose-400">
              {psychologyStats.emotional.count > 0 ? `${psychologyStats.emotional.winRate}% Win` : '0 Trades'}
            </span>
            <span className={psychologyStats.emotional.pnl >= 0 ? 'text-xs text-emerald-300' : 'text-xs text-rose-300'}>
              {psychologyStats.emotional.pnl >= 0 ? '+' : '-'}${Math.abs(psychologyStats.emotional.pnl).toFixed(2)}
            </span>
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">{psychologyStats.emotional.count} tilt trades</div>
        </div>

        <div className="p-3.5 rounded-xl bg-[#0c1424] border border-[#182744]">
          <div className="text-[11px] font-mono text-slate-400">A+ Grade Setups</div>
          <div className="flex items-baseline justify-between mt-1 font-mono">
            <span className="text-base font-bold text-[#0df2c9]">{psychologyStats.aPlus.winRate}% Win</span>
            <span className={psychologyStats.aPlus.pnl >= 0 ? 'text-xs text-emerald-300' : 'text-xs text-rose-300'}>
              {psychologyStats.aPlus.pnl >= 0 ? '+' : '-'}${Math.abs(psychologyStats.aPlus.pnl).toFixed(2)}
            </span>
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">{psychologyStats.aPlus.count} setups</div>
        </div>

        <div className="p-3.5 rounded-xl bg-[#0c1424] border border-[#182744]">
          <div className="text-[11px] font-mono text-slate-400">B / C Grade Setups</div>
          <div className="flex items-baseline justify-between mt-1 font-mono">
            <span className="text-base font-bold text-amber-300">
              {psychologyStats.bOrC.count > 0 ? `${psychologyStats.bOrC.winRate}% Win` : '0 Trades'}
            </span>
            <span className={psychologyStats.bOrC.pnl >= 0 ? 'text-xs text-emerald-300' : 'text-xs text-rose-300'}>
              {psychologyStats.bOrC.pnl >= 0 ? '+' : '-'}${Math.abs(psychologyStats.bOrC.pnl).toFixed(2)}
            </span>
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">{psychologyStats.bOrC.count} setups</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-1.5 overflow-x-auto p-1 bg-[#070b13] border border-[#162540] rounded-xl">
          <button
            onClick={() => setOutcomeFilter('ALL')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              outcomeFilter === 'ALL'
                ? 'bg-[#0df2c9]/20 text-[#0df2c9] border border-[#0df2c9]/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            All Outcomes ({scopedTrades.length})
          </button>
          <button
            onClick={() => setOutcomeFilter('WIN')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              outcomeFilter === 'WIN'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Wins Only ({stats.winCount})
          </button>
          <button
            onClick={() => setOutcomeFilter('LOSS')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              outcomeFilter === 'LOSS'
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Losses ({stats.lossCount})
          </button>
        </div>

        <div className="relative sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search pair, strategy, or mindset..."
            className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-[#070b13] border border-[#162540] text-xs text-white placeholder-slate-600 focus:outline-none focus:border-[#0df2c9]"
          />
        </div>
      </div>

      {/* Trades Table */}
      <div className="rounded-xl border border-[#162540] overflow-hidden bg-[#070b13]">
        {filteredTrades.length === 0 ? (
          <div className="py-10 px-4 text-center space-y-2">
            <Award className="w-8 h-8 text-slate-600 mx-auto" />
            <div className="text-sm font-semibold text-slate-300">
              {trades.length === 0 ? 'Waiting for Closed Signal Trades' : 'No Matching Trades'}
            </div>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {trades.length === 0
                ? 'Active signals automatically open on Paper Trade above. As live prices hit Take Profit (TP1/TP2) or Stop Loss—or when you close a position—every trade logs here automatically.'
                : 'Adjust your outcome, strategy source, or search filter to view recorded trades.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#141f33] bg-[#0a1120] text-slate-400 font-mono text-[10px] uppercase">
                  <th className="py-2.5 px-4">Instrument & Strategy</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Lots/Qty</th>
                  <th className="py-2.5 px-3">Entry</th>
                  <th className="py-2.5 px-3">Exit</th>
                  <th className="py-2.5 px-4 text-right">PnL Return</th>
                  <th className="py-2.5 px-3">Mindset</th>
                  <th className="py-2.5 px-4">Timestamp</th>
                  <th className="py-2.5 px-3 text-center">Outcome</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#141f33]/60 font-mono">
                {filteredTrades.map((t) => {
                  const rowDigits = t.entryPrice < 10 ? 5 : 2;
                  return (
                    <tr key={t.id} className="hover:bg-[#0e1729] transition-colors">
                      <td className="py-2.5 px-4">
                        <div className="font-bold text-white flex items-center gap-1.5 flex-wrap">
                          <span>{t.ticker}</span>
                          {t.isAutoSignal && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#0df2c9]/15 text-[#0df2c9] border border-[#0df2c9]/30">
                              AUTO {t.timeframe || ''}
                            </span>
                          )}
                          {t.closeReason && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                              {t.closeReason.replace('_', ' ')}
                            </span>
                          )}
                        </div>
                        {t.strategy && (
                          <div className="text-[10px] text-slate-500 mt-0.5 truncate max-w-[200px]">
                            {t.strategy}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold inline-flex items-center gap-1 ${
                            t.direction === 'LONG'
                              ? 'bg-emerald-500/15 text-emerald-400'
                              : 'bg-rose-500/15 text-rose-400'
                          }`}
                        >
                          {t.direction === 'LONG' ? (
                            <TrendingUp className="w-3 h-3" />
                          ) : (
                            <TrendingDown className="w-3 h-3" />
                          )}
                          {t.direction}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-300">{t.lots}</td>
                      <td className="py-2.5 px-3 text-slate-300">{t.entryPrice.toFixed(rowDigits)}</td>
                      <td className="py-2.5 px-3 text-slate-300">{t.exitPrice.toFixed(rowDigits)}</td>
                      <td className="py-2.5 px-4 text-right">
                        <span className={`font-bold ${t.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {t.pnl >= 0 ? '+' : '-'}${Math.abs(t.pnl).toFixed(2)} ({t.pnlPercent >= 0 ? '+' : ''}{t.pnlPercent}%)
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <select
                          value={t.mindset || 'DISCIPLINED'}
                          onChange={(e) => handleUpdateTradeMindset(t.id, e.target.value as TradeMindset)}
                          aria-label={`Mindset tag for ${t.ticker}`}
                          className={`px-2 py-0.5 rounded bg-[#0c1424] border border-[#1b2c48] text-[10px] font-mono focus:outline-none cursor-pointer ${
                            !t.mindset || t.mindset === 'DISCIPLINED' ? 'text-emerald-300' : 'text-rose-300'
                          }`}
                        >
                          <option value="DISCIPLINED">DISCIPLINED</option>
                          <option value="FOMO">FOMO</option>
                          <option value="REVENGE">REVENGE</option>
                          <option value="TIRED">TIRED</option>
                        </select>
                      </td>
                      <td className="py-2.5 px-4 text-slate-500 text-[11px]">{t.timestamp}</td>
                      <td className="py-2.5 px-3 text-center">
                        {t.outcome === 'WIN' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            WIN
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-400">
                            <XCircle className="w-3.5 h-3.5" />
                            LOSS
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Trading Profits -> Real Wealth Bridge */}
      <WealthProfitBridgeCard compact />
    </div>
  );
};
