import { LiveTvQuote, lookupTradingViewQuote } from './tradingViewSync.ts';
import { getAssetMarketSession } from './marketHours.ts';
import { emitPaperPositionsUpdated } from './portfolioGuard.ts';
import { syncRealizedTradePnlToProp, evaluatePropTradeBlock } from './propGuardian.ts';
import { scheduleTradingCloudPush } from './tradingCloudSync.ts';

export const PAPER_TRADE_ALERT_EVENT = 'njia-paper-trade-auto-event';
export const MULLAH_PROACTIVE_ALERT_EVENT = 'mullah-proactive-speak';
export const AUTO_SIGNAL_PAPER_KEY = 'njia_auto_paper_on_signal';
export const AUTO_SIGNAL_COOLDOWN_KEY = 'njia_auto_paper_cooldown_v1';
export const AUTO_SIGNAL_PAPER_TOGGLE_EVENT = 'njia-auto-paper-toggle';

export type CloseReason = 'TP_HIT' | 'TP1_PARTIAL' | 'SL_HIT' | 'MANUAL';

export interface ManagedPaperPosition {
  id: string;
  ticket: number;
  ticker: string;
  name: string;
  currency: string;
  market: 'NSE' | 'US' | 'FOREX' | 'METALS' | 'INDICES';
  direction: 'LONG' | 'SHORT';
  lots: number;
  entryPrice: number;
  currentPrice: number;
  stopLoss?: number;
  tp1?: number;
  takeProfit?: number;
  pnl: number;
  pnlPercent: number;
  timestamp: string;
  executionType?: string;
  brokerServer?: string;
  isBreakEvenLocked?: boolean;
  isAutoSignal?: boolean;
  strategy?: string;
  timeframe?: string;
  signalId?: string;
  confidenceScore?: number;
  mindset?: 'DISCIPLINED' | 'FOMO' | 'REVENGE' | 'TIRED';
  setupGrade?: 'A+' | 'B' | 'C';
}

export interface ManagedClosedTrade {
  id: string;
  ticker: string;
  direction: 'LONG' | 'SHORT';
  lots: number;
  entryPrice: number;
  exitPrice: number;
  currency: string;
  pnl: number;
  pnlPercent: number;
  timestamp: string;
  outcome: 'WIN' | 'LOSS';
  isAutoSignal?: boolean;
  strategy?: string;
  timeframe?: string;
  signalId?: string;
  confidenceScore?: number;
  closeReason?: CloseReason;
  mindset?: 'DISCIPLINED' | 'FOMO' | 'REVENGE' | 'TIRED';
  setupGrade?: 'A+' | 'B' | 'C';
}

export interface PaperTradeAlertDetail {
  id: string;
  ticker: string;
  eventType: 'AUTO_OPENED' | 'TP1_BREAKEVEN' | 'TP_HIT' | 'SL_HIT' | 'MANUAL_CLOSE';
  direction: 'LONG' | 'SHORT';
  exitPrice: number;
  realizedPnl: number;
  timestamp: string;
  strategy?: string;
  timeframe?: string;
}

export function isAutoOpenOnSignalEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return localStorage.getItem(AUTO_SIGNAL_PAPER_KEY) !== 'false';
  } catch {
    return true;
  }
}

export function setAutoOpenOnSignalEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(AUTO_SIGNAL_PAPER_KEY, enabled ? 'true' : 'false');
    window.dispatchEvent(new CustomEvent(AUTO_SIGNAL_PAPER_TOGGLE_EVENT, { detail: { enabled } }));
  } catch {
    // ignore storage errors
  }
}

export function emitMullahProactiveSpeech(text: string): void {
  if (typeof window === 'undefined' || !text.trim()) return;
  window.dispatchEvent(new CustomEvent(MULLAH_PROACTIVE_ALERT_EVENT, { detail: { text } }));
}

