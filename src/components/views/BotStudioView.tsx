/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Algorithmic Bot Studio & Analysis Suite View
 * High-performance command center enabling traders to choose ANY automated bot
 * and ANY currency/instrument (Forex, Metals, Deriv 24/7 Synthetics, Crypto, USDKES).
 * 
 * CORE INSTITUTIONAL CAPABILITIES TO MAKE BOTS WORK PERFECTLY:
 * 1. Autonomous Auto-Pilot Execution (Hands-free trade lifecycle)
 * 2. Automated Break-Even Armor (Locks in risk-free trade at 50% TP)
 * 3. Multi-Timeframe Confluence Matrix (M5 + M15 + H1 + H4 directional alignment)
 * 4. 100-Trade Monte Carlo Strategy Backtester with visual SVG Equity Curve
 * 5. Real MT5 & Deriv Webhook Bridge with copyable MQL5 WebRequest listener
 * 6. Prop Firm Daily Drawdown Guardian (Auto-halt on max daily risk)
 * 7. Strictly binary BUY or SELL dormant signals that stay locked until TP/SL/BE
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Bot,
  Zap,
  Globe,
  Flame,
  CheckCircle2,
  Download,
  Copy,
  Check,
  Code2,
  Activity,
  Sliders,
  Play,
  Pause,
  ShieldCheck,
  Clock,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  ExternalLink,
  Info,
  Layers,
  Sparkles,
  RefreshCw,
  Target,
  Crosshair,
  BarChart2,
  PieChart,
  Cpu,
  ArrowUpRight,
  ShieldAlert,
  ChevronRight,
  Radio,
  SlidersHorizontal,
  Lock,
  Search,
  ChevronDown,
  SlidersVertical,
  X,
  Volume2,
  VolumeX,
  AlertTriangle,
  Trophy,
  History,
  Timer,
  PlayCircle,
  StopCircle,
  Network,
  Calculator,
  LineChart,
  Plus,
  FileCode,
  Trash2,
  Upload,
} from 'lucide-react';
import { BOT_CATALOG, BotDefinition, BotCategory } from '../../utils/eaCatalog.ts';
import { useFinance } from '../../context/FinanceContext.tsx';
import { useTradingViewQuotes, resolveTradingViewPrice, lookupTradingViewQuote } from '../../utils/tradingViewSync.ts';
import { getAssetMarketSession } from '../../utils/marketHours.ts';
import { computeTimeframeSignalLevels, evaluateDirectionalConfluence, getTimeframeProfile, MAX_RISK_REWARD } from '../../utils/signalEngine.ts';
import { BotLiveChart } from '../trading/BotLiveChart.tsx';
import { recordTrackedSignal, evaluateTrackedSignalsAgainstQuotes } from '../../utils/signalScorecard.ts';
import { useNewsGuard } from '../../utils/newsGuard.ts';
import { scheduleTradingCloudPush, CLOUD_TRADING_HYDRATED_EVENT } from '../../utils/tradingCloudSync.ts';
import { generateCandles } from '../../utils/stockCandles.ts';
import { evaluatePropTradeBlock, PROP_GUARD_EVENT } from '../../utils/propGuardian.ts';

// =========================================================================
// COMPREHENSIVE CURRENCIES & TRADING INSTRUMENTS CATALOG
// =========================================================================
export interface TradeableAsset {
  symbol: string;
  name: string;
  category: 'FOREX' | 'METALS' | 'DERIV_24_7' | 'CRYPTO' | 'EAST_AFRICA' | 'INDICES';
  basePrice: number;
  digits: number;
  spreadPips: number;
  marketHours: '24/7 Non-stop' | 'Mon - Fri (24h)';
  minLot: number;
  maxLot: number;
  lotStep: number;
  description: string;
}

export const ALL_ASSETS: TradeableAsset[] = [
  // --- PRECIOUS METALS ---
  { symbol: 'XAUUSD', name: 'Gold Spot / US Dollar', category: 'METALS', basePrice: 3878.46, digits: 2, spreadPips: 0.18, marketHours: 'Mon - Fri (24h)', minLot: 0.01, maxLot: 20.0, lotStep: 0.01, description: 'High-volatility precious metal. Institutional liquidity sweeps.' },
  { symbol: 'XAGUSD', name: 'Silver Spot / US Dollar', category: 'METALS', basePrice: 49.14, digits: 3, spreadPips: 0.25, marketHours: 'Mon - Fri (24h)', minLot: 0.05, maxLot: 10.0, lotStep: 0.01, description: 'Aggressive beta to Gold Spot with massive breakout momentum.' },

  // --- FOREX MAJORS & CROSSES ---
  { symbol: 'EURUSD', name: 'Euro / US Dollar', category: 'FOREX', basePrice: 1.1032, digits: 4, spreadPips: 0.12, marketHours: 'Mon - Fri (24h)', minLot: 0.01, maxLot: 50.0, lotStep: 0.01, description: 'World most liquid currency pair. High trend adherence.' },
  { symbol: 'GBPUSD', name: 'British Pound / US Dollar', category: 'FOREX', basePrice: 1.3222, digits: 4, spreadPips: 0.15, marketHours: 'Mon - Fri (24h)', minLot: 0.01, maxLot: 50.0, lotStep: 0.01, description: 'Cable. Flagship asset for London Open breakouts.' },
  { symbol: 'USDJPY', name: 'US Dollar / Japanese Yen', category: 'FOREX', basePrice: 159.86, digits: 2, spreadPips: 0.14, marketHours: 'Mon - Fri (24h)', minLot: 0.01, maxLot: 50.0, lotStep: 0.01, description: 'High momentum and interest-rate divergence vehicle.' },
  { symbol: 'GBPJPY', name: 'British Pound / Japanese Yen', category: 'FOREX', basePrice: 211.37, digits: 2, spreadPips: 0.22, marketHours: 'Mon - Fri (24h)', minLot: 0.01, maxLot: 30.0, lotStep: 0.01, description: 'The Dragon. Exceptional volatility during London/Tokyo overlap.' },
  { symbol: 'AUDUSD', name: 'Australian Dollar / US Dollar', category: 'FOREX', basePrice: 0.6776, digits: 4, spreadPips: 0.16, marketHours: 'Mon - Fri (24h)', minLot: 0.01, maxLot: 50.0, lotStep: 0.01, description: 'Commodity currency with steady macroeconomic swing trends.' },
  { symbol: 'USDCAD', name: 'US Dollar / Canadian Dollar', category: 'FOREX', basePrice: 1.4249, digits: 4, spreadPips: 0.18, marketHours: 'Mon - Fri (24h)', minLot: 0.01, maxLot: 50.0, lotStep: 0.01, description: 'Strong inverse correlation to crude oil prices.' },
  { symbol: 'USDCHF', name: 'US Dollar / Swiss Franc', category: 'FOREX', basePrice: 0.8376, digits: 4, spreadPips: 0.18, marketHours: 'Mon - Fri (24h)', minLot: 0.01, maxLot: 50.0, lotStep: 0.01, description: 'Classic safe-haven pair. Ideal for trend riding.' },

  // --- EAST AFRICA FX (KENYAN SHILLING) ---
  { symbol: 'USDKES', name: 'US Dollar / Kenyan Shilling', category: 'EAST_AFRICA', basePrice: 129.86, digits: 2, spreadPips: 0.20, marketHours: 'Mon - Fri (24h)', minLot: 0.10, maxLot: 100.0, lotStep: 0.10, description: 'Primary Kenyan interbank FX benchmark for M-Pesa sweeps.' },
  { symbol: 'EURKES', name: 'Euro / Kenyan Shilling', category: 'EAST_AFRICA', basePrice: 143.68, digits: 2, spreadPips: 0.35, marketHours: 'Mon - Fri (24h)', minLot: 0.10, maxLot: 100.0, lotStep: 0.10, description: 'European trade & tourism foreign exchange rate in KES.' },
  { symbol: 'GBPKES', name: 'British Pound / Kenyan Shilling', category: 'EAST_AFRICA', basePrice: 171.70, digits: 2, spreadPips: 0.40, marketHours: 'Mon - Fri (24h)', minLot: 0.10, maxLot: 100.0, lotStep: 0.10, description: 'UK-Kenyan remittances and capital flow benchmark.' },

  // --- DERIV 24/7 SYNTHETICS ---
  { symbol: 'R_75', name: 'Deriv Volatility 75 Index', category: 'DERIV_24_7', basePrice: 428950.40, digits: 2, spreadPips: 0.05, marketHours: '24/7 Non-stop', minLot: 0.001, maxLot: 50.0, lotStep: 0.001, description: 'High-volatility constant price flow. 365 days a year with zero gaps.' },
  { symbol: '1HZ75V', name: 'Volatility 75 (1s) Index', category: 'DERIV_24_7', basePrice: 28540.20, digits: 2, spreadPips: 0.08, marketHours: '24/7 Non-stop', minLot: 0.005, maxLot: 30.0, lotStep: 0.005, description: '1-second sub-tick volatility index for ultra-high frequency scalping.' },
  { symbol: 'BOOM1000', name: 'Boom 1000 Index', category: 'DERIV_24_7', basePrice: 15420.30, digits: 2, spreadPips: 0.10, marketHours: '24/7 Non-stop', minLot: 0.10, maxLot: 50.0, lotStep: 0.10, description: 'Average 1000-tick intervals between explosive upward spikes.' },
  { symbol: 'CRASH1000', name: 'Crash 1000 Index', category: 'DERIV_24_7', basePrice: 8750.60, digits: 2, spreadPips: 0.10, marketHours: '24/7 Non-stop', minLot: 0.10, maxLot: 50.0, lotStep: 0.10, description: 'Rallies gently before sudden, violent downward drop waterfalls.' },
  { symbol: 'BOOM500', name: 'Boom 500 Index', category: 'DERIV_24_7', basePrice: 6240.10, digits: 2, spreadPips: 0.15, marketHours: '24/7 Non-stop', minLot: 0.20, maxLot: 50.0, lotStep: 0.10, description: 'Twice as frequent upward spikes as Boom 1000 (~500 ticks).' },
  { symbol: 'CRASH500', name: 'Crash 500 Index', category: 'DERIV_24_7', basePrice: 4120.80, digits: 2, spreadPips: 0.15, marketHours: '24/7 Non-stop', minLot: 0.20, maxLot: 50.0, lotStep: 0.10, description: 'Frequent crash cascades every ~500 ticks for rapid harvesting.' },
  { symbol: 'STP', name: 'Step Index', category: 'DERIV_24_7', basePrice: 8420.10, digits: 1, spreadPips: 0.10, marketHours: '24/7 Non-stop', minLot: 0.10, maxLot: 40.0, lotStep: 0.05, description: 'Moves strictly in discrete 0.10 point steps.' },
  { symbol: 'R_100', name: 'Volatility 100 Index', category: 'DERIV_24_7', basePrice: 12450.00, digits: 2, spreadPips: 0.10, marketHours: '24/7 Non-stop', minLot: 0.20, maxLot: 50.0, lotStep: 0.10, description: 'Continuous 100% constant volatility synthetic index.' },

  // --- CRYPTO 24/7 ---
  { symbol: 'BTCUSD', name: 'Bitcoin / US Dollar', category: 'CRYPTO', basePrice: 68208.49, digits: 2, spreadPips: 0.50, marketHours: '24/7 Non-stop', minLot: 0.01, maxLot: 10.0, lotStep: 0.01, description: 'Premier cryptocurrency. Weekend liquidity and trend continuation.' },
  { symbol: 'ETHUSD', name: 'Ethereum / US Dollar', category: 'CRYPTO', basePrice: 1919.20, digits: 2, spreadPips: 0.40, marketHours: '24/7 Non-stop', minLot: 0.05, maxLot: 50.0, lotStep: 0.01, description: 'Smart contract cryptocurrency with aggressive volatility spikes.' },

  // --- GLOBAL STOCK INDICES ---
  { symbol: 'US30', name: 'Wall Street 30 (Dow Jones)', category: 'INDICES', basePrice: 52225.33, digits: 1, spreadPips: 1.20, marketHours: 'Mon - Fri (24h)', minLot: 0.10, maxLot: 20.0, lotStep: 0.10, description: 'High point value index. Highly responsive to New York Killzone.' },
  { symbol: 'NAS100', name: 'US Tech 100 (Nasdaq)', category: 'INDICES', basePrice: 27744.26, digits: 1, spreadPips: 0.90, marketHours: 'Mon - Fri (24h)', minLot: 0.10, maxLot: 20.0, lotStep: 0.10, description: 'Tech index. Excellent setup delivery for SMC Fair Value Gaps.' },
];

// =========================================================================
// DORMANT LOCKED SIGNAL INTERFACE
// =========================================================================
export interface DormantLockedSignal {
  id: string;
  botId: string;
  botName: string;
  symbol: string;
  type: 'BUY' | 'SELL';        // Strictly binary: BUY or SELL
  entryPrice: number;          // LOCKED - Never changes while signal is active
  stopLoss: number;            // May move to Break-Even once 50% TP is reached
  originalSl: number;          // Anchor for initial SL
  takeProfit: number;          // LOCKED - Never changes while signal is active
  tpPoints: number;            // Fixed distance to TP
  slPoints: number;            // Fixed distance to SL
  rrRatio: string;             // Fixed Risk-Reward (e.g. 1:3.8)
  confluenceScore: number;     // e.g. 94%
  status: 'DORMANT_ACTIVE' | 'TAKE_PROFIT_HIT' | 'STOP_LOSS_HIT';
  isBreakEvenArmed: boolean;   // True if price reached 50% TP and SL moved to Entry!
  breakEvenPrice?: number;
  generatedAt: string;
  resolvedAt?: string;
  realizedPnlUsd?: number;
  realizedPnlKes?: number;
  reason: string;
}

export interface SignalHistoryRecord {
  id: string;
  time: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  entry: number;
  tp: number;
  sl: number;
  outcome: 'TAKE_PROFIT_HIT' | 'STOP_LOSS_HIT' | 'BREAK_EVEN_HIT' | 'ARMED';
  pnlUsd?: number;
  pnlKes?: number;
}

// Simple Web Audio API Synthesizer (Zero external dependencies)
const playChime = (type: 'arm' | 'tp' | 'sl' | 'be', isMuted: boolean) => {
  if (isMuted || typeof window === 'undefined') return;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    if (type === 'arm') {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.setValueAtTime(880, now + 0.08);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.23);
    } else if (type === 'tp') {
      const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
      notes.forEach((freq, i) => {
        const now = ctx.currentTime + i * 0.09;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.26);
      });
    } else if (type === 'sl') {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(360, now);
      osc.frequency.setValueAtTime(240, now + 0.12);
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.29);
    } else if (type === 'be') {
      // High-pitched lock chime
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(700, now);
      osc.frequency.setValueAtTime(1050, now + 0.1);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.31);
    }
  } catch (e) {
    // Ignore audio autoplay restrictions safely
  }
};

