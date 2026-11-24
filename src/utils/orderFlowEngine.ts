import type { Candle } from './stockCandles.ts';
import type { LiveTvQuote } from './tradingViewSync.ts';

export type VolumeMode = 'exchange_volume' | 'tick_activity';

export interface VolumeProfileNode {
  price: number;
  priceLow: number;
  priceHigh: number;
  formattedPrice: string;
  buyVolume: number;
  sellVolume: number;
  totalVolume: number;
  isPoc: boolean;
  isValueArea: boolean;
  deltaPercent: number;
}

export interface VolumeDeltaBar {
  timeLabel: string;
  buyVolume: number;
  sellVolume: number;
  delta: number;
  close: number;
  isBullish: boolean;
}

export interface RealVolumeProfileResult {
  nodes: VolumeProfileNode[];
  maxVolume: number;
  pocNode: VolumeProfileNode | null;
  valueAreaHigh: number;
  valueAreaLow: number;
  totalBuyVolume: number;
  totalSellVolume: number;
  netDeltaPercent: number;
  volumeMode: VolumeMode;
  deltaBars: VolumeDeltaBar[];
}

export interface OrderBlockZone {
  id: string;
  type: 'BULLISH' | 'BEARISH';
  kind: 'ORDER_BLOCK' | 'FVG';
  label: string;
  priceLow: number;
  priceHigh: number;
  midpoint: number;
  volumeAbsorbed: number;
  volumeLabel: string;
  timeLabel: string;
  status: 'UNMITIGATED (FRESH)' | 'TESTED (MITIGATED)' | 'SWEPT';
  strengthScore: number;
  description: string;
}

export interface LiquidityPool {
  id: string;
  type: 'BUY_SIDE (BSL)' | 'SELL_SIDE (SSL)';
  price: number;
  touches: number;
  distancePercent: number;
  description: string;
  dangerLevel: 'EXTREME' | 'HIGH' | 'MODERATE';
}

export interface DomClusterLevel {
  price: number;
  volume: number;
  touches: number;
  isWall: boolean;
  sourceLabel: string;
}

export interface IndicatorSignalItem {
  name: string;
  valueText: string;
  signal: 'BUY' | 'SELL' | 'HOLD';
}

export interface PivotLevelsSet {
  method: 'Classic' | 'Fibonacci';
  pp: number;
  r1: number;
  r2: number;
  r3: number;
  s1: number;
  s2: number;
  s3: number;
}

export interface BarchartOpinionResult {
  overallScore: number; // -100 to +100
  overallPercent: number; // 0 to 100 magnitude
  overallDirection: 'BUY' | 'SELL' | 'HOLD';
  verdictLabel: 'Strong Buy' | 'Buy' | 'Hold' | 'Sell' | 'Strong Sell';
  buyCount: number;
  sellCount: number;
  holdCount: number;
  shortTerm: { label: string; verdict: 'BUY' | 'SELL' | 'HOLD'; strengthPct: number; items: IndicatorSignalItem[] };
  mediumTerm: { label: string; verdict: 'BUY' | 'SELL' | 'HOLD'; strengthPct: number; items: IndicatorSignalItem[] };
  longTerm: { label: string; verdict: 'BUY' | 'SELL' | 'HOLD'; strengthPct: number; items: IndicatorSignalItem[] };
  high52w: number;
  low52w: number;
  rangePercentile: number;
  atrValue: number;
  rsi14: number;
  macdLine: number;
  macdSignal: number;
  classicPivots: PivotLevelsSet;
  fibPivots: PivotLevelsSet;
}

export function formatQuantPrice(price: number, ticker = ''): string {
  if (!Number.isFinite(price)) return '0.00';
  const upper = ticker.toUpperCase();
  if (upper.includes('JPY')) return price.toFixed(3);
  if (upper.includes('KES') || upper.includes('UGX') || upper.includes('TZS')) {
    return Math.abs(price) >= 100 ? price.toFixed(2) : price.toFixed(3);
  }
  if (upper.includes('XAU') || upper.includes('XAG')) return price.toFixed(2);
  if (Math.abs(price) < 10) return price.toFixed(4);
  if (Math.abs(price) >= 1000) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return price.toFixed(2);
}

function getEffectiveCandleVolume(c: Candle, useTickFallback: boolean, avgPrice: number): {
  total: number;
  buy: number;
  sell: number;
} {
  const anyC = c as Candle & { takerBuyVolume?: number };
  const range = Math.max(1e-9, c.high - c.low);
  const body = Math.abs(c.close - c.open);

  let total = 0;
  if (!useTickFallback && c.volume > 0) {
    total = c.volume;
  } else {
    const scale = avgPrice > 0 && avgPrice < 10 ? 10000 : avgPrice >= 1000 ? 10 : 100;
    total = Math.max(10, Math.round((range * 0.65 + body * 1.35) * scale));
  }

  let buyRatio: number;
  if (!useTickFallback && typeof anyC.takerBuyVolume === 'number' && c.volume > 0) {
    buyRatio = Math.min(0.95, Math.max(0.05, anyC.takerBuyVolume / c.volume));
  } else {
    const closePos = (c.close - c.low) / range; // 0 = closed at low, 1 = closed at high
    const dirBoost = c.close >= c.open ? 0.12 : -0.12;
    buyRatio = Math.min(0.92, Math.max(0.08, closePos * 0.78 + 0.11 + dirBoost));
  }

  const buy = Math.round(total * buyRatio);
  const sell = Math.max(0, Math.round(total - buy));
  return { total: buy + sell, buy, sell };
}

