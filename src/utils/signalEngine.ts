import type { LiveTvQuote, TimeframeTechnicals } from './tradingViewSync.ts';

export const MAX_RISK_REWARD = 5.0;

export type SignalDirection = 'BUY' | 'SELL';
export type SignalAction = 'STRONG BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG SELL';
export type TimeframeCategory = 'Ultra-Scalp' | 'Scalp' | 'Intraday' | 'Swing' | 'Position';

export interface SignalCandleInput {
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface TimeframeProfile {
  normalized: string;
  label: string;
  category: TimeframeCategory;
  /** Scales SL/TP volatility relative to a 1H baseline */
  volatilityScale: number;
  /** Target TP1 Risk-Reward multiple (strictly <= 5.0) */
  baseTp1RR: number;
  /** Target TP2 / Runner Risk-Reward multiple (strictly <= 5.0) */
  baseTp2RR: number;
  /** Preferred directional weighting: faster oscillators vs structural EMAs */
  oscillatorWeight: number;
  trendWeight: number;
}

/**
 * Normalizes any timeframe string (e.g. "M1", "1m", "15m", "1H", "H4", "1D", "1W", "1M")
 * while carefully distinguishing "1m" (1-minute) from "1M" (1-month).
 */
export function getTimeframeProfile(rawTf?: string): TimeframeProfile {
  const tf = (rawTf || 'M5').trim();

  // Case-sensitive check for "1M" (1 Month) vs "1m" / "M1" (1 Minute)
  if (tf === '1M' || tf === 'M' || tf === 'MN' || tf === 'MN1' || tf.toUpperCase() === '6M' || tf.toUpperCase() === '1Y' || tf.toUpperCase() === 'ALL') {
    const label = tf === '1M' || tf === 'M' || tf === 'MN' || tf === 'MN1' ? '1M' : tf.toUpperCase();
    return {
      normalized: label,
      label,
      category: 'Position',
      volatilityScale: label === '1M' ? 3.8 : 4.5,
      baseTp1RR: 2.2,
      baseTp2RR: 4.5,
      oscillatorWeight: 0.25,
      trendWeight: 0.75,
    };
  }

  const upper = tf.toUpperCase();
  if (upper === '1S') {
    return {
      normalized: '1s',
      label: '1s',
      category: 'Ultra-Scalp',
      volatilityScale: 0.22,
      baseTp1RR: 1.4,
      baseTp2RR: 2.0,
      oscillatorWeight: 0.75,
      trendWeight: 0.25,
    };
  }
  if (upper === 'M1' || upper === '1M_SCALP' || tf === '1m') {
    return {
      normalized: 'M1',
      label: '1m',
      category: 'Scalp',
      volatilityScale: 0.30,
      baseTp1RR: 1.5,
      baseTp2RR: 2.4,
      oscillatorWeight: 0.7,
      trendWeight: 0.3,
    };
  }
  if (upper === 'M3' || tf === '3m') {
    return {
      normalized: 'M3',
      label: '3m',
      category: 'Scalp',
      volatilityScale: 0.40,
      baseTp1RR: 1.6,
      baseTp2RR: 2.6,
      oscillatorWeight: 0.65,
      trendWeight: 0.35,
    };
  }
  if (upper === 'M5' || tf === '5m') {
    return {
      normalized: 'M5',
      label: '5m',
      category: 'Scalp',
      volatilityScale: 0.50,
      baseTp1RR: 1.7,
      baseTp2RR: 2.8,
      oscillatorWeight: 0.6,
      trendWeight: 0.4,
    };
  }
  if (upper === 'M15' || tf === '15m') {
    return {
      normalized: 'M15',
      label: '15m',
      category: 'Scalp',
      volatilityScale: 0.72,
      baseTp1RR: 1.8,
      baseTp2RR: 3.1,
      oscillatorWeight: 0.55,
      trendWeight: 0.45,
    };
  }
  if (upper === 'M30' || tf === '30m' || upper === '45M' || tf === '45m') {
    const lbl = upper === '45M' ? '45m' : '30m';
    return {
      normalized: upper === '45M' ? '45m' : 'M30',
      label: lbl,
      category: 'Intraday',
      volatilityScale: 0.90,
      baseTp1RR: 1.9,
      baseTp2RR: 3.3,
      oscillatorWeight: 0.48,
      trendWeight: 0.52,
    };
  }
  if (upper === 'H1' || upper === '1H') {
    return {
      normalized: 'H1',
      label: '1H',
      category: 'Intraday',
      volatilityScale: 1.15,
      baseTp1RR: 2.0,
      baseTp2RR: 3.6,
      oscillatorWeight: 0.42,
      trendWeight: 0.58,
    };
  }
  if (upper === 'H2' || upper === '2H') {
    return {
      normalized: 'H2',
      label: '2H',
      category: 'Intraday',
      volatilityScale: 1.45,
      baseTp1RR: 2.1,
      baseTp2RR: 3.8,
      oscillatorWeight: 0.38,
      trendWeight: 0.62,
    };
  }
  if (upper === 'H4' || upper === '4H') {
    return {
      normalized: 'H4',
      label: '4H',
      category: 'Swing',
      volatilityScale: 1.95,
      baseTp1RR: 2.2,
      baseTp2RR: 4.1,
      oscillatorWeight: 0.33,
      trendWeight: 0.67,
    };
  }
  if (upper === 'D1' || upper === '1D' || upper === 'DAILY') {
    return {
      normalized: 'D1',
      label: '1D',
      category: 'Swing',
      volatilityScale: 2.65,
      baseTp1RR: 2.3,
      baseTp2RR: 4.5,
      oscillatorWeight: 0.3,
      trendWeight: 0.7,
    };
  }
  if (upper === 'W1' || upper === '1W' || upper === 'WEEKLY') {
    return {
      normalized: 'W1',
      label: '1W',
      category: 'Position',
      volatilityScale: 3.30,
      baseTp1RR: 2.4,
      baseTp2RR: 4.8,
      oscillatorWeight: 0.25,
      trendWeight: 0.75,
    };
  }

  return {
    normalized: 'M5',
    label: '5m',
    category: 'Scalp',
    volatilityScale: 0.50,
    baseTp1RR: 1.7,
    baseTp2RR: 2.8,
    oscillatorWeight: 0.6,
    trendWeight: 0.4,
  };
}

export function clampRiskRewardRatio(rr: number, minRR = 1.2): number {
  if (!Number.isFinite(rr) || rr <= 0) return 2.0;
  return Number(Math.min(MAX_RISK_REWARD, Math.max(minRR, rr)).toFixed(1));
}

export function formatRiskReward(rr: number): string {
  return `1:${clampRiskRewardRatio(rr).toFixed(1)}`;
}

/**
 * Maps a normalized timeframe to the nearest TradingView scanner timeframe bucket key
 * (`1`, `5`, `15`, `30`, `60`, `240`, `1D`, `1W`, `1M`).
 */
export function mapToTvScannerBucket(rawTf?: string): string {
  const tf = getTimeframeProfile(rawTf).normalized;
  if (tf === '1s' || tf === 'M1') return '1';
  if (tf === 'M3' || tf === 'M5') return '5';
  if (tf === 'M15') return '15';
  if (tf === 'M30' || tf === '45m') return '30';
  if (tf === 'H1' || tf === 'H2') return '60';
  if (tf === 'H4') return '240';
  if (tf === 'W1') return '1W';
  if (tf === '1M' || tf === '6M' || tf === '1Y' || tf === 'ALL') return '1M';
  return '1D';
}

export function resolveQuoteForTimeframe(
  quote: Partial<LiveTvQuote> | undefined,
  timeframe: string
): TimeframeTechnicals & { price?: number; open?: number; adx?: number; atr?: number } {
  if (!quote) return {};
  const bucket = mapToTvScannerBucket(timeframe);
  const tfSlice = quote.timeframeSignals?.[bucket];
  if (!tfSlice) {
    return {
      recommendAll: quote.recommendAll,
      recommendMa: quote.recommendMa,
      recommendOther: quote.recommendOther,
      rsi: quote.rsi,
      macd: quote.macd,
      macdSignal: quote.macdSignal,
      ema20: quote.ema20,
      ema50: quote.ema50,
      changePercent: quote.changePercent,
      price: quote.price,
      open: quote.open,
      adx: quote.adx,
      atr: quote.atr,
    };
  }
  return {
    recommendAll: typeof tfSlice.recommendAll === 'number' ? tfSlice.recommendAll : quote.recommendAll,
    recommendMa: typeof tfSlice.recommendMa === 'number' ? tfSlice.recommendMa : quote.recommendMa,
    recommendOther: typeof tfSlice.recommendOther === 'number' ? tfSlice.recommendOther : quote.recommendOther,
    rsi: typeof tfSlice.rsi === 'number' ? tfSlice.rsi : quote.rsi,
    macd: typeof tfSlice.macd === 'number' ? tfSlice.macd : quote.macd,
    macdSignal: typeof tfSlice.macdSignal === 'number' ? tfSlice.macdSignal : quote.macdSignal,
    ema20: typeof tfSlice.ema20 === 'number' ? tfSlice.ema20 : quote.ema20,
    ema50: typeof tfSlice.ema50 === 'number' ? tfSlice.ema50 : quote.ema50,
    changePercent: typeof tfSlice.changePercent === 'number' ? tfSlice.changePercent : quote.changePercent,
    price: quote.price,
    open: quote.open,
    adx: quote.adx,
    atr: quote.atr,
  };
}

/**
 * Evaluates live TradingView timeframe indicators + live price action / candles
 * so the signal direction strictly aligns with what the active chart is doing.
 */
export function evaluateDirectionalConfluence(
  quote: Partial<LiveTvQuote> | undefined,
  spotPrice: number,
  timeframe: string,
  fallbackDirection?: SignalDirection,
  candles?: SignalCandleInput[]
): {
  direction: SignalDirection;
  action: SignalAction;
  confidenceScore: number;
  compositeScore: number;
  setupLabel: string;
} {
  const tf = getTimeframeProfile(timeframe);
  const eff = resolveQuoteForTimeframe(quote, timeframe);

  // 1. Trend & Moving Average score (-1 to +1)
  let trendSignal = 0;
  let trendCount = 0;
  if (typeof eff.recommendMa === 'number') {
    trendSignal += eff.recommendMa;
    trendCount++;
  }
  if (typeof eff.ema20 === 'number' && typeof eff.ema50 === 'number' && eff.ema50 > 0) {
    trendSignal += eff.ema20 >= eff.ema50 ? 0.6 : -0.6;
    trendSignal += spotPrice >= eff.ema20 ? 0.45 : -0.45;
    trendCount += 1.5;
  } else if (typeof eff.ema20 === 'number' && eff.ema20 > 0) {
    trendSignal += spotPrice >= eff.ema20 ? 0.5 : -0.5;
    trendCount += 1;
  }
  if (typeof quote?.ema200 === 'number' && quote.ema200 > 0 && (tf.category === 'Swing' || tf.category === 'Position' || tf.category === 'Intraday')) {
    trendSignal += spotPrice >= quote.ema200 ? 0.35 : -0.35;
    trendCount += 0.5;
  }
  const avgTrend = trendCount > 0 ? trendSignal / trendCount : 0;

  // 2. Oscillator / Momentum score (-1 to +1) — NEVER invert a strong selloff into a buy
  let oscSignal = 0;
  let oscCount = 0;
  if (typeof eff.recommendOther === 'number') {
    oscSignal += eff.recommendOther;
    oscCount++;
  }
  if (typeof eff.rsi === 'number') {
    if (eff.rsi >= 52) {
      oscSignal += Math.min(0.85, (eff.rsi - 50) / 22);
    } else if (eff.rsi <= 48) {
      oscSignal -= Math.min(0.85, (50 - eff.rsi) / 22);
    }
    oscCount++;
  }
  if (typeof eff.macd === 'number' && typeof eff.macdSignal === 'number') {
    oscSignal += eff.macd >= eff.macdSignal ? 0.65 : -0.65;
    oscCount++;
  }
  const avgOsc = oscCount > 0 ? oscSignal / oscCount : 0;

  // 3. Real-time Price Action & Candle Slope (-1 to +1)
  let priceActionSignal = 0;
  let priceActionCount = 0;

  if (typeof eff.changePercent === 'number' && Math.abs(eff.changePercent) > 0.005) {
    const scaled = Math.max(-0.9, Math.min(0.9, eff.changePercent / 0.65));
    priceActionSignal += scaled;
    priceActionCount++;
  }
  if (typeof quote?.open === 'number' && quote.open > 0 && spotPrice > 0) {
    const openDeltaPct = ((spotPrice - quote.open) / quote.open) * 100;
    if (Math.abs(openDeltaPct) > 0.005) {
      priceActionSignal += Math.max(-0.8, Math.min(0.8, openDeltaPct / 0.5));
      priceActionCount++;
    }
  }
  if (Array.isArray(candles) && candles.length >= 4) {
    const recent = candles.slice(-6);
    const firstOpen = recent[0].open;
    const lastClose = recent[recent.length - 1].close;
    const candleReturnPct = firstOpen > 0 ? ((lastClose - firstOpen) / firstOpen) * 100 : 0;
    const redCount = recent.filter((c) => c.close < c.open).length;
    const greenCount = recent.length - redCount;
    const candleBalance = (greenCount - redCount) / recent.length; // -1 to +1
    const slopeScore = Math.max(-1, Math.min(1, candleReturnPct * 1.4)) * 0.6 + candleBalance * 0.4;
    priceActionSignal += slopeScore;
    priceActionCount += 1.5;
  }
  const avgPriceAction = priceActionCount > 0 ? priceActionSignal / priceActionCount : 0;

  const recAll = typeof eff.recommendAll === 'number' ? eff.recommendAll : undefined;
  const hasAnySignal = trendCount > 0 || oscCount > 0 || priceActionCount > 0 || typeof recAll === 'number';

  let composite = 0;
  if (hasAnySignal) {
    const tvComponent = typeof recAll === 'number' ? recAll : 0;
    const weightedIndicators = avgOsc * tf.oscillatorWeight + avgTrend * tf.trendWeight;
    if (priceActionCount > 0 && (trendCount > 0 || oscCount > 0 || typeof recAll === 'number')) {
      composite = weightedIndicators * 0.48 + tvComponent * 0.27 + avgPriceAction * 0.25;
    } else if (priceActionCount > 0) {
      composite = avgPriceAction;
    } else {
      composite = weightedIndicators * 0.65 + tvComponent * 0.35;
    }
  } else {
    composite = fallbackDirection === 'SELL' ? -0.25 : 0.25;
  }

  // Hard alignment guard: if TradingView's official timeframe rating strongly points one way,
  // prevent indicator edge cases from contradicting the chart
  if (typeof recAll === 'number' && Math.abs(recAll) >= 0.12) {
    const tvSign = recAll > 0 ? 1 : -1;
    const paAgreesOrNeutral = avgPriceAction === 0 || avgPriceAction * tvSign >= -0.15;
    if (paAgreesOrNeutral && composite * tvSign < 0) {
      composite = recAll * 0.75 + avgPriceAction * 0.25;
    }
  }

  // Normalize composite to [-1, 1]
  composite = Math.max(-1, Math.min(1, composite));

  // Derive fallback from live changePercent if no explicit fallbackDirection passed
  const inferredFallback: SignalDirection =
    fallbackDirection ||
    (typeof eff.changePercent === 'number' && eff.changePercent < 0 ? 'SELL' : 'BUY');

  const direction: SignalDirection =
    Math.abs(composite) < 0.03 ? inferredFallback : composite > 0 ? 'BUY' : 'SELL';

  const absStrength = Math.abs(composite);
  const adxBoost = typeof quote?.adx === 'number' ? (quote.adx >= 25 ? 6 : quote.adx < 18 ? -6 : 1) : 2;
  const confidenceScore = Math.round(
    Math.min(96, Math.max(66, 74 + absStrength * 20 + adxBoost))
  );

  let action: SignalAction = direction;
  if (absStrength >= 0.34 && confidenceScore >= 84) {
    action = direction === 'BUY' ? 'STRONG BUY' : 'STRONG SELL';
  }

  let setupLabel = '';
  if (tf.category === 'Ultra-Scalp' || tf.category === 'Scalp') {
    setupLabel =
      direction === 'BUY'
        ? `${tf.label} Liquidity Sweep & Bullish FVG Scalp`
        : `${tf.label} BSL Sweep & Bearish Micro-Displacement`;
  } else if (tf.category === 'Intraday') {
    setupLabel =
      direction === 'BUY'
        ? `${tf.label} Session Order Block & 20 EMA Retest`
        : `${tf.label} Supply Rejection & Intraday Breakdown`;
  } else if (tf.category === 'Swing') {
    setupLabel =
      direction === 'BUY'
        ? `${tf.label} Structural Bullish BOS & Demand Continuation`
        : `${tf.label} Swing High CHoCH & Supply Distribution`;
  } else {
    setupLabel =
      direction === 'BUY'
        ? `${tf.label} Macro Accumulation & Primary Trend Expansion`
        : `${tf.label} Macro Distribution & Primary Downtrend`;
  }

  return {
    direction,
    action,
    confidenceScore,
    compositeScore: Number(composite.toFixed(3)),
    setupLabel,
  };
}

export interface ComputedSignalLevels {
  symbol: string;
  timeframe: string;
  timeframeLabel: string;
  category: TimeframeCategory;
  direction: SignalDirection;
  action: SignalAction;
  confidenceScore: number;
  compositeScore: number;
  setupLabel: string;
  entryPrice: number;
  entryZone: string;
  sl: number;
  tp1: number;
  tp2: number;
  slDistance: number;
  tp1Distance: number;
  tp2Distance: number;
  tp1RiskReward: number;
  riskRewardRatio: number;
  riskReward: string;
  decimals: number;
  unitLabel: 'pips' | 'pts' | '%';
  slUnitValue: number;
  tp1UnitValue: number;
  tp2UnitValue: number;
}

export function getSymbolPrecision(symbol: string, spotPrice: number, market?: string): number {
  const s = symbol.toUpperCase();
  if (s.includes('R_75') || s.includes('1HZ75V') || s.includes('BTC') || s.includes('US30') || s.includes('WALL_ST')) {
    return 2;
  }
  if (s.includes('XAU') || s.includes('XPT') || s.includes('XPD') || s.includes('BOOM') || s.includes('CRASH') || s.includes('R_100') || s.includes('1HZ100V') || s.includes('ETH') || s.includes('SOL') || s.includes('US500') || s.includes('GER')) {
    return 2;
  }
  if (s.includes('NAS') || s.includes('US_TECH') || s.includes('USTEC') || s.includes('STP')) {
    return 1;
  }
  if (s.includes('JPY') || s.includes('XAG')) {
    return 3;
  }
  if (s.includes('KES') || s.includes('ZAR') || s.includes('MXN') || s.includes('TRY')) {
    return spotPrice >= 100 ? 2 : 3;
  }
  if (s.includes('UGX') || s.includes('TZS')) {
    return 1;
  }
  if (market === 'US' || market === 'NSE') {
    return 2;
  }
  return spotPrice < 10 ? 5 : 2;
}

/**
 * Computes realistic SL, TP1, TP2 and exact R:R strictly scaled by timeframe and
 * strictly capped at MAX_RISK_REWARD (5.0).
 */
export function computeTimeframeSignalLevels(params: {
  symbol: string;
  spotPrice: number;
  timeframe: string;
  quote?: Partial<LiveTvQuote>;
  candles?: SignalCandleInput[];
  market?: 'FOREX' | 'METALS' | 'INDICES' | 'NSE' | 'US' | 'CRYPTO' | 'SYNTHETICS';
  preferredDirection?: SignalDirection;
  customSlDistance?: number;
  customTargetRR?: number;
}): ComputedSignalLevels {
  const { symbol, spotPrice, timeframe, quote, candles, market, preferredDirection, customSlDistance, customTargetRR } = params;
  const s = symbol.toUpperCase();
  const tf = getTimeframeProfile(timeframe);
  const decimals = getSymbolPrecision(s, spotPrice, market);

  const evalRes = evaluateDirectionalConfluence(quote, spotPrice, timeframe, preferredDirection, candles);
  const direction = preferredDirection || evalRes.direction;
  const action: SignalAction = preferredDirection
    ? evalRes.confidenceScore >= 84
      ? preferredDirection === 'BUY'
        ? 'STRONG BUY'
        : 'STRONG SELL'
      : preferredDirection
    : evalRes.action;

  // Baseline 1H structural volatility per instrument class, calibrated by ATR when present
  let base1HStop = spotPrice * 0.0045;
  let unitLabel: 'pips' | 'pts' | '%' = 'pts';
  let pipFactor = 1;

  const isGold = s.includes('XAU') || s.includes('GOLD');
  const isSilver = s.includes('XAG') || s.includes('SILVER');
  const isJpy = s.includes('JPY');
  const isKes = s.includes('KES');
  const isIndex = s.includes('NAS') || s.includes('US30') || s.includes('US500') || s.includes('GER') || s.includes('UK100') || s.includes('JPN225') || s.includes('US_TECH') || s.includes('WALL_ST') || s.includes('SPX') || s.includes('DJI') || s.includes('DXY') || market === 'INDICES';
  const isSynthetic = s.includes('R_') || s.includes('1HZ') || s.includes('BOOM') || s.includes('CRASH') || s.includes('STP') || s.includes('JD') || market === 'SYNTHETICS';
  const isCrypto = s.includes('BTC') || s.includes('ETH') || s.includes('SOL') || s.includes('XRP') || s.includes('DOGE') || s.includes('ADA') || s.includes('BNB') || market === 'CRYPTO';
  const isEquity = market === 'NSE' || market === 'US';

  if (isGold) {
    const rawAtr = quote?.atr && quote.atr > 0 ? quote.atr : 16.5;
    base1HStop = Math.max(10.0, Math.min(28.0, rawAtr * 1.1));
    unitLabel = 'pts';
    pipFactor = 1;
  } else if (isSilver) {
    const rawAtr = quote?.atr && quote.atr > 0 ? quote.atr : 0.55;
    base1HStop = Math.max(0.28, Math.min(1.10, rawAtr));
    unitLabel = 'pts';
    pipFactor = 1;
  } else if (isEquity) {
    // Equities: 1H structural stop ~1.5% (capped cleanly on scalp vs swing)
    base1HStop = spotPrice * 0.015;
    unitLabel = '%';
    pipFactor = 100 / Math.max(spotPrice, 0.01);
  } else if (isCrypto) {
    const rawAtr = quote?.atr && quote.atr > 0 ? quote.atr : spotPrice * 0.014;
    base1HStop = Math.max(spotPrice * 0.006, Math.min(spotPrice * 0.025, rawAtr));
    unitLabel = 'pts';
    pipFactor = 1;
  } else if (isSynthetic) {
    base1HStop = s.includes('BOOM') || s.includes('CRASH') ? spotPrice * 0.0028 : spotPrice * 0.0065;
    unitLabel = 'pts';
    pipFactor = 1;
  } else if (isIndex) {
    const rawAtr = quote?.atr && quote.atr > 0 ? quote.atr : spotPrice * 0.0038;
    base1HStop = Math.max(spotPrice * 0.0018, Math.min(spotPrice * 0.0075, rawAtr * 0.95));
    unitLabel = s === 'DXY' ? 'pips' : 'pts';
    pipFactor = s === 'DXY' ? 100 : 1;
  } else if (isJpy) {
    const rawAtr = quote?.atr && quote.atr > 0 ? quote.atr : 0.52;
    base1HStop = Math.max(0.22, Math.min(0.95, rawAtr * 0.9));
    unitLabel = 'pips';
    pipFactor = 100;
  } else if (isKes) {
    base1HStop = 0.65;
    unitLabel = 'pips';
    pipFactor = 100;
  } else if (s.includes('ZAR') || s.includes('MXN') || s.includes('TRY')) {
    base1HStop = spotPrice * 0.0055;
    unitLabel = 'pips';
    pipFactor = 10000;
  } else if (s.includes('UGX') || s.includes('TZS')) {
    base1HStop = spotPrice * 0.004;
    unitLabel = 'pts';
    pipFactor = 1;
  } else {
    // Standard Major/Minor Forex (1 pip = 0.0001)
    const rawAtr = quote?.atr && quote.atr > 0 ? quote.atr : 0.0038;
    base1HStop = Math.max(0.0018, Math.min(0.0065, rawAtr * 0.85));
    unitLabel = 'pips';
    pipFactor = 10000;
  }

  // Scale SL distance strictly by timeframe volatilityScale
  const minStopTick = Math.max(spotPrice * 0.0005, Math.pow(10, -decimals) * 8);
  const slDistanceRaw = customSlDistance && customSlDistance > 0
    ? customSlDistance
    : Math.max(minStopTick, base1HStop * tf.volatilityScale);

  // Calibrate RR dynamically from confidence + ADX, strictly capped <= 5.0
  const confidenceBoost = (evalRes.confidenceScore - 80) * 0.03; // -0.36 to +0.48
  const rawTp2RR = customTargetRR
    ? customTargetRR
    : tf.baseTp2RR + confidenceBoost;
  const clampedTp2RR = clampRiskRewardRatio(rawTp2RR, 1.3); // Strictly <= 5.0
  const clampedTp1RR = clampRiskRewardRatio(Math.min(tf.baseTp1RR, clampedTp2RR * 0.62), 1.1);

  const slDistance = Number(slDistanceRaw.toFixed(decimals));
  const tp1Distance = Number((slDistance * clampedTp1RR).toFixed(decimals));
  const tp2Distance = Number((slDistance * clampedTp2RR).toFixed(decimals));

  const sl = Number((direction === 'BUY' ? spotPrice - slDistance : spotPrice + slDistance).toFixed(decimals));
  const tp1 = Number((direction === 'BUY' ? spotPrice + tp1Distance : spotPrice - tp1Distance).toFixed(decimals));
  const tp2 = Number((direction === 'BUY' ? spotPrice + tp2Distance : spotPrice - tp2Distance).toFixed(decimals));

  const actualRR = slDistance > 0 ? clampRiskRewardRatio(tp2Distance / slDistance, 1.1) : clampedTp2RR;
  const actualTp1RR = slDistance > 0 ? clampRiskRewardRatio(tp1Distance / slDistance, 1.0) : clampedTp1RR;

  const entrySpan = Number((slDistance * 0.22).toFixed(decimals));
  const entryLow = (spotPrice - entrySpan * 0.45).toFixed(decimals);
  const entryHigh = (spotPrice + entrySpan * 0.55).toFixed(decimals);

  return {
    symbol: s,
    timeframe: tf.normalized,
    timeframeLabel: tf.label,
    category: tf.category,
    direction,
    action,
    confidenceScore: evalRes.confidenceScore,
    compositeScore: evalRes.compositeScore,
    setupLabel: evalRes.setupLabel,
    entryPrice: Number(spotPrice.toFixed(decimals)),
    entryZone: `${entryLow} - ${entryHigh}`,
    sl,
    tp1,
    tp2,
    slDistance,
    tp1Distance,
    tp2Distance,
    tp1RiskReward: actualTp1RR,
    riskRewardRatio: actualRR,
    riskReward: formatRiskReward(actualRR),
    decimals,
    unitLabel,
    slUnitValue: unitLabel === 'pips' ? Math.round(slDistance * pipFactor) : Number((slDistance * pipFactor).toFixed(decimals === 5 ? 4 : 2)),
    tp1UnitValue: unitLabel === 'pips' ? Math.round(tp1Distance * pipFactor) : Number((tp1Distance * pipFactor).toFixed(decimals === 5 ? 4 : 2)),
    tp2UnitValue: unitLabel === 'pips' ? Math.round(tp2Distance * pipFactor) : Number((tp2Distance * pipFactor).toFixed(decimals === 5 ? 4 : 2)),
  };
}

/**
 * Sanitizes any R:R string or price levels returned by an AI model so Risk/Reward
 * NEVER exceeds 1:5.0 and stays mathematically consistent.
 */
export function sanitizeRiskRewardString(rrStr?: string, slPrice?: number, tpPrice?: number, entryPrice?: number): string {
  if (typeof slPrice === 'number' && typeof tpPrice === 'number' && typeof entryPrice === 'number') {
    const slD = Math.abs(entryPrice - slPrice);
    const tpD = Math.abs(tpPrice - entryPrice);
    if (slD > 0 && tpD > 0) {
      return formatRiskReward(tpD / slD);
    }
  }
  if (rrStr) {
    const match = rrStr.match(/1\s*:\s*([0-9]+(?:\.[0-9]+)?)/);
    if (match) {
      return formatRiskReward(parseFloat(match[1]));
    }
  }
  return '1:2.5';
}
