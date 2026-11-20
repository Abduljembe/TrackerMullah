import React, { useState, useMemo } from 'react';
import {
  ArrowRight,
  Flame,
  Globe,
} from 'lucide-react';
import { getMarketSession } from '../../utils/marketHours.ts';
import { useTradingViewQuotes, lookupTradingViewQuote } from '../../utils/tradingViewSync.ts';
import { computeTimeframeSignalLevels, resolveQuoteForTimeframe } from '../../utils/signalEngine.ts';

interface CurrencyScore {
  code: string;
  name: string;
  score: number; // 0 to 10
  change24h: number;
  bias: 'BULLISH' | 'NEUTRAL' | 'BEARISH';
  status: 'Strong' | 'Moderate' | 'Weak';
}

interface CurrencyStrengthMeterProps {
  onSelectPair?: (pairTicker: string) => void;
}

const STRENGTH_CROSSES: Array<{ ticker: string; base: string; quote: string }> = [
  { ticker: 'EUR/USD', base: 'EUR', quote: 'USD' },
  { ticker: 'GBP/USD', base: 'GBP', quote: 'USD' },
  { ticker: 'USD/JPY', base: 'USD', quote: 'JPY' },
  { ticker: 'USD/CHF', base: 'USD', quote: 'CHF' },
  { ticker: 'AUD/USD', base: 'AUD', quote: 'USD' },
  { ticker: 'USD/CAD', base: 'USD', quote: 'CAD' },
  { ticker: 'NZD/USD', base: 'NZD', quote: 'USD' },
  { ticker: 'EUR/GBP', base: 'EUR', quote: 'GBP' },
  { ticker: 'EUR/JPY', base: 'EUR', quote: 'JPY' },
  { ticker: 'GBP/JPY', base: 'GBP', quote: 'JPY' },
  { ticker: 'AUD/JPY', base: 'AUD', quote: 'JPY' },
  { ticker: 'CAD/JPY', base: 'CAD', quote: 'JPY' },
  { ticker: 'CHF/JPY', base: 'CHF', quote: 'JPY' },
  { ticker: 'EUR/CHF', base: 'EUR', quote: 'CHF' },
  { ticker: 'EUR/AUD', base: 'EUR', quote: 'AUD' },
  { ticker: 'GBP/AUD', base: 'GBP', quote: 'AUD' },
  { ticker: 'AUD/CAD', base: 'AUD', quote: 'CAD' },
  { ticker: 'AUD/NZD', base: 'AUD', quote: 'NZD' },
  { ticker: 'USD/KES', base: 'USD', quote: 'KES' },
  { ticker: 'GBP/KES', base: 'GBP', quote: 'KES' },
  { ticker: 'EUR/KES', base: 'EUR', quote: 'KES' },
  { ticker: 'XAU/USD', base: 'XAU', quote: 'USD' },
  { ticker: 'XAU/EUR', base: 'XAU', quote: 'EUR' },
];

const CURRENCY_META: Array<{ code: string; name: string }> = [
  { code: 'XAU', name: 'Gold Bullion' },
  { code: 'USD', name: 'US Dollar' },
  { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'British Pound' },
  { code: 'JPY', name: 'Japanese Yen' },
  { code: 'CHF', name: 'Swiss Franc' },
  { code: 'AUD', name: 'Australian Dollar' },
  { code: 'CAD', name: 'Canadian Dollar' },
  { code: 'NZD', name: 'New Zealand Dollar' },
  { code: 'KES', name: 'Kenyan Shilling' },
];

const HEATMAP_UNIVERSE = [
  { pair: 'XAU/USD', category: 'Precious Metals', market: 'METALS' as const, fallbackPrice: 3865.0 },
  { pair: 'USD/KES', category: 'East Africa FX', market: 'FOREX' as const, fallbackPrice: 129.85 },
  { pair: 'EUR/USD', category: 'Major FX', market: 'FOREX' as const, fallbackPrice: 1.1005 },
  { pair: 'GBP/USD', category: 'Major FX', market: 'FOREX' as const, fallbackPrice: 1.321 },
  { pair: 'USD/JPY', category: 'Asian Session', market: 'FOREX' as const, fallbackPrice: 159.5 },
  { pair: 'GBP/KES', category: 'Diaspora FX', market: 'FOREX' as const, fallbackPrice: 171.6 },
  { pair: 'EUR/KES', category: 'Regional FX', market: 'FOREX' as const, fallbackPrice: 143.1 },
  { pair: 'AUD/USD', category: 'Commodity FX', market: 'FOREX' as const, fallbackPrice: 0.654 },
  { pair: 'USD/CAD', category: 'North American FX', market: 'FOREX' as const, fallbackPrice: 1.389 },
];