export function inferAssetMarket(
  ticker: string,
  explicitMarket?: 'NSE' | 'US' | 'FOREX' | 'METALS' | 'INDICES'
): 'NSE' | 'US' | 'FOREX' | 'METALS' | 'INDICES' {
  if (explicitMarket) return explicitMarket;
  const clean = ticker.toUpperCase().replace(/[/_\s-]/g, '');
  if (clean.includes('XAU') || clean.includes('XAG') || clean.includes('XPT') || clean.includes('XPD') || clean.includes('COPPER')) {
    return 'METALS';
  }
  if (clean.includes('NAS') || clean.includes('US500') || clean.includes('US30') || clean.includes('SPX') || clean === 'DXY') {
    return 'INDICES';
  }
  if (['SCOM', 'EQTY', 'KCB', 'EABL', 'COOP', 'ABSA', 'NCBA', 'BATK', 'BAMB', 'KNRE'].includes(clean)) {
    return 'NSE';
  }
  if (clean.length === 6 || ticker.includes('/')) {
    return 'FOREX';
  }
  return 'US';
}

export function getAssetPriceDigits(ticker: string, market: string, price: number): number {
  const upper = ticker.toUpperCase();
  if (upper.includes('XAU')) return 2;
  if (upper.includes('JPY')) return 3;
  if (upper.includes('KES') || upper.includes('UGX') || upper.includes('TZS')) {
    return price >= 100 ? 2 : 3;
  }
  if ((market === 'FOREX' || market === 'METALS') && price > 0 && price < 10) return 5;
  return 2;
}

export function getAssetSpread(ticker: string, market: string, price: number): number {
  const upper = ticker.toUpperCase();
  if (upper.includes('XAU')) return 0.35;
  if (upper.includes('JPY')) return 0.018;
  if (upper.includes('KES') || upper.includes('UGX') || upper.includes('TZS')) return 0.15;
  if ((market === 'FOREX' || market === 'METALS') && price < 10) return 0.00018;
  if (market === 'INDICES') return 1.5;
  return 0.05;
}

export function getUsdContractMultiplier(ticker: string, market: string, price: number): number {
  const upper = ticker.toUpperCase();
  const clean = upper.replace(/[/_\s-]/g, '');

  if (clean.includes('XAU')) return 100;
  if (clean.includes('XAG')) return 5000;
  if (clean.includes('BTC') || clean.includes('ETH') || clean.includes('SOL')) return 1;
  if (market === 'INDICES' || clean.includes('NAS') || clean.includes('US30') || clean.includes('US500') || clean.includes('SPX')) {
    return 1;
  }
  if (market === 'FOREX' || market === 'METALS') {
    if (clean.includes('JPY')) return 100000 / Math.max(price || 150, 80);
    if (clean.includes('KES') || clean.includes('UGX') || clean.includes('TZS') || clean.includes('ZAR') || clean.includes('TRY') || clean.includes('MXN')) {
      return 100000 / Math.max(price || 129, 10);
    }
    if (clean.startsWith('USD') && !clean.endsWith('USD') && price > 0) {
      return 100000 / Math.max(price, 0.5);
    }
    return 100000;
  }
  return 1;
}

export function calculatePositionPnL(
  ticker: string,
  market: string,
  direction: 'LONG' | 'SHORT',
  lots: number,
  entryPrice: number,
  exitPrice: number
): { pnl: number; pnlPercent: number } {
  const safeEntry = entryPrice > 0 ? entryPrice : 1;
  const mult = getUsdContractMultiplier(ticker, market, exitPrice || safeEntry) * lots;
  const diff = direction === 'LONG' ? exitPrice - safeEntry : safeEntry - exitPrice;
  const pnl = Math.round(diff * mult * 100) / 100;
  const pnlPercent = Math.round((diff / safeEntry) * 10000) / 100;
  return { pnl, pnlPercent };
}

