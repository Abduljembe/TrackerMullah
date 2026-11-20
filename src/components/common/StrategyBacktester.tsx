import React, { useState, useEffect, useCallback } from 'react';
import {
  Play,
  Sparkles,
  TrendingUp,
  Award,
  Activity,
} from 'lucide-react';
import { generateCandles, enrichCandlesWithIndicators, Candle, Timeframe } from '../../utils/stockCandles.ts';

interface StrategyBacktesterProps {
  currentTicker: string;
  currentPrice: number;
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
}

interface BacktestResult {
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
  equityCurve: number[];
  recentTrades: BacktestTradeLog[];
  aiAnalysis: {
    verdict: string;
    keyEdge: string;
    primaryRisk: string;
    recommendedSettings: string;
  };
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
  strat: 'trend' | 'breakout' | 'meanrevert' | 'momentum',
  tf: '15m' | '1H' | '1D',
  rr: '1:1.5' | '1:2.0' | '1:2.5' | '1:3.0' | '1:4.0' | '1:5.0',
  riskPct: number
): BacktestResult {
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
    });

    // Advance past resolved exit bar so trades don't overlap identically
    i = exitBarIdx + 1;
  }

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

  return {
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
  const [strategy, setStrategy] = useState<'trend' | 'breakout' | 'meanrevert' | 'momentum'>('trend');
  const [timeframe, setTimeframe] = useState<'15m' | '1H' | '1D'>('1H');
  const [targetRr, setTargetRr] = useState<'1:1.5' | '1:2.0' | '1:2.5' | '1:3.0' | '1:4.0' | '1:5.0'>('1:2.0');
  const [riskPerTrade, setRiskPerTrade] = useState<number>(1.5);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [result, setResult] = useState<BacktestResult | null>(null);

  const executeHistoricalBacktest = useCallback(async () => {
    setIsRunning(true);
    try {
      const res = await fetch(
        `/api/stocks/history?ticker=${encodeURIComponent(currentTicker)}&timeframe=${encodeURIComponent(timeframe)}`
      );
      const data = res.ok ? await res.json() : null;
      if (data?.success && Array.isArray(data.candles) && data.candles.length >= 25) {
        const computed = runHistoricalCandleBacktest(
          currentTicker,
          data.candles,
          'LIVE_OHLCV',
          strategy,
          timeframe,
          targetRr,
          riskPerTrade
        );
        setResult(computed);
      } else {
        const fallback = generateCandles(currentTicker, currentPrice || 100, 0, timeframe as Timeframe);
        const computed = runHistoricalCandleBacktest(
          currentTicker,
          fallback,
          'SYNTHETIC_FALLBACK',
          strategy,
          timeframe,
          targetRr,
          riskPerTrade
        );
        setResult(computed);
      }
    } catch {
      const fallback = generateCandles(currentTicker, currentPrice || 100, 0, timeframe as Timeframe);
      const computed = runHistoricalCandleBacktest(
        currentTicker,
        fallback,
        'SYNTHETIC_FALLBACK',
        strategy,
        timeframe,
        targetRr,
        riskPerTrade
      );
      setResult(computed);
    } finally {
      setIsRunning(false);
    }
  }, [currentTicker, currentPrice, strategy, timeframe, targetRr, riskPerTrade]);

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

        <button
          onClick={executeHistoricalBacktest}
          disabled={isRunning}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-[#070b13] font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all cursor-pointer disabled:opacity-50 self-start sm:self-auto"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          {isRunning ? 'Backtesting Candles...' : 'Run Historical Backtest'}
        </button>
      </div>

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
