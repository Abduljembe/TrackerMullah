import React, { useEffect, useRef, useState } from 'react';
import {
  createChart,
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  LineStyle,
  IChartApi,
  ISeriesApi,
  IPriceLine,
  Time,
} from 'lightweight-charts';
import { generateCandles } from '../../utils/stockCandles.ts';

interface BotLiveChartProps {
  symbol: string;
  category: 'FOREX' | 'METALS' | 'DERIV_24_7' | 'CRYPTO' | 'EAST_AFRICA' | 'INDICES';
  timeframe: string;
  digits: number;
  livePrice: number;
  entryPrice: number;
  takeProfit: number;
  stopLoss: number;
  isBreakEvenArmed: boolean;
  rrRatio: string;
  onLivePriceTick?: (price: number) => void;
}

interface OhlcPoint {
  time: Time;
  open: number;
  high: number;
  low: number;
  close: number;
}

function tfToDerivGranularity(tf: string): number {
  const upper = tf.toUpperCase();
  if (upper === 'M1' || tf === '1m') return 60;
  if (upper === 'M5' || tf === '5m') return 300;
  if (upper === 'M15' || tf === '15m') return 900;
  if (upper === 'M30' || tf === '30m') return 1800;
  if (upper === 'H1' || upper === '1H') return 3600;
  if (upper === 'H4' || upper === '4H') return 14400;
  if (upper === 'D1' || upper === '1D') return 86400;
  return 300;
}

function tfToHistoryParam(tf: string): string {
  const upper = tf.toUpperCase();
  if (upper === 'M1' || tf === '1m') return '1m';
  if (upper === 'M5' || tf === '5m') return '5m';
  if (upper === 'M15' || tf === '15m') return '15m';
  if (upper === 'M30' || tf === '30m') return '30m';
  if (upper === 'H1' || upper === '1H') return '1H';
  if (upper === 'H4' || upper === '4H') return '4H';
  if (upper === 'D1' || upper === '1D') return '1D';
  return '15m';
}

function formatHistoryTicker(symbol: string, category: string): string {
  const clean = symbol.replace('/', '').toUpperCase();
  if (category === 'INDICES' || category === 'CRYPTO') return clean;
  if (clean.length === 6 && !clean.startsWith('R_') && !clean.startsWith('1HZ')) {
    return `${clean.slice(0, 3)}/${clean.slice(3)}`;
  }
  return symbol;
}

