import type { LiveTvQuote, TimeframeTechnicals } from './tradingViewSync.ts';

export interface OhlcBar {
  time?: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

function calcEma(values: number[], period: number): number[] {
  if (values.length === 0) return [];
  const k = 2 / (period + 1);
  const out: number[] = [values[0]];
  for (let i = 1; i < values.length; i++) {
    out.push(values[i] * k + out[i - 1] * (1 - k));
  }
  return out;
}

function calcRsiLast(closes: number[], period = 14): number {
  if (closes.length <= period) return 50;
  let gainSum = 0;
  let lossSum = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gainSum += diff;
    else lossSum += Math.abs(diff);
  }
  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (diff < 0 ? Math.abs(diff) : 0)) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return Number((100 - 100 / (1 + rs)).toFixed(1));
}

function calcAtrAndAdx(candles: OhlcBar[], period = 14): { atr: number; adx: number } {
  if (candles.length < period + 2) {
    const last = candles[candles.length - 1];
    return {
      atr: last ? Math.max(last.high - last.low, last.close * 0.002) : 0,
      adx: 22,
    };
  }
  const trs: number[] = [];
  const plusDMs: number[] = [];
  const minusDMs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const cur = candles[i];
    const prev = candles[i - 1];
    const tr = Math.max(cur.high - cur.low, Math.abs(cur.high - prev.close), Math.abs(cur.low - prev.close));
    const upMove = cur.high - prev.high;
    const downMove = prev.low - cur.low;
    trs.push(tr);
    plusDMs.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDMs.push(downMove > upMove && downMove > 0 ? downMove : 0);
  }
  const smooth = (arr: number[]) => {
    let val = arr.slice(0, period).reduce((a, b) => a + b, 0);
    const res: number[] = [val];
    for (let i = period; i < arr.length; i++) {
      val = val - val / period + arr[i];
      res.push(val);
    }
    return res;
  };
  const smTr = smooth(trs);
  const smPlus = smooth(plusDMs);
  const smMinus = smooth(minusDMs);
  const dxList: number[] = [];
  for (let i = 0; i < smTr.length; i++) {
    const t = smTr[i] || 1e-9;
    const pdi = (100 * smPlus[i]) / t;
    const mdi = (100 * smMinus[i]) / t;
    const denom = pdi + mdi || 1e-9;
    dxList.push((100 * Math.abs(pdi - mdi)) / denom);
  }
  const lastAtr = (smTr[smTr.length - 1] || 0) / period;
  const recentDx = dxList.slice(-period);
  const adx = recentDx.length > 0 ? recentDx.reduce((a, b) => a + b, 0) / recentDx.length : 22;
  return { atr: lastAtr, adx: Number(adx.toFixed(1)) };
}

export function computeOhlcTechnicals(candles: OhlcBar[]): TimeframeTechnicals & {
  price: number;
  high: number;
  low: number;
  open: number;
  pivotMiddle: number;
  pivotR1: number;
  pivotS1: number;
} {
  if (!candles || candles.length === 0) {
    return { price: 0, high: 0, low: 0, open: 0, pivotMiddle: 0, pivotR1: 0, pivotS1: 0 };
  }
  const closes = candles.map((c) => c.close);
  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2] || last;
  const first = candles[Math.max(0, candles.length - 12)] || last;

  const ema20Arr = calcEma(closes, 20);
  const ema50Arr = calcEma(closes, 50);
  const ema12Arr = calcEma(closes, 12);
  const ema26Arr = calcEma(closes, 26);
  const macdLineArr = ema12Arr.map((v, i) => v - ema26Arr[i]);
  const macdSigArr = calcEma(macdLineArr, 9);

  const ema20 = ema20Arr[ema20Arr.length - 1];
  const ema50 = ema50Arr[ema50Arr.length - 1];
  const macd = macdLineArr[macdLineArr.length - 1];
  const macdSignal = macdSigArr[macdSigArr.length - 1];
  const rsi = calcRsiLast(closes, 14);
  const { atr, adx } = calcAtrAndAdx(candles, 14);

  const bbWindow = closes.slice(-20);
  const bbMean = bbWindow.reduce((a, b) => a + b, 0) / Math.max(1, bbWindow.length);
  const variance = bbWindow.reduce((a, b) => a + (b - bbMean) ** 2, 0) / Math.max(1, bbWindow.length);
  const stdDev = Math.sqrt(variance);
  const bbUpper = bbMean + 2 * stdDev;
  const bbLower = bbMean - 2 * stdDev;

  const changePercent = first.close > 0 ? Number((((last.close - first.close) / first.close) * 100).toFixed(2)) : 0;

  let maScore = 0;
  maScore += last.close >= ema20 ? 0.5 : -0.5;
  maScore += ema20 >= ema50 ? 0.5 : -0.5;

  let oscScore = 0;
  if (rsi >= 55) oscScore += 0.45;
  else if (rsi <= 45) oscScore -= 0.45;
  oscScore += macd >= macdSignal ? 0.45 : -0.45;

  const recommendMa = Number(Math.max(-1, Math.min(1, maScore)).toFixed(2));
  const recommendOther = Number(Math.max(-1, Math.min(1, oscScore)).toFixed(2));
  const recommendAll = Number(((recommendMa * 0.6 + recommendOther * 0.4)).toFixed(2));

  const lookback = candles.slice(-24);
  const hi = Math.max(...lookback.map((c) => c.high));
  const lo = Math.min(...lookback.map((c) => c.low));
  const pivotMiddle = (hi + lo + prev.close) / 3;
  const pivotR1 = 2 * pivotMiddle - lo;
  const pivotS1 = 2 * pivotMiddle - hi;

  return {
    price: last.close,
    high: hi,
    low: lo,
    open: first.open,
    recommendAll,
    recommendMa,
    recommendOther,
    rsi,
    macd,
    macdSignal,
    ema20,
    ema50,
    changePercent,
    atr,
    adx,
    bbUpper,
    bbLower,
    pivotMiddle,
    pivotR1,
    pivotS1,
  };
}