export function loadManagedPaperPositions(): ManagedPaperPosition[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('njia_paper_positions');
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function loadManagedClosedTrades(): ManagedClosedTrade[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('njia_paper_trades');
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function executePaperMarketOrder(params: {
  ticker: string;
  name?: string;
  direction: 'LONG' | 'SHORT';
  lots: number;
  spotPrice: number;
  market?: 'NSE' | 'US' | 'FOREX' | 'METALS' | 'INDICES';
  currency?: string;
  stopLoss?: number;
  tp1?: number;
  takeProfit?: number;
  source?: string;
  isAutoSignal?: boolean;
  strategy?: string;
  timeframe?: string;
  signalId?: string;
  confidenceScore?: number;
  mindset?: 'DISCIPLINED' | 'FOMO' | 'REVENGE' | 'TIRED';
  setupGrade?: 'A+' | 'B' | 'C';
}): { ok: boolean; error?: string; position?: ManagedPaperPosition } {
  const ticker = params.ticker.toUpperCase();
  const market = inferAssetMarket(ticker, params.market);

  const session = getAssetMarketSession(ticker, market);
  if (!session.isOpen) {
    return {
      ok: false,
      error: `${ticker} market is currently closed. No fills allowed until session reopens (${session.nextSessionText}).`,
    };
  }

  const propCheck = evaluatePropTradeBlock();
  if (propCheck.blocked) {
    return {
      ok: false,
      error: propCheck.reason || 'Prop Firm Risk Guardian circuit breaker has locked trading.',
    };
  }

  const digits = getAssetPriceDigits(ticker, market, params.spotPrice);
  const spread = getAssetSpread(ticker, market, params.spotPrice);
  const fillPrice = Number(
    (params.direction === 'LONG' ? params.spotPrice + spread / 2 : params.spotPrice - spread / 2).toFixed(digits)
  );
  const lots = Math.max(0.01, Number(params.lots) || 0.1);
  const marketMark = Number(
    (params.direction === 'LONG' ? params.spotPrice - spread / 2 : params.spotPrice + spread / 2).toFixed(digits)
  );
  const { pnl: initialSpreadPnl, pnlPercent } = calculatePositionPnL(
    ticker,
    market,
    params.direction,
    lots,
    fillPrice,
    marketMark
  );
  const ticket = 98000000 + Math.floor((Date.now() + Math.random() * 1000) % 900000);

  const newPos: ManagedPaperPosition = {
    id: `pos-${ticket}-${Math.floor(Math.random() * 900 + 100)}`,
    ticket,
    ticker,
    name: params.name || ticker,
    currency: params.currency || 'USD',
    market,
    direction: params.direction,
    lots,
    entryPrice: fillPrice,
    currentPrice: marketMark,
    stopLoss: params.stopLoss ? Number(params.stopLoss.toFixed(digits)) : undefined,
    tp1: params.tp1 ? Number(params.tp1.toFixed(digits)) : undefined,
    takeProfit: params.takeProfit ? Number(params.takeProfit.toFixed(digits)) : undefined,
    pnl: initialSpreadPnl,
    pnlPercent,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    executionType: params.source || (params.isAutoSignal ? 'Auto Signal Execution' : 'Market Execution'),
    brokerServer: 'JustMarkets (Raw Spread / Pro)',
    isAutoSignal: Boolean(params.isAutoSignal),
    strategy: params.strategy,
    timeframe: params.timeframe,
    signalId: params.signalId,
    confidenceScore: params.confidenceScore,
    mindset: params.mindset || 'DISCIPLINED',
    setupGrade: params.setupGrade || 'A+',
  };

  try {
    const existing = loadManagedPaperPositions();
    localStorage.setItem('njia_paper_positions', JSON.stringify([newPos, ...existing].slice(0, 100)));
    emitPaperPositionsUpdated();
    scheduleTradingCloudPush();
  } catch {
    return { ok: false, error: 'Failed to persist paper position locally.' };
  }

  fetch('/api/ea/open-trade', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      symbol: ticker.replace('/', ''),
      type: params.direction === 'LONG' ? 'BUY' : 'SELL',
      lots,
      price: fillPrice,
      sl: newPos.stopLoss,
      tp: newPos.takeProfit,
    }),
  }).catch(() => {});

  return { ok: true, position: newPos };
}

