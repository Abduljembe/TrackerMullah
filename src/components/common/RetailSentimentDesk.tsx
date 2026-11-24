import React, { useState, useMemo, useEffect } from 'react';
import {
  Users,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  Search,
  Copy,
  Check,
  Sliders,
} from 'lucide-react';
import { useTradingViewQuotes, lookupTradingViewQuote } from '../../utils/tradingViewSync.ts';

export interface SentimentAsset {
  symbol: string;
  name: string;
  category: 'CRYPTO' | 'MAJORS' | 'CROSSES' | 'METALS' | 'INDICES';
  retailLongPct: number;
  retailShortPct: number;
  change24h: number;
  currentPrice: number;
  institutionalBias: 'STRONG FADE (SHORT)' | 'STRONG FADE (BUY)' | 'BALANCED / NEUTRAL';
  trapWarning: string;
  stopLossClusterHigh: number;
  stopLossClusterLow: number;
  sourceLabel: string;
  decimals: number;
}

export const ALL_SENTIMENT_ASSETS: SentimentAsset[] = [
  {
    symbol: 'BTC/USD',
    name: 'Bitcoin / US Dollar',
    category: 'CRYPTO',
    retailLongPct: 62,
    retailShortPct: 38,
    change24h: 1.4,
    currentPrice: 94250,
    institutionalBias: 'BALANCED / NEUTRAL',
    trapWarning: 'Live Binance Futures perpetual account ratio combined with liquidity sweep zones above/below daily swings.',
    stopLossClusterHigh: 96200,
    stopLossClusterLow: 91800,
    sourceLabel: 'Binance Futures Global L/S',
    decimals: 2,
  },
  {
    symbol: 'ETH/USD',
    name: 'Ethereum / US Dollar',
    category: 'CRYPTO',
    retailLongPct: 65,
    retailShortPct: 35,
    change24h: 1.1,
    currentPrice: 3180,
    institutionalBias: 'BALANCED / NEUTRAL',
    trapWarning: 'Live Binance Futures perpetual positioning for ETHUSDT accounts.',
    stopLossClusterHigh: 3290,
    stopLossClusterLow: 3040,
    sourceLabel: 'Binance Futures Global L/S',
    decimals: 2,
  },
  {
    symbol: 'SOL/USD',
    name: 'Solana / US Dollar',
    category: 'CRYPTO',
    retailLongPct: 68,
    retailShortPct: 32,
    change24h: 2.1,
    currentPrice: 185,
    institutionalBias: 'BALANCED / NEUTRAL',
    trapWarning: 'Live Binance Futures perpetual positioning for SOLUSDT accounts.',
    stopLossClusterHigh: 196,
    stopLossClusterLow: 174,
    sourceLabel: 'Binance Futures Global L/S',
    decimals: 2,
  },
  {
    symbol: 'XAU/USD',
    name: 'Spot Gold / US Dollar',
    category: 'METALS',
    retailLongPct: 64,
    retailShortPct: 36,
    change24h: 0.71,
    currentPrice: 3878.46,
    institutionalBias: 'BALANCED / NEUTRAL',
    trapWarning: 'Derived from live Gold RSI stretch, ATR stop bands, and intraday momentum.',
    stopLossClusterHigh: 3915.0,
    stopLossClusterLow: 3852.0,
    sourceLabel: 'Live RSI + ATR Crowding Model',
    decimals: 2,
  },
  {
    symbol: 'XAG/USD',
    name: 'Spot Silver / US Dollar',
    category: 'METALS',
    retailLongPct: 60,
    retailShortPct: 40,
    change24h: 0.85,
    currentPrice: 49.14,
    institutionalBias: 'BALANCED / NEUTRAL',
    trapWarning: 'Derived from live Silver RSI + session range extremes.',
    stopLossClusterHigh: 49.95,
    stopLossClusterLow: 48.2,
    sourceLabel: 'Live RSI + ATR Crowding Model',
    decimals: 2,
  },
  {
    symbol: 'EUR/USD',
    name: 'Euro / US Dollar',
    category: 'MAJORS',
    retailLongPct: 42,
    retailShortPct: 58,
    change24h: -0.1,
    currentPrice: 1.1032,
    institutionalBias: 'BALANCED / NEUTRAL',
    trapWarning: 'Computed from live EUR/USD RSI, 24h drift, and session liquidity boundaries.',
    stopLossClusterHigh: 1.1085,
    stopLossClusterLow: 1.0995,
    sourceLabel: 'Live RSI + ATR Crowding Model',
    decimals: 4,
  },
  {
    symbol: 'GBP/USD',
    name: 'British Pound / US Dollar',
    category: 'MAJORS',
    retailLongPct: 45,
    retailShortPct: 55,
    change24h: 0.15,
    currentPrice: 1.3222,
    institutionalBias: 'BALANCED / NEUTRAL',
    trapWarning: 'Computed from live GBP/USD RSI + session range.',
    stopLossClusterHigh: 1.3285,
    stopLossClusterLow: 1.315,
    sourceLabel: 'Live RSI + ATR Crowding Model',
    decimals: 4,
  },
  {
    symbol: 'USD/JPY',
    name: 'US Dollar / Japanese Yen',
    category: 'MAJORS',
    retailLongPct: 68,
    retailShortPct: 32,
    change24h: -0.32,
    currentPrice: 159.86,
    institutionalBias: 'BALANCED / NEUTRAL',
    trapWarning: 'Computed from live USD/JPY RSI + ATR swing bounds.',
    stopLossClusterHigh: 160.5,
    stopLossClusterLow: 158.85,
    sourceLabel: 'Live RSI + ATR Crowding Model',
    decimals: 2,
  },
  {
    symbol: 'USD/CAD',
    name: 'US Dollar / Canadian Dollar',
    category: 'MAJORS',
    retailLongPct: 38,
    retailShortPct: 62,
    change24h: -0.15,
    currentPrice: 1.4249,
    institutionalBias: 'BALANCED / NEUTRAL',
    trapWarning: 'Computed from live USD/CAD RSI + ATR swing bounds.',
    stopLossClusterHigh: 1.4305,
    stopLossClusterLow: 1.4205,
    sourceLabel: 'Live RSI + ATR Crowding Model',
    decimals: 4,
  },
  {
    symbol: 'EUR/JPY',
    name: 'Euro / Japanese Yen',
    category: 'CROSSES',
    retailLongPct: 71,
    retailShortPct: 29,
    change24h: -0.45,
    currentPrice: 176.35,
    institutionalBias: 'STRONG FADE (SHORT)',
    trapWarning: 'Carry-trade stretch derived from live cross momentum and session high/low stops.',
    stopLossClusterHigh: 177.45,
    stopLossClusterLow: 175.15,
    sourceLabel: 'Live RSI + ATR Crowding Model',
    decimals: 2,
  },
  {
    symbol: 'GBP/JPY',
    name: 'British Pound / Japanese Yen',
    category: 'CROSSES',
    retailLongPct: 70,
    retailShortPct: 30,
    change24h: -0.2,
    currentPrice: 211.37,
    institutionalBias: 'STRONG FADE (SHORT)',
    trapWarning: 'Volatile cross crowding derived from live RSI and ATR stop zones.',
    stopLossClusterHigh: 212.8,
    stopLossClusterLow: 209.9,
    sourceLabel: 'Live RSI + ATR Crowding Model',
    decimals: 2,
  },
  {
    symbol: 'NAS100',
    name: 'Nasdaq 100 Tech Index',
    category: 'INDICES',
    retailLongPct: 69,
    retailShortPct: 31,
    change24h: 0.85,
    currentPrice: 27744.26,
    institutionalBias: 'BALANCED / NEUTRAL',
    trapWarning: 'Index crowding derived from live Nasdaq RSI + high/low volatility envelope.',
    stopLossClusterHigh: 27940.0,
    stopLossClusterLow: 27570.0,
    sourceLabel: 'Live RSI + ATR Crowding Model',
    decimals: 2,
  },
];