const DERIV_SYMBOLS = [
  'R_75',
  'R_100',
  '1HZ75V',
  '1HZ100V',
  'R_50',
  'R_25',
  'R_10',
  'BOOM1000',
  'CRASH1000',
  'BOOM500',
  'CRASH500',
  'STP',
];

const derivCandlesCache: Record<string, Record<string, OhlcBar[]>> = {};

export function getCachedDerivCandles(symbol: string, bucket = '15'): OhlcBar[] | undefined {
  const clean = symbol.toUpperCase().replace(/[^A-Z0-9_]/g, '');
  return derivCandlesCache[clean]?.[bucket];
}

export async function fetchDerivCandlesOnce(symbol: string, granularitySec = 900, count = 65): Promise<OhlcBar[]> {
  if (typeof WebSocket === 'undefined') return [];
  const clean = symbol.toUpperCase().replace(/[^A-Z0-9_]/g, '');
  return new Promise((resolve) => {
    let settled = false;
    let ws: WebSocket | null = null;
    const finish = (bars: OhlcBar[]) => {
      if (settled) return;
      settled = true;
      try { ws?.close(); } catch {}
      resolve(bars);
    };
    const timer = setTimeout(() => finish([]), 4500);
    try {
      ws = new WebSocket('wss://ws.derivws.com/websockets/v3?app_id=1089');
      ws.onopen = () => {
        ws?.send(JSON.stringify({
          ticks_history: clean,
          adjust_start_time: 1,
          count,
          end: 'latest',
          style: 'candles',
          granularity: granularitySec,
        }));
      };
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(String(ev.data || '{}'));
          if (msg.msg_type === 'candles' && Array.isArray(msg.candles)) {
            const bars: OhlcBar[] = msg.candles.map((c: any) => ({
              time: Number(c.epoch),
              open: Number(c.open),
              high: Number(c.high),
              low: Number(c.low),
              close: Number(c.close),
            })).filter((b: OhlcBar) => b.close > 0);
            const bucket = granularitySec <= 60 ? '1' : granularitySec <= 300 ? '5' : granularitySec <= 900 ? '15' : granularitySec <= 3600 ? '60' : granularitySec <= 14400 ? '240' : '1D';
            derivCandlesCache[clean] = { ...(derivCandlesCache[clean] || {}), [bucket]: bars };
            clearTimeout(timer);
            finish(bars);
          } else if (msg.error) {
            clearTimeout(timer);
            finish([]);
          }
        } catch {
          clearTimeout(timer);
          finish([]);
        }
      };
      ws.onerror = () => {
        clearTimeout(timer);
        finish([]);
      };
    } catch {
      clearTimeout(timer);
      finish([]);
    }
  });
}

let derivStreamStarted = false;
let derivRefreshTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Starts a lightweight browser-side Deriv WS candle sampler that computes real
 * 15m + 1H indicators (EMA20/50, RSI, MACD, ADX, ATR, BB, Pivots) for 24/7
 * Synthetics and pushes them into sharedQuotesCache & /api/deriv/telemetry.
 */
