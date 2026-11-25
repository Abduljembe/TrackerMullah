import { emitPaperPositionsUpdated } from './portfolioGuard.ts';
import { scheduleTradingCloudPush } from './tradingCloudSync.ts';

export const BROKER_MIRROR_KEY = 'njia_broker_mirror_enabled';
export const BROKER_BRIDGE_EVENT = 'njia-broker-bridge-changed';

export interface BrokerAccountSummary {
  currency: string;
  balance: number;
  equity: number;
  unrealizedPnl: number;
  marginUsed: number;
  openTradeCount: number;
  maskedAccount: string;
  environment: string;
}

export interface BrokerOpenTrade {
  id: string;
  symbol: string;
  direction: 'LONG' | 'SHORT';
  units: number;
  openPrice: number;
  unrealizedPnl: number;
  sl?: number;
  tp?: number;
  openTime?: string;
}

export interface BrokerStatusResponse {
  success: boolean;
  activeBridge: 'oanda' | 'metaapi' | 'mt5_ea' | 'paper';
  oandaConfigured: boolean;
  oandaEnv: 'practice' | 'live';
  metaApiConfigured: boolean;
  mt5DesktopActive: boolean;
  accountSummary: BrokerAccountSummary | null;
  openTrades: BrokerOpenTrade[];
  errorDetail: string | null;
}

export function isBrokerMirrorEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(BROKER_MIRROR_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setBrokerMirrorEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(BROKER_MIRROR_KEY, enabled ? 'true' : 'false');
    window.dispatchEvent(new CustomEvent(BROKER_BRIDGE_EVENT, { detail: { enabled } }));
  } catch {
    // ignore storage errors
  }
}

export async function fetchBrokerStatus(): Promise<BrokerStatusResponse | null> {
  try {
    const resp = await fetch('/api/broker/status');
    if (!resp.ok) return null;
    return (await resp.json()) as BrokerStatusResponse;
  } catch {
    return null;
  }
}

export async function executeBrokerOrder(params: {
  symbol: string;
  direction: 'LONG' | 'SHORT' | 'BUY' | 'SELL';
  lots: number;
  sl?: number;
  tp?: number;
}): Promise<{ success: boolean; bridge?: string; ticket?: string; fillPrice?: number; message?: string; error?: string }> {
  try {
    const resp = await fetch('/api/broker/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return await resp.json();
  } catch {
    return { success: false, error: 'Network error reaching broker bridge' };
  }
}

export async function closeBrokerTrade(tradeId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const resp = await fetch('/api/broker/close', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tradeId }),
    });
    return await resp.json();
  } catch {
    return { success: false, error: 'Network error closing broker trade' };
  }
}

export async function reconcileBrokerTradesIntoJournal(): Promise<{
  importedCount: number;
  bridge: string;
}> {
  try {
    const resp = await fetch('/api/broker/closed-trades');
    if (!resp.ok) return { importedCount: 0, bridge: 'offline' };
    const data = await resp.json();
    const list: any[] = Array.isArray(data?.trades) ? data.trades : [];
    if (list.length === 0) return { importedCount: 0, bridge: String(data?.bridge || 'none') };

    const raw = localStorage.getItem('njia_paper_trades');
    const existing: any[] = raw ? JSON.parse(raw) : [];
    const seenIds = new Set<string>(existing.map((t) => String(t.signalId || t.id || '')));

    let importedCount = 0;
    const additions: any[] = [];
    for (const item of list) {
      const refId = String(item.brokerId || '');
      if (!refId || seenIds.has(refId)) continue;
      seenIds.add(refId);
      const entry = Number(item.entryPrice) || 1;
      const exit = Number(item.exitPrice) || entry;
      const pnl = Number(item.pnl) || 0;
      const pnlPct = entry > 0 ? Math.round((Math.abs(exit - entry) / entry) * 10000) / 100 : 0;

      additions.push({
        id: refId,
        ticker: String(item.ticker || 'XAUUSD'),
        direction: item.direction === 'SHORT' ? 'SHORT' : 'LONG',
        lots: Number(item.lots) || 0.01,
        entryPrice: entry,
        exitPrice: exit,
        currency: 'USD',
        pnl,
        pnlPercent: pnl >= 0 ? pnlPct : -pnlPct,
        timestamp: item.closedAt ? new Date(item.closedAt).toLocaleString() : new Date().toLocaleString(),
        outcome: pnl >= 0 ? 'WIN' : 'LOSS',
        isAutoSignal: true,
        strategy: `Broker Fill (${item.broker || 'Cloud'})`,
        signalId: refId,
        closeReason: 'MANUAL',
        mindset: 'DISCIPLINED',
        setupGrade: 'A+',
      });
      importedCount++;
    }

    if (importedCount > 0) {
      localStorage.setItem('njia_paper_trades', JSON.stringify([...additions, ...existing].slice(0, 250)));
      emitPaperPositionsUpdated();
      scheduleTradingCloudPush();
    }

    return { importedCount, bridge: String(data?.bridge || 'daemon') };
  } catch {
    return { importedCount: 0, bridge: 'error' };
  }
}