interface RetailSentimentDeskProps {
  currentTicker?: string;
  onSelectTicker?: (ticker: string) => void;
}

export const RetailSentimentDesk: React.FC<RetailSentimentDeskProps> = ({
  currentTicker = 'BTC/USD',
  onSelectTicker,
}) => {
  const [selectedSymbol, setSelectedSymbol] = useState<string>(currentTicker);
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'CRYPTO' | 'MAJORS' | 'CROSSES' | 'METALS' | 'INDICES'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [crowdingMultiplier, setCrowdingMultiplier] = useState<number>(0);
  const [binanceLiveMap, setBinanceLiveMap] = useState<
    Record<string, { retailLongPct: number; retailShortPct: number; longShortRatio: number }>
  >({});

  useEffect(() => {
    if (currentTicker) setSelectedSymbol(currentTicker);
  }, [currentTicker]);

  useEffect(() => {
    let active = true;
    fetch('/api/market/sentiment')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!active || !Array.isArray(data?.cryptoSentiments)) return;
        const map: Record<string, { retailLongPct: number; retailShortPct: number; longShortRatio: number }> = {};
        for (const item of data.cryptoSentiments) {
          map[item.symbol] = {
            retailLongPct: item.retailLongPct,
            retailShortPct: item.retailShortPct,
            longShortRatio: item.longShortRatio,
          };
        }
        setBinanceLiveMap(map);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const liveQuotes = useTradingViewQuotes(3500);

  const enrichedAssets = useMemo(() => {
    return ALL_SENTIMENT_ASSETS.map((base) => {
      const q = lookupTradingViewQuote(liveQuotes, base.symbol);
      const binance = binanceLiveMap[base.symbol];

      const rsi = q?.rsi ?? 50;
      const chg = q?.changePercent ?? base.change24h;
      const price = q && q.price > 0 ? q.price : base.currentPrice;

      const longPct = binance
        ? binance.retailLongPct
        : Math.min(89, Math.max(11, Math.round(50 + (rsi - 50) * 0.72 + chg * 3.5)));
      const shortPct = 100 - longPct;

      const rangeHalf =
        q?.high && q?.low && q.high > q.low
          ? (q.high - q.low) * 0.65
          : q?.atr
          ? q.atr * 1.4
          : price * 0.0055;

      const clusterHigh = Number(Math.max(q?.high || price + rangeHalf, price + rangeHalf * 0.45).toFixed(base.decimals));
      const clusterLow = Number(Math.min(q?.low || price - rangeHalf, price - rangeHalf * 0.45).toFixed(base.decimals));

      return {
        ...base,
        currentPrice: price,
        change24h: chg,
        retailLongPct: longPct,
        retailShortPct: shortPct,
        stopLossClusterHigh: clusterHigh,
        stopLossClusterLow: clusterLow,
        sourceLabel: binance
          ? `Binance Live Futures L/S (${binance.longShortRatio.toFixed(2)})`
          : `Live RSI (${rsi.toFixed(1)}) + ATR Model`,
        institutionalBias:
          longPct >= 70
            ? ('STRONG FADE (SHORT)' as const)
            : shortPct >= 70
            ? ('STRONG FADE (BUY)' as const)
            : ('BALANCED / NEUTRAL' as const),
      };
    });
  }, [liveQuotes, binanceLiveMap]);

  const filteredAssets = useMemo(() => {
    return enrichedAssets.filter((a) => {
      const matchCat = categoryFilter === 'ALL' || a.category === categoryFilter;
      const matchSearch =
        a.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [enrichedAssets, categoryFilter, searchQuery]);

  const selectedAsset = useMemo(() => {
    return (
      enrichedAssets.find(
        (a) =>
          a.symbol === selectedSymbol ||
          a.symbol.replace('/', '') === selectedSymbol.replace('/', '')
      ) || enrichedAssets[0]
    );
  }, [enrichedAssets, selectedSymbol]);

  const effectiveLongPct = Math.min(95, Math.max(5, selectedAsset.retailLongPct + crowdingMultiplier));
  const effectiveShortPct = 100 - effectiveLongPct;

  const dynamicTrapStatus = useMemo(() => {
    if (effectiveLongPct >= 72) {
      return {
        badge: 'CROWDED LONG • SWEEP RISK',
        color: 'text-rose-400 bg-rose-950/60 border-rose-500/40',
        message: `${effectiveLongPct}% long positioning detected. Watch sell-side liquidity below recent swing lows for stop runs before continuation.`,
      };
    }
    if (effectiveShortPct >= 72) {
      return {
        badge: 'CROWDED SHORT • SQUEEZE RISK',
        color: 'text-emerald-400 bg-emerald-950/60 border-emerald-500/40',
        message: `${effectiveShortPct}% short positioning detected. Watch buy-side stops above swing highs for rapid short squeezes.`,
      };
    }
    return {
      badge: 'BALANCED EQUILIBRIUM',
      color: 'text-teal-400 bg-teal-950/60 border-teal-500/40',
      message: 'Positioning is balanced without extreme one-sided crowding. Follow higher-timeframe price structure and pivots.',
    };
  }, [effectiveLongPct, effectiveShortPct]);

  const handleCopy = (val: number, key: string) => {
    const formatted = val.toLocaleString(undefined, {
      minimumFractionDigits: selectedAsset.decimals,
      maximumFractionDigits: selectedAsset.decimals,
    });
    navigator.clipboard.writeText(formatted);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const formatPrice = (p: number) =>
    p.toLocaleString(undefined, {
      minimumFractionDigits: selectedAsset.decimals,
      maximumFractionDigits: selectedAsset.decimals,
    });

  return (
    <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-[#0c1424] via-[#09101d] to-[#070d18] border border-teal-500/30 shadow-[0_0_25px_rgba(13,242,201,0.08)] space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#182942] pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300 shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base sm:text-lg font-bold text-white tracking-wide">
                Live Exchange Sentiment & Crowding Radar
              </h3>
              <span className="text-[10px] font-mono font-bold text-purple-300">
                BINANCE LIVE L/S + TV RSI TELEMETRY
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Real-time Binance Futures global Long/Short account ratios for Crypto plus live RSI/ATR crowding models for FX, Metals & Indices.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setCrowdingMultiplier(0)}
          className="px-2.5 py-1.5 rounded-xl bg-[#0e192c] hover:bg-[#14233a] border border-[#1b345b] text-slate-300 text-xs font-mono transition-all cursor-pointer flex items-center gap-1 self-start sm:self-auto"
          title="Reset What-If crowding offset to live reading"
        >
          <RefreshCw className="w-3.5 h-3.5 text-[#0df2c9]" />
          <span>Reset Offset</span>
        </button>
      </div>

      {/* Category Filter & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono">
          {(['ALL', 'CRYPTO', 'MAJORS', 'CROSSES', 'METALS', 'INDICES'] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                categoryFilter === cat
                  ? 'bg-purple-500/20 text-purple-300 border-purple-500/60 font-bold'
                  : 'bg-[#09111e] text-slate-400 hover:text-white border-[#182942]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search pair (e.g. BTC, XAU, EUR)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-[#08101d] border border-[#1b2f4c] text-xs font-mono text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-500"
          />
        </div>
      </div>

      {/* Asset Selector */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {filteredAssets.map((item) => {
          const isSelected = item.symbol === selectedAsset.symbol;
          return (
            <button
              key={item.symbol}
              type="button"
              onClick={() => {
                setSelectedSymbol(item.symbol);
                setCrowdingMultiplier(0);
                onSelectTicker?.(item.symbol);
              }}
              className={`px-3 py-2 rounded-xl text-xs font-mono transition-all flex items-center gap-2 cursor-pointer border shrink-0 tabular-nums ${
                isSelected
                  ? 'bg-purple-500/20 text-purple-300 border-purple-500/60 font-bold'
                  : 'bg-[#09111e] hover:bg-[#0e1a2f] text-slate-300 border-[#182942]'
              }`}
            >
              <span>{item.symbol}</span>
              <span
                className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                  item.retailLongPct > 50 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                }`}
              >
                {item.retailLongPct}% L
              </span>
            </button>
          );
        })}
      </div>

      {/* Active Asset Focus Card */}
      <div className="p-4 sm:p-5 rounded-xl bg-[#08101d] border border-[#1b3050] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#14233a] pb-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-base font-bold text-white font-mono">{selectedAsset.symbol}</span>
              <span className="text-xs text-slate-400 font-mono">{selectedAsset.name}</span>
            </div>
            <span className="text-xs font-mono text-teal-300">{selectedAsset.sourceLabel}</span>
          </div>

          <span className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold border self-start sm:self-auto ${dynamicTrapStatus.color}`}>
            {dynamicTrapStatus.badge}
          </span>
        </div>

        {/* Visual Bar Ratio */}
        <div className="space-y-2 tabular-nums">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" />
              LONG: {effectiveLongPct}%
            </span>
            <span className="text-rose-400 font-bold flex items-center gap-1">
              SHORT: {effectiveShortPct}%
              <TrendingDown className="w-3.5 h-3.5" />
            </span>
          </div>

          <div className="h-4 w-full bg-slate-900 rounded-full overflow-hidden flex border border-[#1e3458] p-0.5">
            <div
              style={{ width: `${effectiveLongPct}%` }}
              className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-l-full transition-all duration-300"
            />
            <div
              style={{ width: `${effectiveShortPct}%` }}
              className="h-full bg-gradient-to-r from-rose-400 to-rose-600 rounded-r-full transition-all duration-300"
            />
          </div>
        </div>

        {/* Optional What-If Sensitivity Offset */}
        <div className="p-3 rounded-xl bg-[#060c18] border border-[#172740] space-y-1.5">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-slate-300 font-bold flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-purple-400" />
              <span>What-If Sensitivity Shift:</span>
            </span>
            <span className="text-purple-300 font-bold tabular-nums">
              {crowdingMultiplier >= 0 ? '+' : ''}
              {crowdingMultiplier}% Offset
            </span>
          </div>
          <input
            type="range"
            min="-30"
            max="30"
            step="2"
            value={crowdingMultiplier}
            onChange={(e) => setCrowdingMultiplier(parseInt(e.target.value, 10))}
            className="w-full accent-purple-400 cursor-pointer"
          />
        </div>

        {/* Contrarian Analysis */}
        <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-500/40 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="text-xs font-bold text-amber-300 uppercase tracking-wide block font-mono">
              Order Book Liquidity Observation
            </span>
            <p className="text-xs text-slate-300 leading-relaxed font-mono">{dynamicTrapStatus.message}</p>
          </div>
        </div>

        {/* Dynamic Liquidity Target Levels */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 tabular-nums">
          <button
            type="button"
            onClick={() => handleCopy(selectedAsset.stopLossClusterHigh, 'bsl')}
            className="p-3 rounded-lg bg-[#0a1526] border border-[#172d4c] hover:border-emerald-500/40 text-left transition-all cursor-pointer group space-y-1"
          >
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400">Buy-Side Liquidity (BSL):</span>
              <div className="flex items-center gap-1.5">
                <span className="text-emerald-400 font-bold">{formatPrice(selectedAsset.stopLossClusterHigh)}</span>
                {copiedKey === 'bsl' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-slate-600 group-hover:text-emerald-400" />
                )}
              </div>
            </div>
            <span className="text-[11px] text-slate-400 block font-mono">
              Upper stop cluster derived from live session high & ATR expansion.
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleCopy(selectedAsset.stopLossClusterLow, 'ssl')}
            className="p-3 rounded-lg bg-[#0a1526] border border-[#172d4c] hover:border-rose-500/40 text-left transition-all cursor-pointer group space-y-1"
          >
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400">Sell-Side Liquidity (SSL):</span>
              <div className="flex items-center gap-1.5">
                <span className="text-rose-400 font-bold">{formatPrice(selectedAsset.stopLossClusterLow)}</span>
                {copiedKey === 'ssl' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-slate-600 group-hover:text-rose-400" />
                )}
              </div>
            </div>
            <span className="text-[11px] text-slate-400 block font-mono">
              Lower stop cluster derived from live session low & ATR contraction.
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
