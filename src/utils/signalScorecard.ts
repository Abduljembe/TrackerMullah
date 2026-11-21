import { LiveTvQuote, lookupTradingViewQuote } from './tradingViewSync.ts';
import { scheduleTradingCloudPush } from './tradingCloudSync.ts';

export type TrackedSignalStatus = 'ACTIVE' | 'TP1_HIT' | 'TP2_HIT' | 'STOPPED_OUT';
export type TrackedSignalSource = 'RADAR' | 'EA_SCANNER' | 'BOT_STUDIO' | 'MANUAL';

export interface TrackedSignalRecord {
  id: string;
  symbol: string;
  market: string;
  timeframe: string;
  source: TrackedSignalSource;
  direction: 'BUY' | 'SELL';
  action: string;
  entryPrice: number;
  sl: number;
  tp1: number;
  tp2: number;
  riskReward: string;
  confidenceScore: number;
  status: TrackedSignalStatus;
  createdAt: string;
  resolvedAt?: string;
  resolvedPrice?: number;
  realizedR?: number;
}

export interface SignalHitAlertDetail {
  id: string;
  symbol: string;
  timeframe: string;
  direction: 'BUY' | 'SELL';
  status: 'TP1_HIT' | 'TP2_HIT' | 'STOPPED_OUT';
  resolvedPrice: number;
  realizedR: number;
  timestamp: string;
}

const STORAGE_KEY = 'mullah_signal_scorecard_v1';
export const SCORECARD_EVENT = 'mullah-signal-scorecard-updated';
export const SIGNAL_HIT_ALERT_EVENT = 'mullah-signal-hit-alert';

function emitScorecardUpdate() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SCORECARD_EVENT));
  }
}

function emitSignalHitAlert(detail: SignalHitAlertDetail) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<SignalHitAlertDetail>(SIGNAL_HIT_ALERT_EVENT, { detail }));
  }
}

export function loadTrackedSignals(): TrackedSignalRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveTrackedSignals(records: TrackedSignalRecord[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(0, 120)));
    emitScorecardUpdate();
    scheduleTradingCloudPush();
  } catch {
    // ignore storage quota failures
  }
}

export function recordTrackedSignal(input: {
  symbol: string;
  market: string;
  timeframe: string;
  source: TrackedSignalSource;
  direction: 'BUY' | 'SELL';
  action: string;
  entryPrice: number;
  sl: number;
  tp1: number;
  tp2: number;
  riskReward: string;
  confidenceScore: number;
}): TrackedSignalRecord | null {
  if (!input.entryPrice || !input.sl || !input.tp1 || input.entryPrice <= 0) return null;

  const cleanSym = input.symbol.trim().toUpperCase();
  const list = loadTrackedSignals();
  const nowMs = Date.now();

  // Deduplicate active signal on same symbol + timeframe + direction within 10 minutes
  const existing = list.find(
    (item) =>
      (item.status === 'ACTIVE' || item.status === 'TP1_HIT') &&
      item.symbol === cleanSym &&
      item.timeframe.toUpperCase() === input.timeframe.toUpperCase() &&
      item.direction === input.direction &&
      nowMs - new Date(item.createdAt).getTime() < 10 * 60 * 1000
  );
  if (existing) {
    return existing;
  }

  const record: TrackedSignalRecord = {
    id: `SIG-${cleanSym.replace('/', '')}-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`,
    symbol: cleanSym,
    market: input.market,
    timeframe: input.timeframe,
    source: input.source,
    direction: input.direction,
    action: input.action,
    entryPrice: input.entryPrice,
    sl: input.sl,
    tp1: input.tp1,
    tp2: input.tp2,
    riskReward: input.riskReward,
    confidenceScore: input.confidenceScore,
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
  };

  saveTrackedSignals([record, ...list]);
  return record;
}

