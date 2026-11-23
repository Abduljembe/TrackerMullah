import { LiveTvQuote, lookupTradingViewQuote } from './tradingViewSync.ts';
import { getAssetMarketSession } from './marketHours.ts';
import { emitPaperPositionsUpdated } from './portfolioGuard.ts';
import { syncRealizedTradePnlToProp, evaluatePropTradeBlock } from './propGuardian.ts';
import { scheduleTradingCloudPush } from './tradingCloudSync.ts';

export const PAPER_TRADE_ALERT_EVENT = 'njia-paper-trade-auto-event';
export const MULLAH_PROACTIVE_ALERT_EVENT = 'mullah-proactive-speak';

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
}

export interface PaperTradeAlertDetail {
  id: string;
  ticker: string;
  eventType: 'TP1_BREAKEVEN' | 'TP_HIT' | 'SL_HIT' | 'MANUAL_CLOSE';
  direction: 'LONG' | 'SHORT';
  exitPrice: number;
  realizedPnl: number;
  timestamp: string;
}

export function emitMullahProactiveSpeech(text: string): void {
  if (typeof window === 'undefined' || !text.trim()) return;
  window.dispatchEvent(new CustomEvent(MULLAH_PROACTIVE_ALERT_EVENT, { detail: { text } }));
}

function getContractMultiplier(ticker: string, market: string, lots: number): number {
  const upper = ticker.toUpperCase();
  if (upper.includes('XAU')) return 100 * lots;
  if (upper.includes('XAG')) return 5000 * lots;
  if (market === 'FOREX' || market === 'METALS') return 100000 * lots;
  return lots;
}

function getSpreadForSymbol(ticker: string, market: string, price: number): number {
  if (ticker.toUpperCase().includes('XAU')) return 0.35;
  if ((market === 'FOREX' || market === 'METALS') && price < 10) return 0.00018;
  return 0.05;
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
}): { ok: boolean; error?: string; position?: ManagedPaperPosition } {
  const ticker = params.ticker.toUpperCase();
  const clean = ticker.replace(/[/_\s-]/g, '');
  const market: ManagedPaperPosition['market'] =
    params.market ||
    (clean.includes('XAU') || clean.includes('XAG')
      ? 'METALS'
      : clean.includes('NAS') || clean.includes('US500') || clean.includes('WALL')
      ? 'INDICES'
      : 'FOREX');

  const session = getAssetMarketSession(ticker, market);
  if (!session.isOpen) {
    return {
      ok: false,
      error: `${ticker} market is currently closed for the weekend. No fills allowed until Sunday 22:00 UTC.`,
    };
  }

  const propCheck = evaluatePropTradeBlock();
  if (propCheck.blocked) {
    return {
      ok: false,
      error: propCheck.reason || 'Prop Firm Risk Guardian circuit breaker has locked trading.',
    };
  }

  const isGold = clean.includes('XAU');
  const digits = isGold ? 2 : (market === 'FOREX' || market === 'METALS') && params.spotPrice < 10 ? 5 : 2;
  const spread = getSpreadForSymbol(ticker, market, params.spotPrice);
  const fillPrice = Number(
    (params.direction === 'LONG' ? params.spotPrice + spread / 2 : params.spotPrice - spread / 2).toFixed(digits)
  );
  const lots = Math.max(0.01, Number(params.lots) || 0.1);
  const mult = getContractMultiplier(ticker, market, lots);
  const initialSpreadPnl = -Math.round(spread * mult * 100) / 100;
  const ticket = 98000000 + (Date.now() % 900000);

  const newPos: ManagedPaperPosition = {
    id: `pos-${ticket}`,
    ticket,
    ticker,
    name: params.name || ticker,
    currency: params.currency || 'USD',
    market,
    direction: params.direction,
    lots,
    entryPrice: fillPrice,
    currentPrice: params.spotPrice,
    stopLoss: params.stopLoss,
    tp1: params.tp1,
    takeProfit: params.takeProfit,
    pnl: initialSpreadPnl,
    pnlPercent: Math.round((-spread / fillPrice) * 10000) / 100,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    executionType: params.source || 'Market Execution',
    brokerServer: 'JustMarkets (Raw Spread / Pro)',
  };

  try {
    const existing = loadManagedPaperPositions();
    localStorage.setItem('njia_paper_positions', JSON.stringify([newPos, ...existing]));
    emitPaperPositionsUpdated();
    scheduleTradingCloudPush();
  } catch {
    return { ok: false, error: 'Failed to persist paper position locally.' };
  }

  return { ok: true, position: newPos };
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
    const spread = getSpreadForSymbol(pos.ticker, pos.market, liveSpot);
    const exitPrice = pos.direction === 'LONG' ? liveSpot - spread / 2 : liveSpot + spread / 2;
    const mult = getContractMultiplier(pos.ticker, pos.market, pos.lots);
    const diff = pos.direction === 'LONG' ? exitPrice - pos.entryPrice : pos.entryPrice - exitPrice;
    const pnl = Math.round(diff * mult * 100) / 100;
    const pnlPercent = Math.round((diff / pos.entryPrice) * 10000) / 100;

    balance = Math.round((balance + pnl) * 100) / 100;
    totalRealized = Math.round((totalRealized + pnl) * 100) / 100;
    closedTickers.push(pos.ticker);

    closedList.unshift({
      id: `closed-${pos.ticket}-${Date.now()}`,
      ticker: `${pos.ticker} (#${pos.ticket})`,
      direction: pos.direction,
      lots: pos.lots,
      entryPrice: pos.entryPrice,
      exitPrice: Number(exitPrice.toFixed(pos.entryPrice < 10 ? 5 : 2)),
      currency: pos.currency,
      pnl,
      pnlPercent,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      outcome: pnl >= 0 ? 'WIN' : 'LOSS',
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
 * automatically secures 50% + moves SL to Breakeven at TP1, and executes SL/TP fills.
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

    const digits = pos.ticker.toUpperCase().includes('XAU') ? 2 : pos.entryPrice < 10 ? 5 : 2;
    const spread = getSpreadForSymbol(pos.ticker, pos.market, q.price);
    const marketExit = Number(
      (pos.direction === 'LONG' ? q.price - spread / 2 : q.price + spread / 2).toFixed(digits)
    );
    const mult = getContractMultiplier(pos.ticker, pos.market, pos.lots);
    const diff = pos.direction === 'LONG' ? marketExit - pos.entryPrice : pos.entryPrice - marketExit;
    const livePnl = Math.round(diff * mult * 100) / 100;
    const livePnlPct = Math.round((diff / pos.entryPrice) * 10000) / 100;

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
      const closeDiff = pos.direction === 'LONG' ? fillPrice - pos.entryPrice : pos.entryPrice - fillPrice;
      const realizedPnl = Math.round(closeDiff * mult * 100) / 100;
      const realizedPct = Math.round((closeDiff / pos.entryPrice) * 10000) / 100;

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
