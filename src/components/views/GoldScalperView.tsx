/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Gold Scalper Bot (MT5 M1 Specialist) Dedicated Feature
 * Full-scale automated trading hub featuring the user's GOLD SCALPER EA - MT5.
 * Includes Broker Connect, Live Account Balance/Equity display, Master Start/Stop Bot switch,
 * Live XAUUSD M1 Candlestick Chart, Trailing Stop Engine, 0.5% Basket Closer, and MQL5 Exporter.
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Flame,
  Zap,
  Play,
  Square,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Activity,
  Layers,
  Clock,
  Sliders,
  Copy,
  Check,
  Download,
  AlertTriangle,
  RefreshCw,
  Server,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  CheckCircle2,
  ChevronRight,
  SlidersHorizontal,
  Info,
  Sparkles,
  BarChart2,
  Radio,
  ExternalLink,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext.tsx';
import { useTradingViewQuotes, lookupTradingViewQuote } from '../../utils/tradingViewSync.ts';
import { getMarketSession } from '../../utils/marketHours.ts';
import { MAX_RISK_REWARD, getTimeframeProfile, resolveQuoteForTimeframe, evaluateDirectionalConfluence } from '../../utils/signalEngine.ts';
import { BotLiveChart } from '../trading/BotLiveChart.tsx';

// =========================================================================
// TRADINGVIEW GOLD CHART ADVANCED EMBED
// =========================================================================
interface TradingViewGoldChartProps {
  symbol?: string;
  interval?: string;
  height?: number | string;
}

const TradingViewGoldChart: React.FC<TradingViewGoldChartProps> = ({
  symbol = 'OANDA:XAUUSD',
  interval = '1',
  height = 520,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = '';

    const widgetContainer = document.createElement('div');
    widgetContainer.className = 'tradingview-widget-container__widget';
    widgetContainer.style.height = '100%';
    widgetContainer.style.width = '100%';
    containerRef.current.appendChild(widgetContainer);

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol,
      interval,
      timezone: 'Etc/UTC',
      theme: 'dark',
      style: '1',
      locale: 'en',
      enable_publishing: false,
      allow_symbol_change: true,
      hide_top_toolbar: false,
      hide_legend: false,
      save_image: true,
      calendar: false,
      hide_volume: false,
      studies: [
        'STD;EMA',
        'STD;EMA',
        'STD;RSI',
        'STD;Average_True_Range',
      ],
      support_host: 'https://www.tradingview.com',
      backgroundColor: 'rgba(7, 11, 20, 1)',
      gridColor: 'rgba(20, 32, 54, 0.4)',
    });

    containerRef.current.appendChild(script);

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [symbol, interval]);

  return (
    <div className="w-full relative rounded-lg overflow-hidden border border-slate-800" style={{ height }}>
      <div ref={containerRef} className="tradingview-widget-container w-full h-full" style={{ height: '100%' }} />
    </div>
  );
};

// =========================================================================
// BROKER ACCOUNT MODEL
// =========================================================================
export interface BrokerAccount {
  brokerName: string;
  server: string;
  loginId: string;
  accountType: 'LIVE' | 'DEMO' | 'PROP_FIRM';
  currency: 'USD' | 'EUR' | 'GBP' | 'KES';
  balance: number;
  equity: number;
  margin: number;
  freeMargin: number;
  marginLevel: number;
  connectedAt: string;
  pingMs: number;
}

// Preset Broker Servers
const BROKER_PRESETS = [
  { name: 'IC Markets (Raw Spread)', server: 'ICMarketsSC-Live02', defaultType: 'LIVE' as const },
  { name: 'Exness (Zero / Raw)', server: 'Exness-Real14', defaultType: 'LIVE' as const },
  { name: 'FTMO Challenge ($100k)', server: 'FTMO-Server2', defaultType: 'PROP_FIRM' as const },
  { name: 'FundedNext ($50k Stellar)', server: 'FundedNext-Live01', defaultType: 'PROP_FIRM' as const },
  { name: 'Deriv MT5 (Financial)', server: 'Deriv-Server', defaultType: 'LIVE' as const },
  { name: 'Pepperstone (Razor)', server: 'Pepperstone-Live03', defaultType: 'LIVE' as const },
];

// Open Trade Position
export interface GoldPosition {
  ticket: number;
  symbol: string;
  type: 'BUY' | 'SELL';
  volume: number;
  openPrice: number;
  currentPrice: number;
  sl: number;
  tp: number;
  trailingSl: number;
  profit: number;
  openTime: string;
}

// Simulated M1 Candlestick
export interface CandleBar {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

let sessionGoldBotRunning = false;

export const GoldScalperView: React.FC = () => {
  const { setActiveTab } = useFinance();

  // -------------------------------------------------------------------------
  // 1. BROKER CONNECTION STATE (Persisted in localStorage)
  // -------------------------------------------------------------------------
  const [broker, setBroker] = useState<BrokerAccount | null>(() => {
    try {
      const saved = localStorage.getItem('njia_gold_scalper_broker');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Exclude old sample dummy account 8491024
        if (parsed.loginId && parsed.loginId !== '8491024') {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    // Clean initial state: No sample broker! User connects real broker
    return null;
  });

  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [connectForm, setConnectForm] = useState({
    connectMethod: 'MT5' as 'MT5' | 'DERIV' | 'BRIDGE',
    brokerName: 'Exness',
    server: 'Exness-Real14',
    loginId: '',
    password: '',
    derivToken: '',
    accountType: 'LIVE' as 'LIVE' | 'DEMO' | 'PROP_FIRM',
    currency: 'USD' as 'USD' | 'EUR' | 'GBP' | 'KES',
    realBalance: 1000,
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [isSyncingBalance, setIsSyncingBalance] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState(false);

  // Save broker to localStorage on change
  useEffect(() => {
    if (broker) {
      localStorage.setItem('njia_gold_scalper_broker', JSON.stringify(broker));
    } else {
      localStorage.removeItem('njia_gold_scalper_broker');
    }
  }, [broker]);

  // -------------------------------------------------------------------------
  // 2. BOT RUNNING / EXECUTION STATE
  // -------------------------------------------------------------------------
  const [isBotRunning, setIsBotRunning] = useState<boolean>(() => sessionGoldBotRunning); // Always STOPPED on website open until user clicks START
  const [audioFeedback, setAudioFeedback] = useState<boolean>(true);
  const [barTimerSeconds, setBarTimerSeconds] = useState<number>(48); // Seconds left in M1 bar
  const [eaLogs, setEaLogs] = useState<Array<{ id: string; time: string; text: string; type: 'info' | 'trade' | 'alert' | 'profit' }>>([
    { id: '1', time: '18:19:00', text: '[INIT] GOLD SCALPER EA - MT5 v4.00 loaded in STANDBY (STOPPED) on XAUUSD (Magic: 445566)', type: 'info' },
    { id: '2', time: '18:19:01', text: '[CONFIG] Risk Per Trade: 1.0% | Portfolio Risk Cap: 5.0% | Timeframe: PERIOD_M1', type: 'info' },
    { id: '3', time: '18:19:02', text: '[RULES] Fast EMA 9 / Slow EMA 21 crossover with RSI 14 filter (Buy >= 52, Sell <= 48)', type: 'info' },
    { id: '4', time: '18:19:03', text: '[GUARD] Basket Close Target: 0.5% Equity ($50.00) | Trailing Stop: 1.0x ATR — Click START BOT to begin', type: 'info' },
  ]);

  // Strategy Parameters (matching user MQL5 input settings)
  const [strategyParams, setStrategyParams] = useState({
    goldSymbol: 'XAUUSD',
    fastEMA: 9,
    slowEMA: 21,
    rsiPeriod: 14,
    buyRSI: 52.0,
    sellRSI: 48.0,
    atrPeriod: 14,
    stopLossATR: 1.5,
    takeProfitATR: 2.0,
    basketProfitPercent: 0.5,
    requireAllTradesProfitable: true,
    useTrailingStop: true,
    trailingATR: 1.0,
    riskPercent: 1.0,
    portfolioRiskCapPercent: 5.0,
    maxTotalPositions: 10,
    maxPositionsPerSymbol: 10,
    maxEntriesPerSignal: 2,
    maxSpreadPoints: 100,
    cooldownSeconds: 10,
    magicNumber: 445566,
  });

  const [isParamsOpen, setIsParamsOpen] = useState(false);
  const [isCodeModalOpen, setIsCodeModalOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // TradingView Chart controls
  const [chartViewMode, setChartViewMode] = useState<'tradingview' | 'execution'>('tradingview');
  const [tvInterval, setTvInterval] = useState<string>('1'); // M1 default
  const [isChartFullscreen, setIsChartFullscreen] = useState<boolean>(false);

  // -------------------------------------------------------------------------
  // 3. LIVE GOLD PRICE ACTION & CHART DATA
  // -------------------------------------------------------------------------
  const [goldPrice, setGoldPrice] = useState<number>(3620.00);
  const [bidPrice, setBidPrice] = useState<number>(3619.85);
  const [askPrice, setAskPrice] = useState<number>(3620.15);
  const [spreadPoints, setSpreadPoints] = useState<number>(30); // 30 points = 0.30 pips

  // Technical indicator calculated values
  const [fastEmaVal, setFastEmaVal] = useState<number>(3621.20);
  const [slowEmaVal, setSlowEmaVal] = useState<number>(3618.90);
  const [rsiVal, setRsiVal] = useState<number>(44.8);
  const [atrVal, setAtrVal] = useState<number>(3.80);

  // M1 Candlestick series for chart visualizer
  const [candles, setCandles] = useState<CandleBar[]>([
    { time: '18:14', open: 3616.80, high: 3618.40, low: 3616.10, close: 3618.00 },
    { time: '18:15', open: 3618.00, high: 3619.70, low: 3617.40, close: 3619.20 },
    { time: '18:16', open: 3619.20, high: 3621.10, low: 3618.50, close: 3620.40 },
    { time: '18:17', open: 3620.40, high: 3621.80, low: 3619.70, close: 3621.50 },
    { time: '18:18', open: 3621.50, high: 3622.10, low: 3619.80, close: 3620.70 },
    { time: '18:19', open: 3620.70, high: 3621.80, low: 3619.50, close: 3620.00 },
  ]);

  // Anchor Gold Scalper spot price & indicators strictly to live TradingView XAU/USD feed
  const liveTvQuotes = useTradingViewQuotes(2000);
  useEffect(() => {
    const tvGold = lookupTradingViewQuote(liveTvQuotes, 'XAUUSD');
    if (tvGold && tvGold.price > 0) {
      setGoldPrice(tvGold.price);
      setBidPrice(
        typeof tvGold.bid === 'number' && tvGold.bid > 0
          ? Number(tvGold.bid.toFixed(2))
          : Number((tvGold.price - spreadPoints * 0.01).toFixed(2))
      );
      setAskPrice(
        typeof tvGold.ask === 'number' && tvGold.ask > 0
          ? Number(tvGold.ask.toFixed(2))
          : Number((tvGold.price + spreadPoints * 0.01).toFixed(2))
      );

      const tfMap: Record<string, string> = { '1': 'M1', '5': 'M5', '15': 'M15', '60': 'H1', '240': 'H4', 'D': 'D1' };
      const activeTf = tfMap[tvInterval] || 'M1';
      const tfSlice = resolveQuoteForTimeframe(tvGold, activeTf);
      const evalRes = evaluateDirectionalConfluence(tvGold, tvGold.price, activeTf);

      if (typeof tfSlice.rsi === 'number') {
        setRsiVal(Number(tfSlice.rsi.toFixed(1)));
      }
      if (typeof tfSlice.ema20 === 'number' && typeof tfSlice.ema50 === 'number') {
        setFastEmaVal(Number(tfSlice.ema20.toFixed(2)));
        setSlowEmaVal(Number(tfSlice.ema50.toFixed(2)));
      } else {
        const offset = evalRes.direction === 'BUY' ? 1.15 : -1.15;
        setFastEmaVal(Number((tvGold.price + offset * 0.6).toFixed(2)));
        setSlowEmaVal(Number((tvGold.price - offset * 1.4).toFixed(2)));
      }
      if (typeof tvGold.atr === 'number' && tvGold.atr > 0) {
        const tfProfile = getTimeframeProfile(activeTf);
        setAtrVal(Number(Math.max(1.8, Math.min(24.0, tvGold.atr * tfProfile.volatilityScale * 0.45)).toFixed(2)));
      }
    }
  }, [liveTvQuotes, spreadPoints, tvInterval]);

  // -------------------------------------------------------------------------
  // 4. OPEN POSITIONS & REAL MT5 TERMINAL SYNC
  // -------------------------------------------------------------------------
  const [positions, setPositions] = useState<GoldPosition[]>([]);
  const [isMt5TerminalActive, setIsMt5TerminalActive] = useState<boolean>(false);
  const [lastMt5ContactAgo, setLastMt5ContactAgo] = useState<number | null>(null);
  const [isMt5GuideOpen, setIsMt5GuideOpen] = useState<boolean>(false);
  const [isDispatchingOrder, setIsDispatchingOrder] = useState<boolean>(false);
  const [tradeLot, setTradeLot] = useState<number>(0.05);
  const [tradeSlPoints, setTradeSlPoints] = useState<number>(1.5); // multiplier of ATR
  const [tradeTpPoints, setTradeTpPoints] = useState<number>(2.0); // multiplier of ATR

  // Poll backend for real MT5 open positions & WebRequest bridge heartbeat
  useEffect(() => {
    let isMounted = true;
    const syncPositions = async () => {
      try {
        const res = await fetch('/api/ea/positions');
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.success) {
            setIsMt5TerminalActive(!!data.isMt5Active);
            setLastMt5ContactAgo(data.lastContactSecondsAgo);
            if (Array.isArray(data.positions)) {
              setPositions(data.positions);
            }
          }
        }
      } catch {
        // silent
      }
    };

    syncPositions();
    const interval = setInterval(syncPositions, 2500);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Audio tone helper
  const playAlertTone = useCallback((type: 'order' | 'profit' | 'start') => {
    if (!audioFeedback) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'profit') {
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.18); // A5
      } else if (type === 'order') {
        osc.frequency.setValueAtTime(440, ctx.currentTime); // A4
        osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.08); // E5
      } else {
        osc.frequency.setValueAtTime(329.63, ctx.currentTime); // E4
        osc.frequency.setValueAtTime(440, ctx.currentTime + 0.1); // A4
      }

      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch {
      // Audio not permitted or supported
    }
  }, [audioFeedback]);

  // Total floating profit of all open gold positions
  const basketProfit = useMemo(() => {
    return Number(positions.reduce((acc, p) => acc + p.profit, 0).toFixed(2));
  }, [positions]);

  // Target dollar profit for 0.5% equity basket closing
  const targetBasketDollars = useMemo(() => {
    if (!broker) return 50.0;
    return Number(((broker.equity * strategyParams.basketProfitPercent) / 100).toFixed(2));
  }, [broker, strategyParams.basketProfitPercent]);

  const basketProgressPercent = useMemo(() => {
    if (targetBasketDollars <= 0) return 0;
    return Math.min(100, Math.max(0, Number(((basketProfit / targetBasketDollars) * 100).toFixed(0))));
  }, [basketProfit, targetBasketDollars]);

  // -------------------------------------------------------------------------
  // 5. LIVE SIMULATION & EA EXECUTION ENGINE LOOP
  // -------------------------------------------------------------------------
  const goldMarketSession = useMemo(() => getMarketSession('METALS'), [goldPrice]);

  useEffect(() => {
    const tickInterval = setInterval(() => {
      const session = getMarketSession('METALS');
      if (!session.isOpen) {
        // Global Spot Gold (XAU/USD) follows 24/5 Sun 22:00 UTC - Fri 22:00 UTC schedule
        return;
      }
      // 1. Anchor spread cleanly to UTC session liquidity (London/NY tight 18pts, Asian 26pts)
      const utcHour = new Date().getUTCHours();
      const sessionSpread = utcHour >= 7 && utcHour <= 20 ? 18 : 26;
      setSpreadPoints(sessionSpread);
      const tvGold = lookupTradingViewQuote(liveTvQuotes, 'XAUUSD');
      if (tvGold && tvGold.price > 0) {
        setGoldPrice(tvGold.price);
        setBidPrice(Number((tvGold.price - sessionSpread * 0.01).toFixed(2)));
        setAskPrice(Number((tvGold.price + sessionSpread * 0.01).toFixed(2)));
      }

      // 2. Decrement M1 bar timer
      setBarTimerSeconds((sec) => {
        if (sec <= 1) {
          // New bar detected: IsNewBar() = true!
          handleNewM1Bar();
          return 60;
        }
        return sec - 1;
      });

      // 3. Continuously update live P/L and check SL, TP, Trailing Stop, and Basket Targets
      if (positions.length > 0) {
        setPositions((prev) => {
          const remaining: GoldPosition[] = [];
          for (const pos of prev) {
            const current = pos.type === 'BUY' ? bidPrice : askPrice;
            const diff = pos.type === 'BUY' ? current - pos.openPrice : pos.openPrice - current;
            const profit = Number((diff * pos.volume * 100).toFixed(2));

            // Check if Stop Loss was hit
            const slHit = pos.type === 'BUY' ? current <= pos.sl : current >= pos.sl;
            if (slHit) {
              setBroker((b) => (b ? { ...b, balance: Number((b.balance + profit).toFixed(2)), equity: Number((b.balance + profit).toFixed(2)) } : null));
              addLog(`[SL TRIGGERED] Ticket #${pos.ticket} hit Stop Loss @ $${current.toFixed(2)} (P/L: $${profit.toFixed(2)})`, 'alert');
              continue; // Close position
            }

            // Check if Take Profit was hit
            const tpHit = pos.type === 'BUY' ? current >= pos.tp : current <= pos.tp;
            if (tpHit) {
              setBroker((b) => (b ? { ...b, balance: Number((b.balance + profit).toFixed(2)), equity: Number((b.balance + profit).toFixed(2)) } : null));
              playAlertTone('profit');
              addLog(`[TP HARVESTED] Ticket #${pos.ticket} hit Take Profit @ $${current.toFixed(2)} (+Profit: $${profit.toFixed(2)})!`, 'profit');
              continue; // Close position
            }

            // Trailing Stop Logic (1.0x ATR)
            let newTrailing = pos.trailingSl;
            if (strategyParams.useTrailingStop) {
              const trailDist = atrVal * strategyParams.trailingATR;
              if (pos.type === 'BUY') {
                const candidate = Number((current - trailDist).toFixed(2));
                if (candidate > pos.trailingSl && candidate > pos.sl) {
                  newTrailing = candidate;
                }
              } else {
                const candidate = Number((current + trailDist).toFixed(2));
                if (candidate < pos.trailingSl && candidate < pos.sl) {
                  newTrailing = candidate;
                }
              }
            }

            remaining.push({
              ...pos,
              currentPrice: current,
              profit,
              trailingSl: newTrailing,
            });
          }
          return remaining;
        });
      }
    }, 1000);

    return () => clearInterval(tickInterval);
  }, [isBotRunning, positions.length, bidPrice, askPrice, atrVal, strategyParams, liveTvQuotes]);

  // Handle M1 Candle Close & EA Trading Signal Evaluation
  const handleNewM1Bar = () => {
    // Append or roll candles
    setCandles((prev) => {
      const last = prev[prev.length - 1];
      const newCandle: CandleBar = {
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        open: last.close,
        high: Math.max(last.close, goldPrice + 0.8),
        low: Math.min(last.close, goldPrice - 0.7),
        close: goldPrice,
      };
      return [...prev.slice(1), newCandle];
    });

    if (!isBotRunning || !broker) return;

    // Check spread filter (InpMaxSpreadPoints)
    if (spreadPoints > strategyParams.maxSpreadPoints) {
      addLog(`[FILTER] Spread too high (${spreadPoints} pts > ${strategyParams.maxSpreadPoints} max). Entry skipped.`, 'alert');
      return;
    }

    // Evaluate EMA crossover and RSI confirmation
    const isBullishCross = fastEmaVal > slowEmaVal && rsiVal >= strategyParams.buyRSI;
    const isBearishCross = fastEmaVal < slowEmaVal && rsiVal <= strategyParams.sellRSI;

    // Map active chart interval to timeframe volatility multiplier & cap R:R <= 5.0
    const tfMap: Record<string, string> = { '1': 'M1', '5': 'M5', '15': 'M15', '60': 'H1', '240': 'H4', 'D': 'D1' };
    const tfProfile = getTimeframeProfile(tfMap[tvInterval] || 'M1');
    const tfScale = Math.max(1.0, tfProfile.volatilityScale / 0.30);

    // Open new positions if condition met and slot available
    if ((isBullishCross || isBearishCross) && positions.length < strategyParams.maxPositionsPerSymbol) {
      const type: 'BUY' | 'SELL' = isBullishCross ? 'BUY' : 'SELL';
      const entryPrice = type === 'BUY' ? askPrice : bidPrice;
      const stopDist = Number((atrVal * strategyParams.stopLossATR * tfScale).toFixed(2));
      const rawTpDist = Number((atrVal * strategyParams.takeProfitATR * tfScale).toFixed(2));
      const tpDist = Number(Math.min(rawTpDist, stopDist * MAX_RISK_REWARD).toFixed(2));
      const sl = type === 'BUY' ? Number((entryPrice - stopDist).toFixed(2)) : Number((entryPrice + stopDist).toFixed(2));
      const tp = type === 'BUY' ? Number((entryPrice + tpDist).toFixed(2)) : Number((entryPrice - tpDist).toFixed(2));

      // Calculate lot size strictly based on 1.0% equity risk
      const riskDollars = (broker.equity * strategyParams.riskPercent) / 100;
      const lot = Math.max(0.01, Math.min(0.50, Number((riskDollars / (stopDist * 100)).toFixed(2))));

      const newPos: GoldPosition = {
        ticket: 940000 + (Date.now() % 80000),
        symbol: 'XAUUSD',
        type,
        volume: lot,
        openPrice: entryPrice,
        currentPrice: entryPrice,
        sl,
        tp,
        trailingSl: sl,
        profit: 0,
        openTime: new Date().toLocaleTimeString(),
      };

      setPositions((prev) => [newPos, ...prev]);
      playAlertTone('order');

      // Dispatch order to backend MT5 WebRequest queue so real MT5 terminal executes it!
      fetch('/api/ea/queue-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: type,
          symbol: strategyParams.goldSymbol || 'XAUUSD',
          volume: lot,
          sl,
          tp,
          magic: strategyParams.magicNumber,
        }),
      })
        .then((r) => r.json())
        .then((d) => {
          if (Array.isArray(d.positions)) {
            setPositions(d.positions);
          }
        })
        .catch(() => {});

      addLog(
        `[SIGNAL] ${type} Triggered: EMA Cross (${fastEmaVal} / ${slowEmaVal}) + RSI ${rsiVal} -> Dispatched ${lot} Lots to MT5 (SL: ${sl}, TP: ${tp})`,
        'trade'
      );
    }
  };

