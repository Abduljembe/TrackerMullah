import type { LiveTvQuote, TimeframeTechnicals } from './tradingViewSync.ts';

export const MAX_RISK_REWARD = 5.0;

export type SignalDirection = 'BUY' | 'SELL';
export type SignalAction = 'STRONG BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG SELL';
export type TimeframeCategory = 'Ultra-Scalp' | 'Scalp' | 'Intraday' | 'Swing' | 'Position';
export type ExecutionMode = 'MARKET_NOW' | 'PULLBACK_LIMIT' | 'WAIT_FOR_CONFIRMATION';
export type SignalGrade = 'A+' | 'A' | 'B' | 'WAIT';

export interface SignalCandleInput {
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  takerBuyVolume?: number;
  timeLabel?: string;
}

export interface MacroCorrelationContext {
  dxyChangePercent?: number;
  dxyRecAll?: number;
  us10yChangePercent?: number;
  us10yRecAll?: number;
}

export interface NewsHazardInput {
  isHazardWindow: boolean;
  severity: 'HIGH_PAUSE' | 'MEDIUM_CAUTION' | 'CLEAR';
  title?: string;
  currency?: string;
  minutesToNext?: number | null;
}

export interface SessionTimingInfo {
  sessionName: string;
  quality: 'PRIME' | 'ACTIVE' | 'OFF_PEAK';
  scoreDelta: number;
  note: string;
}

export interface TimeframeProfile {
  normalized: string;
  label: string;
  category: TimeframeCategory;
  /** Scales SL/TP volatility relative to a 1H baseline */
  volatilityScale: number;
  /** High-probability conservative TP1 Risk-Reward multiple (auto-breakeven trigger) */
  baseTp1RR: number;
  /** Realistic structural TP2 Risk-Reward multiple (strictly <= 5.0) */
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
      baseTp1RR: 1.4,
      baseTp2RR: 3.0,
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
      baseTp1RR: 1.1,
      baseTp2RR: 1.8,
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
      baseTp1RR: 1.15,
      baseTp2RR: 1.9,
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
      baseTp1RR: 1.15,
      baseTp2RR: 2.0,
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
      baseTp1RR: 1.2,
      baseTp2RR: 2.1,
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
      baseTp1RR: 1.25,
      baseTp2RR: 2.3,
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
      baseTp1RR: 1.3,
      baseTp2RR: 2.4,
      oscillatorWeight: 0.48,
      trendWeight: 0.52,
    };
  }
  if (upper === 'H1' || tf === '1H') {
    return {
      normalized: 'H1',
      label: '1H',
      category: 'Intraday',
      volatilityScale: 1.15,
      baseTp1RR: 1.3,
      baseTp2RR: 2.5,
      oscillatorWeight: 0.42,
      trendWeight: 0.58,
    };
  }
  if (upper === 'H2' || tf === '2H') {
    return {
      normalized: 'H2',
      label: '2H',
      category: 'Intraday',
      volatilityScale: 1.45,
      baseTp1RR: 1.35,
      baseTp2RR: 2.6,
      oscillatorWeight: 0.38,
      trendWeight: 0.62,
    };
  }
  if (upper === 'H4' || tf === '4H') {
    return {
      normalized: 'H4',
      label: '4H',
      category: 'Swing',
      volatilityScale: 1.95,
      baseTp1RR: 1.35,
      baseTp2RR: 2.8,
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
      baseTp1RR: 1.4,
      baseTp2RR: 3.0,
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
      baseTp1RR: 1.4,
      baseTp2RR: 3.2,
      oscillatorWeight: 0.25,
      trendWeight: 0.75,
    };
  }

  return {
    normalized: 'M5',
    label: '5m',
    category: 'Scalp',
    volatilityScale: 0.50,
    baseTp1RR: 1.2,
    baseTp2RR: 2.1,
    oscillatorWeight: 0.6,
    trendWeight: 0.4,
  };
}

export function clampRiskRewardRatio(rr: number, minRR = 1.1): number {
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
      atr: quote.atr,
      adx: quote.adx,
      bbUpper: quote.bbUpper,
      bbLower: quote.bbLower,
      price: quote.price,
      open: quote.open,
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
    atr: typeof tfSlice.atr === 'number' ? tfSlice.atr : quote.atr,
    adx: typeof tfSlice.adx === 'number' ? tfSlice.adx : quote.adx,
    bbUpper: typeof tfSlice.bbUpper === 'number' ? tfSlice.bbUpper : quote.bbUpper,
    bbLower: typeof tfSlice.bbLower === 'number' ? tfSlice.bbLower : quote.bbLower,
    price: quote.price,
    open: quote.open,
  };
}

/**
 * Evaluates current market session liquidity quality so setups during dead rollover
 * hours are tempered while London/NY overlaps & active cash sessions get priority.
 */
