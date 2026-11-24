import React, { useMemo, useState, useEffect } from 'react';
import {
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  TrendingUp,
  TrendingDown,
  Shield,
  Award,
} from 'lucide-react';
import { Candle, Timeframe, generateCandles } from '../../utils/stockCandles.ts';

interface ChartReplayTrainerDeskProps {
  currentTicker: string;
  currentPrice: number;
  timeframe: Timeframe;
}

interface ReplayTrade {
  side: 'LONG' | 'SHORT';
  entry: number;
  sl: number;
  tp: number;
  lots: number;
  breakEvenMoved: boolean;
}

interface ReplayResult {
  id: string;
  side: 'LONG' | 'SHORT';
  entry: number;
  exit: number;
  pnl: number;
  reason: string;
}

export const ChartReplayTrainerDesk: React.FC<ChartReplayTrainerDeskProps> = ({
  currentTicker,
  currentPrice,
  timeframe,
}) => {
  const isGold = currentTicker.includes('XAU');
  const isJpy = currentTicker.includes('JPY');
  const isIndex = currentTicker.includes('NAS') || currentTicker.includes('US30') || currentTicker.includes('SPX');
  const digits = isJpy ? 3 : isGold || isIndex || currentPrice >= 20 ? 2 : 5;
  const pipStep = isGold ? 0.1 : isJpy ? 0.01 : isIndex ? 1 : currentPrice < 10 ? 0.0001 : 0.01;
  const contractMult = isGold ? 100 : isIndex ? 10 : isJpy ? 1000 : 100000;

  const fallbackSeries = useMemo(
    () =>
      generateCandles(
        `${currentTicker}-replay-${timeframe}`,
        currentPrice,
        currentPrice * 0.004,
        timeframe
      ),
    [currentTicker, currentPrice, timeframe]
  );

  const [liveSeries, setLiveSeries] = useState<Candle[] | null>(null);
  const [feedProvider, setFeedProvider] = useState<string>('loading');

  useEffect(() => {
    let cancelled = false;
    setFeedProvider('loading');
    fetch(
      `/api/stocks/history?ticker=${encodeURIComponent(currentTicker)}&timeframe=${encodeURIComponent(timeframe)}`
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (data?.success && Array.isArray(data.candles) && data.candles.length >= 20) {
          setLiveSeries(data.candles);
          setFeedProvider(data.provider || 'yahoo_finance');
        } else {
          setLiveSeries(null);
          setFeedProvider('anchored_fallback');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLiveSeries(null);
          setFeedProvider('anchored_fallback');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentTicker, timeframe]);

  const fullSeries = liveSeries && liveSeries.length >= 20 ? liveSeries : fallbackSeries;
  const initialReveal = Math.min(35, Math.max(15, Math.floor(fullSeries.length * 0.45)));

  const [revealCount, setRevealCount] = useState<number>(initialReveal);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [speedMs, setSpeedMs] = useState<number>(750);

  const [replayLots, setReplayLots] = useState<number>(0.1);
  const [slPips, setSlPips] = useState<number>(isGold ? 35 : isIndex ? 45 : 20);
  const [tpPips, setTpPips] = useState<number>(isGold ? 75 : isIndex ? 90 : 45);
  const [activeTrade, setActiveTrade] = useState<ReplayTrade | null>(null);
  const [replayBalance, setReplayBalance] = useState<number>(10000);
  const [history, setHistory] = useState<ReplayResult[]>([]);

  // Reset cleanly when asset or timeframe changes
  useEffect(() => {
    setIsPlaying(false);
    setRevealCount(Math.min(35, Math.max(15, Math.floor(fullSeries.length * 0.45))));
    setActiveTrade(null);
  }, [currentTicker, timeframe, fullSeries.length]);

  const visibleCandles = useMemo(
    () => fullSeries.slice(0, Math.min(fullSeries.length, revealCount)),
    [fullSeries, revealCount]
  );

  const latestBar = visibleCandles[visibleCandles.length - 1] || fullSeries[0];

  const evaluateCandleAgainstTrade = (bar: Candle, trade: ReplayTrade): ReplayResult | null => {
    if (trade.side === 'LONG') {
      if (bar.low <= trade.sl) {
        const pnl = (trade.sl - trade.entry) * contractMult * trade.lots;
        return {
          id: `rep-${Date.now()}`,
          side: 'LONG',
          entry: trade.entry,
          exit: trade.sl,
          pnl: Number(pnl.toFixed(2)),
          reason: trade.breakEvenMoved ? 'Break-Even Stop' : 'Stop Loss Hit',
        };
      }
      if (bar.high >= trade.tp) {
        const pnl = (trade.tp - trade.entry) * contractMult * trade.lots;
        return {
          id: `rep-${Date.now()}`,
          side: 'LONG',
          entry: trade.entry,
          exit: trade.tp,
          pnl: Number(pnl.toFixed(2)),
          reason: 'Take Profit Hit',
        };
      }
    } else {
      if (bar.high >= trade.sl) {
        const pnl = (trade.entry - trade.sl) * contractMult * trade.lots;
        return {
          id: `rep-${Date.now()}`,
          side: 'SHORT',
          entry: trade.entry,
          exit: trade.sl,
          pnl: Number(pnl.toFixed(2)),
          reason: trade.breakEvenMoved ? 'Break-Even Stop' : 'Stop Loss Hit',
        };
      }
      if (bar.low <= trade.tp) {
        const pnl = (trade.entry - trade.tp) * contractMult * trade.lots;
        return {
          id: `rep-${Date.now()}`,
          side: 'SHORT',
          entry: trade.entry,
          exit: trade.tp,
          pnl: Number(pnl.toFixed(2)),
          reason: 'Take Profit Hit',
        };
      }
    }
    return null;
  };

  const stepForward = (bars = 1) => {
    setRevealCount((prev) => {
      const next = Math.min(fullSeries.length, prev + bars);
      if (next === fullSeries.length) setIsPlaying(false);

      if (activeTrade && next > prev) {
        for (let idx = prev; idx < next; idx++) {
          const bar = fullSeries[idx];
          if (!bar) break;
          const closed = evaluateCandleAgainstTrade(bar, activeTrade);
          if (closed) {
            setActiveTrade(null);
            setReplayBalance((b) => Number((b + closed.pnl).toFixed(2)));
            setHistory((h) => [closed, ...h]);
            break;
          }
        }
      }
      return next;
    });
  };

  useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(() => {
      stepForward(1);
    }, speedMs);
    return () => clearInterval(timer);
  });

  const openReplayOrder = (side: 'LONG' | 'SHORT') => {
    if (!latestBar || activeTrade) return;
    const entry = latestBar.close;
    const slDist = slPips * pipStep;
    const tpDist = tpPips * pipStep;
    setActiveTrade({
      side,
      entry,
      sl: Number((side === 'LONG' ? entry - slDist : entry + slDist).toFixed(digits)),
      tp: Number((side === 'LONG' ? entry + tpDist : entry - tpDist).toFixed(digits)),
      lots: replayLots,
      breakEvenMoved: false,
    });
  };

  const moveBreakEven = () => {
    if (!activeTrade) return;
    setActiveTrade({
      ...activeTrade,
      sl: activeTrade.entry,
      breakEvenMoved: true,
    });
  };

  const closeAtCurrentBar = () => {
    if (!activeTrade || !latestBar) return;
    const diff =
      activeTrade.side === 'LONG'
        ? latestBar.close - activeTrade.entry
        : activeTrade.entry - latestBar.close;
    const pnl = Number((diff * contractMult * activeTrade.lots).toFixed(2));
    setReplayBalance((b) => Number((b + pnl).toFixed(2)));
    setHistory((h) => [
      {
        id: `rep-${Date.now()}`,
        side: activeTrade.side,
        entry: activeTrade.entry,
        exit: latestBar.close,
        pnl,
        reason: 'Manual Exit',
      },
      ...h,
    ]);
    setActiveTrade(null);
  };

  const resetReplay = () => {
    setIsPlaying(false);
    setRevealCount(initialReveal);
    setActiveTrade(null);
    setReplayBalance(10000);
    setHistory([]);
  };

  const floatingPnl = useMemo(() => {
    if (!activeTrade || !latestBar) return 0;
    const diff =
      activeTrade.side === 'LONG'
        ? latestBar.close - activeTrade.entry
        : activeTrade.entry - latestBar.close;
    return Number((diff * contractMult * activeTrade.lots).toFixed(2));
  }, [activeTrade, latestBar, contractMult]);

  const chartMin = useMemo(() => {
    const lows = visibleCandles.map((c) => c.low);
    if (activeTrade) lows.push(activeTrade.sl, activeTrade.tp);
    const minVal = Math.min(...lows);
    return minVal - (latestBar ? latestBar.close * 0.001 : 0.001);
  }, [visibleCandles, activeTrade, latestBar]);

  const chartMax = useMemo(() => {
    const highs = visibleCandles.map((c) => c.high);
    if (activeTrade) highs.push(activeTrade.sl, activeTrade.tp);
    const maxVal = Math.max(...highs);
    return maxVal + (latestBar ? latestBar.close * 0.001 : 0.001);
  }, [visibleCandles, activeTrade, latestBar]);

  const svgW = 760;
  const svgH = 260;
  const padX = 16;
  const padY = 18;
  const priceSpan = Math.max(chartMax - chartMin, pipStep * 5);
  const toY = (p: number) =>
    svgH - padY - ((p - chartMin) / priceSpan) * (svgH - padY * 2);

  const slotCount = Math.max(visibleCandles.length + 6, 36);
  const barStep = (svgW - padX * 2) / slotCount;
  const candleW = Math.max(3, Math.min(10, barStep * 0.6));

  const winCount = history.filter((t) => t.pnl > 0).length;
  const replayWinRate = history.length > 0 ? Math.round((winCount / history.length) * 100) : 0;

  const providerLabel =
    feedProvider === 'binance_spot'
      ? 'Binance Live Historical OHLC'
      : feedProvider === 'yahoo_finance'
      ? 'Yahoo Finance Live Historical OHLC'
      : feedProvider === 'loading'
      ? 'Fetching historical OHLC...'
      : 'Price-Anchored Fallback Series';

  return (
    <div className="rounded-2xl bg-[#090e1a] border border-[#162540] p-5 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#141f33] pb-4">
        <div>
          <div className="flex flex-wrap items-baseline gap-2">
            <h3 className="text-base font-bold text-white">
              Bar-by-Bar Chart Replay &amp; Execution Trainer
            </h3>
            <span className="text-[11px] font-mono text-[#0df2c9]">{providerLabel}</span>
          </div>
          <p className="text-xs text-slate-400">
            Practice {currentTicker} ({timeframe}) entries with future candles hidden · {revealCount}/{fullSeries.length} bars revealed
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
          <span className="text-slate-300">
            Replay Equity:{' '}
            <strong className="text-white">${(replayBalance + floatingPnl).toFixed(2)}</strong>
          </span>
          {history.length > 0 && (
            <span className="text-emerald-400">
              {winCount}W/{history.length - winCount}L ({replayWinRate}%)
            </span>
          )}
        </div>
      </div>

      {/* Interactive Replay Chart Viewport */}
      <div className="rounded-xl bg-[#060b14] border border-[#162540] p-3">
        <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-64 block">
          {[0.2, 0.4, 0.6, 0.8].map((ratio) => (
            <line
              key={ratio}
              x1={padX}
              y1={svgH * ratio}
              x2={svgW - padX}
              y2={svgH * ratio}
              stroke="#122038"
              strokeDasharray="3 3"
            />
          ))}

          {activeTrade && (
            <>
              <line
                x1={padX}
                y1={toY(activeTrade.tp)}
                x2={svgW - padX}
                y2={toY(activeTrade.tp)}
                stroke="#10b981"
                strokeWidth="1.2"
                strokeDasharray="4 3"
              />
              <line
                x1={padX}
                y1={toY(activeTrade.entry)}
                x2={svgW - padX}
                y2={toY(activeTrade.entry)}
                stroke="#0df2c9"
                strokeWidth="1.2"
                strokeDasharray="3 3"
              />
              <line
                x1={padX}
                y1={toY(activeTrade.sl)}
                x2={svgW - padX}
                y2={toY(activeTrade.sl)}
                stroke="#f43f5e"
                strokeWidth="1.2"
                strokeDasharray="4 3"
              />
            </>
          )}

          {visibleCandles.map((c, idx) => {
            const xCenter = padX + idx * barStep + barStep / 2;
            const isBull = c.close >= c.open;
            const color = isBull ? '#10b981' : '#f43f5e';
            const yHigh = toY(c.high);
            const yLow = toY(c.low);
            const yOpen = toY(c.open);
            const yClose = toY(c.close);
            const bodyTop = Math.min(yOpen, yClose);
            const bodyHeight = Math.max(1.5, Math.abs(yClose - yOpen));
            return (
              <g key={c.time + '-' + idx}>
                <line x1={xCenter} y1={yHigh} x2={xCenter} y2={yLow} stroke={color} strokeWidth="1.2" />
                <rect
                  x={xCenter - candleW / 2}
                  y={bodyTop}
                  width={candleW}
                  height={bodyHeight}
                  fill={color}
                  rx="1"
                />
              </g>
            );
          })}

          {revealCount < fullSeries.length && (
            <line
              x1={padX + visibleCandles.length * barStep}
              y1={padY}
              x2={padX + visibleCandles.length * barStep}
              y2={svgH - padY}
              stroke="#334155"
              strokeDasharray="2 4"
            />
          )}
        </svg>

        {latestBar && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#122038] text-[11px] font-mono text-slate-400">
            <span>
              Bar: {latestBar.fullDate || latestBar.timeLabel} · O {latestBar.open.toFixed(digits)} · H {latestBar.high.toFixed(digits)} · L {latestBar.low.toFixed(digits)} · C{' '}
              <strong className="text-white">{latestBar.close.toFixed(digits)}</strong>
            </span>
            <span>{fullSeries.length - revealCount} future bars hidden</span>
          </div>
        )}
      </div>

      {/* Controls & Execution Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="p-3.5 rounded-xl bg-[#0c1424] border border-[#182744] flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsPlaying((v) => !v)}
              disabled={revealCount >= fullSeries.length}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0df2c9] hover:bg-[#19f7d0] disabled:opacity-40 text-slate-950 text-xs font-bold cursor-pointer"
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isPlaying ? 'Pause' : 'Play'}</span>
            </button>

            <button
              type="button"
              onClick={() => stepForward(1)}
              disabled={revealCount >= fullSeries.length}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#101c31] hover:bg-[#172846] disabled:opacity-40 border border-[#1d3153] text-xs font-semibold text-white cursor-pointer"
            >
              <SkipForward className="w-3.5 h-3.5 text-[#0df2c9]" />
              <span>+1 Bar</span>
            </button>

            <button
              type="button"
              onClick={resetReplay}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#08101d] hover:bg-[#111d33] border border-[#1a2b46] text-xs text-slate-300 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] font-mono">
            {[
              { label: '1x', ms: 900 },
              { label: '2x', ms: 450 },
              { label: '5x', ms: 180 },
            ].map((sp) => (
              <button
                key={sp.label}
                type="button"
                onClick={() => setSpeedMs(sp.ms)}
                className={`px-2 py-1 rounded border cursor-pointer ${
                  speedMs === sp.ms
                    ? 'bg-[#0df2c9]/15 text-[#0df2c9] border-[#0df2c9]/40'
                    : 'bg-[#08101d] text-slate-400 border-[#1a2b46]'
                }`}
              >
                {sp.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-[#0c1424] border border-[#182744] flex flex-wrap items-center justify-between gap-2">
          {!activeTrade ? (
            <>
              <div className="flex items-center gap-2 text-xs font-mono">
                <label className="text-slate-400">
                  Lots
                  <input
                    type="number"
                    step="0.05"
                    min="0.01"
                    value={replayLots}
                    onChange={(e) => setReplayLots(Math.max(0.01, parseFloat(e.target.value) || 0.01))}
                    className="ml-1.5 w-14 px-2 py-1 rounded bg-[#070b13] border border-[#1a2b46] text-white"
                  />
                </label>
                <label className="text-slate-400">
                  SL
                  <input
                    type="number"
                    min="5"
                    value={slPips}
                    onChange={(e) => setSlPips(Math.max(5, parseInt(e.target.value, 10) || 10))}
                    className="ml-1 w-14 px-2 py-1 rounded bg-[#070b13] border border-[#1a2b46] text-white"
                  />
                </label>
                <label className="text-slate-400">
                  TP
                  <input
                    type="number"
                    min="5"
                    value={tpPips}
                    onChange={(e) => setTpPips(Math.max(5, parseInt(e.target.value, 10) || 20))}
                    className="ml-1 w-14 px-2 py-1 rounded bg-[#070b13] border border-[#1a2b46] text-white"
                  />
                </label>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openReplayOrder('LONG')}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-bold cursor-pointer"
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>Buy</span>
                </button>
                <button
                  type="button"
                  onClick={() => openReplayOrder('SHORT')}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 text-xs font-bold cursor-pointer"
                >
                  <TrendingDown className="w-3.5 h-3.5" />
                  <span>Sell</span>
                </button>
              </div>
            </>
          ) : (
            <div className="w-full flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
              <div>
                <span className={activeTrade.side === 'LONG' ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                  {activeTrade.side} {activeTrade.lots}L
                </span>{' '}
                @ {activeTrade.entry.toFixed(digits)} ·{' '}
                <strong className={floatingPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                  {floatingPnl >= 0 ? '+' : '-'}${Math.abs(floatingPnl).toFixed(2)}
                </strong>
              </div>
              <div className="flex items-center gap-2">
                {!activeTrade.breakEvenMoved && (
                  <button
                    type="button"
                    onClick={moveBreakEven}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#101c31] hover:bg-[#172846] border border-[#1d3153] text-emerald-300 cursor-pointer"
                  >
                    <Shield className="w-3 h-3" />
                    <span>Move BE</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={closeAtCurrentBar}
                  className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {history.length > 0 && (
        <div className="pt-1 flex flex-wrap items-center gap-2 text-xs font-mono">
          <Award className="w-3.5 h-3.5 text-[#0df2c9]" />
          {history.slice(0, 5).map((item) => (
            <span
              key={item.id}
              className={`px-2.5 py-1 rounded-lg bg-[#0c1424] border border-[#182744] ${
                item.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {item.side} · {item.reason} ({item.pnl >= 0 ? '+' : '-'}${Math.abs(item.pnl).toFixed(2)})
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