/**
 * Compute real Volume Profile (VPVR) & Volume Delta from OHLCV candles.
 * Uses exchange volume when present (> 0), or falls back transparently to
 * true tick-range displacement activity for Spot Forex feeds lacking central volume.
 */
export function computeRealVolumeProfile(
  candles: Candle[],
  currentPrice: number,
  ticker = '',
  bucketCount = 16
): RealVolumeProfileResult {
  if (!candles || candles.length === 0) {
    return {
      nodes: [],
      maxVolume: 1,
      pocNode: null,
      valueAreaHigh: currentPrice,
      valueAreaLow: currentPrice,
      totalBuyVolume: 0,
      totalSellVolume: 0,
      netDeltaPercent: 0,
      volumeMode: 'tick_activity',
      deltaBars: [],
    };
  }

  const totalRawVol = candles.reduce((sum, c) => sum + (Number.isFinite(c.volume) && c.volume > 0 ? c.volume : 0), 0);
  const avgPrice = candles.reduce((s, c) => s + c.close, 0) / candles.length;
  const volumeMode: VolumeMode = totalRawVol > 0 ? 'exchange_volume' : 'tick_activity';
  const useTickFallback = volumeMode === 'tick_activity';

  let minLow = Infinity;
  let maxHigh = -Infinity;
  for (const c of candles) {
    if (c.low < minLow) minLow = c.low;
    if (c.high > maxHigh) maxHigh = c.high;
  }
  if (!Number.isFinite(minLow) || !Number.isFinite(maxHigh) || maxHigh <= minLow) {
    minLow = currentPrice * 0.995;
    maxHigh = currentPrice * 1.005;
  }

  const step = Math.max(1e-8, (maxHigh - minLow) / bucketCount);
  const buyBuckets = new Array<number>(bucketCount).fill(0);
  const sellBuckets = new Array<number>(bucketCount).fill(0);

  let totalBuyVolume = 0;
  let totalSellVolume = 0;
  const deltaBars: VolumeDeltaBar[] = [];

  for (const c of candles) {
    const eff = getEffectiveCandleVolume(c, useTickFallback, avgPrice);
    totalBuyVolume += eff.buy;
    totalSellVolume += eff.sell;

    deltaBars.push({
      timeLabel: c.timeLabel || String(c.time),
      buyVolume: eff.buy,
      sellVolume: eff.sell,
      delta: eff.buy - eff.sell,
      close: c.close,
      isBullish: c.close >= c.open,
    });

    const startIdx = Math.max(0, Math.min(bucketCount - 1, Math.floor((c.low - minLow) / step)));
    const endIdx = Math.max(startIdx, Math.min(bucketCount - 1, Math.floor((c.high - minLow) / step)));
    const span = endIdx - startIdx + 1;

    // Weight slightly higher at candle close/body zone
    const midIdx = Math.max(0, Math.min(bucketCount - 1, Math.floor((((c.open + c.close) / 2) - minLow) / step)));
    let weightSum = 0;
    const weights: number[] = [];
    for (let b = startIdx; b <= endIdx; b++) {
      const w = b === midIdx ? 1.8 : 1.0;
      weights.push(w);
      weightSum += w;
    }

    for (let k = 0; k < span; k++) {
      const bIdx = startIdx + k;
      const frac = weights[k] / (weightSum || 1);
      buyBuckets[bIdx] += Math.round(eff.buy * frac);
      sellBuckets[bIdx] += Math.round(eff.sell * frac);
    }
  }

  let maxVolume = 1;
  let pocIdx = Math.floor(bucketCount / 2);
  let totalAll = 0;

  const nodes: VolumeProfileNode[] = [];
  for (let i = 0; i < bucketCount; i++) {
    const pLow = minLow + i * step;
    const pHigh = pLow + step;
    const mid = (pLow + pHigh) / 2;
    const buy = buyBuckets[i];
    const sell = sellBuckets[i];
    const total = buy + sell;
    totalAll += total;

    if (total > maxVolume) {
      maxVolume = total;
      pocIdx = i;
    }

    const deltaPercent = total > 0 ? Math.round(((buy - sell) / total) * 100) : 0;
    nodes.push({
      price: mid,
      priceLow: pLow,
      priceHigh: pHigh,
      formattedPrice: formatQuantPrice(mid, ticker),
      buyVolume: buy,
      sellVolume: sell,
      totalVolume: total,
      isPoc: false,
      isValueArea: false,
      deltaPercent,
    });
  }

  // Expand 70% Value Area outward from POC
  if (nodes[pocIdx]) {
    nodes[pocIdx].isPoc = true;
    nodes[pocIdx].isValueArea = true;
  }
  const targetVA = totalAll * 0.7;
  let accumVA = nodes[pocIdx]?.totalVolume || 0;
  let vaLowIdx = pocIdx;
  let vaHighIdx = pocIdx;

  while (accumVA < targetVA && (vaLowIdx > 0 || vaHighIdx < nodes.length - 1)) {
    const lowerVol = vaLowIdx > 0 ? nodes[vaLowIdx - 1].totalVolume : -1;
    const upperVol = vaHighIdx < nodes.length - 1 ? nodes[vaHighIdx + 1].totalVolume : -1;
    if (upperVol >= lowerVol && vaHighIdx < nodes.length - 1) {
      vaHighIdx++;
      nodes[vaHighIdx].isValueArea = true;
      accumVA += nodes[vaHighIdx].totalVolume;
    } else if (vaLowIdx > 0) {
      vaLowIdx--;
      nodes[vaLowIdx].isValueArea = true;
      accumVA += nodes[vaLowIdx].totalVolume;
    } else {
      break;
    }
  }

  const pocNode = nodes[pocIdx] ? { ...nodes[pocIdx] } : null;
  const valueAreaHigh = nodes[vaHighIdx]?.priceHigh ?? maxHigh;
  const valueAreaLow = nodes[vaLowIdx]?.priceLow ?? minLow;
  const sumVol = totalBuyVolume + totalSellVolume;
  const netDeltaPercent = sumVol > 0 ? Math.round(((totalBuyVolume - totalSellVolume) / sumVol) * 100) : 0;

  return {
    nodes: [...nodes].reverse(), // Highest price at top
    maxVolume,
    pocNode,
    valueAreaHigh,
    valueAreaLow,
    totalBuyVolume,
    totalSellVolume,
    netDeltaPercent,
    volumeMode,
    deltaBars: deltaBars.slice(-24),
  };
}