export function evaluateTradingSession(
  symbol: string,
  market?: string,
  now: Date = new Date()
): SessionTimingInfo {
  const s = symbol.toUpperCase();
  const utcHour = now.getUTCHours() + now.getUTCMinutes() / 60;
  const day = now.getUTCDay(); // 0=Sun, 6=Sat

  const isCryptoOrSynth =
    market === 'CRYPTO' ||
    market === 'SYNTHETICS' ||
    s.includes('BTC') ||
    s.includes('ETH') ||
    s.includes('SOL') ||
    s.includes('XRP') ||
    s.includes('R_') ||
    s.includes('1HZ') ||
    s.includes('BOOM') ||
    s.includes('CRASH') ||
    s.includes('STP');

  if (isCryptoOrSynth) {
    if (utcHour >= 12 && utcHour <= 20) {
      return {
        sessionName: '24/7 Peak US Volume',
        quality: 'PRIME',
        scoreDelta: 2,
        note: 'High-liquidity 24/7 window with tight spreads.',
      };
    }
    return {
      sessionName: '24/7 Continuous Session',
      quality: 'ACTIVE',
      scoreDelta: 0,
      note: '24/7 algorithmic feed active.',
    };
  }

  if (market === 'NSE' || s.includes('KES')) {
    // Nairobi cash session: 06:00 - 12:00 UTC (09:00 - 15:00 EAT) Mon-Fri
    if (day >= 1 && day <= 5 && utcHour >= 6 && utcHour <= 12.25) {
      return {
        sessionName: 'Nairobi Cash Session (EAT)',
        quality: 'PRIME',
        scoreDelta: 2,
        note: 'Active NSE/CBK East Africa institutional liquidity.',
      };
    }
    return {
      sessionName: 'NSE / CBK After-Hours',
      quality: 'OFF_PEAK',
      scoreDelta: -2,
      note: 'Outside Nairobi cash session — confirm spread at open.',
    };
  }

  const isUsEquityOrIndex =
    market === 'US' ||
    market === 'INDICES' ||
    s.includes('NAS') ||
    s.includes('US30') ||
    s.includes('US500') ||
    s.includes('SPX') ||
    s.includes('DJI');

  if (isUsEquityOrIndex) {
    if (day >= 1 && day <= 5 && utcHour >= 13.5 && utcHour <= 20.0) {
      return {
        sessionName: 'New York Cash Session',
        quality: 'PRIME',
        scoreDelta: 3,
        note: 'Peak US cash equity & futures order flow.',
      };
    }
    if (day >= 1 && day <= 5 && utcHour >= 7.0 && utcHour < 13.5) {
      return {
        sessionName: 'London Pre-Market Flow',
        quality: 'ACTIVE',
        scoreDelta: 0,
        note: 'European session futures volume active.',
      };
    }
    return {
      sessionName: 'After-Hours / Rollover',
      quality: 'OFF_PEAK',
      scoreDelta: -3,
      note: 'Thin after-hours index liquidity — avoid chasing breakouts.',
    };
  }

  // Forex & Spot Metals (London 07:00-16:00 UTC, NY 12:00-20:00 UTC, Overlap 12:00-16:00 UTC)
  if (utcHour >= 12.0 && utcHour <= 16.5) {
    return {
      sessionName: 'London / NY Overlap',
      quality: 'PRIME',
      scoreDelta: 3,
      note: 'Peak institutional FX & Gold killzone liquidity.',
    };
  }
  if ((utcHour >= 7.0 && utcHour < 12.0) || (utcHour > 16.5 && utcHour <= 20.0)) {
    return {
      sessionName: utcHour < 12.0 ? 'London Session' : 'New York Session',
      quality: 'ACTIVE',
      scoreDelta: 1,
      note: 'Healthy directional liquidity window.',
    };
  }
  if (utcHour >= 21.0 || utcHour < 1.0) {
    return {
      sessionName: 'NY Rollover / Dead Zone',
      quality: 'OFF_PEAK',
      scoreDelta: -4,
      note: 'Wide rollover spreads & low follow-through — higher fakeout risk.',
    };
  }
  return {
    sessionName: 'Asian Liquidity Session',
    quality: 'ACTIVE',
    scoreDelta: -1,
    note: 'Range-prone Asian flow — favor structure & tight TP1.',
  };
}

function getHigherTimeframeChain(rawTf: string): string[] {
  const norm = getTimeframeProfile(rawTf).normalized;
  if (norm === '1s' || norm === 'M1' || norm === 'M3' || norm === 'M5') return ['15m', '1H'];
  if (norm === 'M15' || norm === 'M30' || norm === '45m') return ['1H', '4H'];
  if (norm === 'H1' || norm === 'H2') return ['4H', '1D'];
  if (norm === 'H4') return ['1D', '1W'];
  if (norm === 'D1') return ['1W'];
  return [];
}

function evaluateMacroCorrelation(
  symbol: string,
  direction: SignalDirection,
  macro?: MacroCorrelationContext
): { aligned: boolean; scoreDelta: number; note: string } {
  if (!macro || (typeof macro.dxyChangePercent !== 'number' && typeof macro.us10yChangePercent !== 'number')) {
    return { aligned: true, scoreDelta: 0, note: 'Macro DXY/US10Y Neutral' };
  }
  const s = symbol.toUpperCase().replace(/[^A-Z0-9]/g, '');
  // Inverse USD correlation assets (rise when DXY/Yields fall)
  const isInverseUsd =
    s.includes('XAU') ||
    s.includes('XAG') ||
    s.startsWith('EURUSD') ||
    s.startsWith('GBPUSD') ||
    s.startsWith('AUDUSD') ||
    s.startsWith('NZDUSD') ||
    s.includes('NAS') ||
    s.includes('US500') ||
    s.includes('US30') ||
    s.includes('BTC') ||
    s.includes('ETH') ||
    s.includes('SOL');

  // Direct USD base correlation assets (rise when DXY/Yields rise)
  const isDirectUsd =
    s.startsWith('USDJPY') ||
    s.startsWith('USDCAD') ||
    s.startsWith('USDCHF') ||
    s.startsWith('USDKES') ||
    s.startsWith('USDZAR');

  if (!isInverseUsd && !isDirectUsd) {
    return { aligned: true, scoreDelta: 0, note: 'Cross-Pair / Local Flow' };
  }

  const dxyChg = typeof macro.dxyChangePercent === 'number' ? macro.dxyChangePercent : 0;
  const dxyRec = typeof macro.dxyRecAll === 'number' ? macro.dxyRecAll : 0;
  const y10Chg = typeof macro.us10yChangePercent === 'number' ? macro.us10yChangePercent : 0;

  const usdMacroScore =
    (Math.abs(dxyChg) > 0.05 ? Math.sign(dxyChg) : 0) +
    (Math.abs(dxyRec) > 0.15 ? Math.sign(dxyRec) : 0) +
    (Math.abs(y10Chg) > 0.1 ? Math.sign(y10Chg) * 0.8 : 0);

  if (Math.abs(usdMacroScore) < 0.8) {
    return { aligned: true, scoreDelta: 0, note: 'DXY & US10Y Yields Flat' };
  }

  const usdBullish = usdMacroScore > 0;
  const assetExpectedBull = isInverseUsd ? !usdBullish : usdBullish;
  const alignsWithTrade = (direction === 'BUY' && assetExpectedBull) || (direction === 'SELL' && !assetExpectedBull);

  if (alignsWithTrade) {
    return {
      aligned: true,
      scoreDelta: 4,
      note: `Macro Tailwind: ${usdBullish ? 'Rising' : 'Falling'} DXY & US10Y support ${direction}`,
    };
  }
  return {
    aligned: false,
    scoreDelta: -5,
    note: `Macro Headwind: ${usdBullish ? 'Rising' : 'Falling'} DXY & US10Y oppose ${direction}`,
  };
}

