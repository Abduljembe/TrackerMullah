import React, { useEffect, useRef, useState } from 'react';
import {
  createChart,
  CandlestickSeries,
  BarSeries,
  ColorType,
  CrosshairMode,
  LineStyle,
  IChartApi,
  ISeriesApi,
  IPriceLine,
  Time,
} from 'lightweight-charts';
import { generateCandles, Candle } from '../../utils/stockCandles.ts';
import { computeRealVolumeProfile, detectRealOrderBlocksAndPools } from '../../utils/orderFlowEngine.ts';

interface BotLiveChartProps {
  symbol: string;
  category: 'FOREX' | 'METALS' | 'DERIV_24_7' | 'CRYPTO' | 'EAST_AFRICA' | 'INDICES';
  timeframe: string;
  digits: number;
  livePrice: number;
  entryPrice: number;
  takeProfit: number;
  stopLoss: number;
  trailingStop?: number;
  isBreakEvenArmed: boolean;
  rrRatio: string;
  height?: number;
  defaultSeriesStyle?: 'candles' | 'bars';
  onLivePriceTick?: (price: number) => void;
}

interface OhlcPoint {
  time: Time;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
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
  trailingStop,
  isBreakEvenArmed,
  rrRatio,
  height = 280,
  defaultSeriesStyle = 'candles',
  onLivePriceTick,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<any, Time> | null>(null);
  const priceLinesRef = useRef<IPriceLine[]>([]);
  const barsRef = useRef<OhlcPoint[]>([]);
  const onLivePriceTickRef = useRef(onLivePriceTick);
  onLivePriceTickRef.current = onLivePriceTick;

  const [feedSource, setFeedSource] = useState<'DERIV_WS' | 'LIVE_OHLCV' | 'ESTIMATED'>('LIVE_OHLCV');
  const [seriesStyle, setSeriesStyle] = useState<'candles' | 'bars'>(defaultSeriesStyle);
  const [showObPoc, setShowObPoc] = useState<boolean>(false);
  const [barsRevision, setBarsRevision] = useState<number>(0);