function readAutoSignalCooldowns(): Record<string, number> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(AUTO_SIGNAL_COOLDOWN_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeAutoSignalCooldown(key: string, ts: number): void {
  if (typeof window === 'undefined') return;
  try {
    const map = readAutoSignalCooldowns();
    const cutoff = ts - 6 * 60 * 60 * 1000;
    const pruned: Record<string, number> = {};
    for (const [k, v] of Object.entries(map)) {
      if (typeof v === 'number' && v >= cutoff) pruned[k] = v;
    }
    pruned[key] = ts;
    localStorage.setItem(AUTO_SIGNAL_COOLDOWN_KEY, JSON.stringify(pruned));
  } catch {
    // ignore storage errors
  }
}

export function parseNumericLevel(val: string | number | undefined, fallback = 0): number {
  if (typeof val === 'number') return Number.isFinite(val) && val > 0 ? val : fallback;
  if (typeof val !== 'string') return fallback;
  const match = val.replace(/,/g, '').match(/-?\d+(\.\d+)?/);
  const num = match ? parseFloat(match[0]) : NaN;
  return Number.isFinite(num) && num > 0 ? num : fallback;
}

/**
 * Automatically opens a Paper Trade whenever an actionable BUY/SELL signal is indicated,
 * strictly deduplicated per (symbol, direction) & 15-minute cooldown so ticks never create duplicates.
 */
export function openPaperTradeFromSignal(input: {
  symbol: string;
  name?: string;
  market?: 'NSE' | 'US' | 'FOREX' | 'METALS' | 'INDICES';
  currency?: string;
  action: string;
  timeframe: string;
  spotPrice: number;
  sl: number;
  tp1: number;
  tp2?: number;
  strategy?: string;
  signalId?: string;
  confidenceScore?: number;
  explicitLots?: number;
  forceManual?: boolean;
}): { opened: boolean; reason?: string; position?: ManagedPaperPosition } {
  if (typeof window === 'undefined') return { opened: false, reason: 'No browser context' };
  if (!input.forceManual && !isAutoOpenOnSignalEnabled()) {
    return { opened: false, reason: 'Auto-signal paper trading paused' };
  }

  const actionUpper = String(input.action || '').toUpperCase().trim();
  const isBuy = actionUpper.includes('BUY');
  const isSell = actionUpper.includes('SELL');
  if (!isBuy && !isSell) {
    return { opened: false, reason: 'Neutral/hold signal' };
  }
  const direction: 'LONG' | 'SHORT' = isBuy ? 'LONG' : 'SHORT';

  if (!(input.spotPrice > 0) || !(input.sl > 0) || !(input.tp1 > 0)) {
    return { opened: false, reason: 'Incomplete price/SL/TP levels' };
  }

  const ticker = input.symbol.trim().toUpperCase();
  const cleanSym = ticker.replace(/[/_\s-]/g, '');
  const market = inferAssetMarket(ticker, input.market);
  const tf = (input.timeframe || '15m').toUpperCase();

  // Validate SL/TP orientation relative to spotPrice
  const slValid = direction === 'LONG' ? input.sl < input.spotPrice : input.sl > input.spotPrice;
  const tpValid = direction === 'LONG' ? input.tp1 > input.spotPrice : input.tp1 < input.spotPrice;
  if (!slValid || !tpValid) {
    return { opened: false, reason: 'Signal SL/TP levels invalid for entry price' };
  }

  const existingPositions = loadManagedPaperPositions();

  if (!input.forceManual) {
    // 1. Prevent duplicate open trade in the same direction for the same symbol
    const alreadyOpen = existingPositions.find(
      (p) => p.ticker.toUpperCase().replace(/[/_\s-]/g, '') === cleanSym && p.direction === direction
    );
    if (alreadyOpen) {
      return { opened: false, reason: `Position already open (${ticker} ${direction})` };
    }

    // 2. Cap concurrent auto-opened positions to protect demo margin
    const autoOpenCount = existingPositions.filter((p) => p.isAutoSignal).length;
    if (autoOpenCount >= 12) {
      return { opened: false, reason: 'Max 12 concurrent auto-signal positions reached' };
    }

    // 3. Enforce 15-minute cooldown per symbol + timeframe + direction
    const cooldownKey = `${cleanSym}_${tf}_${direction}`;
    const cooldowns = readAutoSignalCooldowns();
    const lastTs = cooldowns[cooldownKey] || 0;
    if (Date.now() - lastTs < 15 * 60 * 1000) {
      return { opened: false, reason: `Cooldown active for ${ticker} ${tf} ${direction}` };
    }
  }

  const balance = parseFloat(localStorage.getItem('njia_paper_balance') || '10000') || 10000;
  const riskCash = Math.max(10, balance * 0.01); // 1% risk per signal trade
  const slDist = Math.abs(input.spotPrice - input.sl);
  const mult = getUsdContractMultiplier(ticker, market, input.spotPrice);

  let computedLots = input.explicitLots && input.explicitLots > 0 ? input.explicitLots : 0.1;
  if (!input.explicitLots) {
    const rawQty = slDist > 0 && mult > 0 ? riskCash / (slDist * mult) : 0.1;
    if (market === 'NSE' || market === 'US') {
      computedLots = Math.max(1, Math.min(200, Math.round(rawQty)));
    } else {
      computedLots = Math.max(0.01, Math.min(2.0, Math.round(rawQty * 100) / 100));
    }
  }

  const finalTp = input.tp2 && (direction === 'LONG' ? input.tp2 > input.tp1 : input.tp2 < input.tp1)
    ? input.tp2
    : input.tp1;
  const conf = input.confidenceScore ?? 85;
  const strategyLabel = input.strategy || `Radar ${actionUpper} (${tf})`;

  const res = executePaperMarketOrder({
    ticker,
    name: input.name || ticker,
    direction,
    lots: computedLots,
    spotPrice: input.spotPrice,
    market,
    currency: input.currency || (market === 'NSE' ? 'KES' : 'USD'),
    stopLoss: input.sl,
    tp1: input.tp1,
    takeProfit: finalTp,
    source: input.forceManual ? '1-Click Signal Execution' : 'Auto Signal Engine',
    isAutoSignal: true,
    strategy: strategyLabel,
    timeframe: tf,
    signalId: input.signalId,
    confidenceScore: conf,
    mindset: 'DISCIPLINED',
    setupGrade: conf >= 82 ? 'A+' : 'B',
  });

  if (!res.ok || !res.position) {
    return { opened: false, reason: res.error };
  }

  if (!input.forceManual) {
    writeAutoSignalCooldown(`${cleanSym}_${tf}_${direction}`, Date.now());
  }

  const detail: PaperTradeAlertDetail = {
    id: res.position.id,
    ticker: res.position.ticker,
    eventType: 'AUTO_OPENED',
    direction: res.position.direction,
    exitPrice: res.position.entryPrice,
    realizedPnl: 0,
    timestamp: new Date().toISOString(),
    strategy: strategyLabel,
    timeframe: tf,
  };
  window.dispatchEvent(new CustomEvent<PaperTradeAlertDetail>(PAPER_TRADE_ALERT_EVENT, { detail }));

  return { opened: true, position: res.position };
}

export function closePaperPositionsByQuery(
  symbolOrAll: string,
  liveQuotes: Record<string, LiveTvQuote>
): { closedCount: number; realizedPnl: number; closedTickers: string[] } {
  const positions = loadManagedPaperPositions();
  if (positions.length === 0) {
    return { closedCount: 0, realizedPnl: 0, closedTickers: [] };
  }

  const targetClean = symbolOrAll.toUpperCase().replace(/[/_\s-]/g, '');
  const closeAll = !targetClean || targetClean === 'ALL';

  let balance = parseFloat(localStorage.getItem('njia_paper_balance') || '10000') || 10000;
  const closedList = loadManagedClosedTrades();
  const remaining: ManagedPaperPosition[] = [];
  const closedTickers: string[] = [];
  let totalRealized = 0;

  for (const pos of positions) {
    const posClean = pos.ticker.toUpperCase().replace(/[/_\s-]/g, '');
    const matches = closeAll || posClean === targetClean;
    if (!matches) {
      remaining.push(pos);
      continue;
    }

    const q = lookupTradingViewQuote(liveQuotes, pos.ticker);
    const liveSpot = q && q.price > 0 ? q.price : pos.currentPrice || pos.entryPrice;
    const digits = getAssetPriceDigits(pos.ticker, pos.market, pos.entryPrice);
    const spread = getAssetSpread(pos.ticker, pos.market, liveSpot);
    const exitPrice = pos.direction === 'LONG' ? liveSpot - spread / 2 : liveSpot + spread / 2;
    const { pnl, pnlPercent } = calculatePositionPnL(
      pos.ticker,
      pos.market,
      pos.direction,
      pos.lots,
      pos.entryPrice,
      exitPrice
    );

    balance = Math.round((balance + pnl) * 100) / 100;
    totalRealized = Math.round((totalRealized + pnl) * 100) / 100;
    closedTickers.push(pos.ticker);

    closedList.unshift({
      id: `closed-${pos.ticket}-${Date.now()}`,
      ticker: `${pos.ticker} (#${pos.ticket})`,
      direction: pos.direction,
      lots: pos.lots,
      entryPrice: pos.entryPrice,
      exitPrice: Number(exitPrice.toFixed(digits)),
      currency: pos.currency,
      pnl,
      pnlPercent,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      outcome: pnl >= 0 ? 'WIN' : 'LOSS',
      isAutoSignal: pos.isAutoSignal,
      strategy: pos.strategy,
      timeframe: pos.timeframe,
      signalId: pos.signalId,
      confidenceScore: pos.confidenceScore,
      closeReason: 'MANUAL',
      mindset: pos.mindset || 'DISCIPLINED',
      setupGrade: pos.setupGrade || 'A+',
    });

    syncRealizedTradePnlToProp(pnl);
  }

  if (closedTickers.length > 0) {
    localStorage.setItem('njia_paper_balance', balance.toString());
    localStorage.setItem('njia_paper_positions', JSON.stringify(remaining));
    localStorage.setItem('njia_paper_trades', JSON.stringify(closedList.slice(0, 200)));
    emitPaperPositionsUpdated();
    scheduleTradingCloudPush();
  }

  return {
    closedCount: closedTickers.length,
    realizedPnl: totalRealized,
    closedTickers,
  };
}

/**
 * Global background watchdog: updates live PnL across all open paper positions,
 * automatically secures 50% + moves SL to Breakeven at TP1, and executes SL/TP fills
 * directly into the Forex Journal (`njia_paper_trades`).
 */
export function evaluateOpenPaperPositionsAgainstQuotes(quotes: Record<string, LiveTvQuote>): boolean {
  if (typeof window === 'undefined' || !quotes || Object.keys(quotes).length === 0) return false;
  const positions = loadManagedPaperPositions();
  if (positions.length === 0) return false;

  let balance = parseFloat(localStorage.getItem('njia_paper_balance') || '10000') || 10000;
  const closedList = loadManagedClosedTrades();
  const nextPositions: ManagedPaperPosition[] = [];
  const alerts: PaperTradeAlertDetail[] = [];
  let changed = false;

  for (const pos of positions) {
    const session = getAssetMarketSession(pos.ticker, pos.market);
    if (!session.isOpen) {
      nextPositions.push(pos);
      continue;
    }

    const q = lookupTradingViewQuote(quotes, pos.ticker);
    if (!q || !q.price || q.price <= 0) {
      nextPositions.push(pos);
      continue;
    }

    const digits = getAssetPriceDigits(pos.ticker, pos.market, pos.entryPrice);
    const spread = getAssetSpread(pos.ticker, pos.market, q.price);
    const marketExit = Number(
      (pos.direction === 'LONG' ? q.price - spread / 2 : q.price + spread / 2).toFixed(digits)
    );
    const { pnl: livePnl, pnlPercent: livePnlPct } = calculatePositionPnL(
      pos.ticker,
      pos.market,
      pos.direction,
      pos.lots,
      pos.entryPrice,
      marketExit
    );

    // 1. Check Full SL / Full TP Hit first
    const slHit =
      typeof pos.stopLoss === 'number' &&
      pos.stopLoss > 0 &&
      (pos.direction === 'LONG' ? marketExit <= pos.stopLoss : marketExit >= pos.stopLoss);

    const tpHit =
      typeof pos.takeProfit === 'number' &&
      pos.takeProfit > 0 &&
      (pos.direction === 'LONG' ? marketExit >= pos.takeProfit : marketExit <= pos.takeProfit);

    if (slHit || tpHit) {
      changed = true;
      const fillPrice = tpHit ? pos.takeProfit! : pos.stopLoss!;
      const { pnl: realizedPnl, pnlPercent: realizedPct } = calculatePositionPnL(
        pos.ticker,
        pos.market,
        pos.direction,
        pos.lots,
        pos.entryPrice,
        fillPrice
      );

      balance = Math.round((balance + realizedPnl) * 100) / 100;
      closedList.unshift({
        id: `auto-${tpHit ? 'tp' : 'sl'}-${pos.ticket}-${Date.now()}`,
        ticker: `${pos.ticker} (#${pos.ticket} ${tpHit ? 'AUTO TP' : 'AUTO SL'})`,
        direction: pos.direction,
        lots: pos.lots,
        entryPrice: pos.entryPrice,
        exitPrice: fillPrice,
        currency: pos.currency,
        pnl: realizedPnl,
        pnlPercent: realizedPct,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        outcome: realizedPnl >= 0 ? 'WIN' : 'LOSS',
        isAutoSignal: pos.isAutoSignal,
        strategy: pos.strategy,
        timeframe: pos.timeframe,
        signalId: pos.signalId,
        confidenceScore: pos.confidenceScore,
        closeReason: tpHit ? 'TP_HIT' : 'SL_HIT',
        mindset: pos.mindset || 'DISCIPLINED',
        setupGrade: pos.setupGrade || 'A+',
      });

      syncRealizedTradePnlToProp(realizedPnl);

      const alertDetail: PaperTradeAlertDetail = {
        id: pos.id,
        ticker: pos.ticker,
        eventType: tpHit ? 'TP_HIT' : 'SL_HIT',
        direction: pos.direction,
        exitPrice: fillPrice,
        realizedPnl,
        timestamp: new Date().toISOString(),
        strategy: pos.strategy,
        timeframe: pos.timeframe,
      };
      alerts.push(alertDetail);
      emitMullahProactiveSpeech(
        tpHit
          ? `Take profit reached on ${pos.ticker} ${pos.direction}. Closed with ${realizedPnl >= 0 ? 'plus' : ''} ${realizedPnl} dollars.`
          : `Stop loss triggered on ${pos.ticker} ${pos.direction} at ${fillPrice}. Net result ${realizedPnl} dollars.`
      );
      continue;
    }

    // 2. Check TP1 Partial Scale (50%) + Move SL to Breakeven
    const tp1Target =
      typeof pos.tp1 === 'number' && pos.tp1 > 0
        ? pos.tp1
        : typeof pos.takeProfit === 'number' && pos.takeProfit > 0
        ? Number(((pos.entryPrice + pos.takeProfit) / 2).toFixed(digits))
        : undefined;

    const tp1Reached =
      !pos.isBreakEvenLocked &&
      typeof tp1Target === 'number' &&
      pos.lots >= 0.02 &&
      (pos.direction === 'LONG' ? marketExit >= tp1Target : marketExit <= tp1Target);

    if (tp1Reached) {
      changed = true;
      const closeLots = Math.max(0.01, Math.round(pos.lots * 0.5 * 100) / 100);
      const remainLots = Math.max(0.01, Math.round((pos.lots - closeLots) * 100) / 100);
      const partialPnl = Math.round(livePnl * (closeLots / pos.lots) * 100) / 100;

      balance = Math.round((balance + partialPnl) * 100) / 100;
      closedList.unshift({
        id: `auto-tp1-${pos.ticket}-${Date.now()}`,
        ticker: `${pos.ticker} (#${pos.ticket} 50% TP1)`,
        direction: pos.direction,
        lots: closeLots,
        entryPrice: pos.entryPrice,
        exitPrice: marketExit,
        currency: pos.currency,
        pnl: partialPnl,
        pnlPercent: livePnlPct,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        outcome: partialPnl >= 0 ? 'WIN' : 'LOSS',
        isAutoSignal: pos.isAutoSignal,
        strategy: pos.strategy,
        timeframe: pos.timeframe,
        signalId: pos.signalId,
        confidenceScore: pos.confidenceScore,
        closeReason: 'TP1_PARTIAL',
        mindset: pos.mindset || 'DISCIPLINED',
        setupGrade: pos.setupGrade || 'A+',
      });

      syncRealizedTradePnlToProp(partialPnl);

      const beOffset = pos.direction === 'LONG' ? spread : -spread;
      const newSl = Number((pos.entryPrice + beOffset).toFixed(digits));

      nextPositions.push({
        ...pos,
        lots: remainLots,
        currentPrice: marketExit,
        stopLoss: newSl,
        isBreakEvenLocked: true,
        pnl: Math.round(livePnl * (remainLots / pos.lots) * 100) / 100,
        pnlPercent: livePnlPct,
      });

      const alertDetail: PaperTradeAlertDetail = {
        id: `${pos.id}-tp1`,
        ticker: pos.ticker,
        eventType: 'TP1_BREAKEVEN',
        direction: pos.direction,
        exitPrice: marketExit,
        realizedPnl: partialPnl,
        timestamp: new Date().toISOString(),
        strategy: pos.strategy,
        timeframe: pos.timeframe,
      };
      alerts.push(alertDetail);
      emitMullahProactiveSpeech(
        `Target one secured on ${pos.ticker}. Banked ${partialPnl} dollars and moved stop loss to breakeven.`
      );
      continue;
    }

    // 3. Otherwise keep position updated with latest live mark
    if (Math.abs(pos.currentPrice - marketExit) > 1e-6 || Math.abs(pos.pnl - livePnl) > 0.01) {
      changed = true;
    }
    nextPositions.push({
      ...pos,
      currentPrice: marketExit,
      pnl: livePnl,
      pnlPercent: livePnlPct,
    });
  }

  if (changed) {
    try {
      localStorage.setItem('njia_paper_balance', balance.toString());
      localStorage.setItem('njia_paper_positions', JSON.stringify(nextPositions));
      localStorage.setItem('njia_paper_trades', JSON.stringify(closedList.slice(0, 200)));
      emitPaperPositionsUpdated();
      scheduleTradingCloudPush();
      alerts.forEach((detail) => {
        window.dispatchEvent(new CustomEvent<PaperTradeAlertDetail>(PAPER_TRADE_ALERT_EVENT, { detail }));
      });
    } catch {
      // ignore storage errors
    }
  }

  return changed;
}