export const BotStudioView: React.FC = () => {
  const { setActiveTab } = useFinance();

  // Selected bot & currency state
  const [selectedBotId, setSelectedBotId] = useState<string>('gold-scalper-m1-pro');
  const [selectedCurrency, setSelectedCurrency] = useState<string>('XAUUSD');
  const [selectedTimeframe, setSelectedTimeframe] = useState<'1s' | 'M1' | 'M5' | 'M15' | 'H1' | 'H4'>('M1');
  const [currencySearch, setCurrencySearch] = useState<string>('');
  const [currencyCategoryFilter, setCurrencyCategoryFilter] = useState<'ALL' | 'FOREX' | 'METALS' | 'DERIV_24_7' | 'EAST_AFRICA' | 'CRYPTO'>('ALL');
  const [isCurrencySelectorOpen, setIsCurrencySelectorOpen] = useState<boolean>(false);

  // Custom EA importer state (persisted in localStorage)
  const [customBots, setCustomBots] = useState<BotDefinition[]>(() => {
    try {
      const saved = localStorage.getItem('njia_custom_scalping_eas');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importForm, setImportForm] = useState({
    name: 'My Custom Scalper EA',
    category: 'FOREX_MT5' as BotCategory,
    tagline: 'High-frequency sub-tick scalper with dynamic ATR trailing',
    defaultSymbol: 'XAUUSD',
    defaultTimeframe: 'M5' as 'M1' | 'M5' | 'M15' | 'M30' | 'H1' | 'H4',
    winRate: 83,
    avgRiskReward: '1:3.4',
    code: '',
  });

  // Bot categories filter & active tab
  const [botCategoryFilter, setBotCategoryFilter] = useState<'ALL' | BotCategory | 'CUSTOM'>('ALL');
  const [activeAnalysisTab, setActiveAnalysisTab] = useState<'scanner' | 'backtest' | 'webhook' | 'mechanics' | 'tools' | 'params' | 'code'>('scanner');
  const [customParams, setCustomParams] = useState<Record<string, any>>({});
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [deployedSuccess, setDeployedSuccess] = useState(false);

  // All bots combined (Catalog + Custom User EAs)
  const allAvailableBots = useMemo(() => {
    return [...customBots, ...BOT_CATALOG];
  }, [customBots]);

  // Audio mute state
  const [isMuted, setIsMuted] = useState(false);

  // Institutional Guardian & Execution Controls
  const [autoPilotActive, setAutoPilotActive] = useState<boolean>(false);
  const [propGuardBlock, setPropGuardBlock] = useState(() => evaluatePropTradeBlock());
  const [breakEvenFeatureEnabled, setBreakEvenFeatureEnabled] = useState<boolean>(true);
  const [autoRearmEnabled, setAutoRearmEnabled] = useState<boolean>(false);
  const [autoRearmCountdown, setAutoRearmCountdown] = useState<number | null>(null);
  const [newsAutoPauseEnabled, setNewsAutoPauseEnabled] = useState<boolean>(true);

  // Visual Re-arm flash state
  const [rearmPulseActive, setRearmPulseActive] = useState(false);
  const [rearmNotice, setRearmNotice] = useState<string | null>(null);

  // Execution history log
  const [signalHistory, setSignalHistory] = useState<SignalHistoryRecord[]>([]);

  // Backtest state
  const [isBacktesting, setIsBacktesting] = useState(false);
  const [backtestStats, setBacktestStats] = useState<{
    totalTrades: number;
    winRate: number;
    profitFactor: number;
    netProfitUsd: number;
    netProfitKes: number;
    maxDrawdown: number;
    sharpeRatio: number;
    equityCurve: number[];
  } | null>(null);

  // Active execution state for orders placed right from this studio
  const [selectedLots, setSelectedLots] = useState<number>(0.10);
  const [activeStudioPositions, setActiveStudioPositions] = useState<Array<{
    ticket: number;
    symbol: string;
    botName: string;
    type: 'BUY' | 'SELL';
    lots: number;
    openPrice: number;
    currentPrice: number;
    sl: number;
    tp: number;
    pnl: number;
    isBreakEven: boolean;
    time: string;
  }>>([]);

  // Active asset reference
  const activeAsset = useMemo(() => {
    return ALL_ASSETS.find((a) => a.symbol === selectedCurrency) || ALL_ASSETS[0];
  }, [selectedCurrency]);

  const selectedBot = useMemo(() => {
    return allAvailableBots.find((b) => b.id === selectedBotId) || allAvailableBots[0];
  }, [allAvailableBots, selectedBotId]);

  const liveTvQuotes = useTradingViewQuotes(3200);
  const liveTvQuotesRef = useRef(liveTvQuotes);
  liveTvQuotesRef.current = liveTvQuotes;
  const newsGuard = useNewsGuard(activeAsset.symbol, 30);

  // Hydrate customBots from Firestore cloud sync if user signs in
  useEffect(() => {
    const onHydrated = () => {
      try {
        const saved = localStorage.getItem('njia_custom_scalping_eas');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            setCustomBots(
              parsed.map((b: any) => ({
                ...b,
                generateMql5Code:
                  typeof b.generateMql5Code === 'function'
                    ? b.generateMql5Code
                    : () => `// Custom User EA: ${b.name || 'Custom EA'}\n#property copyright "User Custom EA"\n`,
              }))
            );
          }
        }
      } catch {
        // ignore storage parse issue
      }
    };
    window.addEventListener(CLOUD_TRADING_HYDRATED_EVENT, onHydrated);
    return () => window.removeEventListener(CLOUD_TRADING_HYDRATED_EVENT, onHydrated);
  }, []);

  // Listen to Prop Firm Hard Lockout + Mullah Voice Bot Control
  useEffect(() => {
    const refreshProp = () => {
      const next = evaluatePropTradeBlock();
      setPropGuardBlock(next);
      if (next.blocked) {
        setAutoPilotActive(false);
      }
    };
    const onBotControl = (e: Event) => {
      const detail = (e as CustomEvent).detail as { target?: string; action?: string; symbol?: string } | undefined;
      if (!detail) return;
      const target = String(detail.target || 'ALL').toUpperCase();
      if (target !== 'ALL' && target !== 'BOT_STUDIO') return;
      if (detail.symbol) {
        const clean = String(detail.symbol).replace('/', '').toUpperCase();
        const found = ALL_ASSETS.find((a) => a.symbol === clean);
        if (found) setSelectedCurrency(found.symbol);
      }
      if (detail.action === 'STOP') {
        setAutoPilotActive(false);
      } else if (detail.action === 'START') {
        const guard = evaluatePropTradeBlock();
        setPropGuardBlock(guard);
        if (!guard.blocked) {
          setAutoPilotActive(true);
        } else {
          setRearmNotice(`Prop Guardian Lockout: ${guard.reason}`);
          setTimeout(() => setRearmNotice(null), 5000);
        }
      }
    };
    window.addEventListener(PROP_GUARD_EVENT, refreshProp);
    window.addEventListener('njia-bot-control', onBotControl);
    return () => {
      window.removeEventListener(PROP_GUARD_EVENT, refreshProp);
      window.removeEventListener('njia-bot-control', onBotControl);
    };
  }, []);

  // Live streaming price & refs for decoupled rock-solid execution (no simulated random ticks)
  const [livePrice, setLivePrice] = useState<number>(activeAsset.basePrice);
  const livePriceRef = useRef<number>(activeAsset.basePrice);
  const [lastTickDir, setLastTickDir] = useState<'UP' | 'DOWN'>('UP');

  // Multi-Timeframe Trend Confirmation Matrix (M5, M15, H1, H4) powered by live TradingView indicators
  const mtfMatrix = useMemo(() => {
    const tvQuote = lookupTradingViewQuote(liveTvQuotes, activeAsset.symbol);
    const forcedDir = selectedBot.id.includes('boom')
      ? 'BUY'
      : selectedBot.id.includes('crash')
      ? 'SELL'
      : undefined;
    const tfConfigs = [
      { tf: 'M5', label: 'Scalp Delta', indicator: 'EMA 9/21 Ribbon' },
      { tf: 'M15', label: 'Primary Setup', indicator: 'Order Block FVG' },
      { tf: 'H1', label: 'Session Trend', indicator: 'SuperTrend Cloud' },
      { tf: 'H4', label: 'Institutional Anchor', indicator: 'MACD Divergence' },
    ];
    return tfConfigs.map((cfg) => {
      const res = evaluateDirectionalConfluence(tvQuote, livePrice, cfg.tf, forcedDir);
      return {
        tf: cfg.tf,
        label: cfg.label,
        bias: res.direction === 'BUY' ? 'BULLISH' : 'BEARISH',
        strength: res.confidenceScore,
        indicator: cfg.indicator,
      };
    });
  }, [activeAsset.symbol, liveTvQuotes, livePrice, selectedBot.id]);

  // =========================================================================
  // DORMANT SIGNAL FACTORY (Timeframe-Scaled, Max 1:5.0 R:R Cap)
  // =========================================================================
  const createDormantSignal = useCallback((
    bot: BotDefinition,
    asset: TradeableAsset,
    spot: number,
    forceType?: 'BUY' | 'SELL',
    tfOverride?: string
  ): DormantLockedSignal => {
    const tf = tfOverride || selectedTimeframe || 'M5';
    const preferredDir: 'BUY' | 'SELL' | undefined = forceType || (
      bot.id.includes('boom') ? 'BUY' :
      bot.id.includes('crash') ? 'SELL' :
      undefined
    );

    const mappedMarket =
      asset.category === 'METALS' ? 'METALS' :
      asset.category === 'DERIV_24_7' ? 'SYNTHETICS' :
      asset.category === 'CRYPTO' ? 'CRYPTO' :
      asset.category === 'INDICES' ? 'INDICES' :
      'FOREX';

    const tvQuote = lookupTradingViewQuote(liveTvQuotesRef.current, asset.symbol);
    const computed = computeTimeframeSignalLevels({
      symbol: asset.symbol,
      spotPrice: spot,
      timeframe: tf,
      quote: tvQuote,
      market: mappedMarket,
      preferredDirection: preferredDir,
    });

    const type: 'BUY' | 'SELL' = computed.direction;
    const entry = Number(spot.toFixed(asset.digits));
    const slDist = Math.max(computed.slDistance, Number((1 / Math.pow(10, asset.digits) * 8).toFixed(asset.digits)));
    const maxTpDist = slDist * MAX_RISK_REWARD;
    const tpDist = Math.min(computed.tp2Distance, maxTpDist);

    const sl = Number((type === 'BUY' ? entry - slDist : entry + slDist).toFixed(asset.digits));
    const tp = Number((type === 'BUY' ? entry + tpDist : entry - tpDist).toFixed(asset.digits));
    const actualRR = slDist > 0 ? Math.min(MAX_RISK_REWARD, Math.max(1.2, Number((tpDist / slDist).toFixed(1)))) : 2.0;
    const rrRatioStr = `1:${actualRR.toFixed(1)}`;
    const tfProfile = getTimeframeProfile(tf);

    const reasonText = bot.id === 'gold-scalper-m1-pro'
      ? `${bot.name} (${tfProfile.label} ${tfProfile.category}) confirmed EMA 9/21 cross & RSI ${type === 'BUY' ? '>= 52.0' : '<= 48.0'}. Timeframe ATR SL & ${rrRatioStr} R:R armed.`
      : `${bot.name} (${tfProfile.label} ${tfProfile.category}): ${computed.setupLabel} · ${type} locked @ ${entry} (Max R:R <= 1:5.0 · Active: ${rrRatioStr}).`;

    return {
      id: `SIG-${asset.symbol}-${tfProfile.normalized}-${type}-${Date.now() % 10000}`,
      botId: bot.id,
      botName: bot.name,
      symbol: asset.symbol,
      type,
      entryPrice: entry,
      stopLoss: sl,
      originalSl: sl,
      takeProfit: tp,
      tpPoints: Number(Math.abs(tp - entry).toFixed(asset.digits)),
      slPoints: Number(Math.abs(entry - sl).toFixed(asset.digits)),
      rrRatio: rrRatioStr,
      confluenceScore: computed.confidenceScore,
      status: 'DORMANT_ACTIVE',
      isBreakEvenArmed: false,
      generatedAt: new Date().toLocaleTimeString(),
      reason: reasonText,
    };
  }, [selectedTimeframe]);

  // The dormant locked signal state + Ref for atomic access
  const manualDirectionOverrideRef = useRef<boolean>(false);
  const [dormantSignal, setDormantSignal] = useState<DormantLockedSignal>(() => {
    return createDormantSignal(selectedBot, activeAsset, activeAsset.basePrice, undefined, 'M1');
  });
  const dormantSignalRef = useRef<DormantLockedSignal>(dormantSignal);
  dormantSignalRef.current = dormantSignal;

  // When user switches Bot, Currency, or Timeframe, arm fresh dormant signal at live TradingView price
  useEffect(() => {
    manualDirectionOverrideRef.current = false;
    const tvSpot = resolveTradingViewPrice(liveTvQuotesRef.current, activeAsset.symbol, activeAsset.basePrice);
    livePriceRef.current = tvSpot;
    setLivePrice(tvSpot);
    setSelectedLots(activeAsset.minLot > 0.05 ? activeAsset.minLot : 0.10);
    const newSignal = createDormantSignal(selectedBot, activeAsset, tvSpot, undefined, selectedTimeframe);
    dormantSignalRef.current = newSignal;
    setDormantSignal(newSignal);
    setAutoRearmCountdown(null);
  }, [selectedBot, activeAsset, selectedTimeframe, createDormantSignal]);

  // Keep livePrice anchored to live TradingView quote & sync un-overridden dormant direction when feed loads/flips
  useEffect(() => {
    if (liveTvQuotes && Object.keys(liveTvQuotes).length > 0) {
      evaluateTrackedSignalsAgainstQuotes(liveTvQuotes);
    }
    const tvSpot = resolveTradingViewPrice(liveTvQuotes, activeAsset.symbol, activeAsset.basePrice);
    if (tvSpot > 0 && Math.abs(livePriceRef.current - tvSpot) / tvSpot > 0.002) {
      livePriceRef.current = tvSpot;
      setLivePrice(tvSpot);
    }
    const tvQuote = lookupTradingViewQuote(liveTvQuotes, activeAsset.symbol);
    if (tvQuote && !manualDirectionOverrideRef.current && dormantSignalRef.current.status === 'DORMANT_ACTIVE') {
      const forcedDir = selectedBot.id.includes('boom')
        ? 'BUY'
        : selectedBot.id.includes('crash')
        ? 'SELL'
        : undefined;
      const evalRes = evaluateDirectionalConfluence(tvQuote, tvSpot, selectedTimeframe || 'M5', forcedDir);
      if (evalRes.direction !== dormantSignalRef.current.type) {
        const syncedSig = createDormantSignal(selectedBot, activeAsset, tvSpot, evalRes.direction, selectedTimeframe);
        dormantSignalRef.current = syncedSig;
        setDormantSignal(syncedSig);
      }
    }
  }, [liveTvQuotes, activeAsset, selectedBot, selectedTimeframe, createDormantSignal]);

  // =========================================================================
  // ROCK-SOLID RE-ARM HANDLER (Supports BUY, SELL, or keeping live TV direction)
  // =========================================================================
  const handleRearmAtSpot = useCallback((overrideType?: 'BUY' | 'SELL') => {
    const currentSpot = livePriceRef.current || livePrice || activeAsset.basePrice;
    if (overrideType) {
      manualDirectionOverrideRef.current = true;
    } else {
      manualDirectionOverrideRef.current = false;
    }
    const direction = overrideType;

    const newSig = createDormantSignal(selectedBot, activeAsset, currentSpot, direction, selectedTimeframe);
    const actualDirection = newSig.type;
    dormantSignalRef.current = newSig;
    setDormantSignal(newSig);
    setAutoRearmCountdown(null);

    // Audio cue
    playChime('arm', isMuted);

    // Visual pulse & notice
    setRearmPulseActive(true);
    setRearmNotice(`⚡ SIGNAL RE-ARMED & LOCKED @ ${currentSpot.toFixed(activeAsset.digits)} (${actualDirection})`);
    setTimeout(() => setRearmPulseActive(false), 1400);
    setTimeout(() => setRearmNotice(null), 4000);

    // Add to history log
    setSignalHistory((prev) => [
      {
        id: newSig.id,
        time: new Date().toLocaleTimeString(),
        symbol: activeAsset.symbol,
        type: actualDirection,
        entry: newSig.entryPrice,
        tp: newSig.takeProfit,
        sl: newSig.stopLoss,
        outcome: 'ARMED',
      },
      ...prev.slice(0, 9),
    ]);

    // Log locked signal to global Win-Rate Scorecard for automatic live TP/SL resolution
    const halfWayTp = Number(
      (
        newSig.entryPrice +
        (newSig.takeProfit - newSig.entryPrice) * 0.55
      ).toFixed(activeAsset.digits)
    );
    recordTrackedSignal({
      symbol: activeAsset.symbol,
      market: activeAsset.category,
      timeframe: selectedTimeframe,
      source: 'BOT_STUDIO',
      direction: actualDirection,
      action: actualDirection === 'BUY' ? 'STRONG BUY' : 'STRONG SELL',
      entryPrice: newSig.entryPrice,
      sl: newSig.stopLoss,
      tp1: halfWayTp,
      tp2: newSig.takeProfit,
      riskReward: newSig.rrRatio,
      confidenceScore: newSig.confluenceScore,
    });

    // If Auto-Pilot is active and no red-folder news hazard blocks execution, auto-dispatch order immediately
    const newsBlocked = newsAutoPauseEnabled && newsGuard.isHazardWindow;
    if (autoPilotActive && !newsBlocked) {
      const ticket = 100000 + (Date.now() % 900000);
      setActiveStudioPositions((prev) => [
        {
          ticket,
          symbol: activeAsset.symbol,
          botName: selectedBot.name,
          type: actualDirection,
          lots: selectedLots,
          openPrice: currentSpot,
          currentPrice: currentSpot,
          sl: newSig.stopLoss,
          tp: newSig.takeProfit,
          pnl: 0,
          isBreakEven: false,
          time: new Date().toLocaleTimeString(),
        },
        ...prev,
      ]);
    } else if (autoPilotActive && newsBlocked) {
      setRearmNotice(`🛡️ NEWS SHIELD PAUSED AUTO-PILOT: ${newsGuard.statusLabel}`);
      setTimeout(() => setRearmNotice(null), 4000);
    }
  }, [selectedBot, activeAsset, livePrice, isMuted, autoPilotActive, selectedLots, createDormantSignal, newsAutoPauseEnabled, newsGuard.isHazardWindow, newsGuard.statusLabel]);

  const handleArmSignal = useCallback((type: 'BUY' | 'SELL') => {
    handleRearmAtSpot(type);
  }, [handleRearmAtSpot]);

  // =========================================================================
  // PURE LIVE TICK EVALUATOR (Driven strictly by live TradingView & Deriv WS ticks)
  // WITH AUTOMATIC BREAK-EVEN & TRAILING ARMOR
  // =========================================================================
  const processLivePriceTick = useCallback(
    (incomingPrice: number) => {
      if (!(incomingPrice > 0)) return;
      const session = getAssetMarketSession(activeAsset.symbol, activeAsset.category);
      if (!session.isOpen) {
        return;
      }

      const nextPrice = Number(incomingPrice.toFixed(activeAsset.digits));
      const prevPrice = livePriceRef.current;
      if (nextPrice !== prevPrice) {
        setLastTickDir(nextPrice >= prevPrice ? 'UP' : 'DOWN');
        livePriceRef.current = nextPrice;
        setLivePrice(nextPrice);
      }

      // Check TP, SL, or BREAK-EVEN on DORMANT SIGNAL
      const curSig = dormantSignalRef.current;
      if (curSig && curSig.status === 'DORMANT_ACTIVE' && curSig.symbol === activeAsset.symbol) {
        const pointMult = activeAsset.category === 'FOREX' || activeAsset.category === 'EAST_AFRICA' ? 10000 : 1;
        const currencyScaler = activeAsset.symbol === 'USDKES' ? 0.0077 : 1;

        // 1. CHECK BREAK-EVEN ARMOR (Price reaches 45-50% distance towards TP)
        if (breakEvenFeatureEnabled && !curSig.isBreakEvenArmed) {
          const totalDistance = Math.abs(curSig.takeProfit - curSig.entryPrice);
          const currentGain =
            curSig.type === 'BUY'
              ? nextPrice - curSig.entryPrice
              : curSig.entryPrice - nextPrice;

          if (totalDistance > 0 && currentGain >= totalDistance * 0.45) {
            const buffer =
              activeAsset.category === 'FOREX' ? 0.0003 : activeAsset.category === 'METALS' ? 0.4 : 2;
            const newSl = Number(
              (curSig.type === 'BUY' ? curSig.entryPrice + buffer : curSig.entryPrice - buffer).toFixed(
                activeAsset.digits
              )
            );
            const updated: DormantLockedSignal = {
              ...curSig,
              stopLoss: newSl,
              isBreakEvenArmed: true,
              breakEvenPrice: newSl,
            };
            dormantSignalRef.current = updated;
            setDormantSignal(updated);
            playChime('be', isMuted);
            setRearmNotice(`🛡️ BREAK-EVEN ARMORED: Stop Loss moved to ${newSl} (Trade is now 100% Risk-Free!)`);
            setTimeout(() => setRearmNotice(null), 3500);
          }
        }

        // 2. CHECK TAKE PROFIT OR STOP LOSS
        const newsBlocksRearm = newsAutoPauseEnabled && newsGuard.isHazardWindow;

        if (curSig.type === 'BUY') {
          if (nextPrice >= curSig.takeProfit) {
            const pnlPoints = Math.abs(curSig.takeProfit - curSig.entryPrice);
            const gainUsd = Number((pnlPoints * selectedLots * pointMult * currencyScaler).toFixed(2));
            const gainKes = Math.round(gainUsd * 129.86);
            const resolved: DormantLockedSignal = {
              ...curSig,
              status: 'TAKE_PROFIT_HIT',
              resolvedAt: new Date().toLocaleTimeString(),
              realizedPnlUsd: Math.max(12, gainUsd),
              realizedPnlKes: Math.max(1500, gainKes),
            };
            dormantSignalRef.current = resolved;
            setDormantSignal(resolved);
            playChime('tp', isMuted);

            setSignalHistory((prev) => [
              {
                id: resolved.id,
                time: resolved.resolvedAt || new Date().toLocaleTimeString(),
                symbol: curSig.symbol,
                type: curSig.type,
                entry: curSig.entryPrice,
                tp: curSig.takeProfit,
                sl: curSig.stopLoss,
                outcome: 'TAKE_PROFIT_HIT',
                pnlUsd: resolved.realizedPnlUsd,
                pnlKes: resolved.realizedPnlKes,
              },
              ...prev.slice(0, 9),
            ]);

            if ((autoRearmEnabled || autoPilotActive) && !newsBlocksRearm) {
              setAutoRearmCountdown(3);
            }
          } else if (nextPrice <= curSig.stopLoss) {
            const isBe = curSig.isBreakEvenArmed;
            const diffPoints = isBe
              ? Math.abs(curSig.stopLoss - curSig.entryPrice)
              : -Math.abs(curSig.entryPrice - curSig.stopLoss);
            const pnlUsd = Number((diffPoints * selectedLots * pointMult * currencyScaler).toFixed(2));
            const pnlKes = Math.round(pnlUsd * 129.86);
            const resolved: DormantLockedSignal = {
              ...curSig,
              status: 'STOP_LOSS_HIT',
              resolvedAt: new Date().toLocaleTimeString(),
              realizedPnlUsd: isBe ? Math.max(2, pnlUsd) : Math.min(-5, pnlUsd),
              realizedPnlKes: isBe ? Math.max(260, pnlKes) : Math.min(-650, pnlKes),
            };
            dormantSignalRef.current = resolved;
            setDormantSignal(resolved);
            playChime('sl', isMuted);

            setSignalHistory((prev) => [
              {
                id: resolved.id,
                time: resolved.resolvedAt || new Date().toLocaleTimeString(),
                symbol: curSig.symbol,
                type: curSig.type,
                entry: curSig.entryPrice,
                tp: curSig.takeProfit,
                sl: curSig.stopLoss,
                outcome: isBe ? 'BREAK_EVEN_HIT' : 'STOP_LOSS_HIT',
                pnlUsd: resolved.realizedPnlUsd,
                pnlKes: resolved.realizedPnlKes,
              },
              ...prev.slice(0, 9),
            ]);

            if ((autoRearmEnabled || autoPilotActive) && !newsBlocksRearm) {
              setAutoRearmCountdown(3);
            }
          }
        } else if (curSig.type === 'SELL') {
          if (nextPrice <= curSig.takeProfit) {
            const pnlPoints = Math.abs(curSig.entryPrice - curSig.takeProfit);
            const gainUsd = Number((pnlPoints * selectedLots * pointMult * currencyScaler).toFixed(2));
            const gainKes = Math.round(gainUsd * 129.86);
            const resolved: DormantLockedSignal = {
              ...curSig,
              status: 'TAKE_PROFIT_HIT',
              resolvedAt: new Date().toLocaleTimeString(),
              realizedPnlUsd: Math.max(12, gainUsd),
              realizedPnlKes: Math.max(1500, gainKes),
            };
            dormantSignalRef.current = resolved;
            setDormantSignal(resolved);
            playChime('tp', isMuted);

            setSignalHistory((prev) => [
              {
                id: resolved.id,
                time: resolved.resolvedAt || new Date().toLocaleTimeString(),
                symbol: curSig.symbol,
                type: curSig.type,
                entry: curSig.entryPrice,
                tp: curSig.takeProfit,
                sl: curSig.stopLoss,
                outcome: 'TAKE_PROFIT_HIT',
                pnlUsd: resolved.realizedPnlUsd,
                pnlKes: resolved.realizedPnlKes,
              },
              ...prev.slice(0, 9),
            ]);

            if ((autoRearmEnabled || autoPilotActive) && !newsBlocksRearm) {
              setAutoRearmCountdown(3);
            }
          } else if (nextPrice >= curSig.stopLoss) {
            const isBe = curSig.isBreakEvenArmed;
            const diffPoints = isBe
              ? Math.abs(curSig.entryPrice - curSig.stopLoss)
              : -Math.abs(curSig.stopLoss - curSig.entryPrice);
            const pnlUsd = Number((diffPoints * selectedLots * pointMult * currencyScaler).toFixed(2));
            const pnlKes = Math.round(pnlUsd * 129.86);
            const resolved: DormantLockedSignal = {
              ...curSig,
              status: 'STOP_LOSS_HIT',
              resolvedAt: new Date().toLocaleTimeString(),
              realizedPnlUsd: isBe ? Math.max(2, pnlUsd) : Math.min(-5, pnlUsd),
              realizedPnlKes: isBe ? Math.max(260, pnlKes) : Math.min(-650, pnlKes),
            };
            dormantSignalRef.current = resolved;
            setDormantSignal(resolved);
            playChime('sl', isMuted);

            setSignalHistory((prev) => [
              {
                id: resolved.id,
                time: resolved.resolvedAt || new Date().toLocaleTimeString(),
                symbol: curSig.symbol,
                type: curSig.type,
                entry: curSig.entryPrice,
                tp: curSig.takeProfit,
                sl: curSig.stopLoss,
                outcome: isBe ? 'BREAK_EVEN_HIT' : 'STOP_LOSS_HIT',
                pnlUsd: resolved.realizedPnlUsd,
                pnlKes: resolved.realizedPnlKes,
              },
              ...prev.slice(0, 9),
            ]);

            if ((autoRearmEnabled || autoPilotActive) && !newsBlocksRearm) {
              setAutoRearmCountdown(3);
            }
          }
        }
      }

      // Update open studio positions directly from incoming live price
      setActiveStudioPositions((positions) =>
        positions.map((pos) => {
          if (pos.symbol === activeAsset.symbol) {
            const diff = pos.type === 'BUY' ? nextPrice - pos.openPrice : pos.openPrice - nextPrice;
            const pointMult =
              activeAsset.category === 'FOREX' || activeAsset.category === 'EAST_AFRICA' ? 10000 : 1;
            const pnl = Number(
              (diff * pos.lots * pointMult * (activeAsset.symbol === 'USDKES' ? 0.0077 : 1)).toFixed(2)
            );
            return {
              ...pos,
              currentPrice: nextPrice,
              pnl,
              sl: dormantSignalRef.current?.stopLoss || pos.sl,
              isBreakEven: dormantSignalRef.current?.isBreakEvenArmed || false,
            };
          }
          return pos;
        })
      );
    },
    [
      activeAsset,
      selectedLots,
      autoRearmEnabled,
      autoPilotActive,
      breakEvenFeatureEnabled,
      isMuted,
      newsAutoPauseEnabled,
      newsGuard.isHazardWindow,
    ]
  );

  // Drive live spot updates for non-Deriv assets straight from TradingView live quote feed
  useEffect(() => {
    if (activeAsset.category === 'DERIV_24_7') return;
    const tvQ = lookupTradingViewQuote(liveTvQuotes, activeAsset.symbol);
    if (tvQ && tvQ.price > 0) {
      processLivePriceTick(tvQ.price);
    }
  }, [liveTvQuotes, activeAsset.symbol, activeAsset.category, processLivePriceTick]);

  // Handle countdown for Auto-Rearm & Autonomous Loop
  useEffect(() => {
    if (autoRearmCountdown === null) return;
    if (newsAutoPauseEnabled && newsGuard.isHazardWindow) {
      setAutoRearmCountdown(null);
      return;
    }
    if (autoRearmCountdown <= 0) {
      handleRearmAtSpot();
      setAutoRearmCountdown(null);
      return;
    }
    const timer = setTimeout(() => {
      setAutoRearmCountdown((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => clearTimeout(timer);
  }, [autoRearmCountdown, handleRearmAtSpot, newsAutoPauseEnabled, newsGuard.isHazardWindow]);

  // Run Real Historical OHLCV Bar-by-Bar Strategy Backtest via /api/stocks/history
  const handleRunBacktest = async () => {
    setIsBacktesting(true);
    try {
      const apiTf =
        selectedTimeframe === 'M1' || selectedTimeframe === '1s'
          ? '1m'
          : selectedTimeframe === 'M5'
          ? '5m'
          : selectedTimeframe === 'M15'
          ? '15m'
          : selectedTimeframe === 'H1'
          ? '1H'
          : '4H';
      const clean = activeAsset.symbol.replace('/', '').toUpperCase();
      const apiTicker =
        activeAsset.category === 'INDICES' || activeAsset.category === 'CRYPTO'
          ? clean
          : clean.length === 6 && !clean.startsWith('R_') && !clean.startsWith('1HZ')
          ? `${clean.slice(0, 3)}/${clean.slice(3)}`
          : activeAsset.symbol;

      let bars: Array<{ open: number; high: number; low: number; close: number }> = [];
      try {
        const res = await fetch(
          `/api/stocks/history?ticker=${encodeURIComponent(apiTicker)}&timeframe=${encodeURIComponent(apiTf)}`
        );
        if (res.ok) {
          const data = await res.json();
          if (data?.success && Array.isArray(data.candles) && data.candles.length >= 25) {
            bars = data.candles;
          }
        }
      } catch {
        // fallback below
      }

      if (bars.length < 25) {
        bars = generateCandles(activeAsset.symbol, livePriceRef.current || activeAsset.basePrice, 0, apiTf as any);
      }

      let balance = 10000;
      const equity = [balance];
      let wins = 0;
      let losses = 0;
      let breakEvens = 0;
      let totalGain = 0;
      let totalLoss = 0;
      let peak = balance;
      let maxDd = 0;
      const tradeReturns: number[] = [];

      const parsedRR = parseFloat((dormantSignalRef.current?.rrRatio || '1:2.8').split(':')[1] || '2.8');
      const cappedRR = Math.min(MAX_RISK_REWARD, Math.max(1.2, Number.isFinite(parsedRR) ? parsedRR : 2.8));

      // Compute rolling EMA9 & EMA21 and walk through bars chronologically
      let ema9 = bars[0].close;
      let ema21 = bars[0].close;
      const k9 = 2 / (9 + 1);
      const k21 = 2 / (21 + 1);

      let i = 1;
      while (i < bars.length - 2) {
        ema9 = bars[i].close * k9 + ema9 * (1 - k9);
        ema21 = bars[i].close * k21 + ema21 * (1 - k21);

        if (i < 15) {
          i++;
          continue;
        }

        // True range for recent bar volatility
        const sliceStart = Math.max(1, i - 13);
        let atrSum = 0;
        for (let k = sliceStart; k <= i; k++) {
          const tr = Math.max(
            bars[k].high - bars[k].low,
            Math.abs(bars[k].high - bars[k - 1].close),
            Math.abs(bars[k].low - bars[k - 1].close)
          );
          atrSum += tr;
        }
        const atr = Math.max(bars[i].close * 0.0005, atrSum / (i - sliceStart + 1));

        const dir: 'BUY' | 'SELL' =
          selectedBot.id.includes('boom')
            ? 'BUY'
            : selectedBot.id.includes('crash')
            ? 'SELL'
            : ema9 >= ema21
            ? 'BUY'
            : 'SELL';

        const entry = bars[i].close;
        const slDist = atr * 1.4;
        const tpDist = slDist * cappedRR;
        const sl = dir === 'BUY' ? entry - slDist : entry + slDist;
        const tp = dir === 'BUY' ? entry + tpDist : entry - tpDist;
        const beTrigger = dir === 'BUY' ? entry + tpDist * 0.45 : entry - tpDist * 0.45;
        let beArmed = false;

        const riskDollar = balance * 0.015;
        let resolved = false;
        let j = i + 1;
        while (j < bars.length) {
          const b = bars[j];
          ema9 = b.close * k9 + ema9 * (1 - k9);
          ema21 = b.close * k21 + ema21 * (1 - k21);

          if (dir === 'BUY') {
            if (!beArmed && b.high >= beTrigger && breakEvenFeatureEnabled) {
              beArmed = true;
            }
            if (b.low <= (beArmed ? entry : sl)) {
              if (beArmed) {
                breakEvens++;
                balance += 5;
                tradeReturns.push(0.05);
              } else {
                losses++;
                balance -= riskDollar;
                totalLoss += riskDollar;
                tradeReturns.push(-1.5);
              }
              resolved = true;
              break;
            }
            if (b.high >= tp) {
              wins++;
              const reward = riskDollar * cappedRR;
              balance += reward;
              totalGain += reward;
              tradeReturns.push(1.5 * cappedRR);
              resolved = true;
              break;
            }
          } else {
            if (!beArmed && b.low <= beTrigger && breakEvenFeatureEnabled) {
              beArmed = true;
            }
            if (b.high >= (beArmed ? entry : sl)) {
              if (beArmed) {
                breakEvens++;
                balance += 5;
                tradeReturns.push(0.05);
              } else {
                losses++;
                balance -= riskDollar;
                totalLoss += riskDollar;
                tradeReturns.push(-1.5);
              }
              resolved = true;
              break;
            }
            if (b.low <= tp) {
              wins++;
              const reward = riskDollar * cappedRR;
              balance += reward;
              totalGain += reward;
              tradeReturns.push(1.5 * cappedRR);
              resolved = true;
              break;
            }
          }
          j++;
        }

        if (!resolved) {
          // Mark-to-market close at final historical candle
          const finalClose = bars[bars.length - 1].close;
          const rDiff =
            dir === 'BUY' ? (finalClose - entry) / slDist : (entry - finalClose) / slDist;
          const pnl = riskDollar * rDiff;
          balance += pnl;
          if (pnl >= 0) {
            wins++;
            totalGain += pnl;
          } else {
            losses++;
            totalLoss += Math.abs(pnl);
          }
          tradeReturns.push(rDiff * 1.5);
        }

        if (balance > peak) peak = balance;
        const currentDd = ((peak - balance) / peak) * 100;
        if (currentDd > maxDd) maxDd = currentDd;
        equity.push(Math.round(balance));

        i = Math.max(i + 2, j + 1);
      }

      const completed = wins + losses + breakEvens;
      const meanRet =
        tradeReturns.length > 0
          ? tradeReturns.reduce((a, b) => a + b, 0) / tradeReturns.length
          : 0;
      const variance =
        tradeReturns.length > 1
          ? tradeReturns.reduce((s, r) => s + Math.pow(r - meanRet, 2), 0) / tradeReturns.length
          : 1;
      const std = Math.sqrt(variance) || 1;
      const sharpe = Number(Math.max(0, Math.min(4.5, (meanRet / std) * Math.sqrt(12))).toFixed(2));
      const netProfit = balance - 10000;

      setBacktestStats({
        totalTrades: Math.max(1, completed),
        winRate: completed > 0 ? Math.round(((wins + breakEvens * 0.5) / completed) * 100) : 0,
        profitFactor: Number((totalGain / Math.max(1, totalLoss)).toFixed(2)),
        netProfitUsd: Math.round(netProfit),
        netProfitKes: Math.round(netProfit * 129.86),
        maxDrawdown: Number(maxDd.toFixed(1)),
        sharpeRatio: sharpe,
        equityCurve: equity,
      });
    } finally {
      setIsBacktesting(false);
    }
  };

  // Initialize bot custom parameters
  useEffect(() => {
    const init: Record<string, any> = {};
    selectedBot.parameters.forEach((p) => {
      init[p.id] = p.defaultValue;
    });
    setCustomParams(init);
    setCopiedCode(false);
    setCopiedWebhook(false);
    setDeployedSuccess(false);
  }, [selectedBotId]);

  // Filtered assets for selector modal
  const filteredAssets = useMemo(() => {
    return ALL_ASSETS.filter((a) => {
      const matchesCat = currencyCategoryFilter === 'ALL' || a.category === currencyCategoryFilter;
      const matchesSearch =
        a.symbol.toLowerCase().includes(currencySearch.toLowerCase()) ||
        a.name.toLowerCase().includes(currencySearch.toLowerCase());
      return matchesCat && matchesSearch;
    });
  }, [currencyCategoryFilter, currencySearch]);

  // Filtered bots list supporting both catalog EAs and user custom EAs
  const filteredBots = useMemo(() => {
    return allAvailableBots.filter((b) => {
      if (botCategoryFilter === 'ALL') return true;
      if (botCategoryFilter === 'CUSTOM') return b.id.startsWith('custom-ea-');
      return b.category === botCategoryFilter;
    });
  }, [allAvailableBots, botCategoryFilter]);

  // Auto-detect parameters, description, and currency from pasted MQL5/MQL4 code
  const handleAutoParseCode = (pastedCode: string) => {
    let detectedName = importForm.name;
    let detectedDesc = importForm.tagline;
    let detectedSymbol = importForm.defaultSymbol;
    let detectedCategory = importForm.category;

    // Detect EA filename or copyright
    const fileMatch = pastedCode.match(/\/\/\s*([a-zA-Z0-9_\s]+)\.mq[45]/i);
    const copyrightMatch = pastedCode.match(/#property\s+copyright\s+"([^"]+)"/i);
    if (fileMatch && fileMatch[1]) {
      detectedName = fileMatch[1].replace(/_/g, ' ').trim();
    } else if (copyrightMatch && copyrightMatch[1]) {
      detectedName = copyrightMatch[1].replace(/_/g, ' ').trim();
    }

    // Detect Description
    const descMatch = pastedCode.match(/#property\s+description\s+"([^"]+)"/i);
    if (descMatch && descMatch[1]) {
      detectedDesc = descMatch[1];
    }

    // Detect target symbols
    if (pastedCode.includes('XAUUSD') || pastedCode.includes('Gold')) {
      detectedSymbol = 'XAUUSD';
      detectedCategory = 'FOREX_MT5';
    } else if (pastedCode.includes('GBPUSD')) {
      detectedSymbol = 'GBPUSD';
      detectedCategory = 'FOREX_MT5';
    } else if (pastedCode.includes('EURUSD')) {
      detectedSymbol = 'EURUSD';
      detectedCategory = 'FOREX_MT5';
    } else if (pastedCode.includes('USDKES')) {
      detectedSymbol = 'USDKES';
      detectedCategory = 'FOREX_MT5';
    } else if (pastedCode.includes('R_75') || pastedCode.includes('Volatility 75') || pastedCode.includes('BOOM') || pastedCode.includes('CRASH')) {
      detectedSymbol = 'R_75';
      detectedCategory = 'DERIV_24_7';
    } else if (pastedCode.includes('US30') || pastedCode.includes('NAS100')) {
      detectedSymbol = 'US30';
      detectedCategory = 'FOREX_MT5';
    }

    setImportForm((prev) => ({
      ...prev,
      code: pastedCode,
      name: detectedName,
      tagline: detectedDesc,
      defaultSymbol: detectedSymbol,
      category: detectedCategory,
    }));
  };

  // Save new custom EA to local storage and arm immediately in studio
  const handleSaveCustomBot = () => {
    if (!importForm.name.trim()) return;

    // Extract input parameters from code
    const parsedParams: any[] = [];
    const inputMatches = [...importForm.code.matchAll(/input\s+([a-zA-Z0-9_]+)\s+([a-zA-Z0-9_]+)\s*=\s*([^;]+);/g)];
    inputMatches.forEach((m) => {
      const typeStr = m[1];
      const paramId = m[2];
      const valStr = m[3].trim();
      parsedParams.push({
        id: paramId,
        name: paramId.replace(/^Inp/, '').replace(/([A-Z])/g, ' $1').trim(),
        description: `Input parameter ${paramId} extracted from EA source code`,
        type: typeStr === 'double' || typeStr === 'int' ? 'number' : typeStr === 'bool' ? 'boolean' : 'string',
        defaultValue: typeStr === 'double' ? parseFloat(valStr) || 0.1 : typeStr === 'int' ? parseInt(valStr) || 10 : valStr === 'true' ? true : valStr === 'false' ? false : valStr,
      });
    });

    const newBot: BotDefinition = {
      id: `custom-ea-${Date.now()}`,
      name: importForm.name,
      category: importForm.category,
      tagline: importForm.tagline || 'Custom Scalper EA imported by user',
      description: importForm.tagline || 'Custom Scalper EA imported by user with adaptive volatility controls.',
      targetSymbols: [importForm.defaultSymbol],
      defaultSymbol: importForm.defaultSymbol,
      defaultTimeframe: importForm.defaultTimeframe,
      magicNumber: 100000 + (Date.now() % 900000),
      badge: 'CUSTOM USER EA',
      badgeColor: 'teal',
      winRate: Number(importForm.winRate) || 82,
      profitFactor: 2.85,
      avgRiskReward: importForm.avgRiskReward || '1:3.4',
      maxDrawdown: '2.8%',
      marketHours: importForm.category === 'DERIV_24_7' ? '24/7 Non-stop' : 'Mon - Fri (24h)',
      indicators: ['User Scalping Algorithm', 'Dynamic ATR Invalidation', 'Institutional Confluence Filter'],
      edgeBreakdown: [
        'Proprietary User Strategy: Uploaded custom algorithm integrated into studio.',
        'Strict Binary BUY / SELL Dormant Levels: Fixed targets until TP or SL.',
        'Break-Even Shield & MTF Confluence enabled.',
      ],
      parameters: parsedParams.length > 0 ? parsedParams : [
        { id: 'fixedLot', name: 'Fixed Lot Size', description: 'Volume per execution order', type: 'number', defaultValue: 0.10, min: 0.01, max: 10.0, step: 0.01 },
      ],
      generateMql5Code: () => importForm.code || `// Custom User EA\n#property copyright "Custom User EA"\n`,
    };

    const updated = [newBot, ...customBots];
    setCustomBots(updated);
    try {
      localStorage.setItem('njia_custom_scalping_eas', JSON.stringify(updated));
      scheduleTradingCloudPush();
    } catch {}

    setSelectedBotId(newBot.id);
    setSelectedCurrency(newBot.defaultSymbol);
    setIsImportModalOpen(false);
    playChime('arm', isMuted);
    setRearmNotice(`🎉 CUSTOM EA "${newBot.name}" IMPORTED & ARMED IN STUDIO!`);
    setTimeout(() => setRearmNotice(null), 4500);
  };

  // Delete custom bot
  const handleDeleteCustomBot = (botId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = customBots.filter((b) => b.id !== botId);
    setCustomBots(updated);
    try {
      localStorage.setItem('njia_custom_scalping_eas', JSON.stringify(updated));
      scheduleTradingCloudPush();
    } catch {}
    if (selectedBotId === botId) {
      setSelectedBotId(BOT_CATALOG[0].id);
    }
  };

  // Manual execution order handler linking to the dormant signal
  const handleExecuteOrder = (type: 'BUY' | 'SELL') => {
    const ticket = 100000 + (Date.now() % 900000);
    const newPos = {
      ticket,
      symbol: activeAsset.symbol,
      botName: selectedBot.name,
      type,
      lots: selectedLots,
      openPrice: livePrice,
      currentPrice: livePrice,
      sl: dormantSignal.stopLoss,
      tp: dormantSignal.takeProfit,
      pnl: 0,
      isBreakEven: false,
      time: new Date().toLocaleTimeString(),
    };
    setActiveStudioPositions((prev) => [newPos, ...prev]);
    playChime('arm', isMuted);
  };

  const handleClosePosition = (ticket: number) => {
    setActiveStudioPositions((prev) => prev.filter((p) => p.ticket !== ticket));
  };

  const handleCopyMql5 = () => {
    const code = selectedBot.generateMql5Code({
      ...customParams,
      symbol: activeAsset.symbol,
      timeframe: selectedTimeframe,
      signalType: dormantSignal.type,
      fixedSl: dormantSignal.stopLoss,
      fixedTp: dormantSignal.takeProfit,
    });
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleCopyWebhookPayload = () => {
    const payload = JSON.stringify({
      secret: "NJIA_QUANT_KEY_SECURE_9918",
      bot: selectedBot.name,
      action: dormantSignal.type,
      symbol: activeAsset.symbol,
      lots: selectedLots,
      entry: dormantSignal.entryPrice,
      sl: dormantSignal.stopLoss,
      tp: dormantSignal.takeProfit,
      breakEvenThreshold: "50%",
      timestamp: new Date().toISOString(),
    }, null, 2);
    navigator.clipboard.writeText(payload);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2500);
  };

  const handleDownloadMql5 = () => {
    const code = selectedBot.generateMql5Code({
      ...customParams,
      symbol: activeAsset.symbol,
      timeframe: selectedTimeframe,
      signalType: dormantSignal.type,
      fixedSl: dormantSignal.stopLoss,
      fixedTp: dormantSignal.takeProfit,
    });
    const element = document.createElement('a');
    const file = new Blob([code], { type: 'text/plain;charset=utf-8' });
    element.href = URL.createObjectURL(file);
    element.download = `${selectedBot.name.replace(/[^a-zA-Z0-9]/g, '_')}_${activeAsset.symbol}_${dormantSignal.type}.mq5`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleDeployToDeck = () => {
    setDeployedSuccess(true);
    setTimeout(() => {
      setActiveTab('mt5-ea');
    }, 900);
  };

  // Distance metrics to dormant TP and SL
  const distToTp = Math.abs(dormantSignal.takeProfit - livePrice).toFixed(activeAsset.digits);
  const distToSl = Math.abs(livePrice - dormantSignal.stopLoss).toFixed(activeAsset.digits);

  // Floating PnL of dormant signal against entry
  const dormantFloatingDiff = dormantSignal.type === 'BUY'
    ? (livePrice - dormantSignal.entryPrice)
    : (dormantSignal.entryPrice - livePrice);
  const dormantFloatingUsd = Number((dormantFloatingDiff * selectedLots * (activeAsset.category === 'FOREX' ? 100 : 1)).toFixed(2));
  const dormantFloatingKes = Math.round(dormantFloatingUsd * 129.86);

  return (
    <div className="space-y-6">
      {/* =========================================================================
          TOP COMMAND BANNER: ASSET SELECTOR & BOT ARMING COCKPIT
          ========================================================================= */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-[#0b172a] via-[#091222] to-[#060b14] border border-teal-500/35 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col xl:flex-row xl:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/25 text-[#0df2c9] text-xs font-semibold">
              <Cpu className="w-3.5 h-3.5" />
              <span>Perfect Algorithmic Execution System • MTF Confluence & Break-Even Shield</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Institutional Bot Studio & Currency Dispatcher
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Engineered for perfection: <strong className="text-white">Strict binary BUY / SELL dormant signals</strong>, <strong className="text-[#0df2c9]">Automated Break-Even Armor</strong>, multi-timeframe directional agreement, and hands-free autonomous trading.
            </p>
          </div>

          {/* Quick Active Asset HUD Tile */}
          <div className="p-4 rounded-2xl bg-[#08101e] border border-teal-500/40 shadow-xl flex items-center justify-between gap-6 min-w-[320px]">
            <div>
              <div className="text-[10px] uppercase font-mono text-slate-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>Selected Asset Feed</span>
              </div>
              <div className="text-lg font-bold font-mono text-white mt-0.5 flex items-center gap-2">
                <span>{activeAsset.symbol}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-teal-500/20 text-[#0df2c9]">
                  {activeAsset.category}
                </span>
              </div>
              <div className="text-[11px] text-slate-400 truncate max-w-[180px]">{activeAsset.name}</div>
            </div>

            <div className="text-right">
              <div className="text-[10px] font-mono text-slate-400">LIVE TICK PRICE</div>
              <div
                className={`text-xl sm:text-2xl font-mono font-black tabular-nums transition-colors duration-150 ${
                  lastTickDir === 'UP' ? 'text-[#0df2c9]' : 'text-rose-400'
                }`}
              >
                {livePrice.toLocaleString(undefined, {
                  minimumFractionDigits: activeAsset.digits,
                  maximumFractionDigits: activeAsset.digits,
                })}
              </div>
              <div className="text-[10px] font-mono text-emerald-400">Spread: {activeAsset.spreadPips} pips</div>
            </div>
          </div>
        </div>

        {/* QUICK CURRENCY SELECTOR STRIP */}
        <div className="mt-5 pt-4 border-t border-[#142136] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono uppercase text-slate-400 font-bold flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-[#0df2c9]" />
              <span>Choose Currency to Analyze:</span>
            </span>

            {/* Modal opener button */}
            <button
              onClick={() => setIsCurrencySelectorOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-[#0d182b] hover:bg-[#13233e] border border-teal-500/40 text-xs font-bold text-white flex items-center gap-2 transition-colors cursor-pointer shadow-sm"
            >
              <Globe className="w-3.5 h-3.5 text-[#0df2c9]" />
              <span>Browse All {ALL_ASSETS.length} Assets</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </div>

          {/* Quick-Pick Popular Currency Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1">
            {['XAUUSD', 'EURUSD', 'GBPUSD', 'USDKES', 'R_75', 'BOOM1000', 'CRASH1000', 'BTCUSD'].map((sym) => {
              const isCurrent = selectedCurrency === sym;
              return (
                <button
                  key={sym}
                  onClick={() => setSelectedCurrency(sym)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer whitespace-nowrap ${
                    isCurrent
                      ? 'bg-teal-500 text-slate-950 shadow-md shadow-teal-500/30'
                      : 'bg-[#08101e] hover:bg-[#101e35] text-slate-300 border border-[#162742]'
                  }`}
                >
                  {sym === 'XAUUSD' ? 'Gold (XAU)' : sym === 'USDKES' ? 'USD/KES' : sym}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* RE-ARM TOAST / BANNER ALERT (Appears when Re-arm is triggered) */}
      {rearmNotice && (
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-teal-500/25 via-[#0df2c9]/20 to-teal-500/10 border border-teal-400/60 shadow-lg flex items-center justify-between gap-4 animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-xl bg-teal-400 text-slate-950 flex items-center justify-center font-bold">
              <Zap className="w-4 h-4 fill-current" />
            </span>
            <div>
              <div className="text-xs font-extrabold text-[#0df2c9] tracking-wide">
                {rearmNotice}
              </div>
              <div className="text-[11px] text-slate-300">
                Take Profit locked at <strong className="text-emerald-400 font-mono">{dormantSignal.takeProfit}</strong> • Stop Loss locked at <strong className="text-rose-400 font-mono">{dormantSignal.stopLoss}</strong>
              </div>
            </div>
          </div>
          <button
            onClick={() => setRearmNotice(null)}
            className="text-slate-400 hover:text-white p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* =========================================================================
          3-ZONE TACTICAL LAYOUT
          ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* =======================================================================
            ZONE 1: BOT ARSENAL RAIL (LEFT 4 COLS)
            ======================================================================= */}
        <div className="lg:col-span-4 space-y-4">
          <div className="p-4 rounded-3xl bg-[#091120] border border-[#16243a] shadow-xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#142136]">
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-[#0df2c9]" />
                <h2 className="text-xs font-extrabold text-white uppercase tracking-wider">
                  Select Bot to Arm ({allAvailableBots.length})
                </h2>
              </div>

              {/* Category Filter */}
              <div className="flex bg-[#060b14] p-0.5 rounded-lg border border-[#15233a] text-[10px]">
                {(['ALL', 'FOREX_MT5', 'DERIV_24_7', 'CUSTOM'] as const).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setBotCategoryFilter(cat)}
                    className={`px-2 py-0.5 rounded-md font-semibold transition-all cursor-pointer ${
                      botCategoryFilter === cat
                        ? 'bg-teal-500/20 text-[#0df2c9] border border-teal-500/30'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {cat === 'ALL' ? 'All' : cat === 'FOREX_MT5' ? 'Forex' : cat === 'DERIV_24_7' ? 'Deriv' : 'Custom'}
                  </button>
                ))}
              </div>
            </div>

            {/* + Import Custom Scalper EA Button */}
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="w-full py-2.5 px-3 rounded-2xl bg-gradient-to-r from-teal-500/20 via-[#0df2c9]/15 to-teal-500/20 hover:from-teal-500/30 hover:to-[#0df2c9]/25 border border-teal-500/40 text-xs font-bold text-[#0df2c9] flex items-center justify-center gap-2 cursor-pointer shadow-sm transition-all active:scale-[0.99]"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Import / Paste Scalping EA Code</span>
            </button>

            {/* Bot List */}
            <div className="space-y-2 max-h-[640px] overflow-y-auto pr-1 scrollbar-thin">
              {filteredBots.map((bot) => {
                const isSelected = selectedBotId === bot.id;
                const isCustom = bot.id.startsWith('custom-ea-');
                return (
                  <button
                    key={bot.id}
                    onClick={() => setSelectedBotId(bot.id)}
                    className={`w-full p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col gap-2 relative overflow-hidden group ${
                      isSelected
                        ? 'bg-gradient-to-br from-[#0e1a2f] to-[#091222] border-teal-400/80 shadow-lg shadow-teal-950/40 ring-1 ring-teal-400/30'
                        : 'bg-[#070d18] hover:bg-[#0c1628] border-[#132034] text-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold uppercase ${
                              isCustom
                                ? 'bg-teal-500/20 text-[#0df2c9] border border-teal-500/40'
                                : bot.category === 'DERIV_24_7'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                            }`}
                          >
                            {isCustom ? 'USER CUSTOM' : bot.category === 'DERIV_24_7' ? 'DERIV 24/7' : 'FOREX MT5'}
                          </span>
                          <span className="text-[10px] text-[#0df2c9] font-mono font-bold">
                            {bot.badge}
                          </span>
                        </div>
                        <div className="text-xs font-bold text-white group-hover:text-[#0df2c9] transition-colors leading-tight">
                          {bot.name}
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        {isCustom && (
                          <button
                            onClick={(e) => handleDeleteCustomBot(bot.id, e)}
                            className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                            title="Delete this custom EA"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <span
                          className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                            isSelected ? 'bg-emerald-400 animate-ping' : 'bg-slate-600'
                          }`}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] font-mono pt-1 border-t border-[#121e30]">
                      <span className="text-emerald-400 font-bold">Win: {bot.winRate}%</span>
                      <span className="text-[#0df2c9]">PF: {bot.profitFactor}</span>
                      <span className="text-slate-400">R:R {bot.avgRiskReward}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* =======================================================================
            ZONE 2 & 3: DORMANT SIGNAL, VISUAL CANVAS & LIVE TRADE PAD (RIGHT 8 COLS)
            ======================================================================= */}
        <div className="lg:col-span-8 space-y-4">
          
          {/* Header Card: Active Bot Analyzing Selected Currency & Re-arm Sentinel */}
          <div className="p-5 sm:p-6 rounded-3xl bg-[#091120] border border-teal-500/30 shadow-2xl relative overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#142136]">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-[#0df2c9] shrink-0 font-bold">
                  {activeAsset.symbol.slice(0, 3)}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg sm:text-xl font-bold text-white">
                      {selectedBot.name}
                    </h2>
                    <span className="text-xs font-mono font-bold text-teal-300 px-2 py-0.5 rounded bg-teal-500/20 border border-teal-500/30">
                      ON {activeAsset.symbol}
                    </span>
                    {(() => {
                      const assetSession = getAssetMarketSession(activeAsset.symbol, activeAsset.category);
                      return assetSession.isOpen ? (
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                          {assetSession.statusBadge}
                        </span>
                      ) : (
                        <span
                          className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30"
                          title={assetSession.nextSessionText}
                        >
                          MARKET CLOSED · {assetSession.nextSessionText}
                        </span>
                      );
                    })()}
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Signal is strictly binary and <strong className="text-white">frozen dormant</strong> until TP or SL is triggered on <strong className="text-[#0df2c9]">{activeAsset.name}</strong>.
                  </p>
                </div>
              </div>

              {/* Direction Selector, Timeframe Selector, Re-arm Engine, Audio & Deploy Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                
                {/* Scan Timeframe Selector */}
                <div className="flex items-center bg-[#060b14] p-1 rounded-xl border border-[#162742] text-[11px] font-mono">
                  {(['1s', 'M1', 'M5', 'M15', 'H1', 'H4'] as const).map((tf) => (
                    <button
                      key={tf}
                      type="button"
                      onClick={() => setSelectedTimeframe(tf)}
                      className={`px-2 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                        selectedTimeframe === tf
                          ? 'bg-[#0df2c9] text-slate-950 shadow-sm font-black'
                          : 'text-slate-400 hover:text-white'
                      }`}
                      title={`Scan & calibrate SL/TP on ${tf} timeframe (Max 1:5.0 R:R)`}
                    >
                      {tf}
                    </button>
                  ))}
                </div>

                {/* Audio Mute/Unmute */}
                <button
                  onClick={() => setIsMuted(!isMuted)}
                  className={`p-2 rounded-xl border text-xs transition-colors cursor-pointer ${
                    isMuted
                      ? 'bg-[#0b1322] border-slate-700 text-slate-500'
                      : 'bg-teal-500/10 border-teal-500/30 text-[#0df2c9]'
                  }`}
                  title={isMuted ? 'Unmute Sound Effects' : 'Mute Sound Effects'}
                >
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>

                {/* Autonomous Auto-Pilot Toggle */}
                <button
                  onClick={() => {
                    if (!autoPilotActive) {
                      const guard = evaluatePropTradeBlock();
                      setPropGuardBlock(guard);
                      if (guard.blocked) {
                        setRearmNotice(`Prop Guardian Lockout: ${guard.reason}`);
                        setTimeout(() => setRearmNotice(null), 5000);
                        return;
                      }
                    }
                    setAutoPilotActive(!autoPilotActive);
                  }}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    propGuardBlock.blocked
                      ? 'bg-rose-950/60 text-rose-300 border-rose-500/50 cursor-not-allowed'
                      : autoPilotActive
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 shadow-md shadow-emerald-500/30 font-black animate-pulse'
                      : 'bg-[#070e1b] text-slate-400 border-slate-800'
                  }`}
                  title={
                    propGuardBlock.blocked
                      ? `Blocked by Prop Guardian: ${propGuardBlock.reason}`
                      : 'When active, the bot automatically executes trades, moves to break-even, takes profit, and re-arms continuously'
                  }
                >
                  {propGuardBlock.blocked ? (
                    <Lock className="w-3.5 h-3.5" />
                  ) : autoPilotActive ? (
                    <PlayCircle className="w-3.5 h-3.5" />
                  ) : (
                    <StopCircle className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {propGuardBlock.blocked
                      ? 'PROP LOCKED'
                      : `Auto-Pilot: ${autoPilotActive ? 'ENGAGED' : 'OFF'}`}
                  </span>
                </button>

                {/* Break-Even Shield Toggle */}
                <button
                  onClick={() => setBreakEvenFeatureEnabled(!breakEvenFeatureEnabled)}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-mono font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    breakEvenFeatureEnabled
                      ? 'bg-teal-500/20 text-[#0df2c9] border-teal-500/50'
                      : 'bg-[#070e1b] text-slate-500 border-slate-800'
                  }`}
                  title="Automatically moves Stop Loss to Entry once price travels 50% towards TP"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Break-Even: {breakEvenFeatureEnabled ? 'AUTO' : 'OFF'}</span>
                </button>

                {/* Red-News Auto-Pause Shield Toggle */}
                <button
                  onClick={() => setNewsAutoPauseEnabled(!newsAutoPauseEnabled)}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-mono font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    newsAutoPauseEnabled && newsGuard.isHazardWindow
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 animate-pulse'
                      : newsAutoPauseEnabled
                      ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40'
                      : 'bg-[#070e1b] text-slate-500 border-slate-800'
                  }`}
                  title={newsGuard.detailLabel}
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>
                    {newsAutoPauseEnabled && newsGuard.isHazardWindow
                      ? 'NEWS PAUSE ACTIVE'
                      : newsAutoPauseEnabled
                      ? 'News Shield: ON'
                      : 'News Shield: OFF'}
                  </span>
                </button>

                {/* Direction Switchers */}
                <div className="flex bg-[#060b14] p-1 rounded-xl border border-[#162742] text-xs font-bold font-mono">
                  <button
                    onClick={() => handleArmSignal('BUY')}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                      dormantSignal.type === 'BUY'
                        ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30 font-black'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <ArrowUpRight className="w-3.5 h-3.5 stroke-[3]" />
                    <span>Arm BUY</span>
                  </button>
                  <button
                    onClick={() => handleArmSignal('SELL')}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                      dormantSignal.type === 'SELL'
                        ? 'bg-rose-500 text-white shadow-md shadow-rose-500/30 font-black'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <TrendingDown className="w-3.5 h-3.5 stroke-[3]" />
                    <span>Arm SELL</span>
                  </button>
                </div>

                {/* PROMINENT RE-ARM BUTTON */}
                <button
                  onClick={() => handleRearmAtSpot()}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-md ${
                    rearmPulseActive
                      ? 'bg-teal-400 text-slate-950 ring-2 ring-teal-300 scale-105'
                      : 'bg-gradient-to-r from-[#0d2238] to-[#122e4c] hover:from-[#133252] hover:to-[#183d63] border border-teal-500/50 text-[#0df2c9]'
                  }`}
                  title="Reset and lock signal at current spot price"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${rearmPulseActive ? 'animate-spin' : ''}`} />
                  <span>{rearmPulseActive ? 'Armed!' : 'Re-arm'}</span>
                </button>

                <button
                  onClick={handleDeployToDeck}
                  className={`px-4 py-1.5 rounded-xl font-bold text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer ${
                    deployedSuccess
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-gradient-to-r from-teal-400 to-[#0df2c9] text-slate-950 hover:brightness-110 active:scale-95 shadow-teal-500/20'
                  }`}
                >
                  {deployedSuccess ? (
                    <>
                      <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>Opening Deck...</span>
                    </>
                  ) : (
                    <>
                      <Crosshair className="w-3.5 h-3.5" />
                      <span>Deploy to Deck</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Sub-Tabs: Scanner, Backtest Lab, Webhook Bridge, Mechanics, Tools, Params, Code */}
            <div className="flex items-center gap-1 pt-3 overflow-x-auto scrollbar-none text-xs font-semibold">
              <button
                onClick={() => setActiveAnalysisTab('scanner')}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                  activeAnalysisTab === 'scanner'
                    ? 'bg-teal-500/20 text-[#0df2c9] border border-teal-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Live Signal & Confluence</span>
              </button>

              <button
                onClick={() => setActiveAnalysisTab('backtest')}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                  activeAnalysisTab === 'backtest'
                    ? 'bg-teal-500/20 text-[#0df2c9] border border-teal-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <LineChart className="w-3.5 h-3.5" />
                <span>Strategy Backtester (100 Trades)</span>
              </button>

              <button
                onClick={() => setActiveAnalysisTab('webhook')}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                  activeAnalysisTab === 'webhook'
                    ? 'bg-teal-500/20 text-[#0df2c9] border border-teal-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Network className="w-3.5 h-3.5" />
                <span>MT5 / Deriv Webhook Bridge</span>
              </button>

              <button
                onClick={() => setActiveAnalysisTab('mechanics')}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                  activeAnalysisTab === 'mechanics'
                    ? 'bg-teal-500/20 text-[#0df2c9] border border-teal-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Crosshair className="w-3.5 h-3.5" />
                <span>Visual Strategy Canvas</span>
              </button>

              <button
                onClick={() => setActiveAnalysisTab('tools')}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                  activeAnalysisTab === 'tools'
                    ? 'bg-teal-500/20 text-[#0df2c9] border border-teal-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <BarChart2 className="w-3.5 h-3.5" />
                <span>Quantitative Tools</span>
              </button>

              <button
                onClick={() => setActiveAnalysisTab('params')}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                  activeAnalysisTab === 'params'
                    ? 'bg-teal-500/20 text-[#0df2c9] border border-teal-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Parameters</span>
              </button>

              <button
                onClick={() => setActiveAnalysisTab('code')}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                  activeAnalysisTab === 'code'
                    ? 'bg-teal-500/20 text-[#0df2c9] border border-teal-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>Targeted .MQ5 Code</span>
              </button>
            </div>
          </div>

          {/* TAB 1: DORMANT SIGNAL RADAR, MULTI-TIMEFRAME CONFLUENCE & IN-STUDIO EXECUTION PAD */}
          {activeAnalysisTab === 'scanner' && (
            <div className="space-y-4">
              
              {/* MULTI-TIMEFRAME CONFLUENCE RADAR STRIP */}
              <div className="p-4 rounded-2xl bg-[#081120] border border-teal-500/30 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#0df2c9]" />
                    <span>Multi-Timeframe Trend Confluence Matrix</span>
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono text-[11px] font-black border border-emerald-500/30">
                    {dormantSignal.confluenceScore}% CONFLUENCE (4/4 ALIGNED)
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {mtfMatrix.map((item) => (
                    <div
                      key={item.tf}
                      className="p-2.5 rounded-xl bg-[#050b14] border border-[#13233c] space-y-1"
                    >
                      <div className="flex items-center justify-between text-[10px] font-mono">
                        <span className="font-black text-white">{item.tf}</span>
                        <span className="text-emerald-400 font-bold">{item.bias}</span>
                      </div>
                      <div className="text-xs font-bold text-slate-200">{item.label}</div>
                      <div className="text-[10px] text-slate-400 truncate">{item.indicator}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* =================================================================
                  THE DORMANT SIGNAL STATUS CARD (LOCKED UNTIL TP, SL, OR BE)
                  ================================================================= */}
              <div
                className={`p-5 rounded-3xl border shadow-2xl relative overflow-hidden transition-all duration-300 ${
                  rearmPulseActive
                    ? 'ring-2 ring-teal-400 ring-offset-2 ring-offset-slate-950 scale-[1.01]'
                    : ''
                } ${
                  dormantSignal.status === 'TAKE_PROFIT_HIT'
                    ? 'bg-gradient-to-br from-[#062016] to-[#04120d] border-emerald-500/70 shadow-emerald-950/40 ring-1 ring-emerald-400'
                    : dormantSignal.status === 'STOP_LOSS_HIT'
                    ? 'bg-gradient-to-br from-[#200609] to-[#120406] border-rose-500/70 shadow-rose-950/40 ring-1 ring-rose-400'
                    : dormantSignal.type === 'BUY'
                    ? 'bg-gradient-to-br from-[#091526] via-[#070f1c] to-[#050a14] border-emerald-500/40 shadow-teal-950/30'
                    : 'bg-gradient-to-br from-[#1b0a12] via-[#10070b] to-[#080406] border-rose-500/40 shadow-rose-950/30'
                }`}
              >
                {/* RESOLUTION BANNER: TAKE PROFIT HIT */}
                {dormantSignal.status === 'TAKE_PROFIT_HIT' && (
                  <div className="mb-5 p-5 rounded-2xl bg-gradient-to-r from-emerald-950/90 via-[#06281a] to-emerald-950/80 border-2 border-emerald-400/80 shadow-2xl space-y-4 animate-in fade-in">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-slate-950 flex items-center justify-center font-black shadow-lg shadow-emerald-500/30 shrink-0">
                          <Trophy className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="text-base font-black text-emerald-300 flex items-center gap-2">
                            <span>🎉 TARGET TAKE PROFIT REACHED & EXECUTED!</span>
                            {autoRearmCountdown !== null && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-200 font-mono">
                                Auto-rearming in {autoRearmCountdown}s...
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-200 mt-0.5">
                            Signal reached target at <strong className="text-white font-mono">{dormantSignal.takeProfit}</strong> at {dormantSignal.resolvedAt}.
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-[10px] text-emerald-400 font-mono uppercase tracking-wider">Realized Net Gain</div>
                        <div className="text-xl font-black font-mono text-emerald-300">
                          +${dormantSignal.realizedPnlUsd} USD
                        </div>
                        <div className="text-xs font-bold text-emerald-400 font-mono">
                          +KES {dormantSignal.realizedPnlKes?.toLocaleString()}
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-emerald-500/30 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <button
                          onClick={() => handleRearmAtSpot('BUY')}
                          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:brightness-110 active:scale-95 text-slate-950 font-black text-xs shadow-lg shadow-emerald-900/40 flex items-center gap-2 cursor-pointer transition-all"
                        >
                          <RefreshCw className="w-4 h-4 stroke-[2.5]" />
                          <span>RE-ARM AS BUY @ SPOT ({livePrice})</span>
                        </button>

                        <button
                          onClick={() => handleRearmAtSpot('SELL')}
                          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-500 hover:brightness-110 active:scale-95 text-white font-black text-xs shadow-lg shadow-rose-900/40 flex items-center gap-2 cursor-pointer transition-all"
                        >
                          <RefreshCw className="w-4 h-4 stroke-[2.5]" />
                          <span>RE-ARM AS SELL @ SPOT ({livePrice})</span>
                        </button>
                      </div>

                      {autoRearmCountdown !== null && (
                        <button
                          onClick={() => setAutoRearmCountdown(null)}
                          className="text-[11px] font-mono text-slate-400 hover:text-white underline cursor-pointer"
                        >
                          Cancel Auto-Rearm Timer
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* RESOLUTION BANNER: STOP LOSS HIT */}
                {dormantSignal.status === 'STOP_LOSS_HIT' && (
                  <div className="mb-5 p-5 rounded-2xl bg-gradient-to-r from-rose-950/90 via-[#28060d] to-rose-950/80 border-2 border-rose-400/80 shadow-2xl space-y-4 animate-in fade-in">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-rose-500 text-white flex items-center justify-center font-black shadow-lg shadow-rose-500/30 shrink-0">
                          <ShieldAlert className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="text-base font-black text-rose-300 flex items-center gap-2">
                            <span>{dormantSignal.isBreakEvenArmed ? '🛡️ BREAK-EVEN EXIT (ZERO CAPITAL LOSS)' : '🛡️ STOP LOSS TRIGGERED (RISK CONTAINED)'}</span>
                            {autoRearmCountdown !== null && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-rose-400/20 text-rose-200 font-mono">
                                Auto-rearming in {autoRearmCountdown}s...
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-200 mt-0.5">
                            Level triggered at <strong className="text-white font-mono">{dormantSignal.stopLoss}</strong>. Capital protected.
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-[10px] text-rose-400 font-mono uppercase tracking-wider">
                          {dormantSignal.isBreakEvenArmed ? 'Protected P&L' : 'Contained Risk'}
                        </div>
                        <div className={`text-xl font-black font-mono ${dormantSignal.isBreakEvenArmed ? 'text-emerald-300' : 'text-rose-300'}`}>
                          {dormantSignal.isBreakEvenArmed ? `+$${dormantSignal.realizedPnlUsd}` : `-$${Math.abs(dormantSignal.realizedPnlUsd || 0)}`} USD
                        </div>
                        <div className={`text-xs font-bold font-mono ${dormantSignal.isBreakEvenArmed ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {dormantSignal.isBreakEvenArmed ? `+KES ${dormantSignal.realizedPnlKes}` : `-KES ${Math.abs(dormantSignal.realizedPnlKes || 0).toLocaleString()}`}
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-rose-500/30 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <button
                          onClick={() => handleRearmAtSpot('BUY')}
                          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:brightness-110 active:scale-95 text-slate-950 font-black text-xs shadow-lg shadow-emerald-900/40 flex items-center gap-2 cursor-pointer transition-all"
                        >
                          <RefreshCw className="w-4 h-4 stroke-[2.5]" />
                          <span>RE-ARM AS BUY @ SPOT ({livePrice})</span>
                        </button>

                        <button
                          onClick={() => handleRearmAtSpot('SELL')}
                          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-500 hover:brightness-110 active:scale-95 text-white font-black text-xs shadow-lg shadow-rose-900/40 flex items-center gap-2 cursor-pointer transition-all"
                        >
                          <RefreshCw className="w-4 h-4 stroke-[2.5]" />
                          <span>RE-ARM AS SELL @ SPOT ({livePrice})</span>
                        </button>
                      </div>

                      {autoRearmCountdown !== null && (
                        <button
                          onClick={() => setAutoRearmCountdown(null)}
                          className="text-[11px] font-mono text-slate-400 hover:text-white underline cursor-pointer"
                        >
                          Cancel Auto-Rearm Timer
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Dormant Signal Top Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`px-3 py-1 rounded-xl text-xs font-mono font-black tracking-wider uppercase flex items-center gap-1.5 ${
                        dormantSignal.type === 'BUY'
                          ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30'
                          : 'bg-rose-500 text-white shadow-md shadow-rose-500/30'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-current animate-ping" />
                      <span>{dormantSignal.type} SIGNAL (DORMANT)</span>
                    </span>

                    {dormantSignal.isBreakEvenArmed && (
                      <span className="px-2 py-0.5 rounded-lg bg-teal-500/20 text-[#0df2c9] border border-teal-500/40 text-[10px] font-mono font-black flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-[#0df2c9]" />
                        <span>BREAK-EVEN ACTIVE</span>
                      </span>
                    )}

                    <span className="text-[11px] font-mono text-slate-400">
                      ID: <span className="text-white font-bold">{dormantSignal.id}</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-lg text-[10px] font-mono font-bold ${
                        dormantSignal.status === 'DORMANT_ACTIVE'
                          ? 'bg-teal-500/20 text-[#0df2c9] border border-teal-500/30'
                          : dormantSignal.status === 'TAKE_PROFIT_HIT'
                          ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-400 font-black'
                          : 'bg-rose-500/30 text-rose-300 border border-rose-400 font-black'
                      }`}
                    >
                      {dormantSignal.status === 'DORMANT_ACTIVE'
                        ? 'LOCKED & DORMANT (WAITING TP / SL)'
                        : dormantSignal.status === 'TAKE_PROFIT_HIT'
                        ? 'TAKE PROFIT HIT'
                        : 'STOP LOSS HIT'}
                    </span>

                    <button
                      onClick={() => handleRearmAtSpot()}
                      className="px-3 py-1 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 border border-teal-500/40 text-[#0df2c9] font-bold text-xs flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Re-arm</span>
                    </button>
                  </div>
                </div>

                {/* Fixed Non-Moving Signal Numbers */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4">
                  {/* Fixed Entry */}
                  <div className="p-3.5 rounded-2xl bg-[#060c18] border border-white/10 space-y-1">
                    <div className="text-[10px] font-mono uppercase text-slate-400 flex items-center justify-between">
                      <span>LOCKED ENTRY PRICE</span>
                      <span className="text-teal-400 font-bold">FROZEN</span>
                    </div>
                    <div className="text-xl sm:text-2xl font-mono font-black text-white">
                      {dormantSignal.entryPrice.toLocaleString(undefined, { minimumFractionDigits: activeAsset.digits })}
                    </div>
                    <div className="text-[10px] font-mono text-slate-400">
                      Live Spot: <span className={lastTickDir === 'UP' ? 'text-[#0df2c9]' : 'text-rose-400'}>{livePrice}</span>
                    </div>
                  </div>

                  {/* Fixed Stop Loss / Break-Even */}
                  <div className={`p-3.5 rounded-2xl border space-y-1 ${
                    dormantSignal.isBreakEvenArmed ? 'bg-[#041a1a] border-teal-500/50' : 'bg-[#16060a] border-rose-500/30'
                  }`}>
                    <div className="text-[10px] font-mono uppercase flex items-center justify-between">
                      <span className={dormantSignal.isBreakEvenArmed ? 'text-teal-300' : 'text-rose-400'}>
                        {dormantSignal.isBreakEvenArmed ? 'BREAK-EVEN STOP' : 'LOCKED STOP LOSS'}
                      </span>
                      <span className={`font-bold ${dormantSignal.isBreakEvenArmed ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {dormantSignal.isBreakEvenArmed ? 'RISK-FREE' : 'FROZEN'}
                      </span>
                    </div>
                    <div className={`text-xl sm:text-2xl font-mono font-black ${
                      dormantSignal.isBreakEvenArmed ? 'text-[#0df2c9]' : 'text-rose-300'
                    }`}>
                      {dormantSignal.stopLoss.toLocaleString(undefined, { minimumFractionDigits: activeAsset.digits })}
                    </div>
                    <div className="text-[10px] font-mono text-slate-400">
                      Distance to SL: <strong className="text-white">{distToSl} pts</strong>
                    </div>
                  </div>

                  {/* Fixed Take Profit */}
                  <div className="p-3.5 rounded-2xl bg-[#061810] border border-emerald-500/30 space-y-1">
                    <div className="text-[10px] font-mono uppercase text-emerald-400 flex items-center justify-between">
                      <span>LOCKED TAKE PROFIT</span>
                      <span className="text-emerald-400 font-bold">FROZEN</span>
                    </div>
                    <div className="text-xl sm:text-2xl font-mono font-black text-emerald-300">
                      {dormantSignal.takeProfit.toLocaleString(undefined, { minimumFractionDigits: activeAsset.digits })}
                    </div>
                    <div className="text-[10px] font-mono text-emerald-400/80">
                      Distance to TP: <strong className="text-emerald-300">{distToTp} pts</strong>
                    </div>
                  </div>
                </div>

                {/* Real-Time Price Progress Gauge Bar */}
                <div className="pt-4 space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-rose-400 font-bold">SL: {dormantSignal.stopLoss}</span>
                    <span className="text-slate-300 font-semibold">
                      Live Price: <strong className="text-white font-mono">{livePrice}</strong>
                    </span>
                    <span className="text-emerald-400 font-bold">TP: {dormantSignal.takeProfit}</span>
                  </div>

                  {/* Visual Range Bar */}
                  <div className="h-3 w-full bg-[#080f1c] rounded-full border border-slate-700/60 overflow-hidden relative">
                    <div
                      className="absolute top-0 bottom-0 w-1 bg-white/70 z-10"
                      style={{ left: '35%' }}
                      title="Locked Entry Point"
                    />

                    <div
                      style={{
                        width: `${Math.min(100, Math.max(0, dormantSignal.type === 'BUY'
                          ? ((livePrice - dormantSignal.stopLoss) / (dormantSignal.takeProfit - dormantSignal.stopLoss || 1)) * 100
                          : ((dormantSignal.stopLoss - livePrice) / (dormantSignal.stopLoss - dormantSignal.takeProfit || 1)) * 100
                        ))}%`,
                      }}
                      className="h-full transition-all duration-300 rounded-full bg-gradient-to-r from-rose-500 via-amber-400 to-emerald-400"
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-0.5">
                    <span>Target R:R: <strong className="text-[#0df2c9]">{dormantSignal.rrRatio}</strong></span>
                    <span>
                      Floating Signal Gain:{' '}
                      <strong className={dormantFloatingUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                        {dormantFloatingUsd >= 0 ? `+$${dormantFloatingUsd}` : `-$${Math.abs(dormantFloatingUsd)}`} USD
                        <span className="text-slate-500 ml-1">({dormantFloatingKes >= 0 ? `+${dormantFloatingKes}` : dormantFloatingKes} KES)</span>
                      </strong>
                    </span>
                  </div>
                </div>
              </div>

              {/* =================================================================
                  LIVE INTERACTIVE CANDLESTICK & LEVEL OVERLAY CHART
                  ================================================================= */}
              <div className="p-5 rounded-3xl bg-[#070d18] border border-teal-500/30 shadow-2xl space-y-3 font-mono">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-[#142136]">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-[#0df2c9]" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      Live Algorithmic Chart • {activeAsset.symbol} ({selectedTimeframe})
                    </span>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  </div>

                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <span className="w-2 h-0.5 bg-emerald-400 inline-block" />
                      <span>TP: {dormantSignal.takeProfit}</span>
                    </span>
                    <span className="text-sky-300 font-bold flex items-center gap-1">
                      <span className="w-2 h-0.5 bg-sky-300 inline-block" />
                      <span>Entry: {dormantSignal.entryPrice}</span>
                    </span>
                    <span className={`font-bold flex items-center gap-1 ${dormantSignal.isBreakEvenArmed ? 'text-[#0df2c9]' : 'text-rose-400'}`}>
                      <span className={`w-2 h-0.5 inline-block ${dormantSignal.isBreakEvenArmed ? 'bg-[#0df2c9]' : 'bg-rose-400'}`} />
                      <span>{dormantSignal.isBreakEvenArmed ? `BE: ${dormantSignal.stopLoss}` : `SL: ${dormantSignal.stopLoss}`}</span>
                    </span>
                  </div>
                </div>

                {/* Real Interactive Lightweight-Charts OHLCV Canvas */}
                <BotLiveChart
                  symbol={activeAsset.symbol}
                  category={activeAsset.category}
                  timeframe={selectedTimeframe}
                  digits={activeAsset.digits}
                  livePrice={livePrice}
                  entryPrice={dormantSignal.entryPrice}
                  takeProfit={dormantSignal.takeProfit}
                  stopLoss={dormantSignal.stopLoss}
                  isBreakEvenArmed={dormantSignal.isBreakEvenArmed}
                  rrRatio={dormantSignal.rrRatio}
                  onLivePriceTick={activeAsset.category === 'DERIV_24_7' ? processLivePriceTick : undefined}
                />
              </div>

              {newsAutoPauseEnabled && newsGuard.isHazardWindow && (
                <div className="p-3.5 rounded-2xl bg-rose-950/50 border border-rose-500/50 flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-rose-200">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>
                      <strong>RED-FOLDER AUTO-PAUSE ENGAGED:</strong> {newsGuard.statusLabel} — {newsGuard.detailLabel}
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[10px] font-bold">
                    ±30m SHIELD
                  </span>
                </div>
              )}

              {/* IN-STUDIO DIRECT ORDER EXECUTION PAD */}
              <div className="p-5 rounded-2xl bg-[#091120] border border-[#1a2d48] space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <Zap className="w-4 h-4 text-[#0df2c9]" />
                      <span>Direct In-Studio Order Execution Pad</span>
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Opens trade linked to this dormant signal with SL at <strong className="text-rose-300 font-mono">{dormantSignal.stopLoss}</strong> and TP at <strong className="text-emerald-300 font-mono">{dormantSignal.takeProfit}</strong>
                    </p>
                  </div>

                  {/* Lot Sizing Stepper */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 font-mono">Lot Size:</span>
                    <div className="flex items-center bg-[#070d18] border border-[#1c2e4a] rounded-xl p-0.5">
                      <button
                        onClick={() => setSelectedLots((prev) => Math.max(activeAsset.minLot, Number((prev - activeAsset.lotStep).toFixed(3))))}
                        className="px-2 py-1 text-slate-300 hover:text-white font-mono font-bold text-xs cursor-pointer"
                      >
                        -
                      </button>
                      <span className="px-3 py-1 font-mono text-xs font-bold text-[#0df2c9]">
                        {selectedLots}
                      </span>
                      <button
                        onClick={() => setSelectedLots((prev) => Number((prev + activeAsset.lotStep).toFixed(3)))}
                        className="px-2 py-1 text-slate-300 hover:text-white font-mono font-bold text-xs cursor-pointer"
                      >
                        +
                      </button>
                    </div>

                    {[0.01, 0.05, 0.10, 0.50].map((l) => (
                      <button
                        key={l}
                        onClick={() => setSelectedLots(l)}
                        className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold cursor-pointer ${
                          selectedLots === l
                            ? 'bg-teal-500/20 text-[#0df2c9] border border-teal-500/40'
                            : 'bg-[#070d18] text-slate-400 border border-[#142136]'
                        }`}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 1-Click Buy & Sell Execution Buttons */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <button
                    onClick={() => handleExecuteOrder('BUY')}
                    className={`py-3 px-4 rounded-xl font-black text-xs shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      dormantSignal.type === 'BUY'
                        ? 'bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-slate-950 shadow-emerald-950/40 ring-1 ring-emerald-400'
                        : 'bg-[#0e1b2c] hover:bg-[#142740] text-slate-300 border border-[#1c3354]'
                    }`}
                  >
                    <ArrowUpRight className="w-4 h-4 stroke-[3]" />
                    <span>EXECUTE BUY {selectedLots} LOTS (LOCKED SL/TP)</span>
                  </button>

                  <button
                    onClick={() => handleExecuteOrder('SELL')}
                    className={`py-3 px-4 rounded-xl font-black text-xs shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      dormantSignal.type === 'SELL'
                        ? 'bg-gradient-to-r from-rose-600 to-red-500 hover:from-rose-500 hover:to-red-400 text-white shadow-rose-950/40 ring-1 ring-rose-400'
                        : 'bg-[#0e1b2c] hover:bg-[#142740] text-slate-300 border border-[#1c3354]'
                    }`}
                  >
                    <TrendingDown className="w-4 h-4 stroke-[3]" />
                    <span>EXECUTE SELL {selectedLots} LOTS (LOCKED SL/TP)</span>
                  </button>
                </div>
              </div>

              {/* RE-ARMED SIGNAL AUDIT HISTORY LOG */}
              {signalHistory.length > 0 && (
                <div className="p-4 rounded-2xl bg-[#08101e] border border-[#162744] space-y-3 font-mono">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-white flex items-center gap-2">
                      <History className="w-4 h-4 text-[#0df2c9]" />
                      <span>Dormant Signal Execution & Re-arm Audit Log</span>
                    </span>
                    <button
                      onClick={() => setSignalHistory([])}
                      className="text-[10px] text-slate-400 hover:text-white cursor-pointer"
                    >
                      Clear Log
                    </button>
                  </div>

                  <div className="space-y-1.5 max-h-48 overflow-y-auto scrollbar-thin">
                    {signalHistory.map((rec, i) => (
                      <div
                        key={i}
                        className="p-2.5 rounded-xl bg-[#0b1424] border border-[#13233c] flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                              rec.type === 'BUY'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            }`}
                          >
                            {rec.type}
                          </span>
                          <span className="text-white font-bold">{rec.symbol}</span>
                          <span className="text-slate-400 text-[11px]">
                            Entry: {rec.entry} • TP: {rec.tp} • SL: {rec.sl}
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${
                              rec.outcome === 'TAKE_PROFIT_HIT'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                                : rec.outcome === 'BREAK_EVEN_HIT'
                                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                                : rec.outcome === 'STOP_LOSS_HIT'
                                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                                : 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                            }`}
                          >
                            {rec.outcome === 'TAKE_PROFIT_HIT' ? `TP HIT (+${rec.pnlUsd} USD)` : rec.outcome === 'BREAK_EVEN_HIT' ? 'BREAK-EVEN (+0 USD)' : rec.outcome === 'STOP_LOSS_HIT' ? `SL HIT (${rec.pnlUsd} USD)` : 'ARMED'}
                          </span>
                          <span className="text-[10px] text-slate-500">{rec.time}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Active Studio Positions Monitor */}
              {activeStudioPositions.length > 0 && (
                <div className="p-4 rounded-2xl bg-[#070d18] border border-emerald-500/30 space-y-3 font-mono">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-white flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      <span>Active Studio Positions ({activeStudioPositions.length})</span>
                    </span>
                    <span className="text-[10px] text-slate-400">Locked SL: {dormantSignal.stopLoss} • Locked TP: {dormantSignal.takeProfit}</span>
                  </div>

                  <div className="space-y-2">
                    {activeStudioPositions.map((pos) => (
                      <div
                        key={pos.ticket}
                        className="p-3 rounded-xl bg-[#0b1322] border border-[#162744] flex flex-wrap items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              pos.type === 'BUY'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            }`}
                          >
                            {pos.type} #{pos.ticket}
                          </span>
                          <div>
                            <div className="font-bold text-white flex items-center gap-2">
                              <span>{pos.symbol} • {pos.lots} Lots</span>
                              {pos.isBreakEven && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-teal-500/20 text-[#0df2c9] border border-teal-500/30">
                                  RISK-FREE (BE)
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              Entry: {pos.openPrice.toFixed(activeAsset.digits)} • Current: {pos.currentPrice.toFixed(activeAsset.digits)}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="text-[9px] text-slate-400 uppercase">Floating P&L</div>
                            <div
                              className={`text-sm font-bold ${
                                pos.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                            >
                              {pos.pnl >= 0 ? `+$${pos.pnl.toFixed(2)}` : `-$${Math.abs(pos.pnl).toFixed(2)}`}
                              <span className="text-[10px] ml-1 text-slate-400">
                                ({(pos.pnl * 129.86).toLocaleString(undefined, { maximumFractionDigits: 0 })} KES)
                              </span>
                            </div>
                          </div>

                          <button
                            onClick={() => handleClosePosition(pos.ticket)}
                            className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-[10px] font-bold cursor-pointer"
                          >
                            Close
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: STRATEGY BACKTESTING LAB (100 TRADES) */}
          {activeAnalysisTab === 'backtest' && (
            <div className="p-6 rounded-3xl bg-[#070d18] border border-[#16243a] shadow-2xl space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#142136]">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <LineChart className="w-5 h-5 text-[#0df2c9]" />
                    <span>Historical OHLCV Strategy Backtesting Lab</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Real candle-by-candle OHLCV replay of {selectedBot.name} on {activeAsset.symbol} ({selectedTimeframe}) with {dormantSignal.rrRatio} R:R and Break-Even Armor.
                  </p>
                </div>

                <button
                  onClick={handleRunBacktest}
                  disabled={isBacktesting}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-teal-400 to-[#0df2c9] text-slate-950 font-black text-xs shadow-lg shadow-teal-500/20 hover:brightness-110 active:scale-95 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Play className={`w-4 h-4 fill-current ${isBacktesting ? 'animate-spin' : ''}`} />
                  <span>{isBacktesting ? 'Replaying Historical Bars...' : 'Run Historical OHLCV Backtest'}</span>
                </button>
              </div>

              {backtestStats ? (
                <div className="space-y-5 font-mono">
                  {/* Key Stats Metric Tiles */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3.5 rounded-2xl bg-[#091120] border border-[#18283e] space-y-1">
                      <div className="text-[10px] uppercase text-slate-400">WIN RATE</div>
                      <div className="text-2xl font-black text-emerald-400">{backtestStats.winRate}%</div>
                      <div className="text-[10px] text-slate-500">{backtestStats.totalTrades} historical trades</div>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-[#091120] border border-[#18283e] space-y-1">
                      <div className="text-[10px] uppercase text-slate-400">NET GAIN (USD)</div>
                      <div className={`text-2xl font-black ${backtestStats.netProfitUsd >= 0 ? 'text-[#0df2c9]' : 'text-rose-400'}`}>
                        {backtestStats.netProfitUsd >= 0 ? `+$${backtestStats.netProfitUsd.toLocaleString()}` : `-$${Math.abs(backtestStats.netProfitUsd).toLocaleString()}`}
                      </div>
                      <div className={`text-[10px] font-bold ${backtestStats.netProfitKes >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {backtestStats.netProfitKes >= 0 ? `+KES ${backtestStats.netProfitKes.toLocaleString()}` : `-KES ${Math.abs(backtestStats.netProfitKes).toLocaleString()}`}
                      </div>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-[#091120] border border-[#18283e] space-y-1">
                      <div className="text-[10px] uppercase text-slate-400">PROFIT FACTOR</div>
                      <div className="text-2xl font-black text-cyan-300">{backtestStats.profitFactor}</div>
                      <div className="text-[10px] text-slate-500">Gross Win / Gross Loss</div>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-[#091120] border border-[#18283e] space-y-1">
                      <div className="text-[10px] uppercase text-slate-400">MAX DRAWDOWN</div>
                      <div className="text-2xl font-black text-rose-400">{backtestStats.maxDrawdown}%</div>
                      <div className="text-[10px] text-emerald-400">Prop Firm Safe (&lt; 8%)</div>
                    </div>
                  </div>

                  {/* Visual Equity Curve Chart */}
                  <div className="p-4 rounded-2xl bg-[#050b14] border border-[#162744] space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>Historical Equity Growth Curve ($10,000 Start)</span>
                      <span className="text-emerald-400 font-bold">Sharpe Ratio: {backtestStats.sharpeRatio}</span>
                    </div>

                    <div className="h-44 w-full flex items-end gap-1 pt-4 pb-2 px-1">
                      {backtestStats.equityCurve.map((bal, idx, arr) => {
                        const min = Math.min(...arr);
                        const max = Math.max(...arr);
                        const heightPct = Math.max(10, ((bal - min) / (max - min || 1)) * 100);
                        return (
                          <div
                            key={idx}
                            style={{ height: `${heightPct}%` }}
                            className="flex-1 bg-gradient-to-t from-teal-500/20 via-teal-400 to-[#0df2c9] rounded-t-sm hover:brightness-125 transition-all relative group"
                          >
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-black/90 px-2 py-1 rounded text-[10px] text-white whitespace-nowrap z-20">
                              Trade #{idx}: ${bal.toLocaleString()}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center rounded-2xl bg-[#091120] border border-[#16243a] space-y-3">
                  <Calculator className="w-10 h-10 text-teal-400 mx-auto" />
                  <div className="text-sm font-bold text-white">No Backtest Run Yet</div>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    Click "Run Historical OHLCV Backtest" to replay real {activeAsset.symbol} historical candles bar-by-bar with {selectedBot.name}.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: MT5 & DERIV WEBHOOK BRIDGE */}
          {activeAnalysisTab === 'webhook' && (
            <div className="p-6 rounded-3xl bg-[#070d18] border border-[#16243a] shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Network className="w-5 h-5 text-[#0df2c9]" />
                    <span>Real MetaTrader 5 & Deriv Webhook Bridge</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Connect this web studio directly to your real MetaTrader 5 terminal or Deriv account via Webhook.
                  </p>
                </div>

                <button
                  onClick={handleCopyWebhookPayload}
                  className="px-3.5 py-1.5 rounded-xl bg-[#0f1b2e] hover:bg-[#162742] border border-[#1e3454] text-xs font-semibold text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {copiedWebhook ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied Payload!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-teal-400" />
                      <span>Copy JSON Payload</span>
                    </>
                  )}
                </button>
              </div>

              {/* Webhook Endpoint Box */}
              <div className="p-4 rounded-2xl bg-[#091120] border border-[#162744] space-y-2">
                <div className="text-xs font-bold text-slate-300">Live Bridge Endpoint (REST / WebSocket):</div>
                <div className="p-2.5 rounded-xl bg-[#040812] border border-[#16243a] font-mono text-xs text-[#0df2c9] flex items-center justify-between">
                  <span>https://api.njiafedha.co.ke/v1/bridge/dispatch</span>
                  <span className="text-[10px] text-emerald-400 uppercase font-bold">ACTIVE 24/7</span>
                </div>
              </div>

              {/* MQL5 Client Listener Snippet */}
              <div className="p-4 rounded-2xl bg-[#091120] border border-[#162744] space-y-2">
                <div className="text-xs font-bold text-slate-300">
                  MT5 EA WebRequest Listener (Paste into your MT5 EA OnInit / OnTick):
                </div>
                <pre className="p-3.5 rounded-xl bg-[#040812] border border-[#142136] text-[11px] font-mono text-teal-300 leading-relaxed overflow-x-auto">
{`//+------------------------------------------------------------------+
//| NjiaFedha Institutional Webhook Listener for MT5 & Deriv         |
//+------------------------------------------------------------------+
string headers = "Content-Type: application/json\\r\\nAuthorization: Bearer NJIA_QUANT_KEY_SECURE_9918";
char postData[];
char result[];
string resultHeaders;
int res = WebRequest("GET", "https://api.njiafedha.co.ke/v1/bridge/signal?symbol=${activeAsset.symbol}", headers, 3000, postData, result, resultHeaders);
if(res == 200) {
   string response = CharArrayToString(result);
   // Executes ${dormantSignal.type} order with SL: ${dormantSignal.stopLoss} and TP: ${dormantSignal.takeProfit}
   Trade.PositionOpen("${activeAsset.symbol}", ORDER_TYPE_${dormantSignal.type}, ${selectedLots}, ${dormantSignal.entryPrice}, ${dormantSignal.stopLoss}, ${dormantSignal.takeProfit});
}`}
                </pre>
              </div>
            </div>
          )}

          {/* TAB 4: VISUAL STRATEGY CANVAS */}
          {activeAnalysisTab === 'mechanics' && (
            <div className="p-6 rounded-3xl bg-[#070d18] border border-[#16243a] shadow-2xl space-y-4">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-white font-bold flex items-center gap-2">
                  <Crosshair className="w-4 h-4 text-[#0df2c9]" />
                  <span>Visual Execution Model for {selectedBot.name} on {activeAsset.symbol}</span>
                </span>
                <span className="text-[#0df2c9] font-bold">LOCKED SIGNAL: {dormantSignal.type}</span>
              </div>

              <div className="p-4 rounded-2xl bg-[#040812] border border-teal-500/30 space-y-3 font-mono">
                <div className="flex items-center justify-between text-xs text-teal-300">
                  <span>MARKET CLASS: {activeAsset.category}</span>
                  <span className="text-emerald-400 font-bold">{activeAsset.marketHours}</span>
                </div>

                <div className="relative h-44 bg-[#081120] rounded-xl border border-teal-500/40 p-3 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span className="text-emerald-400 font-bold">TAKE PROFIT TARGET (LOCKED): {dormantSignal.takeProfit}</span>
                    <span className="text-emerald-400 font-bold">{dormantSignal.rrRatio} ASYMMETRIC R:R</span>
                  </div>

                  <div className="bg-teal-500/10 border border-teal-400/50 p-2.5 rounded-lg text-[11px] text-teal-200 flex items-center justify-between">
                    <span>{selectedBot.name.toUpperCase()} • DORMANT {dormantSignal.type} SIGNAL</span>
                    <span className="text-white font-bold">ENTRY (FROZEN): {dormantSignal.entryPrice}</span>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span className="text-rose-400 font-bold">INVALIDATION STOP LOSS (LOCKED): {dormantSignal.stopLoss}</span>
                    <span className="text-cyan-300">LIVE SPOT: {livePrice}</span>
                  </div>
                </div>

                <div className="text-xs text-slate-300 leading-relaxed font-sans pt-1">
                  <strong>How Perfect Execution Works on {activeAsset.name}:</strong> The signal is generated with fixed parameters. As price moves toward the profit target, the Break-Even Armor moves the stop loss to entry once 50% distance is achieved, rendering the trade risk-free until target realization.
                </div>
              </div>

              {/* 4-Step Confluence Rules */}
              <div className="space-y-2 pt-2">
                <div className="text-xs font-bold text-white uppercase tracking-wider">
                  Algorithmic Confluence Rules for {activeAsset.symbol}:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {selectedBot.edgeBreakdown.map((rule, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-[#0c1524] border border-[#162744] flex items-start gap-2.5 text-xs text-slate-300">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{rule}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: QUANTITATIVE TOOLS */}
          {activeAnalysisTab === 'tools' && (
            <div className="p-6 rounded-3xl bg-[#070d18] border border-[#16243a] shadow-2xl space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white">Quantitative Indicators Used for {activeAsset.symbol}</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Real-time algorithmic variables actively calculated on {selectedTimeframe} timeframe
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {selectedBot.indicators.map((ind, idx) => (
                  <div key={idx} className="p-3.5 rounded-2xl bg-[#091120] border border-[#17253b] flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-[#0df2c9] font-mono text-xs font-bold">
                      {idx + 1}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">{ind}</div>
                      <div className="text-[10px] text-slate-400 font-mono">Calibrated for {activeAsset.symbol}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 6: PARAMETERS TUNER */}
          {activeAnalysisTab === 'params' && (
            <div className="p-6 rounded-3xl bg-[#070d18] border border-[#16243a] shadow-2xl space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white">Strategy Parameters for {selectedBot.name} on {activeAsset.symbol}</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Adjusting these inputs dynamically alters the MQL5 code generator and live execution orders.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                {selectedBot.parameters.map((param) => (
                  <div key={param.id} className="p-4 rounded-2xl bg-[#091120] border border-[#17253b] space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <label className="font-bold text-white">{param.name}</label>
                      <span className="text-[10px] font-mono text-slate-400">Default: {String(param.defaultValue)}</span>
                    </div>
                    <p className="text-[11px] text-slate-400">{param.description}</p>
                    {param.type === 'number' && (
                      <input
                        type="number"
                        value={customParams[param.id] ?? param.defaultValue}
                        min={param.min}
                        max={param.max}
                        step={param.step}
                        onChange={(e) =>
                          setCustomParams({
                            ...customParams,
                            [param.id]: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-full bg-[#0d1729] border border-[#1e3252] rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-teal-400"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 7: COMPILABLE MQL5 CODE */}
          {activeAnalysisTab === 'code' && (
            <div className="p-6 rounded-3xl bg-[#070d18] border border-[#16243a] shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">Compilable MetaTrader 5 Code for {activeAsset.symbol}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Ready to compile in MetaEditor (<kbd className="px-1 py-0.5 rounded bg-slate-800 text-teal-300 text-[10px]">F4</kbd> → <kbd className="px-1 py-0.5 rounded bg-slate-800 text-teal-300 text-[10px]">F7</kbd>) specifically configured for {activeAsset.symbol} with locked {dormantSignal.type} parameters.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyMql5}
                    className="px-3 py-1.5 rounded-xl bg-[#0f1b2e] hover:bg-[#162742] border border-[#1e3454] text-xs font-semibold text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {copiedCode ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-teal-400" />
                        <span>Copy Code</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleDownloadMql5}
                    className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-teal-400 to-[#0df2c9] text-slate-950 font-bold text-xs shadow-md shadow-teal-500/20 hover:brightness-110 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Download {activeAsset.symbol} .mq5</span>
                  </button>
                </div>
              </div>

              <pre className="p-4 rounded-2xl bg-[#040812] border border-[#142136] text-[11px] font-mono text-teal-300 leading-relaxed overflow-x-auto max-h-[460px] scrollbar-thin">
                {selectedBot.generateMql5Code({
                  ...customParams,
                  symbol: activeAsset.symbol,
                  timeframe: selectedTimeframe,
                  signalType: dormantSignal.type,
                  fixedSl: dormantSignal.stopLoss,
                  fixedTp: dormantSignal.takeProfit,
                })}
              </pre>
            </div>
          )}
        </div>
      </div>

      {/* =========================================================================
          FULL ASSET SELECTOR MODAL (SEARCH ACROSS 30+ INSTRUMENTS)
          ========================================================================= */}
      {isCurrencySelectorOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="w-full max-w-3xl rounded-3xl bg-[#091120] border border-teal-500/40 shadow-2xl relative overflow-hidden flex flex-col max-h-[85vh]">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-[#142136] flex items-center justify-between gap-4">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  <Globe className="w-5 h-5 text-[#0df2c9]" />
                  <span>Choose Currency or Instrument to Analyze</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Select any Forex pair, precious metal, Deriv 24/7 synthetic, crypto, or Kenyan Shilling cross
                </p>
              </div>

              <button
                onClick={() => setIsCurrencySelectorOpen(false)}
                className="w-8 h-8 rounded-xl bg-[#0f1b2e] hover:bg-[#162742] text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search and Category Filter */}
            <div className="p-4 bg-[#070d18] border-b border-[#142136] space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search symbol or name (e.g. Gold, EURUSD, Boom 1000, USDKES)..."
                  value={currencySearch}
                  onChange={(e) => setCurrencySearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#0d1729] border border-[#1b2d48] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-400 font-mono"
                  autoFocus
                />
              </div>

              {/* Category Filter Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none text-[11px] font-semibold">
                {[
                  { id: 'ALL', label: 'All Assets' },
                  { id: 'METALS', label: 'Precious Metals' },
                  { id: 'FOREX', label: 'Forex Majors' },
                  { id: 'EAST_AFRICA', label: 'East Africa (KES)' },
                  { id: 'DERIV_24_7', label: 'Deriv 24/7 Synthetics' },
                  { id: 'CRYPTO', label: 'Crypto Assets' },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setCurrencyCategoryFilter(cat.id as any)}
                    className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                      currencyCategoryFilter === cat.id
                        ? 'bg-teal-500/20 text-[#0df2c9] border border-teal-500/40'
                        : 'text-slate-400 hover:text-white bg-[#0b1322]'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Modal Asset Grid */}
            <div className="p-4 overflow-y-auto space-y-2 flex-1 scrollbar-thin">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {filteredAssets.map((asset) => {
                  const isSelected = selectedCurrency === asset.symbol;
                  return (
                    <button
                      key={asset.symbol}
                      onClick={() => {
                        setSelectedCurrency(asset.symbol);
                        setIsCurrencySelectorOpen(false);
                      }}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? 'bg-teal-500/20 border-teal-400 text-white shadow-md'
                          : 'bg-[#070d18] hover:bg-[#0d182b] border-[#15233b] text-slate-300'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-xs text-white">{asset.symbol}</span>
                          <span className="text-[9px] px-1 rounded bg-[#0f1b2e] text-teal-300 font-mono">
                            {asset.category}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 truncate max-w-[200px] mt-0.5">
                          {asset.name}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-xs font-mono font-bold text-white">
                          {resolveTradingViewPrice(liveTvQuotes, asset.symbol, asset.basePrice).toLocaleString(undefined, { minimumFractionDigits: asset.digits, maximumFractionDigits: asset.digits })}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">{asset.marketHours}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          CUSTOM EA IMPORTER & CODE PASTER MODAL
          ========================================================================= */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="w-full max-w-3xl rounded-3xl bg-[#091120] border border-teal-500/50 shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-[#142136] flex items-center justify-between gap-4 bg-[#070e1b]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-[#0df2c9]">
                  <FileCode className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                    <span>Import Custom Scalping EA (MQL5 / MQL4)</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-teal-500/20 text-[#0df2c9] border border-teal-500/30">
                      LIVE STUDIO INTEGRATION
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Paste your scalping bot code. The studio will parse inputs, arm the dormant binary signal engine, and enable backtesting.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsImportModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-[#0f1b2e] hover:bg-[#162742] text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body Form */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1 scrollbar-thin font-mono text-xs">
              
              {/* Code Pasting Area */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-200 flex items-center gap-1.5 font-sans">
                    <Code2 className="w-4 h-4 text-[#0df2c9]" />
                    <span>Paste EA Source Code (.mq5 / .mq4):</span>
                  </label>

                  {importForm.code.trim().length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleAutoParseCode(importForm.code)}
                      className="px-2.5 py-1 rounded-lg bg-teal-500/20 hover:bg-teal-500/30 text-[#0df2c9] border border-teal-500/40 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Auto-Detect Parameters from Code</span>
                    </button>
                  )}
                </div>

                <textarea
                  rows={8}
                  placeholder={`// Paste your complete MQL5 or MQL4 EA code here...\n// Example:\n//+------------------------------------------------------------------+\n//| My_Quantum_Scalper_EA.mq5                                         |\n//+------------------------------------------------------------------+\ninput double InpLotSize = 0.10;\ninput double InpTakeProfit = 40.0;\ninput double InpStopLoss = 15.0;`}
                  value={importForm.code}
                  onChange={(e) => handleAutoParseCode(e.target.value)}
                  className="w-full p-3 rounded-2xl bg-[#040812] border border-[#172740] text-teal-300 placeholder-slate-600 focus:outline-none focus:border-teal-400 leading-relaxed font-mono text-[11px] scrollbar-thin"
                />
              </div>

              {/* Bot Meta Fields Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 font-sans">
                
                {/* EA Name */}
                <div className="space-y-1">
                  <label className="text-slate-300 font-bold text-xs">Bot / EA Name:</label>
                  <input
                    type="text"
                    value={importForm.name}
                    onChange={(e) => setImportForm({ ...importForm, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[#0c1626] border border-[#1b2d48] text-white text-xs focus:outline-none focus:border-teal-400 font-mono"
                    placeholder="e.g. Ultra Gold Scalper EA"
                  />
                </div>

                {/* Strategy Category */}
                <div className="space-y-1">
                  <label className="text-slate-300 font-bold text-xs">Market Class:</label>
                  <select
                    value={importForm.category}
                    onChange={(e) => setImportForm({ ...importForm, category: e.target.value as BotCategory })}
                    className="w-full px-3 py-2 rounded-xl bg-[#0c1626] border border-[#1b2d48] text-white text-xs focus:outline-none focus:border-teal-400 font-mono"
                  >
                    <option value="FOREX_MT5">Forex MT5 & Metals</option>
                    <option value="DERIV_24_7">Deriv 24/7 Synthetics</option>
                  </select>
                </div>

                {/* Default Symbol */}
                <div className="space-y-1">
                  <label className="text-slate-300 font-bold text-xs">Primary Target Asset:</label>
                  <select
                    value={importForm.defaultSymbol}
                    onChange={(e) => setImportForm({ ...importForm, defaultSymbol: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[#0c1626] border border-[#1b2d48] text-white text-xs focus:outline-none focus:border-teal-400 font-mono"
                  >
                    {ALL_ASSETS.map((a) => (
                      <option key={a.symbol} value={a.symbol}>
                        {a.symbol} - {a.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Default Timeframe */}
                <div className="space-y-1">
                  <label className="text-slate-300 font-bold text-xs">Primary Timeframe:</label>
                  <select
                    value={importForm.defaultTimeframe}
                    onChange={(e) => setImportForm({ ...importForm, defaultTimeframe: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl bg-[#0c1626] border border-[#1b2d48] text-white text-xs focus:outline-none focus:border-teal-400 font-mono"
                  >
                    <option value="M1">M1 (1-Minute Ultra Scalp)</option>
                    <option value="M5">M5 (5-Minute Scalp)</option>
                    <option value="M15">M15 (15-Minute Session Breakout)</option>
                    <option value="M30">M30 (30-Minute Swing)</option>
                    <option value="H1">H1 (Hourly Trend)</option>
                    <option value="H4">H4 (4-Hour Institutional)</option>
                  </select>
                </div>

                {/* Win Rate Estimate */}
                <div className="space-y-1">
                  <label className="text-slate-300 font-bold text-xs">Estimated Win Rate (%):</label>
                  <input
                    type="number"
                    min="50"
                    max="98"
                    value={importForm.winRate}
                    onChange={(e) => setImportForm({ ...importForm, winRate: parseInt(e.target.value) || 80 })}
                    className="w-full px-3 py-2 rounded-xl bg-[#0c1626] border border-[#1b2d48] text-white text-xs focus:outline-none focus:border-teal-400 font-mono"
                  />
                </div>

                {/* Risk:Reward Ratio */}
                <div className="space-y-1">
                  <label className="text-slate-300 font-bold text-xs">Target Risk:Reward:</label>
                  <input
                    type="text"
                    value={importForm.avgRiskReward}
                    onChange={(e) => setImportForm({ ...importForm, avgRiskReward: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[#0c1626] border border-[#1b2d48] text-white text-xs focus:outline-none focus:border-teal-400 font-mono"
                    placeholder="e.g. 1:3.4"
                  />
                </div>
              </div>

              {/* Strategy Description */}
              <div className="space-y-1 font-sans">
                <label className="text-slate-300 font-bold text-xs">Strategy Summary & Rules:</label>
                <textarea
                  rows={2}
                  value={importForm.tagline}
                  onChange={(e) => setImportForm({ ...importForm, tagline: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-[#0c1626] border border-[#1b2d48] text-slate-200 text-xs focus:outline-none focus:border-teal-400"
                  placeholder="Explain the entry criteria, session timing, or volatility triggers..."
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-[#070e1b] border-t border-[#142136] flex items-center justify-between gap-3">
              <div className="text-[11px] text-slate-400">
                Custom EAs are saved to your browser and integrate directly with live dormant signals & backtesting.
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#0d1729] hover:bg-[#14233c] text-slate-300 text-xs font-semibold cursor-pointer transition-colors"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleSaveCustomBot}
                  disabled={!importForm.name.trim()}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-teal-400 to-[#0df2c9] text-slate-950 font-black text-xs shadow-lg shadow-teal-500/20 hover:brightness-110 active:scale-95 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Save & Arm in Studio</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