export const CurrencyStrengthMeter: React.FC<CurrencyStrengthMeterProps> = ({ onSelectPair }) => {
  const fxSession = getMarketSession('FOREX');
  const [selectedTf, setSelectedTf] = useState<'15m' | '1H' | '4H' | '1D'>('1H');
  const liveTvQuotes = useTradingViewQuotes(3000);

  const currencies: CurrencyScore[] = useMemo(() => {
    const accum = new Map<string, { scoreSum: number; pctSum: number; count: number }>();
    for (const meta of CURRENCY_META) {
      accum.set(meta.code, { scoreSum: 0, pctSum: 0, count: 0 });
    }

    for (const cross of STRENGTH_CROSSES) {
      const q = lookupTradingViewQuote(liveTvQuotes, cross.ticker);
      if (!q) continue;
      const slice = resolveQuoteForTimeframe(q, selectedTf);
      const pct = typeof slice.changePercent === 'number' ? slice.changePercent : (q.changePercent ?? 0);
      const rec = typeof slice.recommendAll === 'number' ? slice.recommendAll : (q.recommendAll ?? 0);
      // Combine real timeframe price % change with TradingView oscillator/MA rating (-1..+1)
      const compositeDelta = pct * 1.45 + rec * 1.15;

      const baseAcc = accum.get(cross.base);
      const quoteAcc = accum.get(cross.quote);
      if (baseAcc) {
        baseAcc.scoreSum += compositeDelta;
        baseAcc.pctSum += pct;
        baseAcc.count += 1;
      }
      if (quoteAcc) {
        quoteAcc.scoreSum -= compositeDelta;
        quoteAcc.pctSum -= pct;
        quoteAcc.count += 1;
      }
    }

    return CURRENCY_META.map((meta) => {
      const acc = accum.get(meta.code)!;
      const avgDelta = acc.count > 0 ? acc.scoreSum / acc.count : 0;
      const avgPct = acc.count > 0 ? acc.pctSum / acc.count : 0;
      const score = Math.max(0.8, Math.min(9.9, Number((5.0 + avgDelta * 2.15).toFixed(1))));
      const bias: 'BULLISH' | 'NEUTRAL' | 'BEARISH' =
        score >= 6.4 ? 'BULLISH' : score >= 4.2 ? 'NEUTRAL' : 'BEARISH';
      const status: 'Strong' | 'Moderate' | 'Weak' =
        score >= 6.4 ? 'Strong' : score >= 4.2 ? 'Moderate' : 'Weak';

      return {
        code: meta.code,
        name: meta.name,
        score,
        change24h: Number(avgPct.toFixed(2)),
        bias,
        status,
      };
    }).sort((a, b) => b.score - a.score);
  }, [liveTvQuotes, selectedTf]);

  const heatmapPairs = useMemo(() => {
    return HEATMAP_UNIVERSE.map((item) => {
      const q = lookupTradingViewQuote(liveTvQuotes, item.pair);
      const spot = q && q.price > 0 ? q.price : item.fallbackPrice;
      const slice = resolveQuoteForTimeframe(q, selectedTf);
      const pct = typeof slice.changePercent === 'number' ? slice.changePercent : (q?.changePercent ?? 0);
      const computed = computeTimeframeSignalLevels({
        symbol: item.pair.replace('/', ''),
        spotPrice: spot,
        timeframe: selectedTf,
        quote: q,
        market: item.market,
      });
      return {
        pair: item.pair,
        category: item.category,
        changeNum: pct,
        change: `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`,
        bias: computed.action,
        spot,
      };
    });
  }, [liveTvQuotes, selectedTf]);

  // Identify strongest vs weakest live divergence setup
  const topDivergenceLabel = useMemo(() => {
    if (currencies.length < 2) return 'Scanning Live Crosses...';
    const strongest = currencies[0];
    const weakest = currencies[currencies.length - 1];
    // Find a direct pair matching strongest & weakest if available
    const direct = STRENGTH_CROSSES.find(
      (c) =>
        (c.base === strongest.code && c.quote === weakest.code) ||
        (c.base === weakest.code && c.quote === strongest.code)
    );
    if (direct) {
      const dir = direct.base === strongest.code ? 'Long' : 'Short';
      return `Top Divergence (${selectedTf}): ${strongest.code} vs ${weakest.code} (${direct.ticker} ${dir})`;
    }
    return `Top Divergence (${selectedTf}): ${strongest.code} (${strongest.score}) vs ${weakest.code} (${weakest.score})`;
  }, [currencies, selectedTf]);

  return (
    <div className="rounded-2xl bg-[#090e1a] border border-[#162540] overflow-hidden p-5 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#141f33] pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white flex flex-wrap items-center gap-2">
              Currency Strength Meter & Forex Heatmap
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                  fxSession.isOpen
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}
              >
                {fxSession.isOpen ? 'LIVE TRADINGVIEW CROSSES' : 'MARKET CLOSED · FROZEN'}
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Calculated live across 23 TradingView FX & Metals crosses ({selectedTf} horizon)
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {/* Timeframe Selector */}
          <div className="flex items-center gap-1 p-1 bg-[#070b13] border border-[#162540] rounded-xl text-[11px] font-mono">
            {(['15m', '1H', '4H', '1D'] as const).map((tf) => (
              <button
                key={tf}
                type="button"
                onClick={() => setSelectedTf(tf)}
                className={`px-2 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                  selectedTf === tf
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

          {/* Synergy Highlight Pill */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
            <Flame className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-xs font-mono font-bold text-emerald-300">
              {topDivergenceLabel}
            </span>
          </div>
        </div>
      </div>

      {/* Currency Strength Bars Grid */}
      <div>
        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">
          Relative Strength Rankings ({selectedTf} Score 0 to 10)
        </h4>

        <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-2.5">
          {currencies.map((c) => {
            const isStrong = c.score >= 6.4;
            const isWeak = c.score < 4.2;

            return (
              <div
                key={c.code}
                className={`p-3 rounded-xl border transition-all ${
                  isStrong
                    ? 'bg-emerald-950/20 border-emerald-500/30'
                    : isWeak
                    ? 'bg-rose-950/20 border-rose-500/30'
                    : 'bg-[#0d1627] border-[#182744]'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-extrabold text-white">{c.code}</span>
                  <span
                    className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded ${
                      isStrong
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : isWeak
                        ? 'bg-rose-500/20 text-rose-300'
                        : 'bg-amber-500/20 text-amber-300'
                    }`}
                  >
                    {c.score.toFixed(1)}/10
                  </span>
                </div>

                {/* Visual Progress Bar */}
                <div className="w-full h-2 rounded-full bg-[#070b13] overflow-hidden mb-2">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      isStrong
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                        : isWeak
                        ? 'bg-gradient-to-r from-rose-500 to-orange-400'
                        : 'bg-gradient-to-r from-amber-500 to-yellow-400'
                    }`}
                    style={{ width: `${(c.score / 10) * 100}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span className="truncate">{c.name}</span>
                  <span
                    className={`font-mono font-bold ${
                      c.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {c.change24h >= 0 ? '+' : ''}{c.change24h.toFixed(2)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cross-Currency Heatmap Matrix */}
      <div>
        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center justify-between">
          <span>Active Cross Heatmap Matrix ({selectedTf})</span>
          <span className="text-[10px] text-slate-500 font-normal">Click any pair to load chart & signals</span>
        </h4>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-2.5">
          {heatmapPairs.map((p) => {
            const isPos = p.changeNum >= 0;
            const isBuy = p.bias.includes('BUY');
            return (
              <button
                key={p.pair}
                onClick={() => onSelectPair && onSelectPair(p.pair)}
                className="p-3 rounded-xl bg-[#0c1424] hover:bg-[#121c2e] border border-[#182744] hover:border-cyan-500/40 text-left transition-all cursor-pointer group flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-white group-hover:text-cyan-300 transition-colors">
                      {p.pair}
                    </span>
                    <span className="text-[9px] font-mono text-slate-500">[{p.category}]</span>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Signal: <strong className={isBuy ? 'text-emerald-400' : 'text-rose-400'}>{p.bias}</strong>
                  </span>
                </div>

                <div className="text-right">
                  <span
                    className={`text-xs font-extrabold font-mono block ${
                      isPos ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {p.change}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-all inline-block mt-1" />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
