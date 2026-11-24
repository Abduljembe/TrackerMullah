import { useState, useEffect } from 'react';

export interface TimeframeTechnicals {
  recommendAll?: number;
  recommendMa?: number;
  recommendOther?: number;
  rsi?: number;
  macd?: number;
  macdSignal?: number;
  ema20?: number;
  ema50?: number;
  changePercent?: number;
}

export interface LiveTvQuote {
  symbol: string;
  price: number;
  bid?: number;
  ask?: number;
  changePercent: number;
  changeValue: number;
  high?: number;
  low?: number;
  open?: number;
  time?: string;
  isFallback?: boolean;
  recommendAll?: number;
  recommendMa?: number;
  recommendOther?: number;
  rsi?: number;
  macd?: number;
  macdSignal?: number;
  ema20?: number;
  ema50?: number;
  ema200?: number;
  atr?: number;
  adx?: number;
  volume?: number;
  marketCap?: number;
  peRatio?: number;
  dividendYield?: number;
  high52w?: number;
  low52w?: number;
  timeframeSignals?: Record<string, TimeframeTechnicals>;
}

/**
 * Current TradingView benchmark prices across all Forex, Metals, Indices,
 * Commodities, Yields, Crypto, and US Equities.
 */
export const TV_BENCHMARK_PRICES: Record<string, number> = {
  // Forex Majors
  'EUR/USD': 1.0963,
  EURUSD: 1.0963,
  'GBP/USD': 1.3222,
  GBPUSD: 1.3222,
  'USD/JPY': 159.86,
  USDJPY: 159.86,
  'AUD/USD': 0.6776,
  AUDUSD: 0.6776,
  'USD/CAD': 1.4249,
  USDCAD: 1.4249,
  'USD/CHF': 0.8376,
  USDCHF: 0.8376,
  'NZD/USD': 0.5529,
  NZDUSD: 0.5529,

  // Euro Crosses
  'EUR/GBP': 0.8343,
  EURGBP: 0.8343,
  'EUR/JPY': 176.35,
  EURJPY: 176.35,
  'EUR/CHF': 0.9242,
  EURCHF: 0.9242,
  'EUR/AUD': 1.6281,
  EURAUD: 1.6281,
  'EUR/CAD': 1.5719,
  EURCAD: 1.5719,
  'EUR/NZD': 1.9953,
  EURNZD: 1.9953,

  // Pound Crosses
  'GBP/JPY': 211.37,
  GBPJPY: 211.37,
  'GBP/CHF': 1.1076,
  GBPCHF: 1.1076,
  'GBP/AUD': 1.9513,
  GBPAUD: 1.9513,
  'GBP/CAD': 1.8838,
  GBPCAD: 1.8838,
  'GBP/NZD': 2.3915,
  GBPNZD: 2.3915,

  // Yen & Antipodean Crosses
  'AUD/JPY': 108.32,
  AUDJPY: 108.32,
  'CAD/JPY': 112.20,
  CADJPY: 112.20,
  'CHF/JPY': 190.83,
  CHFJPY: 190.83,
  'NZD/JPY': 88.38,
  NZDJPY: 88.38,
  'AUD/CAD': 0.9654,
  AUDCAD: 0.9654,
  'AUD/NZD': 1.2254,
  AUDNZD: 1.2254,
  'CAD/CHF': 0.5879,
  CADCHF: 0.5879,
  'NZD/CAD': 0.7877,
  NZDCAD: 0.7877,

  // Regional & Exotic FX
  'USD/KES': 129.86,
  USDKES: 129.86,
  'GBP/KES': 171.70,
  GBPKES: 171.70,
  'EUR/KES': 143.68,
  EURKES: 143.68,
  'USD/ZAR': 16.94,
  USDZAR: 16.94,
  'USD/UGX': 4121.20,
  USDUGX: 4121.20,
  'USD/TZS': 2634.00,
  USDTZS: 2634.00,
  'USD/MXN': 18.53,
  USDMXN: 18.53,
  'USD/TRY': 50.37,
  USDTRY: 50.37,
  'USD/SGD': 1.2881,
  USDSGD: 1.2881,

  // Metals & Commodities
  'XAU/USD': 3620.00,
  XAUUSD: 3620.00,
  GOLD: 3620.00,
  'XAG/USD': 49.14,
  XAGUSD: 49.14,
  SILVER: 49.14,
  'XPT/USD': 1496.17,
  XPTUSD: 1496.17,
  'XPD/USD': 1008.70,
  XPDUSD: 1008.70,
  'HG/COPPER': 6.06,
  COPPER: 6.06,
  'XAU/EUR': 3515.65,
  XAUEUR: 3515.65,
  'XAU/KES': 503656.82,
  XAUKES: 503656.82,
  'WTI/USD': 89.08,
  WTI_OIL: 89.08,
  WTICOUSD: 89.08,
  OIL_CRUDE: 89.08,
  BRENT: 96.41,

  // Global Indices & Macro
  US500: 7519.06,
  SPX500: 7519.06,
  SPX: 7519.06,
  US_500: 7519.06,
  NAS100: 27744.26,
  US_TECH: 27744.26,
  USTEC: 27744.26,
  US30: 52225.33,
  WALL_ST: 52225.33,
  DJI: 52225.33,
  GER40: 26742.47,
  GER_40: 26742.47,
  DAX: 26742.47,
  UK100: 10895.20,
  UK_100: 10895.20,
  FRA40: 8364.18,
  JPN225: 61142.13,
  JAP_225: 61142.13,
  HK50: 23637.61,
  AUS200: 9066.80,
  EUSTX50: 6388.67,
  DXY: 103.35,
  US10Y: 5.13,

  // Cryptocurrencies
  BTCUSD: 60200.00,
  'BTC/USD': 60200.00,
  ETHUSD: 1919.20,
  'ETH/USD': 1919.20,
  SOLUSD: 79.30,
  'SOL/USD': 79.30,
  XRPUSD: 1.0141,
  'XRP/USD': 1.0141,
  LTCUSD: 48.96,
  'LTC/USD': 48.96,
  DOGEUSD: 0.06456,
  'DOGE/USD': 0.06456,
  ADAUSD: 0.1702,
  'ADA/USD': 0.1702,
  BNBUSD: 629.01,
  'BNB/USD': 629.01,

  // US Equities
  AAPL: 357.95,
  NVDA: 160.43,
  MSFT: 521.08,
  TSLA: 387.97,
  SPY: 749.82,
  AMZN: 210.50,
  GOOGL: 185.20,
  META: 615.40,

  // Nairobi Securities Exchange (NSEKE) Equities
  SCOM: 35.0,
  EQTY: 100.0,
  KCB: 89.0,
  EABL: 273.0,
  SCBK: 310.0,
  BAT: 550.0,
};