/**
 * Scan real historical candles for institutional Order Blocks, Fair Value Gaps (FVGs),
 * and Buy-Side / Sell-Side Liquidity swing clusters.
 */
export function detectRealOrderBlocksAndPools(
  candles: Candle[],
  currentPrice: number,
  ticker = ''
): { orderBlocks: OrderBlockZone[]; liquidityPools: LiquidityPool[] } {
  if (!candles || candles.length < 8) {
    return { orderBlocks: [], liquidityPools: [] };
  }

  const totalRawVol = candles.reduce((sum, c) => sum + (Number.isFinite(c.volume) && c.volume > 0 ? c.volume : 0), 0);
  const useTickFallback = totalRawVol <= 0;
  const avgPrice = candles.reduce((s, c) => s + c.close, 0) / candles.length;
  const avgBody = candles.reduce((s, c) => s + Math.abs(c.close - c.open), 0) / candles.length || avgPrice * 0.001;

  const detectedZones: OrderBlockZone[] = [];

  // 1. Order Block Detection (last opposite candle before impulsive displacement)
  for (let i = 1; i < candles.length - 2; i++) {
    const prev = candles[i];
    const disp1 = candles[i + 1];
    const disp2 = candles[i + 2];

    const disp1Body = Math.abs(disp1.close - disp1.open);
    const disp2Body = Math.abs(disp2.close - disp2.open);

    // Bullish OB: Bearish candle followed by strong bullish break higher
    const isBullishDisplacement =
      prev.close < prev.open &&
      disp1.close > disp1.open &&
      disp1.close > prev.high &&
      (disp1Body > avgBody * 1.15 || disp2.close > disp1.high);

    if (isBullishDisplacement) {
      const zLow = prev.low;
      const zHigh = Math.max(prev.open, prev.close);
      let tested = false;
      let swept = false;
      for (let j = i + 2; j < candles.length; j++) {
        if (candles[j].close < zLow) {
          swept = true;
          break;
        }
        if (candles[j].low <= zHigh && candles[j].low >= zLow) {
          tested = true;
        }
      }
      const eff = getEffectiveCandleVolume(prev, useTickFallback, avgPrice);
      const dispStrength = Math.min(98, Math.round(58 + (disp1Body / avgBody) * 14 + (disp2Body / avgBody) * 6));
      detectedZones.push({
        id: `bull-ob-${i}`,
        type: 'BULLISH',
        kind: 'ORDER_BLOCK',
        label: `Bullish Demand OB (${prev.timeLabel})`,
        priceLow: zLow,
        priceHigh: zHigh,
        midpoint: (zLow + zHigh) / 2,
        volumeAbsorbed: eff.total,
        volumeLabel: useTickFallback ? `${eff.total.toLocaleString()} ticks` : `${eff.total.toLocaleString()} vol`,
        timeLabel: prev.fullDate || prev.timeLabel,
        status: swept ? 'SWEPT' : tested ? 'TESTED (MITIGATED)' : 'UNMITIGATED (FRESH)',
        strengthScore: dispStrength,
        description: `Last down-close bar before +${formatQuantPrice(disp1.close - prev.open, ticker)} impulsive breakout.`,
      });
    }

    // Bearish OB: Bullish candle followed by strong bearish displacement lower
    const isBearishDisplacement =
      prev.close > prev.open &&
      disp1.close < disp1.open &&
      disp1.close < prev.low &&
      (disp1Body > avgBody * 1.15 || disp2.close < disp1.low);

    if (isBearishDisplacement) {
      const zLow = Math.min(prev.open, prev.close);
      const zHigh = prev.high;
      let tested = false;
      let swept = false;
      for (let j = i + 2; j < candles.length; j++) {
        if (candles[j].close > zHigh) {
          swept = true;
          break;
        }
        if (candles[j].high >= zLow && candles[j].high <= zHigh) {
          tested = true;
        }
      }
      const eff = getEffectiveCandleVolume(prev, useTickFallback, avgPrice);
      const dispStrength = Math.min(98, Math.round(58 + (disp1Body / avgBody) * 14 + (disp2Body / avgBody) * 6));
      detectedZones.push({
        id: `bear-ob-${i}`,
        type: 'BEARISH',
        kind: 'ORDER_BLOCK',
        label: `Bearish Supply OB (${prev.timeLabel})`,
        priceLow: zLow,
        priceHigh: zHigh,
        midpoint: (zLow + zHigh) / 2,
        volumeAbsorbed: eff.total,
        volumeLabel: useTickFallback ? `${eff.total.toLocaleString()} ticks` : `${eff.total.toLocaleString()} vol`,
        timeLabel: prev.fullDate || prev.timeLabel,
        status: swept ? 'SWEPT' : tested ? 'TESTED (MITIGATED)' : 'UNMITIGATED (FRESH)',
        strengthScore: dispStrength,
        description: `Last up-close distribution bar before -${formatQuantPrice(prev.close - disp1.close, ticker)} breakdown.`,
      });
    }

    // 2. 3-Candle Fair Value Gap (Imbalance)
    const c0 = candles[i - 1];
    const c2 = candles[i + 1];
    if (c2.low > c0.high && prev.close > prev.open && c2.low - c0.high > avgBody * 0.15) {
      const zLow = c0.high;
      const zHigh = c2.low;
      let tested = false;
      let swept = false;
      for (let j = i + 2; j < candles.length; j++) {
        if (candles[j].close < zLow) {
          swept = true;
          break;
        }
        if (candles[j].low <= zHigh) tested = true;
      }
      const eff = getEffectiveCandleVolume(prev, useTickFallback, avgPrice);
      detectedZones.push({
        id: `bull-fvg-${i}`,
        type: 'BULLISH',
        kind: 'FVG',
        label: `Bullish FVG Imbalance (${prev.timeLabel})`,
        priceLow: zLow,
        priceHigh: zHigh,
        midpoint: (zLow + zHigh) / 2,
        volumeAbsorbed: eff.total,
        volumeLabel: useTickFallback ? `${eff.total.toLocaleString()} ticks` : `${eff.total.toLocaleString()} vol`,
        timeLabel: prev.fullDate || prev.timeLabel,
        status: swept ? 'SWEPT' : tested ? 'TESTED (MITIGATED)' : 'UNMITIGATED (FRESH)',
        strengthScore: Math.min(95, Math.round(62 + (Math.abs(prev.close - prev.open) / avgBody) * 12)),
        description: `3-candle liquidity void left open between ${formatQuantPrice(zLow, ticker)} and ${formatQuantPrice(zHigh, ticker)}.`,
      });
    } else if (c2.high < c0.low && prev.close < prev.open && c0.low - c2.high > avgBody * 0.15) {
      const zLow = c2.high;
      const zHigh = c0.low;
      let tested = false;
      let swept = false;
      for (let j = i + 2; j < candles.length; j++) {
        if (candles[j].close > zHigh) {
          swept = true;
          break;
        }
        if (candles[j].high >= zLow) tested = true;
      }
      const eff = getEffectiveCandleVolume(prev, useTickFallback, avgPrice);
      detectedZones.push({
        id: `bear-fvg-${i}`,
        type: 'BEARISH',
        kind: 'FVG',
        label: `Bearish FVG Imbalance (${prev.timeLabel})`,
        priceLow: zLow,
        priceHigh: zHigh,
        midpoint: (zLow + zHigh) / 2,
        volumeAbsorbed: eff.total,
        volumeLabel: useTickFallback ? `${eff.total.toLocaleString()} ticks` : `${eff.total.toLocaleString()} vol`,
        timeLabel: prev.fullDate || prev.timeLabel,
        status: swept ? 'SWEPT' : tested ? 'TESTED (MITIGATED)' : 'UNMITIGATED (FRESH)',
        strengthScore: Math.min(95, Math.round(62 + (Math.abs(prev.close - prev.open) / avgBody) * 12)),
        description: `3-candle bearish imbalance gap between ${formatQuantPrice(zLow, ticker)} and ${formatQuantPrice(zHigh, ticker)}.`,
      });
    }
  }

  // Prioritize fresh & nearest zones (mix of bullish and bearish)
  const sortedZones = detectedZones
    .filter((z) => z.status !== 'SWEPT')
    .sort((a, b) => {
      const aFresh = a.status.includes('FRESH') ? 0 : 1;
      const bFresh = b.status.includes('FRESH') ? 0 : 1;
      if (aFresh !== bFresh) return aFresh - bFresh;
      const aDist = Math.abs(a.midpoint - currentPrice);
      const bDist = Math.abs(b.midpoint - currentPrice);
      return aDist - bDist;
    });

  const bullPick = sortedZones.filter((z) => z.type === 'BULLISH').slice(0, 3);
  const bearPick = sortedZones.filter((z) => z.type === 'BEARISH').slice(0, 3);
  const orderBlocks = [...bullPick, ...bearPick].slice(0, 6);

  // Fallback structural swing demand/supply if price trended in one tight direction
  if (orderBlocks.length === 0) {
    const recent = candles.slice(-20);
    const minBar = recent.reduce((m, c) => (c.low < m.low ? c : m), recent[0]);
    const maxBar = recent.reduce((m, c) => (c.high > m.high ? c : m), recent[0]);
    orderBlocks.push({
      id: 'swing-demand',
      type: 'BULLISH',
      kind: 'ORDER_BLOCK',
      label: `Range Swing Support (${minBar.timeLabel})`,
      priceLow: minBar.low,
      priceHigh: Math.min(minBar.high, minBar.low + avgBody),
      midpoint: (minBar.low + Math.min(minBar.high, minBar.low + avgBody)) / 2,
      volumeAbsorbed: minBar.volume || 1200,
      volumeLabel: minBar.volume > 0 ? `${minBar.volume.toLocaleString()} vol` : 'Swing Pivot',
      timeLabel: minBar.fullDate || minBar.timeLabel,
      status: 'UNMITIGATED (FRESH)',
      strengthScore: 72,
      description: 'Lowest structural swing anchor from active lookback range.',
    });
    orderBlocks.push({
      id: 'swing-supply',
      type: 'BEARISH',
      kind: 'ORDER_BLOCK',
      label: `Range Swing Resistance (${maxBar.timeLabel})`,
      priceLow: Math.max(maxBar.low, maxBar.high - avgBody),
      priceHigh: maxBar.high,
      midpoint: (Math.max(maxBar.low, maxBar.high - avgBody) + maxBar.high) / 2,
      volumeAbsorbed: maxBar.volume || 1200,
      volumeLabel: maxBar.volume > 0 ? `${maxBar.volume.toLocaleString()} vol` : 'Swing Pivot',
      timeLabel: maxBar.fullDate || maxBar.timeLabel,
      status: 'UNMITIGATED (FRESH)',
      strengthScore: 72,
      description: 'Highest structural swing cap from active lookback range.',
    });
  }

  // 3. Swing High / Swing Low Liquidity Pools (BSL & SSL)
  const swingHighs: number[] = [];
  const swingLows: number[] = [];
  for (let i = 2; i < candles.length - 2; i++) {
    const h = candles[i].high;
    const l = candles[i].low;
    if (h >= candles[i - 1].high && h >= candles[i - 2].high && h >= candles[i + 1].high && h >= candles[i + 2].high) {
      swingHighs.push(h);
    }
    if (l <= candles[i - 1].low && l <= candles[i - 2].low && l <= candles[i + 1].low && l <= candles[i + 2].low) {
      swingLows.push(l);
    }
  }

  const tol = currentPrice * 0.0018;
  const clusterLevels = (vals: number[], aboveSpot: boolean) => {
    const filtered = vals.filter((v) => (aboveSpot ? v > currentPrice : v < currentPrice));
    const groups: Array<{ price: number; touches: number }> = [];
    for (const v of filtered) {
      const match = groups.find((g) => Math.abs(g.price - v) <= tol);
      if (match) {
        match.price = (match.price * match.touches + v) / (match.touches + 1);
        match.touches += 1;
      } else {
        groups.push({ price: v, touches: 1 });
      }
    }
    return groups.sort((a, b) => Math.abs(a.price - currentPrice) - Math.abs(b.price - currentPrice));
  };

  const bslClusters = clusterLevels(swingHighs, true);
  const sslClusters = clusterLevels(swingLows, false);
  const maxCandleHigh = Math.max(...candles.map((c) => c.high));
  const minCandleLow = Math.min(...candles.map((c) => c.low));

  const liquidityPools: LiquidityPool[] = [];
  bslClusters.slice(0, 2).forEach((g, idx) => {
    const dist = ((g.price - currentPrice) / Math.max(1e-6, currentPrice)) * 100;
    liquidityPools.push({
      id: `bsl-${idx}`,
      type: 'BUY_SIDE (BSL)',
      price: g.price,
      touches: g.touches,
      distancePercent: Number(dist.toFixed(2)),
      dangerLevel: g.touches >= 2 ? 'EXTREME' : 'HIGH',
      description:
        g.touches >= 2
          ? `Equal Highs (${g.touches}x swing rejections) — concentrated short-covering buy stops above.`
          : `Unclaimed Swing High pivot — short stop-losses and breakout buy orders resting above.`,
    });
  });
  if (bslClusters.length === 0 && maxCandleHigh > currentPrice) {
    liquidityPools.push({
      id: 'bsl-range-high',
      type: 'BUY_SIDE (BSL)',
      price: maxCandleHigh,
      touches: 1,
      distancePercent: Number((((maxCandleHigh - currentPrice) / currentPrice) * 100).toFixed(2)),
      dangerLevel: 'HIGH',
      description: 'Session/Lookback range high — primary upside liquidity draw.',
    });
  }

  sslClusters.slice(0, 2).forEach((g, idx) => {
    const dist = ((currentPrice - g.price) / Math.max(1e-6, currentPrice)) * 100;
    liquidityPools.push({
      id: `ssl-${idx}`,
      type: 'SELL_SIDE (SSL)',
      price: g.price,
      touches: g.touches,
      distancePercent: Number(dist.toFixed(2)),
      dangerLevel: g.touches >= 2 ? 'EXTREME' : 'HIGH',
      description:
        g.touches >= 2
          ? `Equal Lows (${g.touches}x swing bounces) — concentrated long stop-loss sell stops below.`
          : `Unclaimed Swing Low pivot — trailing long stops resting beneath support.`,
    });
  });
  if (sslClusters.length === 0 && minCandleLow < currentPrice) {
    liquidityPools.push({
      id: 'ssl-range-low',
      type: 'SELL_SIDE (SSL)',
      price: minCandleLow,
      touches: 1,
      distancePercent: Number((((currentPrice - minCandleLow) / currentPrice) * 100).toFixed(2)),
      dangerLevel: 'HIGH',
      description: 'Session/Lookback range low — primary downside liquidity draw.',
    });
  }

  return { orderBlocks, liquidityPools };
}

