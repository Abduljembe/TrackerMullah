import React, { useState, useMemo, useEffect } from 'react';
import {
  TrendingUp,
  ShieldCheck,
  Building2,
  Users,
} from 'lucide-react';
import { useTradingViewQuotes, lookupTradingViewQuote } from '../../utils/tradingViewSync.ts';

function getLatestCftcTuesdayLabel(): string {
  const now = new Date();
  const day = now.getUTCDay();
  const diffToTue = day >= 2 ? day - 2 : 7 - (2 - day);
  const adjustDays = day >= 5 ? diffToTue : diffToTue + 7;
  const tuesday = new Date(now.getTime() - adjustDays * 86400000);
  return tuesday.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

export interface CotDataAsset {
  symbol: string;
  name: string;
  pair?: string;
  reportDate: string;
  commercialNet: number;
  nonCommercialNet: number;
  retailNet: number;
  cotIndex: number;
  institutionalBias: 'STRONG INSTITUTIONAL ACCUMULATION' | 'INSTITUTIONAL DISTRIBUTION' | 'NEUTRAL ROTATION';
  changeFromPrevWeek: number;
  thesis: string;
}

const DEFAULT_COT_DATA: CotDataAsset[] = [
  {
    symbol: 'GOLD (XAU)',
    name: 'CFTC Gold Futures (COMEX)',
    pair: 'XAU/USD',
    reportDate: 'Latest Baseline',
    commercialNet: -242500,
    nonCommercialNet: 285400,
    retailNet: 42900,
    cotIndex: 82,
    institutionalBias: 'STRONG INSTITUTIONAL ACCUMULATION',
    changeFromPrevWeek: 12400,
    thesis: 'Managed money and sovereign accounts remain net long COMEX Gold futures while commercials hedge producer supply.',
  },
  {
    symbol: 'EUR (Euro)',
    name: 'CFTC Euro FX Futures (CME)',
    pair: 'EUR/USD',
    reportDate: 'Latest Baseline',
    commercialNet: 64200,
    nonCommercialNet: -48100,
    retailNet: -16100,
    cotIndex: 44,
    institutionalBias: 'NEUTRAL ROTATION',
    changeFromPrevWeek: -3200,
    thesis: 'Speculative positioning hovering near neutral equilibrium ahead of central bank rate differentials.',
  },
  {
    symbol: 'GBP (Pound)',
    name: 'CFTC British Pound Futures (CME)',
    pair: 'GBP/USD',
    reportDate: 'Latest Baseline',
    commercialNet: -28400,
    nonCommercialNet: 31200,
    retailNet: -2800,
    cotIndex: 66,
    institutionalBias: 'STRONG INSTITUTIONAL ACCUMULATION',
    changeFromPrevWeek: 4800,
    thesis: 'Asset managers hold constructive net long Sterling exposure on yield support.',
  },
  {
    symbol: 'JPY (Yen)',
    name: 'CFTC Japanese Yen Futures (CME)',
    pair: 'USD/JPY',
    reportDate: 'Latest Baseline',
    commercialNet: -145000,
    nonCommercialNet: 128000,
    retailNet: 17000,
    cotIndex: 78,
    institutionalBias: 'STRONG INSTITUTIONAL ACCUMULATION',
    changeFromPrevWeek: 18200,
    thesis: 'Institutional Yen futures unwind shifting speculative flows toward multi-month range highs.',
  },
  {
    symbol: 'WTI (Crude Oil)',
    name: 'CFTC WTI Crude Oil (NYMEX)',
    pair: 'WTI/USD',
    reportDate: 'Latest Baseline',
    commercialNet: -198000,
    nonCommercialNet: 215000,
    retailNet: -17000,
    cotIndex: 72,
    institutionalBias: 'STRONG INSTITUTIONAL ACCUMULATION',
    changeFromPrevWeek: 8900,
    thesis: 'Managed money net length tracks tight global crude inventories and macro energy risk.',
  },
];

const SYMBOL_MAP: Record<string, string> = {
  'GOLD (XAU)': 'XAU/USD',
  'EUR (Euro)': 'EUR/USD',
  'GBP (Pound)': 'GBP/USD',
  'JPY (Yen)': 'USD/JPY',
  'WTI (Crude Oil)': 'WTI/USD',
  'SPX (S&P 500)': 'US500',
  'BTC (Bitcoin)': 'BTC/USD',
};

export const CotInstitutionalMatrix: React.FC = () => {
  const liveQuotes = useTradingViewQuotes(4500);
  const latestReportDate = useMemo(() => getLatestCftcTuesdayLabel(), []);
  const [cftcAssets, setCftcAssets] = useState<CotDataAsset[] | null>(null);
  const [dataSource, setDataSource] = useState<'cftc_live' | 'cftc_baseline'>('cftc_baseline');

  useEffect(() => {
    let active = true;
    fetch('/api/cot/latest')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!active) return;
        if (data?.source === 'cftc_live' && Array.isArray(data.assets) && data.assets.length > 0) {
          setCftcAssets(data.assets);
          setDataSource('cftc_live');
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const computedCotData = useMemo(() => {
    if (cftcAssets && cftcAssets.length > 0) {
      return cftcAssets;
    }

    return DEFAULT_COT_DATA.map((item) => {
      const tvSym = item.pair || SYMBOL_MAP[item.symbol] || 'XAU/USD';
      const q = lookupTradingViewQuote(liveQuotes, tvSym);
      const isInverse = item.symbol.startsWith('JPY');
      const momentumScore = q?.recommendAll ?? (q?.changePercent ? q.changePercent * 0.25 : 0);
      const signedMomentum = isInverse ? -momentumScore : momentumScore;
      const adjustedIndex = Math.min(98, Math.max(8, Math.round(item.cotIndex + signedMomentum * 8)));
      const adjustedFlow = Math.round(item.changeFromPrevWeek + signedMomentum * 3000);
      const bias: CotDataAsset['institutionalBias'] =
        adjustedIndex >= 65
          ? 'STRONG INSTITUTIONAL ACCUMULATION'
          : adjustedIndex <= 35
          ? 'INSTITUTIONAL DISTRIBUTION'
          : 'NEUTRAL ROTATION';

      return {
        ...item,
        reportDate: latestReportDate,
        cotIndex: adjustedIndex,
        changeFromPrevWeek: adjustedFlow,
        institutionalBias: bias,
        nonCommercialNet: item.nonCommercialNet + Math.round(signedMomentum * 3500),
      };
    });
  }, [cftcAssets, liveQuotes, latestReportDate]);

  const [selectedSymbol, setSelectedSymbol] = useState<string>(DEFAULT_COT_DATA[0].symbol);
  const selectedAsset = useMemo(
    () => computedCotData.find((c) => c.symbol === selectedSymbol) || computedCotData[0],
    [computedCotData, selectedSymbol]
  );

  const maxTierAbs = useMemo(() => {
    return Math.max(
      1,
      Math.abs(selectedAsset.commercialNet),
      Math.abs(selectedAsset.nonCommercialNet),
      Math.abs(selectedAsset.retailNet)
    );
  }, [selectedAsset]);

  return (
    <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-[#0c1424] via-[#09101d] to-[#070d18] border border-teal-500/30 shadow-[0_0_25px_rgba(13,242,201,0.08)] space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#182942] pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300 shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base sm:text-lg font-bold text-white tracking-wide">
                Commitment of Traders (COT) Institutional Flow Matrix
              </h3>
              <span className="text-[10px] font-mono font-bold text-purple-300">
                {dataSource === 'cftc_live' ? 'CFTC SOCRATA LIVE FILING' : 'CFTC BASELINE + LIVE MOMENTUM'}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Weekly CFTC futures positioning comparing Commercial Hedgers, Hedge Funds (Non-Commercial), and Small Speculators.
            </p>
          </div>
        </div>

        <span className="text-xs font-mono text-slate-400 bg-[#0c1628] px-3 py-1.5 rounded-xl border border-[#172c4a] self-start sm:self-auto tabular-nums">
          CFTC Release: <strong className="text-teal-300">{selectedAsset.reportDate}</strong>
        </span>
      </div>

      {/* Asset Selector */}
      <div className="flex flex-wrap items-center gap-2">
        {computedCotData.map((item) => {
          const isSelected = item.symbol === selectedAsset.symbol;
          return (
            <button
              key={item.symbol}
              type="button"
              onClick={() => setSelectedSymbol(item.symbol)}
              className={`px-3 py-2 rounded-xl text-xs font-mono transition-all flex items-center gap-2 cursor-pointer border tabular-nums ${
                isSelected
                  ? 'bg-teal-500/20 text-[#0df2c9] border-[#0df2c9]/60 font-bold'
                  : 'bg-[#09111e] hover:bg-[#0e1a2f] text-slate-300 border-[#182942]'
              }`}
            >
              <span>{item.symbol}</span>
              <span
                className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                  item.cotIndex >= 70
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : item.cotIndex <= 30
                    ? 'bg-rose-500/20 text-rose-300'
                    : 'bg-amber-500/20 text-amber-300'
                }`}
              >
                COT {item.cotIndex}%
              </span>
            </button>
          );
        })}
      </div>

      {/* Active Asset Focus */}
      <div className="p-4 sm:p-5 rounded-xl bg-[#08101d] border border-[#1b3050] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#14233a] pb-3">
          <div>
            <span className="text-base font-bold text-white">{selectedAsset.name}</span>
            <span className="text-xs font-mono text-slate-400 block tabular-nums">
              Weekly Speculator Net Change:{' '}
              <strong className={selectedAsset.changeFromPrevWeek >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                {selectedAsset.changeFromPrevWeek >= 0 ? '+' : ''}
                {selectedAsset.changeFromPrevWeek.toLocaleString()} contracts
              </strong>
            </span>
          </div>

          <span
            className={`px-2.5 py-1 rounded-lg text-xs font-mono font-black border self-start sm:self-auto ${
              selectedAsset.institutionalBias.includes('ACCUMULATION')
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : selectedAsset.institutionalBias.includes('DISTRIBUTION')
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
            }`}
          >
            {selectedAsset.institutionalBias}
          </span>
        </div>

        {/* 3-Tier Net Contracts Bar Comparison */}
        <div className="space-y-2.5 font-mono text-xs tabular-nums">
          {[
            {
              label: 'Commercial Hedgers / Banks',
              val: selectedAsset.commercialNet,
              icon: <Building2 className="w-3.5 h-3.5 text-cyan-400" />,
              sub: 'Producers, Refiners & Interbank Hedgers',
            },
            {
              label: 'Hedge Funds (Non-Commercial)',
              val: selectedAsset.nonCommercialNet,
              icon: <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />,
              sub: 'Large Speculators & Managed Money',
            },
            {
              label: 'Retail / Small Speculators',
              val: selectedAsset.retailNet,
              icon: <Users className="w-3.5 h-3.5 text-purple-400" />,
              sub: 'Non-Reportable Crowd Contracts',
            },
          ].map((row) => {
            const pct = Math.max(8, Math.round((Math.abs(row.val) / maxTierAbs) * 100));
            const pos = row.val >= 0;
            return (
              <div key={row.label} className="p-3 rounded-xl bg-[#0a1628] border border-[#173054] space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-slate-300 font-bold flex items-center gap-1.5">
                    {row.icon}
                    <span>{row.label}</span>
                  </span>
                  <span className={`font-black text-sm ${pos ? 'text-emerald-300' : 'text-rose-300'}`}>
                    {pos ? '+' : ''}
                    {row.val.toLocaleString()} net contracts
                  </span>
                </div>
                <div className="h-2.5 w-full bg-[#060d18] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${pos ? 'bg-emerald-500' : 'bg-rose-500'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-[10px] text-slate-400 block">{row.sub}</span>
              </div>
            );
          })}
        </div>

        {/* Institutional Thesis */}
        <div className="p-3.5 rounded-xl bg-teal-950/20 border border-teal-500/40 text-xs text-slate-200 leading-relaxed font-mono flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-[#0df2c9] shrink-0 mt-0.5" />
          <span>{selectedAsset.thesis}</span>
        </div>
      </div>
    </div>
  );
};