let sharedQuotesCache: Record<string, LiveTvQuote> = {};
let lastSharedFetch = 0;
let inflightPromise: Promise<Record<string, LiveTvQuote>> | null = null;
let sharedEventSource: EventSource | null = null;
let lastSseMessageAt = 0;
const subscribers = new Set<(quotes: Record<string, LiveTvQuote>) => void>();

function mergeQuotesSafely(
  prev: Record<string, LiveTvQuote>,
  incoming: Record<string, LiveTvQuote>
): Record<string, LiveTvQuote> {
  const next: Record<string, LiveTvQuote> = { ...prev };
  for (const [k, q] of Object.entries(incoming)) {
    if (!q || typeof q.price !== 'number' || q.price <= 0) continue;
    const existing = next[k];
    if (existing && !existing.isFallback && q.isFallback) continue;
    next[k] = q;
  }
  return next;
}

function notifySubscribers() {
  const snapshot = { ...sharedQuotesCache };
  for (const cb of subscribers) {
    try {
      cb(snapshot);
    } catch {}
  }
}

function ensureSharedStream() {
  if (typeof window === 'undefined' || typeof EventSource === 'undefined' || sharedEventSource) return;
  try {
    const es = new EventSource('/api/tradingview/stream');
    sharedEventSource = es;
    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data?.quotes && typeof data.quotes === 'object' && Object.keys(data.quotes).length > 0) {
          sharedQuotesCache = mergeQuotesSafely(sharedQuotesCache, data.quotes);
          lastSharedFetch = Date.now();
          lastSseMessageAt = Date.now();
          notifySubscribers();
        }
      } catch {}
    };
    es.onerror = () => {
      try { es.close(); } catch {}
      sharedEventSource = null;
      if (subscribers.size > 0) {
        setTimeout(() => {
          if (subscribers.size > 0) ensureSharedStream();
        }, 3000);
      }
    };
  } catch {
    sharedEventSource = null;
  }
}

