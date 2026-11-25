import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, ShieldAlert, TrendingUp } from 'lucide-react';
import { loadManagedClosedTrades } from '../../utils/paperTradeManager.ts';
import { PAPER_POSITIONS_EVENT } from '../../utils/portfolioGuard.ts';
import { CLOUD_TRADING_HYDRATED_EVENT } from '../../utils/tradingCloudSync.ts';

interface PropPreset {
  id: string;
  label: string;
  accountSize: number;
  targetPct: number;
  dailyDdPct: number;
  maxDdPct: number;
}

const PROP_PRESETS: PropPreset[] = [
  { id: 'ftmo-100k', label: 'FTMO $100k Challenge', accountSize: 100000, targetPct: 10, dailyDdPct: 5, maxDdPct: 10 },
  { id: 'funded-50k', label: 'FundedNext $50k', accountSize: 50000, targetPct: 10, dailyDdPct: 5, maxDdPct: 10 },
  { id: 'personal-10k', label: 'Personal $10k Growth', accountSize: 10000, targetPct: 20, dailyDdPct: 5, maxDdPct: 15 },
];

export const MonteCarloPropSimulator: React.FC = () => {
  const [closedTrades, setClosedTrades] = useState(() => loadManagedClosedTrades());
  const [presetId, setPresetId] = useState<string>('ftmo-100k');
  const [useJournalBootstrap, setUseJournalBootstrap] = useState<boolean>(true);
  const [riskPerTradePct, setRiskPerTradePct] = useState<number>(1.0);
  const [customWinRatePct, setCustomWinRatePct] = useState<number>(56);
  const [customRewardRisk, setCustomRewardRisk] = useState<number>(2.1);
  const [tradesHorizon, setTradesHorizon] = useState<number>(60);

  useEffect(() => {
    const sync = () => setClosedTrades(loadManagedClosedTrades());
    window.addEventListener(PAPER_POSITIONS_EVENT, sync);
    window.addEventListener(CLOUD_TRADING_HYDRATED_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(PAPER_POSITIONS_EVENT, sync);
      window.removeEventListener(CLOUD_TRADING_HYDRATED_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const preset = PROP_PRESETS.find((p) => p.id === presetId) || PROP_PRESETS[0];

  const journalStats = useMemo(() => {
    if (closedTrades.length < 4) {
      return {
        hasEnoughData: false,
        winRatePct: customWinRatePct,
        avgRewardRisk: customRewardRisk,
        halfKellyPct: 1.25,
        rMultiples: [] as number[],
      };
    }

    const wins = closedTrades.filter((t) => t.outcome === 'WIN');
    const losses = closedTrades.filter((t) => t.outcome === 'LOSS');
    const avgLossDollar =
      losses.length > 0
        ? losses.reduce((s, t) => s + Math.abs(Number(t.pnl) || 0), 0) / losses.length
        : 100;
    const safeUnit = Math.max(10, avgLossDollar);

    const rMultiples = closedTrades.map((t) => {
      const r = (Number(t.pnl) || 0) / safeUnit;
      return Math.max(-2.0, Math.min(5.0, r));
    });

    const avgWinDollar =
      wins.length > 0 ? wins.reduce((s, t) => s + Math.max(0, Number(t.pnl) || 0), 0) / wins.length : safeUnit * 1.5;
    const wr = wins.length / closedTrades.length;
    const rr = Math.max(0.5, avgWinDollar / safeUnit);
    const fullKelly = wr - (1 - wr) / rr;
    const halfKellyPct = Math.max(0.25, Math.min(2.5, Math.round(fullKelly * 0.5 * 1000) / 10));

    return {
      hasEnoughData: true,
      winRatePct: Math.round(wr * 100),
      avgRewardRisk: Number(rr.toFixed(2)),
      halfKellyPct,
      rMultiples,
    };
  }, [closedTrades, customWinRatePct, customRewardRisk]);

  const effectiveWinRate = useJournalBootstrap && journalStats.hasEnoughData ? journalStats.winRatePct : customWinRatePct;
  const effectiveRR = useJournalBootstrap && journalStats.hasEnoughData ? journalStats.avgRewardRisk : customRewardRisk;

  const simulation = useMemo(() => {
    const pathsCount = 1000;
    const targetEquity = preset.accountSize * (1 + preset.targetPct / 100);
    const ruinEquity = preset.accountSize * (1 - preset.maxDdPct / 100);

    let seed =
      Math.round(
        effectiveWinRate * 17 +
          effectiveRR * 43 +
          riskPerTradePct * 31 +
          tradesHorizon * 11 +
          preset.accountSize * 0.001
      ) || 409;
    const nextRand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    const pWin = effectiveWinRate / 100;
    const sampleCurves: number[][] = [];
    const finalEquities: number[] = [];
    let passCount = 0;
    let ruinCount = 0;
    let dailyBreachCount = 0;

    for (let i = 0; i < pathsCount; i++) {
      let equity = preset.accountSize;
      let peak = preset.accountSize;
      let passed = false;
      let ruined = false;
      let dailyHit = false;
      let lossStreak = 0;
      const curve: number[] = i < 18 ? [equity] : [];

      for (let t = 0; t < tradesHorizon; t++) {
        if (!passed && !ruined) {
          let rMult: number;
          if (useJournalBootstrap && journalStats.hasEnoughData && journalStats.rMultiples.length > 0) {
            const idx = Math.floor(nextRand() * journalStats.rMultiples.length);
            rMult = journalStats.rMultiples[idx];
          } else {
            rMult = nextRand() < pWin ? effectiveRR : -1;
          }

          if (rMult < 0) lossStreak++;
          else lossStreak = 0;

          equity += equity * (riskPerTradePct / 100) * rMult;
          if (equity > peak) peak = equity;

          if (equity >= targetEquity) passed = true;
          if (equity <= ruinEquity || ((peak - equity) / peak) * 100 >= preset.maxDdPct) ruined = true;
          if (lossStreak * riskPerTradePct >= preset.dailyDdPct) dailyHit = true;
        }
        if (i < 18) curve.push(equity);
      }

      if (passed && !ruined) passCount++;
      if (ruined) ruinCount++;
      if (dailyHit) dailyBreachCount++;
      finalEquities.push(equity);
      if (i < 18) sampleCurves.push(curve);
    }

    finalEquities.sort((a, b) => a - b);
    const p10 = finalEquities[Math.floor(pathsCount * 0.1)];
    const p50 = finalEquities[Math.floor(pathsCount * 0.5)];
    const p90 = finalEquities[Math.floor(pathsCount * 0.9)];

    return {
      passProbPct: Number(((passCount / pathsCount) * 100).toFixed(1)),
      ruinProbPct: Number(((ruinCount / pathsCount) * 100).toFixed(1)),
      dailyBreachPct: Number(((dailyBreachCount / pathsCount) * 100).toFixed(1)),
      p10,
      p50,
      p90,
      targetEquity,
      ruinEquity,
      sampleCurves,
    };
  }, [
    preset,
    effectiveWinRate,
    effectiveRR,
    riskPerTradePct,
    tradesHorizon,
    useJournalBootstrap,
    journalStats.hasEnoughData,
    journalStats.rMultiples,
  ]);

  const halfKellySuggested = useMemo(() => {
    const p = effectiveWinRate / 100;
    const k = p - (1 - p) / Math.max(0.25, effectiveRR);
    return Math.max(0.25, Math.min(2.5, Number((k * 0.5 * 100).toFixed(2))));
  }, [effectiveWinRate, effectiveRR]);

  // Build SVG path geometry
  const svgWidth = 640;
  const svgHeight = 190;
  const minVal = Math.min(simulation.ruinEquity * 0.98, simulation.p10 * 0.96);
  const maxVal = Math.max(simulation.targetEquity * 1.03, simulation.p90 * 1.02);
  const span = Math.max(1, maxVal - minVal);
  const toX = (step: number) => (step / Math.max(1, tradesHorizon)) * svgWidth;
  const toY = (val: number) => svgHeight - ((val - minVal) / span) * svgHeight;

  return (
    <div className="rounded-2xl bg-[#0b1220] border border-[#172642] p-4 sm:p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#142036] pb-3">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[#0df2c9]" />
            <h3 className="text-sm sm:text-base font-bold text-white">
              1,000-Path Monte Carlo &amp; Prop Challenge Odds
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {useJournalBootstrap && journalStats.hasEnoughData
              ? `Bootstrapped directly from your ${closedTrades.length} real closed journal trades`
              : 'Parametric 1,000-path equity simulation'}
            {' · '}Half-Kelly optimal risk: <span className="font-mono text-[#0df2c9]">{halfKellySuggested}%</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={presetId}
            onChange={(e) => setPresetId(e.target.value)}
            aria-label="Challenge preset"
            className="px-2.5 py-1.5 rounded-lg bg-[#070c16] border border-[#1b2c48] text-xs text-slate-200 focus:outline-none focus:border-teal-500 cursor-pointer"
          >
            {PROP_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setUseJournalBootstrap((v) => !v)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              useJournalBootstrap && journalStats.hasEnoughData
                ? 'bg-teal-500/15 border-teal-500/45 text-[#0df2c9]'
                : 'bg-[#070c16] border-[#1b2c48] text-slate-300'
            }`}
          >
            {journalStats.hasEnoughData
              ? useJournalBootstrap
                ? 'Source: Real Journal'
                : 'Source: Custom Inputs'
              : 'Custom Mode (<4 Journal Trades)'}
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        <div className="p-3 rounded-xl bg-[#070c16] border border-[#142036]">
          <div className="flex justify-between text-slate-400">
            <span>Risk / Trade</span>
            <span className="font-mono text-[#0df2c9]">{riskPerTradePct.toFixed(2)}%</span>
          </div>
          <input
            type="range"
            min={0.25}
            max={3.0}
            step={0.25}
            value={riskPerTradePct}
            onChange={(e) => setRiskPerTradePct(Number(e.target.value))}
            className="w-full mt-2 accent-teal-400 cursor-pointer"
          />
        </div>

        <div className="p-3 rounded-xl bg-[#070c16] border border-[#142036]">
          <div className="flex justify-between text-slate-400">
            <span>Win Rate</span>
            <span className="font-mono text-white">{effectiveWinRate}%</span>
          </div>
          <input
            type="range"
            min={25}
            max={85}
            step={1}
            disabled={useJournalBootstrap && journalStats.hasEnoughData}
            value={effectiveWinRate}
            onChange={(e) => setCustomWinRatePct(Number(e.target.value))}
            className="w-full mt-2 accent-teal-400 cursor-pointer disabled:opacity-50"
          />
        </div>

        <div className="p-3 rounded-xl bg-[#070c16] border border-[#142036]">
          <div className="flex justify-between text-slate-400">
            <span>Avg Reward : Risk</span>
            <span className="font-mono text-white">1:{effectiveRR}</span>
          </div>
          <input
            type="range"
            min={0.8}
            max={4.5}
            step={0.1}
            disabled={useJournalBootstrap && journalStats.hasEnoughData}
            value={effectiveRR}
            onChange={(e) => setCustomRewardRisk(Number(e.target.value))}
            className="w-full mt-2 accent-teal-400 cursor-pointer disabled:opacity-50"
          />
        </div>

        <div className="p-3 rounded-xl bg-[#070c16] border border-[#142036]">
          <div className="flex justify-between text-slate-400">
            <span>Trades Horizon</span>
            <span className="font-mono text-white">{tradesHorizon} trades</span>
          </div>
          <input
            type="range"
            min={20}
            max={120}
            step={10}
            value={tradesHorizon}
            onChange={(e) => setTradesHorizon(Number(e.target.value))}
            className="w-full mt-2 accent-teal-400 cursor-pointer"
          />
        </div>
      </div>

      {/* KPI Results */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-[#070c16] border border-[#142036]">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            <span>Pass +{preset.targetPct}% Target</span>
          </div>
          <div className="text-xl font-bold font-mono tabular-nums text-emerald-400 mt-1">
            {simulation.passProbPct}%
          </div>
          <div className="text-[11px] text-slate-500 font-mono mt-0.5">
            Goal: ${simulation.targetEquity.toLocaleString()}
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-[#070c16] border border-[#142036]">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            <span>Max DD Ruin (-{preset.maxDdPct}%)</span>
          </div>
          <div
            className={`text-xl font-bold font-mono tabular-nums mt-1 ${
              simulation.ruinProbPct <= 5 ? 'text-emerald-400' : simulation.ruinProbPct <= 15 ? 'text-amber-400' : 'text-rose-400'
            }`}
          >
            {simulation.ruinProbPct}%
          </div>
          <div className="text-[11px] text-slate-500 font-mono mt-0.5">
            Daily 5% breach: {simulation.dailyBreachPct}%
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-[#070c16] border border-[#142036]">
          <div className="text-xs text-slate-400">Median Outcome (P50)</div>
          <div className="text-xl font-bold font-mono tabular-nums text-white mt-1">
            ${Math.round(simulation.p50).toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500 font-mono mt-0.5">
            P10: ${Math.round(simulation.p10).toLocaleString()}
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-[#070c16] border border-[#142036]">
          <div className="text-xs text-slate-400">Top Decile (P90)</div>
          <div className="text-xl font-bold font-mono tabular-nums text-[#0df2c9] mt-1">
            ${Math.round(simulation.p90).toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500 font-mono mt-0.5">
            Half-Kelly Risk: {halfKellySuggested}%
          </div>
        </div>
      </div>

      {/* SVG Equity Fan Chart */}
      <div className="p-3.5 rounded-xl bg-[#070c16] border border-[#142036]">
        <div className="flex items-center justify-between text-[11px] text-slate-400 mb-2 font-mono">
          <span>18 Sampled Paths out of 1,000 Equity Simulations</span>
          <span>
            Green Line: +${Math.round(simulation.targetEquity - preset.accountSize).toLocaleString()} Target · Red Line: -${Math.round(preset.accountSize - simulation.ruinEquity).toLocaleString()} Limit
          </span>
        </div>
        <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-44 overflow-visible">
          {/* Target Line */}
          <line
            x1={0}
            y1={toY(simulation.targetEquity)}
            x2={svgWidth}
            y2={toY(simulation.targetEquity)}
            stroke="#10b981"
            strokeDasharray="4 4"
            strokeOpacity={0.7}
          />
          {/* Ruin Line */}
          <line
            x1={0}
            y1={toY(simulation.ruinEquity)}
            x2={svgWidth}
            y2={toY(simulation.ruinEquity)}
            stroke="#f43f5e"
            strokeDasharray="4 4"
            strokeOpacity={0.7}
          />
          {/* Baseline Start */}
          <line
            x1={0}
            y1={toY(preset.accountSize)}
            x2={svgWidth}
            y2={toY(preset.accountSize)}
            stroke="#334155"
            strokeDasharray="2 3"
          />
          {simulation.sampleCurves.map((curve, idx) => {
            const d = curve
              .map((val, step) => `${step === 0 ? 'M' : 'L'} ${toX(step).toFixed(1)} ${toY(val).toFixed(1)}`)
              .join(' ');
            const final = curve[curve.length - 1] ?? preset.accountSize;
            const stroke =
              final >= simulation.targetEquity ? '#10b981' : final <= simulation.ruinEquity ? '#f43f5e' : '#2dd4bf';
            return (
              <path
                key={idx}
                d={d}
                fill="none"
                stroke={stroke}
                strokeWidth={1.35}
                strokeOpacity={0.65}
              />
            );
          })}
        </svg>
      </div>
    </div>
  );
};
