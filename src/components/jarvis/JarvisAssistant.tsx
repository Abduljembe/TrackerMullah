import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  X,
  Minimize2,
  Zap,
  ShieldAlert,
  TrendingUp,
  Terminal,
  Square,
  AlertTriangle,
  Radio,
  RotateCcw,
  Bell,
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext.tsx';
import { CurrencyCode, ExpenseItem, IncomeItem, TabType } from '../../types/finance.ts';
import { useTradingViewQuotes, lookupTradingViewQuote, resolveTradingViewPrice } from '../../utils/tradingViewSync.ts';
import { loadOpenPaperPositions, evaluatePortfolioExposure } from '../../utils/portfolioGuard.ts';
import { loadTrackedSignals, dispatchSignalWebhook } from '../../utils/signalScorecard.ts';
import { getAssetMarketSession } from '../../utils/marketHours.ts';
import { computeTimeframeSignalLevels } from '../../utils/signalEngine.ts';
import { evaluatePropTradeBlock, loadPropConfig } from '../../utils/propGuardian.ts';
import {
  executePaperMarketOrder,
  closePaperPositionsByQuery,
  MULLAH_PROACTIVE_ALERT_EVENT,
} from '../../utils/paperTradeManager.ts';

type JarvisState = 'idle' | 'listening' | 'thinking' | 'speaking';

interface JarvisAction {
  type:
    | 'navigate'
    | 'focusAsset'
    | 'logTransaction'
    | 'setCurrency'
    | 'broadcastSignal'
    | 'executePaperTrade'
    | 'closePaperPositions'
    | 'setPriceAlert'
    | 'controlBot';
  payload: Record<string, unknown>;
}

interface JarvisMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  actionsExecuted?: string[];
  isError?: boolean;
}

const VALID_TABS = new Set<TabType>([
  'dashboard',
  'insights',
  'income',
  'expenses',
  'budget',
  'wallets',
  'bills',
  'savings',
  'emergency',
  'investments',
  'stocks',
  'orderflow',
  'livetv',
  'sacco-mmf',
  'debt',
  'calculator',
  'reports',
  'mpesa',
  'tax',
  'chama',
  'cashflow',
  'milestones',
  'mt5-ea',
  'forex-suite',
  'bot-studio',
  'gold-scalper',
]);

const EXPENSE_CATEGORIES = new Set<ExpenseItem['category']>([
  'Rent & Housing',
  'Food & Groceries',
  'Transport & Fuel',
  'Utilities & Bills',
  'Entertainment & Dining',
  'Healthcare',
  'Education',
  'Family & Support',
  'Shopping',
  'Other',
]);

const INCOME_CATEGORIES = new Set<IncomeItem['category']>([
  'Salary',
  'Business',
  'Freelance',
  'Side Hustle',
  'Dividends',
  'Rental',
  'Other',
]);

// Safe JSON parser preventing "Unexpected token '<', <!doctype..." errors when HTML is returned transiently
async function parseJsonSafely<T = Record<string, unknown>>(res: Response): Promise<T> {
  const raw = await res.text();
  const trimmed = raw.trim();
  const contentType = (res.headers.get('content-type') || '').toLowerCase();
  if (!trimmed || trimmed.startsWith('<') || contentType.includes('text/html')) {
    throw new Error('Server connection reset momentarily while restarting. Please tap to retry.');
  }
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    throw new Error('Received an unexpected non-JSON server response. Please try again.');
  }
}

async function fetchJsonWithRetry<T = Record<string, unknown>>(
  url: string,
  init: RequestInit
): Promise<{ res: Response; data: T }> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 24000);
      const res = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timer);
      const data = await parseJsonSafely<T>(res);
      if (attempt === 0 && (res.status === 502 || res.status === 503 || res.status === 504)) {
        await new Promise((r) => setTimeout(r, 850));
        continue;
      }
      return { res, data };
    } catch (err) {
      lastErr = err;
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 850));
        continue;
      }
    }
  }
  if (lastErr instanceof Error && lastErr.name === 'AbortError') {
    throw new Error('Voice request timed out waiting for market telemetry. Please try again.');
  }
  throw lastErr instanceof Error ? lastErr : new Error('Voice link temporarily unavailable.');
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToInt16Array(base64: string): Int16Array {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Int16Array(bytes.buffer);
}

function buildWelcomeGreeting(): string {
  const hour = new Date().getHours();
  const timeOfDay = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const fxOpen = getAssetMarketSession('EUR/USD', 'FOREX').isOpen;
  const openCount = loadOpenPaperPositions().length;
  const propGuard = evaluatePropTradeBlock();
  const marketNote = fxOpen
    ? 'Global markets are live.'
    : 'Traditional Forex markets are closed for the weekend, while crypto and synthetics remain active.';
  const posNote = openCount > 0 ? `You have ${openCount} open position${openCount > 1 ? 's' : ''} monitored.` : '';
  const propNote = propGuard.blocked ? 'Warning: Prop Firm Risk Guardian lockout is currently active.' : '';
  return `${timeOfDay}. Mullah is online. ${marketNote} ${posNote} ${propNote} Tell me what you want to do — scan Gold 15M, place a paper trade, control your bots, or review your finances.`
    .replace(/\s+/g, ' ')
    .trim();
}

// Large Interactive Concentric Holographic Arc-Reactor Core
const ArcReactorCore: React.FC<{ state: JarvisState; size?: number }> = ({ state, size = 122 }) => {
  const isListening = state === 'listening';
  const isThinking = state === 'thinking';
  const isSpeaking = state === 'speaking';

  const coreColor = isListening ? '#10b981' : isSpeaking ? '#f59e0b' : '#0df2c9';

  return (
    <div
      className="relative flex items-center justify-center shrink-0 select-none"
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 120 120" className="w-full h-full overflow-visible" aria-hidden="true">
        <defs>
          <radialGradient id="jarvisAudioGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="40%" stopColor={coreColor} stopOpacity="0.85" />
            <stop offset="100%" stopColor={coreColor} stopOpacity="0" />
          </radialGradient>
        </defs>

        <circle
          cx="60"
          cy="60"
          r="56"
          fill="none"
          stroke={coreColor}
          strokeOpacity={isListening || isSpeaking ? 0.45 : 0.18}
          strokeWidth="1.5"
          className={isListening || isSpeaking ? 'animate-ping' : ''}
          style={{ animationDuration: '2.4s' }}
        />

        <circle
          cx="60"
          cy="60"
          r="50"
          fill="none"
          stroke={coreColor}
          strokeOpacity={isThinking || isListening ? 0.9 : 0.5}
          strokeWidth="2.5"
          strokeDasharray="16 8 6 8"
          className={isThinking || isListening ? 'origin-center animate-spin' : ''}
          style={{ animationDuration: isThinking ? '1.8s' : '8s' }}
        />

        <circle
          cx="60"
          cy="60"
          r="38"
          fill="none"
          stroke={coreColor}
          strokeOpacity={0.7}
          strokeWidth="2"
          strokeDasharray="24 10"
          className="origin-center animate-spin"
          style={{
            animationDuration: isThinking ? '2.4s' : isSpeaking ? '3.5s' : '14s',
            animationDirection: 'reverse',
          }}
        />

        <circle
          cx="60"
          cy="60"
          r="27"
          fill="#05101d"
          stroke={coreColor}
          strokeOpacity={0.8}
          strokeWidth="1.5"
        />

        <circle
          cx="60"
          cy="60"
          r={isListening || isSpeaking ? '23' : '19'}
          fill="url(#jarvisAudioGlow)"
          className={isListening || isSpeaking ? 'animate-pulse' : ''}
        />
      </svg>

      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {isListening ? (
          <Mic className="w-7 h-7 text-emerald-100 drop-shadow-[0_0_8px_rgba(16,185,129,0.9)]" />
        ) : isSpeaking ? (
          <Volume2 className="w-7 h-7 text-amber-100 drop-shadow-[0_0_8px_rgba(245,158,11,0.9)]" />
        ) : isThinking ? (
          <Radio className="w-7 h-7 text-cyan-100 animate-pulse" />
        ) : (
          <Mic className="w-7 h-7 text-[#0df2c9] drop-shadow-[0_0_8px_rgba(13,242,201,0.8)]" />
        )}
      </div>
    </div>
  );
};