export const BotLiveChart: React.FC<BotLiveChartProps> = ({
  symbol,
  category,
  timeframe,
  digits,
  livePrice,
  entryPrice,
  takeProfit,
  stopLoss,
  isBreakEvenArmed,
  rrRatio,
  onLivePriceTick,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick', Time> | null>(null);
  const priceLinesRef = useRef<IPriceLine[]>([]);
  const barsRef = useRef<OhlcPoint[]>([]);
  const onLivePriceTickRef = useRef(onLivePriceTick);
  onLivePriceTickRef.current = onLivePriceTick;
  const [feedSource, setFeedSource] = useState<'DERIV_WS' | 'LIVE_OHLCV' | 'ESTIMATED'>('LIVE_OHLCV');

  // 1. Initialize Lightweight Charts instance once
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#040812' },
        textColor: '#94a3b8',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: '#0e192d' },
        horzLines: { color: '#0e192d' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: '#0df2c9', width: 1, style: LineStyle.Dashed },
        horzLine: { color: '#0df2c9', width: 1, style: LineStyle.Dashed },
      },
      rightPriceScale: {
        borderColor: '#152542',
        autoScale: true,
      },
      timeScale: {
        borderColor: '#152542',
        timeVisible: true,
        secondsVisible: false,
      },
      width: containerRef.current.clientWidth,
      height: 280,
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#f43f5e',
      borderVisible: false,
      wickUpColor: '#34d399',
      wickDownColor: '#fb7185',
      priceFormat: {
        type: 'price',
        precision: Math.min(5, Math.max(2, digits)),
        minMove: Number((1 / Math.pow(10, Math.min(5, Math.max(2, digits)))).toFixed(5)),
      },
    });

    chartRef.current = chart;
    seriesRef.current = candleSeries;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          chart.applyOptions({ width: entry.contentRect.width });
        }
      }
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      priceLinesRef.current = [];
    };
  }, []);

  // Update precision dynamically when digits change
  useEffect(() => {
    if (!seriesRef.current) return;
    const prec = Math.min(5, Math.max(2, digits));
    seriesRef.current.applyOptions({
      priceFormat: {
        type: 'price',
        precision: prec,
        minMove: Number((1 / Math.pow(10, prec)).toFixed(prec)),
      },
    });
  }, [digits]);

  // 2. Load real historical candles (Deriv WS for 24/7 synthetics, Yahoo OHLCV for Forex/Metals/Indices/Crypto)
  useEffect(() => {
    let active = true;
    let ws: WebSocket | null = null;

    const applyBars = (bars: OhlcPoint[]) => {
      if (!active || !seriesRef.current || bars.length === 0) return;
      barsRef.current = bars;
      seriesRef.current.setData(bars);
      chartRef.current?.timeScale().fitContent();
    };

    if (category === 'DERIV_24_7') {
      const gran = tfToDerivGranularity(timeframe);
      try {
        ws = new WebSocket('wss://ws.derivws.com/websockets/v3?app_id=1089');
        ws.onopen = () => {
          if (!active || ws?.readyState !== WebSocket.OPEN) return;
          ws.send(
            JSON.stringify({
              ticks_history: symbol,
              adjust_start_time: 1,
              count: 90,
              end: 'latest',
              granularity: gran,
              style: 'candles',
              subscribe: 1,
            })
          );
        };
        ws.onmessage = (evt) => {
          if (!active) return;
          try {
            const msg = JSON.parse(evt.data);
            if (Array.isArray(msg.candles) && msg.candles.length > 0) {
              const mapped: OhlcPoint[] = msg.candles.map((c: any) => ({
                time: Number(c.epoch) as Time,
                open: Number(c.open),
                high: Number(c.high),
                low: Number(c.low),
                close: Number(c.close),
              }));
              setFeedSource('DERIV_WS');
              applyBars(mapped);
              const latestClose = mapped[mapped.length - 1]?.close;
              if (latestClose > 0) onLivePriceTickRef.current?.(latestClose);
            } else if (msg.ohlc && seriesRef.current) {
              const bar: OhlcPoint = {
                time: Number(msg.ohlc.open_time || msg.ohlc.epoch) as Time,
                open: Number(msg.ohlc.open),
                high: Number(msg.ohlc.high),
                low: Number(msg.ohlc.low),
                close: Number(msg.ohlc.close),
              };
              setFeedSource('DERIV_WS');
              seriesRef.current.update(bar);
              if (bar.close > 0) onLivePriceTickRef.current?.(bar.close);
              const existing = barsRef.current;
              if (existing.length > 0 && existing[existing.length - 1].time === bar.time) {
                existing[existing.length - 1] = bar;
              } else {
                existing.push(bar);
              }
            }
          } catch {
            // ignore parse noise
          }
        };
        ws.onerror = () => {
          if (!active) return;
          const fallback = generateCandles(symbol, livePrice || 1000, 0, tfToHistoryParam(timeframe) as any);
          setFeedSource('ESTIMATED');
          applyBars(
            fallback.map((c) => ({
              time: Math.floor(c.time) as Time,
              open: c.open,
              high: c.high,
              low: c.low,
              close: c.close,
            }))
          );
        };
      } catch {
        const fallback = generateCandles(symbol, livePrice || 1000, 0, tfToHistoryParam(timeframe) as any);
        setFeedSource('ESTIMATED');
        applyBars(
          fallback.map((c) => ({
            time: Math.floor(c.time) as Time,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
          }))
        );
      }
    } else {
      const apiTicker = formatHistoryTicker(symbol, category);
      const apiTf = tfToHistoryParam(timeframe);
      fetch(`/api/stocks/history?ticker=${encodeURIComponent(apiTicker)}&timeframe=${encodeURIComponent(apiTf)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!active) return;
          if (data?.success && Array.isArray(data.candles) && data.candles.length >= 5) {
            const seen = new Set<number>();
            const deduped: OhlcPoint[] = [];
            for (const c of data.candles) {
              const t = Math.floor(Number(c.time));
              if (!seen.has(t)) {
                seen.add(t);
                deduped.push({
                  time: t as Time,
                  open: Number(c.open),
                  high: Number(c.high),
                  low: Number(c.low),
                  close: Number(c.close),
                });
              }
            }
            deduped.sort((a, b) => Number(a.time) - Number(b.time));
            setFeedSource('LIVE_OHLCV');
            applyBars(deduped);
          } else {
            const fallback = generateCandles(symbol, livePrice || 100, 0, apiTf as any);
            setFeedSource('ESTIMATED');
            applyBars(
              fallback.map((c) => ({
                time: Math.floor(c.time) as Time,
                open: c.open,
                high: c.high,
                low: c.low,
                close: c.close,
              }))
            );
          }
        })
        .catch(() => {
          if (!active) return;
          const fallback = generateCandles(symbol, livePrice || 100, 0, tfToHistoryParam(timeframe) as any);
          setFeedSource('ESTIMATED');
          applyBars(
            fallback.map((c) => ({
              time: Math.floor(c.time) as Time,
              open: c.open,
              high: c.high,
              low: c.low,
              close: c.close,
            }))
          );
        });
    }

    return () => {
      active = false;
      try {
        ws?.close();
      } catch {}
    };
  }, [symbol, category, timeframe]);

  // 3. Keep latest candle close synced to incoming livePrice ticks
  useEffect(() => {
    if (!seriesRef.current || !(livePrice > 0) || barsRef.current.length === 0) return;
    const last = barsRef.current[barsRef.current.length - 1];
    const updated: OhlcPoint = {
      time: last.time,
      open: last.open,
      high: Math.max(last.high, livePrice),
      low: Math.min(last.low, livePrice),
      close: livePrice,
    };
    barsRef.current[barsRef.current.length - 1] = updated;
    try {
      seriesRef.current.update(updated);
    } catch {
      // ignore timestamp mismatch during rapid symbol swap
    }
  }, [livePrice]);

  // 4. Overlay horizontal TP, Entry, and SL / Break-Even price lines directly on chart
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;

    for (const line of priceLinesRef.current) {
      try {
        series.removePriceLine(line);
      } catch {}
    }
    priceLinesRef.current = [];

    if (takeProfit > 0) {
      priceLinesRef.current.push(
        series.createPriceLine({
          price: takeProfit,
          color: '#10b981',
          lineWidth: 2,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: `TP (${rrRatio})`,
        })
      );
    }
    if (entryPrice > 0) {
      priceLinesRef.current.push(
        series.createPriceLine({
          price: entryPrice,
          color: '#38bdf8',
          lineWidth: 2,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: true,
          title: 'ENTRY',
        })
      );
    }
    if (stopLoss > 0) {
      priceLinesRef.current.push(
        series.createPriceLine({
          price: stopLoss,
          color: isBreakEvenArmed ? '#0df2c9' : '#f43f5e',
          lineWidth: 2,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: isBreakEvenArmed ? 'BREAK-EVEN SL' : 'STOP LOSS',
        })
      );
    }
  }, [entryPrice, takeProfit, stopLoss, isBreakEvenArmed, rrRatio]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[10px] font-mono">
        <span
          className={`px-2 py-0.5 rounded border font-bold ${
            feedSource === 'DERIV_WS'
              ? 'bg-purple-500/15 text-purple-300 border-purple-500/40'
              : feedSource === 'LIVE_OHLCV'
              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
              : 'bg-amber-500/15 text-amber-300 border-amber-500/40'
          }`}
        >
          {feedSource === 'DERIV_WS'
            ? 'DERIV REAL-TIME WEBSOCKET CANDLES'
            : feedSource === 'LIVE_OHLCV'
            ? 'LIVE HISTORICAL OHLCV + TV LIVE TICKS'
            : 'STRUCTURAL MARKET BARS + TV TICKS'}
        </span>
        <span className="text-slate-400">Scroll / Pinch to Zoom • Interactive Crosshair</span>
      </div>
      <div
        ref={containerRef}
        className="w-full h-[280px] rounded-2xl border border-[#132036] overflow-hidden bg-[#040812]"
      />
    </div>
  );
};