  // 1. Initialize or rebuild Lightweight Charts instance when style/height changes
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
      height,
    });

    const prec = Math.min(5, Math.max(2, digits));
    const priceFormat = {
      type: 'price' as const,
      precision: prec,
      minMove: Number((1 / Math.pow(10, prec)).toFixed(prec)),
    };

    const mainSeries =
      seriesStyle === 'bars'
        ? chart.addSeries(BarSeries, {
            upColor: '#10b981',
            downColor: '#f43f5e',
            priceFormat,
          })
        : chart.addSeries(CandlestickSeries, {
            upColor: '#10b981',
            downColor: '#f43f5e',
            borderVisible: false,
            wickUpColor: '#34d399',
            wickDownColor: '#fb7185',
            priceFormat,
          });

    chartRef.current = chart;
    seriesRef.current = mainSeries;

    if (barsRef.current.length > 0) {
      mainSeries.setData(barsRef.current);
      chart.timeScale().fitContent();
    }

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
  }, [seriesStyle, height]);

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

  // 2. Load real historical candles (Deriv WS for 24/7 synthetics, Yahoo/Binance OHLCV for Forex/Metals/Indices/Crypto)
  useEffect(() => {
    let active = true;
    let ws: WebSocket | null = null;

    const applyBars = (bars: OhlcPoint[]) => {
      if (!active || !seriesRef.current || bars.length === 0) return;
      barsRef.current = bars;
      seriesRef.current.setData(bars);
      chartRef.current?.timeScale().fitContent();
      setBarsRevision((r) => r + 1);
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
                volume: 0,
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
                volume: 0,
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
              volume: c.volume,
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
            volume: c.volume,
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
                  volume: Number(c.volume) || 0,
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
                volume: c.volume,
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
              volume: c.volume,
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
      volume: last.volume,
    };
    barsRef.current[barsRef.current.length - 1] = updated;
    try {
      seriesRef.current.update(updated);
    } catch {
      // ignore timestamp mismatch during rapid symbol swap
    }
  }, [livePrice]);

  // 4. Overlay horizontal TP, Entry, SL / Trailing, and Optional POC / Order Block price lines
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
    if (trailingStop && trailingStop > 0) {
      priceLinesRef.current.push(
        series.createPriceLine({
          price: trailingStop,
          color: '#f59e0b',
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true,
          title: 'TRAIL SL',
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

    if (showObPoc && barsRef.current.length >= 8) {
      const candlesForEngine: Candle[] = barsRef.current.map((b) => ({
        time: Number(b.time),
        timeLabel: new Date(Number(b.time) * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
        fullDate: '',
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
        volume: b.volume || 0,
      }));
      const refSpot = livePrice > 0 ? livePrice : candlesForEngine[candlesForEngine.length - 1].close;
      const vp = computeRealVolumeProfile(candlesForEngine, refSpot, symbol, 12);
      const { orderBlocks } = detectRealOrderBlocksAndPools(candlesForEngine, refSpot, symbol);
      if (vp.pocNode) {
        priceLinesRef.current.push(
          series.createPriceLine({
            price: vp.pocNode.price,
            color: '#fbbf24',
            lineWidth: 1,
            lineStyle: LineStyle.Solid,
            axisLabelVisible: true,
            title: 'POC',
          })
        );
      }
      const bullOb = orderBlocks.find((z) => z.type === 'BULLISH');
      if (bullOb) {
        priceLinesRef.current.push(
          series.createPriceLine({
            price: bullOb.midpoint,
            color: '#14b8a6',
            lineWidth: 1,
            lineStyle: LineStyle.Dotted,
            axisLabelVisible: true,
            title: 'Bull OB',
          })
        );
      }
      const bearOb = orderBlocks.find((z) => z.type === 'BEARISH');
      if (bearOb) {
        priceLinesRef.current.push(
          series.createPriceLine({
            price: bearOb.midpoint,
            color: '#fb7185',
            lineWidth: 1,
            lineStyle: LineStyle.Dotted,
            axisLabelVisible: true,
            title: 'Bear OB',
          })
        );
      }
    }
  }, [entryPrice, takeProfit, stopLoss, trailingStop, isBreakEvenArmed, rrRatio, seriesStyle, showObPoc, barsRevision, symbol, livePrice]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono">
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
            ? 'DERIV REAL-TIME WEBSOCKET FEED'
            : feedSource === 'LIVE_OHLCV'
            ? 'LIVE HISTORICAL OHLCV + TV LIVE TICKS'
            : 'STRUCTURAL MARKET BARS + TV TICKS'}
        </span>

        <div className="flex items-center gap-1.5">
          <div className="flex items-center bg-[#060c18] p-0.5 rounded border border-[#162540]">
            <button
              type="button"
              onClick={() => setSeriesStyle('candles')}
              className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                seriesStyle === 'candles'
                  ? 'bg-teal-500/20 text-[#0df2c9] font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Candles
            </button>
            <button
              type="button"
              onClick={() => setSeriesStyle('bars')}
              className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                seriesStyle === 'bars'
                  ? 'bg-teal-500/20 text-[#0df2c9] font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              OHLC Bars
            </button>
          </div>
          <button
            type="button"
            onClick={() => setShowObPoc((p) => !p)}
            className={`px-2 py-0.5 rounded border transition-colors cursor-pointer ${
              showObPoc
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold'
                : 'bg-[#060c18] text-slate-400 border-[#162540] hover:text-white'
            }`}
            title="Toggle real detected POC & Order Block price levels"
          >
            OB / POC
          </button>
        </div>
      </div>
      <div
        ref={containerRef}
        className="w-full rounded-2xl border border-[#132036] overflow-hidden bg-[#040812]"
        style={{ height }}
      />
    </div>
  );
};
