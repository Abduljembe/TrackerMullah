import React, { useMemo, useState } from 'react';
import {
  Activity,
  Award,
  BarChart3,
  Calculator,
  CheckCircle2,
  Clock,
  Compass,
  Flame,
  Globe,
  Globe2,
  Grid,
  Layers,
  Search,
  Send,
  ShieldAlert,
  Smartphone,
  Sparkles,
  Target,
  Users,
  X,
  Zap,
  ArrowUpRight,
} from 'lucide-react';

export type WorkbenchToolId =
  | 'paper'
  | 'scorecard'
  | 'orderflow'
  | 'barchart'
  | 'livetv'
  | 'journal'
  | 'risk-calc'
  | 'sessions'
  | 'prop-guard'
  | 'correlation'
  | 'broker-arbiter'
  | 'strength'
  | 'backtest'
  | 'calendar'
  | 'news'
  | 'sentiment'
  | 'dispatcher'
  | 'intermarket'
  | 'adr'
  | 'mtf-matrix'
  | 'cot'
  | 'camarilla';

export interface TradingToolMeta {
  id: WorkbenchToolId;
  label: string;
  shortLabel: string;
  description: string;
  category: 'execution' | 'structure' | 'macro' | 'news';
  icon: React.ElementType;
}

export const TRADING_TOOL_CATEGORIES: Array<{
  id: 'execution' | 'structure' | 'macro' | 'news';
  title: string;
  tools: TradingToolMeta[];
}> = [
  {
    id: 'execution',
    title: 'Execution & Risk',
    tools: [
      {
        id: 'paper',
        label: 'Paper Terminal',
        shortLabel: 'Paper Terminal',
        description: 'Instant simulated trade execution',
        category: 'execution',
        icon: Zap,
      },
      {
        id: 'risk-calc',
        label: 'Risk & Lot Calculator',
        shortLabel: 'Risk Calculator',
        description: 'Position size & stop distance',
        category: 'execution',
        icon: Calculator,
      },
      {
        id: 'prop-guard',
        label: 'Prop Firm Guard',
        shortLabel: 'Prop Guard',
        description: 'Daily drawdown & lockout shield',
        category: 'execution',
        icon: ShieldAlert,
      },
      {
        id: 'scorecard',
        label: 'Signal Win-Rate Scorecard',
        shortLabel: 'Scorecard',
        description: 'Live TP/SL tracking & accuracy',
        category: 'execution',
        icon: CheckCircle2,
      },
      {
        id: 'journal',
        label: 'Performance Journal & Curve',
        shortLabel: 'Journal',
        description: 'Equity curve & closed trade log',
        category: 'execution',
        icon: Award,
      },
      {
        id: 'broker-arbiter',
        label: 'Broker M-Pesa Arbiter',
        shortLabel: 'M-Pesa Arbiter',
        description: 'Spread & M-Pesa fee comparison',
        category: 'execution',
        icon: Smartphone,
      },
    ],
  },
  {
    id: 'structure',
    title: 'Structure & Order Flow',
    tools: [
      {
        id: 'orderflow',
        label: 'Order Flow & Liquidity',
        shortLabel: 'Order Flow',
        description: 'Volume profile, POC & FVG zones',
        category: 'structure',
        icon: Layers,
      },
      {
        id: 'barchart',
        label: 'Barchart Opinions & Movers',
        shortLabel: 'Barchart',
        description: '13-indicator consensus & ranking',
        category: 'structure',
        icon: BarChart3,
      },
      {
        id: 'mtf-matrix',
        label: 'MTF 4H–1M Matrix',
        shortLabel: 'MTF Matrix',
        description: 'Multi-timeframe trend alignment',
        category: 'structure',
        icon: Layers,
      },
      {
        id: 'camarilla',
        label: 'Camarilla & CPR Pivots',
        shortLabel: 'Camarilla',
        description: 'Intraday institutional pivot levels',
        category: 'structure',
        icon: Target,
      },
      {
        id: 'adr',
        label: 'ADR Volatility Exhaustion',
        shortLabel: 'ADR Exhaustion',
        description: 'Daily pip range & exhaustion',
        category: 'structure',
        icon: Activity,
      },
    ],
  },
  {
    id: 'macro',
    title: 'Macro & Institutional',
    tools: [
      {
        id: 'cot',
        label: 'COT Smart Money',
        shortLabel: 'COT Report',
        description: 'CFTC institutional positioning',
        category: 'macro',
        icon: Flame,
      },
      {
        id: 'sentiment',
        label: 'Retail Sentiment & Order Book',
        shortLabel: 'Sentiment',
        description: 'Crowd long/short contrarian skew',
        category: 'macro',
        icon: Users,
      },
      {
        id: 'strength',
        label: 'Currency Strength & Heatmap',
        shortLabel: 'Strength',
        description: '8-currency relative strength score',
        category: 'macro',
        icon: Globe,
      },
      {
        id: 'correlation',
        label: 'Correlation Matrix',
        shortLabel: 'Correlation',
        description: 'Cross-pair directional overlap',
        category: 'macro',
        icon: Grid,
      },
      {
        id: 'intermarket',
        label: 'Intermarket Macro Radar',
        shortLabel: 'Intermarket',
        description: 'DXY, yields, gold & equity flow',
        category: 'macro',
        icon: Compass,
      },
    ],
  },
  {
    id: 'news',
    title: 'News, Media & Testing',
    tools: [
      {
        id: 'calendar',
        label: 'Economic Calendar',
        shortLabel: 'Calendar',
        description: 'High-impact macro countdowns',
        category: 'news',
        icon: Flame,
      },
      {
        id: 'news',
        label: 'Forex Factory News & AI Insights',
        shortLabel: 'FF News',
        description: 'Macro headlines & event scenarios',
        category: 'news',
        icon: Flame,
      },
      {
        id: 'sessions',
        label: 'Killzones & Sessions',
        shortLabel: 'Killzones',
        description: 'London, NY & Tokyo market hours',
        category: 'news',
        icon: Clock,
      },
      {
        id: 'livetv',
        label: 'World Monitor & Bloomberg TV',
        shortLabel: 'Live TV',
        description: 'Live market broadcasts & radio',
        category: 'news',
        icon: Globe2,
      },
      {
        id: 'backtest',
        label: 'Strategy Backtester',
        shortLabel: 'Backtester',
        description: 'Historical strategy simulation',
        category: 'news',
        icon: Sparkles,
      },
      {
        id: 'dispatcher',
        label: 'Telegram & Discord Broadcast',
        shortLabel: 'Broadcast',
        description: '1-click formatted signal alerts',
        category: 'news',
        icon: Send,
      },
    ],
  },
];

