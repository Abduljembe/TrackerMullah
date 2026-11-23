import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Sparkles, CheckCircle2, ShieldAlert, X, ArrowUpRight } from 'lucide-react';
import { useTradingViewQuotes, lookupTradingViewQuote } from '../../utils/tradingViewSync.ts';
import {
  evaluateTrackedSignalsAgainstQuotes,
  SIGNAL_HIT_ALERT_EVENT,
  SignalHitAlertDetail,
} from '../../utils/signalScorecard.ts';
import {
  evaluateOpenPaperPositionsAgainstQuotes,
  PAPER_TRADE_ALERT_EVENT,
  PaperTradeAlertDetail,
  emitMullahProactiveSpeech,
} from '../../utils/paperTradeManager.ts';
import { fetchSharedCalendarEvents } from '../../utils/newsGuard.ts';
import { useFinance } from '../../context/FinanceContext.tsx';

interface ToastItem {
  toastId: string;
  symbol: string;
  timeframe: string;
  direction: string;
  badgeText: string;
  isWin: boolean;
  isTp2?: boolean;
  priceText: string;
  outcomeText: string;
}

function playGlobalHitChime(isWin: boolean, isTp2 = false) {
  if (typeof window === 'undefined') return;
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof window.AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    if (isWin) {
      const notes = isTp2 ? [523.25, 659.25, 783.99, 1046.5] : [523.25, 659.25, 783.99];
      notes.forEach((freq, idx) => {
        const start = ctx.currentTime + idx * 0.08;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.09, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.23);
      });
    } else {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(340, now);
      osc.frequency.exponentialRampToValueAtTime(210, now + 0.22);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.25);
    }
  } catch {
    // Ignore audio autoplay blocks cleanly
  }
}