const VoiceWaveformBars: React.FC<{ active: boolean; colorClass: string }> = ({ active, colorClass }) => {
  const heights = [35, 65, 95, 55, 100, 75, 45, 90, 60, 80, 40];
  return (
    <div className="flex items-center justify-center gap-1 h-6" aria-hidden="true">
      {heights.map((h, i) => (
        <span
          key={i}
          className={`w-1 rounded-full transition-all duration-200 ${colorClass} ${
            active ? 'animate-pulse' : 'opacity-30'
          }`}
          style={{
            height: active ? `${h}%` : '22%',
            animationDelay: `${i * 90}ms`,
            animationDuration: '650ms',
          }}
        />
      ))}
    </div>
  );
};

export const JarvisAssistant: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    currency,
    setCurrency,
    netWorth,
    totalMonthlyIncome,
    totalMonthlyExpenses,
    savingsRate,
    totalLiquidBalance,
    totalInvestments,
    totalEmergencyFund,
    totalDebt,
    financialHealth,
    addExpense,
    addIncome,
  } = useFinance();

  const liveTvQuotes = useTradingViewQuotes(5000);
  const liveTvQuotesRef = useRef(liveTvQuotes);
  liveTvQuotesRef.current = liveTvQuotes;

  // Auto-open Mullah when website first loads
  const [isOpen, setIsOpen] = useState(true);
  const [jarvisState, setJarvisState] = useState<JarvisState>('idle');
  const [handsFreeLoop, setHandsFreeLoop] = useState<boolean>(true);
  const [liveStreamMode, setLiveStreamMode] = useState<boolean>(false);
  const [wakeWordEnabled, setWakeWordEnabled] = useState<boolean>(false);
  const [proactiveAlertsEnabled, setProactiveAlertsEnabled] = useState<boolean>(true);
  const [autoplayBlocked, setAutoplayBlocked] = useState<boolean>(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const initialGreetingRef = useRef<string>(buildWelcomeGreeting());
  const [messages, setMessages] = useState<JarvisMessage[]>([
    {
      id: 'jarvis-boot',
      role: 'assistant',
      text: initialGreetingRef.current,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const pendingWelcomeAudioRef = useRef<{ base64: string; mimeType: string } | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const speechRecognitionRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wakeRecognitionRef = useRef<any>(null);

  // Live API WebSocket refs (16kHz input -> 24kHz scheduled PCM playback)
  const liveWsRef = useRef<WebSocket | null>(null);
  const liveInputCtxRef = useRef<AudioContext | null>(null);
  const liveProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const liveStreamRef = useRef<MediaStream | null>(null);
  const liveOutputCtxRef = useRef<AudioContext | null>(null);
  const liveNextStartTimeRef = useRef<number>(0);
  const liveActiveSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const startListeningRef = useRef<() => void>(() => {});
  const handsFreeLoopRef = useRef<boolean>(handsFreeLoop);
  const jarvisStateRef = useRef<JarvisState>(jarvisState);
  const hasBootGreetedRef = useRef<boolean>(false);

  useEffect(() => {
    handsFreeLoopRef.current = handsFreeLoop;
  }, [handsFreeLoop]);

  useEffect(() => {
    jarvisStateRef.current = jarvisState;
  }, [jarvisState]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 80);
    }
  }, [isOpen, messages.length]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      } else if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    const onToggleEvent = () => setIsOpen((prev) => !prev);

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('njia-toggle-jarvis', onToggleEvent);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('njia-toggle-jarvis', onToggleEvent);
    };
  }, [isOpen]);

  const stopLiveAudioStream = useCallback(() => {
    try {
      liveProcessorRef.current?.disconnect();
    } catch {}
    liveProcessorRef.current = null;

    if (liveStreamRef.current) {
      liveStreamRef.current.getTracks().forEach((t) => t.stop());
      liveStreamRef.current = null;
    }
    if (liveInputCtxRef.current) {
      liveInputCtxRef.current.close().catch(() => {});
      liveInputCtxRef.current = null;
    }
    liveActiveSourcesRef.current.forEach((src) => {
      try {
        src.stop();
      } catch {}
    });
    liveActiveSourcesRef.current.clear();
    if (liveOutputCtxRef.current) {
      liveOutputCtxRef.current.close().catch(() => {});
      liveOutputCtxRef.current = null;
    }
    liveNextStartTimeRef.current = 0;

    if (liveWsRef.current) {
      try {
        liveWsRef.current.close();
      } catch {}
      liveWsRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      activeAudioRef.current?.pause();
      stopLiveAudioStream();
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      try {
        speechRecognitionRef.current?.stop();
      } catch {}
      try {
        wakeRecognitionRef.current?.stop();
      } catch {}
    };
  }, [stopLiveAudioStream]);

  const stopSpeaking = useCallback(() => {
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current = null;
    }
    liveActiveSourcesRef.current.forEach((src) => {
      try {
        src.stop();
      } catch {}
    });
    liveActiveSourcesRef.current.clear();
    if (liveOutputCtxRef.current) {
      liveNextStartTimeRef.current = liveOutputCtxRef.current.currentTime;
    }
    setJarvisState((prev) => (prev === 'speaking' ? 'idle' : prev));
  }, []);

  const playAudioPayload = useCallback(
    async (audioBase64: string, mimeType: string, triggerAutoListenAfter = true): Promise<boolean> => {
      stopSpeaking();
      const audio = new Audio(`data:${mimeType || 'audio/wav'};base64,${audioBase64}`);
      activeAudioRef.current = audio;
      setJarvisState('speaking');

      audio.onended = () => {
        activeAudioRef.current = null;
        setJarvisState('idle');
        if (triggerAutoListenAfter && handsFreeLoopRef.current) {
          setTimeout(() => {
            startListeningRef.current();
          }, 260);
        }
      };

      audio.onerror = () => {
        activeAudioRef.current = null;
        setJarvisState('idle');
      };

      try {
        await audio.play();
        setAutoplayBlocked(false);
        return true;
      } catch (err: unknown) {
        activeAudioRef.current = null;
        setJarvisState('idle');
        const msg = err instanceof Error ? err.message : String(err || '');
        if (msg.toLowerCase().includes('notallowed') || msg.toLowerCase().includes('gesture') || msg.toLowerCase().includes('interact')) {
          pendingWelcomeAudioRef.current = { base64: audioBase64, mimeType };
          setAutoplayBlocked(true);
          return false;
        }
        return false;
      }
    },
    [stopSpeaking]
  );

  const speakText = useCallback(
    async (text: string, triggerAutoListenAfter = true) => {
      stopSpeaking();
      setVoiceError(null);
      setJarvisState('speaking');
      try {
        const { res, data } = await fetchJsonWithRetry<{ audioBase64?: string; mimeType?: string; error?: string }>(
          '/api/jarvis/speak',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text }),
          }
        );
        if (!res.ok || !data.audioBase64) {
          throw new Error(data.error || 'Voice synthesis unavailable right now.');
        }
        await playAudioPayload(data.audioBase64, data.mimeType || 'audio/wav', triggerAutoListenAfter);
      } catch (err: unknown) {
        setJarvisState('idle');
        setVoiceError(err instanceof Error ? err.message : 'Voice playback failed.');
      }
    },
    [playAudioPayload, stopSpeaking]
  );

  // Initial welcome greeting automatically when first opening the website
  useEffect(() => {
    if (hasBootGreetedRef.current) return;
    hasBootGreetedRef.current = true;
    speakText(initialGreetingRef.current, true);
  }, [speakText]);

  const buildAppSnapshot = useCallback(() => {
    const openPositions = loadOpenPaperPositions();
    const leadPos = openPositions[0];
    const portfolioGuard = evaluatePortfolioExposure(
      leadPos?.ticker || 'EUR/USD',
      leadPos?.direction || 'BUY',
      leadPos?.lots || 0.1,
      openPositions
    );
    const propCfg = loadPropConfig();
    const propGuard = evaluatePropTradeBlock(propCfg);
    const trackedSignals = loadTrackedSignals();
    const activeSignals = trackedSignals
      .filter((s) => s.status === 'ACTIVE' || s.status === 'TP1_HIT')
      .slice(0, 8)
      .map((s) => ({
        symbol: s.symbol,
        timeframe: s.timeframe,
        direction: s.direction,
        status: s.status,
        entry: s.entryPrice,
        sl: s.sl,
        tp1: s.tp1,
        tp2: s.tp2,
      }));

    let paperBalance = 10000;
    let closedTradesCount = 0;
    let closedWinRatePct = 0;
    let closedNetPnl = 0;
    try {
      const bal = localStorage.getItem('njia_paper_balance');
      if (bal) paperBalance = Number(bal) || 10000;
      const closedRaw = localStorage.getItem('njia_paper_trades');
      if (closedRaw) {
        const closed = JSON.parse(closedRaw);
        if (Array.isArray(closed)) {
          closedTradesCount = closed.length;
          const wins = closed.filter((t) => Number(t.realizedPnl) > 0).length;
          closedWinRatePct = closed.length > 0 ? Math.round((wins / closed.length) * 100) : 0;
          closedNetPnl = Number(
            closed.reduce((sum, t) => sum + (Number(t.realizedPnl) || 0), 0).toFixed(2)
          );
        }
      }
    } catch {}

    const keySymbols = ['XAU/USD', 'EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/KES', 'BTC/USD'];
    const liveQuotesSummary: Record<string, { price: number; changePercent: number; marketOpen: boolean }> = {};
    for (const sym of keySymbols) {
      const q = lookupTradingViewQuote(liveTvQuotesRef.current, sym);
      if (q && q.price > 0) {
        liveQuotesSummary[sym] = {
          price: q.price,
          changePercent: Number((q.changePercent || 0).toFixed(2)),
          marketOpen: getAssetMarketSession(sym).isOpen,
        };
      }
    }

    return {
      activeTab,
      currency,
      personalFinance: {
        netWorth: Math.round(netWorth),
        totalMonthlyIncome: Math.round(totalMonthlyIncome),
        totalMonthlyExpenses: Math.round(totalMonthlyExpenses),
        savingsRatePct: Number(savingsRate.toFixed(1)),
        liquidBalance: Math.round(totalLiquidBalance),
        investments: Math.round(totalInvestments),
        emergencyFund: Math.round(totalEmergencyFund),
        debt: Math.round(totalDebt),
        healthScore: financialHealth.score,
        healthStatus: financialHealth.status,
      },
      tradingDesk: {
        forexTradFiMarketOpen: getAssetMarketSession('EUR/USD', 'FOREX').isOpen,
        propFirmGuardian: {
          blocked: propGuard.blocked,
          reason: propGuard.reason || null,
          equity: propCfg.currentEquity,
          dailyPnL: propGuard.dailyPnL,
          dailyLossBufferRemaining: propGuard.dailyLossBufferRemaining,
          totalLossBufferRemaining: propGuard.totalLossBufferRemaining,
        },
        paperBalance: Number(paperBalance.toFixed(2)),
        openPositionsCount: openPositions.length,
        openPositions: openPositions.slice(0, 6).map((p) => ({
          ticker: p.ticker,
          direction: p.direction,
          lots: p.lots,
          pnl: p.pnl ?? 0,
        })),
        portfolioExposureRisk: {
          level: portfolioGuard.level,
          usdNetLots: portfolioGuard.usdNetLots,
          stackedDirection: portfolioGuard.stackedDirection,
          message: portfolioGuard.message,
          correlatedCount: portfolioGuard.correlatedMatches.length,
        },
        closedTradesCount,
        closedWinRatePct,
        closedNetPnl,
        activeTrackedSignals: activeSignals,
        liveQuotes: liveQuotesSummary,
      },
    };
  }, [
    activeTab,
    currency,
    financialHealth.score,
    financialHealth.status,
    netWorth,
    savingsRate,
    totalDebt,
    totalEmergencyFund,
    totalInvestments,
    totalLiquidBalance,
    totalMonthlyExpenses,
    totalMonthlyIncome,
  ]);

  const executeJarvisActions = useCallback(
    async (actions: JarvisAction[]): Promise<string[]> => {
      const executedLabels: string[] = [];

      for (const action of actions) {
        const p = action.payload || {};
        if (action.type === 'navigate') {
          const target = String(p.tab || 'dashboard') as TabType;
          if (VALID_TABS.has(target)) {
            setActiveTab(target);
            executedLabels.push(`View -> ${target}`);
          }
        } else if (action.type === 'focusAsset') {
          const symbol = String(p.symbol || 'XAU/USD');
          const timeframe = String(p.timeframe || '15M');
          const bottomTab = p.bottomTab ? String(p.bottomTab) : undefined;
          const focusDetail = { symbol, timeframe, bottomTab };
          try {
            sessionStorage.setItem('njia_jarvis_pending_focus', JSON.stringify(focusDetail));
          } catch {}
          setActiveTab('stocks');
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('njia-jarvis-focus-asset', { detail: focusDetail }));
          }, 60);
          executedLabels.push(`Radar -> ${symbol} (${timeframe})`);
        } else if (action.type === 'executePaperTrade') {
          const symbol = String(p.symbol || 'XAU/USD').toUpperCase();
          const isSell = String(p.direction || 'BUY').toUpperCase().includes('SELL');
          const tradeDir: 'LONG' | 'SHORT' = isSell ? 'SHORT' : 'LONG';
          const dirLabel = isSell ? 'SELL' : 'BUY';
          const lots = Number(p.lots || 0.1);
          const tvSpot = Number(p.entryPrice || 0) || resolveTradingViewPrice(liveTvQuotesRef.current, symbol, 0);
          const q = lookupTradingViewQuote(liveTvQuotesRef.current, symbol);
          const levels =
            tvSpot > 0 && (!p.sl || !p.tp1)
              ? computeTimeframeSignalLevels({
                  symbol,
                  spotPrice: tvSpot,
                  timeframe: '15M',
                  quote: q,
                  market: symbol.includes('XAU') ? 'METALS' : symbol.includes('BTC') ? 'CRYPTO' : 'FOREX',
                  preferredDirection: dirLabel,
                })
              : null;
          const result = executePaperMarketOrder({
            ticker: symbol,
            direction: tradeDir,
            lots: Number.isFinite(lots) && lots > 0 ? lots : 0.1,
            spotPrice: tvSpot,
            stopLoss: Number(p.sl || levels?.sl || 0) || undefined,
            tp1: Number(p.tp1 || levels?.tp1 || 0) || undefined,
            takeProfit: Number(p.tp2 || levels?.tp2 || 0) || undefined,
            source: 'Mullah Voice',
          });
          executedLabels.push(result.ok ? `Paper ${dirLabel} ${symbol}` : `Blocked: ${result.error || 'Rejected'}`);
        } else if (action.type === 'closePaperPositions') {
          const sym = String(p.symbol || 'ALL').toUpperCase();
          const result = closePaperPositionsByQuery(sym, liveTvQuotesRef.current);
          executedLabels.push(
            result.closedCount > 0
              ? `Closed ${result.closedCount} (${result.realizedPnl >= 0 ? '+' : ''}$${result.realizedPnl})`
              : `No open ${sym} positions`
          );
        } else if (action.type === 'setPriceAlert') {
          const symbol = String(p.symbol || 'XAU/USD').toUpperCase();
          const targetPrice = Number(p.targetPrice || 0);
          const curSpot = resolveTradingViewPrice(liveTvQuotesRef.current, symbol, targetPrice);
          const rawDir = String(p.direction || 'AUTO').toUpperCase();
          const condition: 'ABOVE' | 'BELOW' =
            rawDir === 'ABOVE' || rawDir === 'BELOW'
              ? rawDir
              : targetPrice >= curSpot
              ? 'ABOVE'
              : 'BELOW';
          if (targetPrice > 0) {
            try {
              const existing = JSON.parse(localStorage.getItem('njia_price_alerts') || '[]');
              const list = Array.isArray(existing) ? existing : [];
              list.unshift({
                id: `alert-${Date.now()}`,
                ticker: symbol,
                name: `${symbol} Voice Alert`,
                condition,
                targetPrice,
                currency: 'USD',
                note: 'Set via Mullah Voice',
                isActive: true,
                isTriggered: false,
                createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              });
              localStorage.setItem('njia_price_alerts', JSON.stringify(list));
              executedLabels.push(`Alert: ${symbol} ${condition} ${targetPrice}`);
            } catch {}
          }
        } else if (action.type === 'controlBot') {
          const target = String(p.target || 'ALL').toUpperCase();
          const botAction = String(p.action || 'START').toUpperCase().includes('STOP') ? 'STOP' : 'START';
          const symbol = p.symbol ? String(p.symbol).toUpperCase() : undefined;
          if (botAction === 'START') {
            setActiveTab(target === 'MT5_EA' ? 'mt5-ea' : 'bot-studio');
          }
          setTimeout(() => {
            window.dispatchEvent(
              new CustomEvent('njia-bot-control', {
                detail: { target, action: botAction, symbol },
              })
            );
          }, 80);
          executedLabels.push(`${target} -> ${botAction}`);
        } else if (action.type === 'logTransaction') {
          const txType = p.transactionType === 'income' ? 'income' : 'expense';
          const title = String(p.title || 'Mullah Entry');
          const amount = Number(p.amount || 0);
          if (amount > 0) {
            const today = new Date().toISOString().split('T')[0];
            if (txType === 'income') {
              const cat = INCOME_CATEGORIES.has(p.category as IncomeItem['category'])
                ? (p.category as IncomeItem['category'])
                : 'Other';
              const pm: IncomeItem['paymentMethod'] =
                p.paymentMethod === 'M-Pesa' ||
                p.paymentMethod === 'Bank Transfer' ||
                p.paymentMethod === 'Cash' ||
                p.paymentMethod === 'SACCO'
                  ? p.paymentMethod
                  : 'M-Pesa';
              addIncome({
                source: title,
                amount,
                category: cat,
                frequency: 'one-time',
                date: today,
                paymentMethod: pm,
                notes: 'Logged via Mullah Voice',
              });
              executedLabels.push(`Income +${amount} (${title})`);
            } else {
              const cat = EXPENSE_CATEGORIES.has(p.category as ExpenseItem['category'])
                ? (p.category as ExpenseItem['category'])
                : 'Other';
              const pm: ExpenseItem['paymentMethod'] =
                p.paymentMethod === 'M-Pesa' ||
                p.paymentMethod === 'Card' ||
                p.paymentMethod === 'Cash' ||
                p.paymentMethod === 'Bank'
                  ? p.paymentMethod
                  : 'M-Pesa';
              addExpense({
                title,
                amount,
                category: cat,
                date: today,
                paymentMethod: pm,
                isRecurring: false,
                notes: 'Logged via Mullah Voice',
              });
              executedLabels.push(`Expense -${amount} (${title})`);
            }
          }
        } else if (action.type === 'setCurrency') {
          const nextCur = String(p.currency || 'USD').toUpperCase() as CurrencyCode;
          if (['KES', 'USD', 'EUR', 'GBP'].includes(nextCur)) {
            setCurrency(nextCur);
            executedLabels.push(`Currency -> ${nextCur}`);
          }
        } else if (action.type === 'broadcastSignal') {
          const sym = String(p.symbol || 'LATEST').toUpperCase();
          const tracked = loadTrackedSignals();
          const match =
            sym === 'LATEST'
              ? tracked[0]
              : tracked.find((s) => s.symbol.replace('/', '') === sym.replace('/', '')) || tracked[0];
          if (match) {
            const result = await dispatchSignalWebhook({
              symbol: match.symbol,
              action: match.action,
              timeframe: match.timeframe,
              entryZone: match.entryPrice,
              sl: match.sl,
              tp1: match.tp1,
              tp2: match.tp2,
              riskReward: match.riskReward,
              confidenceScore: match.confidenceScore,
            });
            executedLabels.push(
              result.channels.length > 0 ? `Broadcasted ${match.symbol}` : `Copied ${match.symbol} Alert`
            );
          } else {
            executedLabels.push('No tracked signal to broadcast');
          }
        }
      }

      return executedLabels;
    },
    [addExpense, addIncome, setActiveTab, setCurrency]
  );

  // Subscribe to Proactive Voice Alerts (TP/SL hits, Paper Breakevens, Red-News 15m Warnings)
  useEffect(() => {
    const onProactiveAlert = (evt: Event) => {
      if (!proactiveAlertsEnabled) return;
      const detail = (evt as CustomEvent<{ text?: string }>).detail;
      const text = detail?.text?.trim();
      if (!text) return;

      setMessages((prev) => [
        ...prev,
        {
          id: `proactive-${Date.now()}`,
          role: 'assistant',
          text,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          actionsExecuted: ['Proactive Alert'],
        },
      ]);

      if (jarvisStateRef.current === 'idle') {
        speakText(text, false);
      }
    };
    window.addEventListener(MULLAH_PROACTIVE_ALERT_EVENT, onProactiveAlert);
    return () => window.removeEventListener(MULLAH_PROACTIVE_ALERT_EVENT, onProactiveAlert);
  }, [proactiveAlertsEnabled, speakText]);

  // Gapless 24kHz PCM Chunk Playback Scheduler for Live Audio WebSocket
  const enqueueLivePcmChunk = useCallback((base64Pcm: string) => {
    try {
      if (!liveOutputCtxRef.current || liveOutputCtxRef.current.state === 'closed') {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof window.AudioContext }).webkitAudioContext;
        liveOutputCtxRef.current = new AudioCtx({ sampleRate: 24000 });
        liveNextStartTimeRef.current = liveOutputCtxRef.current.currentTime;
      }
      const ctx = liveOutputCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const pcm16 = base64ToInt16Array(base64Pcm);
      if (pcm16.length === 0) return;

      const audioBuffer = ctx.createBuffer(1, pcm16.length, 24000);
      const channelData = audioBuffer.getChannelData(0);
      for (let i = 0; i < pcm16.length; i++) {
        channelData[i] = pcm16[i] / 32768;
      }

      const src = ctx.createBufferSource();
      src.buffer = audioBuffer;
      src.connect(ctx.destination);

      const startAt = Math.max(liveNextStartTimeRef.current, ctx.currentTime + 0.02);
      src.start(startAt);
      liveNextStartTimeRef.current = startAt + audioBuffer.duration;
      liveActiveSourcesRef.current.add(src);
      setJarvisState('speaking');

      src.onended = () => {
        liveActiveSourcesRef.current.delete(src);
        if (liveActiveSourcesRef.current.size === 0 && !liveStreamRef.current) {
          setJarvisState('idle');
        }
      };
    } catch {
      // ignore decode edge case cleanly
    }
  }, []);

  const startLiveAudioSession = useCallback(async () => {
    stopSpeaking();
    stopLiveAudioStream();
    setVoiceError(null);
    setJarvisState('thinking');

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws/mullah-live`);
      liveWsRef.current = ws;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      liveStreamRef.current = stream;

      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof window.AudioContext }).webkitAudioContext;
      const inputCtx = new AudioCtx({ sampleRate: 16000 });
      liveInputCtxRef.current = inputCtx;
      const source = inputCtx.createMediaStreamSource(stream);
      const processor = inputCtx.createScriptProcessor(4096, 1, 1);
      liveProcessorRef.current = processor;

      let readyToSend = false;

      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            type: 'init',
            appSnapshot: buildAppSnapshot(),
          })
        );
      };

      ws.onmessage = async (evt) => {
        try {
          const packet = JSON.parse(String(evt.data || '{}'));
          if (packet.type === 'ready') {
            readyToSend = true;
            setJarvisState('listening');
          } else if (packet.type === 'audio' && packet.data) {
            enqueueLivePcmChunk(packet.data);
          } else if (packet.type === 'input_transcript' && packet.text) {
            const text = String(packet.text).trim();
            if (text) {
              setMessages((prev) => [
                ...prev,
                {
                  id: `usr-live-${Date.now()}`,
                  role: 'user',
                  text,
                  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                },
              ]);
            }
          } else if (packet.type === 'output_transcript' && packet.text) {
            const text = String(packet.text).trim();
            if (text) {
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last && last.role === 'assistant' && last.id.startsWith('jrv-live-')) {
                  return [
                    ...prev.slice(0, -1),
                    { ...last, text: `${last.text} ${text}`.replace(/\s+/g, ' ').trim() },
                  ];
                }
                return [
                  ...prev,
                  {
                    id: `jrv-live-${Date.now()}`,
                    role: 'assistant',
                    text,
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  },
                ];
              });
            }
          } else if (packet.type === 'actions' && Array.isArray(packet.actions)) {
            const labels = await executeJarvisActions(packet.actions);
            if (labels.length > 0) {
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last && last.role === 'assistant') {
                  return [
                    ...prev.slice(0, -1),
                    {
                      ...last,
                      actionsExecuted: [...(last.actionsExecuted || []), ...labels],
                    },
                  ];
                }
                return prev;
              });
            }
          } else if (packet.type === 'interrupted') {
            liveActiveSourcesRef.current.forEach((s) => {
              try {
                s.stop();
              } catch {}
            });
            liveActiveSourcesRef.current.clear();
          } else if (packet.type === 'turn_complete') {
            if (liveStreamRef.current) setJarvisState('listening');
          } else if (packet.type === 'error') {
            setVoiceError(packet.message || 'Live voice stream fell back to standard voice mode.');
            setLiveStreamMode(false);
            stopLiveAudioStream();
            setJarvisState('idle');
          }
        } catch {}
      };

      ws.onerror = () => {
        setVoiceError('Live audio WebSocket unavailable — switched to resilient Voice Mode.');
        setLiveStreamMode(false);
        stopLiveAudioStream();
        setJarvisState('idle');
      };

      ws.onclose = () => {
        if (liveStreamRef.current) {
          stopLiveAudioStream();
          setJarvisState('idle');
        }
      };

      processor.onaudioprocess = (event) => {
        if (!readyToSend || ws.readyState !== WebSocket.OPEN) return;
        const floatSamples = event.inputBuffer.getChannelData(0);
        const pcm16 = new Int16Array(floatSamples.length);
        for (let i = 0; i < floatSamples.length; i++) {
          const s = Math.max(-1, Math.min(1, floatSamples[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        ws.send(
          JSON.stringify({
            type: 'audio',
            data: arrayBufferToBase64(pcm16.buffer),
          })
        );
      };

      source.connect(processor);
      processor.connect(inputCtx.destination);
    } catch {
      stopLiveAudioStream();
      setLiveStreamMode(false);
      setJarvisState('idle');
      setVoiceError('Live stream could not access microphone; switched to standard voice mode.');
    }
  }, [buildAppSnapshot, enqueueLivePcmChunk, executeJarvisActions, stopLiveAudioStream, stopSpeaking]);

  const sendSpokenCommand = useCallback(
    async (spokenText: string) => {
      const trimmed = spokenText.trim();
      if (!trimmed || jarvisState === 'thinking') return;

      stopSpeaking();
      setVoiceError(null);

      const userMsg: JarvisMessage = {
        id: `usr-${Date.now()}`,
        role: 'user',
        text: trimmed,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      const nextHistory = [...messages, userMsg];
      setMessages(nextHistory);
      setJarvisState('thinking');

      try {
        const { res, data } = await fetchJsonWithRetry<{
          reply?: string;
          actions?: JarvisAction[];
          error?: string;
        }>('/api/jarvis/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: nextHistory.map((m) => ({ role: m.role, text: m.text })),
            appSnapshot: buildAppSnapshot(),
          }),
        });

        if (!res.ok) {
          throw new Error(data.error || `Request failed (${res.status}).`);
        }

        const actionsExecuted =
          Array.isArray(data.actions) && data.actions.length > 0
            ? await executeJarvisActions(data.actions)
            : [];

        const replyText = String(data.reply || 'Acknowledged.');
        const assistantMsg: JarvisMessage = {
          id: `jrv-${Date.now()}`,
          role: 'assistant',
          text: replyText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          actionsExecuted,
        };

        setMessages((prev) => [...prev, assistantMsg]);
        await speakText(replyText, true);
      } catch (err: unknown) {
        setJarvisState('idle');
        const errMsg = err instanceof Error ? err.message : 'Unable to reach Mullah voice servers.';
        setVoiceError(errMsg);
        // Append ONE clear notice without recursively calling speakText (prevents double error notices)
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: 'assistant',
            text: errMsg,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isError: true,
          },
        ]);
      }
    },
    [buildAppSnapshot, executeJarvisActions, jarvisState, messages, speakText, stopSpeaking]
  );

  const stopListening = useCallback(() => {
    stopLiveAudioStream();
    try {
      speechRecognitionRef.current?.stop();
    } catch {}
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    setJarvisState((prev) => (prev === 'listening' ? 'idle' : prev));
  }, [stopLiveAudioStream]);

  const startListening = useCallback(async () => {
    if (jarvisState === 'listening' || jarvisState === 'thinking') return;

    if (pendingWelcomeAudioRef.current) {
      const pending = pendingWelcomeAudioRef.current;
      pendingWelcomeAudioRef.current = null;
      await playAudioPayload(pending.base64, pending.mimeType, true);
      return;
    }

    if (liveStreamMode) {
      await startLiveAudioSession();
      return;
    }

    stopSpeaking();
    setVoiceError(null);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRec) {
      try {
        const recognition = new SpeechRec();
        recognition.lang = 'en-US';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
        speechRecognitionRef.current = recognition;
        setJarvisState('listening');

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        recognition.onresult = (event: any) => {
          const transcript = event?.results?.[0]?.[0]?.transcript?.trim();
          setJarvisState('idle');
          if (transcript) {
            sendSpokenCommand(transcript);
          }
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        recognition.onerror = (event: any) => {
          setJarvisState('idle');
          if (event?.error === 'no-speech') {
            setVoiceError('No voice detected. Tap the reactor when ready to speak.');
          } else if (event?.error && event.error !== 'aborted') {
            setVoiceError(`Microphone error: ${event.error}`);
          }
        };
        recognition.onend = () => {
          setJarvisState((prev) => (prev === 'listening' ? 'idle' : prev));
        };
        recognition.start();
        return;
      } catch {
        setJarvisState('idle');
      }
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const chunks: Blob[] = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
        if (chunks.length === 0) {
          setJarvisState('idle');
          return;
        }
        setJarvisState('thinking');
        try {
          const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
          const reader = new FileReader();
          reader.onloadend = async () => {
            try {
              const result = String(reader.result || '');
              const base64 = result.split(',')[1] || '';
              if (!base64) {
                setJarvisState('idle');
                return;
              }
              const { res, data } = await fetchJsonWithRetry<{ transcript?: string; error?: string }>(
                '/api/jarvis/transcribe',
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    audioBase64: base64,
                    mimeType: recorder.mimeType || 'audio/webm',
                  }),
                }
              );
              if (!res.ok) {
                throw new Error(data.error || 'Voice transcription failed');
              }
              if (data.transcript) {
                await sendSpokenCommand(data.transcript);
              } else {
                setJarvisState('idle');
                setVoiceError('Did not catch that clearly. Tap the reactor to speak.');
              }
            } catch (innerErr) {
              setJarvisState('idle');
              setVoiceError(innerErr instanceof Error ? innerErr.message : 'Transcription error');
            }
          };
          reader.readAsDataURL(blob);
        } catch (err: unknown) {
          setJarvisState('idle');
          setVoiceError(err instanceof Error ? err.message : 'Transcription error');
        }
      };

      recorder.start();
      setJarvisState('listening');
    } catch {
      setJarvisState('idle');
      setVoiceError('Microphone access is required for voice commands.');
    }
  }, [jarvisState, liveStreamMode, playAudioPayload, sendSpokenCommand, startLiveAudioSession, stopSpeaking]);

  useEffect(() => {
    startListeningRef.current = startListening;
  }, [startListening]);

  // Passive "Hey Mullah" Wake Word Standby Listener (active only when Wake Word toggle is ON and jarvisState is idle)
  useEffect(() => {
    if (!wakeWordEnabled || jarvisState !== 'idle' || liveStreamMode) {
      try {
        wakeRecognitionRef.current?.stop();
      } catch {}
      wakeRecognitionRef.current = null;
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) return;

    let cancelled = false;
    try {
      const rec = new SpeechRec();
      rec.lang = 'en-US';
      rec.continuous = true;
      rec.interimResults = false;
      wakeRecognitionRef.current = rec;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rec.onresult = (event: any) => {
        if (cancelled) return;
        const latest = event?.results?.[event.results.length - 1]?.[0]?.transcript?.trim() || '';
        const lower = latest.toLowerCase();
        if (lower.includes('hey mullah') || lower.includes('mullah')) {
          try {
            rec.stop();
          } catch {}
          setIsOpen(true);
          const remainder = latest.replace(/^(hey\s+)?mullah[,:\s]*/i, '').trim();
          if (remainder.length > 2) {
            sendSpokenCommand(remainder);
          } else {
            startListeningRef.current();
          }
        }
      };
      rec.onend = () => {
        if (!cancelled && wakeWordEnabled && jarvisStateRef.current === 'idle') {
          setTimeout(() => {
            try {
              rec.start();
            } catch {}
          }, 400);
        }
      };
      rec.start();
    } catch {}

    return () => {
      cancelled = true;
      try {
        wakeRecognitionRef.current?.stop();
      } catch {}
    };
  }, [jarvisState, liveStreamMode, sendSpokenCommand, wakeWordEnabled]);

  const handleReactorTap = () => {
    if (jarvisState === 'listening') {
      stopListening();
    } else if (jarvisState === 'speaking') {
      stopSpeaking();
    } else {
      startListening();
    }
  };

  const handleResetSession = () => {
    stopSpeaking();
    stopListening();
    const greeting = buildWelcomeGreeting();
    setMessages([
      {
        id: `jarvis-reset-${Date.now()}`,
        role: 'assistant',
        text: greeting,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    speakText(greeting, true);
  };

  const isForexOpen = getAssetMarketSession('EUR/USD', 'FOREX').isOpen;

  return (
    <>
      {!isOpen && (
        <button
          type="button"
          onClick={() => {
            setIsOpen(true);
            if (pendingWelcomeAudioRef.current) {
              const pending = pendingWelcomeAudioRef.current;
              pendingWelcomeAudioRef.current = null;
              playAudioPayload(pending.base64, pending.mimeType, true);
            }
          }}
          title="Open Mullah Voice Copilot (Ctrl/Cmd + J)"
          className="fixed bottom-5 right-5 z-40 group flex items-center gap-2.5 pl-2.5 pr-4 py-2 rounded-full bg-[#07111e]/95 hover:bg-[#0b1a2d] border border-[#0df2c9]/50 hover:border-[#0df2c9] shadow-[0_0_26px_rgba(13,242,201,0.3)] backdrop-blur-md transition-all cursor-pointer active:scale-95"
        >
          <span className="w-3 h-3 rounded-full bg-[#0df2c9] animate-pulse shadow-[0_0_10px_#0df2c9]" />
          <div className="text-left">
            <div className="text-[11px] font-mono font-black tracking-wider text-white">MULLAH VOICE</div>
            <div className="text-[9px] font-mono text-[#0df2c9]/80">⌘J · Audio Mode</div>
          </div>
        </button>
      )}

      {isOpen && (
        <div
          role="dialog"
          aria-label="Mullah Audio Copilot"
          className="fixed bottom-4 right-4 z-50 w-[calc(100vw-2rem)] sm:w-[420px] max-h-[86vh] h-[630px] flex flex-col rounded-2xl bg-[#050c17]/96 border border-[#0df2c9]/50 shadow-[0_0_55px_rgba(13,242,201,0.24)] backdrop-blur-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200"
        >
          {/* HUD Top Header */}
          <div className="px-4 py-3 bg-gradient-to-r from-[#071526] via-[#091c2f] to-[#071526] border-b border-[#0df2c9]/25 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#0df2c9] animate-pulse" />
                <span className="text-xs font-mono font-black tracking-widest text-white">MULLAH</span>
                <span
                  className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded border ${
                    jarvisState === 'listening'
                      ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300'
                      : jarvisState === 'thinking'
                      ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-300'
                      : jarvisState === 'speaking'
                      ? 'bg-amber-500/20 border-amber-400/50 text-amber-300'
                      : 'bg-[#0df2c9]/10 border-[#0df2c9]/35 text-[#0df2c9]'
                  }`}
                >
                  {jarvisState === 'listening'
                    ? liveStreamMode
                      ? 'Live Stream'
                      : 'Listening'
                    : jarvisState === 'thinking'
                    ? 'Processing'
                    : jarvisState === 'speaking'
                    ? 'Speaking'
                    : wakeWordEnabled
                    ? 'Wake Standby'
                    : 'Audio Ready'}
                </span>
              </div>
              <div className="text-[10px] font-mono text-slate-400 truncate mt-0.5">
                View: <span className="text-slate-200">{activeTab}</span> · FX:{' '}
                <span className={isForexOpen ? 'text-emerald-400' : 'text-amber-400'}>
                  {isForexOpen ? 'Live' : 'Weekend Frozen'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => {
                  stopListening();
                  setLiveStreamMode((v) => !v);
                }}
                title="Switch between ultra-low latency Gemini Live Stream WebSocket and Resilient Voice Mode"
                className={`px-2 py-1 rounded-lg border text-[9px] font-mono font-bold transition-colors cursor-pointer ${
                  liveStreamMode
                    ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-300'
                    : 'bg-[#0b1628] border-[#1b2e4b] text-slate-400 hover:text-white'
                }`}
              >
                {liveStreamMode ? 'LIVE WS' : 'RESILIENT'}
              </button>

              <button
                type="button"
                onClick={() => setWakeWordEnabled((v) => !v)}
                title='Hands-free "Hey Mullah" wake word detector'
                className={`px-2 py-1 rounded-lg border text-[9px] font-mono font-bold transition-colors cursor-pointer ${
                  wakeWordEnabled
                    ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300'
                    : 'bg-[#0b1628] border-[#1b2e4b] text-slate-400 hover:text-white'
                }`}
              >
                {wakeWordEnabled ? 'HEY MULLAH' : 'WAKE OFF'}
              </button>

              <button
                type="button"
                onClick={() => setHandsFreeLoop((v) => !v)}
                title={handsFreeLoop ? 'Continuous Voice Loop: ON' : 'Continuous Voice Loop: OFF'}
                className={`px-2 py-1 rounded-lg border text-[9px] font-mono font-bold transition-colors cursor-pointer ${
                  handsFreeLoop
                    ? 'bg-[#0df2c9]/20 border-[#0df2c9]/50 text-[#0df2c9]'
                    : 'bg-[#0b1628] border-[#1b2e4b] text-slate-400 hover:text-white'
                }`}
              >
                {handsFreeLoop ? 'AUTO' : 'TAP'}
              </button>

              <button
                type="button"
                onClick={() => setProactiveAlertsEnabled((v) => !v)}
                title="Proactive spoken alerts for TP/SL fills and 15m red news"
                className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                  proactiveAlertsEnabled
                    ? 'bg-amber-500/15 border-amber-400/40 text-amber-300'
                    : 'bg-[#0b1628] border-[#1b2e4b] text-slate-500'
                }`}
              >
                <Bell className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={handleResetSession}
                title="Replay greeting & reset audio session"
                className="p-1.5 rounded-lg bg-[#0b1628] border border-[#1b2e4b] text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Minimize"
                className="p-1.5 rounded-lg bg-[#0b1628] border border-[#1b2e4b] text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <Minimize2 className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => {
                  stopSpeaking();
                  stopListening();
                  setIsOpen(false);
                }}
                title="Close"
                className="p-1.5 rounded-lg bg-[#0b1628] border border-[#1b2e4b] text-slate-400 hover:text-rose-300 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Live Telemetry Bar */}
          <div className="px-3.5 py-1.5 bg-[#040a14] border-b border-[#14233b] flex items-center justify-between text-[10px] font-mono text-slate-400">
            <span className="flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-[#0df2c9]" />
              Net: <strong className="text-slate-200">{currency} {Math.round(netWorth).toLocaleString()}</strong>
            </span>
            <span className="flex items-center gap-1">
              <Terminal className="w-3 h-3 text-cyan-400" />
              Health: <strong className="text-emerald-400">{financialHealth.score}/100</strong>
            </span>
            <span className="flex items-center gap-1">
              <Zap className="w-3 h-3 text-amber-400" />
              Trades: <strong className="text-white">{loadOpenPaperPositions().length}</strong>
            </span>
          </div>

          {/* Central Audio-Only Voice Core */}
          <div className="px-4 py-4 bg-gradient-to-b from-[#061222] to-[#050c17] border-b border-[#12223b] flex flex-col items-center text-center gap-2.5">
            <button
              type="button"
              onClick={handleReactorTap}
              aria-label={
                jarvisState === 'listening'
                  ? 'Stop listening'
                  : jarvisState === 'speaking'
                  ? 'Stop speaking'
                  : 'Tap to speak with Mullah'
              }
              className="rounded-full focus:outline-none cursor-pointer transition-transform hover:scale-105 active:scale-95"
            >
              <ArcReactorCore state={jarvisState} size={118} />
            </button>

            <VoiceWaveformBars
              active={jarvisState === 'listening' || jarvisState === 'speaking'}
              colorClass={
                jarvisState === 'listening'
                  ? 'bg-emerald-400'
                  : jarvisState === 'speaking'
                  ? 'bg-amber-400'
                  : 'bg-[#0df2c9]'
              }
            />

            <div className="space-y-1">
              <div className="text-xs font-mono font-bold text-white">
                {autoplayBlocked
                  ? 'Tap the Reactor to Hear Mullah'
                  : jarvisState === 'listening'
                  ? liveStreamMode
                    ? 'Live Audio Link Active — Speak freely...'
                    : 'Listening... Speak your command'
                  : jarvisState === 'thinking'
                  ? 'Analyzing live markets & telemetry...'
                  : jarvisState === 'speaking'
                  ? 'Mullah is speaking (tap core to interrupt)'
                  : 'Tap Reactor to Speak'}
              </div>
              <div className="text-[10px] font-mono text-slate-400">
                Try: &ldquo;Scan Gold 15M&rdquo;, &ldquo;Buy 0.1 Gold&rdquo;, &ldquo;Start Bot Studio&rdquo;, &ldquo;Alert Gold at 3900&rdquo;
              </div>
            </div>

            {jarvisState === 'speaking' && (
              <button
                type="button"
                onClick={stopSpeaking}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/45 text-[10px] font-mono font-bold text-amber-200 hover:bg-amber-500/30 cursor-pointer"
              >
                <Square className="w-2.5 h-2.5 fill-current" />
                Stop Speaking
              </button>
            )}

            {jarvisState === 'listening' && (
              <button
                type="button"
                onClick={stopListening}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/45 text-[10px] font-mono font-bold text-emerald-200 hover:bg-emerald-500/30 cursor-pointer"
              >
                <MicOff className="w-3 h-3" />
                {liveStreamMode ? 'End Live Stream' : 'Finish Speaking'}
              </button>
            )}
          </div>

          {/* Live Spoken Transcript Feed */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5">
            {messages.map((msg) => {
              const isUser = msg.role === 'user';
              return (
                <div key={msg.id} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`max-w-[92%] rounded-2xl px-3.5 py-2 border text-xs leading-relaxed ${
                      isUser
                        ? 'bg-[#0e263f]/90 border-cyan-500/35 text-cyan-50 rounded-br-sm'
                        : msg.isError
                        ? 'bg-[#2a0c16]/90 border-rose-500/45 text-rose-200 rounded-bl-sm'
                        : 'bg-[#091424]/95 border-[#182e4f] text-slate-200 rounded-bl-sm'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 mb-0.5">
                      <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-[#0df2c9] flex items-center gap-1">
                        {msg.isError && <AlertTriangle className="w-2.5 h-2.5 text-rose-400" />}
                        {isUser ? 'You (Voice)' : msg.isError ? 'Voice Link Notice' : 'Mullah (Audio)'}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-mono text-slate-500">{msg.timestamp}</span>
                        {!isUser && !msg.isError && (
                          <button
                            type="button"
                            onClick={() => speakText(msg.text, false)}
                            title="Replay audio"
                            className="text-slate-400 hover:text-[#0df2c9] cursor-pointer"
                          >
                            <Volume2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>

                    <p>{msg.text}</p>

                    {msg.actionsExecuted && msg.actionsExecuted.length > 0 && (
                      <div className="mt-2 pt-1.5 border-t border-[#162b4a] flex flex-wrap gap-1">
                        {msg.actionsExecuted.map((act, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#0df2c9]/10 border border-[#0df2c9]/35 text-[9px] font-mono text-[#0df2c9]"
                          >
                            <Zap className="w-2.5 h-2.5" />
                            {act}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={chatEndRef} />
          </div>

          {voiceError && (
            <div className="px-3.5 py-2 bg-rose-950/60 border-t border-rose-500/35 text-[10px] font-mono text-rose-200 flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 truncate">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                {voiceError}
              </span>
              <button
                type="button"
                onClick={() => setVoiceError(null)}
                className="text-rose-300 hover:text-white cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
};