function evaluateSingleTimeframeScore(
  quote: Partial<LiveTvQuote> | undefined,
  spotPrice: number,
  timeframe: string,
  candles?: SignalCandleInput[]
): {
  direction: SignalDirection;
  composite: number;
  avgTrend: number;
  avgOsc: number;
  avgPriceAction: number;
  eff: ReturnType<typeof resolveQuoteForTimeframe>;
  confluenceCount: number;
  candleTrigger?: string;
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

  // 2. Oscillator / Momentum score (-1 to +1)
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
  if (typeof quote?.stochK === 'number' && typeof quote?.stochD === 'number') {
    oscSignal += quote.stochK >= quote.stochD ? 0.35 : -0.35;
    oscCount += 0.5;
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
  if (
    typeof quote?.open === 'number' &&
    quote.open > 0 &&
    spotPrice > 0 &&
    (tf.category === 'Swing' || tf.category === 'Position')
  ) {
    const openDeltaPct = ((spotPrice - quote.open) / quote.open) * 100;
    const chpAgrees =
      typeof quote.changePercent !== 'number' ||
      quote.changePercent === 0 ||
      openDeltaPct * quote.changePercent >= 0;
    if (chpAgrees && Math.abs(openDeltaPct) > 0.02) {
      priceActionSignal += Math.max(-0.8, Math.min(0.8, openDeltaPct / 0.5));
      priceActionCount++;
    }
  }
  let candleTrigger: string | undefined;
  if (Array.isArray(candles) && candles.length >= 4) {
    const recent = candles.slice(-6);
    const firstOpen = recent[0].open;
    const lastClose = recent[recent.length - 1].close;
    const candleReturnPct = firstOpen > 0 ? ((lastClose - firstOpen) / firstOpen) * 100 : 0;
    const redCount = recent.filter((c) => c.close < c.open).length;
    const greenCount = recent.length - redCount;
    const candleBalance = (greenCount - redCount) / recent.length;
    let slopeScore = Math.max(-1, Math.min(1, candleReturnPct * 1.4)) * 0.6 + candleBalance * 0.4;

    // Candlestick Pattern & Order-Flow Delta Confirmation (last 2 closed/active bars)
    const lastBar = recent[recent.length - 1];
    const prevBar = recent[recent.length - 2];
    const body = Math.abs(lastBar.close - lastBar.open);
    const prevBody = Math.abs(prevBar.close - prevBar.open);
    const upperWick = lastBar.high - Math.max(lastBar.open, lastBar.close);
    const lowerWick = Math.min(lastBar.open, lastBar.close) - lastBar.low;
    const safeBody = Math.max(body, lastBar.close * 0.0001);

    if (lastBar.close > lastBar.open && prevBar.close < prevBar.open && body > prevBody * 1.05 && lastBar.close >= prevBar.open) {
      slopeScore += 0.35;
      candleTrigger = 'Bullish Engulfing';
    } else if (lastBar.close < lastBar.open && prevBar.close > prevBar.open && body > prevBody * 1.05 && lastBar.close <= prevBar.open) {
      slopeScore -= 0.35;
      candleTrigger = 'Bearish Engulfing';
    } else if (lowerWick >= safeBody * 1.8 && lowerWick > upperWick * 1.5) {
      slopeScore += 0.3;
      candleTrigger = 'Bullish Rejection Pinbar';
    } else if (upperWick >= safeBody * 1.8 && upperWick > lowerWick * 1.5) {
      slopeScore -= 0.3;
      candleTrigger = 'Bearish Rejection Pinbar';
    }

    // Real Order-Flow Taker Volume Delta check when takerBuyVolume is available
    const deltaBars = recent.slice(-3).filter((c) => typeof c.volume === 'number' && c.volume > 0 && typeof c.takerBuyVolume === 'number');
    if (deltaBars.length > 0) {
      const totalV = deltaBars.reduce((acc, c) => acc + (c.volume || 0), 0);
      const buyV = deltaBars.reduce((acc, c) => acc + (c.takerBuyVolume || 0), 0);
      const buyRatio = totalV > 0 ? buyV / totalV : 0.5;
      if (buyRatio >= 0.56) {
        slopeScore += 0.25;
        candleTrigger = candleTrigger ? `${candleTrigger} + Buy Delta` : 'Buy Volume Delta Surge';
      } else if (buyRatio <= 0.44) {
        slopeScore -= 0.25;
        candleTrigger = candleTrigger ? `${candleTrigger} + Sell Delta` : 'Sell Volume Delta Surge';
      }
    }

    slopeScore = Math.max(-1, Math.min(1, slopeScore));
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
  }

  // Hard alignment guard: prevent noise from flipping strong TradingView rating
  if (typeof recAll === 'number' && Math.abs(recAll) >= 0.12) {
    const tvSign = recAll > 0 ? 1 : -1;
    const trendAgrees = avgTrend === 0 || avgTrend * tvSign >= 0;
    const paAgreesOrNeutral = avgPriceAction === 0 || avgPriceAction * tvSign >= -0.15;
    if ((paAgreesOrNeutral || (Math.abs(recAll) >= 0.15 && trendAgrees)) && composite * tvSign < 0) {
      composite = recAll * 0.75 + avgTrend * 0.25;
    }
  }

  composite = Math.max(-1, Math.min(1, composite));
  const direction: SignalDirection =
    composite === 0
      ? (typeof eff.changePercent === 'number' && eff.changePercent < 0 ? 'SELL' : 'BUY')
      : composite > 0
      ? 'BUY'
      : 'SELL';

  const dirSign = direction === 'BUY' ? 1 : -1;
  let confluenceCount = 0;
  if (avgTrend * dirSign > 0.08) confluenceCount++;
  if (avgOsc * dirSign > 0.05) confluenceCount++;
  if (typeof recAll === 'number' && recAll * dirSign >= 0.1) confluenceCount++;
  if (avgPriceAction * dirSign > 0.03) confluenceCount++;

  return { direction, composite, avgTrend, avgOsc, avgPriceAction, eff, confluenceCount, candleTrigger };
}

/**
 * Evaluates live TradingView timeframe indicators + Higher-Timeframe (HTF) confluence +
 * ADX anti-chop filter + Session timing so weak/conflicting markets return NEUTRAL / WAIT.
 */
export function evaluateDirectionalConfluence(
  quote: Partial<LiveTvQuote> | undefined,
  spotPrice: number,
  timeframe: string,
  fallbackDirection?: SignalDirection,
  candles?: SignalCandleInput[],
  symbolHint?: string,
  marketHint?: string,
  macroContext?: MacroCorrelationContext,
  newsHazard?: NewsHazardInput
): {
  direction: SignalDirection;
  action: SignalAction;
  confidenceScore: number;
  compositeScore: number;
  setupLabel: string;
  isTradeable: boolean;
  waitReason?: string;
  htfAligned: boolean;
  htfSummary: string;
  htfTimeframes: { tf: string; direction: SignalDirection; score: number }[];
  adxValue?: number;
  isChoppy: boolean;
  confluenceCount: number;
  signalGrade: SignalGrade;
  session: SessionTimingInfo;
  macroAligned: boolean;
  macroNote: string;
  newsBlocked: boolean;
  candleTrigger?: string;
} {
  const tf = getTimeframeProfile(timeframe);
  const single = evaluateSingleTimeframeScore(quote, spotPrice, timeframe, candles);
  const eff = single.eff;

  const inferredFallback: SignalDirection =
    fallbackDirection ||
    (typeof eff.changePercent === 'number' && eff.changePercent < 0 ? 'SELL' : 'BUY');

  let composite = single.composite;
  if (Math.abs(composite) < 0.03 && fallbackDirection) {
    composite = fallbackDirection === 'SELL' ? -0.22 : 0.22;
  }

  const direction: SignalDirection =
    Math.abs(composite) < 0.03 ? inferredFallback : composite > 0 ? 'BUY' : 'SELL';

  // Evaluate Higher-Timeframe (HTF) Trend Chain when multi-timeframe quote data exists
  const htfChain = getHigherTimeframeChain(timeframe);
  const hasMtfData = Boolean(quote?.timeframeSignals && Object.keys(quote.timeframeSignals).length > 1);
  const htfTimeframes: { tf: string; direction: SignalDirection; score: number }[] = [];

  if (hasMtfData && htfChain.length > 0) {
    for (const htf of htfChain) {
      const hRes = evaluateSingleTimeframeScore(quote, spotPrice, htf);
      htfTimeframes.push({
        tf: htf,
        direction: hRes.direction,
        score: Number(hRes.composite.toFixed(2)),
      });
    }
  }

  const htfOpposing = htfTimeframes.filter((h) => h.direction !== direction && Math.abs(h.score) >= 0.14);
  const htfAgreeing = htfTimeframes.filter((h) => h.direction === direction);
  const htfAligned = htfTimeframes.length === 0 ? true : htfOpposing.length === 0;
  const primaryHtfConflict =
    !fallbackDirection &&
    htfTimeframes.length > 0 &&
    (htfOpposing.length === htfTimeframes.length ||
      (htfTimeframes[0] && htfTimeframes[0].direction !== direction && Math.abs(htfTimeframes[0].score) >= 0.24));

  const htfSummary =
    htfTimeframes.length === 0
      ? `${tf.label} Macro Anchor`
      : htfAligned
      ? `${htfAgreeing.map((h) => h.tf).join('+')} Aligned (${direction})`
      : `Conflict vs ${htfOpposing.map((h) => `${h.tf} ${h.direction}`).join(', ')}`;

  // ADX Anti-Chop Filter (uses per-timeframe ADX if available, else daily ADX)
  const adxValue = typeof eff.adx === 'number' ? Number(eff.adx.toFixed(1)) : typeof quote?.adx === 'number' ? Number(quote.adx.toFixed(1)) : undefined;
  const isChoppy = typeof adxValue === 'number' && adxValue < 17.5 && Math.abs(composite) < 0.30;

  // Session Quality + DXY/US10Y Macro Correlation + Candle Trigger
  const resolvedSym = symbolHint || quote?.symbol || '';
  const session = evaluateTradingSession(resolvedSym, marketHint);
  const macroEval = evaluateMacroCorrelation(resolvedSym, direction, macroContext);
  const candleAligned = Boolean(
    single.candleTrigger &&
      ((direction === 'BUY' && (single.candleTrigger.includes('Bullish') || single.candleTrigger.includes('Buy'))) ||
        (direction === 'SELL' && (single.candleTrigger.includes('Bearish') || single.candleTrigger.includes('Sell'))))
  );

  // Compute Confluence Count (max 5)
  let confluenceCount = single.confluenceCount;
  if (htfAligned && (!adxValue || adxValue >= 18)) confluenceCount++;
  if (macroEval.scoreDelta > 0 || candleAligned) confluenceCount++;
  confluenceCount = Math.min(5, Math.max(1, confluenceCount));

  // Confidence Scoring
  const absStrength = Math.abs(composite);
  const adxBoost =
    typeof adxValue === 'number'
      ? adxValue >= 28
        ? 7
        : adxValue >= 21
        ? 3
        : adxValue < 17.5
        ? -8
        : -2
      : 1;
  const htfBoost = htfTimeframes.length === 0 ? 1 : htfAligned ? 4 : primaryHtfConflict ? -12 : -5;
  const newsPenalty = newsHazard?.severity === 'MEDIUM_CAUTION' ? -4 : 0;
  const candleBoost = candleAligned ? 3 : 0;

  const rawConf = 73 + absStrength * 20 + adxBoost + htfBoost + session.scoreDelta + macroEval.scoreDelta + newsPenalty + candleBoost;
  const confidenceScore = Math.round(Math.min(96, Math.max(54, rawConf)));

  // Determine whether setup is Tradeable or held in WAIT / NO TRADE / NEWS BLACKOUT
  const newsBlocked = Boolean(!fallbackDirection && newsHazard?.isHazardWindow && newsHazard.severity === 'HIGH_PAUSE');
  let isTradeable = true;
  let waitReason: string | undefined;

  if (!fallbackDirection) {
    if (newsBlocked) {
      isTradeable = false;
      const minsTxt = typeof newsHazard?.minutesToNext === 'number'
        ? newsHazard.minutesToNext <= 0 ? 'LIVE' : `in ${newsHazard.minutesToNext}m`
        : 'imminent';
      waitReason = `NEWS BLACKOUT: ${newsHazard?.currency || 'USD'} ${newsHazard?.title || 'High-Impact Release'} (${minsTxt}) — spread-spike lock active.`;
    } else if (primaryHtfConflict) {
      isTradeable = false;
      waitReason = `HTF Conflict: ${tf.label} ${direction} fights ${htfOpposing.map((h) => `${h.tf} ${h.direction}`).join(' & ')} — wait for alignment.`;
    } else if (isChoppy) {
      isTradeable = false;
      waitReason = `Low ADX Chop (${adxValue} < 17.5) on ${tf.label} — range noise detected, wait for breakout.`;
    } else if (!htfAligned && typeof adxValue === 'number' && adxValue < 18.5) {
      isTradeable = false;
      waitReason = `HTF Conflict + Weak Trend (ADX ${adxValue}) on ${tf.label} — wait for higher-timeframe alignment.`;
    } else if (confidenceScore < 68) {
      isTradeable = false;
      waitReason = `Low Conviction (${confidenceScore}%) on ${tf.label} — wait for stronger indicator confluence.`;
    } else if (absStrength < 0.08 && typeof quote?.recommendAll === 'number' && Math.abs(quote.recommendAll) < 0.08) {
      isTradeable = false;
      waitReason = `Neutral Momentum (${tf.label}) — no clear directional edge yet.`;
    }
  }

  let action: SignalAction = direction;
  if (!isTradeable) {
    action = 'NEUTRAL';
  } else if (absStrength >= 0.32 && confidenceScore >= 84 && htfAligned) {
    action = direction === 'BUY' ? 'STRONG BUY' : 'STRONG SELL';
  }

  const signalGrade: SignalGrade = !isTradeable
    ? 'WAIT'
    : confidenceScore >= 88 && htfAligned && confluenceCount >= 4
    ? 'A+'
    : confidenceScore >= 78 && htfAligned
    ? 'A'
    : 'B';

  let setupLabel = '';
  if (!isTradeable) {
    setupLabel = newsBlocked
      ? `${tf.label} News Blackout Lock (${newsHazard?.currency || 'Macro'} Event)`
      : `${tf.label} Wait / No-Trade Zone (${primaryHtfConflict ? 'HTF Conflict' : 'Range Chop Filter'})`;
  } else if (tf.category === 'Ultra-Scalp' || tf.category === 'Scalp') {
    setupLabel =
      direction === 'BUY'
        ? `${tf.label} HTF-Aligned Liquidity Sweep & Bullish FVG`
        : `${tf.label} HTF-Aligned BSL Sweep & Bearish Displacement`;
  } else if (tf.category === 'Intraday') {
    setupLabel =
      direction === 'BUY'
        ? `${tf.label} Session Order Block & 20 EMA Continuation`
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
    isTradeable,
    waitReason,
    htfAligned,
    htfSummary,
    htfTimeframes,
    adxValue,
    isChoppy,
    confluenceCount,
    signalGrade,
    session,
    macroAligned: macroEval.aligned,
    macroNote: macroEval.note,
    newsBlocked,
    candleTrigger: single.candleTrigger,
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
  isTradeable: boolean;
  waitReason?: string;
  signalGrade: SignalGrade;
  confluenceCount: number;
  htfAligned: boolean;
  htfSummary: string;
  executionMode: ExecutionMode;
  entryNote: string;
  entryPrice: number;
  entryZone: string;
  sl: number;
  tp1: number;
  tp2: number;
  breakEvenTrigger: number;
  breakEvenNote: string;
  tp1Note: string;
  tp2Note: string;
  slNote: string;
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
  sessionName: string;
  sessionQuality: 'PRIME' | 'ACTIVE' | 'OFF_PEAK';
  sessionNote: string;
  macroAligned: boolean;
  macroNote: string;
  newsBlocked: boolean;
  candleTrigger?: string;
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
 * Computes institutional SL, Pullback/Market Entry, Auto-Breakeven Trigger,
 * High-Probability TP1, and Pivot/BB-Snapped TP2 strictly capped <= 1:5.0 R:R.
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
  macroContext?: MacroCorrelationContext;
  newsHazard?: NewsHazardInput;
}): ComputedSignalLevels {
  const { symbol, spotPrice, timeframe, quote, candles, market, preferredDirection, customSlDistance, customTargetRR, macroContext, newsHazard } = params;
  const s = symbol.toUpperCase();
  const tf = getTimeframeProfile(timeframe);
  const decimals = getSymbolPrecision(s, spotPrice, market);

  const evalRes = evaluateDirectionalConfluence(quote, spotPrice, timeframe, preferredDirection, candles, s, market, macroContext, newsHazard);
  const eff = resolveQuoteForTimeframe(quote, timeframe);
  const direction = preferredDirection || evalRes.direction;
  const action: SignalAction = preferredDirection
    ? evalRes.confidenceScore >= 84
      ? preferredDirection === 'BUY'
        ? 'STRONG BUY'
        : 'STRONG SELL'
      : preferredDirection
    : evalRes.action;

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
    const rawDailyAtr = quote?.atr && quote.atr > 0 ? quote.atr : 72.0;
    base1HStop = Math.max(9.5, Math.min(18.5, rawDailyAtr * 0.17));
    unitLabel = 'pts';
    pipFactor = 1;
  } else if (isSilver) {
    const rawDailyAtr = quote?.atr && quote.atr > 0 ? quote.atr : 1.65;
    base1HStop = Math.max(0.24, Math.min(0.85, rawDailyAtr * 0.32));
    unitLabel = 'pts';
    pipFactor = 1;
  } else if (isEquity) {
    base1HStop = spotPrice * 0.013;
    unitLabel = '%';
    pipFactor = 100 / Math.max(spotPrice, 0.01);
  } else if (isCrypto) {
    const rawDailyAtr = quote?.atr && quote.atr > 0 ? quote.atr : spotPrice * 0.042;
    base1HStop = Math.max(spotPrice * 0.0045, Math.min(spotPrice * 0.015, rawDailyAtr * 0.24));
    unitLabel = 'pts';
    pipFactor = 1;
  } else if (isSynthetic) {
    base1HStop = s.includes('BOOM') || s.includes('CRASH') ? spotPrice * 0.0028 : spotPrice * 0.0065;
    unitLabel = 'pts';
    pipFactor = 1;
  } else if (isIndex) {
    const rawDailyAtr = quote?.atr && quote.atr > 0 ? quote.atr : spotPrice * 0.018;
    base1HStop = Math.max(spotPrice * 0.0016, Math.min(spotPrice * 0.0055, rawDailyAtr * 0.24));
    unitLabel = s === 'DXY' ? 'pips' : 'pts';
    pipFactor = s === 'DXY' ? 100 : 1;
  } else if (isJpy) {
    const rawDailyAtr = quote?.atr && quote.atr > 0 ? quote.atr : 1.05;
    base1HStop = Math.max(0.20, Math.min(0.60, rawDailyAtr * 0.40));
    unitLabel = 'pips';
    pipFactor = 100;
  } else if (isKes) {
    const rawDailyAtr = quote?.atr && quote.atr > 0 ? quote.atr : 0.35;
    base1HStop = Math.max(0.18, Math.min(0.45, rawDailyAtr * 0.55));
    unitLabel = 'pips';
    pipFactor = 100;
  } else if (s.includes('ZAR') || s.includes('MXN') || s.includes('TRY')) {
    base1HStop = spotPrice * 0.0048;
    unitLabel = 'pips';
    pipFactor = 10000;
  } else if (s.includes('UGX') || s.includes('TZS')) {
    base1HStop = spotPrice * 0.004;
    unitLabel = 'pts';
    pipFactor = 1;
  } else {
    const rawDailyAtr = quote?.atr && quote.atr > 0 ? quote.atr : 0.0072;
    base1HStop = Math.max(0.0016, Math.min(0.0038, rawDailyAtr * 0.38));
    unitLabel = 'pips';
    pipFactor = 10000;
  }

  // Blend per-timeframe live ATR (when present) with scaled baseline so SL adapts to live volatility without shrinking below spread noise
  const scaledBaselineSl = base1HStop * tf.volatilityScale;
  const hasPerTfAtr = typeof eff.atr === 'number' && eff.atr > 0 && eff.atr !== quote?.atr;
  const perTfAtrStop = hasPerTfAtr ? eff.atr! * 1.45 : scaledBaselineSl;
  const blendedBaseSl = hasPerTfAtr
    ? Math.max(scaledBaselineSl * 0.65, Math.min(scaledBaselineSl * 1.35, perTfAtrStop * 0.55 + scaledBaselineSl * 0.45))
    : scaledBaselineSl;

  const minStopTick = Math.max(spotPrice * 0.0005, Math.pow(10, -decimals) * 8);
  let slDistanceRaw = customSlDistance && customSlDistance > 0
    ? customSlDistance
    : Math.max(minStopTick, blendedBaseSl);

  // Upgrade #2: Pullback Entry Guard — avoid chasing overextended RSI / Bollinger Band / EMA20 extensions
  let executionMode: ExecutionMode = !evalRes.isTradeable ? 'WAIT_FOR_CONFIRMATION' : 'MARKET_NOW';
  let effectiveEntry = spotPrice;
  let entryNote = evalRes.isTradeable
    ? `Market execution at live spot (${spotPrice.toFixed(decimals)})`
    : evalRes.waitReason || 'Stand by for alignment';

  if (evalRes.isTradeable && !preferredDirection) {
    const emaAnchor = typeof eff.ema20 === 'number' && eff.ema20 > 0 ? eff.ema20 : undefined;
    const isBuyOverextended =
      direction === 'BUY' &&
      ((typeof eff.rsi === 'number' && eff.rsi >= 69) ||
        (typeof eff.bbUpper === 'number' && spotPrice >= eff.bbUpper * 0.9992) ||
        (emaAnchor !== undefined && spotPrice - emaAnchor > slDistanceRaw * 1.15));

    const isSellOverextended =
      direction === 'SELL' &&
      ((typeof eff.rsi === 'number' && eff.rsi <= 31) ||
        (typeof eff.bbLower === 'number' && spotPrice <= eff.bbLower * 1.0008) ||
        (emaAnchor !== undefined && emaAnchor - spotPrice > slDistanceRaw * 1.15));

    if (isBuyOverextended) {
      const targetAnchor = emaAnchor && emaAnchor < spotPrice ? emaAnchor : spotPrice - slDistanceRaw * 0.45;
      const pullbackDist = Math.min(slDistanceRaw * 0.60, (spotPrice - targetAnchor) * 0.55);
      if (pullbackDist > minStopTick * 0.35) {
        effectiveEntry = spotPrice - pullbackDist;
        executionMode = 'PULLBACK_LIMIT';
        entryNote = `Extended RSI/BB — Buy Limit pullback toward 20 EMA (${effectiveEntry.toFixed(decimals)})`;
      }
    } else if (isSellOverextended) {
      const targetAnchor = emaAnchor && emaAnchor > spotPrice ? emaAnchor : spotPrice + slDistanceRaw * 0.45;
      const pullbackDist = Math.min(slDistanceRaw * 0.60, (targetAnchor - spotPrice) * 0.55);
      if (pullbackDist > minStopTick * 0.35) {
        effectiveEntry = spotPrice + pullbackDist;
        executionMode = 'PULLBACK_LIMIT';
        entryNote = `Oversold RSI/BB — Sell Limit retest toward 20 EMA (${effectiveEntry.toFixed(decimals)})`;
      }
    }
  }

  // Upgrade #5a: Structural Stop Loss Buffer behind EMA20/EMA50 when protective
  let slNote = `${tf.label} ATR Structural Invalidation`;
  if (!customSlDistance) {
    const emaPad = (hasPerTfAtr ? eff.atr! : slDistanceRaw * 0.65) * 0.28;
    const candidateEmas = [eff.ema20, eff.ema50].filter((v): v is number => typeof v === 'number' && v > 0);
    for (const emaVal of candidateEmas) {
      if (direction === 'BUY' && emaVal < effectiveEntry) {
        const distBehindEma = (effectiveEntry - emaVal) + emaPad;
        if (distBehindEma >= slDistanceRaw * 0.78 && distBehindEma <= slDistanceRaw * 1.32) {
          slDistanceRaw = distBehindEma;
          slNote = `Protected below ${emaVal === eff.ema50 ? '50' : '20'} EMA + ATR buffer`;
          break;
        }
      } else if (direction === 'SELL' && emaVal > effectiveEntry) {
        const distBehindEma = (emaVal - effectiveEntry) + emaPad;
        if (distBehindEma >= slDistanceRaw * 0.78 && distBehindEma <= slDistanceRaw * 1.32) {
          slDistanceRaw = distBehindEma;
          slNote = `Protected above ${emaVal === eff.ema50 ? '50' : '20'} EMA + ATR buffer`;
          break;
        }
      }
    }
  }

  // Upgrade #3: High-Probability TP1 (1:1.15 - 1:1.40) + Auto-Breakeven + Realistic ATR TP2
  const adxAdj = typeof evalRes.adxValue === 'number' ? (evalRes.adxValue >= 26 ? 0.25 : evalRes.adxValue < 19 ? -0.20 : 0) : 0;
  const confAdj = (evalRes.confidenceScore - 82) * 0.02;
  const rawTp2RR = customTargetRR ? customTargetRR : tf.baseTp2RR + adxAdj + confAdj;
  const clampedTp2RR = clampRiskRewardRatio(rawTp2RR, 1.4);
  const clampedTp1RR = clampRiskRewardRatio(Math.min(tf.baseTp1RR, clampedTp2RR * 0.62), 1.1);

  const slDistance = Number(slDistanceRaw.toFixed(decimals));
  let tp1Distance = Number((slDistance * clampedTp1RR).toFixed(decimals));
  let tp2Distance = Number((slDistance * clampedTp2RR).toFixed(decimals));
  let tp1Note = `High-probability bank target + move SL to Breakeven`;
  let tp2Note = `ATR trend extension (capped <= 1:${MAX_RISK_REWARD.toFixed(1)})`;

  // Upgrade #5b: Pivot & Bollinger Band Liquidity Snapping (front-run S/R by 4% so TP actually fills)
  const structuralTargets = [
    quote?.pivotMiddle,
    quote?.pivotR1,
    quote?.pivotS1,
    quote?.pivotR2,
    quote?.pivotS2,
    eff.bbUpper,
    eff.bbLower,
    quote?.high,
    quote?.low,
  ].filter((v): v is number => typeof v === 'number' && v > 0);

  const inDirectionDistances = structuralTargets
    .map((lvl) => (direction === 'BUY' ? lvl - effectiveEntry : effectiveEntry - lvl))
    .filter((d) => d > slDistance * 0.95)
    .sort((a, b) => a - b);

  const tp1Snap = inDirectionDistances.find((d) => d >= tp1Distance * 0.88 && d <= tp1Distance * 1.16);
  if (tp1Snap) {
    tp1Distance = Number((tp1Snap * 0.96).toFixed(decimals));
    tp1Note = `Front-runs Pivot/BB liquidity obstacle for higher TP1 fill`;
  }

  const tp2Snap = inDirectionDistances.find(
    (d) => d > tp1Distance * 1.25 && d >= tp2Distance * 0.85 && d <= Math.min(tp2Distance * 1.15, slDistance * MAX_RISK_REWARD)
  );
  if (tp2Snap) {
    tp2Distance = Number((tp2Snap * 0.96).toFixed(decimals));
    tp2Note = `Snapped inside Pivot/BB structural target (high fill zone)`;
  }

  // Strictly enforce TP2 <= MAX_RISK_REWARD * slDistance and TP2 > TP1
  if (slDistance > 0 && tp2Distance > slDistance * MAX_RISK_REWARD) {
    tp2Distance = Number((slDistance * MAX_RISK_REWARD).toFixed(decimals));
  }
  if (tp2Distance <= tp1Distance * 1.15) {
    tp2Distance = Number(Math.min(slDistance * MAX_RISK_REWARD, tp1Distance * 1.55).toFixed(decimals));
  }

  const entryRounded = Number(effectiveEntry.toFixed(decimals));
  const sl = Number((direction === 'BUY' ? entryRounded - slDistance : entryRounded + slDistance).toFixed(decimals));
  const tp1 = Number((direction === 'BUY' ? entryRounded + tp1Distance : entryRounded - tp1Distance).toFixed(decimals));
  const tp2 = Number((direction === 'BUY' ? entryRounded + tp2Distance : entryRounded - tp2Distance).toFixed(decimals));

  // Auto-Breakeven Trigger at +85% of SL distance (or TP1)
  const beDistance = Number((slDistance * 0.9).toFixed(decimals));
  const breakEvenTrigger = Number((direction === 'BUY' ? entryRounded + beDistance : entryRounded - beDistance).toFixed(decimals));
  const breakEvenNote = `Shift SL to ${entryRounded.toFixed(decimals)} (Entry) once price hits ${breakEvenTrigger.toFixed(decimals)} / TP1`;

  const actualRR = slDistance > 0 ? clampRiskRewardRatio(tp2Distance / slDistance, 1.1) : clampedTp2RR;
  const actualTp1RR = slDistance > 0 ? clampRiskRewardRatio(tp1Distance / slDistance, 1.0) : clampedTp1RR;

  const entrySpan = Number((slDistance * 0.18).toFixed(decimals));
  const entryLow = (entryRounded - entrySpan * 0.45).toFixed(decimals);
  const entryHigh = (entryRounded + entrySpan * 0.55).toFixed(decimals);

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
    isTradeable: evalRes.isTradeable,
    waitReason: evalRes.waitReason,
    signalGrade: evalRes.signalGrade,
    confluenceCount: evalRes.confluenceCount,
    htfAligned: evalRes.htfAligned,
    htfSummary: evalRes.htfSummary,
    executionMode,
    entryNote,
    entryPrice: entryRounded,
    entryZone: `${entryLow} - ${entryHigh}`,
    sl,
    tp1,
    tp2,
    breakEvenTrigger,
    breakEvenNote,
    tp1Note,
    tp2Note,
    slNote,
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
    sessionName: evalRes.session.sessionName,
    sessionQuality: evalRes.session.quality,
    sessionNote: evalRes.session.note,
    macroAligned: evalRes.macroAligned,
    macroNote: evalRes.macroNote,
    newsBlocked: evalRes.newsBlocked,
    candleTrigger: evalRes.candleTrigger,
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
  return '1:2.3';
}

