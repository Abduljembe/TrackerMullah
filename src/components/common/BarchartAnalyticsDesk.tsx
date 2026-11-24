import React, { useMemo, useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Target,
  Activity,
  ArrowUpRight,
  Compass,
} from 'lucide-react';
import { Candle, Timeframe, generateCandles } from '../../utils/stockCandles.ts';
import {
  computeBarchartTechnicalOpinion,
  formatQuantPrice,
} from '../../utils/orderFlowEngine.ts';
import {
  useTradingViewQuotes,
  lookupTradingViewQuote,
} from '../../utils/tradingViewSync.ts';

interface BarchartAnalyticsDeskProps {
  currentTicker?: string;
  currentPrice?: number;
  candles?: Candle[];
  timeframe?: Timeframe;
  onSelectTicker?: (ticker: string) => void;
  onSwitchToOhlcBars?: () => void;
}

const STRENGTH_WATCHLIST = [
  { label: 'XAU/USD', tv: 'XAUUSD', name: 'Gold' },
  { label: 'BTC/USD', tv: 'BTCUSD', name: 'Bitcoin' },
  { label: 'ETH/USD', tv: 'ETHUSD', name: 'Ethereum' },
  { label: 'EUR/USD', tv: 'EURUSD', name: 'Euro' },
  { label: 'GBP/USD', tv: 'GBPUSD', name: 'Pound' },
  { label: 'USD/JPY', tv: 'USDJPY', name: 'Yen' },
  { label: 'NAS100', tv: 'NAS100', name: 'Nasdaq' },
  { label: 'US500', tv: 'US500', name: 'S&P 500' },
  { label: 'WTI/USD', tv: 'OIL_CRUDE', name: 'Crude Oil' },
  { label: 'USD/KES', tv: 'USDKES', name: 'Kenyan Shilling' },
];

