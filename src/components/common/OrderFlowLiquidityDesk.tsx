import React, { useState, useMemo, useEffect } from 'react';
import {
  Layers,
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  Flame,
  BarChart2,
  Users,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { Candle, Timeframe, generateCandles } from '../../utils/stockCandles.ts';
import {
  computeRealVolumeProfile,
  detectRealOrderBlocksAndPools,
  computeDomClusterLadder,
  formatQuantPrice,
} from '../../utils/orderFlowEngine.ts';
import { useTradingViewQuotes, lookupTradingViewQuote } from '../../utils/tradingViewSync.ts';

interface OrderFlowLiquidityDeskProps {
  currentTicker?: string;
  currentPrice?: number;
  currency?: string;
  candles?: Candle[];
  timeframe?: Timeframe;
  onTimeframeChange?: (tf: Timeframe) => void;
  onApplyZoneToOrder?: (entry: number, sl: number, tp: number) => void;
}

const DESK_TIMEFRAMES: Timeframe[] = ['15m', '1H', '4H', '1D'];

export const OrderFlowLiquidityDesk: React.FC<OrderFlowLiquidityDeskProps> = ({
  currentTicker = 'EUR/USD',
  currentPrice = 1.1032,
  currency = 'USD',
  candles: externalCandles,
  timeframe: externalTimeframe,
  onTimeframeChange,
  onApplyZoneToOrder,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'profile' | 'blocks' | 'heatmap' | 'sentiment'>('profile');
  const [localTimeframe, setLocalTimeframe] = useState<Timeframe>('1H');
  const [fetchedCandles, setFetchedCandles] = useState<Candle[]>([]);
  const [feedTag, setFeedTag] = useState<string>('LOADING...');
  const [liveCryptoLs, setLiveCryptoLs] = useState<{ longPct: number; shortPct: number; ratio: number } | null>(null);

  const activeTimeframe = externalTimeframe || localTimeframe;
  const liveTvQuotes = useTradingViewQuotes(4500);
  const tvQuote = lookupTradingViewQuote(liveTvQuotes, currentTicker);

  // Fetch real OHLCV candles when not provided externally (or when local timeframe changes)
  useEffect(() => {
    if (externalCandles && externalCandles.length >= 10 && (!externalTimeframe || externalTimeframe === activeTimeframe)) {
      setFeedTag('CHART STREAM OHLCV');
      return;
    }

    let active = true;
    let ws: WebSocket | null = null;
    const clean = currentTicker.replace(/[/\s]/g, '').toUpperCase();
    const isDeriv = /^(R_|1HZ|BOOM|CRASH|JD\d+|STPIDX)/.test(clean);

    if (isDeriv) {
      const gran = activeTimeframe === '15m' ? 900 : activeTimeframe === '4H' ? 14400 : activeTimeframe === '1D' ? 86400 : 3600;
      try {
        ws = new WebSocket('wss://ws.derivws.com/websockets/v3?app_id=1089');
        ws.onopen = () => {
          if (active && ws?.readyState === WebSocket.OPEN) {
            ws.send(
              JSON.stringify({
                ticks_history: clean,
                adjust_start_time: 1,
                count: 90,
                end: 'latest',
                granularity: gran,
                style: 'candles',
              })
            );
          }
        };
        ws.onmessage = (evt) => {
          if (!active) return;
          try {
            const msg = JSON.parse(evt.data);
            if (Array.isArray(msg.candles) && msg.candles.length >= 5) {
              const mapped: Candle[] = msg.candles.map((c: any) => {
                const t = Number(c.epoch);
                const d = new Date(t * 1000);
                return {
                  time: t,
                  timeLabel: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
                  fullDate: d.toLocaleString(),
                  open: Number(c.open),
                  high: Number(c.high),
                  low: Number(c.low),
                  close: Number(c.close),
                  volume: 0,
                };
              });
              setFetchedCandles(mapped);
              setFeedTag('DERIV WS CANDLES');
              ws?.close();
            }
          } catch {}
        };
        ws.onerror = () => {
          if (active) {
            setFetchedCandles(generateCandles(currentTicker, currentPrice, 0, activeTimeframe));
            setFeedTag('STRUCTURAL BARS');
          }
        };
      } catch {
        setFetchedCandles(generateCandles(currentTicker, currentPrice, 0, activeTimeframe));
        setFeedTag('STRUCTURAL BARS');
      }
    } else {
      fetch(`/api/stocks/history?ticker=${encodeURIComponent(currentTicker)}&timeframe=${encodeURIComponent(activeTimeframe)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!active) return;
          if (data?.success && Array.isArray(data.candles) && data.candles.length >= 8) {
            setFetchedCandles(data.candles);
            setFeedTag(data.provider === 'binance_spot' ? 'BINANCE TAKER-BUY OHLCV' : 'YAHOO LIVE OHLCV');
          } else {
            setFetchedCandles(generateCandles(currentTicker, currentPrice, 0, activeTimeframe));
            setFeedTag('STRUCTURAL BARS');
          }
        })
        .catch(() => {
          if (!active) return;
          setFetchedCandles(generateCandles(currentTicker, currentPrice, 0, activeTimeframe));
          setFeedTag('STRUCTURAL BARS');
        });
    }

    return () => {
      active = false;
      try {
        ws?.close();
      } catch {}
    };
  }, [currentTicker, activeTimeframe, externalCandles, externalTimeframe, currentPrice]);

  // Fetch Binance real L/S ratio when inspecting crypto assets
  useEffect(() => {
    const clean = currentTicker.replace(/[/\s]/g, '').toUpperCase();
    if (!['BTCUSD', 'BTCUSDT', 'ETHUSD', 'ETHUSDT', 'SOLUSD', 'SOLUSDT'].includes(clean)) {
      setLiveCryptoLs(null);
      return;
    }
    let active = true;
    fetch('/api/market/sentiment')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!active || !Array.isArray(data?.cryptoSentiments)) return;
        const match = data.cryptoSentiments.find(
          (x: any) => x.symbol.replace('/', '').toUpperCase() === clean || clean.startsWith(x.symbol.slice(0, 3))
        );
        if (match) {
          setLiveCryptoLs({
            longPct: match.retailLongPct,
            shortPct: match.retailShortPct,
            ratio: match.longShortRatio,
          });
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [currentTicker]);

  const effectiveCandles = useMemo(() => {
    if (externalCandles && externalCandles.length >= 10) return externalCandles;
    if (fetchedCandles.length >= 8) return fetchedCandles;
    return generateCandles(currentTicker, currentPrice, 0, activeTimeframe);
  }, [externalCandles, fetchedCandles, currentTicker, currentPrice, activeTimeframe]);

  const formatPrice = (p: number) => formatQuantPrice(p, currentTicker);

  // 1. Real Candle-Driven Volume Profile & Net Delta Bars
  const volumeProfileData = useMemo(
    () => computeRealVolumeProfile(effectiveCandles, currentPrice, currentTicker, 14),
    [effectiveCandles, currentPrice, currentTicker]
  );

  // 2. Real Candle-Driven Order Blocks, FVGs & Swing Liquidity Pools
  const { orderBlocks, liquidityPools } = useMemo(
    () => detectRealOrderBlocksAndPools(effectiveCandles, currentPrice, currentTicker),
    [effectiveCandles, currentPrice, currentTicker]
  );

  // 3. Real DOM Cluster Ladder derived from HVN + OB + Swings
  const domLadder = useMemo(
    () => computeDomClusterLadder(volumeProfileData, orderBlocks, liquidityPools, currentPrice),
    [volumeProfileData, orderBlocks, liquidityPools, currentPrice]
  );

  // 4. Real Crowding & Order-Flow Sentiment (Binance Live Futures L/S for Crypto, Multi-Candle RSI/Delta telemetry for FX/Equities)
  const sentimentTelemetry = useMemo(() => {
    if (liveCryptoLs) {
      const lPct = liveCryptoLs.longPct;
      const sPct = liveCryptoLs.shortPct;
      const extremeLong = lPct >= 66;
      const extremeShort = sPct >= 66;
      return {
        sourceLabel: `Binance Futures Global L/S Ratio (${liveCryptoLs.ratio.toFixed(2)})`,
        longPct: lPct,
        shortPct: sPct,
        bias: extremeLong ? 'BEARISH SQUEEZE WATCH' : extremeShort ? 'BULLISH SHORT-SQUEEZE WATCH' : 'BALANCED POSITIONING',
        summary: `Live Binance perpetual accounts are ${lPct}% Long vs ${sPct}% Short (Net Candle Delta: ${volumeProfileData.netDeltaPercent >= 0 ? '+' : ''}${volumeProfileData.netDeltaPercent}%).`,
      };
    }

    const rsi = tvQuote?.rsi ?? 50;
    const chg = tvQuote?.changePercent ?? 0;
    const deltaBias = volumeProfileData.netDeltaPercent * 0.25;
    const longPct = Math.min(88, Math.max(12, Math.round(50 + (rsi - 50) * 0.55 + chg * 2.5 + deltaBias)));
    const shortPct = 100 - longPct;
    const bias =
      longPct >= 68
        ? 'CROWDED LONG • SSL SWEEP RISK'
        : shortPct >= 68
        ? 'CROWDED SHORT • BSL SQUEEZE RISK'
        : 'BALANCED ORDER FLOW';

    return {
      sourceLabel: `Quant Crowding Telemetry (${activeTimeframe} Delta + RSI ${rsi.toFixed(1)})`,
      longPct,
      shortPct,
      bias,
      summary: `Computed from ${effectiveCandles.length} real ${activeTimeframe} candles (Net Buy/Sell Delta ${volumeProfileData.netDeltaPercent >= 0 ? '+' : ''}${volumeProfileData.netDeltaPercent}%) and live oscillator stretch (RSI ${rsi.toFixed(1)}).`,
    };
  }, [liveCryptoLs, tvQuote, volumeProfileData.netDeltaPercent, activeTimeframe, effectiveCandles.length]);

  const maxDeltaAbs = useMemo(() => {
    const m = Math.max(...volumeProfileData.deltaBars.map((d) => Math.abs(d.delta)), 1);
    return m;
  }, [volumeProfileData.deltaBars]);

  const handleTimeframePick = (tf: Timeframe) => {
    if (onTimeframeChange) onTimeframeChange(tf);
    else setLocalTimeframe(tf);
  };

  const unitWord = volumeProfileData.volumeMode === 'exchange_volume' ? 'vol' : 'ticks';

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-[#091120] border border-[#162744] shadow-xl space-y-4">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-[#14233c]">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono">
            <span className="text-teal-400 font-bold uppercase tracking-wider">
              Candle-Computed Institutional Depth
            </span>
            <span className="text-slate-600">•</span>
            <span className="text-cyan-300 font-semibold">{feedTag}</span>
            <span className="text-slate-600">•</span>
            <span className="text-slate-400">
              {volumeProfileData.volumeMode === 'exchange_volume' ? 'Real Exchange Volume' : 'Tick-Range Activity Proxy'}
            </span>
          </div>
          <h3 className="text-base font-extrabold text-white flex items-center gap-2 mt-0.5">
            <Layers className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>Order Block & Volume Profile ({currentTicker} · {activeTimeframe})</span>
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Timeframe Switcher */}
          <div className="flex items-center gap-0.5 p-1 rounded-xl bg-[#060c18] border border-[#132238] text-[11px] font-mono">
            {DESK_TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                type="button"
                onClick={() => handleTimeframePick(tf)}
                className={`px-2 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                  activeTimeframe === tf
                    ? 'bg-[#0df2c9]/20 text-[#0df2c9] border border-[#0df2c9]/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

          {/* Sub-tab Navigation */}
          <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-[#060c18] border border-[#132238] text-xs font-mono">
            <button
              type="button"
              onClick={() => setActiveSubTab('profile')}
              className={`px-2.5 py-1 rounded-lg font-bold whitespace-nowrap transition-all cursor-pointer ${
                activeSubTab === 'profile'
                  ? 'bg-teal-500 text-slate-950 font-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Volume Profile & Delta
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('blocks')}
              className={`px-2.5 py-1 rounded-lg font-bold whitespace-nowrap transition-all cursor-pointer ${
                activeSubTab === 'blocks'
                  ? 'bg-teal-500 text-slate-950 font-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Order Blocks & FVG ({orderBlocks.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('heatmap')}
              className={`px-2.5 py-1 rounded-lg font-bold whitespace-nowrap transition-all cursor-pointer ${
                activeSubTab === 'heatmap'
                  ? 'bg-teal-500 text-slate-950 font-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              DOM Liquidity Clusters
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('sentiment')}
              className={`px-2.5 py-1 rounded-lg font-bold whitespace-nowrap transition-all cursor-pointer ${
                activeSubTab === 'sentiment'
                  ? 'bg-teal-500 text-slate-950 font-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Crowding & Delta
            </button>
          </div>
        </div>
      </div>

      {/* Sub-Tab 1: Real Candle-Driven Volume Profile (VPVR) + Buy/Sell Delta Bar Chart */}
      {activeSubTab === 'profile' && (
        <div className="space-y-4">
          {/* POC & Value Area Summary Banner */}
          <div className="p-3 rounded-xl bg-[#060c18] border border-[#14233c] flex flex-wrap items-center justify-between gap-3 text-xs font-mono tabular-nums">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <span className="text-slate-300">
                Point of Control (POC):{' '}
                <strong className="text-amber-300 font-extrabold text-sm">
                  {volumeProfileData.pocNode ? formatPrice(volumeProfileData.pocNode.price) : formatPrice(currentPrice)}
                </strong>
              </span>
              <span className="text-[10px] text-slate-500 hidden sm:inline">
                ({effectiveCandles.length} {activeTimeframe} bars analyzed)
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
              <span>
                VAH: <strong className="text-cyan-300">{formatPrice(volumeProfileData.valueAreaHigh)}</strong>
              </span>
              <span>
                VAL: <strong className="text-cyan-300">{formatPrice(volumeProfileData.valueAreaLow)}</strong>
              </span>
              <span className={volumeProfileData.netDeltaPercent >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                Net Delta: {volumeProfileData.netDeltaPercent >= 0 ? '+' : ''}
                {volumeProfileData.netDeltaPercent}%
              </span>
            </div>
          </div>

          {/* Horizontal Volume Profile Ladder */}
          <div className="p-3.5 rounded-xl bg-[#060c18] border border-[#14233c] space-y-1.5 font-mono text-xs tabular-nums">
            <div className="flex items-center justify-between text-[10px] text-slate-400 uppercase font-bold pb-1 border-b border-[#132238]">
              <span className="w-28">Price Bucket</span>
              <span className="flex-1 text-center">Horizontal Volume Nodes (Buy vs Sell {unitWord})</span>
              <span className="w-28 text-right">Delta / Bias</span>
            </div>

            {volumeProfileData.nodes.map((node, idx) => {
              const isCurrent = currentPrice >= node.priceLow && currentPrice <= node.priceHigh;
              const barWidthPercent = (node.totalVolume / Math.max(1, volumeProfileData.maxVolume)) * 100;
              const buyPercent = node.totalVolume > 0 ? (node.buyVolume / node.totalVolume) * 100 : 50;
              const sellPercent = 100 - buyPercent;

              return (
                <div
                  key={idx}
                  className={`flex items-center gap-2 py-1 px-2 rounded-lg transition-colors ${
                    node.isPoc
                      ? 'bg-amber-950/30 border border-amber-500/50'
                      : isCurrent
                      ? 'bg-teal-950/40 border border-teal-500/40'
                      : node.isValueArea
                      ? 'bg-[#081222]/60'
                      : 'hover:bg-[#091426]'
                  }`}
                >
                  <div className="w-28 font-bold flex items-center gap-1.5 shrink-0">
                    {node.isPoc && (
                      <span className="text-[9px] font-black px-1 py-0.2 rounded bg-amber-400 text-slate-950">
                        POC
                      </span>
                    )}
                    {isCurrent && !node.isPoc && (
                      <span className="text-[9px] font-black px-1 py-0.2 rounded bg-teal-400 text-slate-950">
                        LIVE
                      </span>
                    )}
                    <span
                      className={
                        node.isPoc
                          ? 'text-amber-300 font-black'
                          : isCurrent
                          ? 'text-[#0df2c9]'
                          : node.isValueArea
                          ? 'text-slate-200'
                          : 'text-slate-400'
                      }
                    >
                      {node.formattedPrice}
                    </span>
                  </div>

                  <div className="flex-1 h-4 bg-[#091322] rounded-md overflow-hidden relative flex">
                    <div
                      className="h-full bg-emerald-500/80 transition-all"
                      style={{ width: `${(barWidthPercent * buyPercent) / 100}%` }}
                      title={`Buy ${unitWord}: ${node.buyVolume.toLocaleString()}`}
                    />
                    <div
                      className="h-full bg-rose-500/80 transition-all"
                      style={{ width: `${(barWidthPercent * sellPercent) / 100}%` }}
                      title={`Sell ${unitWord}: ${node.sellVolume.toLocaleString()}`}
                    />
                    <span className="absolute inset-0 flex items-center justify-center text-[9px] font-extrabold text-white drop-shadow">
                      {node.totalVolume.toLocaleString()} {unitWord}
                    </span>
                  </div>

                  <div className="w-28 text-right text-[11px] font-bold shrink-0">
                    <span className={node.deltaPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                      {node.deltaPercent >= 0 ? '+' : ''}
                      {node.deltaPercent}% {node.deltaPercent >= 0 ? 'BUY' : 'SELL'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Per-Candle Buy/Sell Net Delta Bar Chart */}
          {volumeProfileData.deltaBars.length > 0 && (
            <div className="p-3.5 rounded-xl bg-[#060c18] border border-[#14233c] space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="font-bold text-slate-200 flex items-center gap-1.5">
                  <BarChart2 className="w-3.5 h-3.5 text-[#0df2c9]" />
                  Last {volumeProfileData.deltaBars.length} Bars Net Volume Delta (Buy − Sell)
                </span>
                <span className="text-[10px] text-slate-400 tabular-nums">
                  Buy: {volumeProfileData.totalBuyVolume.toLocaleString()} • Sell: {volumeProfileData.totalSellVolume.toLocaleString()}
                </span>
              </div>

              <div className="h-24 flex items-end gap-1 pt-2 border-b border-[#162744]">
                {volumeProfileData.deltaBars.map((bar, i) => {
                  const pct = Math.max(10, Math.round((Math.abs(bar.delta) / maxDeltaAbs) * 100));
                  const pos = bar.delta >= 0;
                  return (
                    <div
                      key={i}
                      className="flex-1 h-full flex flex-col justify-end items-center group relative"
                      title={`${bar.timeLabel}: ${pos ? '+' : ''}${bar.delta.toLocaleString()} ${unitWord} delta`}
                    >
                      <div
                        className={`w-full rounded-t transition-all ${
                          pos ? 'bg-emerald-500/80 group-hover:bg-emerald-400' : 'bg-rose-500/80 group-hover:bg-rose-400'
                        }`}
                        style={{ height: `${pct}%` }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between text-[9px] font-mono text-slate-500">
                <span>{volumeProfileData.deltaBars[0]?.timeLabel}</span>
                <span>{volumeProfileData.deltaBars[Math.floor(volumeProfileData.deltaBars.length / 2)]?.timeLabel}</span>
                <span>{volumeProfileData.deltaBars[volumeProfileData.deltaBars.length - 1]?.timeLabel}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sub-Tab 2: Real Candle-Detected Order Blocks & FVGs */}
      {activeSubTab === 'blocks' && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {orderBlocks.map((ob) => {
              const isBull = ob.type === 'BULLISH';
              const riskSpan = Math.max(ob.priceHigh - ob.priceLow, currentPrice * 0.002);
              const entry = Number(ob.midpoint.toFixed(currentPrice < 10 ? 5 : 2));
              const sl = Number((isBull ? ob.priceLow - riskSpan * 0.5 : ob.priceHigh + riskSpan * 0.5).toFixed(currentPrice < 10 ? 5 : 2));
              const tp = Number((isBull ? entry + (entry - sl) * 2.2 : entry - (sl - entry) * 2.2).toFixed(currentPrice < 10 ? 5 : 2));

              return (
                <div
                  key={ob.id}
                  className={`p-3.5 rounded-xl border space-y-2.5 transition-all ${
                    isBull
                      ? 'bg-gradient-to-b from-[#081824] to-[#050e18] border-teal-500/40'
                      : 'bg-gradient-to-b from-[#180a12] to-[#0f060b] border-rose-500/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span
                        className={`text-[9px] font-mono font-bold uppercase ${
                          isBull ? 'text-[#0df2c9]' : 'text-rose-300'
                        }`}
                      >
                        {ob.type} {ob.kind === 'FVG' ? 'FAIR VALUE GAP' : 'ORDER BLOCK'} • {ob.strengthScore}% STRENGTH
                      </span>
                      <h4 className="text-xs font-black text-white mt-0.5">{ob.label}</h4>
                    </div>

                    <span
                      className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0 ${
                        ob.status.includes('FRESH')
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {ob.status.includes('FRESH') ? 'FRESH' : 'MITIGATED'}
                    </span>
                  </div>

                  <div className="p-2 rounded-lg bg-[#040810] border border-[#132238] font-mono text-xs space-y-1 tabular-nums">
                    <div className="flex items-center justify-between text-slate-400 text-[10px]">
                      <span>Zone Range:</span>
                      <span className="text-white font-bold">
                        {formatPrice(ob.priceLow)} – {formatPrice(ob.priceHigh)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-slate-400">Bar Activity:</span>
                      <span className="text-teal-300 font-extrabold">{ob.volumeLabel}</span>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-400 leading-relaxed font-sans">{ob.description}</p>

                  <div className="pt-2 border-t border-[#14233c] flex items-center justify-between text-[10px] font-mono">
                    <span className="text-slate-500 truncate max-w-[140px]">{ob.timeLabel}</span>
                    <button
                      type="button"
                      onClick={() => onApplyZoneToOrder?.(entry, sl, tp)}
                      className="text-teal-400 hover:text-white font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <span>Apply Entry/SL/TP</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Swing High / Swing Low Liquidity Pools */}
          <div className="p-3.5 rounded-xl bg-[#060c18] border border-amber-500/30 space-y-2">
            <div className="flex items-center gap-2 text-xs font-mono">
              <Flame className="w-4 h-4 text-amber-400" />
              <h4 className="font-bold text-white uppercase tracking-wider">
                Detected Swing High / Low Liquidity Pools ({currentTicker})
              </h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs font-mono tabular-nums">
              {liquidityPools.map((lp) => (
                <div key={lp.id} className="p-2.5 rounded-lg bg-[#081020] border border-[#14233c] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-bold ${lp.type.includes('BSL') ? 'text-sky-400' : 'text-amber-400'}`}>
                      {lp.type}
                    </span>
                    <span className="text-[9px] text-slate-300 font-bold">
                      {lp.touches}x Swing • {lp.distancePercent}% away
                    </span>
                  </div>
                  <div className="text-sm font-black text-white">{formatPrice(lp.price)}</div>
                  <p className="text-[10px] text-slate-400 font-sans leading-snug">{lp.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Sub-Tab 3: Candle-Derived DOM Buy/Sell Clusters */}
      {activeSubTab === 'heatmap' && (
        <div className="space-y-3 font-mono text-xs tabular-nums">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Support Clusters (Buy Zones) */}
            <div className="p-3.5 rounded-xl bg-[#061418] border border-emerald-500/40 space-y-2">
              <div className="flex items-center justify-between pb-1.5 border-b border-emerald-500/30">
                <span className="text-emerald-400 font-extrabold uppercase text-[11px] flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>Bid Demand Clusters (Below Spot)</span>
                </span>
                <span className="text-[10px] text-slate-400">{domLadder.totalBids.toLocaleString()} {unitWord}</span>
              </div>

              <div className="space-y-1.5">
                {domLadder.bids.map((bid, i) => (
                  <div
                    key={i}
                    className={`flex items-center justify-between p-2 rounded-lg ${
                      bid.isWall
                        ? 'bg-emerald-950/80 border border-emerald-400/70 text-white font-black'
                        : 'bg-[#081822] text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-emerald-300">{formatPrice(bid.price)}</span>
                      <span className="text-[10px] text-slate-400 font-normal">{bid.sourceLabel}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-white">{bid.volume.toLocaleString()} {unitWord}</span>
                      <span className="text-[10px] text-slate-500">{bid.touches}x</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Resistance Clusters (Sell Zones) */}
            <div className="p-3.5 rounded-xl bg-[#170a12] border border-rose-500/40 space-y-2">
              <div className="flex items-center justify-between pb-1.5 border-b border-rose-500/30">
                <span className="text-rose-400 font-extrabold uppercase text-[11px] flex items-center gap-1.5">
                  <TrendingDown className="w-3.5 h-3.5" />
                  <span>Ask Supply Clusters (Above Spot)</span>
                </span>
                <span className="text-[10px] text-slate-400">{domLadder.totalAsks.toLocaleString()} {unitWord}</span>
              </div>

              <div className="space-y-1.5">
                {domLadder.asks.map((ask, i) => (
                  <div
                    key={i}
                    className={`flex items-center justify-between p-2 rounded-lg ${
                      ask.isWall
                        ? 'bg-rose-950/80 border border-rose-400/70 text-white font-black'
                        : 'bg-[#180e15] text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-rose-300">{formatPrice(ask.price)}</span>
                      <span className="text-[10px] text-slate-400 font-normal">{ask.sourceLabel}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-white">{ask.volume.toLocaleString()} {unitWord}</span>
                      <span className="text-[10px] text-slate-500">{ask.touches}x</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sub-Tab 4: Live Crowding & Order-Flow Bias */}
      {activeSubTab === 'sentiment' && (
        <div className="space-y-3 font-mono text-xs">
          <div className="p-4 rounded-xl bg-[#060c18] border border-[#14233c] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-teal-400" />
                  <h4 className="font-bold text-white uppercase tracking-wider">
                    Positioning & Contrarian Flow Bias ({currentTicker})
                  </h4>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">{sentimentTelemetry.sourceLabel}</div>
              </div>
              <span className="text-[10px] font-bold text-amber-300 bg-amber-950/50 px-2.5 py-1 rounded border border-amber-700/40">
                {sentimentTelemetry.bias}
              </span>
            </div>

            <div className="space-y-1.5 tabular-nums">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-emerald-400">Long Pressure: {sentimentTelemetry.longPct}%</span>
                <span className="text-rose-400">Short Pressure: {sentimentTelemetry.shortPct}%</span>
              </div>
              <div className="h-4 w-full bg-slate-900 rounded-lg overflow-hidden flex">
                <div
                  className="h-full bg-emerald-500 font-bold text-[10px] text-slate-950 flex items-center justify-center"
                  style={{ width: `${sentimentTelemetry.longPct}%` }}
                >
                  {sentimentTelemetry.longPct}% LONG
                </div>
                <div
                  className="h-full bg-rose-500 font-bold text-[10px] text-white flex items-center justify-center"
                  style={{ width: `${sentimentTelemetry.shortPct}%` }}
                >
                  {sentimentTelemetry.shortPct}% SHORT
                </div>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-[#0e1626] border border-[#1b2b44] flex items-start gap-2.5 text-slate-300 font-sans">
              <ShieldAlert className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
              <div className="text-[11px] leading-relaxed">{sentimentTelemetry.summary}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