async function fetchSharedQuotes(force = false): Promise<Record<string, LiveTvQuote>> {
  const now = Date.now();
  const hasLiveGold = Boolean(sharedQuotesCache['OANDA:XAUUSD'] && !sharedQuotesCache['OANDA:XAUUSD'].isFallback);
  if (!force && hasLiveGold && now - lastSharedFetch < 900 && Object.keys(sharedQuotesCache).length > 0) {
    return sharedQuotesCache;
  }
  if (!force && inflightPromise) return inflightPromise;

  inflightPromise = fetch(force ? '/api/tradingview/prices?force=1' : '/api/tradingview/prices')
    .then(async (res) => {
      if (!res.ok) return sharedQuotesCache;
      const data = await res.json();
      if (data?.quotes && typeof data.quotes === 'object' && Object.keys(data.quotes).length > 0) {
        sharedQuotesCache = mergeQuotesSafely(sharedQuotesCache, data.quotes);
        lastSharedFetch = Date.now();
        notifySubscribers();
      }
      return sharedQuotesCache;
    })
    .catch(() => sharedQuotesCache)
    .finally(() => {
      inflightPromise = null;
    });

  return inflightPromise;
}

/**
 * Force-refresh live TradingView prices across the entire application and reconnect SSE if needed.
 */
export async function forceRefreshTradingViewQuotes(): Promise<Record<string, LiveTvQuote>> {
  if (sharedEventSource && sharedEventSource.readyState === EventSource.CLOSED) {
    try { sharedEventSource.close(); } catch {}
    sharedEventSource = null;
  }
  ensureSharedStream();
  return fetchSharedQuotes(true);
}

/**
 * Look up a symbol cleanly against the TradingView quote dictionary, handling
 * slashed/unslashed/alias tickers (e.g. EUR/USD -> EURUSD, US_TECH -> NAS100, WTI_OIL -> NYMEX:CL1!).
 */
export function lookupTradingViewQuote(
  quotes: Record<string, LiveTvQuote>,
  symbol: string
): LiveTvQuote | undefined {
  if (!quotes || !symbol) return undefined;
  const upper = symbol.toUpperCase().trim();
  const clean = upper.replace(/[/_\s-]/g, '');

  const aliasMap: Record<string, string[]> = {
    XAUUSD: ['OANDA:XAUUSD', 'XAU/USD', 'XAUUSD', 'TVC:GOLD', 'GOLD'],
    XAGUSD: ['OANDA:XAGUSD', 'XAG/USD', 'XAGUSD', 'TVC:SILVER', 'COMEX:SI1!', 'SILVER'],
    XPTUSD: ['OANDA:XPTUSD', 'XPT/USD', 'XPTUSD', 'TVC:PLATINUM'],
    XPDUSD: ['OANDA:XPDUSD', 'XPD/USD', 'XPDUSD', 'TVC:PALLADIUM'],
    XAUEUR: ['OANDA:XAUEUR', 'XAU/EUR', 'XAUEUR'],
    HGCOPPER: ['COMEX:HG1!', 'OANDA:XCUUSD', 'HG/COPPER', 'COPPER'],
    COPPER: ['COMEX:HG1!', 'OANDA:XCUUSD', 'HG/COPPER'],
    WTIUSD: ['NYMEX:CL1!', 'WTI/USD', 'WTICOUSD', 'OIL_CRUDE', 'WTI'],
    WTIOIL: ['NYMEX:CL1!', 'WTI/USD', 'WTICOUSD', 'OIL_CRUDE', 'WTI'],
    WTICOUSD: ['NYMEX:CL1!', 'WTI/USD', 'OIL_CRUDE', 'WTI'],
    OILCRUDE: ['NYMEX:CL1!', 'WTI/USD', 'WTICOUSD', 'OIL_CRUDE'],
    BRENT: ['ICEEUR:BRN1!', 'BCOUSD', 'UKOIL'],
    US500: ['SP:SPX', 'SPX500', 'SP500', 'US_500'],
    SPX500: ['SP:SPX', 'US500', 'SP500'],
    NAS100: ['NASDAQ:NDX', 'US_TECH', 'USTEC', 'NQ1!'],
    USTECH: ['NASDAQ:NDX', 'NAS100', 'USTEC'],
    US30: ['DJ:DJI', 'WALL_ST', 'DJ30', 'DOW'],
    WALLST: ['DJ:DJI', 'US30', 'DJ30'],
    GER40: ['XETR:DAX', 'GER_40', 'DAX40', 'DAX'],
    UK100: ['TVC:UKX', 'UK_100', 'FTSE'],
    FRA40: ['EURONEXT:PX1', 'PX1'],
    JPN225: ['TVC:NI225', 'JAP_225', 'NIKKEI'],
    JAP225: ['TVC:NI225', 'JPN225', 'NIKKEI'],
    HK50: ['TVC:HSI', 'HSI'],
    AUS200: ['OANDA:AU200AUD', 'AU200AUD'],
    EUSTX50: ['TVC:SX5E', 'SX5E'],
    DXY: ['TVC:DXY', 'USDX'],
    US10Y: ['TVC:US10Y', 'US 10Y'],
    BTCUSD: ['BINANCE:BTCUSDT', 'BTC/USD', 'BTC'],
    ETHUSD: ['BINANCE:ETHUSDT', 'ETH/USD', 'ETH'],
    SOLUSD: ['BINANCE:SOLUSDT', 'SOL/USD', 'SOL'],
    XRPUSD: ['BINANCE:XRPUSDT', 'XRP/USD', 'XRP'],
    LTCUSD: ['BINANCE:LTCUSDT', 'LTC/USD'],
    DOGEUSD: ['BINANCE:DOGEUSDT', 'DOGE/USD'],
    ADAUSD: ['BINANCE:ADAUSDT', 'ADA/USD'],
    BNBUSD: ['BINANCE:BNBUSDT', 'BNB/USD'],
    SCOM: ['NSEKE:SCOM', 'SCOM'],
    EQTY: ['NSEKE:EQTY', 'EQTY'],
    KCB: ['NSEKE:KCB', 'KCB'],
    EABL: ['NSEKE:EABL', 'EABL'],
    SCBK: ['NSEKE:SCBK', 'SCBK'],
    BAT: ['NSEKE:BAT', 'BAT'],
    SPY: ['AMEX:SPY', 'SPY'],
    AMZN: ['NASDAQ:AMZN', 'AMZN'],
    GOOGL: ['NASDAQ:GOOGL', 'GOOGL'],
    META: ['NASDAQ:META', 'META'],
  };

  const candidates = [
    ...(aliasMap[clean] || []),
    `OANDA:${clean}`,
    `FX:${clean}`,
    `FX_IDC:${clean}`,
    `NSEKE:${clean}`,
    `NASDAQ:${clean}`,
    `AMEX:${clean}`,
    `NYSE:${clean}`,
    `SP:${clean}`,
    `DJ:${clean}`,
    `TVC:${clean}`,
    upper,
    upper.replace('/', ''),
    upper.replace('_', ''),
    clean,
  ];

  for (const key of candidates) {
    const q = quotes[key];
    if (q && typeof q.price === 'number' && q.price > 0) {
      return q;
    }
  }
  return undefined;
}

