import React, { useMemo, useState, useEffect } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  Activity,
  Scale,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import {
  loadOpenPaperPositions,
  SimpleOpenPos,
  PAPER_POSITIONS_EVENT,
} from '../../utils/portfolioGuard.ts';
import { CLOUD_TRADING_HYDRATED_EVENT } from '../../utils/tradingCloudSync.ts';
import { useTradingViewQuotes, lookupTradingViewQuote } from '../../utils/tradingViewSync.ts';

interface ExposureAndSpreadGuardDeskProps {
  currentTicker: string;
  currentPrice: number;
}

function splitCurrencies(ticker: string, direction: 'LONG' | 'SHORT' | 'BUY' | 'SELL') {
  const isLong = direction === 'LONG' || direction === 'BUY';
  const sign = isLong ? 1 : -1;
  const clean = ticker.replace(/\s+/g, '').toUpperCase();
  if (clean.includes('/')) {
    const [b, q] = clean.split('/');
    return { base: b || clean, quote: q || 'USD', sign };
  }
  if (clean.length === 6 && !clean.startsWith('R_') && !clean.startsWith('1HZ')) {
    return { base: clean.slice(0, 3), quote: clean.slice(3, 6), sign };
  }
  return { base: clean, quote: 'USD', sign };
}

export const ExposureAndSpreadGuardDesk: React.FC<ExposureAndSpreadGuardDeskProps> = ({
  currentTicker,
  currentPrice,
}) => {
  const [openPositions, setOpenPositions] = useState<SimpleOpenPos[]>(() =>
    loadOpenPaperPositions()
  );

  const liveQuotes = useTradingViewQuotes(3200);
  const liveQuote = lookupTradingViewQuote(liveQuotes, currentTicker);

  const isGold = currentTicker.includes('XAU');
  const isJpy = currentTicker.includes('JPY');
  const isIndex = currentTicker.includes('NAS') || currentTicker.includes('US30') || currentTicker.includes('SPX');
  const pipDivisor = isGold ? 0.1 : isJpy ? 0.01 : isIndex ? 1 : currentPrice < 10 ? 0.0001 : 0.01;
  const digits = isJpy ? 3 : isGold || isIndex || currentPrice >= 20 ? 2 : 5;

  // Derive live L1 bid-ask spread in pips/points when TradingView provides bid & ask
  const liveFeedSpreadPips = useMemo(() => {
    if (
      typeof liveQuote?.bid === 'number' &&
      typeof liveQuote?.ask === 'number' &&
      liveQuote.bid > 0 &&
      liveQuote.ask >= liveQuote.bid
    ) {
      const rawDiff = liveQuote.ask - liveQuote.bid;
      return Math.max(0.1, Number((rawDiff / pipDivisor).toFixed(2)));
    }
    return null;
  }, [liveQuote?.bid, liveQuote?.ask, pipDivisor]);

  const [useLiveSpread, setUseLiveSpread] = useState<boolean>(true);
  const [targetSlPips, setTargetSlPips] = useState<number>(isGold ? 25 : isIndex ? 40 : 15);
  const [manualSpreadPips, setManualSpreadPips] = useState<number>(isGold ? 2.4 : isIndex ? 1.8 : 0.9);

  // Monte Carlo Risk-of-Ruin parameters (seeded from real journal stats if present)
  const [winRatePct, setWinRatePct] = useState<number>(55);
  const [rewardRisk, setRewardRisk] = useState<number>(2.0);
  const [riskPerTradePct, setRiskPerTradePct] = useState<number>(1.0);
  const [maxDdLimitPct, setMaxDdLimitPct] = useState<number>(10.0);

  useEffect(() => {
    setTargetSlPips(isGold ? 25 : isIndex ? 40 : 15);
    setManualSpreadPips(isGold ? 2.4 : isIndex ? 1.8 : 0.9);
  }, [currentTicker, isGold, isIndex]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('njia_paper_trades');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length >= 4) {
          const wins = parsed.filter((t: { outcome?: string }) => t.outcome === 'WIN').length;
          const wr = Math.round((wins / parsed.length) * 100);
          if (wr >= 20 && wr <= 90) setWinRatePct(wr);
        }
      }
    } catch {
      // ignore storage parse failure
    }
  }, []);

  useEffect(() => {
    const sync = () => setOpenPositions(loadOpenPaperPositions());
    window.addEventListener(PAPER_POSITIONS_EVENT, sync);
    window.addEventListener(CLOUD_TRADING_HYDRATED_EVENT, sync);
    return () => {
      window.removeEventListener(PAPER_POSITIONS_EVENT, sync);
      window.removeEventListener(CLOUD_TRADING_HYDRATED_EVENT, sync);
    };
  }, []);

  const activeSpreadPips =
    useLiveSpread && liveFeedSpreadPips !== null ? liveFeedSpreadPips : manualSpreadPips;

  // Net currency exposure aggregator across all open trades
  const currencyExposure = useMemo(() => {
    const netMap: Record<string, number> = {};
    for (const pos of openPositions) {
      const { base, quote, sign } = splitCurrencies(pos.ticker, pos.direction);
      const lots = Number(pos.lots) || 0.1;
      netMap[base] = (netMap[base] || 0) + sign * lots;
      netMap[quote] = (netMap[quote] || 0) - sign * lots;
    }

    return Object.entries(netMap)
      .map(([currency, netLots]) => ({
        currency,
        netLots: Number(netLots.toFixed(2)),
      }))
      .filter((x) => Math.abs(x.netLots) > 0.001)
      .sort((a, b) => Math.abs(b.netLots) - Math.abs(a.netLots));
  }, [openPositions]);

  // Rollover dead-zone window check (21:00 - 23:00 UTC)
  const rolloverStatus = useMemo(() => {
    const now = new Date();
    const utcHour = now.getUTCHours();
    const utcMin = now.getUTCMinutes();
    const isRolloverWindow = utcHour === 21 || utcHour === 22;
    const spreadMultiplier = isRolloverWindow && !useLiveSpread ? 3.5 : 1.0;
    const effectiveSpread = Number((activeSpreadPips * spreadMultiplier).toFixed(2));
    const spreadTaxPct = targetSlPips > 0 ? Number(((effectiveSpread / targetSlPips) * 100).toFixed(1)) : 100;

    return {
      utcClock: `${String(utcHour).padStart(2, '0')}:${String(utcMin).padStart(2, '0')} UTC`,
      isRolloverWindow,
      effectiveSpread,
      spreadTaxPct,
      verdict:
        spreadTaxPct > 20
          ? 'BLOCK / AVOID: Spread eats >20% of Stop Loss'
          : spreadTaxPct > 12
          ? 'CAUTION: Tight SL faces high spread drag'
          : 'OPTIMAL: Clean execution cost relative to SL',
    };
  }, [activeSpreadPips, targetSlPips, useLiveSpread]);

  // Fast deterministic 500-path Monte Carlo simulation (100 trades per path)
  const monteCarlo = useMemo(() => {
    const pWin = winRatePct / 100;
    const expectancyR = Number((pWin * rewardRisk - (1 - pWin) * 1).toFixed(2));
    let seed = Math.round(winRatePct * 13 + rewardRisk * 37 + riskPerTradePct * 19 + maxDdLimitPct * 7) || 101;
    const nextRand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    const paths = 500;
    const tradesPerPath = 100;
    let breachedMaxDd = 0;
    let breachedDaily5 = 0;
    const finalReturns: number[] = [];

    for (let p = 0; p < paths; p++) {
      let equity = 100;
      let peak = 100;
      let hitMax = false;
      let hitDaily = false;
      let lossesInRow = 0;

      for (let t = 0; t < tradesPerPath; t++) {
        const isWin = nextRand() < pWin;
        if (isWin) {
          equity += equity * (riskPerTradePct / 100) * rewardRisk;
          lossesInRow = 0;
        } else {
          equity -= equity * (riskPerTradePct / 100);
          lossesInRow += 1;
        }
        if (equity > peak) peak = equity;
        const ddPct = ((peak - equity) / peak) * 100;
        if (ddPct >= maxDdLimitPct) hitMax = true;
        if (lossesInRow * riskPerTradePct >= 5) hitDaily = true;
      }

      if (hitMax) breachedMaxDd++;
      if (hitDaily) breachedDaily5++;
      finalReturns.push(equity - 100);
    }

    finalReturns.sort((a, b) => a - b);
    const medianReturnPct = Number(finalReturns[Math.floor(paths / 2)].toFixed(1));
    const maxRuinProb = Number(((breachedMaxDd / paths) * 100).toFixed(1));
    const dailyBreachProb = Number(((breachedDaily5 / paths) * 100).toFixed(1));

    return {
      expectancyR,
      maxRuinProb,
      dailyBreachProb,
      medianReturnPct,
    };
  }, [winRatePct, rewardRisk, riskPerTradePct, maxDdLimitPct]);

  return (
    <div className="rounded-2xl bg-[#090e1a] border border-[#162540] p-5 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#141f33] pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-500/12 border border-teal-500/30 flex items-center justify-center text-[#0df2c9] shrink-0">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">
              Portfolio Exposure, Live L1 Spread Guard &amp; Risk-of-Ruin
            </h3>
            <p className="text-xs text-slate-400">
              Aggregate currency risk, live TradingView Bid/Ask spread tax, and 500-path prop-firm Monte Carlo odds
            </p>
          </div>
        </div>

        <div className="text-xs font-mono text-slate-400 flex flex-wrap items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-[#0df2c9]" />
          <span>{rolloverStatus.utcClock}</span>
          <span>·</span>
          <span>
            {currentTicker} @ {currentPrice.toFixed(digits)}
          </span>
          {liveQuote?.bid && liveQuote?.ask && (
            <span className="text-[#0df2c9]">
              · L1 {liveQuote.bid.toFixed(digits)} / {liveQuote.ask.toFixed(digits)}
            </span>
          )}
        </div>
      </div>

      {/* Top Row: Portfolio Exposure + Spread-to-SL Guard */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Net Currency Exposure */}
        <div className="p-4 rounded-xl bg-[#0c1424] border border-[#182744] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white">Net Currency Exposure ({openPositions.length} Open)</span>
            <span className="text-[11px] font-mono text-slate-400">Live Paper Sync</span>
          </div>

          {currencyExposure.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-400 border border-dashed border-[#1a2b46] rounded-lg">
              No open paper positions right now. Open trades in Paper Terminal will automatically aggregate here to catch hidden USD or Gold stacking.
            </div>
          ) : (
            <div className="space-y-2">
              {currencyExposure.map((row) => {
                const isHeavy = Math.abs(row.netLots) >= 0.6;
                return (
                  <div
                    key={row.currency}
                    className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#080f1c] border border-[#16243d] text-xs font-mono"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white">{row.currency}</span>
                      {isHeavy && (
                        <span className="text-amber-400 flex items-center gap-1 text-[11px]">
                          <AlertTriangle className="w-3 h-3" /> Stacked
                        </span>
                      )}
                    </div>
                    <span className={row.netLots >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                      {row.netLots >= 0 ? `LONG +${row.netLots}L` : `SHORT ${row.netLots}L`}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Spread-to-SL & Rollover Guard */}
        <div className="p-4 rounded-xl bg-[#0c1424] border border-[#182744] space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold text-white">Live L1 Spread &amp; SL Tax Guard</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setUseLiveSpread((v) => !v)}
                className={`px-2 py-0.5 rounded text-[10px] font-mono border cursor-pointer ${
                  useLiveSpread && liveFeedSpreadPips !== null
                    ? 'bg-[#0df2c9]/15 text-[#0df2c9] border-[#0df2c9]/40'
                    : 'bg-[#080f1c] text-slate-400 border-[#1b2c48]'
                }`}
              >
                {liveFeedSpreadPips !== null ? (useLiveSpread ? 'Live Bid/Ask Sync' : 'Manual Test') : 'Manual Input'}
              </button>
              <span
                className={`text-[11px] font-mono font-semibold ${
                  rolloverStatus.isRolloverWindow ? 'text-rose-400' : 'text-emerald-400'
                }`}
              >
                {rolloverStatus.isRolloverWindow ? 'Rollover Window' : 'Liquid Session'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">
                {useLiveSpread && liveFeedSpreadPips !== null ? 'Live Market Spread' : 'Test Spread'} ({isGold || isIndex ? 'pts' : 'pips'})
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                disabled={useLiveSpread && liveFeedSpreadPips !== null}
                value={activeSpreadPips}
                onChange={(e) => setManualSpreadPips(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-full px-3 py-1.5 rounded-lg bg-[#080f1c] border border-[#1a2b46] disabled:text-[#0df2c9] text-xs font-mono text-white focus:outline-none focus:border-[#0df2c9]"
              />
            </div>

            <div>
              <label className="text-[11px] text-slate-400 block mb-1">
                Stop Loss Distance ({isGold || isIndex ? 'pts' : 'pips'})
              </label>
              <input
                type="number"
                step="1"
                min="1"
                value={targetSlPips}
                onChange={(e) => setTargetSlPips(Math.max(1, parseFloat(e.target.value) || 1))}
                className="w-full px-3 py-1.5 rounded-lg bg-[#080f1c] border border-[#1a2b46] text-xs font-mono text-white focus:outline-none focus:border-[#0df2c9]"
              />
            </div>
          </div>

          <div className="p-3 rounded-lg bg-[#080f1c] border border-[#16243d] flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] text-slate-400">Effective Spread Cost on Entry</div>
              <div className="text-xs font-semibold text-white mt-0.5">{rolloverStatus.verdict}</div>
            </div>
            <div className="text-right font-mono shrink-0">
              <div
                className={`text-lg font-bold ${
                  rolloverStatus.spreadTaxPct > 20
                    ? 'text-rose-400'
                    : rolloverStatus.spreadTaxPct > 12
                    ? 'text-amber-400'
                    : 'text-emerald-400'
                }`}
              >
                {rolloverStatus.spreadTaxPct}% of SL
              </div>
              <div className="text-[10px] text-slate-500">
                Eff. spread {rolloverStatus.effectiveSpread} {isGold || isIndex ? 'pts' : 'pips'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom: 500-Path Monte Carlo Prop Risk-of-Ruin */}
      <div className="p-4 rounded-xl bg-[#0c1424] border border-[#182744] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#0df2c9]" />
            <span className="text-xs font-bold text-white">
              500-Path Prop Firm Risk-of-Ruin Simulator (Next 100 Trades)
            </span>
          </div>
          <span className="text-xs font-mono text-slate-400">
            Expectancy:{' '}
            <strong className={monteCarlo.expectancyR >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
              {monteCarlo.expectancyR >= 0 ? '+' : ''}
              {monteCarlo.expectancyR}R / trade
            </strong>
          </span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="text-[11px] text-slate-400 block mb-1">Win Rate (%): {winRatePct}%</label>
            <input
              type="range"
              min="25"
              max="80"
              step="1"
              value={winRatePct}
              onChange={(e) => setWinRatePct(Number(e.target.value))}
              className="w-full accent-[#0df2c9]"
            />
          </div>

          <div>
            <label className="text-[11px] text-slate-400 block mb-1">Reward : Risk (1 : {rewardRisk})</label>
            <input
              type="range"
              min="0.8"
              max="5"
              step="0.1"
              value={rewardRisk}
              onChange={(e) => setRewardRisk(Number(e.target.value))}
              className="w-full accent-[#0df2c9]"
            />
          </div>

          <div>
            <label className="text-[11px] text-slate-400 block mb-1">Risk / Trade: {riskPerTradePct}%</label>
            <input
              type="range"
              min="0.25"
              max="4"
              step="0.25"
              value={riskPerTradePct}
              onChange={(e) => setRiskPerTradePct(Number(e.target.value))}
              className="w-full accent-[#0df2c9]"
            />
          </div>

          <div>
            <label className="text-[11px] text-slate-400 block mb-1">Max Drawdown Limit: {maxDdLimitPct}%</label>
            <input
              type="range"
              min="4"
              max="15"
              step="1"
              value={maxDdLimitPct}
              onChange={(e) => setMaxDdLimitPct(Number(e.target.value))}
              className="w-full accent-[#0df2c9]"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3 rounded-lg bg-[#080f1c] border border-[#16243d]">
            <div className="text-[11px] text-slate-400 flex items-center justify-between">
              <span>Max Drawdown Breach Odds</span>
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            </div>
            <div
              className={`text-lg font-bold font-mono mt-1 ${
                monteCarlo.maxRuinProb <= 5
                  ? 'text-emerald-400'
                  : monteCarlo.maxRuinProb <= 20
                  ? 'text-amber-400'
                  : 'text-rose-400'
              }`}
            >
              {monteCarlo.maxRuinProb}%
            </div>
          </div>

          <div className="p-3 rounded-lg bg-[#080f1c] border border-[#16243d]">
            <div className="text-[11px] text-slate-400 flex items-center justify-between">
              <span>5% Consecutive Streak Risk</span>
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-lg font-bold font-mono text-white mt-1">
              {monteCarlo.dailyBreachProb}%
            </div>
          </div>

          <div className="p-3 rounded-lg bg-[#080f1c] border border-[#16243d]">
            <div className="text-[11px] text-slate-400 flex items-center justify-between">
              <span>Median 100-Trade Return</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-[#0df2c9]" />
            </div>
            <div
              className={`text-lg font-bold font-mono mt-1 ${
                monteCarlo.medianReturnPct >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {monteCarlo.medianReturnPct >= 0 ? '+' : ''}
              {monteCarlo.medianReturnPct}%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