export function evaluateTrackedSignalsAgainstQuotes(
  quotes: Record<string, LiveTvQuote>
): boolean {
  if (!quotes || Object.keys(quotes).length === 0) return false;
  const list = loadTrackedSignals();
  if (list.length === 0) return false;

  let changed = false;
  const nowIso = new Date().toISOString();
  const alertsToEmit: SignalHitAlertDetail[] = [];

  const updated = list.map((rec) => {
    if (rec.status === 'TP2_HIT' || rec.status === 'STOPPED_OUT') {
      return rec;
    }

    const q = lookupTradingViewQuote(quotes, rec.symbol);
    if (!q || !(q.price > 0)) return rec;

    const live = q.price;
    const riskDist = Math.abs(rec.entryPrice - rec.sl);
    if (riskDist <= 0) return rec;

    if (rec.direction === 'BUY') {
      if (live >= rec.tp2) {
        changed = true;
        const rVal = Number((Math.abs(rec.tp2 - rec.entryPrice) / riskDist).toFixed(2));
        alertsToEmit.push({
          id: rec.id,
          symbol: rec.symbol,
          timeframe: rec.timeframe,
          direction: rec.direction,
          status: 'TP2_HIT',
          resolvedPrice: live,
          realizedR: rVal,
          timestamp: nowIso,
        });
        return {
          ...rec,
          status: 'TP2_HIT' as const,
          resolvedAt: nowIso,
          resolvedPrice: live,
          realizedR: rVal,
        };
      }
      if (live >= rec.tp1 && rec.status === 'ACTIVE') {
        changed = true;
        const rVal = Number((Math.abs(rec.tp1 - rec.entryPrice) / riskDist).toFixed(2));
        alertsToEmit.push({
          id: rec.id,
          symbol: rec.symbol,
          timeframe: rec.timeframe,
          direction: rec.direction,
          status: 'TP1_HIT',
          resolvedPrice: live,
          realizedR: rVal,
          timestamp: nowIso,
        });
        return {
          ...rec,
          status: 'TP1_HIT' as const,
          resolvedAt: nowIso,
          resolvedPrice: live,
          realizedR: rVal,
        };
      }
      if (live <= rec.sl) {
        changed = true;
        const rVal =
          rec.status === 'TP1_HIT'
            ? Number(((Math.abs(rec.tp1 - rec.entryPrice) / riskDist) * 0.5).toFixed(2))
            : -1.0;
        if (rec.status !== 'TP1_HIT') {
          alertsToEmit.push({
            id: rec.id,
            symbol: rec.symbol,
            timeframe: rec.timeframe,
            direction: rec.direction,
            status: 'STOPPED_OUT',
            resolvedPrice: live,
            realizedR: rVal,
            timestamp: nowIso,
          });
        }
        return {
          ...rec,
          status: rec.status === 'TP1_HIT' ? ('TP1_HIT' as const) : ('STOPPED_OUT' as const),
          resolvedAt: nowIso,
          resolvedPrice: live,
          realizedR: rVal,
        };
      }
    } else {
      // SELL
      if (live <= rec.tp2) {
        changed = true;
        const rVal = Number((Math.abs(rec.entryPrice - rec.tp2) / riskDist).toFixed(2));
        alertsToEmit.push({
          id: rec.id,
          symbol: rec.symbol,
          timeframe: rec.timeframe,
          direction: rec.direction,
          status: 'TP2_HIT',
          resolvedPrice: live,
          realizedR: rVal,
          timestamp: nowIso,
        });
        return {
          ...rec,
          status: 'TP2_HIT' as const,
          resolvedAt: nowIso,
          resolvedPrice: live,
          realizedR: rVal,
        };
      }
      if (live <= rec.tp1 && rec.status === 'ACTIVE') {
        changed = true;
        const rVal = Number((Math.abs(rec.entryPrice - rec.tp1) / riskDist).toFixed(2));
        alertsToEmit.push({
          id: rec.id,
          symbol: rec.symbol,
          timeframe: rec.timeframe,
          direction: rec.direction,
          status: 'TP1_HIT',
          resolvedPrice: live,
          realizedR: rVal,
          timestamp: nowIso,
        });
        return {
          ...rec,
          status: 'TP1_HIT' as const,
          resolvedAt: nowIso,
          resolvedPrice: live,
          realizedR: rVal,
        };
      }
      if (live >= rec.sl) {
        changed = true;
        const rVal =
          rec.status === 'TP1_HIT'
            ? Number(((Math.abs(rec.entryPrice - rec.tp1) / riskDist) * 0.5).toFixed(2))
            : -1.0;
        if (rec.status !== 'TP1_HIT') {
          alertsToEmit.push({
            id: rec.id,
            symbol: rec.symbol,
            timeframe: rec.timeframe,
            direction: rec.direction,
            status: 'STOPPED_OUT',
            resolvedPrice: live,
            realizedR: rVal,
            timestamp: nowIso,
          });
        }
        return {
          ...rec,
          status: rec.status === 'TP1_HIT' ? ('TP1_HIT' as const) : ('STOPPED_OUT' as const),
          resolvedAt: nowIso,
          resolvedPrice: live,
          realizedR: rVal,
        };
      }
    }

    return rec;
  });

  if (changed) {
    saveTrackedSignals(updated);
    alertsToEmit.forEach((alert) => emitSignalHitAlert(alert));
  }
  return changed;
}

