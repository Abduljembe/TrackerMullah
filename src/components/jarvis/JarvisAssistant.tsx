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
  SlidersHorizontal,
  ClipboardList,
  Trash2,
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import {
  BillCategory,
  CurrencyCode,
  ExpenseItem,
  IncomeItem,
  SavingsGoal,
  TabType,
  WalletType,
} from '../../types/finance.ts';
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
import { parseMpesaSms } from '../../utils/mpesaParser.ts';
import { fetchSharedCalendarEvents, CalendarNewsEvent } from '../../utils/newsGuard.ts';
import {
  MullahMemoryProfile,
  loadLocalMullahMemory,
  hydrateMullahMemoryFromCloud,
  persistMullahMemoryToCloud,
} from '../../utils/mullahMemory.ts';

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
    | 'controlBot'
    | 'controlLiveTv'
    | 'manageFinance'
    | 'saveMemory';
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
  init: RequestInit,
  options?: { timeoutMs?: number; retries?: number }
): Promise<{ res: Response; data: T }> {
  const timeoutMs = options?.timeoutMs ?? 24000;
  const maxAttempts = (options?.retries ?? 1) + 1;
  let lastErr: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timer);
      const data = await parseJsonSafely<T>(res);
      if (attempt < maxAttempts - 1 && (res.status === 502 || res.status === 503 || res.status === 504)) {
        await new Promise((r) => setTimeout(r, 850));
        continue;
      }
      return { res, data };
    } catch (err) {
      lastErr = err;
      if (attempt < maxAttempts - 1) {
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

function parseSpokenFastCommand(
  rawText: string
):
  | {
      kind: 'liveTv';
      actions: JarvisAction[];
      spokenReply: string;
    }
  | {
      kind: 'navigate';
      tab: TabType;
      label: string;
    }
  | {
      kind: 'transaction';
      txType: 'expense' | 'income';
      amount: number;
      title: string;
    }
  | {
      kind: 'scan';
      symbol: string;
      timeframe: string;
    }
  | {
      kind: 'bot';
      action: 'START' | 'STOP';
      target: string;
    }
  | {
      kind: 'closeTrades';
      symbol: string;
    }
  | {
      kind: 'currency';
      currency: CurrencyCode;
    }
  | {
      kind: 'financeSummary';
    }
  | {
      kind: 'fullReport';
    }
  | null {
  const clean = rawText.trim();
  const lower = clean.toLowerCase().replace(/[?!.,]+$/g, '').trim();
  if (!lower) return null;

  // Never intercept analytical / open-ended questions — let Gemini AI answer those
  if (
    /^(what|why|how|who|when|where|which|explain|tell me about|compare|analyze|should i|can you explain|is it|are there)\b/i.test(
      lower
    )
  ) {
    return null;
  }

  // 1. Live TV Direct Voice Controls (0 API calls)
  const channelAliases: Array<[RegExp, string, string]> = [
    [/\bbloomberg\s+radio\b|\bradio\b/, 'radio', 'Bloomberg 24/7 Radio'],
    [/\bworld\s*monitor\b/, 'worldmonitor', 'World Monitor Terminal'],
    [/\bbloomberg\b/, 'bloomberg', 'Bloomberg TV'],
    [/\bsky(\s+news)?\b/, 'sky', 'Sky News'],
    [/\bdw(\s+news)?\b|\bdeutsche\s+welle\b/, 'dw', 'DW News'],
    [/\bfrance\s*24\b/, 'france24', 'France 24'],
    [/\byahoo(\s+finance)?\b/, 'yahoo', 'Yahoo Finance'],
    [/\bcnbc\b/, 'cnbc', 'CNBC TV18'],
    [/\beuronews\b/, 'euronews', 'Euronews Business'],
  ];

  const mentionsTvContext =
    /\b(live\s*tv|tv|channel|stream|broadcast|bloomberg|sky\s*news|france\s*24|euronews|cnbc|dw\s*news|world\s*monitor|radio|volume|mute|unmute|fullscreen|cinema)\b/i.test(
      lower
    );

  // Guard against unrelated sentences that happen to say "play" or "stop" with other finance/app objects
  if (
    mentionsTvContext ||
    /^(pause|stop|resume|play|mute|unmute|louder|quieter|volume\s+up|volume\s+down|turn\s+(up|down)(\s+the)?\s+(volume|sound)|next\s+channel)\b/i.test(
      lower
    )
  ) {
    // Only fast-path Live TV if it doesn't mention non-TV domains like "bot", "trade", "expense", "savings", "bill"
    if (!/\b(bot|ea|paper|trade|position|expense|income|bill|budget|goal|debt|wallet)\b/i.test(lower)) {
      const actions: JarvisAction[] = [];
      const summaries: string[] = [];

      for (const [re, chId, chLabel] of channelAliases) {
        if (re.test(lower) && /\b(switch|change|open|watch|play|put|show|turn|live\s*tv|tv|channel)\b/i.test(lower)) {
          actions.push({ type: 'controlLiveTv', payload: { action: 'SWITCH_CHANNEL', channel: chId } });
          summaries.push(`switched to ${chLabel}`);
          break;
        }
      }

      const volMatch = lower.match(/\bvolume\s*(?:to|at)?\s*(\d{1,3})\s*%?/i);
      if (volMatch) {
        const vol = Math.min(100, Math.max(0, Number(volMatch[1])));
        actions.push({ type: 'controlLiveTv', payload: { action: 'SET_VOLUME', volume: vol } });
        summaries.push(`volume set to ${vol} percent`);
      } else if (/\b(volume\s+up|increase\s+(?:the\s+)?volume|turn\s+(?:up\s+(?:the\s+)?volume|(?:the\s+)?volume\s+up)|raise\s+(?:the\s+)?volume|louder)\b/i.test(lower)) {
        actions.push({ type: 'controlLiveTv', payload: { action: 'VOLUME_UP' } });
        summaries.push('increased volume');
      } else if (/\b(volume\s+down|decrease\s+(?:the\s+)?volume|turn\s+(?:down\s+(?:the\s+)?volume|(?:the\s+)?volume\s+down)|lower\s+(?:the\s+)?volume|quieter)\b/i.test(lower)) {
        actions.push({ type: 'controlLiveTv', payload: { action: 'VOLUME_DOWN' } });
        summaries.push('lowered volume');
      }

      if (/\bunmute\b/i.test(lower)) {
        actions.push({ type: 'controlLiveTv', payload: { action: 'UNMUTE' } });
        summaries.push('unmuted audio');
      } else if (/\bmute\b/i.test(lower)) {
        actions.push({ type: 'controlLiveTv', payload: { action: 'MUTE' } });
        summaries.push('muted audio');
      }

      if (/\b(exit|close|leave)\s+(fullscreen|cinema)\b/i.test(lower)) {
        actions.push({ type: 'controlLiveTv', payload: { action: 'EXIT_FULLSCREEN' } });
        summaries.push('exited fullscreen');
      } else if (/\b(fullscreen|cinema\s*mode)\b/i.test(lower)) {
        actions.push({ type: 'controlLiveTv', payload: { action: 'FULLSCREEN' } });
        summaries.push('entered fullscreen');
      }

      if (/\bnext\s+channel\b/i.test(lower)) {
        actions.push({ type: 'controlLiveTv', payload: { action: 'NEXT_CHANNEL' } });
        summaries.push('switched to next channel');
      } else if (/\b(pause|stop)\b/i.test(lower)) {
        actions.push({ type: 'controlLiveTv', payload: { action: 'PAUSE' } });
        summaries.push('paused Live TV');
      } else if (/\b(resume|play)\b/i.test(lower) && actions.length === 0) {
        actions.push({ type: 'controlLiveTv', payload: { action: 'RESUME' } });
        summaries.push('resumed Live TV');
      } else if (/^(open|show|go\s+to|view)\s+(live\s*)?tv$/i.test(lower) && actions.length === 0) {
        actions.push({ type: 'controlLiveTv', payload: { action: 'OPEN_TV' } });
        summaries.push('opened Live TV');
      }

      if (actions.length > 0) {
        return {
          kind: 'liveTv',
          actions,
          spokenReply: `Done. Live TV ${summaries.join(' and ')}.`,
        };
      }
    }
  }

  // 2. Direct Navigation Fast-Path
  const navMatch = lower.match(/^(?:open|show|go\s+to|view|switch\s+to)\s+(?:my\s+)?(.+)$/i);
  if (navMatch) {
    const dest = navMatch[1].trim();
    const tabAliases: Array<[RegExp, TabType, string]> = [
      [/^dashboard|home|overview$/, 'dashboard', 'Dashboard'],
      [/^expenses?|spending$/, 'expenses', 'Expenses'],
      [/^incomes?|earnings$/, 'income', 'Income'],
      [/^bills?$/, 'bills', 'Bills'],
      [/^wallets?|accounts?$/, 'wallets', 'Wallets'],
      [/^budgets?$/, 'budget', 'Budgets'],
      [/^savings?(\s+goals?)?|goals?$/, 'savings', 'Savings Goals'],
      [/^emergency(\s+fund)?$/, 'emergency', 'Emergency Fund'],
      [/^investments?|portfolio$/, 'investments', 'Investments'],
      [/^debts?|loans?$/, 'debt', 'Debt Tracker'],
      [/^chamas?$/, 'chama', 'Chamas'],
      [/^m-?pesa(\s+auditor)?$/, 'mpesa', 'M-Pesa Auditor'],
      [/^tax(\s+planner)?$/, 'tax', 'Tax'],
      [/^reports?|statements?$/, 'reports', 'Reports'],
      [/^cashflow$/, 'cashflow', 'Cashflow'],
      [/^insights?|analytics$/, 'insights', 'Insights'],
      [/^stocks?|markets?|radar|charts?$/, 'stocks', 'Markets Radar'],
      [/^order\s*flow$/, 'orderflow', 'Order Flow'],
      [/^live\s*tv|tv$/, 'livetv', 'Live TV'],
      [/^bot\s*studio|bots?$/, 'bot-studio', 'Bot Studio'],
      [/^mt5(\s*ea)?|ea$/, 'mt5-ea', 'MT5 EA Studio'],
      [/^gold\s*scalper$/, 'gold-scalper', 'Gold Scalper'],
      [/^forex(\s*suite)?$/, 'forex-suite', 'Forex Suite'],
    ];
    for (const [re, tab, label] of tabAliases) {
      if (re.test(dest)) {
        return { kind: 'navigate', tab, label };
      }
    }
  }

  // 3. Direct Market Scan Fast-Path (e.g., "scan gold 15m", "scan eur usd 1h")
  const scanMatch = lower.match(
    /^scan\s+([a-z0-9/ ]+?)(?:\s+(?:on\s+)?(1m|5m|15m|30m|1h|4h|1d|1\s*minute|5\s*minutes?|15\s*minutes?|30\s*minutes?|1\s*hour|4\s*hours?|daily))?$/i
  );
  if (scanMatch) {
    const rawAsset = scanMatch[1].trim();
    const rawTf = (scanMatch[2] || '15M').toUpperCase().replace(/\s+/g, '');
    const tfMap: Record<string, string> = {
      '1MINUTE': '1M',
      '5MINUTE': '5M',
      '5MINUTES': '5M',
      '15MINUTE': '15M',
      '15MINUTES': '15M',
      '30MINUTE': '30M',
      '30MINUTES': '30M',
      '1HOUR': '1H',
      '4HOUR': '4H',
      '4HOURS': '4H',
      DAILY: '1D',
    };
    const tf = tfMap[rawTf] || rawTf;
    const symNorm = rawAsset.toUpperCase().replace(/\s+/g, '');
    const symMap: Record<string, string> = {
      GOLD: 'XAU/USD',
      XAUUSD: 'XAU/USD',
      SILVER: 'XAG/USD',
      XAGUSD: 'XAG/USD',
      BITCOIN: 'BTC/USD',
      BTC: 'BTC/USD',
      BTCUSD: 'BTC/USD',
      ETHEREUM: 'ETH/USD',
      ETH: 'ETH/USD',
      ETHUSD: 'ETH/USD',
      EURUSD: 'EUR/USD',
      GBPUSD: 'GBP/USD',
      USDJPY: 'USD/JPY',
      USDKES: 'USD/KES',
      NAS100: 'NAS100',
      NASDAQ: 'NAS100',
      US30: 'US30',
      SP500: 'US500',
    };
    const symbol = symMap[symNorm] || (symNorm.length === 6 ? `${symNorm.slice(0, 3)}/${symNorm.slice(3)}` : symNorm);
    return { kind: 'scan', symbol, timeframe: tf };
  }

  // 4. Direct Single Expense / Income Logging Fast-Path
  if (!/\band\b/i.test(lower)) {
    const expMatch =
      lower.match(
        /^(?:add|log|record)\s+(?:an?\s+)?expense\s+(?:of\s+)?(?:[$€£]|kes|usd|eur|gbp)?\s*(\d+(?:\.\d+)?)\s*(?:dollars?|usd|kes|shillings?|euros?|eur|pounds?|gbp)?\s*(?:for|on)?\s+(.+)$/i
      ) ||
      lower.match(
        /^(?:i\s+)?spent\s+(?:[$€£]|kes|usd)?\s*(\d+(?:\.\d+)?)\s*(?:dollars?|usd|kes|shillings?)?\s*(?:on|for)\s+(.+)$/i
      );
    if (expMatch) {
      const amount = Number(expMatch[1]);
      const title = expMatch[2].trim();
      if (amount > 0 && title.length >= 2) {
        return {
          kind: 'transaction',
          txType: 'expense',
          amount,
          title: title.charAt(0).toUpperCase() + title.slice(1),
        };
      }
    }

    const incMatch = lower.match(
      /^(?:add|log|record)\s+(?:an?\s+)?income\s+(?:of\s+)?(?:[$€£]|kes|usd|eur|gbp)?\s*(\d+(?:\.\d+)?)\s*(?:dollars?|usd|kes|shillings?|euros?|eur|pounds?|gbp)?\s*(?:from|for)?\s+(.+)$/i
    );
    if (incMatch) {
      const amount = Number(incMatch[1]);
      const title = incMatch[2].trim();
      if (amount > 0 && title.length >= 2) {
        return {
          kind: 'transaction',
          txType: 'income',
          amount,
          title: title.charAt(0).toUpperCase() + title.slice(1),
        };
      }
    }
  }

  // 5. Bot & Position & Currency Fast-Path
  if (/^stop\s+all\s+bots?$/i.test(lower)) return { kind: 'bot', action: 'STOP', target: 'ALL' };
  if (/^start\s+bot\s*studio$/i.test(lower)) return { kind: 'bot', action: 'START', target: 'BOT_STUDIO' };
  if (/^stop\s+bot\s*studio$/i.test(lower)) return { kind: 'bot', action: 'STOP', target: 'BOT_STUDIO' };
  if (/^start\s+mt5(\s*ea)?$/i.test(lower)) return { kind: 'bot', action: 'START', target: 'MT5_EA' };
  if (/^stop\s+mt5(\s*ea)?$/i.test(lower)) return { kind: 'bot', action: 'STOP', target: 'MT5_EA' };
  if (/^close\s+all(\s+paper)?\s+(positions?|trades?)$/i.test(lower)) {
    return { kind: 'closeTrades', symbol: 'ALL' };
  }
  const curMatch = lower.match(/^(?:switch|set|change)\s+currency\s+(?:to\s+)?(kes|usd|eur|gbp)$/i);
  if (curMatch) {
    return { kind: 'currency', currency: curMatch[1].toUpperCase() as CurrencyCode };
  }
  if (/^(?:view|check|show|review)\s+(?:my\s+)?finances?$/i.test(lower) || /^(?:my\s+)?net\s*worth$/i.test(lower)) {
    return { kind: 'financeSummary' };
  }
  if (
    /\b(full\s+report|morning\s+briefing|daily\s+briefing|app\s+report|status\s+report|everything\s+going\s+on|full\s+briefing|brief\s+me)\b/i.test(
      lower
    )
  ) {
    return { kind: 'fullReport' };
  }

  return null;
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
  return `${timeOfDay}. Mullah is online with full command. ${marketNote} ${posNote} ${propNote} Ask me any question, add an expense, control Live TV, scan markets, or manage your bots.`
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
    incomes,
    expenses,
    budgets,
    savingsGoals,
    debts,
    bills,
    wallets,
    addExpense,
    deleteExpense,
    addIncome,
    deleteIncome,
    setCategoryBudget,
    addSavingsGoal,
    depositToGoal,
    addInvestment,
    addDebt,
    recordDebtPayment,
    depositToEmergencyFund,
    addChama,
    addBill,
    markBillPaid,
    addWallet,
    transferBetweenWallets,
    refreshApp,
    setIsQuickAddOpen,
    setIsCurrencyConverterOpen,
    isCloudSyncing,
  } = useFinance();

  const { user } = useAuth();

  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

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
  // 'auto' uses Gemini Neural Voice with automatic Unlimited Local Speech fallback; 'unlimited' always uses 0-quota local speech
  const [voiceEngineMode, setVoiceEngineMode] = useState<'auto' | 'unlimited'>('auto');
  const [showVoiceSettings, setShowVoiceSettings] = useState<boolean>(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState<boolean>(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [mullahMemory, setMullahMemory] = useState<MullahMemoryProfile>(() => loadLocalMullahMemory(null));
  const mullahMemoryRef = useRef<MullahMemoryProfile>(mullahMemory);
  mullahMemoryRef.current = mullahMemory;
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const calendarEventsRef = useRef<CalendarNewsEvent[]>([]);

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
  const activeUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const speechKeepAliveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingWelcomeAudioRef = useRef<{ base64: string; mimeType: string } | null>(null);
  const pendingSpeechRef = useRef<{ text: string; triggerAutoListenAfter: boolean } | null>(null);
  const hasUserGestureRef = useRef<boolean>(false);
  const justFlushedAudioAtRef = useRef<number>(0);
  const availableVoicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const clientTtsCacheRef = useRef<Map<string, { base64: string; mimeType: string }>>(new Map());
  const cloudTtsCooldownUntilRef = useRef<number>(
    (() => {
      try {
        return Number(localStorage.getItem('njia_cloud_tts_cooldown_until') || '0') || 0;
      } catch {
        return 0;
      }
    })()
  );
  const voiceEngineModeRef = useRef<'auto' | 'unlimited'>(voiceEngineMode);
  voiceEngineModeRef.current = voiceEngineMode;
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
      if (speechKeepAliveRef.current) {
        clearInterval(speechKeepAliveRef.current);
        speechKeepAliveRef.current = null;
      }
      activeUtteranceRef.current = null;
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

  // Hydrate persistent Mullah memory from local storage + Firestore when user signs in
  useEffect(() => {
    const uid = user?.uid || null;
    setMullahMemory(loadLocalMullahMemory(uid));
    if (uid && user?.provider === 'firebase') {
      hydrateMullahMemoryFromCloud(uid)
        .then((profile) => setMullahMemory(profile))
        .catch(() => {});
    }
  }, [user]);

  const updateMullahMemory = useCallback(
    (updater: (prev: MullahMemoryProfile) => MullahMemoryProfile) => {
      setMullahMemory((prev) => {
        const next = updater(prev);
        persistMullahMemoryToCloud(next, user?.provider === 'firebase' ? user.uid : user?.uid || null).catch(() => {});
        return next;
      });
    },
    [user]
  );

  // Duck Live TV / Bloomberg Radio volume automatically while Mullah listens or speaks
  useEffect(() => {
    const shouldDuck = jarvisState === 'listening' || jarvisState === 'speaking';
    window.dispatchEvent(new CustomEvent('njia-livetv-duck', { detail: { duck: shouldDuck } }));
  }, [jarvisState]);

  // Preload browser speech voices & check backend capability cleanly (prevents stale hangs on Vercel)
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const refreshVoices = () => {
        try {
          const list = window.speechSynthesis.getVoices();
          if (list && list.length > 0) {
            availableVoicesRef.current = list;
            setAvailableVoices(list);
          }
        } catch {}
      };
      refreshVoices();
      window.speechSynthesis.addEventListener?.('voiceschanged', refreshVoices);
    }

    // Load upcoming economic calendar events in background for full opening briefing
    fetchSharedCalendarEvents()
      .then((evs) => {
        if (Array.isArray(evs)) calendarEventsRef.current = evs;
      })
      .catch(() => {});

    // Fast capability probe so deployments without GEMINI_API_KEY skip cloud TTS latency immediately
    const probeController = new AbortController();
    const probeTimer = setTimeout(() => probeController.abort(), 3000);
    fetch('/api/health', { signal: probeController.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((info) => {
        clearTimeout(probeTimer);
        if (info && info.geminiConfigured === false) {
          const until = Date.now() + 30 * 60 * 1000;
          cloudTtsCooldownUntilRef.current = until;
          try {
            localStorage.setItem('njia_cloud_tts_cooldown_until', String(until));
          } catch {}
        }
      })
      .catch(() => {
        clearTimeout(probeTimer);
      });
  }, []);

  const stopSpeaking = useCallback(() => {
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current = null;
    }
    if (speechKeepAliveRef.current) {
      clearInterval(speechKeepAliveRef.current);
      speechKeepAliveRef.current = null;
    }
    activeUtteranceRef.current = null;
    try {
      if (window.speechSynthesis && (window.speechSynthesis.speaking || window.speechSynthesis.pending)) {
        window.speechSynthesis.cancel();
      }
    } catch {}
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

  const speakWithBrowserSynthesis = useCallback((text: string, triggerAutoListenAfter = true): boolean => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setJarvisState('idle');
      return false;
    }
    const cleanText = text
      .replace(/[*_`#>]/g, '')
      .replace(/\[(.*?)\]\(.*?\)/g, '$1')
      .replace(/\s+/g, ' ')
      .trim();
    if (!cleanText) {
      setJarvisState('idle');
      return false;
    }

    try {
      const synth = window.speechSynthesis;
      if (speechKeepAliveRef.current) {
        clearInterval(speechKeepAliveRef.current);
        speechKeepAliveRef.current = null;
      }

      const utter = new SpeechSynthesisUtterance(cleanText);
      activeUtteranceRef.current = utter;

      const voices = availableVoicesRef.current.length > 0 ? availableVoicesRef.current : synth.getVoices();
      const mem = mullahMemoryRef.current;
      const explicitVoice =
        mem.voiceName && mem.voiceName !== 'auto'
          ? voices.find((v) => v.name === mem.voiceName)
          : undefined;
      const localEnglish = voices.filter((v) => v.lang.toLowerCase().startsWith('en') && v.localService !== false);
      const anyEnglish = voices.filter((v) => v.lang.toLowerCase().startsWith('en'));
      const preferred =
        explicitVoice ||
        localEnglish.find((v) => /daniel|samantha|alex|arthur|george|ryan|mark|david|karen|google/i.test(v.name)) ||
        localEnglish.find((v) => v.default) ||
        localEnglish[0] ||
        anyEnglish.find((v) => v.default) ||
        anyEnglish[0];
      if (preferred) {
        utter.voice = preferred;
        utter.lang = preferred.lang;
      } else {
        utter.lang = 'en-US';
      }
      utter.rate = typeof mem.voiceRate === 'number' ? mem.voiceRate : 1.02;
      utter.pitch = 0.96;
      utter.volume = 1;

      let didStart = false;
      let didFinish = false;

      const clearUtterTimers = () => {
        if (speechKeepAliveRef.current) {
          clearInterval(speechKeepAliveRef.current);
          speechKeepAliveRef.current = null;
        }
      };

      utter.onstart = () => {
        didStart = true;
        pendingSpeechRef.current = null;
        setAutoplayBlocked(false);
        setJarvisState('speaking');
        // Keep Chrome desktop/Android SpeechSynthesis active on longer spoken replies
        clearUtterTimers();
        speechKeepAliveRef.current = setInterval(() => {
          try {
            if (synth.paused) synth.resume();
          } catch {}
        }, 7000);
      };

      utter.onend = () => {
        if (didFinish) return;
        didFinish = true;
        clearUtterTimers();
        if (activeUtteranceRef.current === utter) {
          activeUtteranceRef.current = null;
        }
        setJarvisState('idle');
        if (triggerAutoListenAfter && handsFreeLoopRef.current) {
          setTimeout(() => {
            startListeningRef.current();
          }, 260);
        }
      };

      utter.onerror = (event: SpeechSynthesisErrorEvent) => {
        if (didFinish) return;
        didFinish = true;
        clearUtterTimers();
        if (activeUtteranceRef.current === utter) {
          activeUtteranceRef.current = null;
        }
        const errType = String(event?.error || '').toLowerCase();
        if (errType === 'not-allowed' || (!hasUserGestureRef.current && !didStart)) {
          pendingSpeechRef.current = { text: cleanText, triggerAutoListenAfter };
          setAutoplayBlocked(true);
        }
        setJarvisState('idle');
      };

      const dispatchSpeak = () => {
        try {
          if (synth.paused) synth.resume();
          setJarvisState('speaking');
          synth.speak(utter);

          // Watchdog: Safari/iOS/Chrome silently drop un-gestured boot speech without always firing onerror
          setTimeout(() => {
            if (!didStart && !didFinish && activeUtteranceRef.current === utter) {
              const active = synth.speaking || synth.pending;
              if (!active) {
                clearUtterTimers();
                activeUtteranceRef.current = null;
                pendingSpeechRef.current = { text: cleanText, triggerAutoListenAfter };
                setAutoplayBlocked(true);
                setJarvisState('idle');
              }
            }
          }, 450);
        } catch {
          clearUtterTimers();
          activeUtteranceRef.current = null;
          pendingSpeechRef.current = { text: cleanText, triggerAutoListenAfter };
          setAutoplayBlocked(true);
          setJarvisState('idle');
        }
      };

      // Only cancel if already speaking/queued; synchronous speak() preserves mobile Safari user gesture
      if (synth.speaking || synth.pending) {
        synth.cancel();
        setTimeout(dispatchSpeak, 45);
      } else {
        dispatchSpeak();
      }
      return true;
    } catch {
      pendingSpeechRef.current = { text: cleanText, triggerAutoListenAfter };
      setAutoplayBlocked(true);
      setJarvisState('idle');
      return false;
    }
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
        pendingWelcomeAudioRef.current = null;
        setAutoplayBlocked(false);
        return true;
      } catch (err: unknown) {
        activeAudioRef.current = null;
        setJarvisState('idle');
        const msg = err instanceof Error ? err.message : String(err || '');
        if (
          msg.toLowerCase().includes('notallowed') ||
          msg.toLowerCase().includes('gesture') ||
          msg.toLowerCase().includes('interact') ||
          !hasUserGestureRef.current
        ) {
          pendingWelcomeAudioRef.current = { base64: audioBase64, mimeType };
          setAutoplayBlocked(true);
          return false;
        }
        return false;
      }
    },
    [stopSpeaking]
  );

  const flushPendingSpeechOnGesture = useCallback(() => {
    hasUserGestureRef.current = true;
    try {
      window.speechSynthesis?.resume();
    } catch {}

    if (pendingWelcomeAudioRef.current) {
      const pendingAudio = pendingWelcomeAudioRef.current;
      pendingWelcomeAudioRef.current = null;
      justFlushedAudioAtRef.current = Date.now();
      setAutoplayBlocked(false);
      playAudioPayload(pendingAudio.base64, pendingAudio.mimeType, true);
      return true;
    }

    if (pendingSpeechRef.current) {
      const pendingText = pendingSpeechRef.current;
      pendingSpeechRef.current = null;
      justFlushedAudioAtRef.current = Date.now();
      setAutoplayBlocked(false);
      speakWithBrowserSynthesis(pendingText.text, pendingText.triggerAutoListenAfter);
      return true;
    }

    return false;
  }, [playAudioPayload, speakWithBrowserSynthesis]);

  // First user tap/click/key anywhere unlocks browser audio on HTTPS/Vercel immediately
  useEffect(() => {
    const onFirstUserGesture = () => {
      hasUserGestureRef.current = true;
      if (pendingWelcomeAudioRef.current || pendingSpeechRef.current) {
        flushPendingSpeechOnGesture();
      }
    };
    window.addEventListener('pointerdown', onFirstUserGesture, { passive: true });
    window.addEventListener('keydown', onFirstUserGesture, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', onFirstUserGesture);
      window.removeEventListener('keydown', onFirstUserGesture);
    };
  }, [flushPendingSpeechOnGesture]);

  const speakText = useCallback(
    async (text: string, triggerAutoListenAfter = true) => {
      stopSpeaking();
      setVoiceError(null);
      const normalizedKey = text.trim().toLowerCase();

      // Use instant Unlimited Browser Speech when selected OR during cloud TTS cooldown
      if (voiceEngineModeRef.current === 'unlimited' || Date.now() < cloudTtsCooldownUntilRef.current) {
        speakWithBrowserSynthesis(text, triggerAutoListenAfter);
        return;
      }

      // Check client cache first (0 API calls)
      const cachedClient = clientTtsCacheRef.current.get(normalizedKey);
      if (cachedClient) {
        await playAudioPayload(cachedClient.base64, cachedClient.mimeType, triggerAutoListenAfter);
        return;
      }

      setJarvisState('speaking');
      try {
        const { res, data } = await fetchJsonWithRetry<{
          audioBase64?: string;
          mimeType?: string;
          fallbackLocalTts?: boolean;
          cooldownRemainingMs?: number;
          error?: string;
        }>(
          '/api/jarvis/speak',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text }),
          },
          { timeoutMs: 4500, retries: 0 }
        );

        if (!res.ok || data.fallbackLocalTts || !data.audioBase64) {
          const cooldownMs = Number(data.cooldownRemainingMs || 300000);
          const until = Date.now() + cooldownMs;
          cloudTtsCooldownUntilRef.current = until;
          try {
            localStorage.setItem('njia_cloud_tts_cooldown_until', String(until));
          } catch {}
          speakWithBrowserSynthesis(text, triggerAutoListenAfter);
          return;
        }

        if (clientTtsCacheRef.current.size < 40) {
          clientTtsCacheRef.current.set(normalizedKey, {
            base64: data.audioBase64,
            mimeType: data.mimeType || 'audio/wav',
          });
        }
        await playAudioPayload(data.audioBase64, data.mimeType || 'audio/wav', triggerAutoListenAfter);
      } catch {
        const until = Date.now() + 180000;
        cloudTtsCooldownUntilRef.current = until;
        try {
          localStorage.setItem('njia_cloud_tts_cooldown_until', String(until));
        } catch {}
        speakWithBrowserSynthesis(text, triggerAutoListenAfter);
      }
    },
    [playAudioPayload, speakWithBrowserSynthesis, stopSpeaking]
  );

  // Full Spoken App Report across Personal Finance, Bills, Budgets, Markets, Positions, Prop Guardian & Red News
  const buildFullAppBriefing = useCallback(() => {
    const hour = new Date().getHours();
    const timeOfDay = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    const parts: string[] = [`${timeOfDay}. Mullah is online with your full app report.`];

    // 1. Personal Finance
    const nw = Math.round(netWorth).toLocaleString();
    const liq = Math.round(totalLiquidBalance).toLocaleString();
    const inc = Math.round(totalMonthlyIncome).toLocaleString();
    const exp = Math.round(totalMonthlyExpenses).toLocaleString();
    parts.push(
      `Finances: net worth is ${nw} ${currency}, liquid cash balance is ${liq}, monthly income is ${inc}, expenses are ${exp}, and your health score is ${financialHealth.score} out of 100.`
    );

    // 2. Upcoming Bills & Budgets
    const unpaidBills = bills.filter((b) => b.status !== 'paid');
    if (unpaidBills.length > 0) {
      const nextBill = [...unpaidBills].sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
      const unpaidTotal = Math.round(unpaidBills.reduce((s, b) => s + (Number(b.amount) || 0), 0)).toLocaleString();
      parts.push(
        `Bills: ${unpaidBills.length} unpaid bill${unpaidBills.length > 1 ? 's' : ''} totaling ${unpaidTotal} ${currency}; next due is ${nextBill.title} on ${nextBill.dueDate}.`
      );
    } else {
      parts.push('Bills: all recorded bills are up to date.');
    }

    const overBudget = budgets.filter((b) => {
      if (!b.monthlyLimit || b.monthlyLimit <= 0) return false;
      const spent = expenses
        .filter((e) => e.category.toLowerCase() === b.category.toLowerCase())
        .reduce((s, e) => s + (Number(e.amount) || 0), 0);
      return spent >= b.monthlyLimit * 0.85;
    });
    if (overBudget.length > 0) {
      parts.push(
        `Budget alert: ${overBudget
          .slice(0, 2)
          .map((b) => b.category)
          .join(' and ')} ${overBudget.length > 1 ? 'are' : 'is'} near or over limit.`
      );
    }

    // 3. Investments, Goals & Debt
    if (totalInvestments > 0 || totalDebt > 0 || savingsGoals.length > 0) {
      parts.push(
        `Wealth: ${Math.round(totalInvestments).toLocaleString()} ${currency} in investments, ${savingsGoals.length} active savings goal${savingsGoals.length === 1 ? '' : 's'}, and ${Math.round(totalDebt).toLocaleString()} ${currency} in debt.`
      );
    }

    // 4. Trading Desk, Live Quotes, Paper Positions, Tracked Signals & Prop Guardian
    const fxOpen = getAssetMarketSession('EUR/USD', 'FOREX').isOpen;
    const goldQ = lookupTradingViewQuote(liveTvQuotesRef.current, 'XAU/USD');
    const btcQ = lookupTradingViewQuote(liveTvQuotesRef.current, 'BTC/USD');
    const openPositions = loadOpenPaperPositions();
    const activeSignals = loadTrackedSignals().filter((s) => s.status === 'ACTIVE' || s.status === 'TP1_HIT');
    const propGuard = evaluatePropTradeBlock(loadPropConfig());

    const quoteSnips: string[] = [];
    if (goldQ?.price) quoteSnips.push(`Gold at ${goldQ.price.toFixed(2)}`);
    if (btcQ?.price) quoteSnips.push(`Bitcoin at ${Math.round(btcQ.price).toLocaleString()}`);

    const marketLine = fxOpen
      ? `Markets are live${quoteSnips.length ? ` with ${quoteSnips.join(' and ')}` : ''}.`
      : `Traditional Forex is closed for the weekend while crypto and synthetics run 24/7${quoteSnips.length ? `, with ${quoteSnips.join(' and ')}` : ''}.`;
    parts.push(marketLine);

    if (openPositions.length > 0 || activeSignals.length > 0) {
      const floatPnl = openPositions.reduce((s, p) => s + (Number(p.pnl) || 0), 0);
      parts.push(
        `Trading desk: ${openPositions.length} open position${openPositions.length === 1 ? '' : 's'} with ${floatPnl >= 0 ? 'profit' : 'drawdown'} ${Math.round(floatPnl)} USD, and ${activeSignals.length} active tracked signal${activeSignals.length === 1 ? '' : 's'}.`
      );
    }

    if (propGuard.blocked) {
      parts.push(`Risk warning: Prop Firm Guardian lockout is active.`);
    }

    // 5. Upcoming High-Impact Red News
    const upcomingHigh = calendarEventsRef.current.find(
      (e) => e.impact === 'HIGH' && e.isUpcoming
    );
    if (upcomingHigh) {
      parts.push(
        `Macro calendar: next high-impact news is ${upcomingHigh.currency} ${upcomingHigh.title} at ${upcomingHigh.time}.`
      );
    }

    // 6. Remembered notes teaser
    const memNotes = mullahMemoryRef.current.notes || [];
    if (memNotes.length > 0) {
      parts.push(`Saved reminder: ${memNotes[0].text}.`);
    }

    parts.push('Tap the reactor or ask me anything to begin.');
    return parts.join(' ').replace(/\s+/g, ' ').trim();
  }, [
    bills,
    budgets,
    currency,
    expenses,
    financialHealth.score,
    netWorth,
    savingsGoals.length,
    totalDebt,
    totalInvestments,
    totalLiquidBalance,
    totalMonthlyExpenses,
    totalMonthlyIncome,
  ]);

  const buildFullAppBriefingRef = useRef(buildFullAppBriefing);
  buildFullAppBriefingRef.current = buildFullAppBriefing;

  // Opening automatic Full App Report after initial finance/Firestore hydration settles
  useEffect(() => {
    if (hasBootGreetedRef.current || isCloudSyncing) return;

    const timer = setTimeout(async () => {
      if (hasBootGreetedRef.current) return;
      hasBootGreetedRef.current = true;

      try {
        const evs = await Promise.race([
          fetchSharedCalendarEvents(),
          new Promise<CalendarNewsEvent[]>((resolve) => setTimeout(() => resolve([]), 900)),
        ]);
        if (Array.isArray(evs) && evs.length > 0) {
          calendarEventsRef.current = evs;
        }
      } catch {}

      const reportText =
        mullahMemoryRef.current.briefingMode === 'concise'
          ? buildWelcomeGreeting()
          : buildFullAppBriefingRef.current();

      setMessages((prev) =>
        prev.map((m) =>
          m.id === 'jarvis-boot'
            ? {
                ...m,
                text: reportText,
                actionsExecuted:
                  mullahMemoryRef.current.briefingMode === 'concise'
                    ? m.actionsExecuted
                    : ['Opening App Report'],
              }
            : m
        )
      );
      speakText(reportText, true);
    }, 650);

    return () => clearTimeout(timer);
  }, [isCloudSyncing, speakText]);

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
        wallets: wallets.slice(0, 10).map((w) => ({
          id: w.id,
          name: w.name,
          type: w.type,
          balance: Math.round(w.balance),
        })),
        bills: bills.slice(0, 10).map((b) => ({
          id: b.id,
          title: b.title,
          amount: b.amount,
          dueDate: b.dueDate,
          status: b.status,
        })),
        savingsGoals: savingsGoals.slice(0, 8).map((g) => ({
          id: g.id,
          title: g.title,
          current: g.currentAmount,
          target: g.targetAmount,
        })),
        debts: debts.slice(0, 8).map((d) => ({
          id: d.id,
          name: d.name,
          remaining: d.remainingAmount,
        })),
        budgets: budgets.slice(0, 10).map((b) => ({
          category: b.category,
          monthlyLimit: b.monthlyLimit,
        })),
        recentExpenses: expenses.slice(0, 8).map((e) => ({
          id: e.id,
          title: e.title,
          amount: e.amount,
          category: e.category,
          date: e.date,
        })),
        recentIncomes: incomes.slice(0, 5).map((i) => ({
          id: i.id,
          source: i.source,
          amount: i.amount,
          date: i.date,
        })),
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
      mullahMemory: {
        briefingMode: mullahMemory.briefingMode,
        favoriteChannel: mullahMemory.favoriteChannel,
        preferredRiskPct: mullahMemory.preferredRiskPct,
        notes: (mullahMemory.notes || []).slice(0, 10).map((n) => n.text),
      },
    };
  }, [
    activeTab,
    bills,
    budgets,
    currency,
    debts,
    expenses,
    financialHealth.score,
    financialHealth.status,
    incomes,
    mullahMemory,
    netWorth,
    savingsGoals,
    savingsRate,
    totalDebt,
    totalEmergencyFund,
    totalInvestments,
    totalLiquidBalance,
    totalMonthlyExpenses,
    totalMonthlyIncome,
    wallets,
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
              const rawIncCat = String(p.category || title || '').toLowerCase();
              let cat: IncomeItem['category'] = INCOME_CATEGORIES.has(p.category as IncomeItem['category'])
                ? (p.category as IncomeItem['category'])
                : 'Other';
              if (cat === 'Other') {
                if (rawIncCat.includes('salar') || rawIncCat.includes('pay') || rawIncCat.includes('wage')) cat = 'Salary';
                else if (rawIncCat.includes('bus') || rawIncCat.includes('profit') || rawIncCat.includes('trade')) cat = 'Business';
                else if (rawIncCat.includes('free') || rawIncCat.includes('consult') || rawIncCat.includes('gig')) cat = 'Freelance';
                else if (rawIncCat.includes('side') || rawIncCat.includes('hustle')) cat = 'Side Hustle';
                else if (rawIncCat.includes('divid') || rawIncCat.includes('interest')) cat = 'Dividends';
                else if (rawIncCat.includes('rent')) cat = 'Rental';
              }
              const rawPm = String(p.paymentMethod || '').toLowerCase();
              const pm: IncomeItem['paymentMethod'] = rawPm.includes('bank')
                ? 'Bank Transfer'
                : rawPm.includes('cash')
                ? 'Cash'
                : rawPm.includes('sacco')
                ? 'SACCO'
                : rawPm.includes('other')
                ? 'Other'
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
              const rawExpCat = `${String(p.category || '')} ${title}`.toLowerCase();
              let cat: ExpenseItem['category'] = EXPENSE_CATEGORIES.has(p.category as ExpenseItem['category'])
                ? (p.category as ExpenseItem['category'])
                : 'Other';
              if (cat === 'Other') {
                if (rawExpCat.includes('rent') || rawExpCat.includes('hous') || rawExpCat.includes('mort')) cat = 'Rent & Housing';
                else if (rawExpCat.includes('food') || rawExpCat.includes('grocer') || rawExpCat.includes('coffee') || rawExpCat.includes('drink') || rawExpCat.includes('lunch') || rawExpCat.includes('breakfast')) cat = 'Food & Groceries';
                else if (rawExpCat.includes('transport') || rawExpCat.includes('fuel') || rawExpCat.includes('uber') || rawExpCat.includes('bolt') || rawExpCat.includes('taxi') || rawExpCat.includes('matatu')) cat = 'Transport & Fuel';
                else if (rawExpCat.includes('util') || rawExpCat.includes('bill') || rawExpCat.includes('power') || rawExpCat.includes('water') || rawExpCat.includes('wifi') || rawExpCat.includes('internet')) cat = 'Utilities & Bills';
                else if (rawExpCat.includes('entertain') || rawExpCat.includes('dining') || rawExpCat.includes('dinner') || rawExpCat.includes('movie') || rawExpCat.includes('club')) cat = 'Entertainment & Dining';
                else if (rawExpCat.includes('health') || rawExpCat.includes('med') || rawExpCat.includes('hosp') || rawExpCat.includes('pharm')) cat = 'Healthcare';
                else if (rawExpCat.includes('edu') || rawExpCat.includes('school') || rawExpCat.includes('tuition') || rawExpCat.includes('book')) cat = 'Education';
                else if (rawExpCat.includes('family') || rawExpCat.includes('support') || rawExpCat.includes('gift')) cat = 'Family & Support';
                else if (rawExpCat.includes('shop') || rawExpCat.includes('cloth') || rawExpCat.includes('mall')) cat = 'Shopping';
              }
              const rawPm = String(p.paymentMethod || '').toLowerCase();
              const pm: ExpenseItem['paymentMethod'] = rawPm.includes('card')
                ? 'Card'
                : rawPm.includes('cash')
                ? 'Cash'
                : rawPm.includes('bank')
                ? 'Bank'
                : rawPm.includes('other')
                ? 'Other'
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
        } else if (action.type === 'controlLiveTv') {
          const tvAct = String(p.action || 'OPEN_TV').toUpperCase().trim();
          const tvPayload = {
            action: tvAct,
            ...(p.channel ? { channel: String(p.channel) } : {}),
            ...(p.volume !== undefined ? { volume: Number(p.volume) } : {}),
            ...(p.mode ? { mode: String(p.mode).toLowerCase() } : {}),
          };

          if (tvAct === 'OPEN_TV' && !p.channel && !p.mode && p.volume === undefined) {
            setActiveTab('livetv');
            executedLabels.push('Live TV Opened');
          } else {
            if (activeTabRef.current === 'livetv') {
              window.dispatchEvent(new CustomEvent('njia-livetv-control', { detail: tvPayload }));
            } else {
              try {
                const existingRaw = sessionStorage.getItem('njia_pending_livetv_control');
                const existing = existingRaw ? JSON.parse(existingRaw) : [];
                const queue = Array.isArray(existing) ? existing : existing ? [existing] : [];
                queue.push(tvPayload);
                sessionStorage.setItem('njia_pending_livetv_control', JSON.stringify(queue));
              } catch {}
              setActiveTab('livetv');
              setTimeout(() => {
                try {
                  const stillPending = sessionStorage.getItem('njia_pending_livetv_control');
                  if (stillPending) {
                    sessionStorage.removeItem('njia_pending_livetv_control');
                    const parsed = JSON.parse(stillPending);
                    const items = Array.isArray(parsed) ? parsed : [parsed];
                    for (const item of items) {
                      if (item) window.dispatchEvent(new CustomEvent('njia-livetv-control', { detail: item }));
                    }
                  }
                } catch {}
              }, 220);
            }
            const labelParts = [tvAct];
            if (p.channel) labelParts.push(String(p.channel));
            if (p.volume !== undefined) labelParts.push(`${p.volume}%`);
            if (p.mode) labelParts.push(String(p.mode));
            executedLabels.push(`Live TV: ${labelParts.join(' · ')}`);
          }
        } else if (action.type === 'manageFinance') {
          const op = String(p.operation || '').toUpperCase().trim();
          const today = new Date().toISOString().split('T')[0];
          const amount = Number(p.amount || 0);
          const targetAmount = Number(p.targetAmount || p.amount || 0);
          const title = String(p.title || p.targetName || 'Mullah Entry').trim();
          const query = String(p.targetName || p.title || '').toLowerCase().trim();

          const resolveExpensePm = (raw?: unknown): ExpenseItem['paymentMethod'] => {
            const s = String(raw || '').toLowerCase();
            if (s.includes('card')) return 'Card';
            if (s.includes('cash')) return 'Cash';
            if (s.includes('bank')) return 'Bank';
            if (s.includes('mpesa') || s.includes('m-pesa')) return 'M-Pesa';
            return 'M-Pesa';
          };

          if (op === 'ADD_BILL' && amount > 0) {
            const rawCat = String(p.category || '').toLowerCase();
            let billCat: BillCategory = 'Other';
            if (rawCat.includes('power') || rawCat.includes('kplc') || rawCat.includes('electr')) billCat = 'Utilities & Power (KPLC)';
            else if (rawCat.includes('water')) billCat = 'Water & Sanitation';
            else if (rawCat.includes('wifi') || rawCat.includes('internet') || rawCat.includes('data')) billCat = 'Internet & WiFi';
            else if (rawCat.includes('rent') || rawCat.includes('hous')) billCat = 'Rent & Housing';
            else if (rawCat.includes('stream') || rawCat.includes('sub') || rawCat.includes('netflix')) billCat = 'Subscriptions & Streaming';
            else if (rawCat.includes('insur')) billCat = 'Insurance';
            else if (rawCat.includes('chama')) billCat = 'Chama & Welfare';

            const freq = p.frequency === 'weekly' || p.frequency === 'yearly' || p.frequency === 'one-time' ? p.frequency : 'monthly';
            const dueDate = p.dueDate ? String(p.dueDate) : new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
            addBill({
              title,
              amount,
              dueDate,
              category: billCat,
              frequency: freq,
              notes: 'Added via Mullah Voice',
            });
            executedLabels.push(`Bill Added: ${title} (${amount})`);
          } else if (op === 'PAY_BILL') {
            const unpaid = bills.filter((b) => b.status !== 'paid');
            const match =
              (query && query !== 'last'
                ? unpaid.find((b) => b.id === query || b.title.toLowerCase().includes(query))
                : unpaid[0]) || unpaid[0];
            if (match) {
              markBillPaid(match.id, resolveExpensePm(p.paymentMethod));
              executedLabels.push(`Bill Paid: ${match.title}`);
            } else {
              executedLabels.push('No unpaid bill matched');
            }
          } else if (op === 'DELETE_EXPENSE') {
            const match =
              !query || query === 'last'
                ? expenses[0]
                : expenses.find((e) => e.id === query || e.title.toLowerCase().includes(query));
            if (match) {
              deleteExpense(match.id);
              executedLabels.push(`Deleted Expense: ${match.title}`);
            } else {
              executedLabels.push('No matching expense found');
            }
          } else if (op === 'DELETE_INCOME') {
            const match =
              !query || query === 'last'
                ? incomes[0]
                : incomes.find((i) => i.id === query || i.source.toLowerCase().includes(query));
            if (match) {
              deleteIncome(match.id);
              executedLabels.push(`Deleted Income: ${match.source}`);
            } else {
              executedLabels.push('No matching income found');
            }
          } else if (op === 'SET_BUDGET' && (amount > 0 || targetAmount > 0)) {
            const cat = String(p.category || title || 'Other');
            setCategoryBudget(cat, amount > 0 ? amount : targetAmount);
            executedLabels.push(`Budget Set: ${cat} (${amount > 0 ? amount : targetAmount})`);
          } else if (op === 'ADD_SAVINGS_GOAL' && (targetAmount > 0 || amount > 0)) {
            const goalTarget = targetAmount > 0 ? targetAmount : amount;
            const rawCat = String(p.category || '').toLowerCase();
            let goalCat: SavingsGoal['category'] = 'Other';
            if (rawCat.includes('land') || rawCat.includes('prop') || rawCat.includes('house')) goalCat = 'Land & Property';
            else if (rawCat.includes('car') || rawCat.includes('vehic')) goalCat = 'Vehicle';
            else if (rawCat.includes('wed')) goalCat = 'Wedding';
            else if (rawCat.includes('bus') || rawCat.includes('cap')) goalCat = 'Business Capital';
            else if (rawCat.includes('trav') || rawCat.includes('trip')) goalCat = 'Travel';
            else if (rawCat.includes('edu') || rawCat.includes('school')) goalCat = 'Education';
            else if (rawCat.includes('tech') || rawCat.includes('gadg') || rawCat.includes('phone') || rawCat.includes('laptop')) goalCat = 'Gadget / Tech';
            else if (rawCat.includes('emerg')) goalCat = 'Emergency';

            addSavingsGoal({
              title,
              targetAmount: goalTarget,
              deadline: p.dueDate ? String(p.dueDate) : new Date(Date.now() + 180 * 86400000).toISOString().split('T')[0],
              category: goalCat,
              color: '#0df2c9',
            });
            executedLabels.push(`Goal Added: ${title} (${goalTarget})`);
          } else if (op === 'DEPOSIT_SAVINGS_GOAL' && amount > 0) {
            const match =
              query && query !== 'last'
                ? savingsGoals.find((g) => g.id === query || g.title.toLowerCase().includes(query))
                : savingsGoals[0];
            if (match) {
              depositToGoal(match.id, amount);
              executedLabels.push(`Goal +${amount}: ${match.title}`);
            } else {
              executedLabels.push('No matching savings goal found');
            }
          } else if (op === 'ADD_DEBT' && (targetAmount > 0 || amount > 0)) {
            const principal = targetAmount > 0 ? targetAmount : amount;
            addDebt({
              name: title,
              lender: String(p.lender || title),
              principal,
              remainingAmount: principal,
              interestRatePercent: Number(p.interestRate || 12),
              minimumMonthlyPayment: amount > 0 && amount < principal ? amount : Math.max(1, Math.round(principal * 0.1)),
              dueDate: p.dueDate ? String(p.dueDate) : new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
              category: 'Personal',
            });
            executedLabels.push(`Debt Added: ${title} (${principal})`);
          } else if (op === 'PAY_DEBT' && amount > 0) {
            const match =
              query && query !== 'last'
                ? debts.find((d) => d.id === query || d.name.toLowerCase().includes(query) || d.lender.toLowerCase().includes(query))
                : debts[0];
            if (match) {
              recordDebtPayment(match.id, amount);
              executedLabels.push(`Debt Paid -${amount}: ${match.name}`);
            } else {
              executedLabels.push('No matching debt found');
            }
          } else if (op === 'DEPOSIT_EMERGENCY_FUND' && amount > 0) {
            depositToEmergencyFund(amount);
            executedLabels.push(`Emergency Fund +${amount}`);
          } else if (op === 'ADD_WALLET') {
            const rawWt = String(p.walletType || '').toLowerCase();
            let wt: WalletType = 'Other';
            if (rawWt.includes('mpesa') || rawWt.includes('m-pesa')) wt = 'M-PESA';
            else if (rawWt.includes('bank')) wt = 'Bank Account';
            else if (rawWt.includes('sacco')) wt = 'SACCO FOSA';
            else if (rawWt.includes('cash')) wt = 'Cash / Physical';
            else if (rawWt.includes('card')) wt = 'Credit Card';
            else if (rawWt.includes('crypto')) wt = 'Crypto Wallet';

            addWallet({
              name: title,
              type: wt,
              balance: Number.isFinite(amount) ? amount : 0,
              color: '#0df2c9',
              notes: 'Created via Mullah Voice',
            });
            executedLabels.push(`Wallet Added: ${title}`);
          } else if (op === 'TRANSFER_WALLETS' && amount > 0) {
            const fromQ = String(p.fromWallet || '').toLowerCase().trim();
            const toQ = String(p.toWallet || '').toLowerCase().trim();
            const fromW = wallets.find((w) => w.id === fromQ || w.name.toLowerCase().includes(fromQ));
            const toW = wallets.find((w) => w.id === toQ || w.name.toLowerCase().includes(toQ));
            if (fromW && toW && fromW.id !== toW.id) {
              const ok = transferBetweenWallets({
                fromWalletId: fromW.id,
                toWalletId: toW.id,
                amount,
                fee: Number(p.fee || 0),
                notes: 'Transfer via Mullah Voice',
                date: today,
              });
              executedLabels.push(ok ? `Transfer ${amount}: ${fromW.name} -> ${toW.name}` : 'Wallet transfer failed');
            } else {
              executedLabels.push('Specify two valid wallets to transfer');
            }
          } else if (op === 'ADD_INVESTMENT' && amount > 0) {
            addInvestment({
              name: title,
              assetClass: 'Other',
              currentValue: amount,
              investedAmount: amount,
              expectedAnnualYieldPercent: Number(p.interestRate || 10),
              provider: String(p.lender || 'Portfolio'),
            });
            executedLabels.push(`Investment Added: ${title} (${amount})`);
          } else if (op === 'ADD_CHAMA' && amount > 0) {
            addChama({
              name: title,
              contributionAmount: amount,
              frequency: p.frequency === 'weekly' || p.frequency === 'bi-weekly' ? p.frequency : 'monthly',
              totalMembers: 10,
              payoutDate: p.dueDate ? String(p.dueDate) : new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0],
              payoutAmount: amount * 10,
              type: 'Merry-Go-Round',
              notes: 'Added via Mullah Voice',
            });
            executedLabels.push(`Chama Added: ${title}`);
          } else if (op === 'REFRESH_APP') {
            await refreshApp();
            executedLabels.push('Live App & FX Refreshed');
          } else if (op === 'OPEN_QUICK_ADD') {
            setIsQuickAddOpen(true);
            executedLabels.push('Quick Add Opened');
          } else if (op === 'OPEN_CURRENCY_CONVERTER') {
            setIsCurrencyConverterOpen(true);
            executedLabels.push('Currency Converter Opened');
          }
        } else if (action.type === 'saveMemory') {
          const noteText = p.note ? String(p.note).trim() : '';
          const favCh = p.favoriteChannel ? String(p.favoriteChannel).trim() : '';
          const riskPct = p.preferredRiskPct !== undefined ? Number(p.preferredRiskPct) : undefined;
          const bMode = p.briefingMode === 'concise' ? 'concise' : p.briefingMode === 'full' ? 'full' : undefined;
          updateMullahMemory((prev) => ({
            ...prev,
            ...(favCh ? { favoriteChannel: favCh } : {}),
            ...(riskPct !== undefined && Number.isFinite(riskPct) && riskPct > 0 ? { preferredRiskPct: riskPct } : {}),
            ...(bMode ? { briefingMode: bMode } : {}),
            notes: noteText
              ? [{ id: `note-${Date.now()}`, text: noteText, createdAt: new Date().toISOString() }, ...prev.notes].slice(0, 30)
              : prev.notes,
          }));
          executedLabels.push(noteText ? `Remembered: ${noteText.slice(0, 24)}` : 'Preferences Saved');
        }
      }

      return executedLabels;
    },
    [
      addBill,
      addChama,
      addDebt,
      addExpense,
      addIncome,
      addInvestment,
      addSavingsGoal,
      addWallet,
      bills,
      debts,
      deleteExpense,
      deleteIncome,
      depositToEmergencyFund,
      depositToGoal,
      expenses,
      incomes,
      markBillPaid,
      recordDebtPayment,
      refreshApp,
      savingsGoals,
      setActiveTab,
      setCategoryBudget,
      setCurrency,
      setIsCurrencyConverterOpen,
      setIsQuickAddOpen,
      transferBetweenWallets,
      updateMullahMemory,
      wallets,
    ]
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
      // Probe ephemeral Live API endpoint on serverless hosts (e.g. Vercel) before attempting WebSocket upgrade
      const tokenProbe = await fetch('/api/jarvis/live-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appSnapshot: buildAppSnapshot() }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(
        tokenProbe?.token
          ? `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained?access_token=${encodeURIComponent(tokenProbe.token)}`
          : `${protocol}//${window.location.host}/ws/mullah-live`
      );
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

      // ZERO-QUOTA INSTANT FAST-PATH: Handle Live TV, Navigation, Clear Market Scans, Quick Expense/Income, Bots & Currency locally in <5ms
      const localFast = parseSpokenFastCommand(trimmed);
      if (localFast) {
        let localActions: JarvisAction[] = [];
        let replyText = 'Done.';

        if (localFast.kind === 'liveTv') {
          localActions = localFast.actions;
          replyText = localFast.spokenReply;
        } else if (localFast.kind === 'navigate') {
          localActions = [{ type: 'navigate', payload: { tab: localFast.tab } }];
          replyText = `Opened ${localFast.label}.`;
        } else if (localFast.kind === 'transaction') {
          localActions = [
            {
              type: 'logTransaction',
              payload: {
                transactionType: localFast.txType,
                title: localFast.title,
                amount: localFast.amount,
              },
            },
          ];
          replyText = `Recorded ${localFast.txType} of ${localFast.amount} ${currency} for ${localFast.title}.`;
        } else if (localFast.kind === 'bot') {
          localActions = [{ type: 'controlBot', payload: { action: localFast.action, target: localFast.target } }];
          replyText = `${localFast.target === 'ALL' ? 'All trading bots' : localFast.target} ${
            localFast.action === 'STOP' ? 'stopped' : 'started'
          }.`;
        } else if (localFast.kind === 'closeTrades') {
          localActions = [{ type: 'closePaperPositions', payload: { symbol: localFast.symbol } }];
          replyText = 'Closed matching open paper positions.';
        } else if (localFast.kind === 'currency') {
          localActions = [{ type: 'setCurrency', payload: { currency: localFast.currency } }];
          replyText = `Switched currency to ${localFast.currency}.`;
        } else if (localFast.kind === 'financeSummary') {
          localActions = [{ type: 'navigate', payload: { tab: 'dashboard' } }];
          replyText = `Your net worth is ${Math.round(netWorth).toLocaleString()} ${currency}. Monthly income is ${Math.round(totalMonthlyIncome).toLocaleString()}, monthly expenses are ${Math.round(totalMonthlyExpenses).toLocaleString()}, liquid balance is ${Math.round(totalLiquidBalance).toLocaleString()}, and your financial health score is ${financialHealth.score} out of 100.`;
        } else if (localFast.kind === 'fullReport') {
          localActions = [{ type: 'navigate', payload: { tab: 'dashboard' } }];
          replyText = buildFullAppBriefing();
        } else if (localFast.kind === 'scan') {
          const spot = resolveTradingViewPrice(liveTvQuotesRef.current, localFast.symbol, 0);
          const q = lookupTradingViewQuote(liveTvQuotesRef.current, localFast.symbol);
          const session = getAssetMarketSession(localFast.symbol);
          localActions = [
            { type: 'focusAsset', payload: { symbol: localFast.symbol, timeframe: localFast.timeframe } },
          ];
          if (spot > 0) {
            const levels = computeTimeframeSignalLevels({
              symbol: localFast.symbol,
              spotPrice: spot,
              timeframe: localFast.timeframe,
              quote: q,
              market: localFast.symbol.includes('XAU') ? 'METALS' : localFast.symbol.includes('BTC') ? 'CRYPTO' : 'FOREX',
            });
            replyText = `${localFast.symbol} on ${localFast.timeframe} is ${
              session.isOpen ? 'live' : 'weekend frozen'
            } at ${spot}. Signal is ${levels.action}, entry ${levels.entryZone}, stop loss ${levels.sl}, TP1 ${levels.tp1}, TP2 ${levels.tp2}, risk reward ${levels.riskReward}.`;
          } else {
            replyText = `Focused radar on ${localFast.symbol} ${localFast.timeframe}.`;
          }
        }

        if (localActions.length > 0) {
          const actionsExecuted = await executeJarvisActions(localActions);
          setMessages((prev) => [
            ...prev,
            {
              id: `jrv-fast-${Date.now()}`,
              role: 'assistant',
              text: replyText,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              actionsExecuted: [...actionsExecuted, 'Instant 0-Quota'],
            },
          ]);
          await speakText(replyText, true);
          return;
        }
      }

      // Smart M-Pesa SMS / confirmation auto-parser (logs amount, merchant & tariff fee locally with 0 API calls)
      const parsedSms = /\b(confirmed|m-?pesa|ksh)\b/i.test(trimmed) ? parseMpesaSms(trimmed) : null;
      if (parsedSms) {
        const isInflow = parsedSms.type === 'received';
        const mpesaActions: JarvisAction[] = [
          {
            type: 'logTransaction',
            payload: {
              transactionType: isInflow ? 'income' : 'expense',
              title: parsedSms.counterparty || 'M-Pesa Transaction',
              amount: parsedSms.amount,
              category: parsedSms.suggestedCategory || 'Other',
              paymentMethod: 'M-Pesa',
            },
          },
        ];
        if (!isInflow && parsedSms.fee && parsedSms.fee > 0) {
          mpesaActions.push({
            type: 'logTransaction',
            payload: {
              transactionType: 'expense',
              title: `M-Pesa Fee (${parsedSms.counterparty})`,
              amount: parsedSms.fee,
              category: 'Utilities & Bills',
              paymentMethod: 'M-Pesa',
            },
          });
        }
        const actionsExecuted = await executeJarvisActions(mpesaActions);
        const smsReply = `Parsed M-Pesa confirmation ${parsedSms.refCode}. Logged ${parsedSms.amount} KES ${
          isInflow ? 'received from' : 'paid to'
        } ${parsedSms.counterparty}${
          parsedSms.fee ? ` plus ${parsedSms.fee} KES fee` : ''
        }.`;
        setMessages((prev) => [
          ...prev,
          {
            id: `jrv-mpesa-${Date.now()}`,
            role: 'assistant',
            text: smsReply,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            actionsExecuted: [...actionsExecuted, 'M-Pesa Smart Parser'],
          },
        ]);
        await speakText(smsReply, true);
        return;
      }

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
        const rawErr = err instanceof Error ? err.message : 'Unable to reach Mullah voice servers.';
        const isQuota = rawErr.toLowerCase().includes('rate limit') || rawErr.includes('429');
        const isMissingKey = rawErr.toLowerCase().includes('not configured') || rawErr.includes('GEMINI_KEY_MISSING');
        const errMsg = isQuota
          ? 'Cloud AI quota is cooling down for a few seconds. Direct Live TV, market scans, navigation, and quick expense voice commands remain unlimited.'
          : isMissingKey
          ? 'Live TV, finance logging, market scans, and voice playback are active locally. Add GEMINI_API_KEY in this host environment Secrets to unlock cloud Gemini AI Q&A.'
          : rawErr;
        setVoiceError(errMsg);
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.isError && last.text === errMsg) {
            return prev;
          }
          return [
            ...prev,
            {
              id: `err-${Date.now()}`,
              role: 'assistant',
              text: errMsg,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              isError: true,
            },
          ];
        });
        if (isQuota || isMissingKey) {
          speakWithBrowserSynthesis(errMsg, false);
        }
      }
    },
    [
      buildAppSnapshot,
      currency,
      executeJarvisActions,
      financialHealth.score,
      jarvisState,
      messages,
      netWorth,
      speakText,
      speakWithBrowserSynthesis,
      stopSpeaking,
      totalLiquidBalance,
      totalMonthlyExpenses,
      totalMonthlyIncome,
    ]
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
    hasUserGestureRef.current = true;

    if (pendingWelcomeAudioRef.current || pendingSpeechRef.current) {
      flushPendingSpeechOnGesture();
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
  }, [flushPendingSpeechOnGesture, jarvisState, liveStreamMode, sendSpokenCommand, startLiveAudioSession, stopSpeaking]);

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
    // Ignore the synthetic click event if the preceding pointerdown just unlocked & started pending audio
    if (Date.now() - justFlushedAudioAtRef.current < 450) {
      return;
    }
    if (jarvisState === 'listening') {
      stopListening();
    } else if (jarvisState === 'speaking') {
      stopSpeaking();
    } else {
      startListening();
    }
  };

  const triggerFullAppBriefing = useCallback(() => {
    hasUserGestureRef.current = true;
    const reportText = buildFullAppBriefing();
    setMessages((prev) => [
      ...prev,
      {
        id: `jrv-report-${Date.now()}`,
        role: 'assistant',
        text: reportText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        actionsExecuted: ['Full App Report'],
      },
    ]);
    speakText(reportText, true);
  }, [buildFullAppBriefing, speakText]);

  // Listen to triggers from MobileBottomNav mic button & Cmd+K Command Palette
  useEffect(() => {
    const onActivateMic = () => {
      hasUserGestureRef.current = true;
      setIsOpen(true);
      setTimeout(() => startListeningRef.current(), 60);
    };
    const onRunCommand = (evt: Event) => {
      hasUserGestureRef.current = true;
      const cmd = (evt as CustomEvent<{ command?: string }>).detail?.command?.trim();
      if (!cmd) return;
      setIsOpen(true);
      setTimeout(() => sendSpokenCommand(cmd), 60);
    };
    window.addEventListener('njia-mullah-activate-mic', onActivateMic);
    window.addEventListener('njia-mullah-run-command', onRunCommand);
    return () => {
      window.removeEventListener('njia-mullah-activate-mic', onActivateMic);
      window.removeEventListener('njia-mullah-run-command', onRunCommand);
    };
  }, [sendSpokenCommand]);

  const handleResetSession = () => {
    hasUserGestureRef.current = true;
    stopSpeaking();
    stopListening();
    const reportText =
      mullahMemoryRef.current.briefingMode === 'concise'
        ? buildWelcomeGreeting()
        : buildFullAppBriefing();
    setMessages([
      {
        id: `jarvis-reset-${Date.now()}`,
        role: 'assistant',
        text: reportText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        actionsExecuted: mullahMemoryRef.current.briefingMode === 'concise' ? undefined : ['Full App Report'],
      },
    ]);
    speakText(reportText, true);
  };

  const isForexOpen = getAssetMarketSession('EUR/USD', 'FOREX').isOpen;

  return (
    <>
      {!isOpen && (
        <button
          type="button"
          onClick={() => {
            setIsOpen(true);
            flushPendingSpeechOnGesture();
          }}
          title="Open Mullah Voice Copilot (Ctrl/Cmd + J)"
          className="fixed bottom-20 md:bottom-5 right-4 md:right-5 z-40 group flex items-center gap-2.5 pl-2.5 pr-4 py-2 rounded-full bg-[#07111e]/95 hover:bg-[#0b1a2d] border border-[#0df2c9]/50 hover:border-[#0df2c9] shadow-[0_0_26px_rgba(13,242,201,0.3)] backdrop-blur-md transition-all cursor-pointer active:scale-95"
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
                onClick={() => setVoiceEngineMode((m) => (m === 'auto' ? 'unlimited' : 'auto'))}
                title={
                  voiceEngineMode === 'unlimited'
                    ? 'Unlimited Local Speech Synthesis (0 cloud voice quota used)'
                    : 'Auto Voice: Neural Audio with automatic Unlimited Local fallback'
                }
                className={`px-2 py-1 rounded-lg border text-[9px] font-mono font-bold transition-colors cursor-pointer ${
                  voiceEngineMode === 'unlimited'
                    ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300'
                    : 'bg-[#0b1628] border-[#1b2e4b] text-slate-300 hover:text-white'
                }`}
              >
                {voiceEngineMode === 'unlimited' ? 'UNL VOICE' : 'AUTO VOICE'}
              </button>

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
                onClick={triggerFullAppBriefing}
                title="Speak full live app report across finances, markets & news"
                className="p-1.5 rounded-lg bg-[#0b1628] border border-[#1b2e4b] text-[#0df2c9] hover:text-white transition-colors cursor-pointer"
              >
                <ClipboardList className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => setShowVoiceSettings((v) => !v)}
                title="Voice settings, speed & saved memory"
                className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                  showVoiceSettings
                    ? 'bg-[#0df2c9]/20 border-[#0df2c9]/50 text-[#0df2c9]'
                    : 'bg-[#0b1628] border-[#1b2e4b] text-slate-400 hover:text-white'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
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
                title="Replay full briefing & reset audio session"
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

          {/* Voice Preferences & Persistent Cloud Memory Drawer */}
          {showVoiceSettings && (
            <div className="px-3.5 py-3 bg-[#061120] border-b border-[#142642] space-y-2.5 text-[11px] font-mono">
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-400">Voice:</span>
                <select
                  value={mullahMemory.voiceName}
                  onChange={(e) => updateMullahMemory((p) => ({ ...p, voiceName: e.target.value }))}
                  className="flex-1 max-w-[230px] bg-[#0a1628] border border-[#1a2e4a] rounded-lg px-2 py-1 text-slate-200 text-[10px] focus:outline-none focus:border-[#0df2c9]"
                >
                  <option value="auto">Auto Best English Voice</option>
                  {availableVoices
                    .filter((v) => v.lang.toLowerCase().startsWith('en'))
                    .slice(0, 20)
                    .map((v) => (
                      <option key={`${v.name}-${v.lang}`} value={v.name}>
                        {v.name} ({v.lang})
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-400">Speed: {mullahMemory.voiceRate.toFixed(2)}x</span>
                <div className="flex items-center gap-1">
                  {[0.9, 1.02, 1.15, 1.25].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => updateMullahMemory((p) => ({ ...p, voiceRate: r }))}
                      className={`px-2 py-0.5 rounded border text-[10px] cursor-pointer ${
                        Math.abs(mullahMemory.voiceRate - r) < 0.03
                          ? 'bg-[#0df2c9]/20 border-[#0df2c9]/50 text-[#0df2c9]'
                          : 'bg-[#0a1628] border-[#1a2e4a] text-slate-400 hover:text-white'
                      }`}
                    >
                      {r}x
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-400">On Launch:</span>
                <div className="flex items-center gap-1">
                  {(['full', 'concise'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => updateMullahMemory((p) => ({ ...p, briefingMode: mode }))}
                      className={`px-2 py-0.5 rounded border text-[10px] capitalize cursor-pointer ${
                        mullahMemory.briefingMode === mode
                          ? 'bg-[#0df2c9]/20 border-[#0df2c9]/50 text-[#0df2c9]'
                          : 'bg-[#0a1628] border-[#1a2e4a] text-slate-400 hover:text-white'
                      }`}
                    >
                      {mode === 'full' ? 'Full Report' : 'Quick Hello'}
                    </button>
                  ))}
                </div>
              </div>

              {mullahMemory.notes.length > 0 && (
                <div className="pt-1.5 border-t border-[#142642] space-y-1 max-h-24 overflow-y-auto">
                  <div className="text-[10px] text-[#0df2c9]">Saved Cloud Memory ({mullahMemory.notes.length}):</div>
                  {mullahMemory.notes.slice(0, 4).map((note) => (
                    <div key={note.id} className="flex items-center justify-between gap-2 text-[10px] text-slate-300">
                      <span className="truncate">{note.text}</span>
                      <button
                        type="button"
                        onClick={() =>
                          updateMullahMemory((p) => ({
                            ...p,
                            notes: p.notes.filter((n) => n.id !== note.id),
                          }))
                        }
                        className="text-slate-500 hover:text-rose-400 shrink-0 cursor-pointer"
                        title="Remove saved note"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

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
                  ? 'Tap to Enable Mullah Audio'
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
                Try: &ldquo;Switch Live TV to Sky News &amp; volume 80%&rdquo;, &ldquo;Add 45 USD coffee expense&rdquo;, &ldquo;Ask me anything&rdquo;, or &ldquo;Scan Gold 15M&rdquo;
              </div>
            </div>

            {autoplayBlocked && (
              <button
                type="button"
                onClick={() => flushPendingSpeechOnGesture()}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#0df2c9]/20 border border-[#0df2c9]/60 text-[10px] font-mono font-bold text-[#0df2c9] hover:bg-[#0df2c9]/30 animate-pulse cursor-pointer"
              >
                <Volume2 className="w-3 h-3" />
                Tap to Hear Mullah Speak
              </button>
            )}

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
