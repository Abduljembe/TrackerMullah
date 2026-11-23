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
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext.tsx';
import { CurrencyCode, ExpenseItem, IncomeItem, TabType } from '../../types/finance.ts';
import { useTradingViewQuotes, lookupTradingViewQuote } from '../../utils/tradingViewSync.ts';
import { loadOpenPaperPositions, evaluatePortfolioExposure } from '../../utils/portfolioGuard.ts';
import { loadTrackedSignals, dispatchSignalWebhook } from '../../utils/signalScorecard.ts';
import { getAssetMarketSession } from '../../utils/marketHours.ts';

type JarvisState = 'idle' | 'listening' | 'thinking' | 'speaking';

interface JarvisAction {
  type: 'navigate' | 'focusAsset' | 'logTransaction' | 'setCurrency' | 'broadcastSignal';
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

function buildWelcomeGreeting(): string {
  const hour = new Date().getHours();
  const timeOfDay = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const fxOpen = getAssetMarketSession('EUR/USD', 'FOREX').isOpen;
  const openCount = loadOpenPaperPositions().length;
  const marketNote = fxOpen
    ? 'Global markets are live.'
    : 'Traditional Forex markets are currently closed for the weekend, while crypto and synthetics remain active.';
  const posNote = openCount > 0 ? `You have ${openCount} open position${openCount > 1 ? 's' : ''} monitored.` : '';
  return `${timeOfDay}. Mullah is online. ${marketNote} ${posNote} Tell me what you want to do — inspect a market, check red news, switch views, or review your finances.`.replace(/\s+/g, ' ').trim();
}

// Large Interactive Concentric Holographic Arc-Reactor Core
const ArcReactorCore: React.FC<{ state: JarvisState; size?: number }> = ({ state, size = 136 }) => {
  const isListening = state === 'listening';
  const isThinking = state === 'thinking';
  const isSpeaking = state === 'speaking';

  const coreColor = isListening
    ? '#10b981'
    : isSpeaking
    ? '#f59e0b'
    : '#0df2c9';

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

        {/* Outer acoustic aura */}
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

        {/* Primary segmented HUD ring */}
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

        {/* Counter-rotating telemetry ring */}
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

        {/* Inner Arc Frame */}
        <circle
          cx="60"
          cy="60"
          r="27"
          fill="#05101d"
          stroke={coreColor}
          strokeOpacity={0.8}
          strokeWidth="1.5"
        />

        {/* Core Plasma */}
        <circle
          cx="60"
          cy="60"
          r={isListening || isSpeaking ? '23' : '19'}
          fill="url(#jarvisAudioGlow)"
          className={isListening || isSpeaking ? 'animate-pulse' : ''}
        />
      </svg>

      {/* Center Status Icon */}
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

// Reactive animated equalizer bars for audio states
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

  // Auto-open J.A.R.V.I.S. when the website opens
  const [isOpen, setIsOpen] = useState(true);
  const [jarvisState, setJarvisState] = useState<JarvisState>('idle');
  const [handsFreeLoop, setHandsFreeLoop] = useState<boolean>(true);
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
  const startListeningRef = useRef<() => void>(() => {});
  const handsFreeLoopRef = useRef<boolean>(handsFreeLoop);
  const hasBootGreetedRef = useRef<boolean>(false);

  useEffect(() => {
    handsFreeLoopRef.current = handsFreeLoop;
  }, [handsFreeLoop]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 80);
    }
  }, [isOpen, messages.length]);

  // Global keyboard shortcut (Cmd/Ctrl + J) & Header toggle trigger
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

  // Cleanup audio & mic on unmount
  useEffect(() => {
    return () => {
      activeAudioRef.current?.pause();
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      try {
        speechRecognitionRef.current?.stop();
      } catch {}
    };
  }, []);

  const stopSpeaking = useCallback(() => {
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current = null;
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
        const res = await fetch('/api/jarvis/speak', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        });
        const data = await res.json();
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

  // Speak welcome greeting automatically when first opening the website
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
      const q = lookupTradingViewQuote(liveTvQuotes, sym);
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
    liveTvQuotes,
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
              result.channels.length > 0
                ? `Broadcasted ${match.symbol}`
                : `Copied ${match.symbol} Alert`
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
        const res = await fetch('/api/jarvis/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: nextHistory.map((m) => ({ role: m.role, text: m.text })),
            appSnapshot: buildAppSnapshot(),
          }),
        });

        const data = await res.json();
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
        const errMsg = err instanceof Error ? err.message : 'Unable to reach Mullah voice servers.';
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
        await speakText(errMsg, false);
      }
    },
    [buildAppSnapshot, executeJarvisActions, jarvisState, messages, speakText, stopSpeaking]
  );

  const stopListening = useCallback(() => {
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
  }, []);

  const startListening = useCallback(async () => {
    if (jarvisState === 'listening' || jarvisState === 'thinking') return;

    // If initial welcome audio was deferred by browser autoplay policy, unlock & play it on first tap
    if (pendingWelcomeAudioRef.current) {
      const pending = pendingWelcomeAudioRef.current;
      pendingWelcomeAudioRef.current = null;
      await playAudioPayload(pending.base64, pending.mimeType, true);
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

    // Fallback: record audio via MediaRecorder & transcribe server-side with gemini-3.5-transcribe
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
            const result = String(reader.result || '');
            const base64 = result.split(',')[1] || '';
            if (!base64) {
              setJarvisState('idle');
              return;
            }
            const res = await fetch('/api/jarvis/transcribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                audioBase64: base64,
                mimeType: recorder.mimeType || 'audio/webm',
              }),
            });
            const data = await res.json();
            if (!res.ok) {
              throw new Error(data.error || 'Voice transcription failed');
            }
            if (data.transcript) {
              await sendSpokenCommand(data.transcript);
            } else {
              setJarvisState('idle');
              setVoiceError('Did not catch that clearly. Tap the reactor to speak.');
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
  }, [jarvisState, playAudioPayload, sendSpokenCommand, stopSpeaking]);

  useEffect(() => {
    startListeningRef.current = startListening;
  }, [startListening]);

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
      {/* Floating Arc-Reactor Audio Launcher when minimized */}
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
            <div className="text-[11px] font-mono font-black tracking-wider text-white">
              MULLAH VOICE
            </div>
            <div className="text-[9px] font-mono text-[#0df2c9]/80">⌘J · Audio Mode</div>
          </div>
        </button>
      )}

      {/* Audio-Only Mullah Holographic Voice Console */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Mullah Audio Copilot"
          className="fixed bottom-4 right-4 z-50 w-[calc(100vw-2rem)] sm:w-[410px] max-h-[85vh] h-[610px] flex flex-col rounded-2xl bg-[#050c17]/96 border border-[#0df2c9]/50 shadow-[0_0_55px_rgba(13,242,201,0.24)] backdrop-blur-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200"
        >
          {/* HUD Top Header */}
          <div className="px-4 py-3 bg-gradient-to-r from-[#071526] via-[#091c2f] to-[#071526] border-b border-[#0df2c9]/25 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#0df2c9] animate-pulse" />
                <span className="text-xs font-mono font-black tracking-widest text-white">
                  MULLAH
                </span>
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
                    ? 'Listening'
                    : jarvisState === 'thinking'
                    ? 'Processing'
                    : jarvisState === 'speaking'
                    ? 'Speaking'
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
                onClick={() => setHandsFreeLoop((v) => !v)}
                title={handsFreeLoop ? 'Continuous Voice Loop: ON' : 'Continuous Voice Loop: OFF'}
                className={`px-2 py-1 rounded-lg border text-[9px] font-mono font-bold transition-colors cursor-pointer ${
                  handsFreeLoop
                    ? 'bg-[#0df2c9]/20 border-[#0df2c9]/50 text-[#0df2c9]'
                    : 'bg-[#0b1628] border-[#1b2e4b] text-slate-400 hover:text-white'
                }`}
              >
                {handsFreeLoop ? 'AUTO-MIC ON' : 'TAP-MIC'}
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
              <ArcReactorCore state={jarvisState} size={122} />
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
                  ? 'Listening... Speak your command'
                  : jarvisState === 'thinking'
                  ? 'Analyzing live markets & telemetry...'
                  : jarvisState === 'speaking'
                  ? 'Mullah is speaking (tap core to interrupt)'
                  : 'Tap Reactor to Speak'}
              </div>
              <div className="text-[10px] font-mono text-slate-400">
                Voice-Only Mode · Say &ldquo;Scan Gold 15M&rdquo;, &ldquo;Check Red News&rdquo;, or &ldquo;Open Bot Studio&rdquo;
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
                Finish Speaking
              </button>
            )}
          </div>

          {/* Live Spoken Transcript Feed (Read-only captions of Audio Exchange) */}
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

          {/* Voice Diagnostics Footer */}
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