export function ensureDerivTechnicalsStream(
  onQuotesReady: (quotes: Record<string, LiveTvQuote>) => void
): void {
  if (typeof window === 'undefined' || typeof WebSocket === 'undefined') return;
  if (derivStreamStarted) return;
  derivStreamStarted = true;

  const runBatch = async () => {
    try {
      const ws = new WebSocket('wss://ws.derivws.com/websockets/v3?app_id=1089');
      const bySym: Record<string, { m15?: OhlcBar[]; h1?: OhlcBar[] }> = {};
      let expected = DERIV_SYMBOLS.length * 2;

      const done = () => {
        try { ws.close(); } catch {}
        const built: Record<string, LiveTvQuote> = {};
        const nowIso = new Date().toISOString();

        for (const sym of DERIV_SYMBOLS) {
          const entry = bySym[sym];
          if (!entry?.m15?.length && !entry?.h1?.length) continue;
          const m15Tech = entry.m15?.length ? computeOhlcTechnicals(entry.m15) : null;
          const h1Tech = entry.h1?.length ? computeOhlcTechnicals(entry.h1) : null;
          const primary = m15Tech || h1Tech;
          if (!primary || !(primary.price > 0)) continue;

          const timeframeSignals: Record<string, TimeframeTechnicals> = {};
          if (m15Tech) {
            timeframeSignals['15'] = m15Tech;
            timeframeSignals['5'] = m15Tech;
          }
          if (h1Tech) {
            timeframeSignals['60'] = h1Tech;
            timeframeSignals['240'] = h1Tech;
            timeframeSignals['1D'] = h1Tech;
          }

          const q: LiveTvQuote = {
            symbol: sym,
            price: primary.price,
            changePercent: primary.changePercent ?? 0,
            changeValue: Number(((primary.price * (primary.changePercent ?? 0)) / 100).toFixed(4)),
            high: h1Tech?.high || primary.high,
            low: h1Tech?.low || primary.low,
            open: primary.open,
            time: nowIso,
            isFallback: false,
            recommendAll: primary.recommendAll,
            recommendMa: primary.recommendMa,
            recommendOther: primary.recommendOther,
            rsi: primary.rsi,
            macd: primary.macd,
            macdSignal: primary.macdSignal,
            ema20: primary.ema20,
            ema50: primary.ema50,
            atr: h1Tech?.atr || primary.atr,
            adx: primary.adx,
            bbUpper: primary.bbUpper,
            bbLower: primary.bbLower,
            pivotMiddle: h1Tech?.pivotMiddle || primary.pivotMiddle,
            pivotR1: h1Tech?.pivotR1 || primary.pivotR1,
            pivotS1: h1Tech?.pivotS1 || primary.pivotS1,
            timeframeSignals,
          };
          built[sym] = q;
        }

        if (Object.keys(built).length > 0) {
          onQuotesReady(built);
          fetch('/api/deriv/telemetry', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ quotes: built }),
          }).catch(() => {});
        }
      };

      const failTimer = setTimeout(done, 5500);

      ws.onopen = () => {
        DERIV_SYMBOLS.forEach((sym, idx) => {
          ws.send(JSON.stringify({
            ticks_history: sym,
            adjust_start_time: 1,
            count: 65,
            end: 'latest',
            style: 'candles',
            granularity: 900,
            req_id: idx * 2 + 1,
          }));
          ws.send(JSON.stringify({
            ticks_history: sym,
            adjust_start_time: 1,
            count: 65,
            end: 'latest',
            style: 'candles',
            granularity: 3600,
            req_id: idx * 2 + 2,
          }));
        });
      };

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(String(ev.data || '{}'));
          const reqId = Number(msg.req_id);
          if (reqId > 0) {
            const symIdx = Math.floor((reqId - 1) / 2);
            const isH1 = reqId % 2 === 0;
            const sym = DERIV_SYMBOLS[symIdx];
            if (sym && Array.isArray(msg.candles)) {
              const bars: OhlcBar[] = msg.candles.map((c: any) => ({
                time: Number(c.epoch),
                open: Number(c.open),
                high: Number(c.high),
                low: Number(c.low),
                close: Number(c.close),
              })).filter((b: OhlcBar) => b.close > 0);
              bySym[sym] = bySym[sym] || {};
              if (isH1) {
                bySym[sym].h1 = bars;
                derivCandlesCache[sym] = { ...(derivCandlesCache[sym] || {}), '60': bars };
              } else {
                bySym[sym].m15 = bars;
                derivCandlesCache[sym] = { ...(derivCandlesCache[sym] || {}), '15': bars };
              }
            }
          }
          expected--;
          if (expected <= 0) {
            clearTimeout(failTimer);
            done();
          }
        } catch {}
      };

      ws.onerror = () => {
        clearTimeout(failTimer);
        done();
      };
    } catch {}
  };

  runBatch();
  derivRefreshTimer = setInterval(runBatch, 30_000);
}

export function stopDerivTechnicalsStream(): void {
  if (derivRefreshTimer) {
    clearInterval(derivRefreshTimer);
    derivRefreshTimer = null;
  }
  derivStreamStarted = false;
}