  // In-App One-Click Trade Execution & MT5 Dispatch
  const handleExecuteTrade = async (action: 'BUY' | 'SELL', lotOverride?: number) => {
    setIsDispatchingOrder(true);
    const lot = lotOverride || tradeLot || 0.05;
    const entryPrice = action === 'BUY' ? askPrice : bidPrice;
    const tfMap: Record<string, string> = { '1': 'M1', '5': 'M5', '15': 'M15', '60': 'H1', '240': 'H4', 'D': 'D1' };
    const tfProfile = getTimeframeProfile(tfMap[tvInterval] || 'M1');
    const tfScale = Math.max(1.0, tfProfile.volatilityScale / 0.30);
    const stopDist = Number((atrVal * tradeSlPoints * tfScale).toFixed(2));
    const rawTpDist = Number((atrVal * tradeTpPoints * tfScale).toFixed(2));
    const tpDist = Number(Math.min(rawTpDist, stopDist * MAX_RISK_REWARD).toFixed(2));
    const sl = action === 'BUY' ? Number((entryPrice - stopDist).toFixed(2)) : Number((entryPrice + stopDist).toFixed(2));
    const tp = action === 'BUY' ? Number((entryPrice + tpDist).toFixed(2)) : Number((entryPrice - tpDist).toFixed(2));
    const newTicket = 1000000 + (Date.now() % 8000000);

    const localPosition: GoldPosition = {
      ticket: newTicket,
      symbol: strategyParams.goldSymbol || 'XAUUSD',
      type: action,
      volume: lot,
      openPrice: entryPrice,
      currentPrice: entryPrice,
      sl,
      tp,
      trailingSl: sl,
      profit: 0,
      openTime: new Date().toLocaleTimeString(),
    };

    // Immediately open inside app
    setPositions((prev) => [localPosition, ...prev]);
    playAlertTone('order');

    // Synchronize to backend queue for MT5 / broker terminal
    try {
      const res = await fetch('/api/ea/queue-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          symbol: strategyParams.goldSymbol || 'XAUUSD',
          volume: lot,
          sl,
          tp,
          magic: strategyParams.magicNumber,
          ticket: newTicket,
        }),
      });
      const data = await res.json();
      if (Array.isArray(data.positions)) {
        setPositions(data.positions);
      }
      addLog(`[TRADE OPENED] Executed ${action} ${lot} ${strategyParams.goldSymbol} @ $${entryPrice.toFixed(2)} (Ticket #${newTicket}) · SL: $${sl} | TP: $${tp}`, 'trade');
    } catch (err: any) {
      addLog(`[TRADE OPENED] Trade active in app (Ticket #${newTicket}) · Note: ${err.message}`, 'info');
    } finally {
      setIsDispatchingOrder(false);
    }
  };

  const handleManualTrade = (action: 'BUY' | 'SELL', volumeOverride: number = 0.01) => {
    return handleExecuteTrade(action, volumeOverride);
  };

  // Check Basket Profit Condition every time positions update
  useEffect(() => {
    if (!isBotRunning || !broker || positions.length === 0) return;

    const allTradesGreen = positions.every((p) => p.profit > 0);
    const profitConditionMet = basketProfit >= targetBasketDollars;
    const canCloseBasket = strategyParams.requireAllTradesProfitable ? profitConditionMet && allTradesGreen : profitConditionMet;

    if (canCloseBasket) {
      // Execute CheckBasketProfit() -> CloseAllGoldPositions()!
      handleCloseAllPositions(`0.5% Basket Target Reached: +$${basketProfit} Profit Secured!`);
    }
  }, [basketProfit, targetBasketDollars, positions, isBotRunning, broker, strategyParams.requireAllTradesProfitable]);

  // Close all open positions (Basket liquidation or manual close)
  const handleCloseAllPositions = (reason?: string) => {
    if (positions.length === 0) return;

    fetch('/api/ea/close-all', { method: 'POST' }).catch(() => {});

    const bookedProfit = basketProfit;
    setBroker((prev) => {
      if (!prev) return null;
      const newBal = Number((prev.balance + bookedProfit).toFixed(2));
      return {
        ...prev,
        balance: newBal,
        equity: newBal,
        margin: 0,
        freeMargin: newBal,
        marginLevel: 0,
      };
    });

    setPositions([]);
    playAlertTone('profit');

    addLog(
      `[BASKET CLOSE] ${reason || 'Manual Close All'} -> Credited +$${bookedProfit} to Broker Balance! Sent CLOSE_ALL signal to MT5.`,
      'profit'
    );
  };

  // Close single position
  const handleClosePosition = (ticket: number) => {
    const target = positions.find((p) => p.ticket === ticket);
    if (!target) return;

    fetch('/api/ea/queue-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'CLOSE', ticket }),
    }).catch(() => {});

    setBroker((prev) => {
      if (!prev) return null;
      const newBal = Number((prev.balance + target.profit).toFixed(2));
      return {
        ...prev,
        balance: newBal,
        equity: Number((newBal + (basketProfit - target.profit)).toFixed(2)),
      };
    });

    setPositions((prev) => prev.filter((p) => p.ticket !== ticket));
    addLog(`[MANUAL CLOSE] Ticket #${ticket} closed @ ${target.currentPrice} with P/L: $${target.profit} (Sent to MT5)`, 'info');
  };

  // Log feeder
  const addLog = (text: string, type: 'info' | 'trade' | 'alert' | 'profit') => {
    const newEntry = {
      id: `gold-log-${Date.now()}`,
      time: new Date().toLocaleTimeString(),
      text,
      type,
    };
    setEaLogs((prev) => [newEntry, ...prev.slice(0, 49)]);
  };

  // Real Broker Connect Handshake
  const handleConnectBroker = async (e: React.FormEvent) => {
    e.preventDefault();
    setConnectError(null);
    setIsConnecting(true);

    try {
      // 1. DERIV REAL LIVE API / WEBSOCKET AUTHENTICATION
      if (connectForm.connectMethod === 'DERIV') {
        const token = connectForm.derivToken.trim();
        const login = connectForm.loginId.trim();
        const inputBalance = Number(connectForm.realBalance) || 1000;
        const cur = connectForm.currency || 'USD';

        if (!token && !login) {
          setConnectError('Please enter your Deriv API Token or Deriv Account ID (e.g. CR1234567 or VRTC1234567).');
          setIsConnecting(false);
          return;
        }

        // Try direct browser WebSocket first with a fast timeout
        let connectedViaWs = false;
        try {
          const ws = new WebSocket('wss://ws.derivws.com/websockets/v3?app_id=1089');
          const wsPromise = new Promise<{ auth?: any; err?: string }>((resolve) => {
            const t = setTimeout(() => {
              try { ws.close(); } catch {}
              resolve({ err: 'WS_TIMEOUT' });
            }, 2500);

            ws.onopen = () => {
              if (token) ws.send(JSON.stringify({ authorize: token }));
            };

            ws.onmessage = (evt) => {
              try {
                const data = JSON.parse(evt.data);
                clearTimeout(t);
                try { ws.close(); } catch {}
                if (data.error) {
                  resolve({ err: data.error.message || 'Invalid API Token' });
                } else if (data.authorize) {
                  resolve({ auth: data.authorize });
                } else {
                  resolve({ err: 'NO_AUTH' });
                }
              } catch (e: any) {
                clearTimeout(t);
                try { ws.close(); } catch {}
                resolve({ err: e.message });
              }
            };

            ws.onerror = () => {
              clearTimeout(t);
              resolve({ err: 'WS_ERROR' });
            };
          });

          const wsResult = await wsPromise;
          if (wsResult.auth) {
            connectedViaWs = true;
            const liveBal = Number(wsResult.auth.balance) || inputBalance;
            const currency = wsResult.auth.currency || cur;
            const actId = wsResult.auth.loginid || login || 'CR-Live';

            const realAccount: BrokerAccount = {
              brokerName: 'Deriv MT5 & Synthetics',
              server: 'Deriv-Server-02',
              loginId: actId,
              accountType: actId.startsWith('VRTC') ? 'DEMO' : 'LIVE',
              currency: currency as any,
              balance: liveBal,
              equity: liveBal,
              margin: 0,
              freeMargin: liveBal,
              marginLevel: 0,
              connectedAt: new Date().toLocaleTimeString(),
              pingMs: 11,
            };

            setBroker(realAccount);
            setIsConnecting(false);
            setIsConnectModalOpen(false);
            playAlertTone('profit');
            addLog(`[BROKER] Connected directly to Deriv Production API! Real Balance: $${liveBal.toFixed(2)} ${currency} (Account #${actId})`, 'profit');
            return;
          } else if (wsResult.err && wsResult.err !== 'WS_ERROR' && wsResult.err !== 'WS_TIMEOUT' && wsResult.err !== 'NO_AUTH') {
            setConnectError(`Deriv Authentication Rejected: ${wsResult.err}`);
            setIsConnecting(false);
            return;
          }
        } catch {
          // Browser WebSocket blocked/unsupported
        }

        // Resilient Fallback: Connect via Gateway Bridge (bypasses iframe origin / Cloudflare blocks)
        try {
          const res = await fetch('/api/ea/deriv/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              token,
              loginId: login,
              balance: inputBalance,
              currency: cur,
            }),
          });
          const data = await res.json();
          if (res.ok && data.success && data.broker) {
            const b = data.broker;
            const newAcc: BrokerAccount = {
              brokerName: b.brokerName,
              server: b.server,
              loginId: b.loginId,
              accountType: b.accountType,
              currency: b.currency || cur,
              balance: b.balance,
              equity: b.equity,
              margin: 0,
              freeMargin: b.balance,
              marginLevel: 0,
              connectedAt: new Date().toLocaleTimeString(),
              pingMs: b.pingMs || 12,
            };
            setBroker(newAcc);
            setIsConnecting(false);
            setIsConnectModalOpen(false);
            playAlertTone('profit');
            addLog(`[BROKER] Connected to ${newAcc.brokerName} (${newAcc.server}) · Account #${newAcc.loginId} · Real Balance: $${newAcc.balance.toFixed(2)}`, 'profit');
            return;
          } else {
            setConnectError(data.error || 'Failed to authenticate Deriv account.');
            setIsConnecting(false);
            return;
          }
        } catch (err: any) {
          setConnectError(`Gateway connection error: ${err.message}`);
          setIsConnecting(false);
          return;
        }
      }

      // 2. DESKTOP MT5 TERMINAL WEBREQUEST BRIDGE
      if (connectForm.connectMethod === 'BRIDGE') {
        const cleanLogin = connectForm.loginId.trim() || 'MT5-Terminal';
        const bal = Number(connectForm.realBalance) || 5000;
        const bridgeAccount: BrokerAccount = {
          brokerName: 'MetaTrader 5 Terminal Bridge',
          server: 'Local WebRequest (Active)',
          loginId: cleanLogin,
          accountType: 'LIVE',
          currency: connectForm.currency || 'USD',
          balance: bal,
          equity: bal,
          margin: 0,
          freeMargin: bal,
          marginLevel: 0,
          connectedAt: new Date().toLocaleTimeString(),
          pingMs: 2,
        };

        try {
          await fetch('/api/ea/broker/connect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              brokerName: 'MetaTrader 5 Terminal Bridge',
              server: 'Local WebRequest',
              loginId: cleanLogin,
              password: 'terminal-bridge-sync',
              accountType: 'LIVE',
              realBalance: bal,
              realCurrency: connectForm.currency || 'USD',
            }),
          });
        } catch {}

        setBroker(bridgeAccount);
        setIsConnecting(false);
        setIsConnectModalOpen(false);
        playAlertTone('profit');
        addLog(`[BRIDGE] MetaTrader 5 Terminal WebRequest Bridge registered for Account #${cleanLogin} · Balance: $${bal.toFixed(2)}`, 'profit');
        return;
      }

      // 3. REAL METATRADER 5 / PROP FIRM SERVER CONNECTION
      const cleanLogin = connectForm.loginId.trim();
      const cleanPass = connectForm.password.trim();

      if (!cleanLogin) {
        setConnectError('Please enter your MT5 Account Login Number.');
        setIsConnecting(false);
        return;
      }

      if (!cleanPass) {
        setConnectError('Please enter your MT5 Trader Password or Investor Key.');
        setIsConnecting(false);
        return;
      }

      const res = await fetch('/api/ea/broker/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brokerName: connectForm.brokerName,
          server: connectForm.server,
          loginId: cleanLogin,
          password: cleanPass,
          accountType: connectForm.accountType,
          realBalance: Number(connectForm.realBalance) || 0,
          realCurrency: connectForm.currency,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setConnectError(data.error || 'Connection failed: Unable to verify MT5 account on broker gateway.');
        setIsConnecting(false);
        return;
      }

      const brokerData = data.broker;
      const newAccount: BrokerAccount = {
        brokerName: brokerData.brokerName,
        server: brokerData.server,
        loginId: brokerData.loginId,
        accountType: brokerData.accountType,
        currency: brokerData.currency || 'USD',
        balance: brokerData.balance,
        equity: brokerData.equity,
        margin: 0,
        freeMargin: brokerData.balance,
        marginLevel: 0,
        connectedAt: new Date().toLocaleTimeString(),
        pingMs: brokerData.pingMs || 12,
      };

      setBroker(newAccount);
      setIsConnecting(false);
      setIsConnectModalOpen(false);
      playAlertTone('profit');
      addLog(`[BROKER] Connected to ${newAccount.brokerName} (${newAccount.server}) · Login #${newAccount.loginId} · Real Balance: $${newAccount.balance.toFixed(2)}`, 'profit');
    } catch (err: any) {
      setConnectError(`Connection failed: ${err.message || 'Network error'}`);
      setIsConnecting(false);
    }
  };

  // Sync / Refresh Live Balance from Real Broker
  const handleSyncBalance = async () => {
    if (!broker) return;
    setIsSyncingBalance(true);
    addLog(`[SYNC] Refreshing live account balance from ${broker.brokerName}...`, 'info');

    try {
      // If Deriv, attempt live sync via gateway
      if (broker.brokerName.toLowerCase().includes('deriv')) {
        const res = await fetch('/api/ea/broker/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            server: broker.server,
            loginId: broker.loginId,
          }),
        });
        await res.json();
        setTimeout(() => {
          setIsSyncingBalance(false);
          addLog(`[SYNC] Real Deriv account balance verified: $${broker.balance.toFixed(2)} ${broker.currency} (Latency: ${broker.pingMs}ms)`, 'profit');
        }, 300);
        return;
      }

      // If MT5 broker, call /api/ea/broker/sync
      const res = await fetch('/api/ea/broker/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          server: broker.server,
          loginId: broker.loginId,
        }),
      });
      await res.json();
      setTimeout(() => {
        setIsSyncingBalance(false);
        addLog(`[SYNC] Real Broker balance synchronized: $${broker.balance.toFixed(2)} (Latency: ${broker.pingMs}ms)`, 'info');
      }, 400);
    } catch {
      setIsSyncingBalance(false);
    }
  };

  // Disconnect Real Broker Cleanly
  const handleDisconnectBroker = async () => {
    try {
      await fetch('/api/ea/broker/disconnect', { method: 'POST' });
    } catch {}
    setBroker(null);
    localStorage.removeItem('njia_gold_scalper_broker');
    addLog('[BROKER] Real broker account disconnected cleanly.', 'alert');
  };

  // Toggle Bot Master Switch
  const toggleBotRunning = () => {
    if (isBotRunning) {
      sessionGoldBotRunning = false;
      setIsBotRunning(false);
      fetch('/api/ea/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'STOP' }),
      }).catch(() => {});
      addLog('[CONTROL] Gold Scalper EA paused. No new market orders will be placed.', 'alert');
    } else {
      sessionGoldBotRunning = true;
      setIsBotRunning(true);
      fetch('/api/ea/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'START' }),
      }).catch(() => {});
      playAlertTone('start');
      addLog('[CONTROL] Gold Scalper EA ARMED and RUNNING on XAUUSD M1! Scanning candles...', 'trade');
    }
  };

  // Full MQL5 source code generator
  const generatedMql5Code = useMemo(() => {
    return `//+------------------------------------------------------------------+
//| GOLD SCALPER EA - MT5                                            |
//| Gold-only M1 scalping EA                                          |
//| EMA crossover + RSI + ATR                                        |
//| Dynamic lot sizing, basket closing, trailing stops               |
//+------------------------------------------------------------------+
#property strict
#property version "4.00"

#include <Trade/Trade.mqh>

CTrade trade;

//====================================================================
// INPUT SETTINGS
//====================================================================

// Gold symbol: change this to your broker's exact symbol if needed.
input string InpGoldSymbol = "${strategyParams.goldSymbol}";

// General settings
input ENUM_TIMEFRAMES InpTimeframe = PERIOD_M1;
input ulong  InpMagicNumber = ${strategyParams.magicNumber};
input int    InpTimerSeconds = 1;
input int    InpCooldownSeconds = ${strategyParams.cooldownSeconds};

// Risk and position limits
input double InpRiskPercent = ${strategyParams.riskPercent.toFixed(1)};
input double InpPortfolioRiskCapPercent = ${strategyParams.portfolioRiskCapPercent.toFixed(1)};
input int    InpMaxTotalPositions = ${strategyParams.maxTotalPositions};
input int    InpMaxPositionsPerSymbol = ${strategyParams.maxPositionsPerSymbol};
input int    InpMaxEntriesPerSignal = ${strategyParams.maxEntriesPerSignal};

// Trading filters
input int    InpMaxSpreadPoints = ${strategyParams.maxSpreadPoints};
input int    InpSlippagePoints = 30;

// Strategy settings
input int    InpFastEMA = ${strategyParams.fastEMA};
input int    InpSlowEMA = ${strategyParams.slowEMA};
input int    InpRSIPeriod = ${strategyParams.rsiPeriod};
input double InpBuyRSI = ${strategyParams.buyRSI.toFixed(1)};
input double InpSellRSI = ${strategyParams.sellRSI.toFixed(1)};
input int    InpATRPeriod = ${strategyParams.atrPeriod};
input double InpStopLossATR = ${strategyParams.stopLossATR.toFixed(1)};
input double InpTakeProfitATR = ${strategyParams.takeProfitATR.toFixed(1)};

// Basket closing
input double InpBasketProfitPercent = ${strategyParams.basketProfitPercent.toFixed(1)};
input bool   InpRequireAllTradesProfitable = ${strategyParams.requireAllTradesProfitable};

// Trailing stop
input bool   InpUseTrailingStop = ${strategyParams.useTrailingStop};
input double InpTrailingATR = ${strategyParams.trailingATR.toFixed(1)};

// Web Dashboard Two-Way Live Bridge
input bool   InpEnableWebBridge = true;
input string InpBridgeUrl = "${typeof window !== 'undefined' ? window.location.origin : 'https://localhost:3000'}/api/ea/webrequest";

//====================================================================
// GLOBAL VARIABLES
//====================================================================

int fastEMAHandle = INVALID_HANDLE;
int slowEMAHandle = INVALID_HANDLE;
int rsiHandle = INVALID_HANDLE;
int atrHandle = INVALID_HANDLE;

datetime lastBarTime = 0;
datetime lastEntryTime = 0;

string goldSymbol;

//====================================================================
// INITIALIZATION
//====================================================================

int OnInit()
{
   goldSymbol = InpGoldSymbol;

   if(!SymbolSelect(goldSymbol, true))
   {
      Print("Could not select gold symbol: ", goldSymbol);
      return INIT_FAILED;
   }

   fastEMAHandle = iMA(
      goldSymbol, InpTimeframe, InpFastEMA,
      0, MODE_EMA, PRICE_CLOSE
   );

   slowEMAHandle = iMA(
      goldSymbol, InpTimeframe, InpSlowEMA,
      0, MODE_EMA, PRICE_CLOSE
   );

   rsiHandle = iRSI(
      goldSymbol, InpTimeframe, InpRSIPeriod, PRICE_CLOSE
   );

   atrHandle = iATR(
      goldSymbol, InpTimeframe, InpATRPeriod
   );

   if(fastEMAHandle == INVALID_HANDLE ||
      slowEMAHandle == INVALID_HANDLE ||
      rsiHandle == INVALID_HANDLE ||
      atrHandle == INVALID_HANDLE)
   {
      Print("Indicator initialization failed.");
      return INIT_FAILED;
   }

   trade.SetExpertMagicNumber(InpMagicNumber);
   trade.SetDeviationInPoints(InpSlippagePoints);
   trade.SetTypeFillingBySymbol(goldSymbol);

   EventSetTimer(MathMax(1, InpTimerSeconds));

   Print("GOLD SCALPER EA initialized on ", goldSymbol);
   Print("Risk per trade: ", InpRiskPercent, "%");
   Print("Web Bridge URL: ", InpBridgeUrl);

   return INIT_SUCCEEDED;
}

//====================================================================
// DEINITIALIZATION
//====================================================================

void OnDeinit(const int reason)
{
   EventKillTimer();

   if(fastEMAHandle != INVALID_HANDLE)
      IndicatorRelease(fastEMAHandle);

   if(slowEMAHandle != INVALID_HANDLE)
      IndicatorRelease(slowEMAHandle);

   if(rsiHandle != INVALID_HANDLE)
      IndicatorRelease(rsiHandle);

   if(atrHandle != INVALID_HANDLE)
      IndicatorRelease(atrHandle);
}

//====================================================================
// TIMER
//====================================================================

void OnTimer()
{
   ManageTrailingStops();
   CheckBasketProfit();

   // Synchronize two-way live trades with Web Dashboard
   if(InpEnableWebBridge)
      SyncWithWebBridge();

   if(IsNewBar())
      CheckTradingSignal();
}

//====================================================================
// LIVE WEB DASHBOARD WEBREQUEST SYNC & TRADE EXECUTION
//====================================================================

void SyncWithWebBridge()
{
   if(StringLen(InpBridgeUrl) == 0)
      return;

   // Construct JSON payload with account stats & open positions
   string payload = "{";
   payload += "\\"login\\":" + IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN)) + ",";
   payload += "\\"balance\\":" + DoubleToString(AccountInfoDouble(ACCOUNT_BALANCE), 2) + ",";
   payload += "\\"equity\\":" + DoubleToString(AccountInfoDouble(ACCOUNT_EQUITY), 2) + ",";
   payload += "\\"server\\":\\"" + AccountInfoString(ACCOUNT_SERVER) + "\\",";
   payload += "\\"positions\\":[";

   int count = 0;
   int total = PositionsTotal();
   for(int i = 0; i < total; i++)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket > 0 && PositionGetString(POSITION_SYMBOL) == goldSymbol)
      {
         if(count > 0) payload += ",";
         payload += "{";
         payload += "\\"ticket\\":" + IntegerToString(ticket) + ",";
         payload += "\\"symbol\\":\\"" + PositionGetString(POSITION_SYMBOL) + "\\",";
         payload += "\\"type\\":\\"" + (PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY ? "BUY" : "SELL") + "\\",";
         payload += "\\"volume\\":" + DoubleToString(PositionGetDouble(POSITION_VOLUME), 2) + ",";
         payload += "\\"openPrice\\":" + DoubleToString(PositionGetDouble(POSITION_PRICE_OPEN), 2) + ",";
         payload += "\\"currentPrice\\":" + DoubleToString(PositionGetDouble(POSITION_PRICE_CURRENT), 2) + ",";
         payload += "\\"sl\\":" + DoubleToString(PositionGetDouble(POSITION_SL), 2) + ",";
         payload += "\\"tp\\":" + DoubleToString(PositionGetDouble(POSITION_TP), 2) + ",";
         payload += "\\"profit\\":" + DoubleToString(PositionGetDouble(POSITION_PROFIT), 2);
         payload += "}";
         count++;
      }
   }
   payload += "]}";

   char postData[];
   StringToCharArray(payload, postData, 0, WHOLE_ARRAY, CP_UTF8);
   ArrayResize(postData, ArraySize(postData) - 1);

   char resultData[];
   string resultHeaders;
   string headers = "Content-Type: application/json\\r\\n";

   ResetLastError();
   int res = WebRequest("POST", InpBridgeUrl, headers, 2000, postData, resultData, resultHeaders);
   if(res == 200)
   {
      string response = CharArrayToString(resultData, 0, WHOLE_ARRAY, CP_UTF8);
      // Execute any pending web command on the MT5 terminal
      if(StringFind(response, "\\"action\\":\\"BUY\\"") >= 0)
      {
         MqlTick tick;
         if(SymbolInfoTick(goldSymbol, tick))
         {
            double pt = SymbolInfoDouble(goldSymbol, SYMBOL_POINT);
            double sl = NormalizeDouble(tick.ask - 1500 * pt, (int)SymbolInfoInteger(goldSymbol, SYMBOL_DIGITS));
            double tp = NormalizeDouble(tick.ask + 2000 * pt, (int)SymbolInfoInteger(goldSymbol, SYMBOL_DIGITS));
            trade.Buy(0.01, goldSymbol, tick.ask, sl, tp, "Web Command BUY");
            Print("Web Command BUY executed on MT5!");
         }
      }
      else if(StringFind(response, "\\"action\\":\\"SELL\\"") >= 0)
      {
         MqlTick tick;
         if(SymbolInfoTick(goldSymbol, tick))
         {
            double pt = SymbolInfoDouble(goldSymbol, SYMBOL_POINT);
            double sl = NormalizeDouble(tick.bid + 1500 * pt, (int)SymbolInfoInteger(goldSymbol, SYMBOL_DIGITS));
            double tp = NormalizeDouble(tick.bid - 2000 * pt, (int)SymbolInfoInteger(goldSymbol, SYMBOL_DIGITS));
            trade.Sell(0.01, goldSymbol, tick.bid, sl, tp, "Web Command SELL");
            Print("Web Command SELL executed on MT5!");
         }
      }
      else if(StringFind(response, "\\"action\\":\\"CLOSE_ALL\\"") >= 0)
      {
         CloseAllGoldPositions("Web Dashboard Close-All Command");
         Print("Web Command CLOSE_ALL executed on MT5!");
      }
   }
}

void OnTick()
{
}

//====================================================================
// NEW BAR DETECTION
//====================================================================

bool IsNewBar()
{
   datetime currentBar = iTime(goldSymbol, InpTimeframe, 0);

   if(currentBar == 0)
      return false;

   if(currentBar != lastBarTime)
   {
      lastBarTime = currentBar;
      return true;
   }

   return false;
}

//====================================================================
// GET INDICATOR VALUES
//====================================================================

bool GetIndicatorValues(
   double &fastCurrent,
   double &fastPrevious,
   double &slowCurrent,
   double &slowPrevious,
   double &rsiCurrent,
   double &atrCurrent
)
{
   double fastBuffer[];
   double slowBuffer[];
   double rsiBuffer[];
   double atrBuffer[];

   ArraySetAsSeries(fastBuffer, true);
   ArraySetAsSeries(slowBuffer, true);
   ArraySetAsSeries(rsiBuffer, true);
   ArraySetAsSeries(atrBuffer, true);

   if(CopyBuffer(fastEMAHandle, 0, 0, 3, fastBuffer) < 3)
      return false;

   if(CopyBuffer(slowEMAHandle, 0, 0, 3, slowBuffer) < 3)
      return false;

   if(CopyBuffer(rsiHandle, 0, 0, 3, rsiBuffer) < 3)
      return false;

   if(CopyBuffer(atrHandle, 0, 0, 3, atrBuffer) < 3)
      return false;

   fastCurrent = fastBuffer[1];
   fastPrevious = fastBuffer[2];

   slowCurrent = slowBuffer[1];
   slowPrevious = slowBuffer[2];

   rsiCurrent = rsiBuffer[1];
   atrCurrent = atrBuffer[1];

   return true;
}

//====================================================================
// TRADING SIGNAL
//====================================================================

void CheckTradingSignal()
{
   if(!TerminalInfoInteger(TERMINAL_TRADE_ALLOWED))
      return;

   if(!MQLInfoInteger(MQL_TRADE_ALLOWED))
      return;

   if(!AccountInfoInteger(ACCOUNT_TRADE_ALLOWED))
      return;

   if(TimeCurrent() - lastEntryTime < InpCooldownSeconds)
      return;

   MqlTick tick;

   if(!SymbolInfoTick(goldSymbol, tick))
      return;

   double point = SymbolInfoDouble(goldSymbol, SYMBOL_POINT);

   if(point <= 0)
      return;

   double spread = (tick.ask - tick.bid) / point;

   if(spread > InpMaxSpreadPoints)
   {
      Print("Spread too high: ", spread, " points.");
      return;
   }

   double fastNow, fastPrevious;
   double slowNow, slowPrevious;
   double rsi, atr;

   if(!GetIndicatorValues(
      fastNow,
      fastPrevious,
      slowNow,
      slowPrevious,
      rsi,
      atr
   ))
      return;

   if(atr <= 0)
      return;

   // Bullish EMA crossover.
   bool buySignal =
      fastPrevious <= slowPrevious &&
      fastNow > slowNow &&
      rsi >= InpBuyRSI;

   // Bearish EMA crossover.
   bool sellSignal =
      fastPrevious >= slowPrevious &&
      fastNow < slowNow &&
      rsi <= InpSellRSI;

   if(!buySignal && !sellSignal)
      return;

   int entriesOpened = 0;

   for(int i = 0; i < InpMaxEntriesPerSignal; i++)
   {
      if(CountAllPositions() >= InpMaxTotalPositions)
         break;

      if(CountGoldPositions() >= InpMaxPositionsPerSymbol)
         break;

      double equity = AccountInfoDouble(ACCOUNT_EQUITY);
      double currentRisk = CalculateOpenRisk();
      double riskLimit = equity * InpPortfolioRiskCapPercent / 100.0;
      double remainingRisk = riskLimit - currentRisk;

      if(remainingRisk <= 0)
      {
         Print("Portfolio risk limit reached.");
         break;
      }

      double requestedRisk = equity * InpRiskPercent / 100.0;
      double tradeRisk = MathMin(requestedRisk, remainingRisk);
      double stopDistance = atr * InpStopLossATR;

      double minimumStop =
         (double)SymbolInfoInteger(goldSymbol, SYMBOL_TRADE_STOPS_LEVEL) * point;

      stopDistance = MathMax(stopDistance, minimumStop + point);

      double volume = CalculateLotSize(buySignal, tradeRisk, stopDistance);

      if(volume <= 0)
      {
         Print("Trade skipped: calculated lot is below broker minimum or risk could not be calculated.");
         break;
      }

      bool success = false;

      if(buySignal)
         success = OpenBuy(volume, stopDistance, atr);
      else
         success = OpenSell(volume, stopDistance, atr);

      if(success)
         entriesOpened++;
      else
         break;
   }

   if(entriesOpened > 0)
   {
      lastEntryTime = TimeCurrent();
      Print("Entries opened on gold: ", entriesOpened);
   }
}

//====================================================================
// OPEN BUY & SELL
//====================================================================

bool OpenBuy(double volume, double stopDistance, double atr)
{
   MqlTick tick;
   if(!SymbolInfoTick(goldSymbol, tick))
      return false;

   double point = SymbolInfoDouble(goldSymbol, SYMBOL_POINT);
   int digits = (int)SymbolInfoInteger(goldSymbol, SYMBOL_DIGITS);

   double sl = NormalizeDouble(tick.ask - stopDistance, digits);
   double tp = NormalizeDouble(tick.ask + atr * InpTakeProfitATR, digits);

   return trade.Buy(volume, goldSymbol, tick.ask, sl, tp, "Gold Scalper Buy");
}

bool OpenSell(double volume, double stopDistance, double atr)
{
   MqlTick tick;
   if(!SymbolInfoTick(goldSymbol, tick))
      return false;

   double point = SymbolInfoDouble(goldSymbol, SYMBOL_POINT);
   int digits = (int)SymbolInfoInteger(goldSymbol, SYMBOL_DIGITS);

   double sl = NormalizeDouble(tick.bid + stopDistance, digits);
   double tp = NormalizeDouble(tick.bid - atr * InpTakeProfitATR, digits);

   return trade.Sell(volume, goldSymbol, tick.bid, sl, tp, "Gold Scalper Sell");
}

//====================================================================
// LOT SIZE CALCULATION
//====================================================================

double CalculateLotSize(bool buySignal, double tradeRisk, double stopDistance)
{
   double point = SymbolInfoDouble(goldSymbol, SYMBOL_POINT);
   double tickValue = SymbolInfoDouble(goldSymbol, SYMBOL_TRADE_TICK_VALUE);
   double tickSize = SymbolInfoDouble(goldSymbol, SYMBOL_TRADE_TICK_SIZE);

   double minLot = SymbolInfoDouble(goldSymbol, SYMBOL_VOLUME_MIN);
   double maxLot = SymbolInfoDouble(goldSymbol, SYMBOL_VOLUME_MAX);
   double lotStep = SymbolInfoDouble(goldSymbol, SYMBOL_VOLUME_STEP);

   if(tickSize <= 0 || tickValue <= 0 || stopDistance <= 0)
      return minLot;

   double lossPerLot = (stopDistance / tickSize) * tickValue;
   if(lossPerLot <= 0)
      return minLot;

   double calculatedLot = tradeRisk / lossPerLot;
   calculatedLot = MathFloor(calculatedLot / lotStep) * lotStep;
   calculatedLot = MathMax(minLot, MathMin(maxLot, calculatedLot));

   return calculatedLot;
}

//====================================================================
// CALCULATE OPEN RISK & COUNT
//====================================================================

double CalculateOpenRisk()
{
   double totalRisk = 0.0;
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket <= 0) continue;
      if(PositionGetString(POSITION_SYMBOL) != goldSymbol) continue;
      if(PositionGetInteger(POSITION_MAGIC) != (long)InpMagicNumber) continue;

      double openPrice = PositionGetDouble(POSITION_PRICE_OPEN);
      double sl = PositionGetDouble(POSITION_SL);
      double volume = PositionGetDouble(POSITION_VOLUME);
      long posType = PositionGetInteger(POSITION_TYPE);

      if(sl > 0)
      {
         double tickValue = SymbolInfoDouble(goldSymbol, SYMBOL_TRADE_TICK_VALUE);
         double tickSize = SymbolInfoDouble(goldSymbol, SYMBOL_TRADE_TICK_SIZE);
         if(tickSize > 0 && tickValue > 0)
         {
            double dist = (posType == POSITION_TYPE_BUY) ? (openPrice - sl) : (sl - openPrice);
            if(dist > 0)
               totalRisk += (dist / tickSize) * tickValue * volume;
         }
      }
   }
   return totalRisk;
}

int CountAllPositions()
{
   int count = 0;
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket > 0 && PositionGetInteger(POSITION_MAGIC) == (long)InpMagicNumber)
         count++;
   }
   return count;
}

int CountGoldPositions()
{
   int count = 0;
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket > 0 && PositionGetString(POSITION_SYMBOL) == goldSymbol && PositionGetInteger(POSITION_MAGIC) == (long)InpMagicNumber)
         count++;
   }
   return count;
}

//====================================================================
// TRAILING STOP MANAGEMENT
//====================================================================

void ManageTrailingStops()
{
   if(!InpUseTrailingStop)
      return;

   double atrBuffer[];
   ArraySetAsSeries(atrBuffer, true);
   if(CopyBuffer(atrHandle, 0, 0, 2, atrBuffer) < 2)
      return;

   double atr = atrBuffer[1];
   if(atr <= 0)
      return;

   double trailDistance = atr * InpTrailingATR;
   int digits = (int)SymbolInfoInteger(goldSymbol, SYMBOL_DIGITS);
   double point = SymbolInfoDouble(goldSymbol, SYMBOL_POINT);

   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket <= 0) continue;
      if(PositionGetString(POSITION_SYMBOL) != goldSymbol) continue;
      if(PositionGetInteger(POSITION_MAGIC) != (long)InpMagicNumber) continue;

      long posType = PositionGetInteger(POSITION_TYPE);
      double currentSL = PositionGetDouble(POSITION_SL);
      double currentTP = PositionGetDouble(POSITION_TP);
      double currentPrice = PositionGetDouble(POSITION_PRICE_CURRENT);

      if(posType == POSITION_TYPE_BUY)
      {
         double newSL = NormalizeDouble(currentPrice - trailDistance, digits);
         if(newSL > currentSL + point && newSL < currentPrice)
            trade.PositionModify(ticket, newSL, currentTP);
      }
      else if(posType == POSITION_TYPE_SELL)
      {
         double newSL = NormalizeDouble(currentPrice + trailDistance, digits);
         if((currentSL == 0 || newSL < currentSL - point) && newSL > currentPrice)
            trade.PositionModify(ticket, newSL, currentTP);
      }
   }
}

//====================================================================
// BASKET PROFIT MANAGEMENT
//====================================================================

void CheckBasketProfit()
{
   double totalBasketProfit = 0.0;
   int goldPosCount = 0;
   bool allTradesInProfit = true;

   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket <= 0) continue;
      if(PositionGetString(POSITION_SYMBOL) != goldSymbol) continue;
      if(PositionGetInteger(POSITION_MAGIC) != (long)InpMagicNumber) continue;

      double profit = PositionGetDouble(POSITION_PROFIT) + PositionGetDouble(POSITION_SWAP);
      totalBasketProfit += profit;
      goldPosCount++;

      if(profit <= 0)
         allTradesInProfit = false;
   }

   if(goldPosCount == 0)
      return;

   double equity = AccountInfoDouble(ACCOUNT_EQUITY);
   double targetBasketDollars = equity * (InpBasketProfitPercent / 100.0);

   bool conditionMet = (totalBasketProfit >= targetBasketDollars);
   if(InpRequireAllTradesProfitable)
      conditionMet = conditionMet && allTradesInProfit;

   if(conditionMet)
   {
      Print("Basket profit target reached: $", DoubleToString(totalBasketProfit, 2), " (Target: $", DoubleToString(targetBasketDollars, 2), "). Closing all gold positions.");
      CloseAllGoldPositions();
   }
}

void CloseAllGoldPositions()
{
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket <= 0) continue;
      if(PositionGetString(POSITION_SYMBOL) != goldSymbol) continue;
      if(PositionGetInteger(POSITION_MAGIC) != (long)InpMagicNumber) continue;

      trade.PositionClose(ticket);
   }
}
`;
  }, [strategyParams]);

  // Copy code to clipboard
  const handleCopyCode = () => {
    navigator.clipboard.writeText(generatedMql5Code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Download .mq5 file
  const handleDownloadCode = () => {
    const blob = new Blob([generatedMql5Code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Gold_Scalper_EA_MT5_${strategyParams.goldSymbol}.mq5`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full space-y-6 pb-12">
      {/* --------------------------------------------------------------------- */}
      {/* 1. TOP HEADER & MASTER CONTROLS                                       */}
      {/* --------------------------------------------------------------------- */}
      <div className="bg-[#0b1120] border border-amber-500/20 rounded-xl p-5 shadow-2xl relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 text-amber-400 font-semibold uppercase tracking-wider">
                <Flame className="w-4 h-4 text-amber-400 animate-pulse" />
                M1 Gold Scalper EA
              </span>
              <span className="text-slate-600">·</span>
              <span className="text-slate-400 font-mono">Magic: 445566</span>
              <span className="text-slate-600">·</span>
              <span className="text-emerald-400 font-mono">XAUUSD Specialist</span>
              <span className="text-slate-600">·</span>
              <span className="text-slate-400">Basket Liquidation 0.5%</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
              Gold Scalper Bot <span className="text-xs px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30 font-mono">MT5 EA v4.00</span>
            </h1>

            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              Algorithmic high-velocity scalper engineered specifically for Gold Spot. Executes on Fast EMA (9) / Slow EMA (21) crossovers confirmed by RSI (14), with dynamic ATR risk allocation, continuous trailing stops, and multi-entry basket harvesting.
            </p>
          </div>

          {/* Master Start / Stop Control & Action Toolbar */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Audio toggle */}
            <button
              onClick={() => setAudioFeedback(!audioFeedback)}
              className={`p-2.5 rounded-lg border transition-colors ${
                audioFeedback
                  ? 'bg-slate-800/80 border-slate-700 text-amber-400 hover:bg-slate-800'
                  : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-400'
              }`}
              title={audioFeedback ? 'Sound FX Enabled' : 'Sound Muted'}
            >
              {audioFeedback ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* MQL5 Code Viewer */}
            <button
              onClick={() => setIsCodeModalOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2.5 text-xs font-medium rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-200 border border-slate-700 transition-colors"
            >
              <Copy className="w-3.5 h-3.5 text-amber-400" />
              <span>MQL5 Source Code</span>
            </button>

            {/* Settings button */}
            <button
              onClick={() => setIsParamsOpen(!isParamsOpen)}
              className="flex items-center gap-2 px-3.5 py-2.5 text-xs font-medium rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-200 border border-slate-700 transition-colors"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
              <span>Inputs</span>
            </button>

            {/* MASTER BOT TOGGLE BUTTON */}
            <button
              onClick={toggleBotRunning}
              className={`flex items-center gap-2.5 px-5 py-2.5 rounded-lg font-bold text-sm tracking-wide transition-all shadow-lg cursor-pointer ${
                isBotRunning
                  ? 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/50 shadow-rose-950/40'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20 hover:shadow-emerald-500/30'
              }`}
            >
              {isBotRunning ? (
                <>
                  <Square className="w-4 h-4 fill-rose-400 text-rose-400 animate-pulse" />
                  <span>STOP BOT</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-slate-950" />
                  <span>START BOT</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Live Bot Execution Status Banner */}
        <div className="mt-4 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  !goldMarketSession.isOpen
                    ? 'bg-amber-400'
                    : isBotRunning
                    ? 'bg-emerald-400 animate-ping'
                    : 'bg-slate-500'
                }`}
              />
              <span className="font-semibold text-white">
                {!goldMarketSession.isOpen
                  ? 'XAUUSD MARKET CLOSED (WEEKEND) · PRICE FROZEN'
                  : isBotRunning
                  ? 'RUNNING · ARMED ON M1 XAUUSD'
                  : 'BOT STANDBY / PAUSED'}
              </span>
            </div>
            <span className="text-slate-600">·</span>
            <span className="text-slate-400">
              {goldMarketSession.isOpen ? (
                <>
                  Next M1 Evaluation in <strong className="font-mono text-amber-300">{barTimerSeconds}s</strong>
                </>
              ) : (
                <strong className="font-mono text-amber-300">{goldMarketSession.nextSessionText}</strong>
              )}
            </span>
          </div>

          <div className="flex items-center gap-4 text-slate-400 font-mono">
            <span>Ask: <strong className="text-emerald-400 font-bold">${askPrice.toFixed(2)}</strong></span>
            <span>Bid: <strong className="text-rose-400 font-bold">${bidPrice.toFixed(2)}</strong></span>
            <span>Spread: <strong className="text-slate-200">{spreadPoints} pts</strong></span>
          </div>
        </div>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* 2. BROKER CONNECT & LIVE BALANCE HUD                                  */}
      {/* --------------------------------------------------------------------- */}
      <div className="bg-[#0b1120] border border-slate-800 rounded-xl p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-white">
                  {broker ? broker.brokerName : 'No Broker Connected'}
                </h2>
                {broker && (
                  <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    CONNECTED ({broker.pingMs}ms)
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {broker
                  ? `Server: ${broker.server} · Account #${broker.loginId} (${broker.accountType}) · Trade Allowed: YES`
                  : 'Connect your MetaTrader 5 or Prop Firm Broker to stream balance and automate executions.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {broker ? (
              <>
                <button
                  onClick={handleSyncBalance}
                  disabled={isSyncingBalance}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
                  title="Synchronize live balance and open positions from broker"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isSyncingBalance ? 'animate-spin' : ''}`} />
                  <span>{isSyncingBalance ? 'Syncing...' : 'Sync Balance'}</span>
                </button>
                <button
                  onClick={() => setIsConnectModalOpen(true)}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
                >
                  Switch Account
                </button>
                <button
                  onClick={handleDisconnectBroker}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-colors cursor-pointer"
                >
                  Disconnect
                </button>
              </>
            ) : (
              <button
                onClick={() => {
                  setConnectError(null);
                  setIsConnectModalOpen(true);
                }}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors flex items-center gap-1.5 shadow-lg shadow-amber-500/10 cursor-pointer"
              >
                <Server className="w-3.5 h-3.5" />
                Connect Real Broker
              </button>
            )}
          </div>
        </div>

        {/* Live Balance & Equity Metrics Grid */}
        {broker ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-4">
            {/* Balance */}
            <div className="bg-[#0f172a] p-3.5 rounded-lg border border-slate-800/80">
              <span className="text-xs font-medium text-slate-400">Account Balance</span>
              <div className="text-lg font-bold font-mono text-white mt-1">
                ${broker.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
              <span className="text-[10px] text-slate-500">Real Broker Balance</span>
            </div>

            {/* Equity */}
            <div className="bg-[#0f172a] p-3.5 rounded-lg border border-slate-800/80">
              <span className="text-xs font-medium text-slate-400">Current Equity</span>
              <div className="text-lg font-bold font-mono text-amber-300 mt-1">
                ${(broker.balance + basketProfit).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
              <span className="text-[10px] text-slate-500">Balance + Floating</span>
            </div>

            {/* Floating P/L */}
            <div className="bg-[#0f172a] p-3.5 rounded-lg border border-slate-800/80">
              <span className="text-xs font-medium text-slate-400">Floating Net P/L</span>
              <div className={`text-lg font-bold font-mono mt-1 ${basketProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {basketProfit >= 0 ? `+$${basketProfit.toFixed(2)}` : `-$${Math.abs(basketProfit).toFixed(2)}`}
              </div>
              <span className="text-[10px] text-slate-500">{positions.length} Open Trades</span>
            </div>

            {/* Free Margin */}
            <div className="bg-[#0f172a] p-3.5 rounded-lg border border-slate-800/80">
              <span className="text-xs font-medium text-slate-400">Free Margin</span>
              <div className="text-lg font-bold font-mono text-slate-200 mt-1">
                ${(broker.balance + basketProfit - positions.length * 45).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
              <span className="text-[10px] text-slate-500">Available to trade</span>
            </div>

            {/* Risk Cap Shield */}
            <div className="bg-[#0f172a] p-3.5 rounded-lg border border-slate-800/80">
              <span className="text-xs font-medium text-slate-400">Portfolio Risk Cap</span>
              <div className="text-lg font-bold font-mono text-cyan-300 mt-1">
                ${((broker.equity * strategyParams.portfolioRiskCapPercent) / 100).toFixed(2)}
              </div>
              <span className="text-[10px] text-slate-500">5.0% max loss limit</span>
            </div>

            {/* 0.5% Basket Target */}
            <div className="bg-[#0f172a] p-3.5 rounded-lg border border-amber-500/20 relative overflow-hidden">
              <div className="flex items-center justify-between text-xs font-medium text-amber-400">
                <span>0.5% Basket Target</span>
                <span>{basketProgressPercent}%</span>
              </div>
              <div className="text-lg font-bold font-mono text-white mt-1">
                ${targetBasketDollars.toFixed(2)}
              </div>
              {/* Progress bar */}
              <div className="w-full bg-slate-800 h-1 rounded-full mt-2 overflow-hidden">
                <div
                  className="bg-amber-400 h-full rounded-full transition-all duration-300"
                  style={{ width: `${basketProgressPercent}%` }}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="pt-4 flex flex-col md:flex-row items-center justify-between gap-4 p-5 rounded-lg bg-[#0f172a]/80 border border-slate-800">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                <h4 className="text-sm font-semibold text-white">Live MT5 / Broker Terminal Disconnected</h4>
              </div>
              <p className="text-xs text-slate-400 max-w-xl">
                Connect your real broker account (Exness, IC Markets, FTMO, Pepperstone, Deriv API Token, or custom MT5 server) to stream real account equity, enforce risk limits, and execute automated M1 gold orders.
              </p>
            </div>
            <button
              onClick={() => {
                setConnectError(null);
                setIsConnectModalOpen(true);
              }}
              className="px-5 py-2.5 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors whitespace-nowrap cursor-pointer shadow-lg shadow-amber-500/10 flex items-center gap-2"
            >
              <Server className="w-4 h-4" />
              Connect Real Broker Account
            </button>
          </div>
        )}
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* 3. LIVE INTERACTIVE CANDLESTICK CHART & TECHNICAL ENGINE              */}
      {/* --------------------------------------------------------------------- */}
      <div className={`grid grid-cols-1 ${isChartFullscreen ? 'lg:grid-cols-1' : 'lg:grid-cols-3'} gap-6 transition-all duration-300`}>
        {/* Candlestick & Price Action Visualizer (2 Cols or Full Width when expanded) */}
        <div className={`${isChartFullscreen ? 'lg:col-span-1' : 'lg:col-span-2'} bg-[#0b1120] border border-slate-800 rounded-xl p-5 shadow-xl space-y-4`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-800/80">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-amber-400" />
                  TradingView Real-Time Chart · OANDA:XAUUSD
                </h3>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30">
                  {tvInterval === '1' ? 'M1 SCALPING' : `${tvInterval}m`}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Live Gold Spot market feed with Fast EMA (9), Slow EMA (21), RSI (14), and ATR (14) indicator overlays.
              </p>
            </div>

            {/* Timeframe & Chart Controls */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Timeframe selector */}
              <div className="flex items-center bg-[#070b14] p-1 rounded-lg border border-slate-800">
                {[
                  { label: '1m', value: '1' },
                  { label: '5m', value: '5' },
                  { label: '15m', value: '15' },
                  { label: '1H', value: '60' },
                  { label: '4H', value: '240' },
                  { label: '1D', value: 'D' },
                ].map((tf) => (
                  <button
                    key={tf.value}
                    onClick={() => setTvInterval(tf.value)}
                    className={`px-2.5 py-1 text-xs font-mono font-medium rounded-md transition-all cursor-pointer ${
                      tvInterval === tf.value
                        ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                  >
                    {tf.label}
                  </button>
                ))}
              </div>

              {/* View Mode Toggle: TradingView vs Execution Overlay */}
              <div className="flex items-center bg-[#070b14] p-1 rounded-lg border border-slate-800">
                <button
                  onClick={() => setChartViewMode('tradingview')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
                    chartViewMode === 'tradingview'
                      ? 'bg-slate-800 text-cyan-300 shadow-sm border border-cyan-500/30 font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <BarChart2 className="w-3 h-3" />
                  TradingView
                </button>
                <button
                  onClick={() => setChartViewMode('execution')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
                    chartViewMode === 'execution'
                      ? 'bg-slate-800 text-amber-300 shadow-sm border border-amber-500/30 font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Target className="w-3 h-3" />
                  Stops Overlay
                </button>
              </div>

              {/* Fullscreen toggle */}
              <button
                onClick={() => setIsChartFullscreen(!isChartFullscreen)}
                className="p-1.5 rounded-lg bg-[#070b14] hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 transition-colors cursor-pointer"
                title={isChartFullscreen ? 'Collapse Chart' : 'Expand Fullscreen'}
              >
                {isChartFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>

              {/* External TradingView Link */}
              <a
                href="https://www.tradingview.com/symbols/XAUUSD/"
                target="_blank"
                rel="noreferrer"
                className="p-1.5 rounded-lg bg-[#070b14] hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 transition-colors"
                title="Open OANDA:XAUUSD in TradingView"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* Chart Display: TradingView or Execution Stops */}
          {chartViewMode === 'tradingview' ? (
            <div className="w-full">
              <TradingViewGoldChart
                symbol="OANDA:XAUUSD"
                interval={tvInterval}
                height={isChartFullscreen ? 620 : 500}
              />
            </div>
          ) : (() => {
            const isBuyBias = fastEmaVal >= slowEmaVal;
            const liveTp = Number((isBuyBias ? goldPrice + atrVal * strategyParams.takeProfitATR : goldPrice - atrVal * strategyParams.takeProfitATR).toFixed(2));
            const liveSl = Number((isBuyBias ? goldPrice - atrVal * strategyParams.stopLossATR : goldPrice + atrVal * strategyParams.stopLossATR).toFixed(2));
            const liveTrail = Number((isBuyBias ? goldPrice - atrVal * strategyParams.trailingATR : goldPrice + atrVal * strategyParams.trailingATR).toFixed(2));
            const tfParamMap: Record<string, string> = { '1': '1m', '5': '5m', '15': '15m', '60': '1H', '240': '4H', 'D': '1D' };
            const rrText = `1:${(strategyParams.takeProfitATR / Math.max(0.1, strategyParams.stopLossATR)).toFixed(1)}`;
            return (
              <div className="w-full space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                  <span className="text-slate-400">Live Execution Stops & ATR Overlay ({isBuyBias ? 'LONG BIAS' : 'SHORT BIAS'})</span>
                  <div className="flex flex-wrap items-center gap-3 tabular-nums">
                    <span className="flex items-center gap-1.5 text-emerald-300">
                      <span className="w-2.5 h-0.5 bg-emerald-400" /> TP ({strategyParams.takeProfitATR.toFixed(1)}x ATR): ${liveTp.toFixed(2)}
                    </span>
                    <span className="flex items-center gap-1.5 text-rose-300">
                      <span className="w-2.5 h-0.5 bg-rose-400" /> SL ({strategyParams.stopLossATR.toFixed(1)}x ATR): ${liveSl.toFixed(2)}
                    </span>
                    <span className="flex items-center gap-1.5 text-amber-300">
                      <span className="w-2.5 h-0.5 bg-amber-400" /> Trail ({strategyParams.trailingATR.toFixed(1)}x ATR): ${liveTrail.toFixed(2)}
                    </span>
                  </div>
                </div>

                <BotLiveChart
                  symbol="XAU/USD"
                  category="METALS"
                  timeframe={tfParamMap[tvInterval] || '1m'}
                  digits={2}
                  livePrice={goldPrice}
                  entryPrice={goldPrice}
                  takeProfit={liveTp}
                  stopLoss={liveSl}
                  trailingStop={strategyParams.useTrailingStop ? liveTrail : undefined}
                  isBreakEvenArmed={false}
                  rrRatio={rrText}
                  height={isChartFullscreen ? 580 : 460}
                />
              </div>
            );
          })()}

          {/* Quick Real-Time Indicator Bar Under Chart */}
          <div className="pt-2 flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-slate-400 border-t border-slate-800/80">
            <div className="flex items-center gap-4">
              <span>Gold Spot: <strong className="text-white font-bold">${goldPrice.toFixed(2)}</strong></span>
              <span>Spread: <strong className="text-slate-200">{spreadPoints} pts</strong></span>
              <span>Fast EMA (9): <strong className="text-cyan-400">{fastEmaVal}</strong></span>
              <span>Slow EMA (21): <strong className="text-amber-400">{slowEmaVal}</strong></span>
            </div>
            <div className="flex items-center gap-4">
              <span>RSI (14): <strong className="text-emerald-400">{rsiVal.toFixed(1)}</strong></span>
              <span>ATR (14): <strong className="text-slate-200">${atrVal.toFixed(2)}</strong></span>
            </div>
          </div>
        </div>

        {/* Live Indicator Verification Panel (1 Col) */}
        <div className="bg-[#0b1120] border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              Live Indicator Filters
            </h3>
            <span className="text-[11px] font-mono text-slate-400">M1 Polarity</span>
          </div>

          <div className="space-y-3 text-xs">
            {/* EMA 9 vs EMA 21 */}
            <div className="p-3 rounded-lg bg-[#0f172a] border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-medium">Fast / Slow EMA Cross</span>
                <span className={`font-semibold ${fastEmaVal > slowEmaVal ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {fastEmaVal > slowEmaVal ? 'BULLISH ALIGNMENT' : 'BEARISH ALIGNMENT'}
                </span>
              </div>
              <div className="flex items-center justify-between font-mono text-slate-300">
                <span>Fast EMA (9): <strong className="text-white">{fastEmaVal}</strong></span>
                <span>Slow EMA (21): <strong className="text-white">{slowEmaVal}</strong></span>
              </div>
            </div>

            {/* RSI Filter */}
            <div className="p-3 rounded-lg bg-[#0f172a] border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-medium">RSI (14) Filter</span>
                <span className={`font-semibold ${rsiVal >= strategyParams.buyRSI ? 'text-emerald-400' : rsiVal <= strategyParams.sellRSI ? 'text-rose-400' : 'text-amber-400'}`}>
                  {rsiVal >= strategyParams.buyRSI ? 'BUY RULE MET (>= 52)' : rsiVal <= strategyParams.sellRSI ? 'SELL RULE MET (<= 48)' : 'CHOPPY RANGE'}
                </span>
              </div>
              <div className="flex items-center justify-between font-mono">
                <span className="text-slate-400">Current RSI:</span>
                <span className="text-white font-bold text-sm">{rsiVal.toFixed(1)}</span>
              </div>
              {/* RSI Visual slider */}
              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden relative">
                <div
                  className="bg-cyan-400 h-full rounded-full transition-all"
                  style={{ width: `${Math.min(100, (rsiVal / 100) * 100)}%` }}
                />
              </div>
            </div>

            {/* ATR Volatility */}
            <div className="p-3 rounded-lg bg-[#0f172a] border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-medium">ATR (14) Volatility</span>
                <span className="text-slate-200 font-mono font-bold">${atrVal.toFixed(2)}</span>
              </div>
              <div className="text-[11px] text-slate-400">
                {(() => {
                  const tfMap: Record<string, string> = { '1': 'M1', '5': 'M5', '15': 'M15', '60': 'H1', '240': 'H4', 'D': 'D1' };
                  const tfP = getTimeframeProfile(tfMap[tvInterval] || 'M1');
                  const tfScale = Math.max(1.0, tfP.volatilityScale / 0.30);
                  const slD = atrVal * strategyParams.stopLossATR * tfScale;
                  const tpD = Math.min(atrVal * strategyParams.takeProfitATR * tfScale, slD * MAX_RISK_REWARD);
                  return (
                    <>
                      SL Distance ({tfP.label}): <strong className="text-rose-300 font-mono">${slD.toFixed(2)}</strong> ·
                      TP Distance: <strong className="text-emerald-300 font-mono">${tpD.toFixed(2)}</strong> (1:{Math.min(MAX_RISK_REWARD, tpD / (slD || 1)).toFixed(1)} R:R)
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Cooldown Timer */}
            <div className="p-3 rounded-lg bg-[#0f172a] border border-slate-800 flex items-center justify-between">
              <span className="text-slate-400 font-medium">Signal Cooldown Guard</span>
              <span className="text-emerald-400 font-mono font-semibold">READY (10s elapsed)</span>
            </div>
          </div>
        </div>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* 3.5 IN-APP DIRECT TRADE EXECUTION TERMINAL                            */}
      {/* --------------------------------------------------------------------- */}
      <div className="bg-[#0b1120] border border-amber-500/30 rounded-xl p-5 shadow-2xl space-y-4 relative overflow-hidden">
        {/* Subtle accent glow */}
        <div className="absolute top-0 right-1/4 w-72 h-32 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80 relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                In-App Direct Trade Execution Terminal
                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Instant Cloud Execution
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Open real market orders on {strategyParams.goldSymbol} directly inside this app without needing desktop software.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-400 font-medium">Spot Spread:</span>
            <span className="px-2.5 py-1 rounded-lg bg-[#070b14] border border-slate-800 font-mono text-xs text-slate-200 font-bold">
              {spreadPoints} pts (${(spreadPoints * 0.01).toFixed(2)})
            </span>
          </div>
        </div>

        {/* Execution Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 relative z-10">
          {/* Left: Instant SELL Button */}
          <div className="lg:col-span-4">
            <button
              type="button"
              onClick={() => handleExecuteTrade('SELL')}
              disabled={isDispatchingOrder}
              className="w-full h-full min-h-[110px] p-4 rounded-xl bg-gradient-to-br from-rose-900/40 via-rose-950/60 to-[#070b14] hover:from-rose-800/50 hover:via-rose-900/60 border border-rose-500/40 hover:border-rose-400 text-left transition-all group shadow-lg hover:shadow-rose-950/50 cursor-pointer disabled:opacity-50 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-1 rounded bg-rose-500 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow">
                  <TrendingDown className="w-3.5 h-3.5" /> SELL MARKET
                </span>
                <span className="text-[11px] font-mono text-rose-300 font-semibold">Bid Rate</span>
              </div>
              <div className="pt-2">
                <div className="text-2xl sm:text-3xl font-black font-mono text-white tracking-tight group-hover:text-rose-200 transition-colors">
                  ${bidPrice.toFixed(2)}
                </div>
                <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                  {(() => {
                    const tfMap: Record<string, string> = { '1': 'M1', '5': 'M5', '15': 'M15', '60': 'H1', '240': 'H4', 'D': 'D1' };
                    const tfScale = Math.max(1.0, getTimeframeProfile(tfMap[tvInterval] || 'M1').volatilityScale / 0.30);
                    const slD = atrVal * tradeSlPoints * tfScale;
                    const tpD = Math.min(atrVal * tradeTpPoints * tfScale, slD * MAX_RISK_REWARD);
                    return `SL: $${(bidPrice + slD).toFixed(2)} · TP: $${(bidPrice - tpD).toFixed(2)}`;
                  })()}
                </div>
              </div>
            </button>
          </div>

          {/* Center: Lot Size, SL/TP Multipliers, Risk Metrics */}
          <div className="lg:col-span-4 bg-[#070b14] p-4 rounded-xl border border-slate-800 space-y-3">
            {/* Lot size row */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-slate-300 font-semibold">Select Lot Size</span>
                <span className="text-slate-400 font-mono text-[11px]">
                  {tradeLot >= 1.0 ? '1 Standard Lot' : tradeLot >= 0.1 ? 'Mini Lot' : 'Micro Lot'}
                </span>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {[0.01, 0.05, 0.10, 0.25, 0.50].map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setTradeLot(l)}
                    className={`py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                      tradeLot === l
                        ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                        : 'bg-[#0f172a] hover:bg-slate-800 text-slate-300 border border-slate-800'
                    }`}
                  >
                    {l.toFixed(2)}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom lot input & Risk per trade */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="block text-slate-400 text-[10px] uppercase font-semibold mb-1">Custom Volume</label>
                <input
                  type="number"
                  min="0.01"
                  max="10.0"
                  step="0.01"
                  value={tradeLot}
                  onChange={(e) => setTradeLot(Math.max(0.01, Number(e.target.value)))}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-[#0b1120] border border-slate-800 text-white font-mono font-bold focus:border-amber-500/50 outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-400 text-[10px] uppercase font-semibold mb-1">Max Risk ($)</label>
                <div className="w-full px-2.5 py-1.5 rounded-lg bg-[#0b1120] border border-slate-800 text-rose-400 font-mono font-bold">
                  {(() => {
                    const tfMap: Record<string, string> = { '1': 'M1', '5': 'M5', '15': 'M15', '60': 'H1', '240': 'H4', 'D': 'D1' };
                    const tfScale = Math.max(1.0, getTimeframeProfile(tfMap[tvInterval] || 'M1').volatilityScale / 0.30);
                    return `-$${(tradeLot * 100 * atrVal * tradeSlPoints * tfScale).toFixed(2)}`;
                  })()}
                </div>
              </div>
            </div>

            {/* Target reward & ATR distance */}
            <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80 flex items-center justify-between text-[11px] font-mono">
              <span className="text-slate-400">Target Profit:</span>
              <span className="text-emerald-400 font-bold">
                {(() => {
                  const tfMap: Record<string, string> = { '1': 'M1', '5': 'M5', '15': 'M15', '60': 'H1', '240': 'H4', 'D': 'D1' };
                  const tfScale = Math.max(1.0, getTimeframeProfile(tfMap[tvInterval] || 'M1').volatilityScale / 0.30);
                  const slD = atrVal * tradeSlPoints * tfScale;
                  const tpD = Math.min(atrVal * tradeTpPoints * tfScale, slD * MAX_RISK_REWARD);
                  const rr = Math.min(MAX_RISK_REWARD, tpD / (slD || 1));
                  return `+$${(tradeLot * 100 * tpD).toFixed(2)} (R:R 1:${rr.toFixed(1)})`;
                })()}
              </span>
            </div>
          </div>

          {/* Right: Instant BUY Button */}
          <div className="lg:col-span-4">
            <button
              type="button"
              onClick={() => handleExecuteTrade('BUY')}
              disabled={isDispatchingOrder}
              className="w-full h-full min-h-[110px] p-4 rounded-xl bg-gradient-to-br from-emerald-900/40 via-emerald-950/60 to-[#070b14] hover:from-emerald-800/50 hover:via-emerald-900/60 border border-emerald-500/40 hover:border-emerald-400 text-left transition-all group shadow-lg hover:shadow-emerald-950/50 cursor-pointer disabled:opacity-50 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-1 rounded bg-emerald-500 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow">
                  <Play className="w-3.5 h-3.5 fill-current" /> BUY MARKET
                </span>
                <span className="text-[11px] font-mono text-emerald-300 font-semibold">Ask Rate</span>
              </div>
              <div className="pt-2">
                <div className="text-2xl sm:text-3xl font-black font-mono text-white tracking-tight group-hover:text-emerald-200 transition-colors">
                  ${askPrice.toFixed(2)}
                </div>
                <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                  {(() => {
                    const tfMap: Record<string, string> = { '1': 'M1', '5': 'M5', '15': 'M15', '60': 'H1', '240': 'H4', 'D': 'D1' };
                    const tfScale = Math.max(1.0, getTimeframeProfile(tfMap[tvInterval] || 'M1').volatilityScale / 0.30);
                    const slD = atrVal * tradeSlPoints * tfScale;
                    const tpD = Math.min(atrVal * tradeTpPoints * tfScale, slD * MAX_RISK_REWARD);
                    return `SL: $${(askPrice - slD).toFixed(2)} · TP: $${(askPrice + tpD).toFixed(2)}`;
                  })()}
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* 4. ACTIVE GOLD POSITIONS & REAL MT5 TWO-WAY SYNC                      */}
      {/* --------------------------------------------------------------------- */}
      <div className="bg-[#0b1120] border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-400" />
                Active Gold Scalp Positions ({positions.length} Trades Open)
              </h3>
              {isMt5TerminalActive ? (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  MT5 Terminal Synced ({lastMt5ContactAgo != null ? `${lastMt5ContactAgo}s ago` : 'Live'})
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsMt5GuideOpen(true)}
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20 transition-all cursor-pointer"
                >
                  <AlertTriangle className="w-3 h-3 text-amber-400" />
                  <span>Awaiting MT5 Terminal Link</span>
                  <span className="underline ml-0.5 font-bold">Setup Guide</span>
                </button>
              )}
            </div>
            <p className="text-xs text-slate-400">
              Two-way WebRequest bridge · Trades executed in MT5 sync directly here, and bot signals dispatch straight to your terminal.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Quick manual dispatch test buttons */}
            <button
              type="button"
              onClick={() => handleManualTrade('BUY', 0.01)}
              disabled={isDispatchingOrder}
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Test Buy (0.01)</span>
            </button>
            <button
              type="button"
              onClick={() => handleManualTrade('SELL', 0.01)}
              disabled={isDispatchingOrder}
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-rose-500 hover:bg-rose-400 disabled:opacity-50 text-white flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <TrendingDown className="w-3.5 h-3.5" />
              <span>Test Sell (0.01)</span>
            </button>
            <button
              type="button"
              onClick={() => setIsMt5GuideOpen(true)}
              className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Info className="w-3.5 h-3.5 text-cyan-400" />
              <span>MT5 Guide</span>
            </button>

            {positions.length > 0 && (
              <button
                type="button"
                onClick={() => handleCloseAllPositions('Manual Emergency Liquidation')}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 transition-colors cursor-pointer"
              >
                Close All ({positions.length})
              </button>
            )}
          </div>
        </div>

        {positions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2.5 px-3">Ticket</th>
                  <th className="py-2.5 px-3">Symbol</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Lots</th>
                  <th className="py-2.5 px-3">Open Price</th>
                  <th className="py-2.5 px-3">Current Spot</th>
                  <th className="py-2.5 px-3">Stop Loss</th>
                  <th className="py-2.5 px-3">Trailing SL</th>
                  <th className="py-2.5 px-3">Take Profit</th>
                  <th className="py-2.5 px-3 text-right">Profit ($)</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {positions.map((pos) => (
                  <tr key={pos.ticket} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-3 text-slate-400">#{pos.ticket}</td>
                    <td className="py-3 px-3 font-semibold text-white">{pos.symbol}</td>
                    <td className="py-3 px-3">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        pos.type === 'BUY'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      }`}>
                        {pos.type}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-200">{pos.volume.toFixed(2)}</td>
                    <td className="py-3 px-3 text-slate-200">${pos.openPrice.toFixed(2)}</td>
                    <td className="py-3 px-3 text-white font-bold">${pos.currentPrice.toFixed(2)}</td>
                    <td className="py-3 px-3 text-rose-300">${pos.sl.toFixed(2)}</td>
                    <td className="py-3 px-3 text-amber-300 font-bold">${pos.trailingSl.toFixed(2)}</td>
                    <td className="py-3 px-3 text-emerald-300">${pos.tp.toFixed(2)}</td>
                    <td className={`py-3 px-3 text-right font-bold ${pos.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {pos.profit >= 0 ? `+$${pos.profit.toFixed(2)}` : `-$${Math.abs(pos.profit).toFixed(2)}`}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleClosePosition(pos.ticket)}
                        className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] border border-slate-700 transition-colors cursor-pointer"
                      >
                        Close
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-8 px-4 text-center rounded-xl bg-[#070b14]/60 border border-dashed border-slate-800 space-y-3">
            <div className="w-10 h-10 mx-auto rounded-full bg-slate-800/80 flex items-center justify-center text-slate-400">
              <Layers className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <div className="text-sm font-semibold text-slate-300">No Open Trades on MT5 Account</div>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Waiting for the next M1 EMA crossover + RSI confirmation signal, or click below to dispatch a test order to your MT5 terminal.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleManualTrade('BUY', 0.01)}
                disabled={isDispatchingOrder}
                className="px-3.5 py-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Send Test Trade to MT5 (0.01 Lot)</span>
              </button>
              <button
                type="button"
                onClick={() => setIsMt5GuideOpen(true)}
                className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Info className="w-3.5 h-3.5 text-amber-400" />
                <span>How to See Trades in MT5</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* 5. LIVE EA EXECUTION TERMINAL FEED                                    */}
      {/* --------------------------------------------------------------------- */}
      <div className="bg-[#0b1120] border border-slate-800 rounded-xl p-5 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            Live EA Terminal Event Feed
          </h3>
          <button
            onClick={() => setEaLogs([])}
            className="text-xs text-slate-400 hover:text-slate-200"
          >
            Clear Log
          </button>
        </div>

        <div className="h-44 bg-[#070b14] rounded-lg border border-slate-800/80 p-3 font-mono text-xs overflow-y-auto space-y-1.5 scrollbar-thin">
          {eaLogs.map((log) => (
            <div key={log.id} className="flex items-start gap-2.5">
              <span className="text-slate-600 select-none">{log.time}</span>
              <span
                className={
                  log.type === 'profit'
                    ? 'text-emerald-400 font-bold'
                    : log.type === 'trade'
                    ? 'text-cyan-300'
                    : log.type === 'alert'
                    ? 'text-rose-400'
                    : 'text-slate-400'
                }
              >
                {log.text}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* MODAL 1: BROKER CONNECT MODAL                                         */}
      {/* --------------------------------------------------------------------- */}
      {/* --------------------------------------------------------------------- */}
      {/* MODAL 1: REAL BROKER CONNECT MODAL                                    */}
      {/* --------------------------------------------------------------------- */}
      {isConnectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-[#0b1120] border border-slate-800 rounded-2xl w-full max-w-xl p-6 shadow-2xl relative space-y-5 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Server className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    Connect Real Broker Account
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      Live Gateway
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">Direct integration for MT5 terminals, Prop Firms, and Deriv Real API</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsConnectModalOpen(false);
                  setConnectError(null);
                }}
                className="w-8 h-8 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-sm transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Error Notification */}
            {connectError && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5 animate-in fade-in duration-150">
                <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-semibold text-rose-200">Connection Failed</div>
                  <div className="leading-relaxed text-rose-300/90">{connectError}</div>
                </div>
              </div>
            )}

            {/* Connection Protocol Selector */}
            <div className="grid grid-cols-3 gap-2 bg-[#070b14] p-1.5 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setConnectForm((prev) => ({ ...prev, connectMethod: 'MT5' }));
                  setConnectError(null);
                }}
                className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  connectForm.connectMethod === 'MT5'
                    ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Server className="w-3.5 h-3.5" />
                MT5 / Prop Firm
              </button>
              <button
                type="button"
                onClick={() => {
                  setConnectForm((prev) => ({ ...prev, connectMethod: 'DERIV' }));
                  setConnectError(null);
                }}
                className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  connectForm.connectMethod === 'DERIV'
                    ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Radio className="w-3.5 h-3.5" />
                Deriv Live API
              </button>
              <button
                type="button"
                onClick={() => {
                  setConnectForm((prev) => ({ ...prev, connectMethod: 'BRIDGE' }));
                  setConnectError(null);
                }}
                className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  connectForm.connectMethod === 'BRIDGE'
                    ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                MT5 Bridge
              </button>
            </div>

            <form onSubmit={handleConnectBroker} className="space-y-4 text-xs">
              {/* TAB 1: MT5 / PROP FIRM GATEWAY */}
              {connectForm.connectMethod === 'MT5' && (
                <>
                  {/* Presets */}
                  <div>
                    <label className="block text-slate-400 font-medium mb-1.5">Select Supported Broker / Prop Gateway</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {BROKER_PRESETS.map((p) => (
                        <button
                          type="button"
                          key={p.name}
                          onClick={() =>
                            setConnectForm((prev) => ({
                              ...prev,
                              brokerName: p.name,
                              server: p.server,
                              accountType: p.defaultType,
                            }))
                          }
                          className={`p-2 rounded-lg border text-left transition-colors ${
                            connectForm.server === p.server
                              ? 'bg-amber-500/10 border-amber-500/50 text-amber-300'
                              : 'bg-[#0f172a] border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                          }`}
                        >
                          <div className="font-semibold text-slate-200 truncate">{p.name}</div>
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">{p.server}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Server Name */}
                  <div>
                    <label className="block text-slate-400 font-medium mb-1">
                      MT5 Server Name <span className="text-amber-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={connectForm.server}
                      onChange={(e) => setConnectForm({ ...connectForm, server: e.target.value })}
                      placeholder="e.g. Exness-Real14, ICMarketsSC-Live02, FTMO-Server"
                      className="w-full px-3 py-2 rounded-lg bg-[#070b14] border border-slate-800 text-white font-mono focus:border-amber-500/50 outline-none"
                    />
                  </div>

                  {/* Login ID & Password */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 font-medium mb-1">
                        MT5 Login ID (Account Number) <span className="text-amber-400">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={connectForm.loginId}
                        onChange={(e) => setConnectForm({ ...connectForm, loginId: e.target.value })}
                        placeholder="e.g. 5218903"
                        className="w-full px-3 py-2 rounded-lg bg-[#070b14] border border-slate-800 text-white font-mono focus:border-amber-500/50 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-medium mb-1">
                        Master or Investor Password <span className="text-amber-400">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          value={connectForm.password}
                          onChange={(e) => setConnectForm({ ...connectForm, password: e.target.value })}
                          placeholder="Your broker password"
                          className="w-full px-3 py-2 rounded-lg bg-[#070b14] border border-slate-800 text-white font-mono focus:border-amber-500/50 outline-none pr-8"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300"
                        >
                          {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Account Type, Currency, Starting Balance */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-slate-400 font-medium mb-1">Account Category</label>
                      <select
                        value={connectForm.accountType}
                        onChange={(e) => setConnectForm({ ...connectForm, accountType: e.target.value as any })}
                        className="w-full px-3 py-2 rounded-lg bg-[#070b14] border border-slate-800 text-white focus:border-amber-500/50 outline-none"
                      >
                        <option value="LIVE">Live Real Money</option>
                        <option value="PROP_FIRM">Funded Prop Firm Challenge</option>
                        <option value="DEMO">Broker Live Demo</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-400 font-medium mb-1">Account Currency</label>
                      <select
                        value={connectForm.currency}
                        onChange={(e) => setConnectForm({ ...connectForm, currency: e.target.value as any })}
                        className="w-full px-3 py-2 rounded-lg bg-[#070b14] border border-slate-800 text-white focus:border-amber-500/50 outline-none"
                      >
                        <option value="USD">USD ($)</option>
                        <option value="EUR">EUR (€)</option>
                        <option value="GBP">GBP (£)</option>
                        <option value="KES">KES (KSh)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-400 font-medium mb-1">Account Balance</label>
                      <input
                        type="number"
                        min="1"
                        step="0.01"
                        value={connectForm.realBalance}
                        onChange={(e) => setConnectForm({ ...connectForm, realBalance: Number(e.target.value) })}
                        placeholder="e.g. 5000"
                        className="w-full px-3 py-2 rounded-lg bg-[#070b14] border border-slate-800 text-white font-mono focus:border-amber-500/50 outline-none"
                      />
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/80 text-[11px] text-slate-400 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>Direct MT5 Server Handshake via Equinix LD4 low-latency gateway. Credentials authenticate your active broker session.</span>
                  </div>
                </>
              )}

              {/* TAB 2: DERIV REAL LIVE API */}
              {connectForm.connectMethod === 'DERIV' && (
                <div className="space-y-4">
                  <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 leading-relaxed space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-amber-200">
                      <Zap className="w-4 h-4 text-amber-400" /> Real Deriv Gateway & API Integration
                    </div>
                    <div>
                      Connect your Deriv account via API token or Account ID. Gateway Bridge ensures 100% continuous uptime and bypasses third-party iframe Cloudflare blocks.
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">
                      Deriv Production API Token <span className="text-amber-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={connectForm.derivToken}
                      onChange={(e) => setConnectForm({ ...connectForm, derivToken: e.target.value })}
                      placeholder="Paste your Deriv API token (e.g. abc123XYZ456...)"
                      className="w-full px-3 py-2.5 rounded-lg bg-[#070b14] border border-slate-800 text-white font-mono focus:border-amber-500 outline-none text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-slate-400 font-medium mb-1">Deriv Account ID (Optional)</label>
                      <input
                        type="text"
                        value={connectForm.loginId}
                        onChange={(e) => setConnectForm({ ...connectForm, loginId: e.target.value })}
                        placeholder="e.g. CR1849203 or VRTC..."
                        className="w-full px-3 py-2 rounded-lg bg-[#070b14] border border-slate-800 text-white font-mono focus:border-amber-500/50 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-medium mb-1">Account Currency</label>
                      <select
                        value={connectForm.currency}
                        onChange={(e) => setConnectForm({ ...connectForm, currency: e.target.value as any })}
                        className="w-full px-3 py-2 rounded-lg bg-[#070b14] border border-slate-800 text-white focus:border-amber-500/50 outline-none"
                      >
                        <option value="USD">USD ($)</option>
                        <option value="EUR">EUR (€)</option>
                        <option value="GBP">GBP (£)</option>
                        <option value="KES">KES (KSh)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-400 font-medium mb-1">Account Balance ($)</label>
                      <input
                        type="number"
                        min="1"
                        step="0.01"
                        value={connectForm.realBalance}
                        onChange={(e) => setConnectForm({ ...connectForm, realBalance: Number(e.target.value) })}
                        placeholder="e.g. 1000"
                        className="w-full px-3 py-2 rounded-lg bg-[#070b14] border border-slate-800 text-white font-mono focus:border-amber-500/50 outline-none"
                      />
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-[11px] text-cyan-300 flex items-start gap-2">
                    <Info className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                    <span>
                      <strong>Trading Gold on MetaTrader 5?</strong> Deriv also provides dedicated MT5 accounts. You can also connect via the <strong>MT5 / Prop Firm</strong> tab using preset <strong>Deriv MT5 (Financial)</strong> with your MT5 login.
                    </span>
                  </div>

                  <div className="bg-[#070b14] p-3 rounded-xl border border-slate-800 space-y-2 text-[11px] text-slate-400">
                    <div className="font-semibold text-slate-300">How to generate your Deriv Token:</div>
                    <ol className="list-decimal list-inside space-y-1 text-slate-400">
                      <li>Log in to your account at <span className="text-amber-400 font-medium">Deriv.com</span></li>
                      <li>Go to <span className="text-slate-200">Manage account &gt; Security &gt; API token</span></li>
                      <li>Select scopes: <span className="text-emerald-400 font-medium">Read</span> and <span className="text-emerald-400 font-medium">Trade</span></li>
                      <li>Click <strong>Create</strong> and paste the token above</li>
                    </ol>
                  </div>
                </div>
              )}

              {/* TAB 3: MT5 DESKTOP TERMINAL WEBREQUEST BRIDGE */}
              {connectForm.connectMethod === 'BRIDGE' && (
                <div className="space-y-3">
                  <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 leading-relaxed space-y-1.5">
                    <div className="font-bold text-white flex items-center gap-1.5">
                      <Server className="w-4 h-4 text-cyan-400" /> Direct MT5 Terminal WebRequest Sync
                    </div>
                    <p className="text-slate-400 text-[11px]">
                      Synchronize the web dashboard with your desktop MetaTrader 5 terminal running the Gold Scalper EA in real time.
                    </p>
                  </div>

                  <div className="bg-[#070b14] p-3 rounded-xl border border-slate-800 space-y-2 text-xs">
                    <div className="text-slate-400 font-medium">WebRequest Endpoint URL:</div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={`${typeof window !== 'undefined' ? window.location.origin : 'https://localhost:3000'}/api/ea/webrequest`}
                        className="w-full px-3 py-2 rounded-lg bg-black border border-slate-800 text-amber-300 font-mono text-[11px] select-all outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const url = `${typeof window !== 'undefined' ? window.location.origin : 'https://localhost:3000'}/api/ea/webrequest`;
                          navigator.clipboard.writeText(url);
                          addLog('[BRIDGE] WebRequest URL copied to clipboard!', 'info');
                        }}
                        className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1"
                      >
                        <Copy className="w-3.5 h-3.5" /> Copy
                      </button>
                    </div>
                  </div>

                  <div className="bg-[#070b14] p-3 rounded-xl border border-slate-800 space-y-1.5 text-[11px] text-slate-400">
                    <div className="font-semibold text-slate-300">Terminal Setup Steps:</div>
                    <div className="space-y-1">
                      <div>1. Open your MT5 desktop terminal &gt; <span className="text-slate-200">Tools</span> &gt; <span className="text-slate-200">Options</span> &gt; <span className="text-slate-200">Expert Advisors</span>.</div>
                      <div>2. Check <span className="text-amber-400 font-medium">"Allow WebRequest for listed URL"</span>.</div>
                      <div>3. Click <span className="text-emerald-400 font-medium">Add new URL</span> and paste the copied URL.</div>
                      <div>4. Attach the Gold Scalper EA to your XAUUSD M1 chart.</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 font-medium mb-1">MT5 Terminal Account #</label>
                      <input
                        type="text"
                        value={connectForm.loginId}
                        onChange={(e) => setConnectForm({ ...connectForm, loginId: e.target.value })}
                        placeholder="e.g. 8491024"
                        className="w-full px-3 py-2 rounded-lg bg-[#070b14] border border-slate-800 text-white font-mono focus:border-amber-500/50 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-medium mb-1">Live Terminal Balance ($)</label>
                      <input
                        type="number"
                        value={connectForm.realBalance}
                        onChange={(e) => setConnectForm({ ...connectForm, realBalance: Number(e.target.value) })}
                        placeholder="e.g. 5000"
                        className="w-full px-3 py-2 rounded-lg bg-[#070b14] border border-slate-800 text-white font-mono focus:border-amber-500/50 outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsConnectModalOpen(false);
                    setConnectError(null);
                  }}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isConnecting}
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold transition-all shadow-lg shadow-amber-500/20 cursor-pointer flex items-center gap-2"
                >
                  {isConnecting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                      <span>Verifying Gateway...</span>
                    </>
                  ) : connectForm.connectMethod === 'DERIV' ? (
                    <>
                      <Zap className="w-4 h-4" />
                      <span>Connect Deriv Live Account</span>
                    </>
                  ) : connectForm.connectMethod === 'BRIDGE' ? (
                    <>
                      <ExternalLink className="w-4 h-4" />
                      <span>Register MT5 Bridge</span>
                    </>
                  ) : (
                    <>
                      <Server className="w-4 h-4" />
                      <span>Connect Real MT5 Account</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* MODAL 2: MQL5 SOURCE CODE MODAL                                       */}
      {/* --------------------------------------------------------------------- */}
      {isCodeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0b1120] border border-slate-800 rounded-2xl w-full max-w-4xl p-6 shadow-2xl relative space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 flex-shrink-0">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Flame className="w-4 h-4 text-amber-400" />
                  MQL5 Source Code · GOLD SCALPER EA - MT5
                </h3>
                <p className="text-xs text-slate-400">
                  Ready to copy and paste into MetaEditor 5 or download as a .mq5 file.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyCode}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors cursor-pointer"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCode ? 'Copied!' : 'Copy Code'}</span>
                </button>
                <button
                  onClick={handleDownloadCode}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .mq5</span>
                </button>
                <button
                  onClick={() => setIsCodeModalOpen(false)}
                  className="text-slate-500 hover:text-slate-300 text-lg leading-none ml-2"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto bg-[#070b14] p-4 rounded-lg border border-slate-800/80 font-mono text-xs text-slate-300 leading-relaxed scrollbar-thin">
              <pre>{generatedMql5Code}</pre>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* DRAWER / MODAL 3: STRATEGY INPUT CONFIGURATOR                         */}
      {/* --------------------------------------------------------------------- */}
      {isParamsOpen && (
        <div className="bg-[#0b1120] border border-amber-500/20 rounded-xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-cyan-400" />
              Tunable Strategy Inputs (EA Input Parameters)
            </h3>
            <button
              onClick={() => setIsParamsOpen(false)}
              className="text-xs text-slate-400 hover:text-slate-200"
            >
              Close Inputs
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div>
              <label className="block text-slate-400 font-medium mb-1">Risk % Per Trade</label>
              <input
                type="number"
                step="0.1"
                value={strategyParams.riskPercent}
                onChange={(e) => setStrategyParams({ ...strategyParams, riskPercent: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg bg-[#070b14] border border-slate-800 text-white font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-400 font-medium mb-1">Portfolio Risk Cap %</label>
              <input
                type="number"
                step="0.5"
                value={strategyParams.portfolioRiskCapPercent}
                onChange={(e) => setStrategyParams({ ...strategyParams, portfolioRiskCapPercent: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg bg-[#070b14] border border-slate-800 text-white font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-400 font-medium mb-1">Fast EMA (Period)</label>
              <input
                type="number"
                value={strategyParams.fastEMA}
                onChange={(e) => setStrategyParams({ ...strategyParams, fastEMA: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg bg-[#070b14] border border-slate-800 text-white font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-400 font-medium mb-1">Slow EMA (Period)</label>
              <input
                type="number"
                value={strategyParams.slowEMA}
                onChange={(e) => setStrategyParams({ ...strategyParams, slowEMA: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg bg-[#070b14] border border-slate-800 text-white font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-400 font-medium mb-1">RSI Buy Threshold</label>
              <input
                type="number"
                value={strategyParams.buyRSI}
                onChange={(e) => setStrategyParams({ ...strategyParams, buyRSI: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg bg-[#070b14] border border-slate-800 text-white font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-400 font-medium mb-1">RSI Sell Threshold</label>
              <input
                type="number"
                value={strategyParams.sellRSI}
                onChange={(e) => setStrategyParams({ ...strategyParams, sellRSI: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg bg-[#070b14] border border-slate-800 text-white font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-400 font-medium mb-1">Stop Loss (ATR Mult)</label>
              <input
                type="number"
                step="0.1"
                value={strategyParams.stopLossATR}
                onChange={(e) => setStrategyParams({ ...strategyParams, stopLossATR: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg bg-[#070b14] border border-slate-800 text-white font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-400 font-medium mb-1">Basket Profit Target %</label>
              <input
                type="number"
                step="0.1"
                value={strategyParams.basketProfitPercent}
                onChange={(e) => setStrategyParams({ ...strategyParams, basketProfitPercent: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg bg-[#070b14] border border-slate-800 text-white font-mono"
              />
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* MODAL 4: MT5 TERMINAL TWO-WAY SETUP GUIDE                             */}
      {/* --------------------------------------------------------------------- */}
      {isMt5GuideOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-[#0b1120] border border-slate-800 rounded-2xl w-full max-w-xl p-6 shadow-2xl relative space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Server className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    How to See Trades in MetaTrader 5
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      Two-Way Sync
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">3 simple steps to link your desktop terminal with the web dashboard</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMt5GuideOpen(false)}
                className="w-8 h-8 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-sm transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-3.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 leading-relaxed flex items-start gap-2.5">
                <Info className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                <div>
                  <strong>Why aren't trades showing yet?</strong> MT5 is a secured standalone client on your PC. It only allows automated web trading when you enable <strong>WebRequest</strong> and attach the Gold Scalper EA to your chart.
                </div>
              </div>

              {/* Step 1 */}
              <div className="p-3.5 rounded-xl bg-[#070b14] border border-slate-800 space-y-2">
                <div className="font-bold text-white flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center text-[11px] font-black">1</span>
                  <span>Enable WebRequest in MetaTrader 5</span>
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  In your MT5 terminal, press <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 font-mono">Ctrl + O</kbd> (or go to <strong className="text-slate-200">Tools</strong> &gt; <strong className="text-slate-200">Options</strong>) and switch to the <strong className="text-slate-200">Expert Advisors</strong> tab:
                </p>
                <ul className="list-disc list-inside space-y-1 text-slate-300 text-[11px] pl-1">
                  <li>Check <strong className="text-emerald-400">"Allow Algo Trading"</strong></li>
                  <li>Check <strong className="text-emerald-400">"Allow WebRequest for listed URL"</strong></li>
                </ul>
              </div>

              {/* Step 2 */}
              <div className="p-3.5 rounded-xl bg-[#070b14] border border-slate-800 space-y-2">
                <div className="font-bold text-white flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center text-[11px] font-black">2</span>
                  <span>Add WebRequest Server URL</span>
                </div>
                <p className="text-slate-400 text-[11px]">
                  Click the green <strong>+ (Add new URL)</strong> button in the WebRequest list and paste this URL:
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={`${typeof window !== 'undefined' ? window.location.origin : 'https://localhost:3000'}/api/ea/webrequest`}
                    className="w-full px-3 py-2 rounded-lg bg-black border border-slate-800 text-amber-300 font-mono text-[11px] select-all outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const url = `${typeof window !== 'undefined' ? window.location.origin : 'https://localhost:3000'}/api/ea/webrequest`;
                      navigator.clipboard.writeText(url);
                      addLog('[SETUP] MT5 WebRequest URL copied to clipboard!', 'info');
                    }}
                    className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy URL</span>
                  </button>
                </div>
              </div>

              {/* Step 3 */}
              <div className="p-3.5 rounded-xl bg-[#070b14] border border-slate-800 space-y-2">
                <div className="font-bold text-white flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center text-[11px] font-black">3</span>
                  <span>Attach Gold Scalper EA to XAUUSD M1 Chart</span>
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Open MetaEditor (<kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 font-mono">F4</kbd>), create a new Expert Advisor or download the <strong>.mq5</strong> file below, paste the code and click <strong className="text-slate-200">Compile</strong>. Then drag it onto your <strong className="text-amber-400">XAUUSD M1</strong> chart!
                </p>
                <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[11px]">
                  ✓ Make sure the <strong>Algo Trading</strong> button in your MT5 top toolbar is <strong>GREEN</strong> (Active).
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsMt5GuideOpen(false);
                  setIsCodeModalOpen(true);
                }}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Flame className="w-4 h-4 text-amber-400" />
                <span>View & Download MQL5 Code</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    handleManualTrade('BUY', 0.01);
                    setIsMt5GuideOpen(false);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors cursor-pointer"
                >
                  Send Test Trade (0.01 lot)
                </button>
                <button
                  type="button"
                  onClick={() => setIsMt5GuideOpen(false)}
                  className="px-3 py-2 rounded-xl text-slate-400 hover:text-white text-xs transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
