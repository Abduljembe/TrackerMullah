import React, { useState, useEffect, useCallback } from 'react';
import {
  Play,
  Sparkles,
  TrendingUp,
  Award,
  Activity,
} from 'lucide-react';
import { generateCandles, enrichCandlesWithIndicators, Candle, Timeframe } from '../../utils/stockCandles.ts';
import { runSignalEngineBacktest } from '../../utils/signalEngine.ts';
import { fetchDerivCandlesOnce } from '../../utils/derivTechnicals.ts';

interface StrategyBacktesterProps {
  currentTicker: string;
  currentPrice: number;
}

type SessionBucket = 'Asian' | 'London' | 'LDN/NY Overlap' | 'New York';

interface SessionStat {
  session: SessionBucket;
  trades: number;
  wins: number;
  winRate: number;
  netPnl: number;
}

interface BacktestTradeLog {
  index: number;
  direction: 'BUY' | 'SELL';
  entry: number;
  exit: number;
  sl: number;
  tp: number;
  outcome: 'WIN' | 'LOSS';
  pnlDollars: number;
  timeLabel: string;
  session: SessionBucket;
}

interface BacktestResult {
  strategyKey: 'signalEnginePro' | 'trend' | 'breakout' | 'meanrevert' | 'momentum';
  strategyName: string;
  timeframe: string;
  barsEvaluated: number;
  dataSource: 'LIVE_OHLCV' | 'SYNTHETIC_FALLBACK';
  totalTrades: number;
  winCount: number;
  lossCount: number;
  winRate: number;
  initialCapital: number;
  endingCapital: number;
  netProfit: number;
  returnPercent: number;
  profitFactor: number;
  maxDrawdown: number;
  sharpeRatio: number;
  expectancyPerTrade: number;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  sessionStats: SessionStat[];
  equityCurve: number[];
  recentTrades: BacktestTradeLog[];
  aiAnalysis: {
    verdict: string;
    keyEdge: string;
    primaryRisk: string;
    recommendedSettings: string;
  };
}

function classifyUtcSession(unixSec: number): SessionBucket {
  const hour = new Date((unixSec || 0) * 1000).getUTCHours();
  if (hour >= 7 && hour < 13) return 'London';
  if (hour >= 13 && hour < 17) return 'LDN/NY Overlap';
  if (hour >= 17 && hour < 22) return 'New York';
  return 'Asian';
}