export interface SignalBacktestTrade {
  barIndex: number;
  direction: SignalDirection;
  entry: number;
  sl: number;
  tp1: number;
  tp2: number;
  outcome: 'TP2_FULL' | 'TP1_BE' | 'SL_LOSS';
  rMultiple: number;
  timeLabel?: string;
}

export interface SignalBacktestReport {
  symbol: string;
  timeframe: string;
  barsEvaluated: number;
  totalTrades: number;
  tp1Hits: number;
  tp2Hits: number;
  beSaves: number;
  fullLosses: number;
  tp1HitRate: number;
  tp2HitRate: number;
  profitFactor: number;
  netR: number;
  maxDrawdownR: number;
  recentTrades: SignalBacktestTrade[];
}

/**
 * Replays our upgraded Signal Engine strategy (EMA20/50 trend + RSI + ADX Anti-Chop +
 * Candle Confirmation + High-Probability TP1 partial close + Auto-Breakeven SL + TP2 runner)
 * across historical OHLCV bars.
 */
export function runSignalEngineBacktest(
  symbol: string,
  timeframe: string,
  candles: SignalCandleInput[]
): SignalBacktestReport {
  const tf = getTimeframeProfile(timeframe);
  const closes = candles.map((c) => c.close);

  // Precompute EMA20 & EMA50
  const ema20: number[] = [];
  const ema50: number[] = [];
  const k20 = 2 / 21;
  const k50 = 2 / 51;
  for (let i = 0; i < closes.length; i++) {
    ema20.push(i === 0 ? closes[0] : closes[i] * k20 + ema20[i - 1] * (1 - k20));
    ema50.push(i === 0 ? closes[0] : closes[i] * k50 + ema50[i - 1] * (1 - k50));
  }

  // Precompute RSI(14)
  const rsi: number[] = new Array(closes.length).fill(50);
  if (closes.length > 15) {
    let g = 0;
    let l = 0;
    for (let i = 1; i <= 14; i++) {
      const d = closes[i] - closes[i - 1];
      if (d >= 0) g += d;
      else l += Math.abs(d);
    }
    let ag = g / 14;
    let al = l / 14;
    rsi[14] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
    for (let i = 15; i < closes.length; i++) {
      const d = closes[i] - closes[i - 1];
      ag = (ag * 13 + (d > 0 ? d : 0)) / 14;
      al = (al * 13 + (d < 0 ? Math.abs(d) : 0)) / 14;
      rsi[i] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
    }
  }

  const trades: SignalBacktestTrade[] = [];
  let tp1Hits = 0;
  let tp2Hits = 0;
  let beSaves = 0;
  let fullLosses = 0;
  let grossGainR = 0;
  let grossLossR = 0;
  let equityR = 0;
  let peakR = 0;
  let maxDrawdownR = 0;

  let i = Math.min(25, Math.max(5, Math.floor(closes.length * 0.15)));
  while (i < candles.length - 3) {
    const cur = candles[i];
    const prev = candles[i - 1];
    let atrSum = 0;
    let atrCnt = 0;
    for (let k = Math.max(1, i - 13); k <= i; k++) {
      atrSum += Math.max(
        candles[k].high - candles[k].low,
        Math.abs(candles[k].high - candles[k - 1].close),
        Math.abs(candles[k].low - candles[k - 1].close)
      );
      atrCnt++;
    }
    const atr = Math.max(cur.close * 0.0005, atrSum / Math.max(1, atrCnt));

    // Directional Efficiency Ratio / ADX proxy over last 14 bars to skip dead chop
    const lookStart = Math.max(0, i - 14);
    const netMove = Math.abs(cur.close - candles[lookStart].close);
    let pathMove = 0;
    for (let k = lookStart + 1; k <= i; k++) {
      pathMove += Math.abs(candles[k].close - candles[k - 1].close);
    }
    const efficiency = pathMove > 0 ? netMove / pathMove : 0;

    const e20 = ema20[i];
    const e50 = ema50[i];
    const r = rsi[i];
    const isBullCandle = cur.close > cur.open && (cur.close >= prev.open || (Math.min(cur.open, cur.close) - cur.low) > Math.abs(cur.close - cur.open) * 1.4);
    const isBearCandle = cur.close < cur.open && (cur.close <= prev.open || (cur.high - Math.max(cur.open, cur.close)) > Math.abs(cur.close - cur.open) * 1.4);

    let dir: SignalDirection | null = null;
    if (efficiency >= 0.16) {
      if (e20 >= e50 && cur.close >= e20 && r >= 51 && r <= 72 && isBullCandle) {
        dir = 'BUY';
      } else if (e20 <= e50 && cur.close <= e20 && r <= 49 && r >= 28 && isBearCandle) {
        dir = 'SELL';
      }
    }

    if (!dir) {
      i++;
      continue;
    }

    const entry = cur.close;
    const slDist = Math.max(atr * 1.4, cur.close * 0.0008);
    const tp1Dist = slDist * tf.baseTp1RR;
    const tp2Dist = slDist * tf.baseTp2RR;

    const sl = dir === 'BUY' ? entry - slDist : entry + slDist;
    const tp1 = dir === 'BUY' ? entry + tp1Dist : entry - tp1Dist;
    const tp2 = dir === 'BUY' ? entry + tp2Dist : entry - tp2Dist;

    let hitTp1 = false;
    let activeSl = sl;
    let outcome: SignalBacktestTrade['outcome'] = 'TP1_BE';
    let rMult = 0;
    let exitBar = i + 1;

    for (let j = i + 1; j < Math.min(candles.length, i + 45); j++) {
      const bar = candles[j];
      exitBar = j;
      if (dir === 'BUY') {
        if (!hitTp1 && bar.low <= activeSl) {
          outcome = 'SL_LOSS';
          rMult = -1.0;
          break;
        }
        if (!hitTp1 && bar.high >= tp1) {
          hitTp1 = true;
          activeSl = entry; // Auto-Breakeven!
        }
        if (hitTp1 && bar.high >= tp2) {
          outcome = 'TP2_FULL';
          rMult = Number((0.6 * tf.baseTp1RR + 0.4 * tf.baseTp2RR).toFixed(2));
          break;
        }
        if (hitTp1 && bar.low <= activeSl) {
          outcome = 'TP1_BE';
          rMult = Number((0.6 * tf.baseTp1RR).toFixed(2));
          break;
        }
      } else {
        if (!hitTp1 && bar.high >= activeSl) {
          outcome = 'SL_LOSS';
          rMult = -1.0;
          break;
        }
        if (!hitTp1 && bar.low <= tp1) {
          hitTp1 = true;
          activeSl = entry;
        }
        if (hitTp1 && bar.low <= tp2) {
          outcome = 'TP2_FULL';
          rMult = Number((0.6 * tf.baseTp1RR + 0.4 * tf.baseTp2RR).toFixed(2));
          break;
        }
        if (hitTp1 && bar.high >= activeSl) {
          outcome = 'TP1_BE';
          rMult = Number((0.6 * tf.baseTp1RR).toFixed(2));
          break;
        }
      }
      if (j === Math.min(candles.length - 1, i + 44)) {
        rMult = hitTp1
          ? Number((0.6 * tf.baseTp1RR).toFixed(2))
          : Number((((dir === 'BUY' ? bar.close - entry : entry - bar.close) / slDist)).toFixed(2));
        outcome = hitTp1 ? 'TP1_BE' : rMult >= 0 ? 'TP1_BE' : 'SL_LOSS';
      }
    }

    if (outcome === 'TP2_FULL') {
      tp1Hits++;
      tp2Hits++;
    } else if (outcome === 'TP1_BE') {
      tp1Hits++;
      if (rMult >= 0) beSaves++;
      else fullLosses++;
    } else {
      fullLosses++;
    }

    if (rMult >= 0) grossGainR += rMult;
    else grossLossR += Math.abs(rMult);

    equityR += rMult;
    if (equityR > peakR) peakR = equityR;
    const dd = peakR - equityR;
    if (dd > maxDrawdownR) maxDrawdownR = dd;

    trades.push({
      barIndex: i,
      direction: dir,
      entry,
      sl,
      tp1,
      tp2,
      outcome,
      rMultiple: rMult,
      timeLabel: cur.timeLabel,
    });

    i = exitBar + 1;
  }

  const totalTrades = trades.length;
  return {
    symbol,
    timeframe: tf.label,
    barsEvaluated: candles.length,
    totalTrades,
    tp1Hits,
    tp2Hits,
    beSaves,
    fullLosses,
    tp1HitRate: totalTrades > 0 ? Math.round((tp1Hits / totalTrades) * 100) : 0,
    tp2HitRate: totalTrades > 0 ? Math.round((tp2Hits / totalTrades) * 100) : 0,
    profitFactor: grossLossR > 0 ? Number((grossGainR / grossLossR).toFixed(2)) : grossGainR > 0 ? 3.5 : 1.0,
    netR: Number(equityR.toFixed(1)),
    maxDrawdownR: Number(maxDrawdownR.toFixed(1)),
    recentTrades: trades.slice(-8).reverse(),
  };
}
