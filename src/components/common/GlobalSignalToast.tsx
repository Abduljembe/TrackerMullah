import React, { useEffect, useState, useCallback } from 'react';
import { Sparkles, CheckCircle2, ShieldAlert, X, ArrowUpRight, Target } from 'lucide-react';
import { useTradingViewQuotes } from '../../utils/tradingViewSync.ts';
import {
  evaluateTrackedSignalsAgainstQuotes,
  SIGNAL_HIT_ALERT_EVENT,
  SignalHitAlertDetail,
} from '../../utils/signalScorecard.ts';
import { useFinance } from '../../context/FinanceContext.tsx';

interface ToastItem extends SignalHitAlertDetail {
  toastId: string;
}

function playGlobalHitChime(status: SignalHitAlertDetail['status']) {
  if (typeof window === 'undefined') return;
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof window.AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    if (status === 'TP2_HIT' || status === 'TP1_HIT') {
      const notes = status === 'TP2_HIT' ? [523.25, 659.25, 783.99, 1046.5] : [523.25, 659.25, 783.99];
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

  // Globally evaluate active tracked signals on live TradingView ticks from any page
  useEffect(() => {
    if (!liveTvQuotes || Object.keys(liveTvQuotes).length === 0) return;
    evaluateTrackedSignalsAgainstQuotes(liveTvQuotes);
  }, [liveTvQuotes]);

  const dismissToast = useCallback((toastId: string) => {
    setToasts((prev) => prev.filter((t) => t.toastId !== toastId));
  }, []);

  useEffect(() => {
    const handler = (evt: Event) => {
      const detail = (evt as CustomEvent<SignalHitAlertDetail>).detail;
      if (!detail || !detail.symbol) return;

      const toastId = `${detail.id}-${detail.status}-${Date.now()}`;
      playGlobalHitChime(detail.status);

      setToasts((prev) => [{ ...detail, toastId }, ...prev].slice(0, 4));
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.toastId !== toastId));
      }, 12000);
    };

    window.addEventListener(SIGNAL_HIT_ALERT_EVENT, handler);
    return () => window.removeEventListener(SIGNAL_HIT_ALERT_EVENT, handler);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-24 right-4 z-40 flex flex-col gap-2.5 max-w-sm w-[calc(100vw-2rem)] pointer-events-none">
      {toasts.map((item) => {
        const isTp2 = item.status === 'TP2_HIT';
        const isTp1 = item.status === 'TP1_HIT';
        const isWin = isTp1 || isTp2;

        return (
          <div
            key={item.toastId}
            className={`pointer-events-auto rounded-2xl border p-3.5 shadow-2xl backdrop-blur-md transition-all animate-in fade-in slide-in-from-bottom-3 ${
              isTp2
                ? 'bg-[#061e17]/95 border-emerald-400/60 shadow-emerald-950/60'
                : isTp1
                ? 'bg-[#071a20]/95 border-[#0df2c9]/50 shadow-teal-950/60'
                : 'bg-[#1c0910]/95 border-rose-500/50 shadow-rose-950/60'
            }`}
          >
            <div className="flex items-start justify-between gap-2.5">
              <div className="flex items-start gap-2.5 min-w-0">
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                    isTp2
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : isTp1
                      ? 'bg-teal-500/20 text-[#0df2c9] border border-teal-500/40'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  }`}
                >
                  {isTp2 ? (
                    <Sparkles className="w-4 h-4" />
                  ) : isTp1 ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <ShieldAlert className="w-4 h-4" />
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={`text-[10px] font-mono font-black uppercase px-1.5 py-0.5 rounded ${
                        isWin
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-rose-500/20 text-rose-300'
                      }`}
                    >
                      {isTp2 ? 'TP2 TARGET HIT' : isTp1 ? 'TP1 SECURED' : 'STOPPED OUT'}
                    </span>
                    <span className="text-xs font-mono font-bold text-white">
                      {item.symbol} ({item.timeframe})
                    </span>
                  </div>

                  <div className="text-[11px] font-mono text-slate-300 mt-1">
                    {item.direction} @{' '}
                    <strong className="text-white">
                      {item.resolvedPrice < 10
                        ? item.resolvedPrice.toFixed(5)
                        : item.resolvedPrice.toFixed(2)}
                    </strong>{' '}
                    •{' '}
                    <strong className={isWin ? 'text-[#0df2c9]' : 'text-rose-400'}>
                      {item.realizedR >= 0 ? `+${item.realizedR}R` : `${item.realizedR}R`}
                    </strong>
                  </div>

                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('stocks');
                        dismissToast(item.toastId);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-[#0d182b] hover:bg-[#142542] border border-teal-500/35 text-[10px] font-mono font-bold text-[#0df2c9] inline-flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Target className="w-3 h-3" />
                      <span>Open Scorecard</span>
                      <ArrowUpRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => dismissToast(item.toastId)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                aria-label="Dismiss alert"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
