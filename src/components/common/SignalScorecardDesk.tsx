import React, { useState, useEffect, useMemo } from 'react';
import {
  Award,
  CheckCircle2,
  XCircle,
  Activity,
  Trash2,
  Plus,
  TrendingUp,
  TrendingDown,
  Target,
  BarChart2,
  Clock,
  Sparkles,
  ArrowUpRight,
} from 'lucide-react';
import {
  TrackedSignalRecord,
  loadTrackedSignals,
  recordTrackedSignal,
  deleteTrackedSignal,
  clearTrackedSignals,
  evaluateTrackedSignalsAgainstQuotes,
  SCORECARD_EVENT,
} from '../../utils/signalScorecard.ts';
import { LiveTvQuote, lookupTradingViewQuote } from '../../utils/tradingViewSync.ts';

interface SignalScorecardDeskProps {
  liveTvQuotes: Record<string, LiveTvQuote>;
  currentTicker?: string;
  currentMarket?: string;
  currentPrice?: number;
  activeSignalSnapshot?: {
    action: string;
    timeframe: string;
    entryPrice: number;
    sl: number;
    tp1: number;
    tp2: number;
    riskReward: string;
    confidenceScore: number;
  };
  onSelectSymbol?: (ticker: string) => void;
}

export const SignalScorecardDesk: React.FC<SignalScorecardDeskProps> = ({
  liveTvQuotes,
  currentTicker,
  currentMarket = 'FOREX',
  currentPrice,
  activeSignalSnapshot,
  onSelectSymbol,
}) => {
  const [signals, setSignals] = useState<TrackedSignalRecord[]>(() => loadTrackedSignals());
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'WINS' | 'LOSSES'>('ALL');
  const [justLoggedNotice, setJustLoggedNotice] = useState(false);

  // Sync across components & tabs when signals are added or auto-resolved
  useEffect(() => {
    const refresh = () => setSignals(loadTrackedSignals());
    window.addEventListener(SCORECARD_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(SCORECARD_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  // Automatically resolve ACTIVE & TP1_HIT signals against live TradingView ticks
  useEffect(() => {
    if (!liveTvQuotes || Object.keys(liveTvQuotes).length === 0) return;
    const changed = evaluateTrackedSignalsAgainstQuotes(liveTvQuotes);
    if (changed) {
      setSignals(loadTrackedSignals());
    }
  }, [liveTvQuotes]);

  const handleTrackCurrent = () => {
    if (!currentTicker || !activeSignalSnapshot || !(activeSignalSnapshot.entryPrice > 0)) return;
    const isBuy = activeSignalSnapshot.action.toUpperCase().includes('BUY');
    recordTrackedSignal({
      symbol: currentTicker,
      market: currentMarket,
      timeframe: activeSignalSnapshot.timeframe,
      source: 'MANUAL',
      direction: isBuy ? 'BUY' : 'SELL',
      action: activeSignalSnapshot.action,
      entryPrice: activeSignalSnapshot.entryPrice,
      sl: activeSignalSnapshot.sl,
      tp1: activeSignalSnapshot.tp1,
      tp2: activeSignalSnapshot.tp2,
      riskReward: activeSignalSnapshot.riskReward,
      confidenceScore: activeSignalSnapshot.confidenceScore,
    });
    setSignals(loadTrackedSignals());
    setJustLoggedNotice(true);
    setTimeout(() => setJustLoggedNotice(false), 2200);
  };

  const stats = useMemo(() => {
    const wins = signals.filter((s) => s.status === 'TP1_HIT' || s.status === 'TP2_HIT');
    const losses = signals.filter((s) => s.status === 'STOPPED_OUT');
    const active = signals.filter((s) => s.status === 'ACTIVE');
    const resolved = wins.length + losses.length;
    const winRate = resolved > 0 ? Math.round((wins.length / resolved) * 100) : 0;

    const rValues = signals
      .filter((s) => typeof s.realizedR === 'number')
      .map((s) => s.realizedR as number);
    const totalR = rValues.reduce((acc, r) => acc + r, 0);
    const avgR = rValues.length > 0 ? Number((totalR / rValues.length).toFixed(2)) : 0;

    // Group by timeframe for breakdown
    const tfMap = new Map<string, { wins: number; losses: number; active: number; totalR: number }>();
    for (const s of signals) {
      const key = s.timeframe || '15m';
      const cur = tfMap.get(key) || { wins: 0, losses: 0, active: 0, totalR: 0 };
      if (s.status === 'TP1_HIT' || s.status === 'TP2_HIT') cur.wins++;
      else if (s.status === 'STOPPED_OUT') cur.losses++;
      else cur.active++;
      if (typeof s.realizedR === 'number') cur.totalR += s.realizedR;
      tfMap.set(key, cur);
    }

    const timeframeBreakdown = Array.from(tfMap.entries()).map(([tf, d]) => {
      const res = d.wins + d.losses;
      return {
        tf,
        wins: d.wins,
        losses: d.losses,
        active: d.active,
        winRate: res > 0 ? Math.round((d.wins / res) * 100) : null,
        totalR: Number(d.totalR.toFixed(1)),
      };
    });

    return {
      total: signals.length,
      wins: wins.length,
      losses: losses.length,
      active: active.length,
      resolved,
      winRate,
      totalR: Number(totalR.toFixed(2)),
      avgR,
      timeframeBreakdown,
    };
  }, [signals]);

  const filteredSignals = useMemo(() => {
    return signals.filter((s) => {
      if (statusFilter === 'ACTIVE') return s.status === 'ACTIVE';
      if (statusFilter === 'WINS') return s.status === 'TP1_HIT' || s.status === 'TP2_HIT';
      if (statusFilter === 'LOSSES') return s.status === 'STOPPED_OUT';
      return true;
    });
  }, [signals, statusFilter]);

  const formatNum = (val: number) => {
    if (!Number.isFinite(val)) return '0.00';
    if (Math.abs(val) < 10) return val.toFixed(5);
    if (Math.abs(val) < 250) return val.toFixed(3);
    return val.toFixed(2);
  };

  return (
    <div className="rounded-2xl bg-[#090e1a] border border-[#162540] overflow-hidden p-5 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#141f33] pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-[#0df2c9]">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white flex flex-wrap items-center gap-2">
              Live Signal Win-Rate Scorecard & Auto-Tracker
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                AUTO-RESOLVING TP1 / TP2 / SL
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Audits real-time signal accuracy across Radar, MT5 EA Scanner, and Bot Studio against live TradingView ticks
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {currentTicker && activeSignalSnapshot && (
            <button
              type="button"
              onClick={handleTrackCurrent}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-teal-400 to-[#0df2c9] hover:opacity-95 text-[#070b13] font-bold text-xs shadow-lg shadow-teal-500/20 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>
                {justLoggedNotice
                  ? `Tracked ${currentTicker}!`
                  : `Track ${currentTicker} (${activeSignalSnapshot.timeframe})`}
              </span>
            </button>
          )}
          {stats.resolved > 0 && (
            <button
              type="button"
              onClick={() => clearTrackedSignals('RESOLVED')}
              className="px-3 py-2 rounded-xl bg-[#0c1424] hover:bg-[#131e36] text-slate-300 border border-[#1a2b4a] text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
              title="Clear resolved TP/SL records while keeping open setups"
            >
              <Trash2 className="w-3.5 h-3.5 text-slate-400" />
              <span>Clear Resolved</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-3.5 rounded-xl bg-[#0c1424] border border-[#182744]">
          <span className="text-[10px] text-slate-400 uppercase font-mono block">Verified Win Rate</span>
          <div className={`text-2xl font-extrabold font-mono mt-0.5 ${stats.resolved === 0 ? 'text-slate-400' : stats.winRate >= 55 ? 'text-emerald-400' : 'text-amber-400'}`}>
            {stats.resolved > 0 ? `${stats.winRate}%` : 'Pending'}
          </div>
          <span className="text-[10px] text-slate-500 font-mono">
            {stats.wins} Wins / {stats.losses} Losses
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-[#0c1424] border border-[#182744]">
          <span className="text-[10px] text-slate-400 uppercase font-mono block">Net Realized R</span>
          <div className={`text-2xl font-extrabold font-mono mt-0.5 ${stats.totalR >= 0 ? 'text-[#0df2c9]' : 'text-rose-400'}`}>
            {stats.totalR >= 0 ? `+${stats.totalR}R` : `${stats.totalR}R`}
          </div>
          <span className="text-[10px] text-slate-500 font-mono">
            Avg {stats.avgR >= 0 ? `+${stats.avgR}R` : `${stats.avgR}R`} / trade
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-[#0c1424] border border-[#182744]">
          <span className="text-[10px] text-slate-400 uppercase font-mono block">Active Tracking</span>
          <div className="text-2xl font-extrabold font-mono text-cyan-400 mt-0.5">
            {stats.active}
          </div>
          <span className="text-[10px] text-slate-500 font-mono">
            Live vs TV Ticks
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-[#0c1424] border border-[#182744]">
          <span className="text-[10px] text-slate-400 uppercase font-mono block">Total Logged</span>
          <div className="text-2xl font-extrabold font-mono text-white mt-0.5">
            {stats.total}
          </div>
          <span className="text-[10px] text-slate-500 font-mono">
            Auto + Manual Setups
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-[#0c1424] border border-[#182744] col-span-2 sm:col-span-1">
          <span className="text-[10px] text-slate-400 uppercase font-mono block">Current Spot</span>
          <div className="text-lg font-extrabold font-mono text-white mt-1 truncate">
            {currentTicker || 'XAU/USD'}
          </div>
          <span className="text-[10px] text-teal-400 font-mono">
            {currentPrice ? formatNum(currentPrice) : 'Synced Live'}
          </span>
        </div>
      </div>

      {/* Timeframe Accuracy Breakdown */}
      {stats.timeframeBreakdown.length > 0 && (
        <div className="p-3.5 rounded-xl bg-[#0c1424] border border-[#182744] space-y-2">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider font-mono font-bold flex items-center gap-1.5">
            <BarChart2 className="w-3.5 h-3.5 text-teal-400" />
            <span>Accuracy Breakdown by Timeframe</span>
          </span>
          <div className="flex flex-wrap gap-2">
            {stats.timeframeBreakdown.map((item) => (
              <div
                key={item.tf}
                className="px-3 py-1.5 rounded-lg bg-[#070b13] border border-[#162540] text-xs font-mono flex items-center gap-2.5"
              >
                <span className="font-bold text-white">{item.tf}</span>
                <span className="text-emerald-400">{item.wins}W</span>
                <span className="text-rose-400">{item.losses}L</span>
                {item.active > 0 && <span className="text-cyan-400">{item.active} Open</span>}
                <span className="text-slate-300 font-bold">
                  {item.winRate !== null ? `${item.winRate}%` : '—'}
                </span>
                <span className={item.totalR >= 0 ? 'text-[#0df2c9]' : 'text-rose-400'}>
                  {item.totalR >= 0 ? `+${item.totalR}R` : `${item.totalR}R`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 p-1 bg-[#070b13] border border-[#162540] rounded-xl text-xs">
          {[
            { id: 'ALL', label: `All (${stats.total})` },
            { id: 'ACTIVE', label: `Active (${stats.active})` },
            { id: 'WINS', label: `TP Hits (${stats.wins})` },
            { id: 'LOSSES', label: `Stopped (${stats.losses})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id as any)}
              className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                statusFilter === tab.id
                  ? 'bg-teal-500/20 text-[#0df2c9] border border-teal-500/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <span className="text-[11px] text-slate-500 font-mono">
          AI scans & Bot Studio setups auto-log here and resolve in real time
        </span>
      </div>

      {/* Tracked Signals Table */}
      {filteredSignals.length === 0 ? (
        <div className="p-8 rounded-xl bg-[#070b13] border border-dashed border-[#1b2d4d] text-center space-y-2">
          <Target className="w-8 h-8 text-teal-400 mx-auto opacity-80" />
          <div className="text-sm font-bold text-white">No tracked signals in this filter yet</div>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Click <strong className="text-[#0df2c9]">Track {currentTicker || 'Signal'}</strong> above, run an AI Scan in the EA Studio, or analyze any pair in the Radar to automatically audit live signal win rate.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#182744] max-h-[380px] overflow-y-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-[#070b13] text-slate-400 text-[10px] uppercase tracking-wider border-b border-[#182744] sticky top-0 z-10">
              <tr>
                <th className="py-2.5 px-3">Symbol / TF</th>
                <th className="py-2.5 px-3">Source</th>
                <th className="py-2.5 px-3">Direction</th>
                <th className="py-2.5 px-3 text-right">Entry</th>
                <th className="py-2.5 px-3 text-right">Stop Loss</th>
                <th className="py-2.5 px-3 text-right">TP1 / TP2</th>
                <th className="py-2.5 px-3 text-right">Live / Exit</th>
                <th className="py-2.5 px-3 text-center">Outcome</th>
                <th className="py-2.5 px-3 text-right">R-Mult</th>
                <th className="py-2.5 px-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#142038] bg-[#090f1d]">
              {filteredSignals.map((sig) => {
                const tvQ = lookupTradingViewQuote(liveTvQuotes, sig.symbol);
                const liveP = tvQ && tvQ.price > 0 ? tvQ.price : sig.entryPrice;
                const riskDist = Math.abs(sig.entryPrice - sig.sl) || 1;
                const liveR =
                  sig.direction === 'BUY'
                    ? (liveP - sig.entryPrice) / riskDist
                    : (sig.entryPrice - liveP) / riskDist;
                const displayR = typeof sig.realizedR === 'number' ? sig.realizedR : Number(liveR.toFixed(2));
                const isWin = sig.status === 'TP1_HIT' || sig.status === 'TP2_HIT';
                const isLoss = sig.status === 'STOPPED_OUT';

                return (
                  <tr key={sig.id} className="hover:bg-[#0e172a] transition-colors">
                    <td className="py-2.5 px-3">
                      <button
                        type="button"
                        onClick={() => onSelectSymbol?.(sig.symbol)}
                        className="font-bold text-white hover:text-[#0df2c9] flex items-center gap-1 cursor-pointer"
                      >
                        <span>{sig.symbol}</span>
                        <ArrowUpRight className="w-3 h-3 opacity-60" />
                      </button>
                      <span className="text-[10px] text-slate-400">
                        {sig.timeframe} • {new Date(sig.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 border border-slate-700">
                        {sig.source}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold inline-flex items-center gap-1 ${
                          sig.direction === 'BUY'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        }`}
                      >
                        {sig.direction === 'BUY' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {sig.action}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-200">{formatNum(sig.entryPrice)}</td>
                    <td className="py-2.5 px-3 text-right text-rose-300">{formatNum(sig.sl)}</td>
                    <td className="py-2.5 px-3 text-right text-emerald-300">
                      {formatNum(sig.tp1)} <span className="text-slate-500">/</span> {formatNum(sig.tp2)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-white">
                      {sig.resolvedPrice ? formatNum(sig.resolvedPrice) : formatNum(liveP)}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {sig.status === 'TP2_HIT' ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 inline-flex items-center gap-1">
                          <Sparkles className="w-3 h-3" /> TP2 HIT
                        </span>
                      ) : sig.status === 'TP1_HIT' ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-500/20 text-[#0df2c9] border border-teal-500/40 inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> TP1 HIT
                        </span>
                      ) : isLoss ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 inline-flex items-center gap-1">
                          <XCircle className="w-3 h-3" /> SL HIT
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 inline-flex items-center gap-1">
                          <Activity className="w-3 h-3 animate-pulse" /> ACTIVE
                        </span>
                      )}
                    </td>
                    <td
                      className={`py-2.5 px-3 text-right font-bold ${
                        isWin || displayR > 0 ? 'text-emerald-400' : isLoss || displayR < 0 ? 'text-rose-400' : 'text-slate-300'
                      }`}
                    >
                      {displayR >= 0 ? `+${displayR}R` : `${displayR}R`}
                    </td>
                    <td className="py-2.5 px-2 text-right">
                      <button
                        type="button"
                        onClick={() => deleteTrackedSignal(sig.id)}
                        className="p-1 text-slate-500 hover:text-rose-400 cursor-pointer"
                        title="Remove record"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