export function deleteTrackedSignal(id: string): void {
  const list = loadTrackedSignals().filter((r) => r.id !== id);
  saveTrackedSignals(list);
}

export function clearTrackedSignals(mode: 'RESOLVED' | 'ALL'): void {
  if (mode === 'ALL') {
    saveTrackedSignals([]);
    return;
  }
  const activeOnly = loadTrackedSignals().filter((r) => r.status === 'ACTIVE');
  saveTrackedSignals(activeOnly);
}

export async function dispatchSignalWebhook(payload: {
  symbol: string;
  action: string;
  timeframe: string;
  entryZone: string | number;
  sl: string | number;
  tp1: string | number;
  tp2: string | number;
  riskReward: string;
  confidenceScore: number;
}): Promise<{ ok: boolean; channels: string[]; copiedOnly?: boolean }> {
  const isBuy = payload.action.toUpperCase().includes('BUY');
  const message = `⚡️ *INSTITUTIONAL SIGNAL ALERT* ⚡️
━━━━━━━━━━━━━━━━━━
🎯 *ASSET:* #${payload.symbol.replace('/', '')} (${payload.timeframe})
📊 *ACTION:* ${isBuy ? '🟢' : '🔴'} ${payload.action} (${payload.confidenceScore}% Conviction)
📍 *ENTRY:* \`${payload.entryZone}\`
🛑 *STOP LOSS:* \`${payload.sl}\`
🎯 *TP1:* \`${payload.tp1}\`
🚀 *TP2:* \`${payload.tp2}\`
⚖️ *R:R:* \`${payload.riskReward}\`
━━━━━━━━━━━━━━━━━━
⏱ ${new Date().toUTCString()}`;

  const tgToken = localStorage.getItem('mullah_tg_token') || '';
  const tgChatId = localStorage.getItem('mullah_tg_chat_id') || '';
  const discordUrl = localStorage.getItem('mullah_discord_webhook') || '';
  const channels: string[] = [];

  if (tgToken && tgChatId) {
    try {
      const r = await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: tgChatId,
          text: message,
          parse_mode: 'Markdown',
        }),
      });
      if (r.ok) channels.push('Telegram');
    } catch {
      // ignore network block
    }
  }

  if (discordUrl) {
    try {
      const r = await fetch(discordUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: message }),
      });
      if (r.ok) channels.push('Discord');
    } catch {
      // ignore network block
    }
  }

  try {
    await navigator.clipboard.writeText(message);
  } catch {
    // ignore clipboard fallback
  }

  return {
    ok: true,
    channels,
    copiedOnly: channels.length === 0,
  };
}
