import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search,
  LayoutDashboard,
  Wallet,
  FileText,
  TrendingUp,
  BarChart2,
  Tv,
  Cpu,
  Flame,
  Bot,
  Zap,
  Layers,
  Smartphone,
  Shield,
  Target,
  CreditCard,
  Users,
  Calculator,
  CalendarClock,
  CalendarDays,
  Coins,
  Mic,
  ArrowRightLeft,
  Database,
  Plus,
  Volume2,
  X,
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext.tsx';
import { TabType } from '../../types/finance.ts';

interface PaletteAction {
  id: string;
  label: string;
  category: 'Navigation' | 'Mullah AI' | 'Quick Action';
  keywords: string;
  icon: React.ElementType;
  run: () => void;
}

export const OPEN_COMMAND_PALETTE_EVENT = 'njia-open-command-palette';

export const CommandPaletteModal: React.FC = () => {
  const {
    setActiveTab,
    setIsQuickAddOpen,
    setIsCurrencyConverterOpen,
    setIsBackupRestoreOpen,
  } = useFinance();

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      } else if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    const onOpenEvent = () => setIsOpen(true);

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, onOpenEvent);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, onOpenEvent);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [isOpen]);

  const actions: PaletteAction[] = useMemo(() => {
    const go = (tab: TabType) => {
      setActiveTab(tab);
      setIsOpen(false);
    };

    const runMullahCommand = (command: string) => {
      window.dispatchEvent(new CustomEvent('njia-mullah-run-command', { detail: { command } }));
      setIsOpen(false);
    };

    return [
      {
        id: 'mullah-briefing',
        label: 'Mullah: Speak Full App Briefing',
        category: 'Mullah AI',
        keywords: 'full report status briefing morning summary speak audio mullah',
        icon: Volume2,
        run: () => runMullahCommand('give me a full report'),
      },
      {
        id: 'mullah-toggle',
        label: 'Toggle Mullah Voice Copilot (⌘J)',
        category: 'Mullah AI',
        keywords: 'jarvis mullah voice mic assistant ai talk',
        icon: Mic,
        run: () => {
          window.dispatchEvent(new CustomEvent('njia-toggle-jarvis'));
          setIsOpen(false);
        },
      },
      {
        id: 'mullah-gold',
        label: 'Mullah: Scan Gold XAU/USD (15M)',
        category: 'Mullah AI',
        keywords: 'scan gold xauusd signal tradingview',
        icon: Flame,
        run: () => runMullahCommand('scan gold 15m'),
      },
      {
        id: 'quick-add',
        label: 'Quick Add Expense or Income',
        category: 'Quick Action',
        keywords: 'add expense income log transaction',
        icon: Plus,
        run: () => {
          setIsQuickAddOpen(true);
          setIsOpen(false);
        },
      },
      {
        id: 'converter',
        label: 'Open Live Currency Converter',
        category: 'Quick Action',
        keywords: 'currency converter fx usd kes eur gbp',
        icon: ArrowRightLeft,
        run: () => {
          setIsCurrencyConverterOpen(true);
          setIsOpen(false);
        },
      },
      {
        id: 'backup',
        label: 'Vault Backup & JSON Restore',
        category: 'Quick Action',
        keywords: 'backup export import restore data json',
        icon: Database,
        run: () => {
          setIsBackupRestoreOpen(true);
          setIsOpen(false);
        },
      },
      { id: 'tab-dashboard', label: 'Dashboard Overview', category: 'Navigation', keywords: 'home net worth summary', icon: LayoutDashboard, run: () => go('dashboard') },
      { id: 'tab-expenses', label: 'Expenses Tracker', category: 'Navigation', keywords: 'spending costs bills', icon: FileText, run: () => go('expenses') },
      { id: 'tab-income', label: 'Income Streams', category: 'Navigation', keywords: 'salary earnings revenue', icon: Wallet, run: () => go('income') },
      { id: 'tab-wallets', label: 'Accounts & Wallets', category: 'Navigation', keywords: 'bank mpesa cash balance wallets', icon: Coins, run: () => go('wallets') },
      { id: 'tab-bills', label: 'Upcoming Bills & Subscriptions', category: 'Navigation', keywords: 'bills rent recurring due', icon: CalendarClock, run: () => go('bills') },
      { id: 'tab-budget', label: 'Monthly Budgets', category: 'Navigation', keywords: 'budget limits category', icon: BarChart2, run: () => go('budget') },
      { id: 'tab-mpesa', label: 'M-Pesa SMS & PDF Statement Parser', category: 'Navigation', keywords: 'mpesa safaricom sms statement pdf', icon: Smartphone, run: () => go('mpesa') },
      { id: 'tab-stocks', label: 'Stocks & Forex Signals Radar', category: 'Navigation', keywords: 'markets tradingview radar signals gold forex crypto', icon: BarChart2, run: () => go('stocks') },
      { id: 'tab-gold-scalper', label: 'Gold Scalper Bot (MT5)', category: 'Navigation', keywords: 'gold scalper xauusd mt5', icon: Flame, run: () => go('gold-scalper') },
      { id: 'tab-bot-studio', label: 'Algorithmic Bot Studio (13 EAs)', category: 'Navigation', keywords: 'bots algorithmic ea deriv mt5', icon: Cpu, run: () => go('bot-studio') },
      { id: 'tab-mt5-ea', label: 'MT5 & Deriv Scalper Studio', category: 'Navigation', keywords: 'mt5 deriv mql5 generator', icon: Bot, run: () => go('mt5-ea') },
      { id: 'tab-forex-suite', label: 'Forex Quant & Prop Firm Suite', category: 'Navigation', keywords: 'prop firm guardian forex factory calendar', icon: Zap, run: () => go('forex-suite') },
      { id: 'tab-orderflow', label: 'Order Flow & Liquidity Radar', category: 'Navigation', keywords: 'order flow liquidity whale institutional', icon: Layers, run: () => go('orderflow') },
      { id: 'tab-livetv', label: 'Live TV, Bloomberg & World Monitor', category: 'Navigation', keywords: 'live tv bloomberg sky cnbc dw euronews radio', icon: Tv, run: () => go('livetv') },
      { id: 'tab-savings', label: 'Savings Goals', category: 'Navigation', keywords: 'goals targets savings', icon: Target, run: () => go('savings') },
      { id: 'tab-emergency', label: 'Emergency Fund', category: 'Navigation', keywords: 'emergency safety runway', icon: Shield, run: () => go('emergency') },
      { id: 'tab-investments', label: 'Investments Portfolio', category: 'Navigation', keywords: 'stocks mmf crypto portfolio', icon: TrendingUp, run: () => go('investments') },
      { id: 'tab-debt', label: 'Debt Payoff Tracker', category: 'Navigation', keywords: 'loans debt credit', icon: CreditCard, run: () => go('debt') },
      { id: 'tab-chama', label: 'Chama & Group Savings', category: 'Navigation', keywords: 'chama merry go round table banking', icon: Users, run: () => go('chama') },
      { id: 'tab-cashflow', label: '12-Month Cash Flow Forecast', category: 'Navigation', keywords: 'cashflow projection forecast', icon: CalendarDays, run: () => go('cashflow') },
      { id: 'tab-tax', label: 'KRA Tax & PAYE Calculator', category: 'Navigation', keywords: 'kra tax paye shif nssf housing levy', icon: Calculator, run: () => go('tax') },
      { id: 'tab-calculator', label: 'FIRE Financial Freedom Calculator', category: 'Navigation', keywords: 'fire retirement calculator', icon: Calculator, run: () => go('calculator') },
    ];
  }, [setActiveTab, setIsBackupRestoreOpen, setIsCurrencyConverterOpen, setIsQuickAddOpen]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return actions.slice(0, 12);
    return actions
      .filter((a) => `${a.label} ${a.category} ${a.keywords}`.toLowerCase().includes(q))
      .slice(0, 12);
  }, [actions, query]);

  if (!isOpen) return null;

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => (filtered.length > 0 ? (i + 1) % filtered.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => (filtered.length > 0 ? (i - 1 + filtered.length) % filtered.length : 0));
    } else if (e.key === 'Enter' && filtered[selectedIndex]) {
      e.preventDefault();
      filtered[selectedIndex].run();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-start justify-center pt-16 sm:pt-24 px-4"
      onClick={() => setIsOpen(false)}
    >
      <div
        className="w-full max-w-xl rounded-2xl bg-[#07111e] border border-[#1a2f4d] shadow-[0_24px_80px_rgba(0,0,0,0.75)] overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[#14253e]">
          <Search className="w-4 h-4 text-[#0df2c9] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleInputKeyDown}
            placeholder="Jump to workspace, ask Mullah for full report, open Live TV..."
            className="flex-1 bg-transparent text-sm text-white placeholder-slate-400 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
            aria-label="Close command palette"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-xs font-mono text-slate-400">
              No matching views or commands.
            </div>
          ) : (
            filtered.map((item, idx) => {
              const Icon = item.icon;
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={item.run}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[#0f243b] border border-[#0df2c9]/40 text-white'
                      : 'border border-transparent text-slate-300 hover:bg-[#0c1b2e]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-[#0df2c9]' : 'text-slate-400'}`} />
                    <span className="text-xs sm:text-sm font-medium truncate">{item.label}</span>
                  </div>
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[#0a1423] text-slate-400 shrink-0">
                    {item.category}
                  </span>
                </button>
              );
            })
          )}
        </div>

        <div className="px-4 py-2 bg-[#050c16] border-t border-[#14253e] flex items-center justify-between text-[10px] font-mono text-slate-500">
          <span>↑↓ Navigate · ↵ Run · Esc Close</span>
          <span>⌘K / Ctrl+K</span>
        </div>
      </div>
    </div>
  );
};