export const TRADING_TOOL_META_MAP: Record<WorkbenchToolId, TradingToolMeta> = TRADING_TOOL_CATEGORIES.reduce(
  (acc, cat) => {
    for (const t of cat.tools) {
      acc[t.id] = t;
    }
    return acc;
  },
  {} as Record<WorkbenchToolId, TradingToolMeta>
);

interface TradingToolsLauncherPanelProps {
  activeTool: WorkbenchToolId;
  activeAsset: string;
  onSelectTool: (toolId: WorkbenchToolId) => void;
  onClose: () => void;
  onOpenFullSuite?: () => void;
}

export const TradingToolsLauncherPanel: React.FC<TradingToolsLauncherPanelProps> = ({
  activeTool,
  activeAsset,
  onSelectTool,
  onClose,
  onOpenFullSuite,
}) => {
  const [query, setQuery] = useState('');

  const filteredCategories = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return TRADING_TOOL_CATEGORIES;
    return TRADING_TOOL_CATEGORIES.map((cat) => ({
      ...cat,
      tools: cat.tools.filter(
        (t) =>
          t.label.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          cat.title.toLowerCase().includes(q)
      ),
    })).filter((cat) => cat.tools.length > 0);
  }, [query]);

  return (
    <div className="rounded-2xl bg-[#09111e] border border-[#1a2b46] shadow-2xl overflow-hidden animate-in fade-in duration-150">
      {/* Top Bar */}
      <div className="px-4 py-3 border-b border-[#16243d] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <h3 className="text-sm font-bold text-white whitespace-nowrap">Trading Tools Hub</h3>
          <span className="text-xs text-slate-400 whitespace-nowrap">
            22 tools <span aria-hidden="true">·</span> {activeAsset}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-1 sm:flex-initial justify-end">
          <div className="relative flex-1 sm:w-56">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter tools..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[#050a14] border border-[#1a2b46] text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#0df2c9]"
            />
          </div>

          {onOpenFullSuite && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenFullSuite();
              }}
              className="hidden md:inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#0e1a2e] hover:bg-[#142542] border border-[#1d3252] text-xs font-medium text-[#0df2c9] transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <span>Full Quant Suite</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            aria-label="Close tools hub"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#122038] transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 4-Column Categorized Directory */}
      {filteredCategories.length === 0 ? (
        <div className="px-6 py-8 text-center text-xs text-slate-400">
          No tools matched &ldquo;{query}&rdquo;. Clear the search box to view all 22 tools.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-[#16243d]">
          {filteredCategories.map((cat) => (
            <div key={cat.id} className="p-4 space-y-2">
              <div className="text-[11px] font-semibold text-slate-400 px-2 pb-1">
                {cat.title}
              </div>
              <div className="space-y-1">
                {cat.tools.map((tool) => {
                  const Icon = tool.icon;
                  const isActive = activeTool === tool.id;
                  return (
                    <button
                      key={tool.id}
                      type="button"
                      onClick={() => {
                        onSelectTool(tool.id);
                        onClose();
                      }}
                      className={`w-full flex items-start gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-[#0df2c9]/12 text-[#0df2c9] border border-[#0df2c9]/35'
                          : 'text-slate-300 hover:bg-[#101c31] hover:text-white border border-transparent'
                      }`}
                    >
                      <Icon
                        className={`w-4 h-4 mt-0.5 shrink-0 ${
                          isActive ? 'text-[#0df2c9]' : 'text-slate-400'
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold truncate">{tool.label}</div>
                        <div className="text-[11px] text-slate-400 truncate">{tool.description}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
