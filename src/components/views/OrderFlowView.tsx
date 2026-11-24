import React, { useState } from 'react';
import { Layers, ArrowRight } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext.tsx';
import { OrderFlowLiquidityDesk } from '../common/OrderFlowLiquidityDesk.tsx';
import { useTradingViewQuotes, resolveTradingViewPrice } from '../../utils/tradingViewSync.ts';

interface AssetPreset {
  ticker: string;
  name: string;
  market: 'FOREX' | 'CRYPTO' | 'INDICES' | 'NSE' | 'US';
  currency: string;
  price: number;
}

const ASSET_PRESETS: AssetPreset[] = [
  { ticker: 'XAU/USD', name: 'Spot Gold / US Dollar', market: 'FOREX', currency: 'USD', price: 3878.46 },
  { ticker: 'EUR/USD', name: 'Euro / US Dollar', market: 'FOREX', currency: 'USD', price: 1.1032 },
  { ticker: 'GBP/USD', name: 'British Pound / US Dollar', market: 'FOREX', currency: 'USD', price: 1.3222 },
  { ticker: 'USD/JPY', name: 'US Dollar / Japanese Yen', market: 'FOREX', currency: 'JPY', price: 159.86 },
  { ticker: 'BTC/USD', name: 'Bitcoin / US Dollar (Binance Taker Delta)', market: 'CRYPTO', currency: 'USD', price: 94250 },
  { ticker: 'ETH/USD', name: 'Ethereum / US Dollar (Binance Taker Delta)', market: 'CRYPTO', currency: 'USD', price: 3180 },
  { ticker: 'NAS100', name: 'Nasdaq 100 Index', market: 'INDICES', currency: 'USD', price: 27744.26 },
  { ticker: 'USD/KES', name: 'US Dollar / Kenyan Shilling', market: 'FOREX', currency: 'KES', price: 129.86 },
  { ticker: 'R_100', name: 'Deriv Volatility 100 (24/7)', market: 'INDICES', currency: 'USD', price: 1450 },
  { ticker: 'AAPL', name: 'Apple Inc.', market: 'US', currency: 'USD', price: 228.5 },
  { ticker: 'SCOM', name: 'Safaricom PLC', market: 'NSE', currency: 'KES', price: 17.65 },
];

export const OrderFlowView: React.FC = () => {
  const { setActiveTab } = useFinance();
  const [selectedAsset, setSelectedAsset] = useState<AssetPreset>(ASSET_PRESETS[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const liveTvQuotes = useTradingViewQuotes();
  const liveAssetPrice = resolveTradingViewPrice(liveTvQuotes, selectedAsset.ticker, selectedAsset.price);

  const filteredPresets = searchQuery.trim()
    ? ASSET_PRESETS.filter(
        (a) =>
          a.ticker.toLowerCase().includes(searchQuery.toLowerCase()) ||
          a.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : ASSET_PRESETS;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-[#0a182c] via-[#091526] to-[#060c18] border border-teal-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-teal-500/15 border border-teal-500/40 flex items-center justify-center text-[#0df2c9] shrink-0">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] text-teal-400 font-mono font-bold uppercase tracking-wider">
              Candle-Verified Institutional Market Depth
            </span>
            <h1 className="text-xl md:text-2xl font-black text-white mt-0.5">
              Order Flow, Volume Profile & Liquidity Radar
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              Real OHLCV-computed Point of Control (POC), 70% Value Area, unmitigated Order Blocks, Fair Value Gaps (FVGs), Buy/Sell Volume Delta bars, and swing liquidity clusters.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setActiveTab('stocks')}
          className="self-start md:self-auto px-3.5 py-2 rounded-xl bg-[#0e1c33] hover:bg-[#152a4d] border border-teal-500/40 text-teal-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm"
        >
          <span>Open Full Terminal & Chart</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Asset Selector Strip */}
      <div className="p-3 rounded-2xl bg-[#091120] border border-[#162744] flex flex-wrap items-center justify-between gap-3 shadow-md">
        <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono">
          {filteredPresets.map((asset) => (
            <button
              key={asset.ticker}
              type="button"
              onClick={() => setSelectedAsset(asset)}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                selectedAsset.ticker === asset.ticker
                  ? 'bg-teal-500 text-slate-950 font-black shadow-md shadow-teal-500/20'
                  : 'bg-[#060c18] text-slate-300 hover:text-white border border-[#132238]'
              }`}
            >
              {asset.ticker}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-52 text-xs font-mono">
          <input
            type="text"
            placeholder="Filter assets or type custom..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && searchQuery.trim() && filteredPresets.length === 0) {
                setSelectedAsset({
                  ticker: searchQuery.trim().toUpperCase(),
                  name: searchQuery.trim().toUpperCase(),
                  market: 'FOREX',
                  currency: 'USD',
                  price: liveAssetPrice || 100,
                });
              }
            }}
            className="w-full px-3 py-1.5 rounded-xl bg-[#060c18] border border-[#14233c] text-white placeholder-slate-500 text-xs focus:outline-none focus:border-teal-500"
          />
        </div>
      </div>

      {/* Main Order Flow Liquidity Desk */}
      <OrderFlowLiquidityDesk
        currentTicker={selectedAsset.ticker}
        currentPrice={liveAssetPrice}
        currency={selectedAsset.currency}
        onApplyZoneToOrder={(entry, sl, tp) => {
          try {
            window.dispatchEvent(
              new CustomEvent('njia-jarvis-focus-asset', {
                detail: { symbol: selectedAsset.ticker, bottomTab: 'paper' },
              })
            );
            sessionStorage.setItem(
              'njia_jarvis_pending_focus',
              JSON.stringify({ symbol: selectedAsset.ticker, bottomTab: 'paper', entry, sl, tp })
            );
          } catch {}
          setActiveTab('stocks');
        }}
      />
    </div>
  );
};