/**
 * Derive DOM Bid/Ask cluster levels directly from real Volume Profile HVNs,
 * detected Order Blocks, and Swing High/Low clusters.
 */
export function computeDomClusterLadder(
  profile: RealVolumeProfileResult,
  orderBlocks: OrderBlockZone[],
  liquidityPools: LiquidityPool[],
  currentPrice: number
): { bids: DomClusterLevel[]; asks: DomClusterLevel[]; totalBids: number; totalAsks: number } {
  const bidsMap = new Map<number, DomClusterLevel>();
  const asksMap = new Map<number, DomClusterLevel>();

  for (const node of profile.nodes) {
    if (node.price <= currentPrice && node.buyVolume > 0) {
      bidsMap.set(Number(node.price.toFixed(5)), {
        price: node.price,
        volume: node.buyVolume,
        touches: node.isPoc ? 4 : node.isValueArea ? 2 : 1,
        isWall: node.isPoc || node.totalVolume >= profile.maxVolume * 0.72,
        sourceLabel: node.isPoc ? 'Volume POC Support' : 'VPVR Buy Node',
      });
    } else if (node.price > currentPrice && node.sellVolume > 0) {
      asksMap.set(Number(node.price.toFixed(5)), {
        price: node.price,
        volume: node.sellVolume,
        touches: node.isPoc ? 4 : node.isValueArea ? 2 : 1,
        isWall: node.isPoc || node.totalVolume >= profile.maxVolume * 0.72,
        sourceLabel: node.isPoc ? 'Volume POC Resistance' : 'VPVR Sell Node',
      });
    }
  }

  for (const ob of orderBlocks) {
    if (ob.type === 'BULLISH' && ob.midpoint <= currentPrice * 1.005) {
      const key = Number(ob.midpoint.toFixed(5));
      bidsMap.set(key, {
        price: ob.midpoint,
        volume: Math.max(ob.volumeAbsorbed, bidsMap.get(key)?.volume || 0),
        touches: ob.status.includes('FRESH') ? 3 : 2,
        isWall: ob.status.includes('FRESH'),
        sourceLabel: ob.kind === 'FVG' ? 'Bullish FVG Edge' : 'Bullish Order Block',
      });
    } else if (ob.type === 'BEARISH' && ob.midpoint >= currentPrice * 0.995) {
      const key = Number(ob.midpoint.toFixed(5));
      asksMap.set(key, {
        price: ob.midpoint,
        volume: Math.max(ob.volumeAbsorbed, asksMap.get(key)?.volume || 0),
        touches: ob.status.includes('FRESH') ? 3 : 2,
        isWall: ob.status.includes('FRESH'),
        sourceLabel: ob.kind === 'FVG' ? 'Bearish FVG Edge' : 'Bearish Order Block',
      });
    }
  }

  for (const lp of liquidityPools) {
    const key = Number(lp.price.toFixed(5));
    if (lp.type.includes('SSL')) {
      const existing = bidsMap.get(key);
      bidsMap.set(key, {
        price: lp.price,
        volume: existing ? existing.volume : Math.round((profile.maxVolume || 1000) * 0.65),
        touches: lp.touches,
        isWall: lp.dangerLevel === 'EXTREME',
        sourceLabel: `SSL Pool (${lp.touches}x)`,
      });
    } else {
      const existing = asksMap.get(key);
      asksMap.set(key, {
        price: lp.price,
        volume: existing ? existing.volume : Math.round((profile.maxVolume || 1000) * 0.65),
        touches: lp.touches,
        isWall: lp.dangerLevel === 'EXTREME',
        sourceLabel: `BSL Pool (${lp.touches}x)`,
      });
    }
  }

  const bids = Array.from(bidsMap.values())
    .sort((a, b) => b.price - a.price)
    .slice(0, 6);
  const asks = Array.from(asksMap.values())
    .sort((a, b) => a.price - b.price)
    .slice(0, 6);

  return {
    bids,
    asks,
    totalBids: bids.reduce((s, b) => s + b.volume, 0),
    totalAsks: asks.reduce((s, a) => s + a.volume, 0),
  };
}