export const GlobalSignalToast: React.FC = () => {
  const { setActiveTab } = useFinance();
  const liveTvQuotes = useTradingViewQuotes(4000);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const warnedNewsIdsRef = useRef<Set<string>>(new Set());

  // Globally evaluate active tracked signals, open paper trades, and user price alerts on live TradingView ticks
  useEffect(() => {
    if (!liveTvQuotes || Object.keys(liveTvQuotes).length === 0) return;
    evaluateTrackedSignalsAgainstQuotes(liveTvQuotes);
    evaluateOpenPaperPositionsAgainstQuotes(liveTvQuotes);

    try {
      const rawAlerts = localStorage.getItem('njia_price_alerts');
      if (rawAlerts) {
        const parsed = JSON.parse(rawAlerts);
        if (Array.isArray(parsed)) {
          let changed = false;
          const updated = parsed.map((al) => {
            if (!al || !al.isActive || al.isTriggered) return al;
            const q = lookupTradingViewQuote(liveTvQuotes, String(al.ticker || ''));
            if (!q || !(q.price > 0)) return al;
            const hit =
              al.condition === 'ABOVE'
                ? q.price >= Number(al.targetPrice)
                : q.price <= Number(al.targetPrice);
            if (!hit) return al;
            changed = true;
            const priceLabel = q.price < 10 ? q.price.toFixed(4) : q.price.toFixed(2);
            emitMullahProactiveSpeech(
              `Price alert triggered: ${al.ticker} crossed ${al.condition.toLowerCase()} ${al.targetPrice}. Current price is ${priceLabel}.`
            );
            return {
              ...al,
              isTriggered: true,
              isActive: false,
              triggeredAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            };
          });
          if (changed) {
            localStorage.setItem('njia_price_alerts', JSON.stringify(updated));
          }
        }
      }
    } catch {
      // ignore malformed alert storage
    }
  }, [liveTvQuotes]);

  // Proactive Red-Folder News Watcher (speaks alert 15 mins before high-impact news)
  useEffect(() => {
    let active = true;
    const checkNews = async () => {
      try {
        const events = await fetchSharedCalendarEvents();
        if (!active) return;
        const now = Date.now();
        for (const ev of events) {
          if (!ev.isoDate || String(ev.impact || '').toUpperCase() !== 'HIGH') continue;
          const evMs = new Date(ev.isoDate).getTime();
          if (Number.isNaN(evMs)) continue;
          const minsAway = Math.round((evMs - now) / 60000);
          if (minsAway > 0 && minsAway <= 15 && !warnedNewsIdsRef.current.has(ev.id)) {
            warnedNewsIdsRef.current.add(ev.id);
            emitMullahProactiveSpeech(
              `Macro news alert: High impact ${ev.currency} ${ev.title} releases in ${minsAway} minute${minsAway === 1 ? '' : 's'}. Exercise caution on related pairs.`
            );
            break;
          }
        }
      } catch {
        // ignore calendar fetch errors
      }
    };
    checkNews();
    const timer = setInterval(checkNews, 60000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  const dismissToast = useCallback((toastId: string) => {
    setToasts((prev) => prev.filter((t) => t.toastId !== toastId));
  }, []);

  const pushToast = useCallback((item: ToastItem) => {
    playGlobalHitChime(item.isWin, item.isTp2);
    setToasts((prev) => [item, ...prev].slice(0, 4));
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.toastId !== item.toastId));
    }, 12000);
  }, []);

  useEffect(() => {
    const onSignalHit = (evt: Event) => {
      const detail = (evt as CustomEvent<SignalHitAlertDetail>).detail;
      if (!detail || !detail.symbol) return;

      const isTp2 = detail.status === 'TP2_HIT';
      const isTp1 = detail.status === 'TP1_HIT';
      const isWin = isTp1 || isTp2;
      const priceText = detail.resolvedPrice < 10 ? detail.resolvedPrice.toFixed(5) : detail.resolvedPrice.toFixed(2);
      const badgeText = isTp2 ? 'TP2 TARGET HIT' : isTp1 ? 'TP1 SECURED' : 'STOPPED OUT';

      pushToast({
        toastId: `${detail.id}-${detail.status}-${Date.now()}`,
        symbol: detail.symbol,
        timeframe: detail.timeframe,
        direction: detail.direction,
        badgeText,
        isWin,
        isTp2,
        priceText,
        outcomeText: detail.realizedR >= 0 ? `+${detail.realizedR}R` : `${detail.realizedR}R`,
      });

      emitMullahProactiveSpeech(
        isWin
          ? `Signal update: ${detail.symbol} ${detail.direction} hit ${isTp2 ? 'target two' : 'target one'} at ${priceText}, locking in ${detail.realizedR} R.`
          : `Signal alert: ${detail.symbol} ${detail.direction} stopped out at ${priceText}.`
      );
    };

    const onPaperTradeEvent = (evt: Event) => {
      const detail = (evt as CustomEvent<PaperTradeAlertDetail>).detail;
      if (!detail || !detail.ticker) return;
      const isWin = detail.realizedPnl >= 0;
      const isTp2 = detail.eventType === 'TP_HIT';
      const badgeText =
        detail.eventType === 'TP1_BREAKEVEN'
          ? '50% TP1 + BE LOCKED'
          : detail.eventType === 'TP_HIT'
          ? 'PAPER TP FILLED'
          : 'PAPER SL FILLED';
      const priceText = detail.exitPrice < 10 ? detail.exitPrice.toFixed(5) : detail.exitPrice.toFixed(2);

      pushToast({
        toastId: `paper-${detail.id}-${detail.eventType}-${Date.now()}`,
        symbol: detail.ticker,
        timeframe: 'AUTO',
        direction: detail.direction,
        badgeText,
        isWin,
        isTp2,
        priceText,
        outcomeText: `${detail.realizedPnl >= 0 ? '+' : ''}$${detail.realizedPnl}`,
      });
    };

    window.addEventListener(SIGNAL_HIT_ALERT_EVENT, onSignalHit);
    window.addEventListener(PAPER_TRADE_ALERT_EVENT, onPaperTradeEvent);
    return () => {
      window.removeEventListener(SIGNAL_HIT_ALERT_EVENT, onSignalHit);
      window.removeEventListener(PAPER_TRADE_ALERT_EVENT, onPaperTradeEvent);
    };
  }, [pushToast]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-24 right-4 z-40 flex flex-col gap-2.5 max-w-sm w-[calc(100vw-2rem)] pointer-events-none">
      {toasts.map((item) => (
        <div
          key={item.toastId}
          className={`pointer-events-auto rounded-2xl border p-3.5 shadow-2xl backdrop-blur-md transition-all animate-in fade-in slide-in-from-bottom-3 ${
            item.isTp2
              ? 'bg-[#061e17]/95 border-emerald-400/60 shadow-emerald-950/60'
              : item.isWin
              ? 'bg-[#071a20]/95 border-[#0df2c9]/50 shadow-teal-950/60'
              : 'bg-[#1c0910]/95 border-rose-500/50 shadow-rose-950/60'
          }`}
        >
          <div className="flex items-start justify-between gap-2.5">
            <div className="flex items-start gap-2.5 min-w-0">
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                  item.isTp2
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : item.isWin
                    ? 'bg-teal-500/20 text-[#0df2c9] border border-teal-500/40'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                }`}
              >
                {item.isTp2 ? (
                  <Sparkles className="w-4 h-4" />
                ) : item.isWin ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <ShieldAlert className="w-4 h-4" />
                )}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span
                    className={`text-[10px] font-mono font-black uppercase px-1.5 py-0.5 rounded ${
                      item.isWin
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-rose-500/20 text-rose-300'
                    }`}
                  >
                    {item.badgeText}
                  </span>
                  <span className="text-xs font-mono font-bold text-white">
                    {item.symbol} ({item.timeframe})
                  </span>
                </div>

                <div className="text-[11px] font-mono text-slate-300 mt-1">
                  {item.direction} @ <strong className="text-white">{item.priceText}</strong> •{' '}
                  <strong className={item.isWin ? 'text-[#0df2c9]' : 'text-rose-400'}>
                    {item.outcomeText}
                  </strong>
                </div>

                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('stocks');
                      dismissToast(item.toastId);
                    }}
                    className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-[#0df2c9] hover:text-white cursor-pointer"
                  >
                    <span>View Trading Radar</span>
                    <ArrowUpRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => dismissToast(item.toastId)}
              aria-label="Dismiss notification"
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 cursor-pointer shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
