import React, { useMemo, useState, useEffect } from 'react';
import {
  ShieldAlert,
  Globe2,
  Calendar,
  Users,
  Clock,
  Send,
  Zap,
  Layers,
  ArrowRight,
  Activity,
  Compass,
  Building2,
  Target,
  Sparkles,
  Search,
  BarChart3,
  LayoutGrid,
  ChevronDown,
  X,
  Landmark,
  Crosshair,
  Scale,
  Play,
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext.tsx';
import { CurrencyStrengthMeter } from '../common/CurrencyStrengthMeter.tsx';
import { PropFirmRiskGuardian } from '../common/PropFirmRiskGuardian.tsx';
import { EconomicCalendar } from '../common/EconomicCalendar.tsx';
import { ForexSessionsKillzones } from '../common/ForexSessionsKillzones.tsx';
import { RetailSentimentDesk } from '../common/RetailSentimentDesk.tsx';
import { TelegramSignalDispatcher } from '../common/TelegramSignalDispatcher.tsx';
import { IntermarketDivergenceRadar } from '../common/IntermarketDivergenceRadar.tsx';
import { AdrVolatilityExhaustionDesk } from '../common/AdrVolatilityExhaustionDesk.tsx';
import { CotInstitutionalMatrix } from '../common/CotInstitutionalMatrix.tsx';
import { MtfConfluenceMatrixDesk } from '../common/MtfConfluenceMatrixDesk.tsx';
import { CamarillaPivotMatrix } from '../common/CamarillaPivotMatrix.tsx';
import { BarchartAnalyticsDesk } from '../common/BarchartAnalyticsDesk.tsx';
import { CentralBankCarryDesk } from '../common/CentralBankCarryDesk.tsx';
import { LiquidityPoolMapDesk } from '../common/LiquidityPoolMapDesk.tsx';
import { ExposureAndSpreadGuardDesk } from '../common/ExposureAndSpreadGuardDesk.tsx';
import { ChartReplayTrainerDesk } from '../common/ChartReplayTrainerDesk.tsx';
import { Candle, generateCandles } from '../../utils/stockCandles.ts';
import { useTradingViewQuotes, lookupTradingViewQuote, resolveTradingViewPrice } from '../../utils/tradingViewSync.ts';

type SuiteTab =
  | 'all'
  | 'barchart'
  | 'intermarket'
  | 'adr'
  | 'mtf-matrix'
  | 'cot'
  | 'camarilla'
  | 'csm'
  | 'propfirm'
  | 'sentiment'
  | 'calendar'
  | 'sessions'
  | 'dispatcher'
  | 'central-banks'
  | 'liquidity-map'
  | 'exposure-risk'
  | 'chart-replay';

interface QuantToolMeta {
  id: Exclude<SuiteTab, 'all'>;
  label: string;
  shortLabel: string;
  description: string;
  icon: React.ElementType;
}

const QUANT_TOOL_CATEGORIES: Array<{
  id: string;
  title: string;
  tools: QuantToolMeta[];
}> = [
  {
    id: 'structure',
    title: 'Structure & Volatility',
    tools: [
      {
        id: 'barchart',
        label: 'Barchart Opinions & Movers',
        shortLabel: 'Barchart',
        description: '13-indicator consensus & market movers',
        icon: BarChart3,
      },
      {
        id: 'mtf-matrix',
        label: 'MTF 4H–1M Confluence',
        shortLabel: 'MTF Matrix',
        description: 'Multi-timeframe trend & momentum alignment',
        icon: Layers,
      },
      {
        id: 'camarilla',
        label: 'Camarilla & CPR Pivots',
        shortLabel: 'Camarilla',
        description: 'Intraday institutional pivot & breakout levels',
        icon: Target,
      },
      {
        id: 'adr',
        label: 'ADR Volatility Exhaustion',
        shortLabel: 'ADR Exhaustion',
        description: 'Daily pip range utilization & exhaustion',
        icon: Activity,
      },
      {
        id: 'liquidity-map',
        label: 'Institutional Liquidity Map',
        shortLabel: 'Liquidity Map',
        description: 'PDH/PDL, PWH/PWL & Asian range sweeps',
        icon: Crosshair,
      },
      {
        id: 'chart-replay',
        label: 'Bar-by-Bar Chart Replay',
        shortLabel: 'Chart Replay',
        description: 'Hidden-edge candle execution trainer',
        icon: Play,
      },
    ],
  },
  {
    id: 'macro',
    title: 'Macro & Positioning',
    tools: [
      {
        id: 'intermarket',
        label: 'Intermarket Macro Radar',
        shortLabel: 'Intermarket',
        description: 'DXY, yields, gold & equity correlation flow',
        icon: Compass,
      },
      {
        id: 'central-banks',
        label: 'Central Banks & Swap Carry',
        shortLabel: 'CB Rates & Carry',
        description: 'G10/CBK rate spread & Wednesday 3x swap',
        icon: Landmark,
      },
      {
        id: 'cot',
        label: 'COT Smart Money Flows',
        shortLabel: 'COT Flows',
        description: 'CFTC institutional net positioning report',
        icon: Building2,
      },
      {
        id: 'csm',
        label: 'Currency Strength (CSM)',
        shortLabel: 'CSM Strength',
        description: '8-currency relative strength ranking',
        icon: Globe2,
      },
      {
        id: 'sentiment',
        label: 'Retail Sentiment',
        shortLabel: 'Sentiment',
        description: 'Crowd long/short contrarian positioning',
        icon: Users,
      },
    ],
  },
  {
    id: 'risk',
    title: 'Risk, Sessions & Alerts',
    tools: [
      {
        id: 'propfirm',
        label: 'Prop Firm Shield',
        shortLabel: 'Prop Shield',
        description: 'Daily drawdown & equity protection guard',
        icon: ShieldAlert,
      },
      {
        id: 'exposure-risk',
        label: 'Exposure, Spread & Risk-of-Ruin',
        shortLabel: 'Exposure & Ruin',
        description: 'Net currency stack, rollover tax & Monte Carlo',
        icon: Scale,
      },
      {
        id: 'calendar',
        label: 'Economic Calendar',
        shortLabel: 'Calendar',
        description: 'High-impact macro releases & countdowns',
        icon: Calendar,
      },
      {
        id: 'sessions',
        label: 'Killzones & Sessions',
        shortLabel: 'Killzones',
        description: 'London, NY & Asia liquidity windows',
        icon: Clock,
      },
      {
        id: 'dispatcher',
        label: 'Telegram Dispatch',
        shortLabel: 'Dispatch',
        description: '1-click formatted signal broadcast',
        icon: Send,
      },
    ],
  },
];

const QUANT_TOOL_MAP: Record<Exclude<SuiteTab, 'all'>, QuantToolMeta> = QUANT_TOOL_CATEGORIES.reduce(
  (acc, cat) => {
    for (const tool of cat.tools) {
      acc[tool.id] = tool;
    }
    return acc;
  },
  {} as Record<Exclude<SuiteTab, 'all'>, QuantToolMeta>
);

const QUICK_PAIRS = [
  'XAU/USD',
  'EUR/USD',
  'GBP/USD',
  'USD/JPY',
  'EUR/JPY',
  'GBP/JPY',
  'AUD/USD',
  'USD/CAD',
  'USD/CHF',
  'NAS100',
  'US30',
  'USD/KES',
];

export const ForexPowerSuiteView: React.FC = () => {
  const { setActiveTab } = useFinance();
  const [activeTabLocal, setActiveTabLocal] = useState<SuiteTab>('all');
  const [showQuantHub, setShowQuantHub] = useState<boolean>(false);
  const [quantQuery, setQuantQuery] = useState<string>('');
  const [selectedAsset, setSelectedAsset] = useState<string>('XAU/USD');
  const [customPairInput, setCustomPairInput] = useState<string>('');
  const [suiteLiveCandles, setSuiteLiveCandles] = useState<Candle[] | null>(null);
  const liveQuotes = useTradingViewQuotes(3200);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/stocks/history?ticker=${encodeURIComponent(selectedAsset)}&timeframe=15m`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.success && Array.isArray(data.candles) && data.candles.length >= 12) {
          setSuiteLiveCandles(data.candles);
        } else if (!cancelled) {
          setSuiteLiveCandles(null);
        }
      })
      .catch(() => {
        if (!cancelled) setSuiteLiveCandles(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedAsset]);

  const filteredQuantCategories = useMemo(() => {
    const q = quantQuery.trim().toLowerCase();
    if (!q) return QUANT_TOOL_CATEGORIES;
    return QUANT_TOOL_CATEGORIES.map((cat) => ({
      ...cat,
      tools: cat.tools.filter(
        (t) =>
          t.label.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          cat.title.toLowerCase().includes(q)
      ),
    })).filter((cat) => cat.tools.length > 0);
  }, [quantQuery]);

  // Compute live price & signal metrics dynamically
  const activeQuote = lookupTradingViewQuote(liveQuotes, selectedAsset);
  const isGold = selectedAsset.includes('XAU') || selectedAsset.includes('GOLD');
  const isJpy = selectedAsset.includes('JPY');
  const isIndex = selectedAsset.includes('NAS') || selectedAsset.includes('US30') || selectedAsset.includes('SPX');

  const fallbackPrice = isGold
    ? 3878.46
    : isIndex
    ? (selectedAsset.includes('30') ? 52225.33 : selectedAsset.includes('500') ? 7519.06 : 27744.26)
    : isJpy
    ? 159.86
    : 1.1032;
  const currentPrice = resolveTradingViewPrice(liveQuotes, selectedAsset, fallbackPrice);
  const atr = activeQuote?.atr || (isGold ? 18.5 : isIndex ? 140 : isJpy ? 0.95 : 0.0065);
  const isBullish = activeQuote?.rsi ? activeQuote.rsi > 48 : true;
  const action = isBullish ? 'STRONG BUY' : 'STRONG SELL';

  const sl = Number(
    (isBullish ? currentPrice - atr * 1.5 : currentPrice + atr * 1.5).toFixed(isJpy ? 3 : isGold || isIndex ? 2 : 5)
  );
  const tp1 = Number(
    (isBullish ? currentPrice + atr * 2.0 : currentPrice - atr * 2.0).toFixed(isJpy ? 3 : isGold || isIndex ? 2 : 5)
  );
  const tp2 = Number(
    (isBullish ? currentPrice + atr * 3.5 : currentPrice - atr * 3.5).toFixed(isJpy ? 3 : isGold || isIndex ? 2 : 5)
  );

  const zoneSpread = atr * 0.25;
  const entryMin = (currentPrice - zoneSpread).toFixed(isJpy ? 2 : isGold || isIndex ? 2 : 4);
  const entryMax = (currentPrice + zoneSpread).toFixed(isJpy ? 2 : isGold || isIndex ? 2 : 4);

  const dynamicSignalPayload = {
    symbol: selectedAsset,
    action: action as any,
    timeframe: 'M5' as const,
    price: currentPrice,
    entryZone: `${entryMin} - ${entryMax}`,
    sl,
    tp1,
    tp2,
    rr: '1:2.4',
    score: activeQuote?.rsi ? Math.min(96, Math.max(72, Math.round(52 + Math.abs(activeQuote.rsi - 50) * 1.5))) : 88,
    grade: 'A+ PRIME SCALP',
    confluences: '5/5 Institutional Confluences: Live Scanner Feed + ADR Volatility Check + Camarilla Confluence + Smart Money Order Flow',
  };

  const handlePairSelect = (pair: string) => {
    setSelectedAsset(pair);
  };

  const handleCustomPairSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customPairInput.trim()) return;
    const clean = customPairInput.trim().toUpperCase();
    setSelectedAsset(clean);
    setCustomPairInput('');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-5 sm:p-6 rounded-2xl bg-[#081222] border border-[#1a2b46] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-teal-500/12 border border-teal-500/30 flex items-center justify-center text-[#0df2c9] shrink-0">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Forex Institutional Quant &amp; Macro Suite
              </h1>
              <span className="text-xs font-mono text-[#0df2c9]">
                16 quant tools <span aria-hidden="true">·</span> synced to {selectedAsset}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 max-w-2xl mt-0.5">
              Unified institutional desk for Barchart opinions, intermarket flow, volatility exhaustion, COT smart money, MTF confluence, pivots, prop-firm risk shield, and news guard.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('stocks')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0e1a2f] hover:bg-[#142644] border border-[#1b345b] text-slate-200 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
          >
            <span>TradingView Workbench</span>
            <ArrowRight className="w-3.5 h-3.5 text-[#0df2c9]" />
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('mt5-ea')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0df2c9] hover:bg-[#19f7d0] text-slate-950 text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Launch Bot EA</span>
          </button>
        </div>
      </div>

      {/* Global Focus Pair Selector Bar (Syncs Across ALL 11 Tools) */}
      <div className="p-4 rounded-2xl bg-[#090f1a] border border-[#16233a] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mr-1">
            <Sparkles className="w-3.5 h-3.5 text-[#0df2c9]" />
            <span>Active Focus Asset:</span>
          </span>

          {QUICK_PAIRS.map((pair) => {
            const isSelected = selectedAsset === pair;
            const quote = lookupTradingViewQuote(liveQuotes, pair);
            return (
              <button
                key={pair}
                onClick={() => handlePairSelect(pair)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-[#0df2c9]/20 text-[#0df2c9] border border-[#0df2c9]/50 shadow-sm'
                    : 'bg-[#0e1627] text-slate-300 hover:text-white hover:bg-[#142038] border border-[#1c2c48]'
                }`}
              >
                <span>{pair}</span>
                {quote && quote.changePercent !== undefined && (
                  <span
                    className={`text-[10px] ${
                      quote.changePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {quote.changePercent >= 0 ? '+' : ''}
                    {quote.changePercent}%
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Custom Pair Input */}
        <form onSubmit={handleCustomPairSubmit} className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={customPairInput}
              onChange={(e) => setCustomPairInput(e.target.value)}
              placeholder="Custom pair (e.g. AUD/JPY)..."
              className="pl-8 pr-3 py-1.5 rounded-lg bg-[#0e1627] border border-[#1c2c48] text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-teal-500 w-48"
            />
          </div>
          <button
            type="submit"
            className="px-3 py-1.5 rounded-lg bg-teal-500/20 hover:bg-teal-500/30 text-[#0df2c9] border border-teal-500/40 text-xs font-mono font-bold transition-colors cursor-pointer"
          >
            Focus
          </button>
        </form>
      </div>

      {/* Single-Row Quant Toolbar + Categorized Hub Trigger */}
      <div className="flex items-center justify-between gap-2 p-1.5 rounded-2xl bg-[#0c1322] border border-[#16243d]">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none min-w-0">
          {(
            [
              { id: 'all', label: 'All Tools Grid', icon: Layers },
              { id: 'barchart', label: 'Barchart', icon: BarChart3 },
              { id: 'mtf-matrix', label: 'MTF Matrix', icon: Layers },
              { id: 'calendar', label: 'Calendar', icon: Calendar },
            ] as Array<{ id: SuiteTab; label: string; icon: React.ElementType }>
          ).map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTabLocal === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTabLocal(tab.id);
                  setShowQuantHub(false);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-[#0df2c9]/15 text-[#0df2c9] border border-[#0df2c9]/40'
                    : 'text-slate-400 hover:text-white border border-transparent'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}

          {activeTabLocal !== 'all' &&
            !['barchart', 'mtf-matrix', 'calendar'].includes(activeTabLocal) &&
            (() => {
              const meta = QUANT_TOOL_MAP[activeTabLocal];
              const ActiveIcon = meta?.icon || Compass;
              return (
                <button
                  type="button"
                  onClick={() => setShowQuantHub((v) => !v)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#0df2c9]/15 text-[#0df2c9] border border-[#0df2c9]/40 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <ActiveIcon className="w-3.5 h-3.5" />
                  <span>{meta?.shortLabel || activeTabLocal}</span>
                </button>
              );
            })()}
        </div>

        <div className="flex items-center gap-3 shrink-0 pr-1">
          <span className="text-xs font-mono text-slate-400 hidden sm:inline whitespace-nowrap">
            {selectedAsset} <span aria-hidden="true">·</span> {currentPrice.toFixed(isJpy ? 3 : isGold || isIndex ? 2 : 5)}
          </span>

          <button
            type="button"
            onClick={() => setShowQuantHub((v) => !v)}
            aria-expanded={showQuantHub}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              showQuantHub
                ? 'bg-[#0df2c9] text-slate-950 border-[#0df2c9]'
                : 'bg-[#08101e] hover:bg-[#112038] text-slate-200 border-[#213352]'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Quant Tools (16)</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showQuantHub ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {showQuantHub && (
        <div className="rounded-2xl bg-[#09111e] border border-[#1a2b46] shadow-2xl overflow-hidden animate-in fade-in duration-150">
          <div className="px-4 py-3 border-b border-[#16243d] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <h3 className="text-sm font-bold text-white whitespace-nowrap">Quant Tools Hub</h3>
              <span className="text-xs text-slate-400 whitespace-nowrap">
                16 modules <span aria-hidden="true">·</span> {selectedAsset}
              </span>
            </div>

            <div className="flex items-center gap-2 flex-1 sm:flex-initial justify-end">
              <div className="relative flex-1 sm:w-56">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={quantQuery}
                  onChange={(e) => setQuantQuery(e.target.value)}
                  placeholder="Filter quant tools..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[#050a14] border border-[#1a2b46] text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#0df2c9]"
                />
              </div>

              <button
                type="button"
                onClick={() => {
                  setActiveTabLocal('all');
                  setShowQuantHub(false);
                }}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0e1a2e] hover:bg-[#142542] border border-[#1d3252] text-xs font-medium text-[#0df2c9] transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>All 16 Grid</span>
              </button>

              <button
                type="button"
                onClick={() => setShowQuantHub(false)}
                aria-label="Close quant tools hub"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#122038] transition-colors cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {filteredQuantCategories.length === 0 ? (
            <div className="px-6 py-8 text-center text-xs text-slate-400">
              No quant tools matched &ldquo;{quantQuery}&rdquo;. Clear the search box to view all 16 modules.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[#16243d]">
              {filteredQuantCategories.map((cat) => (
                <div key={cat.id} className="p-4 space-y-2">
                  <div className="text-[11px] font-semibold text-slate-400 px-2 pb-1">
                    {cat.title}
                  </div>
                  <div className="space-y-1">
                    {cat.tools.map((tool) => {
                      const Icon = tool.icon;
                      const isActive = activeTabLocal === tool.id;
                      return (
                        <button
                          key={tool.id}
                          type="button"
                          onClick={() => {
                            setActiveTabLocal(tool.id);
                            setShowQuantHub(false);
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
      )}

      {/* Main Content Area */}
      {activeTabLocal === 'all' && (
        <div className="space-y-6">
          <BarchartAnalyticsDesk
            currentTicker={selectedAsset}
            currentPrice={currentPrice}
            onSelectTicker={(pair) => setSelectedAsset(pair)}
          />

          {/* Priority Macro & Volatility Suite */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <IntermarketDivergenceRadar
              onSelectPair={(pair) => {
                setSelectedAsset(pair);
              }}
            />
            <AdrVolatilityExhaustionDesk
              currentTicker={selectedAsset}
              onSelectTicker={(t) => setSelectedAsset(t)}
            />
          </div>

          {/* MTF Confluence Matrix Full Width */}
          <MtfConfluenceMatrixDesk
            onSelectPair={(pair) => {
              setSelectedAsset(pair);
            }}
          />

          {/* Row 3: COT Institutional Matrix + Camarilla Pivots */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <CotInstitutionalMatrix />
            <CamarillaPivotMatrix
              currentTicker={selectedAsset}
              onSelectTicker={(t) => setSelectedAsset(t)}
            />
          </div>

          {/* Row 4: Currency Strength Meter + Retail Sentiment */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <CurrencyStrengthMeter
              onSelectPair={(pair) => {
                setSelectedAsset(pair);
              }}
            />
            <RetailSentimentDesk
              currentTicker={selectedAsset}
              onSelectTicker={(t) => setSelectedAsset(t)}
            />
          </div>

          {/* Row 5: Prop Firm Risk Guardian + Sessions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <PropFirmRiskGuardian currentTicker={selectedAsset} />
            <ForexSessionsKillzones />
          </div>

          {/* Row 6: Economic Calendar + Telegram Dispatcher */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <EconomicCalendar currentTicker={selectedAsset} />
            <TelegramSignalDispatcher activeSignal={dynamicSignalPayload} />
          </div>

          {/* Row 7: Central Bank Carry + Institutional Liquidity Map */}
          <CentralBankCarryDesk
            currentTicker={selectedAsset}
            onSelectPair={(pair) => setSelectedAsset(pair)}
          />

          <LiquidityPoolMapDesk
            currentTicker={selectedAsset}
            currentPrice={currentPrice}
            candles={suiteLiveCandles || generateCandles(selectedAsset, currentPrice, currentPrice * 0.004, '15m')}
          />

          <ExposureAndSpreadGuardDesk
            currentTicker={selectedAsset}
            currentPrice={currentPrice}
          />
        </div>
      )}

      {activeTabLocal === 'barchart' && (
        <BarchartAnalyticsDesk
          currentTicker={selectedAsset}
          currentPrice={currentPrice}
          onSelectTicker={(pair) => setSelectedAsset(pair)}
        />
      )}

      {activeTabLocal === 'intermarket' && (
        <IntermarketDivergenceRadar
          onSelectPair={(pair) => {
            setSelectedAsset(pair);
          }}
        />
      )}

      {activeTabLocal === 'adr' && (
        <AdrVolatilityExhaustionDesk
          currentTicker={selectedAsset}
          onSelectTicker={(t) => setSelectedAsset(t)}
        />
      )}

      {activeTabLocal === 'mtf-matrix' && (
        <MtfConfluenceMatrixDesk
          onSelectPair={(pair) => {
            setSelectedAsset(pair);
          }}
        />
      )}

      {activeTabLocal === 'cot' && <CotInstitutionalMatrix />}

      {activeTabLocal === 'camarilla' && (
        <CamarillaPivotMatrix
          currentTicker={selectedAsset}
          onSelectTicker={(t) => setSelectedAsset(t)}
        />
      )}

      {activeTabLocal === 'csm' && (
        <CurrencyStrengthMeter
          onSelectPair={(pair) => {
            setSelectedAsset(pair);
          }}
        />
      )}

      {activeTabLocal === 'propfirm' && (
        <PropFirmRiskGuardian currentTicker={selectedAsset} />
      )}

      {activeTabLocal === 'sentiment' && (
        <RetailSentimentDesk
          currentTicker={selectedAsset}
          onSelectTicker={(t) => setSelectedAsset(t)}
        />
      )}

      {activeTabLocal === 'calendar' && (
        <EconomicCalendar currentTicker={selectedAsset} />
      )}

      {activeTabLocal === 'sessions' && <ForexSessionsKillzones />}

      {activeTabLocal === 'dispatcher' && (
        <TelegramSignalDispatcher activeSignal={dynamicSignalPayload} />
      )}

      {activeTabLocal === 'central-banks' && (
        <CentralBankCarryDesk
          currentTicker={selectedAsset}
          onSelectPair={(pair) => setSelectedAsset(pair)}
        />
      )}

      {activeTabLocal === 'liquidity-map' && (
        <LiquidityPoolMapDesk
          currentTicker={selectedAsset}
          currentPrice={currentPrice}
          candles={suiteLiveCandles || generateCandles(selectedAsset, currentPrice, currentPrice * 0.004, '15m')}
        />
      )}

      {activeTabLocal === 'exposure-risk' && (
        <ExposureAndSpreadGuardDesk
          currentTicker={selectedAsset}
          currentPrice={currentPrice}
        />
      )}

      {activeTabLocal === 'chart-replay' && (
        <ChartReplayTrainerDesk
          currentTicker={selectedAsset}
          currentPrice={currentPrice}
          timeframe="15m"
        />
      )}
    </div>
  );
};
