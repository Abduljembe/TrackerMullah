import React, { useMemo } from 'react';
import {
  Crosshair,
  TrendingUp,
  TrendingDown,
  Zap,
  Compass,
} from 'lucide-react';
import { Candle } from '../../utils/stockCandles.ts';

interface LiquidityPoolMapDeskProps {
  currentTicker: string;
  currentPrice: number;
  candles: Candle[];
  onApplySetupToOrder?: (direction: 'LONG' | 'SHORT', sl: number, tp: number) => void;
}

export const LiquidityPoolMapDesk: React.FC<LiquidityPoolMapDeskProps> = ({
  currentTicker,
  currentPrice,
  candles,
  onApplySetupToOrder,
}) => {
  const isJpy = currentTicker.includes('JPY');
  const isGold = currentTicker.includes('XAU');
  const isIndex = currentTicker.includes('NAS') || currentTicker.includes('US30') || currentTicker.includes('SPX');
  const digits = isJpy ? 3 : isGold || isIndex || currentPrice >= 20 ? 2 : 5;
  const pipDivisor = isGold ? 0.1 : isJpy ? 0.01 : isIndex ? 1 : currentPrice < 10 ? 0.0001 : 0.01;

  const liquidityData = useMemo(() => {
    const valid = candles.length >= 12 ? candles : [];
    const fallbackRange = currentPrice * 0.008;

    const recentSlice = valid.slice(-24);
    const asianSlice = valid.slice(-36, -16).length > 4 ? valid.slice(-36, -16) : recentSlice.slice(0, 8);
    const priorSlice = valid.slice(0, Math.max(10, valid.length - 8));

    const pdh = recentSlice.length
      ? Math.max(...recentSlice.map((c) => c.high))
      : currentPrice + fallbackRange * 0.7;
    const pdl = recentSlice.length
      ? Math.min(...recentSlice.map((c) => c.low))
      : currentPrice - fallbackRange * 0.7;

    const pwh = valid.length
      ? Math.max(...valid.map((c) => c.high))
      : currentPrice + fallbackRange * 1.4;
    const pwl = valid.length
      ? Math.min(...valid.map((c) => c.low))
      : currentPrice - fallbackRange * 1.4;

    const asianHigh = asianSlice.length
      ? Math.max(...asianSlice.map((c) => c.high))
      : currentPrice + fallbackRange * 0.35;
    const asianLow = asianSlice.length
      ? Math.min(...asianSlice.map((c) => c.low))
      : currentPrice - fallbackRange * 0.35;

    const midnightOpen =
      priorSlice.length > 0 ? priorSlice[priorSlice.length - 1].open : currentPrice * 0.9992;

    const equilibrium = (pwh + pwl) / 2;
    const rangeSpan = Math.max(pwh - pwl, pipDivisor * 10);
    const rangePct = Math.min(100, Math.max(0, Math.round(((currentPrice - pwl) / rangeSpan) * 100)));

    const sweptAsianHigh = valid.slice(-6).some((c) => c.high > asianHigh) && currentPrice < asianHigh;
    const sweptAsianLow = valid.slice(-6).some((c) => c.low < asianLow) && currentPrice > asianLow;

    let sweepVerdict = 'Inside Asian Liquidity Box — Watch for Judas Sweep';
    let biasDirection: 'LONG' | 'SHORT' = currentPrice >= midnightOpen ? 'LONG' : 'SHORT';

    if (sweptAsianLow) {
      sweepVerdict = 'Sell-Side Liquidity (Asian Low) Swept — Reclaiming Upward';
      biasDirection = 'LONG';
    } else if (sweptAsianHigh) {
      sweepVerdict = 'Buy-Side Liquidity (Asian High) Swept — Distribution Lower';
      biasDirection = 'SHORT';
    } else if (currentPrice > asianHigh) {
      sweepVerdict = 'Expanded Above Asian High — Watch for Retest or Reversal';
      biasDirection = 'LONG';
    } else if (currentPrice < asianLow) {
      sweepVerdict = 'Expanded Below Asian Low — Watch for Lower Liquidity Magnet';
      biasDirection = 'SHORT';
    }

    const pools = [
      {
        name: 'Previous Week High (PWH)',
        type: 'BSL',
        price: pwh,
        side: 'Above' as const,
      },
      {
        name: 'Previous Day High (PDH)',
        type: 'BSL',
        price: pdh,
        side: 'Above' as const,
      },
      {
        name: 'Asian Session High',
        type: 'Asia BSL',
        price: asianHigh,
        side: currentPrice >= asianHigh ? ('Swept/Above' as const) : ('Above' as const),
      },
      {
        name: 'NY Midnight Open (00:00 EST)',
        type: 'Fair Value Pivot',
        price: midnightOpen,
        side: currentPrice >= midnightOpen ? ('Support' as const) : ('Resistance' as const),
      },
      {
        name: '50% Dealing Equilibrium',
        type: 'Mid-Range',
        price: equilibrium,
        side: currentPrice >= equilibrium ? ('Premium' as const) : ('Discount' as const),
      },
      {
        name: 'Asian Session Low',
        type: 'Asia SSL',
        price: asianLow,
        side: currentPrice <= asianLow ? ('Swept/Below' as const) : ('Below' as const),
      },
      {
        name: 'Previous Day Low (PDL)',
        type: 'SSL',
        price: pdl,
        side: 'Below' as const,
      },
      {
        name: 'Previous Week Low (PWL)',
        type: 'SSL',
        price: pwl,
        side: 'Below' as const,
      },
    ];

    const suggestedSl =
      biasDirection === 'LONG'
        ? Number((Math.min(asianLow, currentPrice - rangeSpan * 0.18)).toFixed(digits))
        : Number((Math.max(asianHigh, currentPrice + rangeSpan * 0.18)).toFixed(digits));

    const suggestedTp =
      biasDirection === 'LONG'
        ? Number(pdh.toFixed(digits))
        : Number(pdl.toFixed(digits));

    return {
      pools,
      rangePct,
      equilibrium,
      midnightOpen,
      asianHigh,
      asianLow,
      sweepVerdict,
      biasDirection,
      suggestedSl,
      suggestedTp,
    };
  }, [candles, currentPrice, digits, pipDivisor]);

  return (
    <div className="rounded-2xl bg-[#090e1a] border border-[#162540] p-5 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#141f33] pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-500/12 border border-teal-500/30 flex items-center justify-center text-[#0df2c9] shrink-0">
            <Crosshair className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">
              Institutional Liquidity Pool Map
            </h3>
            <p className="text-xs text-slate-400">
              PDH/PDL, PWH/PWL, Asian Range sweep status &amp; NY Midnight Open for {currentTicker}
            </p>
          </div>
        </div>

        {onApplySetupToOrder && (
          <button
            type="button"
            onClick={() =>
              onApplySetupToOrder(
                liquidityData.biasDirection,
                liquidityData.suggestedSl,
                liquidityData.suggestedTp
              )
            }
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0df2c9] hover:bg-[#19f7d0] text-slate-950 text-xs font-bold transition-colors cursor-pointer whitespace-nowrap self-start sm:self-auto"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Prefill {liquidityData.biasDirection} Liquidity Setup</span>
          </button>
        )}
      </div>

      {/* Verdict & Dealing Range Gauge */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl bg-[#0c1424] border border-[#182744] space-y-2">
          <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5 text-[#0df2c9]" />
            <span>Asian Session &amp; Midnight Open Sweep Status</span>
          </div>
          <div className="text-sm font-bold text-white">{liquidityData.sweepVerdict}</div>
          <div className="flex flex-wrap items-center gap-4 pt-1 text-xs font-mono text-slate-300">
            <span>
              NY Midnight: <strong className="text-white">{liquidityData.midnightOpen.toFixed(digits)}</strong>
            </span>
            <span className="flex items-center gap-1">
              {liquidityData.biasDirection === 'LONG' ? (
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
              )}
              <strong className={liquidityData.biasDirection === 'LONG' ? 'text-emerald-400' : 'text-rose-400'}>
                {liquidityData.biasDirection} Bias
              </strong>
            </span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#0c1424] border border-[#182744] space-y-2">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-slate-400">Premium / Discount Position</span>
            <span className={liquidityData.rangePct >= 50 ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>
              {liquidityData.rangePct}% ({liquidityData.rangePct >= 55 ? 'Premium Zone' : liquidityData.rangePct <= 45 ? 'Discount Zone' : 'Equilibrium'})
            </span>
          </div>
          <div className="relative h-3 rounded-full bg-[#070b13] border border-[#162540] overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-500/40 via-slate-500/30 to-rose-500/40 w-full"
            />
            <div
              className="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_8px_#fff]"
              style={{ left: `calc(${liquidityData.rangePct}% - 2px)` }}
            />
          </div>
          <div className="flex justify-between text-[10px] font-mono text-slate-500">
            <span>0% Discount (PWL)</span>
            <span>50% EQ ({liquidityData.equilibrium.toFixed(digits)})</span>
            <span>100% Premium (PWH)</span>
          </div>
        </div>
      </div>

      {/* Key Liquidity Pools Table */}
      <div className="rounded-xl border border-[#162540] overflow-hidden bg-[#070b13]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#141f33] bg-[#0a1120] text-slate-400 font-mono text-[11px]">
                <th className="py-2.5 px-4">Liquidity Level</th>
                <th className="py-2.5 px-3">Pool Type</th>
                <th className="py-2.5 px-3 text-right">Level Price</th>
                <th className="py-2.5 px-3 text-right">Distance</th>
                <th className="py-2.5 px-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#141f33]/70 font-mono">
              {liquidityData.pools.map((pool) => {
                const diff = pool.price - currentPrice;
                const pipsAway = Math.round(Math.abs(diff) / pipDivisor);
                const isAbove = diff >= 0;
                return (
                  <tr key={pool.name} className="hover:bg-[#0e1729] transition-colors">
                    <td className="py-2.5 px-4 font-sans font-semibold text-white">{pool.name}</td>
                    <td className="py-2.5 px-3 text-slate-400">{pool.type}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-200">
                      {pool.price.toFixed(digits)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-300">
                      {isAbove ? '+' : '-'}{pipsAway} {isGold || isIndex ? 'pts' : 'pips'}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <span
                        className={
                          pool.type.includes('BSL')
                            ? 'text-rose-400'
                            : pool.type.includes('SSL')
                            ? 'text-emerald-400'
                            : 'text-[#0df2c9]'
                        }
                      >
                        {pool.side}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
