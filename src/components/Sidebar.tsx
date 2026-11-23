import React, { useState } from 'react';
import {
  LayoutDashboard,
  Lightbulb,
  Wallet,
  FileText,
  SlidersHorizontal,
  Target,
  Shield,
  TrendingUp,
  CreditCard,
  Calculator,
  BarChart2,
  X,
  Compass,
  Lock,
  LogOut,
  User as UserIcon,
  Smartphone,
  Users,
  Award,
  CalendarDays,
  RotateCcw,
  ArrowRightLeft,
  CalendarClock,
  Coins,
  Database,
  Download,
  Layers,
  Tv,
  Bot,
  Zap,
  Cpu,
  Flame,
  PanelLeftClose,
} from 'lucide-react';
import { useFinance } from '../context/FinanceContext.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { TabType } from '../types/finance.ts';
import { AppLogo } from './common/AppLogo.tsx';
import { PWAInstallButton } from './pwa/PWAInstallButton.tsx';

interface NavItem {
  id: TabType;
  label: string;
  icon: React.ElementType;
}

interface NavGroup {
  group: string;
  items: NavItem[];
}

interface SidebarProps {
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  collapsed?: boolean;
  setCollapsed?: (collapsed: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  mobileOpen,
  setMobileOpen,
  collapsed = false,
  setCollapsed,
}) => {
  const {
    activeTab,
    setActiveTab,
    currency,
    currencySymbol,
    setCurrency,
    setIsClearDataModalOpen,
    setIsCurrencyConverterOpen,
    setIsBackupRestoreOpen,
  } = useFinance();
  const { user, setIsAuthModalOpen, setAuthMode, logout } = useAuth();

  const [workspaceMode, setWorkspaceMode] = useState<'all' | 'finance' | 'trading'>(() => {
    try {
      const saved = localStorage.getItem('njia_workspace_mode');
      return saved === 'finance' || saved === 'trading' ? saved : 'all';
    } catch {
      return 'all';
    }
  });

  const handleWorkspaceChange = (mode: 'all' | 'finance' | 'trading') => {
    setWorkspaceMode(mode);
    try {
      localStorage.setItem('njia_workspace_mode', mode);
    } catch {}
  };

  const PRO_TRADING_TABS = new Set<TabType>([
    'gold-scalper',
    'stocks',
    'bot-studio',
    'mt5-ea',
    'forex-suite',
    'orderflow',
    'livetv',
  ]);

  const navGroups: NavGroup[] = [
    {
      group: 'OVERVIEW',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'insights', label: 'Insights', icon: Lightbulb },
        { id: 'cashflow', label: 'Cash Flow Forecast', icon: CalendarDays },
      ],
    },
    {
      group: 'PERSONAL FINANCE',
      items: [
        { id: 'income', label: 'Income', icon: Wallet },
        { id: 'expenses', label: 'Expenses', icon: FileText },
        { id: 'wallets', label: 'Accounts & Wallets', icon: Coins },
        { id: 'bills', label: 'Upcoming Bills & Subs', icon: CalendarClock },
        { id: 'budget', label: 'Budget', icon: SlidersHorizontal },
        { id: 'mpesa', label: 'M-Pesa SMS Parser', icon: Smartphone },
        { id: 'savings', label: 'Savings Goals', icon: Target },
        { id: 'emergency', label: 'Emergency Fund', icon: Shield },
        { id: 'investments', label: 'Investments', icon: TrendingUp },
        { id: 'debt', label: 'Debt Tracker', icon: CreditCard },
        { id: 'chama', label: 'Chama & Groups', icon: Users },
        { id: 'milestones', label: 'Milestones & Badges', icon: Award },
      ],
    },
    {
      group: 'PRO TRADING & LIVE TV',
      items: [
        { id: 'stocks', label: 'Stocks & Forex Signals', icon: BarChart2 },
        { id: 'gold-scalper', label: 'Gold Scalper Bot (MT5)', icon: Flame },
        { id: 'bot-studio', label: 'Algorithmic Bot Studio (13 EAs)', icon: Cpu },
        { id: 'mt5-ea', label: 'MT5 & Deriv Scalper Studio', icon: Bot },
        { id: 'forex-suite', label: 'Forex Quant & Prop Firm Suite', icon: Zap },
        { id: 'orderflow', label: 'Order Flow & Liquidity', icon: Layers },
        { id: 'livetv', label: 'Live TV & World Monitor', icon: Tv },
      ],
    },
    {
      group: 'TOOLS & REPORTS',
      items: [
        { id: 'sacco-mmf', label: 'SACCO & MMF Yields', icon: TrendingUp },
        { id: 'tax', label: 'KRA Tax & PAYE', icon: Calculator },
        { id: 'calculator', label: 'FF Calculator', icon: Compass },
        { id: 'reports', label: 'Reports', icon: BarChart2 },
      ],
    },
  ];

  const visibleNavGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (workspaceMode === 'all') return true;
        if (workspaceMode === 'finance') return !PRO_TRADING_TABS.has(item.id);
        return PRO_TRADING_TABS.has(item.id) || item.id === 'dashboard' || item.id === 'reports';
      }),
    }))
    .filter((group) => group.items.length > 0);

  const handleSelectTab = (tab: TabType) => {
    setActiveTab(tab);
    setMobileOpen(false);
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#0b111c] border-r border-[#152033] text-slate-300 w-64 lg:w-60 xl:w-64 select-none">
      {/* Brand Header */}
      <div className="px-4 py-3.5 flex items-center justify-between gap-2 border-b border-[#141e30]/80">
        <AppLogo size="md" subtext="Your financial journey" />
        {mobileOpen && (
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/60 cursor-pointer"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        )}
        {!mobileOpen && setCollapsed && (
          <button
            type="button"
            onClick={() => {
              setCollapsed(true);
              try {
                localStorage.setItem('njia_sidebar_collapsed', 'true');
              } catch {}
            }}
            className="hidden lg:inline-flex p-1.5 text-slate-400 hover:text-[#0df2c9] rounded-lg hover:bg-slate-800/60 transition-colors cursor-pointer"
            title="Collapse sidebar for full-screen workspace"
            aria-label="Collapse sidebar"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Workspace Mode Switcher */}
      <div className="px-3 pt-3">
        <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-[#070d16] border border-[#142033] text-[10px] font-mono font-bold">
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'finance', label: 'Finance' },
              { id: 'trading', label: 'Pro Desk' },
            ] as const
          ).map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => handleWorkspaceChange(mode.id)}
              className={`py-1 rounded-lg transition-colors cursor-pointer ${
                workspaceMode === mode.id
                  ? 'bg-[#11263c] text-[#0df2c9] border border-teal-500/35'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      {/* Nav List */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {visibleNavGroups.map((group) => (
          <div key={group.group}>
            <div className="px-3 mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              {group.group}
            </div>
            <div className="space-y-1">
              {group.items.map((item) => {
                const isActive = activeTab === item.id;
                const Icon = item.icon;

                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelectTab(item.id)}
                    className={`w-full flex items-center gap-3.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 relative text-left ${
                      isActive
                        ? 'bg-[#102235] text-[#0df2c9] shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] border border-teal-500/25'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-[#0f1726]'
                    }`}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-2 bottom-2 w-1 bg-[#0df2c9] rounded-r-full shadow-[0_0_8px_#0df2c9]" />
                    )}
                    <Icon
                      className={`w-[18px] h-[18px] shrink-0 transition-colors ${
                        isActive ? 'text-[#0df2c9]' : 'text-slate-400 group-hover:text-slate-300'
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer info / user account */}
      <div className="p-3.5 border-t border-[#141e30] bg-[#090e18] space-y-2.5">
        {user ? (
          <div className="flex items-center justify-between p-2 rounded-xl bg-[#0f1828] border border-[#1b2b44]">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-teal-500/20 border border-teal-500/40 text-[#0df2c9] font-bold flex items-center justify-center text-xs shrink-0 uppercase">
                {user.displayName ? user.displayName.charAt(0) : user.email ? user.email.charAt(0) : 'U'}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-white truncate">
                  {user.displayName || user.email?.split('@')[0] || 'User'}
                </div>
                <div className="text-[10px] text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                  <span>{user.provider === 'firebase' ? 'Cloud Synced' : 'Private Vault'}</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => logout()}
              className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition-colors shrink-0"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => {
              setAuthMode('login');
              setIsAuthModalOpen(true);
            }}
            className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/30 text-teal-300 text-xs font-semibold transition-colors"
          >
            <Lock className="w-3.5 h-3.5 text-teal-400" />
            <span>Sign In / Sign Up</span>
          </button>
        )}

        {/* Currency Switcher & Converter */}
        <div className="bg-[#0b121e] border border-[#162338] rounded-xl p-2 space-y-2">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>Portfolio Currency</span>
            <button
              onClick={() => {
                setIsCurrencyConverterOpen(true);
                setMobileOpen(false);
              }}
              className="text-[10px] text-teal-400 hover:text-white flex items-center gap-1 font-semibold"
              title="Open Live Currency Converter"
            >
              <ArrowRightLeft className="w-3 h-3" />
              <span>Convert FX</span>
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {(['USD', 'KES', 'EUR'] as const).map((c) => (
              <button
                key={c}
                onClick={() => setCurrency(c, true)}
                className={`py-1 text-center rounded-lg text-[11px] font-bold font-mono transition-colors ${
                  currency === c
                    ? 'bg-teal-500/20 text-[#0df2c9] border border-teal-500/40 shadow-sm'
                    : 'bg-[#101a2d] hover:bg-[#16243f] text-slate-400 hover:text-white border border-transparent'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Backup & Restore */}
        <button
          onClick={() => {
            setIsBackupRestoreOpen(true);
            setMobileOpen(false);
          }}
          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[#0e1626] hover:bg-[#142036] border border-[#17253c] hover:border-teal-500/30 text-[11px] text-slate-400 hover:text-teal-300 transition-colors cursor-pointer group"
          title="Backup or restore financial data in JSON"
        >
          <div className="flex items-center gap-1.5">
            <Database className="w-3 h-3 text-slate-500 group-hover:text-teal-400 transition-colors" />
            <span>Backup & Restore</span>
          </div>
          <span className="text-[10px] text-teal-400 font-mono">JSON</span>
        </button>

        {/* PWA Install Button */}
        <PWAInstallButton variant="sidebar" />

        <button
          onClick={() => {
            setIsClearDataModalOpen(true);
            setMobileOpen(false);
          }}
          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[#0e1626] hover:bg-rose-950/20 border border-[#17253c] hover:border-rose-500/30 text-[11px] text-slate-400 hover:text-rose-300 transition-colors cursor-pointer group"
          title="Reset or clear workspace data"
        >
          <div className="flex items-center gap-1.5">
            <RotateCcw className="w-3 h-3 text-slate-500 group-hover:text-rose-400 transition-colors" />
            <span>Reset / Clear Data</span>
          </div>
          <span className="text-[10px] text-slate-500 group-hover:text-rose-400">Manage</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Laptop & Monitor collapsible sidebar */}
      <aside
        className={`hidden lg:block shrink-0 sticky top-0 h-dvh z-30 transition-all duration-300 ease-in-out ${
          collapsed
            ? 'w-0 -translate-x-full overflow-hidden opacity-0 pointer-events-none'
            : 'w-60 xl:w-64 opacity-100'
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile & Tablet Drawer Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative z-10 w-64 max-w-[85vw] h-dvh shadow-2xl">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