/**
 * Resolve price with TradingView quote first, then TV_BENCHMARK_PRICES, then component fallback.
 */
export function resolveTradingViewPrice(
  quotes: Record<string, LiveTvQuote>,
  symbol: string,
  fallbackPrice: number
): number {
  const q = lookupTradingViewQuote(quotes, symbol);
  if (q && q.price > 0) return q.price;
  const upper = symbol.toUpperCase().trim();
  const clean = upper.replace(/[/_\s-]/g, '');
  return TV_BENCHMARK_PRICES[upper] ?? TV_BENCHMARK_PRICES[clean] ?? fallbackPrice;
}

/**
 * Shared React hook to subscribe any desk or panel to live TradingView quotes.
 */
export function useTradingViewQuotes(pollMs: number = 2500): Record<string, LiveTvQuote> {
  const [quotes, setQuotes] = useState<Record<string, LiveTvQuote>>(sharedQuotesCache);

  useEffect(() => {
    let active = true;
    const listener = (next: Record<string, LiveTvQuote>) => {
      if (active) setQuotes(next);
    };
    subscribers.add(listener);
    ensureSharedStream();

    if (Object.keys(sharedQuotesCache).length > 0) {
      setQuotes({ ...sharedQuotesCache });
    } else {
      fetchSharedQuotes();
    }

    // Fallback poll when SSE hasn't delivered a tick recently OR when TradingView live feed hasn't hydrated yet
    const timer = setInterval(() => {
      const hasLiveGold = Boolean(sharedQuotesCache['OANDA:XAUUSD'] && !sharedQuotesCache['OANDA:XAUUSD'].isFallback);
      if (!hasLiveGold || Date.now() - lastSseMessageAt > Math.max(pollMs, 3500)) {
        fetchSharedQuotes(!hasLiveGold);
      }
    }, pollMs);

    return () => {
      active = false;
      subscribers.delete(listener);
      clearInterval(timer);
    };
  }, [pollMs]);

  return quotes;
}