function calcRsiSeries(closes: number[], period = 14): number[] {
  const rsi: number[] = new Array(closes.length).fill(50);
  if (closes.length <= period) return rsi;
  let gainSum = 0;
  let lossSum = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gainSum += diff;
    else lossSum += Math.abs(diff);
  }
  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;
  rsi[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    rsi[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return rsi;
}

function runHistoricalCandleBacktest(
  ticker: string,
  rawCandles: Candle[],
  dataSource: 'LIVE_OHLCV' | 'SYNTHETIC_FALLBACK',
  strat: 'signalEnginePro' | 'trend' | 'breakout' | 'meanrevert' | 'momentum',
  tf: '15m' | '1H' | '1D',
  rr: '1:1.5' | '1:2.0' | '1:2.5' | '1:3.0' | '1:4.0' | '1:5.0',
  riskPct: number
): BacktestResult {
  if (strat === 'signalEnginePro') {
    const rep = runSignalEngineBacktest(ticker, tf, rawCandles);
    let capital = 10000;
    const equity: number[] = [capital];
    let peak = capital;
    let maxDd = 0;
    const wins = rep.tp1Hits;
    const losses = rep.fullLosses;
    const chronoTrades = [...rep.recentTrades].reverse();
    const tradeLogs: BacktestTradeLog[] = [];
    const returns: number[] = [];

    // Reconstruct approximate equity trajectory using average per-trade R across all trades or exact recent + proportional earlier steps
    const totalCount = Math.max(1, rep.totalTrades);
    const avgR = rep.totalTrades > 0 ? rep.netR / totalCount : 0;
    for (let idx = 0; idx < rep.totalTrades; idx++) {
      const rStep = idx >= rep.totalTrades - chronoTrades.length
        ? chronoTrades[idx - (rep.totalTrades - chronoTrades.length)].rMultiple
        : avgR;
      const riskAmt = capital * (riskPct / 100);
      capital += riskAmt * rStep;
      equity.push(Math.round(capital));
      returns.push(rStep * riskPct);
      if (capital > peak) peak = capital;
      const dd = ((peak - capital) / peak) * 100;
      if (dd > maxDd) maxDd = dd;
    }

    for (let idx = 0; idx < chronoTrades.length; idx++) {
      const t = chronoTrades[idx];
      const bar = rawCandles[t.barIndex];
      const pnlDollars = Number((10000 * (riskPct / 100) * t.rMultiple).toFixed(2));
      tradeLogs.push({
        index: idx + 1,
        direction: t.direction,
        entry: t.entry,
        exit: t.outcome === 'TP2_FULL' ? t.tp2 : t.outcome === 'TP1_BE' ? t.tp1 : t.sl,
        sl: t.sl,
        tp: t.tp2,
        outcome: t.rMultiple >= 0 ? 'WIN' : 'LOSS',
        pnlDollars,
        timeLabel: t.timeLabel || bar?.timeLabel || `Bar ${t.barIndex}`,
        session: classifyUtcSession(bar?.time || 0),
      });
    }

    const sessionMap = new Map<SessionBucket, { trades: number; wins: number; netPnl: number }>([
      ['Asian', { trades: 0, wins: 0, netPnl: 0 }],
      ['London', { trades: 0, wins: 0, netPnl: 0 }],
      ['LDN/NY Overlap', { trades: 0, wins: 0, netPnl: 0 }],
      ['New York', { trades: 0, wins: 0, netPnl: 0 }],
    ]);
    let curW = 0;
    let curL = 0;
    let maxW = 0;
    let maxL = 0;
    for (const tl of tradeLogs) {
      if (tl.outcome === 'WIN') {
        curW++; curL = 0; maxW = Math.max(maxW, curW);
      } else {
        curL++; curW = 0; maxL = Math.max(maxL, curL);
      }
      const b = sessionMap.get(tl.session)!;
      b.trades++;
      if (tl.outcome === 'WIN') b.wins++;
      b.netPnl = Math.round((b.netPnl + tl.pnlDollars) * 100) / 100;
    }

    const netProfit = Number((capital - 10000).toFixed(2));
    const returnPct = Number((((capital - 10000) / 10000) * 100).toFixed(1));
    const meanRet = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
    const varRet = returns.length > 1 ? returns.reduce((a, b) => a + (b - meanRet) ** 2, 0) / returns.length : 1;
    const sharpe = rep.totalTrades > 0 ? Number(((meanRet / (Math.sqrt(varRet) || 1)) * Math.sqrt(Math.min(252, rep.totalTrades))).toFixed(2)) : 0;

    return {
      strategyKey: 'signalEnginePro',
      strategyName: 'Signal Engine Pro (HTF + Anti-Chop + TP1 Auto-BE)',
      timeframe: tf,
      barsEvaluated: rep.barsEvaluated,
      dataSource,
      totalTrades: rep.totalTrades,
      winCount: wins,
      lossCount: losses,
      winRate: rep.tp1HitRate,
      initialCapital: 10000,
      endingCapital: Math.round(capital),
      netProfit,
      returnPercent: returnPct,
      profitFactor: rep.profitFactor,
      maxDrawdown: Number(Math.max(maxDd, rep.maxDrawdownR * riskPct).toFixed(1)),
      sharpeRatio: sharpe,
      expectancyPerTrade: rep.totalTrades > 0 ? Math.round((netProfit / rep.totalTrades) * 100) / 100 : 0,
      maxConsecutiveWins: maxW,
      maxConsecutiveLosses: maxL,
      sessionStats: Array.from(sessionMap.entries()).map(([session, s]) => ({
        session,
        trades: s.trades,
        wins: s.wins,
        winRate: s.trades > 0 ? Math.round((s.wins / s.trades) * 100) : 0,
        netPnl: s.netPnl,
      })),
      equityCurve: equity,
      recentTrades: tradeLogs.slice().reverse(),
      aiAnalysis: {
        verdict:
          rep.totalTrades === 0
            ? `No qualifying A/A+ candle-triggered setups passed Anti-Chop Efficiency Filter on ${tf}.`
            : `${rep.tp1HitRate}% TP1 Hit Rate (${rep.tp2HitRate}% TP2 Full, ${rep.beSaves} Auto-BE Saves, ${rep.netR >= 0 ? '+' : ''}${rep.netR}R net) across ${rep.totalTrades} signals.`,
        keyEdge: 'Replays exact EMA20/50 + RSI + Directional Efficiency Anti-Chop + Engulfing/Pinbar Confirmation + 60% TP1 Partial Close + Auto-Breakeven SL + TP2 Runner rules.',
        primaryRisk: 'Consecutive reversals before TP1 triggers Auto-BE, or spread slippage during high-impact Forex Factory news.',
        recommendedSettings: `Run ${riskPct}% risk with TP1 Auto-Breakeven enabled and Red-Folder News Blackout Guard ON.`,
      },
    };
  }

  const enriched = enrichCandlesWithIndicators(rawCandles);
  const closes = enriched.map((c) => c.close);
  const rsiSeries = calcRsiSeries(closes, 14);
  const rrMultiplier = Math.min(5.0, parseFloat(rr.split(':')[1]) || 2.0);

  let stratTitle = 'EMA 20/50 Trend Confluence + RSI Filter';
  if (strat === 'breakout') stratTitle = '12-Bar Donchian High/Low Liquidity Breakout';
  else if (strat === 'meanrevert') stratTitle = 'Bollinger Band Extremes + RSI Mean Reversion';
  else if (strat === 'momentum') stratTitle = 'Candle Displacement & Volume Impulse Scalp';

  let capital = 10000;
  const equity: number[] = [capital];
  let wins = 0;
  let losses = 0;
  let grossWin = 0;
  let grossLoss = 0;
  let peak = capital;
  let maxDd = 0;
  const tradeReturns: number[] = [];
  const tradeLogs: BacktestTradeLog[] = [];

  let i = 20;
  while (i < enriched.length - 2) {
    const c = enriched[i];
    const prev = enriched[i - 1];
    const ema20 = c.ema20 || c.close;
    const ema50 = c.ema50 || c.close;
    const rsi = rsiSeries[i] ?? 50;

    // 14-bar ATR approximation
    let atrSum = 0;
    for (let k = Math.max(1, i - 13); k <= i; k++) {
      atrSum += Math.max(enriched[k].high - enriched[k].low, Math.abs(enriched[k].close - enriched[k - 1].close));
    }
    const atr = Math.max(c.close * 0.0005, atrSum / 14);

    let signalDir: 'BUY' | 'SELL' | null = null;
    if (strat === 'trend') {
      if (ema20 > ema50 && c.close > ema20 && rsi >= 50 && rsi <= 72) signalDir = 'BUY';
      else if (ema20 < ema50 && c.close < ema20 && rsi <= 50 && rsi >= 28) signalDir = 'SELL';
    } else if (strat === 'breakout') {
      const lookWindow = enriched.slice(Math.max(0, i - 12), i);
      const hi = Math.max(...lookWindow.map((b) => b.high));
      const lo = Math.min(...lookWindow.map((b) => b.low));
      if (c.close > hi) signalDir = 'BUY';
      else if (c.close < lo) signalDir = 'SELL';
    } else if (strat === 'meanrevert') {
      if (c.bbLower && c.close <= c.bbLower && rsi <= 36) signalDir = 'BUY';
      else if (c.bbUpper && c.close >= c.bbUpper && rsi >= 64) signalDir = 'SELL';
    } else {
      const body = Math.abs(c.close - c.open);
      const prevBody = Math.abs(prev.close - prev.open) || body;
      if (c.close > c.open && body >= atr * 0.7 && body > prevBody * 1.15 && rsi >= 52) signalDir = 'BUY';
      else if (c.close < c.open && body >= atr * 0.7 && body > prevBody * 1.15 && rsi <= 48) signalDir = 'SELL';
    }

    if (!signalDir) {
      i++;
      continue;
    }

    const entry = c.close;
    const slDist = atr * 1.35;
    const tpDist = slDist * rrMultiplier;
    const sl = signalDir === 'BUY' ? entry - slDist : entry + slDist;
    const tp = signalDir === 'BUY' ? entry + tpDist : entry - tpDist;

    let outcome: 'WIN' | 'LOSS' | null = null;
    let exitPrice = entry;
    let exitBarIdx = i + 1;

    for (let j = i + 1; j < enriched.length; j++) {
      const bar = enriched[j];
      if (signalDir === 'BUY') {
        if (bar.low <= sl) {
          outcome = 'LOSS';
          exitPrice = sl;
          exitBarIdx = j;
          break;
        }
        if (bar.high >= tp) {
          outcome = 'WIN';
          exitPrice = tp;
          exitBarIdx = j;
          break;
        }
      } else {
        if (bar.high >= sl) {
          outcome = 'LOSS';
          exitPrice = sl;
          exitBarIdx = j;
          break;
        }
        if (bar.low <= tp) {
          outcome = 'WIN';
          exitPrice = tp;
          exitBarIdx = j;
          break;
        }
      }
    }

    if (!outcome) {
      // Mark-to-market at end of window
      const lastClose = enriched[enriched.length - 1].close;
      const rMultiple = signalDir === 'BUY' ? (lastClose - entry) / slDist : (entry - lastClose) / slDist;
      const riskAmt = capital * (riskPct / 100);
      const pnl = Number((riskAmt * rMultiple).toFixed(2));
      if (pnl >= 0) {
        wins++;
        grossWin += pnl;
        outcome = 'WIN';
      } else {
        losses++;
        grossLoss += Math.abs(pnl);
        outcome = 'LOSS';
      }
      capital += pnl;
      tradeReturns.push(rMultiple * riskPct);
      const session = classifyUtcSession(c.time);
      tradeLogs.push({
        index: tradeLogs.length + 1,
        direction: signalDir,
        entry,
        exit: lastClose,
        sl,
        tp,
        outcome,
        pnlDollars: pnl,
        timeLabel: c.timeLabel || `Bar ${i}`,
        session,
      });
      equity.push(Math.round(capital));
      if (capital > peak) peak = capital;
      const dd = ((peak - capital) / peak) * 100;
      if (dd > maxDd) maxDd = dd;
      break;
    }

    const riskAmt = capital * (riskPct / 100);
    const pnl = outcome === 'WIN' ? Number((riskAmt * rrMultiplier).toFixed(2)) : Number((-riskAmt).toFixed(2));
    if (outcome === 'WIN') {
      wins++;
      grossWin += pnl;
      tradeReturns.push(riskPct * rrMultiplier);
    } else {
      losses++;
      grossLoss += riskAmt;
      tradeReturns.push(-riskPct);
    }
    capital += pnl;
    equity.push(Math.round(capital));
    if (capital > peak) peak = capital;
    const dd = ((peak - capital) / peak) * 100;
    if (dd > maxDd) maxDd = dd;

    tradeLogs.push({
      index: tradeLogs.length + 1,
      direction: signalDir,
      entry,
      exit: exitPrice,
      sl,
      tp,
      outcome,
      pnlDollars: pnl,
      timeLabel: c.timeLabel || `Bar ${i}`,
      session: classifyUtcSession(c.time),
    });

    // Advance past resolved exit bar so trades don't overlap identically
    i = exitBarIdx + 1;
  }

  let curWinStreak = 0;
  let curLossStreak = 0;
  let maxConsecutiveWins = 0;
  let maxConsecutiveLosses = 0;
  const sessionMap = new Map<SessionBucket, { trades: number; wins: number; netPnl: number }>([
    ['Asian', { trades: 0, wins: 0, netPnl: 0 }],
    ['London', { trades: 0, wins: 0, netPnl: 0 }],
    ['LDN/NY Overlap', { trades: 0, wins: 0, netPnl: 0 }],
    ['New York', { trades: 0, wins: 0, netPnl: 0 }],
  ]);

  for (const t of tradeLogs) {
    if (t.outcome === 'WIN') {
      curWinStreak++;
      curLossStreak = 0;
      if (curWinStreak > maxConsecutiveWins) maxConsecutiveWins = curWinStreak;
    } else {
      curLossStreak++;
      curWinStreak = 0;
      if (curLossStreak > maxConsecutiveLosses) maxConsecutiveLosses = curLossStreak;
    }
    const bucket = sessionMap.get(t.session)!;
    bucket.trades += 1;
    if (t.outcome === 'WIN') bucket.wins += 1;
    bucket.netPnl = Math.round((bucket.netPnl + t.pnlDollars) * 100) / 100;
  }

  const sessionStats: SessionStat[] = Array.from(sessionMap.entries()).map(([session, s]) => ({
    session,
    trades: s.trades,
    wins: s.wins,
    winRate: s.trades > 0 ? Math.round((s.wins / s.trades) * 100) : 0,
    netPnl: s.netPnl,
  }));

  const totalTrades = wins + losses;
  const netProfit = Number((capital - 10000).toFixed(2));
  const returnPct = Number((((capital - 10000) / 10000) * 100).toFixed(1));
  const winRate = totalTrades > 0 ? Math.round((wins / totalTrades) * 100) : 0;
  const profitFactor = grossLoss > 0 ? Number((grossWin / grossLoss).toFixed(2)) : grossWin > 0 ? 3.5 : 0;

  const meanRet = tradeReturns.length > 0 ? tradeReturns.reduce((a, b) => a + b, 0) / tradeReturns.length : 0;
  const variance =
    tradeReturns.length > 1
      ? tradeReturns.reduce((a, b) => a + Math.pow(b - meanRet, 2), 0) / tradeReturns.length
      : 1;
  const stdDev = Math.sqrt(variance) || 1;
  const sharpe = totalTrades > 0 ? Number(((meanRet / stdDev) * Math.sqrt(Math.min(252, totalTrades))).toFixed(2)) : 0;

  const expectancyPerTrade = totalTrades > 0 ? Math.round((netProfit / totalTrades) * 100) / 100 : 0;

  return {
    strategyKey: strat,
    strategyName: stratTitle,
    timeframe: tf,
    barsEvaluated: enriched.length,
    dataSource,
    totalTrades,
    winCount: wins,
    lossCount: losses,
    winRate,
    initialCapital: 10000,
    endingCapital: Math.round(capital),
    netProfit,
    returnPercent: returnPct,
    profitFactor,
    maxDrawdown: Number(maxDd.toFixed(1)),
    sharpeRatio: sharpe,
    expectancyPerTrade,
    maxConsecutiveWins,
    maxConsecutiveLosses,
    sessionStats,
    equityCurve: equity,
    recentTrades: tradeLogs.slice(-8).reverse(),
    aiAnalysis: {
      verdict:
        totalTrades === 0
          ? `No qualifying triggers found in the last ${enriched.length} ${tf} bars — try Momentum or Trend strategy.`
          : returnPct > 8
          ? `Positive Historical Edge on ${ticker} (${tf}) — +${returnPct}% across ${totalTrades} verified setups`
          : returnPct >= 0
          ? `Modest Positive Expectancy (${returnPct >= 0 ? '+' : ''}${returnPct}%) — tight spread & session timing critical`
          : `Negative Historical Expectancy (${returnPct}%) on ${tf} — tighten R:R or switch strategy`,
      keyEdge:
        strat === 'trend'
          ? `Evaluated ${enriched.length} historical ${tf} bars using EMA 20/50 trend filters + 1.35x ATR structural stops.`
          : strat === 'breakout'
          ? `Tested 12-bar Donchian High/Low expansion triggers with ${rr} capped payoff targets.`
          : strat === 'meanrevert'
          ? `Evaluated Bollinger Band extremes paired with RSI exhaustion entries.`
          : `Measured real candle displacement bodies >= 0.7x ATR with directional RSI filter.`,
      primaryRisk:
        'Live execution depends on spread widening during high-impact Forex Factory news & session rollovers.',
      recommendedSettings: `Test ${riskPct}% risk per trade with ${rr} target (strictly capped <= 1:5.0).`,
    },
  };
}

export const StrategyBacktester: React.FC<StrategyBacktesterProps> = ({
  currentTicker,
  currentPrice,
}) => {
  const [strategy, setStrategy] = useState<'signalEnginePro' | 'trend' | 'breakout' | 'meanrevert' | 'momentum'>('signalEnginePro');
  const [timeframe, setTimeframe] = useState<'15m' | '1H' | '1D'>('1H');
  const [targetRr, setTargetRr] = useState<'1:1.5' | '1:2.0' | '1:2.5' | '1:3.0' | '1:4.0' | '1:5.0'>('1:2.0');
  const [riskPerTrade, setRiskPerTrade] = useState<number>(1.5);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isOptimizing, setIsOptimizing] = useState<boolean>(false);
  const [optimizerSummary, setOptimizerSummary] = useState<string | null>(null);
  const [result, setResult] = useState<BacktestResult | null>(null);

  const fetchCandlesForBacktest = useCallback(async (): Promise<{ candles: Candle[]; source: 'LIVE_OHLCV' | 'SYNTHETIC_FALLBACK' }> => {
    try {
      const clean = currentTicker.replace('/', '').toUpperCase();
      if (/^(R_|1HZ|BOOM|CRASH|STP|JD|RB)/.test(clean)) {
        const sec = timeframe === '1D' ? 86400 : timeframe === '1H' ? 3600 : 900;
        const derivBars = await fetchDerivCandlesOnce(clean, sec, 120);
        if (derivBars.length >= 25) {
          return {
            candles: derivBars.map((b, i) => {
              const d = b.time ? new Date(b.time * 1000) : new Date();
              const timeLabel = b.time ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : `Bar ${i}`;
              return {
                time: b.time || i,
                timeLabel,
                fullDate: b.time ? `${d.toLocaleDateString()} ${timeLabel}` : `Bar ${i}`,
                open: b.open,
                high: b.high,
                low: b.low,
                close: b.close,
                volume: 0,
              };
            }),
            source: 'LIVE_OHLCV',
          };
        }
      }
      const res = await fetch(
        `/api/stocks/history?ticker=${encodeURIComponent(currentTicker)}&timeframe=${encodeURIComponent(timeframe)}`
      );
      const data = res.ok ? await res.json() : null;
      if (data?.success && Array.isArray(data.candles) && data.candles.length >= 25) {
        return { candles: data.candles, source: 'LIVE_OHLCV' };
      }
    } catch {}
    return {
      candles: generateCandles(currentTicker, currentPrice || 100, 0, timeframe as Timeframe),
      source: 'SYNTHETIC_FALLBACK',
    };
  }, [currentTicker, currentPrice, timeframe]);

  const executeHistoricalBacktest = useCallback(async () => {
    setIsRunning(true);
    setOptimizerSummary(null);
    try {
      const { candles, source } = await fetchCandlesForBacktest();
      const computed = runHistoricalCandleBacktest(
        currentTicker,
        candles,
        source,
        strategy,
        timeframe,
        targetRr,
        riskPerTrade
      );
      setResult(computed);
    } finally {
      setIsRunning(false);
    }
  }, [currentTicker, strategy, timeframe, targetRr, riskPerTrade, fetchCandlesForBacktest]);

  const executeStrategyOptimizer = useCallback(async () => {
    setIsOptimizing(true);
    try {
      const { candles, source } = await fetchCandlesForBacktest();
      const allStrats: Array<'signalEnginePro' | 'trend' | 'breakout' | 'meanrevert' | 'momentum'> = [
        'signalEnginePro',
        'trend',
        'breakout',
        'meanrevert',
        'momentum',
      ];
      const candidates = allStrats.map((s) =>
        runHistoricalCandleBacktest(currentTicker, candles, source, s, timeframe, targetRr, riskPerTrade)
      );
      candidates.sort((a, b) => b.netProfit - a.netProfit || b.winRate - a.winRate);
      const winner = candidates[0];
      if (winner) {
        setStrategy(winner.strategyKey);
        setResult(winner);
        setOptimizerSummary(
          `Best Edge Selected: ${winner.strategyName} (${winner.returnPercent >= 0 ? '+' : ''}${winner.returnPercent}% | ${winner.winRate}% Win Rate across ${winner.totalTrades} trades)`
        );
      }
    } finally {
      setIsOptimizing(false);
    }
  }, [currentTicker, timeframe, targetRr, riskPerTrade, fetchCandlesForBacktest]);

  // Auto-run when ticker changes so metrics always belong to the active chart
  useEffect(() => {
    executeHistoricalBacktest();
  }, [currentTicker]);

  // SVG Geometry for Backtest Equity Curve
  const minEq = result ? Math.min(...result.equityCurve, 9800) : 10000;
  const maxEq = result ? Math.max(...result.equityCurve, 10500) : 11000;
  const range = maxEq - minEq || 1;
  const svgWidth = 600;
  const svgHeight = 150;
  const pad = 15;

  const pathD =
    result && result.equityCurve.length > 1
      ? result.equityCurve
          .map((val, idx) => {
            const x = pad + (idx / (result.equityCurve.length - 1 || 1)) * (svgWidth - pad * 2);
            const y = svgHeight - pad - ((val - minEq) / range) * (svgHeight - pad * 2);
            return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
          })
          .join(' ')
      : `M ${pad} ${svgHeight / 2} L ${svgWidth - pad} ${svgHeight / 2}`;

  const fmtPrice = (v: number) => (v < 10 ? v.toFixed(5) : v < 250 ? v.toFixed(3) : v.toFixed(2));

  return (
    <div className="rounded-2xl bg-[#090e1a] border border-[#162540] overflow-hidden p-5 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#141f33] pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white flex flex-wrap items-center gap-2">
              Historical OHLCV Strategy Backtester
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded border font-bold ${
                  result?.dataSource === 'LIVE_OHLCV'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                }`}
              >
                {result?.dataSource === 'LIVE_OHLCV'
                  ? `REAL HISTORICAL BARS (${result.barsEvaluated})`
                  : 'STRUCTURAL FALLBACK BARS'}
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Bar-by-bar backtest of {currentTicker} on {timeframe} OHLCV candles with SL/TP hit replay
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={executeStrategyOptimizer}
            disabled={isRunning || isOptimizing}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#101c31] hover:bg-[#162744] border border-teal-500/40 text-[#0df2c9] font-semibold text-xs transition-all cursor-pointer disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {isOptimizing ? 'Scanning Strategies...' : 'Auto-Find Best Edge'}
          </button>

          <button
            onClick={executeHistoricalBacktest}
            disabled={isRunning || isOptimizing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-[#070b13] font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all cursor-pointer disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            {isRunning ? 'Backtesting Candles...' : 'Run Historical Backtest'}
          </button>
        </div>
      </div>

      {optimizerSummary && (
        <div className="px-3.5 py-2 rounded-xl bg-teal-950/35 border border-teal-500/40 text-[#0df2c9] text-xs font-mono">
          {optimizerSummary}
        </div>
      )}

      {/* Control Parameters Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-3.5 rounded-xl bg-[#0d1627] border border-[#182744] text-xs">
        {/* Strategy selection */}
        <div>
          <label className="text-[11px] text-slate-400 font-medium block mb-1">Trading Strategy</label>
          <select
            value={strategy}
            onChange={(e) => setStrategy(e.target.value as any)}
            className="w-full px-2.5 py-1.5 rounded-lg bg-[#070b13] border border-[#162540] text-xs text-white focus:outline-none focus:border-emerald-400"
          >
            <option value="signalEnginePro">Signal Engine Pro (HTF + Anti-Chop + TP1 Auto-BE)</option>
            <option value="trend">EMA 20/50 Trend Confluence + RSI</option>
            <option value="breakout">12-Bar Donchian High/Low Breakout</option>
            <option value="meanrevert">Bollinger + RSI Mean Reversion</option>
            <option value="momentum">ATR Displacement Impulse Scalp</option>
          </select>
        </div>

        {/* Candle Timeframe */}
        <div>
          <label className="text-[11px] text-slate-400 font-medium block mb-1">Candle Timeframe</label>
          <div className="grid grid-cols-3 gap-1 p-1 bg-[#070b13] border border-[#162540] rounded-lg">
            {(['15m', '1H', '1D'] as const).map((tf) => (
              <button
                key={tf}
                type="button"
                onClick={() => setTimeframe(tf)}
                className={`py-1 text-xs font-bold rounded transition-colors cursor-pointer ${
                  timeframe === tf
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>

        {/* Target R:R (Strictly <= 1:5.0) */}
        <div>
          <label className="text-[11px] text-slate-400 font-medium block mb-1">Target R:R (Max 1:5.0)</label>
          <select
            value={targetRr}
            onChange={(e) => setTargetRr(e.target.value as any)}
            className="w-full px-2.5 py-1.5 rounded-lg bg-[#070b13] border border-[#162540] text-xs text-white focus:outline-none focus:border-emerald-400"
          >
            <option value="1:1.5">1:1.5 (High Win Rate)</option>
            <option value="1:2.0">1:2.0 (Balanced Standard)</option>
            <option value="1:2.5">1:2.5 (Extended Runner)</option>
            <option value="1:3.0">1:3.0 (Trend Payoff)</option>
            <option value="1:4.0">1:4.0 (Swing Expansion)</option>
            <option value="1:5.0">1:5.0 (Strict Max Cap)</option>
          </select>
        </div>

        {/* Risk % per trade */}
        <div>
          <label className="text-[11px] text-slate-400 font-medium block mb-1">Risk per Trade (%)</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              step="0.5"
              min="0.5"
              max="5"
              value={riskPerTrade}
              onChange={(e) => setRiskPerTrade(Math.max(0.5, Math.min(5, parseFloat(e.target.value) || 1)))}
              className="w-full px-2.5 py-1.5 rounded-lg bg-[#070b13] border border-[#162540] text-xs font-mono text-white focus:outline-none focus:border-emerald-400"
            />
            <span className="text-xs font-mono text-slate-400">%</span>
          </div>
        </div>
      </div>

      {/* Result Metrics */}
      {result && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-3.5 rounded-xl bg-[#0c1424] border border-[#182744]">
              <span className="text-[10px] text-slate-400 uppercase font-mono block">Backtest Return</span>
              <div
                className={`text-xl font-extrabold font-mono mt-0.5 ${
                  result.returnPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {result.returnPercent >= 0 ? '+' : ''}{result.returnPercent}%
              </div>
              <span className="text-[10px] text-slate-500 font-mono">
                {result.netProfit >= 0 ? '+' : ''}${result.netProfit.toLocaleString()}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-[#0c1424] border border-[#182744]">
              <span className="text-[10px] text-slate-400 uppercase font-mono block">Win Rate</span>
              <div className="text-xl font-extrabold font-mono text-cyan-400 mt-0.5">
                {result.winRate}%
              </div>
              <span className="text-[10px] text-slate-500 font-mono">
                {result.winCount}W / {result.lossCount}L ({result.totalTrades} trades)
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-[#0c1424] border border-[#182744]">
              <span className="text-[10px] text-slate-400 uppercase font-mono block">Profit Factor</span>
              <div className="text-xl font-extrabold font-mono text-purple-400 mt-0.5">
                {result.profitFactor}x
              </div>
              <span className="text-[10px] text-slate-500 font-mono">
                Gross Win / Loss
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-[#0c1424] border border-[#182744]">
              <span className="text-[10px] text-slate-400 uppercase font-mono block">Max Drawdown</span>
              <div className="text-xl font-extrabold font-mono text-amber-400 mt-0.5">
                {result.maxDrawdown}%
              </div>
              <span className="text-[10px] text-slate-500 font-mono">
                Historical Peak Dip
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-[#0c1424] border border-[#182744]">
              <span className="text-[10px] text-slate-400 uppercase font-mono block">Sharpe Ratio</span>
              <div className="text-xl font-extrabold font-mono text-emerald-300 mt-0.5">
                {result.sharpeRatio}
              </div>
              <span className="text-[10px] text-slate-500 font-mono">
                Risk-Adjusted Alpha
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-[#0c1424] border border-[#182744]">
              <span className="text-[10px] text-slate-400 uppercase font-mono block">Final Balance</span>
              <div className="text-xl font-extrabold font-mono text-white mt-0.5">
                ${result.endingCapital.toLocaleString()}
              </div>
              <span className="text-[10px] text-slate-500 font-mono">
                From $10,000 Start
              </span>
            </div>
          </div>

          {/* Equity Trajectory Chart */}
          <div className="p-4 rounded-xl bg-[#0c1424] border border-[#182744] space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                Historical Equity Curve ({result.barsEvaluated} {result.timeframe} Bars • {result.totalTrades} Trades)
              </span>
              <span className="text-xs font-mono text-emerald-400 font-bold">
                {result.strategyName}
              </span>
            </div>

            <div className="relative w-full h-[150px] overflow-hidden rounded-lg bg-[#070b13] border border-[#142036]">
              <svg className="w-full h-full" viewBox={`0 0 ${svgWidth} ${svgHeight}`} preserveAspectRatio="none">
                <line x1="0" y1={svgHeight * 0.33} x2={svgWidth} y2={svgHeight * 0.33} stroke="#142036" strokeDasharray="3 3" />
                <line x1="0" y1={svgHeight * 0.66} x2={svgWidth} y2={svgHeight * 0.66} stroke="#142036" strokeDasharray="3 3" />
                <path
                  d={pathD}
                  fill="none"
                  stroke={result.returnPercent >= 0 ? '#10b981' : '#f43f5e'}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>

          {/* Session Analytics & Streak Health */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-[#0c1424] border border-[#182744] space-y-2">
              <span className="text-[11px] font-bold text-white uppercase tracking-wider block">
                Expectancy &amp; Streaks
              </span>
              <div className="grid grid-cols-3 gap-2 text-xs font-mono tabular-nums pt-1">
                <div className="p-2 rounded-lg bg-[#080f1d] border border-[#142036]">
                  <span className="text-[10px] text-slate-400 block">Expectancy</span>
                  <span className={`font-bold ${result.expectancyPerTrade >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {result.expectancyPerTrade >= 0 ? '+' : '-'}${Math.abs(result.expectancyPerTrade)}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-[#080f1d] border border-[#142036]">
                  <span className="text-[10px] text-slate-400 block">Max Win Strk</span>
                  <span className="font-bold text-emerald-300">{result.maxConsecutiveWins}W</span>
                </div>
                <div className="p-2 rounded-lg bg-[#080f1d] border border-[#142036]">
                  <span className="text-[10px] text-slate-400 block">Max Loss Strk</span>
                  <span className="font-bold text-rose-300">{result.maxConsecutiveLosses}L</span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 p-3.5 rounded-xl bg-[#0c1424] border border-[#182744] space-y-2">
              <span className="text-[11px] font-bold text-white uppercase tracking-wider block">
                Session Performance Breakdown (UTC)
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono tabular-nums">
                {result.sessionStats.map((s) => (
                  <div key={s.session} className="p-2 rounded-lg bg-[#080f1d] border border-[#142036]">
                    <span className="text-[10px] text-slate-400 block truncate">{s.session}</span>
                    <div className="flex items-baseline justify-between mt-0.5">
                      <span className="font-bold text-white">{s.winRate}%</span>
                      <span className={`text-[11px] font-bold ${s.netPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {s.netPnl >= 0 ? `+$${s.netPnl}` : `-$${Math.abs(s.netPnl)}`}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500">{s.trades} trades</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recent Bar-by-Bar Replay Trade Audit Log */}
          {result.recentTrades.length > 0 && (
            <div className="p-4 rounded-xl bg-[#0c1424] border border-[#182744] space-y-2">
              <div className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-cyan-400" />
                <span>Recent Historical Trigger Replay (Last {result.recentTrades.length} Trades)</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[11px] font-mono">
                  <thead className="text-slate-400 border-b border-[#172642]">
                    <tr>
                      <th className="py-1.5 px-2">#</th>
                      <th className="py-1.5 px-2">Bar Time</th>
                      <th className="py-1.5 px-2">Side</th>
                      <th className="py-1.5 px-2 text-right">Entry</th>
                      <th className="py-1.5 px-2 text-right">SL</th>
                      <th className="py-1.5 px-2 text-right">TP</th>
                      <th className="py-1.5 px-2 text-right">Exit</th>
                      <th className="py-1.5 px-2 text-center">Result</th>
                      <th className="py-1.5 px-2 text-right">P&L</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#132038]">
                    {result.recentTrades.map((t) => (
                      <tr key={t.index} className="hover:bg-[#101a2f]">
                        <td className="py-1.5 px-2 text-slate-400">{t.index}</td>
                        <td className="py-1.5 px-2 text-slate-300">{t.timeLabel}</td>
                        <td className="py-1.5 px-2">
                          <span className={t.direction === 'BUY' ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                            {t.direction}
                          </span>
                        </td>
                        <td className="py-1.5 px-2 text-right text-white">{fmtPrice(t.entry)}</td>
                        <td className="py-1.5 px-2 text-right text-rose-300">{fmtPrice(t.sl)}</td>
                        <td className="py-1.5 px-2 text-right text-emerald-300">{fmtPrice(t.tp)}</td>
                        <td className="py-1.5 px-2 text-right text-slate-200">{fmtPrice(t.exit)}</td>
                        <td className="py-1.5 px-2 text-center">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              t.outcome === 'WIN'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-rose-500/20 text-rose-300'
                            }`}
                          >
                            {t.outcome}
                          </span>
                        </td>
                        <td className={`py-1.5 px-2 text-right font-bold ${t.pnlDollars >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {t.pnlDollars >= 0 ? `+$${t.pnlDollars}` : `-$${Math.abs(t.pnlDollars)}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* AI Quantitative Verdict Card */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-[#0c182d] to-[#070d18] border border-[#1a2f52] space-y-2">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Quantitative Backtest Audit & Edge Summary
              </span>
            </div>
            <p className="text-xs text-emerald-300 font-semibold">{result.aiAnalysis.verdict}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-1">
              <div className="p-2.5 rounded-lg bg-[#080f1d] border border-[#162540]">
                <span className="text-[10px] text-slate-400 uppercase font-mono block">Verified Method</span>
                <span className="text-slate-200 mt-0.5 block">{result.aiAnalysis.keyEdge}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-[#080f1d] border border-[#162540]">
                <span className="text-[10px] text-rose-400 uppercase font-mono block">Vulnerability Warning</span>
                <span className="text-slate-200 mt-0.5 block">{result.aiAnalysis.primaryRisk}</span>
              </div>
            </div>
            <p className="text-[11px] font-mono text-slate-400 pt-1">
              ⚡ Recommendation: <strong className="text-white">{result.aiAnalysis.recommendedSettings}</strong>
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