export const BarchartAnalyticsDesk: React.FC<BarchartAnalyticsDeskProps> = ({
  currentTicker = 'XAU/USD',
  currentPrice = 3878.46,
  candles: externalCandles,
  timeframe = '1D',
  onSelectTicker,
  onSwitchToOhlcBars,
}) => {
  const [pivotMethod, setPivotMethod] = useState<'classic' | 'fibonacci'>('classic');
  const [fetchedCandles, setFetchedCandles] = useState<Candle[]>([]);
  const [strengthCategory, setStrengthCategory] = useState<'ALL' | 'GAINERS' | 'LOSERS'>('ALL');
  const liveQuotes = useTradingViewQuotes(4000);
  const currentQuote = lookupTradingViewQuote(liveQuotes, currentTicker);
  const resolvedPrice =
    currentQuote && currentQuote.price > 0 ? currentQuote.price : currentPrice;

  useEffect(() => {
    if (externalCandles && externalCandles.length >= 20) return;
    let active = true;
    fetch(`/api/stocks/history?ticker=${encodeURIComponent(currentTicker)}&timeframe=1D`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!active) return;
        if (data?.success && Array.isArray(data.candles) && data.candles.length >= 10) {
          setFetchedCandles(data.candles);
        } else {
          setFetchedCandles(generateCandles(currentTicker, resolvedPrice, 0, '1D'));
        }
      })
      .catch(() => {
        if (active) setFetchedCandles(generateCandles(currentTicker, resolvedPrice, 0, '1D'));
      });
    return () => {
      active = false;
    };
  }, [currentTicker, externalCandles, resolvedPrice]);

  const effectiveCandles = useMemo(() => {
    if (externalCandles && externalCandles.length >= 10) return externalCandles;
    if (fetchedCandles.length >= 10) return fetchedCandles;
    return generateCandles(currentTicker, resolvedPrice, 0, timeframe);
  }, [externalCandles, fetchedCandles, currentTicker, resolvedPrice, timeframe]);

  const opinion = useMemo(
    () => computeBarchartTechnicalOpinion(effectiveCandles, resolvedPrice, currentTicker, currentQuote),
    [effectiveCandles, resolvedPrice, currentTicker, currentQuote]
  );

  // Market Strength / Movers Bar Chart data from live quotes
  const marketMovers = useMemo(() => {
    const rows = STRENGTH_WATCHLIST.map((item) => {
      const q = lookupTradingViewQuote(liveQuotes, item.label) || lookupTradingViewQuote(liveQuotes, item.tv);
      const chg = q?.changePercent ?? 0;
      const rsi = q?.rsi ?? 50;
      const price = q?.price ?? 0;
      return {
        ticker: item.label,
        name: item.name,
        changePercent: Number(chg.toFixed(2)),
        rsi: Number(rsi.toFixed(1)),
        price,
      };
    });

    const filtered =
      strengthCategory === 'GAINERS'
        ? rows.filter((r) => r.changePercent >= 0)
        : strengthCategory === 'LOSERS'
        ? rows.filter((r) => r.changePercent < 0)
        : rows;

    return filtered.sort((a, b) => b.changePercent - a.changePercent);
  }, [liveQuotes, strengthCategory]);

  const maxAbsMover = useMemo(() => {
    const vals = marketMovers.map((m) => Math.abs(m.changePercent));
    return Math.max(0.5, ...vals);
  }, [marketMovers]);

  const activePivots = pivotMethod === 'classic' ? opinion.classicPivots : opinion.fibPivots;
  const totalCount = opinion.buyCount + opinion.sellCount + opinion.holdCount || 1;
  const buyWidth = Math.round((opinion.buyCount / totalCount) * 100);
  const holdWidth = Math.round((opinion.holdCount / totalCount) * 100);
  const sellWidth = Math.max(0, 100 - buyWidth - holdWidth);

  const verdictColor =
    opinion.overallDirection === 'BUY'
      ? 'text-emerald-300 border-emerald-500/40 bg-emerald-500/15'
      : opinion.overallDirection === 'SELL'
      ? 'text-rose-300 border-rose-500/40 bg-rose-500/15'
      : 'text-amber-300 border-amber-500/40 bg-amber-500/15';

  const fmt = (p: number) => formatQuantPrice(p, currentTicker);

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-[#091120] border border-[#162744] shadow-xl space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#14233c]">
        <div>
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-teal-400">
            Barchart Technical Matrix & Strength Screener
          </span>
          <h3 className="text-base sm:text-lg font-extrabold text-white flex items-center gap-2 mt-0.5">
            <BarChart3 className="w-4 h-4 text-[#0df2c9]" />
            <span>{currentTicker} Technical Opinion, 52W Range & Movers Bar Chart</span>
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onSwitchToOhlcBars && (
            <button
              type="button"
              onClick={onSwitchToOhlcBars}
              className="px-3 py-1.5 rounded-xl bg-teal-500/15 hover:bg-teal-500/25 border border-teal-500/40 text-[#0df2c9] text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>View Chart as OHLC Bars</span>
            </button>
          )}
          <div className={`px-3 py-1.5 rounded-xl border text-xs font-mono font-black tabular-nums ${verdictColor}`}>
            {opinion.overallPercent}% {opinion.verdictLabel.toUpperCase()}
          </div>
        </div>
      </div>

      {/* Row 1: Overall Opinion Summary Bar + 52-Week Range Slider */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Opinion Distribution Bar */}
        <div className="lg:col-span-7 p-4 rounded-xl bg-[#060c18] border border-[#14233c] space-y-3">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="font-bold text-slate-200 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              12-Indicator Consensus Breakdown ({timeframe})
            </span>
            <span className="text-slate-400 tabular-nums">
              {opinion.buyCount} Buy • {opinion.holdCount} Hold • {opinion.sellCount} Sell
            </span>
          </div>

          <div className="h-5 w-full rounded-lg overflow-hidden bg-slate-900 flex text-[10px] font-mono font-bold tabular-nums">
            {buyWidth > 0 && (
              <div
                style={{ width: `${buyWidth}%` }}
                className="bg-emerald-500 text-slate-950 flex items-center justify-center"
              >
                {buyWidth >= 15 ? `${buyWidth}% BUY` : ''}
              </div>
            )}
            {holdWidth > 0 && (
              <div
                style={{ width: `${holdWidth}%` }}
                className="bg-amber-500 text-slate-950 flex items-center justify-center"
              >
                {holdWidth >= 15 ? `${holdWidth}% HOLD` : ''}
              </div>
            )}
            {sellWidth > 0 && (
              <div
                style={{ width: `${sellWidth}%` }}
                className="bg-rose-500 text-white flex items-center justify-center"
              >
                {sellWidth >= 15 ? `${sellWidth}% SELL` : ''}
              </div>
            )}
          </div>

          {/* 3 Term Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
            {[opinion.shortTerm, opinion.mediumTerm, opinion.longTerm].map((term, idx) => (
              <div key={idx} className="p-3 rounded-lg bg-[#091224] border border-[#162744] space-y-2">
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="text-slate-400 font-semibold">{term.label}</span>
                  <span
                    className={`font-black tabular-nums ${
                      term.verdict === 'BUY'
                        ? 'text-emerald-400'
                        : term.verdict === 'SELL'
                        ? 'text-rose-400'
                        : 'text-amber-400'
                    }`}
                  >
                    {term.strengthPct}% {term.verdict}
                  </span>
                </div>
                <div className="space-y-1">
                  {term.items.map((item, k) => (
                    <div key={k} className="flex items-center justify-between text-[10px] font-mono tabular-nums">
                      <span className="text-slate-400 truncate max-w-[95px]" title={item.name}>
                        {item.name}
                      </span>
                      <span
                        className={`font-bold ${
                          item.signal === 'BUY'
                            ? 'text-emerald-300'
                            : item.signal === 'SELL'
                            ? 'text-rose-300'
                            : 'text-slate-300'
                        }`}
                      >
                        {item.signal}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 52-Week High/Low Range Bar & Pivot Ladder */}
        <div className="lg:col-span-5 p-4 rounded-xl bg-[#060c18] border border-[#14233c] space-y-4">
          {/* 52W Range */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="font-bold text-slate-200 flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-amber-400" />
                52-Week / Lookback High-Low Range
              </span>
              <span className="text-[#0df2c9] font-bold tabular-nums">{opinion.rangePercentile}% Percentile</span>
            </div>

            <div className="relative h-3 rounded-full bg-slate-900 border border-[#182942] overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-rose-500 via-amber-400 to-emerald-400 rounded-full transition-all"
                style={{ width: `${opinion.rangePercentile}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] font-mono tabular-nums">
              <div>
                <span className="text-slate-500 block text-[9px] uppercase">Range Low</span>
                <span className="text-rose-300 font-bold">{fmt(opinion.low52w)}</span>
              </div>
              <div className="text-center">
                <span className="text-slate-500 block text-[9px] uppercase">Spot Price</span>
                <span className="text-white font-black">{fmt(resolvedPrice)}</span>
              </div>
              <div className="text-right">
                <span className="text-slate-500 block text-[9px] uppercase">Range High</span>
                <span className="text-emerald-300 font-bold">{fmt(opinion.high52w)}</span>
              </div>
            </div>
          </div>

          {/* Classic / Fibonacci Pivot Point Ladder */}
          <div className="pt-3 border-t border-[#132238] space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="font-bold text-slate-200 flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-teal-400" />
                Pivot Levels
              </span>
              <div className="flex items-center bg-[#091224] p-0.5 rounded-lg border border-[#162744] text-[10px]">
                <button
                  type="button"
                  onClick={() => setPivotMethod('classic')}
                  className={`px-2 py-0.5 rounded cursor-pointer font-bold ${
                    pivotMethod === 'classic' ? 'bg-teal-500 text-slate-950' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Classic
                </button>
                <button
                  type="button"
                  onClick={() => setPivotMethod('fibonacci')}
                  className={`px-2 py-0.5 rounded cursor-pointer font-bold ${
                    pivotMethod === 'fibonacci' ? 'bg-teal-500 text-slate-950' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Fibonacci
                </button>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-1.5 text-[11px] font-mono tabular-nums">
              {[
                { label: 'S3', val: activePivots.s3, cls: 'text-rose-400' },
                { label: 'S2', val: activePivots.s2, cls: 'text-rose-300' },
                { label: 'S1', val: activePivots.s1, cls: 'text-rose-200' },
                { label: 'PIVOT', val: activePivots.pp, cls: 'text-amber-300' },
                { label: 'R1', val: activePivots.r1, cls: 'text-emerald-200' },
                { label: 'R2', val: activePivots.r2, cls: 'text-emerald-300' },
                { label: 'R3', val: activePivots.r3, cls: 'text-emerald-400' },
                { label: 'ATR(14)', val: opinion.atrValue, cls: 'text-cyan-300' },
              ].map((cell) => (
                <div key={cell.label} className="p-2 rounded-lg bg-[#091224] border border-[#152542]">
                  <span className="text-[9px] text-slate-500 block">{cell.label}</span>
                  <span className={`font-bold ${cell.cls}`}>{fmt(cell.val)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Live Market Strength & Movers Horizontal Bar Chart */}
      <div className="p-4 rounded-xl bg-[#060c18] border border-[#14233c] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-white font-mono flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span>Live Multi-Asset Strength Bar Chart (% 24h Move — Click Any Bar to Focus)</span>
            </h4>
          </div>

          <div className="flex items-center gap-1 bg-[#091224] p-0.5 rounded-lg border border-[#162744] text-[10px] font-mono">
            {(['ALL', 'GAINERS', 'LOSERS'] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setStrengthCategory(cat)}
                className={`px-2.5 py-1 rounded cursor-pointer font-bold transition-colors ${
                  strengthCategory === cat
                    ? 'bg-teal-500 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 font-mono text-xs tabular-nums">
          {marketMovers.map((m) => {
            const isUp = m.changePercent >= 0;
            const widthPct = Math.min(100, Math.max(6, Math.round((Math.abs(m.changePercent) / maxAbsMover) * 100)));
            const isSelected = m.ticker === currentTicker;

            return (
              <button
                key={m.ticker}
                type="button"
                onClick={() => onSelectTicker?.(m.ticker)}
                className={`w-full text-left p-2.5 rounded-xl border transition-all cursor-pointer flex items-center gap-3 ${
                  isSelected
                    ? 'bg-[#0e1f36] border-[#0df2c9]/60'
                    : 'bg-[#091224] hover:bg-[#0d1a33] border-[#152542]'
                }`}
              >
                <div className="w-24 shrink-0">
                  <div className="font-bold text-white flex items-center gap-1">
                    <span>{m.ticker}</span>
                    {onSelectTicker && <ArrowUpRight className="w-3 h-3 text-slate-500" />}
                  </div>
                  <div className="text-[10px] text-slate-400">{m.name}</div>
                </div>

                <div className="flex-1 h-4 bg-[#050a14] rounded-md overflow-hidden flex items-center">
                  <div
                    className={`h-full rounded-md transition-all ${
                      isUp ? 'bg-emerald-500/85' : 'bg-rose-500/85'
                    }`}
                    style={{ width: `${widthPct}%` }}
                  />
                </div>

                <div className="w-24 text-right shrink-0">
                  <div className={`font-black ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {isUp ? '+' : ''}
                    {m.changePercent.toFixed(2)}%
                  </div>
                  <div className="text-[10px] text-slate-400">RSI {m.rsi}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