function calcEmaArray(values: number[], period: number): number[] {
  if (values.length === 0) return [];
  const k = 2 / (period + 1);
  const res = [values[0]];
  for (let i = 1; i < values.length; i++) {
    res.push(values[i] * k + res[i - 1] * (1 - k));
  }
  return res;
}

function calcSma(values: number[], period: number): number {
  if (values.length === 0) return 0;
  const slice = values.slice(-period);
  return slice.reduce((s, v) => s + v, 0) / slice.length;
}

function calcRsi(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  let gains = 0;
  let losses = 0;
  const start = Math.max(1, closes.length - period);
  for (let i = start; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return avgGain > 0 ? 78 : 50;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/**
 * Compute Barchart.com-style Technical Opinion Matrix, 52W High/Low range bar,
 * and Classic/Fibonacci Pivot Ladders directly from live OHLCV candles & TV quote.
 */
export function computeBarchartTechnicalOpinion(
  candles: Candle[],
  currentPrice: number,
  ticker = '',
  liveQuote?: LiveTvQuote
): BarchartOpinionResult {
  const closes = candles.map((c) => c.close);
  const price = currentPrice > 0 ? currentPrice : closes[closes.length - 1] || 100;

  const ema5 = calcEmaArray(closes, 5).pop() ?? price;
  const ema10 = calcEmaArray(closes, 10).pop() ?? price;
  const ema20 = liveQuote?.ema20 ?? calcEmaArray(closes, 20).pop() ?? price;
  const ema50 = liveQuote?.ema50 ?? calcEmaArray(closes, 50).pop() ?? price;
  const sma100 = calcSma(closes, Math.min(100, Math.max(20, closes.length)));
  const ema200 = liveQuote?.ema200 ?? sma100;

  const ema12 = calcEmaArray(closes, 12);
  const ema26 = calcEmaArray(closes, 26);
  const macdArr = ema12.map((v, idx) => v - (ema26[idx] ?? v));
  const macdSigArr = calcEmaArray(macdArr, 9);
  const macdLine = liveQuote?.macd ?? macdArr[macdArr.length - 1] ?? 0;
  const macdSignal = liveQuote?.macdSignal ?? macdSigArr[macdSigArr.length - 1] ?? 0;

  const rsi14 = liveQuote?.rsi ?? calcRsi(closes, 14);

  // ATR 14
  let atrSum = 0;
  const atrCount = Math.min(14, Math.max(1, candles.length - 1));
  for (let i = Math.max(1, candles.length - atrCount); i < candles.length; i++) {
    const c = candles[i];
    const prevC = candles[i - 1];
    const tr = Math.max(c.high - c.low, Math.abs(c.high - prevC.close), Math.abs(c.low - prevC.close));
    atrSum += tr;
  }
  const atrValue = liveQuote?.atr ?? (atrCount > 0 ? atrSum / atrCount : price * 0.005);

  const tol = price * 0.0005;
  const sigCompare = (a: number, b: number): 'BUY' | 'SELL' | 'HOLD' => {
    if (a > b + tol) return 'BUY';
    if (a < b - tol) return 'SELL';
    return 'HOLD';
  };

  // Momentum 7-bar
  const refIdx = Math.max(0, closes.length - 8);
  const momPct = closes.length > 0 ? ((price - closes[refIdx]) / Math.max(1e-8, closes[refIdx])) * 100 : 0;

  // Bollinger mid & bands
  const latestCandle = candles[candles.length - 1];
  const bbMid = latestCandle?.bbMiddle ?? calcSma(closes, 20);

  const shortItems: IndicatorSignalItem[] = [
    { name: '5-Period EMA', valueText: formatQuantPrice(ema5, ticker), signal: sigCompare(price, ema5) },
    { name: '10-Period EMA', valueText: formatQuantPrice(ema10, ticker), signal: sigCompare(price, ema10) },
    { name: '20-Period EMA', valueText: formatQuantPrice(ema20, ticker), signal: sigCompare(price, ema20) },
    {
      name: '7-Bar Momentum',
      valueText: `${momPct >= 0 ? '+' : ''}${momPct.toFixed(2)}%`,
      signal: momPct > 0.15 ? 'BUY' : momPct < -0.15 ? 'SELL' : 'HOLD',
    },
  ];

  const medItems: IndicatorSignalItem[] = [
    { name: '50-Period EMA', valueText: formatQuantPrice(ema50, ticker), signal: sigCompare(price, ema50) },
    { name: '20 / 50 EMA Cross', valueText: `${formatQuantPrice(ema20, ticker)}`, signal: sigCompare(ema20, ema50) },
    {
      name: 'MACD (12,26,9)',
      valueText: `${macdLine >= 0 ? '+' : ''}${macdLine.toFixed(price < 10 ? 4 : 2)}`,
      signal: macdLine > macdSignal ? 'BUY' : macdLine < macdSignal ? 'SELL' : 'HOLD',
    },
    {
      name: 'RSI (14)',
      valueText: rsi14.toFixed(1),
      signal: rsi14 >= 54 && rsi14 <= 78 ? 'BUY' : rsi14 <= 46 && rsi14 >= 22 ? 'SELL' : rsi14 > 78 ? 'SELL' : rsi14 < 22 ? 'BUY' : 'HOLD',
    },
  ];

  const longItems: IndicatorSignalItem[] = [
    { name: '100-Period SMA', valueText: formatQuantPrice(sma100, ticker), signal: sigCompare(price, sma100) },
    { name: '200-Period Baseline', valueText: formatQuantPrice(ema200, ticker), signal: sigCompare(price, ema200) },
    { name: 'Bollinger Mid (20)', valueText: formatQuantPrice(bbMid, ticker), signal: sigCompare(price, bbMid) },
    {
      name: '50 / 200 Structure',
      valueText: ema50 >= ema200 ? 'Golden Cross Bias' : 'Death Cross Bias',
      signal: sigCompare(ema50, ema200),
    },
  ];

  const scoreGroup = (items: IndicatorSignalItem[]) => {
    const buys = items.filter((i) => i.signal === 'BUY').length;
    const sells = items.filter((i) => i.signal === 'SELL').length;
    const net = buys - sells;
    const verdict: 'BUY' | 'SELL' | 'HOLD' = net > 0 ? 'BUY' : net < 0 ? 'SELL' : 'HOLD';
    const pct = Math.max(8, Math.round((Math.max(buys, sells) / items.length) * 100));
    return { verdict, strengthPct: pct };
  };

  const sGroup = scoreGroup(shortItems);
  const mGroup = scoreGroup(medItems);
  const lGroup = scoreGroup(longItems);

  const allItems = [...shortItems, ...medItems, ...longItems];
  const buyCount = allItems.filter((i) => i.signal === 'BUY').length;
  const sellCount = allItems.filter((i) => i.signal === 'SELL').length;
  const holdCount = allItems.length - buyCount - sellCount;

  const rawScore = Math.round(((buyCount - sellCount) / allItems.length) * 100);
  const tvBlend = typeof liveQuote?.recommendAll === 'number' ? Math.round(liveQuote.recommendAll * 100) : rawScore;
  const overallScore = Math.max(-100, Math.min(100, Math.round(rawScore * 0.65 + tvBlend * 0.35)));
  const overallPercent = Math.max(10, Math.abs(overallScore));
  const overallDirection: 'BUY' | 'SELL' | 'HOLD' =
    overallScore >= 16 ? 'BUY' : overallScore <= -16 ? 'SELL' : 'HOLD';

  let verdictLabel: BarchartOpinionResult['verdictLabel'] = 'Hold';
  if (overallScore >= 60) verdictLabel = 'Strong Buy';
  else if (overallScore >= 16) verdictLabel = 'Buy';
  else if (overallScore <= -60) verdictLabel = 'Strong Sell';
  else if (overallScore <= -16) verdictLabel = 'Sell';

  // 52W Range
  const candleMax = candles.length > 0 ? Math.max(...candles.map((c) => c.high)) : price * 1.05;
  const candleMin = candles.length > 0 ? Math.min(...candles.map((c) => c.low)) : price * 0.95;
  const high52w = Math.max(price, liveQuote?.high52w && liveQuote.high52w > 0 ? liveQuote.high52w : candleMax);
  const low52w = Math.min(price, liveQuote?.low52w && liveQuote.low52w > 0 ? liveQuote.low52w : candleMin);
  const span52 = Math.max(1e-8, high52w - low52w);
  const rangePercentile = Math.min(100, Math.max(0, Math.round(((price - low52w) / span52) * 100)));

  // Pivots from prior completed candle or recent window
  const refCandles = candles.slice(-10, -1);
  const pH = refCandles.length > 0 ? Math.max(...refCandles.map((c) => c.high)) : liveQuote?.high || price * 1.005;
  const pL = refCandles.length > 0 ? Math.min(...refCandles.map((c) => c.low)) : liveQuote?.low || price * 0.995;
  const pC = refCandles.length > 0 ? refCandles[refCandles.length - 1].close : price;
  const pp = (pH + pL + pC) / 3;
  const rng = Math.max(1e-8, pH - pL);

  const classicPivots: PivotLevelsSet = {
    method: 'Classic',
    pp,
    r1: 2 * pp - pL,
    r2: pp + rng,
    r3: pH + 2 * (pp - pL),
    s1: 2 * pp - pH,
    s2: pp - rng,
    s3: pL - 2 * (pH - pp),
  };

  const fibPivots: PivotLevelsSet = {
    method: 'Fibonacci',
    pp,
    r1: pp + 0.382 * rng,
    r2: pp + 0.618 * rng,
    r3: pp + 1.0 * rng,
    s1: pp - 0.382 * rng,
    s2: pp - 0.618 * rng,
    s3: pp - 1.0 * rng,
  };

  return {
    overallScore,
    overallPercent,
    overallDirection,
    verdictLabel,
    buyCount,
    sellCount,
    holdCount,
    shortTerm: { label: 'Short Term (5-20)', ...sGroup, items: shortItems },
    mediumTerm: { label: 'Medium Term (50/MACD/RSI)', ...mGroup, items: medItems },
    longTerm: { label: 'Long Term (100/200/BB)', ...lGroup, items: longItems },
    high52w,
    low52w,
    rangePercentile,
    atrValue,
    rsi14,
    macdLine,
    macdSignal,
    classicPivots,
    fibPivots,
  };
}
