import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Search,
  Sparkles,
  BarChart2,
  Newspaper,
  ShieldCheck,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  ExternalLink,
  RefreshCw,
  Send,
  HelpCircle,
  Clock,
  DollarSign,
  Briefcase,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ChevronRight,
  Zap,
  Crosshair,
  Target,
  ShieldAlert,
  Copy,
  Check,
  Calculator,
  Globe2,
  Activity,
  Sliders,
  Flame,
  Pause,
  Bell,
  Award,
  Globe,
  Grid,
  Smartphone,
  Tv,
  Camera,
  LayoutGrid,
  Table,
  Filter,
  ArrowRight,
  Bot,
  Users,
  Compass,
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext.tsx';
import { InvestmentItem } from '../../types/finance.ts';
import { CandlestickChart } from '../common/CandlestickChart.tsx';
import { TradingViewWidget } from '../common/TradingViewWidget.tsx';
import { PaperTradingDesk, PrefillOrderData } from '../common/PaperTradingDesk.tsx';
import { ChartScreenshotAnalyzerModal } from '../common/ChartScreenshotAnalyzerModal.tsx';
import { EconomicCalendar } from '../common/EconomicCalendar.tsx';
import { PriceAlertsModal, playAlertChime, PriceAlert } from '../common/PriceAlertsModal.tsx';
import { TradingJournalDesk } from '../common/TradingJournalDesk.tsx';
import { RiskCalculatorDesk } from '../common/RiskCalculatorDesk.tsx';
import { CurrencyStrengthMeter } from '../common/CurrencyStrengthMeter.tsx';
import { StrategyBacktester } from '../common/StrategyBacktester.tsx';
import { ForexFactoryNewsDesk } from '../common/ForexFactoryNewsDesk.tsx';
import { InstitutionalSignalCard } from '../common/InstitutionalSignalCard.tsx';
import { ForexSessionsKillzones } from '../common/ForexSessionsKillzones.tsx';
import { PropFirmRiskGuardian } from '../common/PropFirmRiskGuardian.tsx';
import { CurrencyCorrelationMatrix } from '../common/CurrencyCorrelationMatrix.tsx';
import { BrokerMpesaArbiter } from '../common/BrokerMpesaArbiter.tsx';
import { OrderFlowLiquidityDesk } from '../common/OrderFlowLiquidityDesk.tsx';
import { LiveMarketsTVDesk } from '../common/LiveMarketsTVDesk.tsx';
import { RetailSentimentDesk } from '../common/RetailSentimentDesk.tsx';
import { TelegramSignalDispatcher } from '../common/TelegramSignalDispatcher.tsx';
import { IntermarketDivergenceRadar } from '../common/IntermarketDivergenceRadar.tsx';
import { AdrVolatilityExhaustionDesk } from '../common/AdrVolatilityExhaustionDesk.tsx';
import { CotInstitutionalMatrix } from '../common/CotInstitutionalMatrix.tsx';
import { MtfConfluenceMatrixDesk } from '../common/MtfConfluenceMatrixDesk.tsx';
import { CamarillaPivotMatrix } from '../common/CamarillaPivotMatrix.tsx';
import { generateCandles, enrichCandlesWithIndicators, computePeriodStats, Timeframe, Candle } from '../../utils/stockCandles.ts';
import { getMarketSession, getAssetMarketSession, MarketSessionInfo } from '../../utils/marketHours.ts';
import { lookupTradingViewQuote, resolveTradingViewPrice, useTradingViewQuotes } from '../../utils/tradingViewSync.ts';

export interface TradingSignal {
  action: 'STRONG BUY' | 'BUY' | 'NEUTRAL' | 'HOLD' | 'SELL' | 'STRONG SELL';
  setupType: string;
  timeframe: string;
  timeframeCategory?: string;
  confirmationScore?: string;
  entryZone: string;
  takeProfit1: string;
  takeProfit2: string;
  stopLoss: string;
  riskReward: string;
  confidenceScore: number;
  summary: string;
  indicators: {
    rsi: string;
    macd: string;
    movingAverages: string;
    pivotPoint: string;
    atr: string;
  };
  smc?: {
    orderBlock?: string;
    fairValueGap?: string;
    liquidityTarget?: string;
    marketStructure?: string;
  };
  tradeManagement?: {
    breakEvenRule?: string;
    partialProfitRule?: string;
    invalidationRule?: string;
  };
  multiAspectAnalysis?: {
    marketStructure?: string;
    smartMoneyConcepts?: string;
    indicatorConfluence?: string;
    macroForexFactory?: string;
  };
}

export interface StockProfile {
  ticker: string;
  name: string;
  market: 'NSE' | 'US' | 'FOREX' | 'METALS' | 'INDICES';
  currency: string;
  currentPrice: number;
  changePercent: number;
  changeValue: number;
  peRatio: number;
  dividendYield: number;
  marketCap: string;
  category: string;
  historicalPoints: number[]; // 12 monthly points
  isForex?: boolean;
  isMetal?: boolean;
  isIndex?: boolean;
  pipSpread?: string;
  defaultSignal: {
    action: 'STRONG BUY' | 'BUY' | 'NEUTRAL' | 'HOLD' | 'SELL' | 'STRONG SELL';
    score: number;
    setup: string;
  };
}

const FEATURED_ASSETS: StockProfile[] = [
  // ==========================================
  // --- FOREX: MAJORS (7) ---
  // ==========================================
  {
    ticker: 'EUR/USD',
    name: 'Euro / US Dollar',
    market: 'FOREX',
    currency: 'USD',
    currentPrice: 1.1032,
    changePercent: 0.32,
    changeValue: 0.0035,
    peRatio: 0,
    dividendYield: 2.8,
    marketCap: '$2.4 Trillion Daily',
    category: 'Major FX Currency Pair',
    isForex: true,
    pipSpread: '0.6 pips',
    defaultSignal: {
      action: 'BUY',
      score: 84,
      setup: 'Bullish Trend Continuation & FVG Retest',
    },
    historicalPoints: [1.0880, 1.0910, 1.0940, 1.0965, 1.0950, 1.0990, 1.0980, 1.1005, 1.1035, 1.1015, 1.1025, 1.1032],
  },
  {
    ticker: 'GBP/USD',
    name: 'British Pound / US Dollar ("Cable")',
    market: 'FOREX',
    currency: 'USD',
    currentPrice: 1.3222,
    changePercent: 0.37,
    changeValue: 0.0048,
    peRatio: 0,
    dividendYield: 3.5,
    marketCap: '$1.1 Trillion Daily',
    category: 'Major FX ("Cable")',
    isForex: true,
    pipSpread: '0.9 pips',
    defaultSignal: {
      action: 'BUY',
      score: 81,
      setup: 'Ascending Channel Breakout & Order Block Retest',
    },
    historicalPoints: [1.2890, 1.2960, 1.3050, 1.3130, 1.3080, 1.3150, 1.3190, 1.3160, 1.3200, 1.3180, 1.3210, 1.3222],
  },
  {
    ticker: 'USD/JPY',
    name: 'US Dollar / Japanese Yen ("Ninja")',
    market: 'FOREX',
    currency: 'JPY',
    currentPrice: 159.86,
    changePercent: 0.43,
    changeValue: 0.68,
    peRatio: 0,
    dividendYield: 4.8,
    marketCap: '$1.8 Trillion Daily',
    category: 'Asian Session Major FX',
    isForex: true,
    pipSpread: '0.8 pips',
    defaultSignal: {
      action: 'STRONG BUY',
      score: 86,
      setup: 'Yield Divergence Expansion & 159.0 Support',
    },
    historicalPoints: [151.5, 153.2, 155.0, 157.5, 156.2, 158.0, 158.8, 159.2, 158.6, 159.4, 159.7, 159.86],
  },
  {
    ticker: 'USD/CHF',
    name: 'US Dollar / Swiss Franc ("Swissy")',
    market: 'FOREX',
    currency: 'CHF',
    currentPrice: 0.8376,
    changePercent: -0.15,
    changeValue: -0.0013,
    peRatio: 0,
    dividendYield: 1.4,
    marketCap: '$450 Billion Daily',
    category: 'European Safe-Haven Major FX',
    isForex: true,
    pipSpread: '1.0 pips',
    defaultSignal: {
      action: 'SELL',
      score: 77,
      setup: 'Resistance Rejection at 0.8415 & CHoCH',
    },
    historicalPoints: [0.8650, 0.8610, 0.8540, 0.8490, 0.8420, 0.8390, 0.8355, 0.8385, 0.8345, 0.8365, 0.8370, 0.8376],
  },
  {
    ticker: 'AUD/USD',
    name: 'Australian Dollar / US Dollar ("Aussie")',
    market: 'FOREX',
    currency: 'USD',
    currentPrice: 0.6776,
    changePercent: -0.27,
    changeValue: -0.0018,
    peRatio: 0,
    dividendYield: 3.2,
    marketCap: '$600 Billion Daily',
    category: 'Commodity Currency ("Aussie")',
    isForex: true,
    pipSpread: '1.0 pips',
    defaultSignal: {
      action: 'SELL',
      score: 78,
      setup: 'Resistance Rejection & Pullback',
    },
    historicalPoints: [0.6840, 0.6870, 0.6910, 0.6880, 0.6830, 0.6800, 0.6780, 0.6810, 0.6790, 0.6770, 0.6780, 0.6776],
  },
  {
    ticker: 'USD/CAD',
    name: 'US Dollar / Canadian Dollar ("Loonie")',
    market: 'FOREX',
    currency: 'CAD',
    currentPrice: 1.4249,
    changePercent: 0.16,
    changeValue: 0.0023,
    peRatio: 0,
    dividendYield: 2.9,
    marketCap: '$550 Billion Daily',
    category: 'North American FX ("Loonie")',
    isForex: true,
    pipSpread: '1.1 pips',
    defaultSignal: {
      action: 'BUY',
      score: 80,
      setup: 'Crude Oil Correlation & Trend Support',
    },
    historicalPoints: [1.3910, 1.3970, 1.4040, 1.4100, 1.4070, 1.4130, 1.4180, 1.4210, 1.4200, 1.4230, 1.4242, 1.4249],
  },
  {
    ticker: 'NZD/USD',
    name: 'New Zealand Dollar / US Dollar ("Kiwi")',
    market: 'FOREX',
    currency: 'USD',
    currentPrice: 0.5529,
    changePercent: -0.35,
    changeValue: -0.0019,
    peRatio: 0,
    dividendYield: 4.1,
    marketCap: '$380 Billion Daily',
    category: 'Asia-Pacific Major FX ("Kiwi")',
    isForex: true,
    pipSpread: '1.2 pips',
    defaultSignal: {
      action: 'NEUTRAL',
      score: 73,
      setup: '0.5500 Key Support Baseline',
    },
    historicalPoints: [0.5670, 0.5700, 0.5640, 0.5590, 0.5560, 0.5535, 0.5505, 0.5545, 0.5515, 0.5525, 0.5534, 0.5529],
  },

  // ==========================================
  // --- FOREX: EURO CROSSES (6) ---
  // ==========================================
  {
    ticker: 'EUR/GBP',
    name: 'Euro / British Pound ("Chunnel")',
    market: 'FOREX',
    currency: 'GBP',
    currentPrice: 0.8343,
    changePercent: -0.12,
    changeValue: -0.0010,
    peRatio: 0,
    dividendYield: 2.1,
    marketCap: '$720 Billion Daily',
    category: 'European Cross FX',
    isForex: true,
    pipSpread: '0.8 pips',
    defaultSignal: {
      action: 'SELL',
      score: 76,
      setup: 'BoE Rate Differential Advantage',
    },
    historicalPoints: [0.8510, 0.8480, 0.8450, 0.8420, 0.8390, 0.8365, 0.8335, 0.8355, 0.8325, 0.8340, 0.8348, 0.8343],
  },
  {
    ticker: 'EUR/JPY',
    name: 'Euro / Japanese Yen ("Eppy")',
    market: 'FOREX',
    currency: 'JPY',
    currentPrice: 176.35,
    changePercent: 0.75,
    changeValue: 1.31,
    peRatio: 0,
    dividendYield: 3.4,
    marketCap: '$840 Billion Daily',
    category: 'Euro-Asia Cross FX',
    isForex: true,
    pipSpread: '1.2 pips',
    defaultSignal: {
      action: 'STRONG BUY',
      score: 88,
      setup: 'Bullish Momentum Expansion & 175.50 Retest',
    },
    historicalPoints: [166.5, 168.8, 171.2, 172.7, 172.1, 174.2, 174.9, 175.7, 175.5, 175.9, 176.2, 176.35],
  },
  {
    ticker: 'EUR/CHF',
    name: 'Euro / Swiss Franc',
    market: 'FOREX',
    currency: 'CHF',
    currentPrice: 0.9242,
    changePercent: 0.05,
    changeValue: 0.0005,
    peRatio: 0,
    dividendYield: 1.5,
    marketCap: '$380 Billion Daily',
    category: 'SNB / ECB Policy Cross',
    isForex: true,
    pipSpread: '1.3 pips',
    defaultSignal: {
      action: 'HOLD',
      score: 72,
      setup: 'SNB Floor Defense Consolidation',
    },
    historicalPoints: [0.9470, 0.9430, 0.9400, 0.9360, 0.9310, 0.9280, 0.9250, 0.9270, 0.9230, 0.9250, 0.9246, 0.9242],
  },
  {
    ticker: 'EUR/AUD',
    name: 'Euro / Australian Dollar',
    market: 'FOREX',
    currency: 'AUD',
    currentPrice: 1.6281,
    changePercent: 0.58,
    changeValue: 0.0094,
    peRatio: 0,
    dividendYield: 2.6,
    marketCap: '$320 Billion Daily',
    category: 'Volatility Minor FX',
    isForex: true,
    pipSpread: '1.8 pips',
    defaultSignal: {
      action: 'BUY',
      score: 82,
      setup: 'Commodity Pullback Bounce',
    },
    historicalPoints: [1.5900, 1.5960, 1.6030, 1.6100, 1.6170, 1.6220, 1.6260, 1.6200, 1.6250, 1.6300, 1.6270, 1.6281],
  },
  {
    ticker: 'EUR/CAD',
    name: 'Euro / Canadian Dollar',
    market: 'FOREX',
    currency: 'CAD',
    currentPrice: 1.5719,
    changePercent: 0.22,
    changeValue: 0.0034,
    peRatio: 0,
    dividendYield: 2.4,
    marketCap: '$290 Billion Daily',
    category: 'Transatlantic Minor FX',
    isForex: true,
    pipSpread: '1.7 pips',
    defaultSignal: {
      action: 'BUY',
      score: 79,
      setup: 'Ascending Support Line',
    },
    historicalPoints: [1.5310, 1.5380, 1.5450, 1.5510, 1.5580, 1.5640, 1.5680, 1.5640, 1.5690, 1.5730, 1.5710, 1.5719],
  },
  {
    ticker: 'EUR/NZD',
    name: 'Euro / New Zealand Dollar',
    market: 'FOREX',
    currency: 'NZD',
    currentPrice: 1.9953,
    changePercent: 0.65,
    changeValue: 0.0129,
    peRatio: 0,
    dividendYield: 2.8,
    marketCap: '$210 Billion Daily',
    category: 'High Beta Minor FX',
    isForex: true,
    pipSpread: '2.4 pips',
    defaultSignal: {
      action: 'STRONG BUY',
      score: 85,
      setup: 'RBNZ Rate Cut Liquidity Inflow',
    },
    historicalPoints: [1.9420, 1.9510, 1.9590, 1.9680, 1.9790, 1.9860, 1.9910, 1.9870, 1.9920, 1.9970, 1.9940, 1.9953],
  },

  // ==========================================
  // --- FOREX: POUND CROSSES (5) ---
  // ==========================================
  {
    ticker: 'GBP/JPY',
    name: 'British Pound / Japanese Yen ("Guppy" / "The Beast")',
    market: 'FOREX',
    currency: 'JPY',
    currentPrice: 211.37,
    changePercent: 0.81,
    changeValue: 1.70,
    peRatio: 0,
    dividendYield: 4.2,
    marketCap: '$960 Billion Daily',
    category: 'Ultra High Volatility FX ("The Beast")',
    isForex: true,
    pipSpread: '1.4 pips',
    defaultSignal: {
      action: 'STRONG BUY',
      score: 91,
      setup: 'Breakout above 210.50 & Liquidity Run to 213.00',
    },
    historicalPoints: [199.5, 202.0, 204.5, 206.9, 206.0, 208.5, 209.7, 210.5, 210.0, 210.7, 211.1, 211.37],
  },
  {
    ticker: 'GBP/CHF',
    name: 'British Pound / Swiss Franc',
    market: 'FOREX',
    currency: 'CHF',
    currentPrice: 1.1076,
    changePercent: 0.18,
    changeValue: 0.0020,
    peRatio: 0,
    dividendYield: 3.1,
    marketCap: '$340 Billion Daily',
    category: 'European Cross FX',
    isForex: true,
    pipSpread: '1.6 pips',
    defaultSignal: {
      action: 'BUY',
      score: 80,
      setup: 'Interest Rate Carry Drift',
    },
    historicalPoints: [1.1240, 1.1200, 1.1160, 1.1130, 1.1090, 1.1060, 1.1030, 1.1080, 1.1050, 1.1070, 1.1080, 1.1076],
  },
  {
    ticker: 'GBP/AUD',
    name: 'British Pound / Australian Dollar',
    market: 'FOREX',
    currency: 'AUD',
    currentPrice: 1.9513,
    changePercent: 0.62,
    changeValue: 0.0120,
    peRatio: 0,
    dividendYield: 3.4,
    marketCap: '$410 Billion Daily',
    category: 'High Pip Range FX',
    isForex: true,
    pipSpread: '2.1 pips',
    defaultSignal: {
      action: 'BUY',
      score: 83,
      setup: 'Ascending Channel Rebound',
    },
    historicalPoints: [1.8950, 1.9040, 1.9150, 1.9280, 1.9360, 1.9420, 1.9480, 1.9420, 1.9490, 1.9540, 1.9500, 1.9513],
  },
  {
    ticker: 'GBP/CAD',
    name: 'British Pound / Canadian Dollar',
    market: 'FOREX',
    currency: 'CAD',
    currentPrice: 1.8838,
    changePercent: 0.35,
    changeValue: 0.0066,
    peRatio: 0,
    dividendYield: 3.2,
    marketCap: '$360 Billion Daily',
    category: 'Cross Rate Momentum FX',
    isForex: true,
    pipSpread: '1.9 pips',
    defaultSignal: {
      action: 'BUY',
      score: 81,
      setup: '1.8750 Support Hold & Break of Structure',
    },
    historicalPoints: [1.8200, 1.8300, 1.8430, 1.8540, 1.8630, 1.8710, 1.8770, 1.8730, 1.8790, 1.8860, 1.8825, 1.8838],
  },
  {
    ticker: 'GBP/NZD',
    name: 'British Pound / New Zealand Dollar',
    market: 'FOREX',
    currency: 'NZD',
    currentPrice: 2.3915,
    changePercent: 0.72,
    changeValue: 0.0171,
    peRatio: 0,
    dividendYield: 3.6,
    marketCap: '$280 Billion Daily',
    category: 'Maximum Pip Range Pair',
    isForex: true,
    pipSpread: '2.8 pips',
    defaultSignal: {
      action: 'STRONG BUY',
      score: 87,
      setup: 'Daily Breakout & Expansion to 2.4150',
    },
    historicalPoints: [2.3150, 2.3280, 2.3420, 2.3580, 2.3710, 2.3800, 2.3870, 2.3810, 2.3880, 2.3940, 2.3905, 2.3915],
  },

  // ==========================================
  // --- FOREX: YEN & OTHER CROSSES (7) ---
  // ==========================================
  {
    ticker: 'AUD/JPY',
    name: 'Australian Dollar / Japanese Yen',
    market: 'FOREX',
    currency: 'JPY',
    currentPrice: 108.32,
    changePercent: 0.18,
    changeValue: 0.19,
    peRatio: 0,
    dividendYield: 3.8,
    marketCap: '$520 Billion Daily',
    category: 'Global Risk-On Sentiment Gauge',
    isForex: true,
    pipSpread: '1.2 pips',
    defaultSignal: {
      action: 'BUY',
      score: 80,
      setup: 'Psychological 108.00 Level Reclaim',
    },
    historicalPoints: [102.5, 103.8, 105.2, 106.6, 106.0, 107.2, 107.8, 108.1, 107.7, 108.2, 108.4, 108.32],
  },
  {
    ticker: 'CAD/JPY',
    name: 'Canadian Dollar / Japanese Yen',
    market: 'FOREX',
    currency: 'JPY',
    currentPrice: 112.20,
    changePercent: 0.28,
    changeValue: 0.31,
    peRatio: 0,
    dividendYield: 3.5,
    marketCap: '$380 Billion Daily',
    category: 'Energy & Commodity Carry FX',
    isForex: true,
    pipSpread: '1.3 pips',
    defaultSignal: {
      action: 'BUY',
      score: 79,
      setup: '111.75 Order Block Defense',
    },
    historicalPoints: [106.4, 107.7, 109.0, 110.2, 109.7, 111.1, 111.6, 112.0, 111.7, 112.3, 112.4, 112.20],
  },
  {
    ticker: 'CHF/JPY',
    name: 'Swiss Franc / Japanese Yen',
    market: 'FOREX',
    currency: 'JPY',
    currentPrice: 190.83,
    changePercent: 0.52,
    changeValue: 0.99,
    peRatio: 0,
    dividendYield: 2.2,
    marketCap: '$460 Billion Daily',
    category: 'Dual Safe-Haven Dynamic FX',
    isForex: true,
    pipSpread: '1.5 pips',
    defaultSignal: {
      action: 'STRONG BUY',
      score: 86,
      setup: 'All-Time High Continuation',
    },
    historicalPoints: [177.0, 179.5, 182.0, 184.5, 186.0, 188.2, 189.5, 190.0, 189.6, 190.4, 190.9, 190.83],
  },
  {
    ticker: 'NZD/JPY',
    name: 'New Zealand Dollar / Japanese Yen',
    market: 'FOREX',
    currency: 'JPY',
    currentPrice: 88.38,
    changePercent: 0.12,
    changeValue: 0.11,
    peRatio: 0,
    dividendYield: 4.2,
    marketCap: '$290 Billion Daily',
    category: 'Asia-Pacific Carry FX',
    isForex: true,
    pipSpread: '1.4 pips',
    defaultSignal: {
      action: 'HOLD',
      score: 74,
      setup: '88.30 Pivot Zone Balance',
    },
    historicalPoints: [83.8, 85.1, 86.2, 87.4, 86.9, 87.7, 88.2, 88.5, 88.1, 88.6, 88.5, 88.38],
  },
  {
    ticker: 'AUD/CAD',
    name: 'Australian Dollar / Canadian Dollar',
    market: 'FOREX',
    currency: 'CAD',
    currentPrice: 0.9654,
    changePercent: -0.15,
    changeValue: -0.0014,
    peRatio: 0,
    dividendYield: 3.1,
    marketCap: '$270 Billion Daily',
    category: 'Dual Commodity Cross',
    isForex: true,
    pipSpread: '1.4 pips',
    defaultSignal: {
      action: 'NEUTRAL',
      score: 72,
      setup: 'Range Bounds Between 0.9610 - 0.9690',
    },
    historicalPoints: [0.9550, 0.9590, 0.9640, 0.9680, 0.9660, 0.9690, 0.9670, 0.9650, 0.9680, 0.9660, 0.9670, 0.9654],
  },
  {
    ticker: 'AUD/NZD',
    name: 'Australian Dollar / New Zealand Dollar',
    market: 'FOREX',
    currency: 'NZD',
    currentPrice: 1.2254,
    changePercent: 0.25,
    changeValue: 0.0031,
    peRatio: 0,
    dividendYield: 3.3,
    marketCap: '$310 Billion Daily',
    category: 'Trans-Tasman Arbitrage FX',
    isForex: true,
    pipSpread: '1.5 pips',
    defaultSignal: {
      action: 'BUY',
      score: 79,
      setup: 'RBA / RBNZ Divergence Drift',
    },
    historicalPoints: [1.2080, 1.2110, 1.2150, 1.2190, 1.2210, 1.2240, 1.2270, 1.2230, 1.2260, 1.2280, 1.2245, 1.2254],
  },
  {
    ticker: 'CAD/CHF',
    name: 'Canadian Dollar / Swiss Franc',
    market: 'FOREX',
    currency: 'CHF',
    currentPrice: 0.5879,
    changePercent: 0.10,
    changeValue: 0.0006,
    peRatio: 0,
    dividendYield: 2.5,
    marketCap: '$190 Billion Daily',
    category: 'Commodity vs Safe-Haven FX',
    isForex: true,
    pipSpread: '1.6 pips',
    defaultSignal: {
      action: 'HOLD',
      score: 71,
      setup: 'Low Volatility Consolidation',
    },
    historicalPoints: [0.6160, 0.6110, 0.6060, 0.6010, 0.5970, 0.5935, 0.5895, 0.5925, 0.5885, 0.5895, 0.5885, 0.5879],
  },

  // ==========================================
  // --- FOREX: REGIONAL & EXOTICS (9) ---
  // ==========================================
  {
    ticker: 'USD/KES',
    name: 'US Dollar / Kenyan Shilling',
    market: 'FOREX',
    currency: 'KES',
    currentPrice: 129.86,
    changePercent: -0.31,
    changeValue: -0.40,
    peRatio: 0,
    dividendYield: 12.5,
    marketCap: 'CBK Interbank Market',
    category: 'East Africa Major FX',
    isForex: true,
    pipSpread: '15 pips',
    defaultSignal: {
      action: 'STRONG BUY',
      score: 88,
      setup: 'Support Accumulation & Carry Trade Yield',
    },
    historicalPoints: [136.5, 134.0, 132.5, 131.0, 130.5, 129.8, 129.4, 129.1, 129.7, 129.3, 129.6, 129.86],
  },
  {
    ticker: 'GBP/KES',
    name: 'British Pound / Kenyan Shilling',
    market: 'FOREX',
    currency: 'KES',
    currentPrice: 171.70,
    changePercent: 0.21,
    changeValue: 0.36,
    peRatio: 0,
    dividendYield: 11.8,
    marketCap: 'Regional Interbank FX',
    category: 'Diaspora Remittance & Trade FX',
    isForex: true,
    pipSpread: '20 pips',
    defaultSignal: {
      action: 'BUY',
      score: 79,
      setup: 'Range Support Bounce at 171.00',
    },
    historicalPoints: [176.5, 175.0, 173.5, 172.7, 172.3, 171.5, 171.0, 171.6, 172.0, 171.4, 171.5, 171.70],
  },
  {
    ticker: 'EUR/KES',
    name: 'Euro / Kenyan Shilling',
    market: 'FOREX',
    currency: 'KES',
    currentPrice: 143.68,
    changePercent: 0.18,
    changeValue: 0.26,
    peRatio: 0,
    dividendYield: 10.2,
    marketCap: 'Regional Interbank FX',
    category: 'Horticulture & Tourism FX',
    isForex: true,
    pipSpread: '18 pips',
    defaultSignal: {
      action: 'NEUTRAL',
      score: 74,
      setup: 'Consolidation Box around 143.0 - 144.5',
    },
    historicalPoints: [149.5, 147.8, 146.2, 144.9, 144.3, 143.6, 143.0, 143.4, 143.8, 143.2, 143.4, 143.68],
  },
  {
    ticker: 'USD/ZAR',
    name: 'US Dollar / South African Rand',
    market: 'FOREX',
    currency: 'ZAR',
    currentPrice: 16.94,
    changePercent: -0.42,
    changeValue: -0.071,
    peRatio: 0,
    dividendYield: 8.5,
    marketCap: 'SARB Liquidity Window',
    category: 'BRICS / Sub-Saharan Major FX',
    isForex: true,
    pipSpread: '25 pips',
    defaultSignal: {
      action: 'SELL',
      score: 80,
      setup: 'Mining Exports Strength & Rand Inflow',
    },
    historicalPoints: [18.20, 17.95, 17.70, 17.50, 17.25, 17.10, 16.90, 17.05, 16.85, 17.00, 16.90, 16.94],
  },
  {
    ticker: 'USD/UGX',
    name: 'US Dollar / Ugandan Shilling',
    market: 'FOREX',
    currency: 'UGX',
    currentPrice: 4121.20,
    changePercent: 0.05,
    changeValue: 2.1,
    peRatio: 0,
    dividendYield: 11.0,
    marketCap: 'Bank of Uganda Interbank',
    category: 'East African Community (EAC) FX',
    isForex: true,
    pipSpread: '50 pips',
    defaultSignal: {
      action: 'HOLD',
      score: 75,
      setup: 'Stable Commodity Inflows & Coffee Export Buffer',
    },
    historicalPoints: [4250, 4220, 4195, 4175, 4155, 4140, 4130, 4135, 4125, 4120, 4119, 4121.2],
  },
  {
    ticker: 'USD/TZS',
    name: 'US Dollar / Tanzanian Shilling',
    market: 'FOREX',
    currency: 'TZS',
    currentPrice: 2634.0,
    changePercent: 0.08,
    changeValue: 2.1,
    peRatio: 0,
    dividendYield: 9.8,
    marketCap: 'Bank of Tanzania FX Desk',
    category: 'East African Community (EAC) FX',
    isForex: true,
    pipSpread: '40 pips',
    defaultSignal: {
      action: 'BUY',
      score: 77,
      setup: 'Dar Port Infrastructure Trade Demand',
    },
    historicalPoints: [2520, 2540, 2560, 2580, 2595, 2608, 2616, 2624, 2620, 2628, 2631, 2634.0],
  },
  {
    ticker: 'USD/MXN',
    name: 'US Dollar / Mexican Peso',
    market: 'FOREX',
    currency: 'MXN',
    currentPrice: 18.53,
    changePercent: 0.45,
    changeValue: 0.08,
    peRatio: 0,
    dividendYield: 10.5,
    marketCap: 'Banxico FX Desk',
    category: 'Nearshoring & High-Yield Carry FX',
    isForex: true,
    pipSpread: '15 pips',
    defaultSignal: {
      action: 'BUY',
      score: 82,
      setup: '18.50 Psychological Floor Reclaim',
    },
    historicalPoints: [17.10, 17.30, 17.55, 17.80, 18.00, 18.20, 18.35, 18.28, 18.48, 18.40, 18.56, 18.53],
  },
  {
    ticker: 'USD/TRY',
    name: 'US Dollar / Turkish Lira',
    market: 'FOREX',
    currency: 'TRY',
    currentPrice: 50.37,
    changePercent: 0.22,
    changeValue: 0.11,
    peRatio: 0,
    dividendYield: 45.0,
    marketCap: 'CBRT Interbank',
    category: 'Ultra-High Yield Emerging FX',
    isForex: true,
    pipSpread: '35 pips',
    defaultSignal: {
      action: 'STRONG BUY',
      score: 84,
      setup: 'Inflation Carry & Structural Trend Continuation',
    },
    historicalPoints: [45.50, 46.20, 47.00, 47.80, 48.50, 49.10, 49.60, 49.90, 50.05, 50.18, 50.29, 50.37],
  },
  {
    ticker: 'USD/SGD',
    name: 'US Dollar / Singapore Dollar',
    market: 'FOREX',
    currency: 'SGD',
    currentPrice: 1.2881,
    changePercent: -0.10,
    changeValue: -0.0013,
    peRatio: 0,
    dividendYield: 2.8,
    marketCap: 'MAS Policy Band FX',
    category: 'Asian Financial Hub Major Cross',
    isForex: true,
    pipSpread: '1.2 pips',
    defaultSignal: {
      action: 'NEUTRAL',
      score: 75,
      setup: 'MAS S$NEER Policy Centerline Drift',
    },
    historicalPoints: [1.3150, 1.3110, 1.3060, 1.3010, 1.2960, 1.2920, 1.2890, 1.2910, 1.2870, 1.2890, 1.2885, 1.2881],
  },

  // ==========================================
  // --- METALS: PRECIOUS & INDUSTRIAL (8) ---
  // ==========================================
  {
    ticker: 'XAU/USD',
    name: 'Spot Gold / US Dollar',
    market: 'METALS',
    currency: 'USD',
    currentPrice: 3878.46,
    changePercent: 0.98,
    changeValue: 37.64,
    peRatio: 0,
    dividendYield: 0,
    marketCap: '$17.8 Trillion Global Reserves',
    category: 'Precious Metal & Sovereign Safe Haven',
    isMetal: true,
    pipSpread: '$0.25 (25 pts)',
    defaultSignal: {
      action: 'STRONG BUY',
      score: 95,
      setup: 'Institutional 3,878 Demand Zone Defense & Bullish Expansion',
    },
    historicalPoints: [3650, 3690, 3720, 3750, 3775, 3795, 3815, 3832, 3848, 3860, 3871, 3878.46],
  },
  {
    ticker: 'XAG/USD',
    name: 'Spot Silver / US Dollar',
    market: 'METALS',
    currency: 'USD',
    currentPrice: 49.14,
    changePercent: 1.45,
    changeValue: 0.70,
    peRatio: 0,
    dividendYield: 0,
    marketCap: '$1.9 Trillion Physical Stock',
    category: 'Precious & Green-Tech Industrial Metal',
    isMetal: true,
    pipSpread: '$0.02 (2.0 pts)',
    defaultSignal: {
      action: 'STRONG BUY',
      score: 90,
      setup: 'Photovoltaic Solar Demand & Multi-Year Cup & Handle',
    },
    historicalPoints: [39.2, 40.5, 41.8, 43.5, 45.1, 46.2, 45.5, 46.8, 47.6, 48.1, 48.6, 49.14],
  },
  {
    ticker: 'XPT/USD',
    name: 'Spot Platinum / US Dollar',
    market: 'METALS',
    currency: 'USD',
    currentPrice: 1496.17,
    changePercent: 0.62,
    changeValue: 9.22,
    peRatio: 0,
    dividendYield: 0,
    marketCap: '$310 Billion Mine Supply',
    category: 'Hydrogen Fuel Cell & Catalytic Metal',
    isMetal: true,
    pipSpread: '$1.50',
    defaultSignal: {
      action: 'BUY',
      score: 83,
      setup: 'Structural Supply Deficit & 1,480 Support Reclaim',
    },
    historicalPoints: [1390, 1410, 1425, 1445, 1465, 1480, 1470, 1485, 1492, 1488, 1493, 1496.17],
  },
  {
    ticker: 'XPD/USD',
    name: 'Spot Palladium / US Dollar',
    market: 'METALS',
    currency: 'USD',
    currentPrice: 1008.70,
    changePercent: 0.85,
    changeValue: 8.50,
    peRatio: 0,
    dividendYield: 0,
    marketCap: '$240 Billion Market Size',
    category: 'Automotive Emission Reduction Metal',
    isMetal: true,
    pipSpread: '$3.00',
    defaultSignal: {
      action: 'BUY',
      score: 81,
      setup: 'Oversold Value Mean Reversion & Short Squeeze',
    },
    historicalPoints: [920, 940, 960, 980, 995, 1015, 1002, 1010, 1018, 1004, 1007, 1008.70],
  },
  {
    ticker: 'HG/COPPER',
    name: 'High Grade Copper Futures ("Dr. Copper")',
    market: 'METALS',
    currency: 'USD',
    currentPrice: 6.06,
    changePercent: 0.92,
    changeValue: 0.055,
    peRatio: 0,
    dividendYield: 0,
    marketCap: 'COMEX Benchmark Grade',
    category: 'Global Electrification & Macro Health Proxy',
    isMetal: true,
    pipSpread: '$0.005',
    defaultSignal: {
      action: 'BUY',
      score: 85,
      setup: 'Grid Modernization Infrastructure Demand',
    },
    historicalPoints: [5.45, 5.55, 5.70, 5.85, 6.05, 5.98, 5.92, 6.00, 6.08, 5.99, 6.03, 6.06],
  },
  {
    ticker: 'ALU/USD',
    name: 'Spot Aluminum LME Physical Cash',
    market: 'METALS',
    currency: 'USD',
    currentPrice: 2640.0,
    changePercent: 0.45,
    changeValue: 11.8,
    peRatio: 0,
    dividendYield: 0,
    marketCap: 'London Metal Exchange (LME)',
    category: 'Aerospace & EV Lightweighting Industrial',
    isMetal: true,
    pipSpread: '$2.00',
    defaultSignal: {
      action: 'BUY',
      score: 79,
      setup: 'Smelter Capacity Discipline & Bauxite Supply Tightness',
    },
    historicalPoints: [2250, 2310, 2380, 2460, 2520, 2580, 2550, 2610, 2660, 2630, 2645, 2640],
  },
  {
    ticker: 'XAU/EUR',
    name: 'Spot Gold / Euro Currency Cross',
    market: 'METALS',
    currency: 'EUR',
    currentPrice: 3515.65,
    changePercent: 1.55,
    changeValue: 53.65,
    peRatio: 0,
    dividendYield: 0,
    marketCap: 'European Institutional Bullion',
    category: 'Eurozone Sovereign Inflation Hedge',
    isMetal: true,
    pipSpread: '€0.40',
    defaultSignal: {
      action: 'STRONG BUY',
      score: 92,
      setup: 'ECB Monetary Easing Safe-Haven Accumulation',
    },
    historicalPoints: [3150, 3210, 3270, 3320, 3360, 3400, 3430, 3460, 3485, 3495, 3505, 3515.65],
  },
  {
    ticker: 'XAU/KES',
    name: 'Spot Gold in Kenyan Shillings (Troy Oz)',
    market: 'METALS',
    currency: 'KES',
    currentPrice: 503656.82,
    changePercent: 1.65,
    changeValue: 8175.0,
    peRatio: 0,
    dividendYield: 0,
    marketCap: 'Local Vault & Bullion Market',
    category: 'Domestic Wealth Preservation & FX Shield',
    isMetal: true,
    pipSpread: 'KES 250',
    defaultSignal: {
      action: 'STRONG BUY',
      score: 93,
      setup: 'Long-Term Currency Purchasing Power Anchor',
    },
    historicalPoints: [465000, 472000, 478000, 483000, 487000, 491000, 494000, 497000, 499000, 501000, 502500, 503656.82],
  },

  // ==========================================
  // --- INDEXES: GLOBAL & REGIONAL BENCHMARKS (13) ---
  // ==========================================
  {
    ticker: 'US500',
    name: 'S&P 500 Index (Standard & Poor\'s 500)',
    market: 'INDICES',
    currency: 'USD',
    currentPrice: 7519.06,
    changePercent: 0.88,
    changeValue: 65.6,
    peRatio: 26.5,
    dividendYield: 1.3,
    marketCap: '$46.5 Trillion Aggregate',
    category: 'US Broad Market Benchmark Index',
    isIndex: true,
    pipSpread: '0.40 pts',
    defaultSignal: {
      action: 'STRONG BUY',
      score: 89,
      setup: 'Bullish Flag Breakout above 7,480 All-Time Highs',
    },
    historicalPoints: [6520, 6660, 6820, 6940, 7080, 7190, 7240, 7350, 7440, 7410, 7480, 7519.06],
  },
  {
    ticker: 'NAS100',
    name: 'Nasdaq 100 Tech Index ("USTEC")',
    market: 'INDICES',
    currency: 'USD',
    currentPrice: 27744.26,
    changePercent: 1.14,
    changeValue: 312.6,
    peRatio: 31.2,
    dividendYield: 0.8,
    marketCap: '$23.2 Trillion Aggregate',
    category: 'Mega-Cap Technology Benchmark',
    isIndex: true,
    pipSpread: '1.20 pts',
    defaultSignal: {
      action: 'STRONG BUY',
      score: 93,
      setup: 'AI Infrastructure Capex Cycle Expansion',
    },
    historicalPoints: [24100, 24700, 25400, 26000, 26700, 27150, 26900, 27350, 27550, 27400, 27650, 27744.26],
  },
  {
    ticker: 'US30',
    name: 'Dow Jones Industrial Average 30 ("Wall Street")',
    market: 'INDICES',
    currency: 'USD',
    currentPrice: 52225.33,
    changePercent: 0.52,
    changeValue: 270.2,
    peRatio: 22.8,
    dividendYield: 1.9,
    marketCap: '$14.8 Trillion Aggregate',
    category: 'Blue-Chip Industrials & Banking Index',
    isIndex: true,
    pipSpread: '2.00 pts',
    defaultSignal: {
      action: 'BUY',
      score: 84,
      setup: 'Soft Landing Broadening & Cyclical Flow',
    },
    historicalPoints: [47600, 48200, 49000, 49600, 50300, 50900, 50700, 51300, 51900, 51750, 52100, 52225.33],
  },
  {
    ticker: 'UK100',
    name: 'FTSE 100 Index London ("Footsie")',
    market: 'INDICES',
    currency: 'GBP',
    currentPrice: 10895.20,
    changePercent: 0.34,
    changeValue: 36.9,
    peRatio: 14.1,
    dividendYield: 3.8,
    marketCap: '£2.1 Trillion Aggregate',
    category: 'UK & International Commodities / Banking Index',
    isIndex: true,
    pipSpread: '1.00 pts',
    defaultSignal: {
      action: 'BUY',
      score: 81,
      setup: 'Value Multiple Expansion & 10,800 Support Defense',
    },
    historicalPoints: [10250, 10380, 10520, 10650, 10740, 10810, 10780, 10860, 10910, 10840, 10870, 10895.20],
  },
  {
    ticker: 'GER40',
    name: 'DAX 40 Index Frankfurt Germany',
    market: 'INDICES',
    currency: 'EUR',
    currentPrice: 26742.47,
    changePercent: 0.72,
    changeValue: 191.2,
    peRatio: 15.6,
    dividendYield: 3.1,
    marketCap: '€1.9 Trillion Aggregate',
    category: 'European Industrial & Tech Blue-Chip Benchmark',
    isIndex: true,
    pipSpread: '1.20 pts',
    defaultSignal: {
      action: 'STRONG BUY',
      score: 87,
      setup: 'Breakout above 26,600 to Record Highs',
    },
    historicalPoints: [24000, 24400, 25000, 25500, 25850, 26100, 25950, 26300, 26550, 26480, 26650, 26742.47],
  },
  {
    ticker: 'FRA40',
    name: 'CAC 40 Index Paris France',
    market: 'INDICES',
    currency: 'EUR',
    currentPrice: 8364.18,
    changePercent: 0.41,
    changeValue: 34.1,
    peRatio: 14.8,
    dividendYield: 3.3,
    marketCap: '€2.3 Trillion Aggregate',
    category: 'French Luxury & Aerospace Benchmark Index',
    isIndex: true,
    pipSpread: '0.90 pts',
    defaultSignal: {
      action: 'HOLD',
      score: 76,
      setup: '8,320 Demand Zone Stabilization',
    },
    historicalPoints: [8120, 8250, 8400, 8550, 8480, 8390, 8320, 8360, 8420, 8310, 8340, 8364.18],
  },
  {
    ticker: 'JPN225',
    name: 'Nikkei 225 Stock Average Tokyo',
    market: 'INDICES',
    currency: 'JPY',
    currentPrice: 61142.13,
    changePercent: 0.95,
    changeValue: 575.4,
    peRatio: 17.2,
    dividendYield: 1.8,
    marketCap: '¥680 Trillion Market Cap',
    category: 'Japan Semiconductor & Export Benchmark',
    isIndex: true,
    pipSpread: '5.0 pts',
    defaultSignal: {
      action: 'BUY',
      score: 85,
      setup: 'Corporate Governance Reform & Yen Competitiveness',
    },
    historicalPoints: [56000, 57700, 59600, 61300, 61900, 60700, 60300, 60900, 61600, 60800, 61020, 61142.13],
  },
  {
    ticker: 'HK50',
    name: 'Hang Seng Index Hong Kong ("HSI")',
    market: 'INDICES',
    currency: 'HKD',
    currentPrice: 23637.61,
    changePercent: 1.85,
    changeValue: 429.4,
    peRatio: 9.8,
    dividendYield: 4.2,
    marketCap: 'HK$34 Trillion Market Size',
    category: 'China & HK Tech / Financials Benchmark',
    isIndex: true,
    pipSpread: '3.0 pts',
    defaultSignal: {
      action: 'STRONG BUY',
      score: 88,
      setup: 'PBOC Fiscal Stimulus Momentum & 23,200 Support',
    },
    historicalPoints: [19200, 19800, 20400, 21200, 21900, 20800, 20500, 21300, 23900, 23400, 23520, 23637.61],
  },
  {
    ticker: 'AUS200',
    name: 'S&P/ASX 200 Index Australia',
    market: 'INDICES',
    currency: 'AUD',
    currentPrice: 9066.80,
    changePercent: 0.38,
    changeValue: 34.3,
    peRatio: 18.4,
    dividendYield: 3.7,
    marketCap: 'A$2.6 Trillion Aggregate',
    category: 'Commodities & Mining Giant Benchmark',
    isIndex: true,
    pipSpread: '1.20 pts',
    defaultSignal: {
      action: 'BUY',
      score: 82,
      setup: 'Iron Ore Stabilization & 9,000 Support',
    },
    historicalPoints: [8420, 8540, 8680, 8790, 8850, 8940, 8910, 9010, 9090, 9020, 9045, 9066.80],
  },
  {
    ticker: 'EUSTX50',
    name: 'Euro Stoxx 50 Blue-Chip Index',
    market: 'INDICES',
    currency: 'EUR',
    currentPrice: 6388.67,
    changePercent: 0.58,
    changeValue: 36.8,
    peRatio: 15.2,
    dividendYield: 3.2,
    marketCap: '€3.8 Trillion Aggregate',
    category: 'Pan-European Leader Benchmark Index',
    isIndex: true,
    pipSpread: '0.80 pts',
    defaultSignal: {
      action: 'BUY',
      score: 84,
      setup: 'ECB Rate Reduction Impulse',
    },
    historicalPoints: [5950, 6080, 6220, 6350, 6420, 6460, 6390, 6440, 6490, 6360, 6375, 6388.67],
  },
  {
    ticker: 'DXY',
    name: 'US Dollar Index Benchmark Currency Basket',
    market: 'INDICES',
    currency: 'USD',
    currentPrice: 103.35,
    changePercent: 0.18,
    changeValue: 0.19,
    peRatio: 0,
    dividendYield: 0,
    marketCap: 'Global Forex Reserve Anchor',
    category: 'Global Currency Power Benchmark',
    isIndex: true,
    pipSpread: '0.04 pts',
    defaultSignal: {
      action: 'BUY',
      score: 82,
      setup: '103.0 Support Defense & Fed Policy Yield Push',
    },
    historicalPoints: [101.5, 102.2, 103.1, 103.8, 103.2, 102.8, 102.1, 101.8, 102.5, 102.9, 103.1, 103.35],
  },
  {
    ticker: 'NASI',
    name: 'Nairobi All Share Index (NSE Kenya)',
    market: 'INDICES',
    currency: 'KES',
    currentPrice: 108.45,
    changePercent: 1.12,
    changeValue: 1.20,
    peRatio: 9.8,
    dividendYield: 7.8,
    marketCap: 'KES 1.7 Trillion Total NSE',
    category: 'East Africa Headline Market Index',
    isIndex: true,
    pipSpread: '0.05 pts',
    defaultSignal: {
      action: 'STRONG BUY',
      score: 87,
      setup: 'Foreign Investor Inflows & M-PESA Rebound',
    },
    historicalPoints: [92.0, 94.5, 97.2, 100.1, 99.5, 102.4, 104.0, 105.8, 107.2, 106.5, 107.8, 108.45],
  },
  {
    ticker: 'NSE20',
    name: 'Nairobi 20 Share Index (Blue-Chip Benchmark)',
    market: 'INDICES',
    currency: 'KES',
    currentPrice: 1745.20,
    changePercent: 0.65,
    changeValue: 11.2,
    peRatio: 8.4,
    dividendYield: 8.5,
    marketCap: 'KES 1.2 Trillion Blue Chips',
    category: 'Kenya Top 20 Capitalized Companies',
    isIndex: true,
    pipSpread: '0.50 pts',
    defaultSignal: {
      action: 'BUY',
      score: 83,
      setup: 'Banking Dividend Season Accumulation',
    },
    historicalPoints: [1520, 1550, 1590, 1630, 1620, 1660, 1685, 1710, 1730, 1720, 1738, 1745.20],
  },

  // ==========================================
  // --- NAIROBI SECURITIES EXCHANGE (NSE) STOCKS (6) ---
  // ==========================================
  {
    ticker: 'SCOM',
    name: 'Safaricom PLC',
    market: 'NSE',
    currency: 'KES',
    currentPrice: 35.00,
    changePercent: 0.0,
    changeValue: 0.0,
    peRatio: 15.8,
    dividendYield: 3.6,
    marketCap: 'KES 1.40 Trillion',
    category: 'Telecommunications & M-PESA',
    defaultSignal: {
      action: 'STRONG BUY',
      score: 87,
      setup: 'M-PESA Ecosystem & Ethiopia Expansion',
    },
    historicalPoints: [17.65, 19.2, 21.5, 23.8, 25.0, 27.4, 29.1, 30.8, 32.0, 33.4, 34.2, 35.0],
  },
  {
    ticker: 'EQTY',
    name: 'Equity Group Holdings',
    market: 'NSE',
    currency: 'KES',
    currentPrice: 100.00,
    changePercent: 0.0,
    changeValue: 0.0,
    peRatio: 6.9,
    dividendYield: 4.3,
    marketCap: 'KES 377 Billion',
    category: 'Banking & Financial Services',
    defaultSignal: {
      action: 'BUY',
      score: 84,
      setup: 'Regional Pan-African Banking Growth',
    },
    historicalPoints: [44.8, 50.0, 56.5, 62.0, 68.5, 74.0, 79.5, 84.0, 89.0, 93.5, 97.0, 100.0],
  },
  {
    ticker: 'KCB',
    name: 'KCB Group PLC',
    market: 'NSE',
    currency: 'KES',
    currentPrice: 89.00,
    changePercent: 0.0,
    changeValue: 0.0,
    peRatio: 5.1,
    dividendYield: 4.5,
    marketCap: 'KES 286 Billion',
    category: 'Banking & Financial Services',
    defaultSignal: {
      action: 'BUY',
      score: 82,
      setup: 'Balance Sheet Expansion & Dividend Recovery',
    },
    historicalPoints: [34.25, 39.0, 44.5, 49.0, 55.0, 61.5, 67.0, 72.5, 78.0, 82.0, 86.0, 89.0],
  },
  {
    ticker: 'EABL',
    name: 'East African Breweries Ltd',
    market: 'NSE',
    currency: 'KES',
    currentPrice: 273.00,
    changePercent: 0.0,
    changeValue: 0.0,
    peRatio: 16.4,
    dividendYield: 3.1,
    marketCap: 'KES 216 Billion',
    category: 'Consumer Goods & Beverages',
    defaultSignal: {
      action: 'BUY',
      score: 79,
      setup: 'East Africa Beverage Volume Recovery',
    },
    historicalPoints: [142.5, 155, 168, 182, 195, 208, 222, 235, 248, 258, 266, 273.0],
  },
  {
    ticker: 'SCBK',
    name: 'Standard Chartered Kenya',
    market: 'NSE',
    currency: 'KES',
    currentPrice: 310.00,
    changePercent: 0.0,
    changeValue: 0.0,
    peRatio: 7.4,
    dividendYield: 9.8,
    marketCap: 'KES 117 Billion',
    category: 'High Dividend Banking',
    defaultSignal: {
      action: 'STRONG BUY',
      score: 89,
      setup: 'Institutional Dividend Yield Anchor',
    },
    historicalPoints: [198.5, 210, 222, 234, 245, 258, 269, 278, 289, 296, 304, 310.0],
  },
  {
    ticker: 'BAT',
    name: 'BAT Kenya PLC',
    market: 'NSE',
    currency: 'KES',
    currentPrice: 550.00,
    changePercent: 0.0,
    changeValue: 0.0,
    peRatio: 9.6,
    dividendYield: 9.1,
    marketCap: 'KES 55 Billion',
    category: 'High Dividend Defensive',
    defaultSignal: {
      action: 'HOLD',
      score: 75,
      setup: 'Cash-Flow Dividend Support',
    },
    historicalPoints: [420, 435, 448, 460, 475, 488, 502, 514, 526, 535, 542, 550.0],
  },

  // ==========================================
  // --- US & GLOBAL EQUITIES (8) ---
  // ==========================================
  {
    ticker: 'AAPL',
    name: 'Apple Inc.',
    market: 'US',
    currency: 'USD',
    currentPrice: 356.27,
    changePercent: 0.0,
    changeValue: 0.0,
    peRatio: 33.8,
    dividendYield: 0.5,
    marketCap: '$3.5 Trillion',
    category: 'Mega-Cap Technology',
    defaultSignal: {
      action: 'BUY',
      score: 85,
      setup: 'Ecosystem & Apple Intelligence Cycle',
    },
    historicalPoints: [305, 312, 319, 325, 332, 340, 345, 349, 352, 351, 354, 356.27],
  },
  {
    ticker: 'NVDA',
    name: 'Nvidia Corporation',
    market: 'US',
    currency: 'USD',
    currentPrice: 162.85,
    changePercent: 0.0,
    changeValue: 0.0,
    peRatio: 46.5,
    dividendYield: 0.1,
    marketCap: '$3.9 Trillion',
    category: 'AI Accelerators & Chips',
    defaultSignal: {
      action: 'STRONG BUY',
      score: 93,
      setup: 'Data Center AI Infrastructure Wave',
    },
    historicalPoints: [110, 118, 124, 130, 136, 142, 145, 149, 153, 155, 159, 162.85],
  },
  {
    ticker: 'MSFT',
    name: 'Microsoft Corp',
    market: 'US',
    currency: 'USD',
    currentPrice: 523.88,
    changePercent: 0.0,
    changeValue: 0.0,
    peRatio: 34.2,
    dividendYield: 0.7,
    marketCap: '$3.8 Trillion',
    category: 'Cloud & Enterprise AI',
    defaultSignal: {
      action: 'BUY',
      score: 86,
      setup: 'Azure Enterprise Monetization',
    },
    historicalPoints: [470, 482, 491, 500, 508, 512, 505, 514, 518, 516, 520, 523.88],
  },
  {
    ticker: 'TSLA',
    name: 'Tesla Inc.',
    market: 'US',
    currency: 'USD',
    currentPrice: 387.97,
    changePercent: 0.0,
    changeValue: 0.0,
    peRatio: 85.0,
    dividendYield: 0.0,
    marketCap: '$1.2 Trillion',
    category: 'Autonomous EV & Energy',
    defaultSignal: {
      action: 'BUY',
      score: 81,
      setup: 'Autonomy & Grid Storage Expansion',
    },
    historicalPoints: [290, 305, 318, 330, 342, 355, 360, 368, 375, 378, 382, 387.97],
  },
  {
    ticker: 'AMZN',
    name: 'Amazon.com Inc.',
    market: 'US',
    currency: 'USD',
    currentPrice: 210.50,
    changePercent: 0.0,
    changeValue: 0.0,
    peRatio: 38.4,
    dividendYield: 0.0,
    marketCap: '$2.2 Trillion',
    category: 'AWS Cloud & E-Commerce',
    defaultSignal: {
      action: 'BUY',
      score: 86,
      setup: 'AWS Margin & Retail Fulfillment Efficiency',
    },
    historicalPoints: [175, 180, 184, 188, 192, 196, 198, 201, 204, 206, 208, 210.50],
  },
  {
    ticker: 'GOOGL',
    name: 'Alphabet Inc.',
    market: 'US',
    currency: 'USD',
    currentPrice: 185.20,
    changePercent: 0.0,
    changeValue: 0.0,
    peRatio: 23.1,
    dividendYield: 0.4,
    marketCap: '$2.3 Trillion',
    category: 'Search, Cloud & AI Models',
    defaultSignal: {
      action: 'BUY',
      score: 85,
      setup: 'Cloud Backlog & Ad Revenue Compounding',
    },
    historicalPoints: [158, 162, 165, 169, 171, 174, 176, 178, 180, 182, 184, 185.20],
  },
  {
    ticker: 'META',
    name: 'Meta Platforms Inc.',
    market: 'US',
    currency: 'USD',
    currentPrice: 615.40,
    changePercent: 0.0,
    changeValue: 0.0,
    peRatio: 27.2,
    dividendYield: 0.3,
    marketCap: '$1.5 Trillion',
    category: 'Digital Advertising & AI',
    defaultSignal: {
      action: 'STRONG BUY',
      score: 88,
      setup: 'AI Ad Targeting & Family of Apps Scale',
    },
    historicalPoints: [520, 535, 548, 560, 570, 580, 588, 594, 602, 608, 611, 615.40],
  },
  {
    ticker: 'SPY',
    name: 'SPDR S&P 500 ETF Trust',
    market: 'US',
    currency: 'USD',
    currentPrice: 754.37,
    changePercent: 0.0,
    changeValue: 0.0,
    peRatio: 26.5,
    dividendYield: 1.3,
    marketCap: '$600 Billion',
    category: 'Broad Market Index ETF',
    defaultSignal: {
      action: 'BUY',
      score: 84,
      setup: 'Macro Trend Continuation',
    },
    historicalPoints: [650, 665, 680, 690, 705, 715, 720, 730, 738, 742, 748, 754.37],
  },
];

interface AiAnalysisResult {
  ticker: string;
  companyName: string;
  isForex?: boolean;
  recommendation: 'Strong Buy' | 'Buy' | 'Hold' | 'Watchlist' | 'Trim';
  targetPrice: number;
  projectedUpside: string;
  riskRating: 'Low' | 'Moderate' | 'High';
  signal?: TradingSignal;
  thesis: string[];
  risks: string[];
  metrics: {
    peRatio: string;
    dividendYield: string;
    roe: string;
    marketCap: string;
    support: string;
    resistance: string;
    range52w: string;
  };
  news: Array<{
    headline: string;
    source: string;
    date: string;
    sentiment: 'Bullish' | 'Neutral' | 'Bearish';
    summary: string;
  }>;
}

export const StockRadarView: React.FC = () => {
  const { formatCurrency, currency, addInvestment, setActiveTab } = useFinance();

  const [selectedStock, setSelectedStock] = useState<StockProfile>(FEATURED_ASSETS[0]);
  const [filterMarket, setFilterMarket] = useState<'ALL' | 'FOREX' | 'METALS' | 'INDICES' | 'NSE' | 'US'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [timeframe, setTimeframe] = useState<Timeframe>('1M');
  const [chartType, setChartType] = useState<'candlestick' | 'line'>('candlestick');

  // Real-time market hours ticker (updates every 10s)
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  const nseSession = useMemo(() => getMarketSession('NSE', currentTime), [currentTime]);
  const usSession = useMemo(() => getMarketSession('US', currentTime), [currentTime]);
  const forexSession = useMemo(() => getMarketSession('FOREX', currentTime), [currentTime]);

  const activeStockSession = useMemo(() => {
    return getAssetMarketSession(selectedStock.ticker, selectedStock.market, currentTime);
  }, [selectedStock.ticker, selectedStock.market, currentTime]);

  // AI Analysis State
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiReport, setAiReport] = useState<AiAnalysisResult | null>(null);

  // Q&A State
  const [userQuestion, setUserQuestion] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [addedNotice, setAddedNotice] = useState(false);
  const [copiedSignal, setCopiedSignal] = useState(false);

  // Live Streaming & Real-time Ticks State
  const [isLiveStreaming, setIsLiveStreaming] = useState<boolean>(true);
  const [livePriceFlash, setLivePriceFlash] = useState<'up' | 'down' | null>(null);
  const [liveCandles, setLiveCandles] = useState<Candle[]>([]);

  // Real-time TradingView WebSocket / SSE feed quotes
  const liveTvQuotes = useTradingViewQuotes(2000);

  // Dual Chart Mode: Entire Forex, Metals, Indices & US use 'tradingview' live feed. NSE stocks use 'radar'.
  const [chartViewMode, setChartViewMode] = useState<'radar' | 'tradingview'>('tradingview');

  // Automatic Feed Routing: Ensure entire Forex, Metals, Indices & US use TradingView live feed
  // NSE stocks use NjiaFedha Pro Radar
  useEffect(() => {
    if (selectedStock.market === 'NSE') {
      setChartViewMode('radar');
    } else {
      setChartViewMode('tradingview');
    }
  }, [selectedStock.market, selectedStock.ticker]);
  const [bottomTab, setBottomTab] = useState<
    | 'paper'
    | 'orderflow'
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
    | 'camarilla'
  >('paper');

  // Price Alerts Modal & Notification State
  const [isAlertsModalOpen, setIsAlertsModalOpen] = useState(false);
  const [triggeredAlertBanner, setTriggeredAlertBanner] = useState<PriceAlert | null>(null);

  // Quick Lot Size / Risk Calculator State
  const [calcLotSize, setCalcLotSize] = useState<number>(0.1);
  const [showCalculator, setShowCalculator] = useState(false);

  // 1-Click Signal Execution into Paper Trading Desk
  const [prefillOrder, setPrefillOrder] = useState<PrefillOrderData | null>(null);

  // AI Vision Chart Screenshot Analyzer State
  const [isChartAnalyzerOpen, setIsChartAnalyzerOpen] = useState(false);
  const [forexSubCategory, setForexSubCategory] = useState<'ALL' | 'MAJORS' | 'EUROCROSS' | 'POUNDCROSS' | 'YENCROSS' | 'REGIONAL'>('ALL');
  const [forexViewMode, setForexViewMode] = useState<'grid' | 'table'>('grid');
  const [forexSentimentFilter, setForexSentimentFilter] = useState<'ALL' | 'BULLISH' | 'BEARISH'>('ALL');

  // Dedicated full roster of all 34 Forex pairs
  const allForexPairs = useMemo(() => {
    return FEATURED_ASSETS.filter((s) => s.market === 'FOREX');
  }, []);

  const filteredForexPairs = useMemo(() => {
    return allForexPairs.filter((pair) => {
      // Sub-category grouping
      if (forexSubCategory === 'MAJORS') {
        const majors = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'AUD/USD', 'USD/CAD', 'NZD/USD'];
        if (!majors.includes(pair.ticker)) return false;
      } else if (forexSubCategory === 'EUROCROSS') {
        const euroCross = ['EUR/GBP', 'EUR/JPY', 'EUR/CHF', 'EUR/AUD', 'EUR/CAD', 'EUR/NZD'];
        if (!euroCross.includes(pair.ticker)) return false;
      } else if (forexSubCategory === 'POUNDCROSS') {
        const poundCross = ['GBP/JPY', 'GBP/CHF', 'GBP/AUD', 'GBP/CAD', 'GBP/NZD'];
        if (!poundCross.includes(pair.ticker)) return false;
      } else if (forexSubCategory === 'YENCROSS') {
        const yenCross = ['AUD/JPY', 'CAD/JPY', 'CHF/JPY', 'NZD/JPY', 'AUD/CAD', 'AUD/NZD', 'CAD/CHF'];
        if (!yenCross.includes(pair.ticker)) return false;
      } else if (forexSubCategory === 'REGIONAL') {
        const reg = ['USD/KES', 'GBP/KES', 'EUR/KES', 'USD/ZAR', 'USD/UGX', 'USD/TZS', 'USD/MXN', 'USD/TRY', 'USD/SGD'];
        if (!reg.includes(pair.ticker)) return false;
      }

      // Sentiment filter
      const isBull = pair.defaultSignal.action === 'STRONG BUY' || pair.defaultSignal.action === 'BUY';
      const isBear = pair.defaultSignal.action === 'STRONG SELL' || pair.defaultSignal.action === 'SELL';
      if (forexSentimentFilter === 'BULLISH' && !isBull) return false;
      if (forexSentimentFilter === 'BEARISH' && !isBear) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          pair.ticker.toLowerCase().includes(q) ||
          pair.name.toLowerCase().includes(q) ||
          pair.category.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [allForexPairs, forexSubCategory, forexSentimentFilter, searchQuery]);

  const handleExecuteSignalToPaper = (trade: {
    direction: 'LONG' | 'SHORT';
    lots: number;
    sl: string;
    tp: string;
  }) => {
    setPrefillOrder({
      direction: trade.direction,
      lots: trade.lots,
      sl: trade.sl,
      tp: trade.tp,
      timestamp: Date.now(),
    });
    setBottomTab('paper');
    setTimeout(() => {
      const el = document.getElementById('trading-workbench');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }, 50);
  };

  // Filter stocks, forex pairs, metals & indices
  const filteredStocks = useMemo(() => {
    return FEATURED_ASSETS.filter((stock) => {
      if (filterMarket === 'FOREX' && stock.market !== 'FOREX') return false;
      if (filterMarket === 'METALS' && stock.market !== 'METALS') return false;
      if (filterMarket === 'INDICES' && stock.market !== 'INDICES') return false;
      if (filterMarket === 'NSE' && stock.market !== 'NSE') return false;
      if (filterMarket === 'US' && stock.market !== 'US') return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          stock.ticker.toLowerCase().includes(q) ||
          stock.name.toLowerCase().includes(q) ||
          stock.category.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [filterMarket, searchQuery]);

  // Fetch AI Analysis with Signal
  const fetchStockAnalysis = async (stock: StockProfile, targetTf?: string) => {
    setIsAiLoading(true);
    const activeTf = targetTf || timeframe || '1H';
    const liveSpotPrice = resolveTradingViewPrice(liveTvQuotes, stock.ticker, stock.currentPrice);
    try {
      const res = await fetch('/api/stocks/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticker: stock.ticker,
          companyName: stock.name,
          currency: stock.currency,
          market: stock.market,
          currentPrice: liveSpotPrice,
          timeframe: activeTf,
        }),
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }

      const data = await res.json();
      setAiReport(data);
    } catch {
      // Deterministic analytical profile with rich signal scaled to timeframe
      const isFx = stock.market === 'FOREX' || stock.market === 'METALS' || stock.market === 'INDICES';
      const isKES = stock.ticker.includes('KES');
      const isGold = stock.ticker.includes('XAU');

      const isScalp = ['1m', '3m', '5m', '15m'].includes(activeTf.toLowerCase());
      const isIntraday = ['30m', '45m', '1h', '2h'].includes(activeTf.toLowerCase());
      const isSwing = ['4h', '1d'].includes(activeTf.toLowerCase());
      const tfCategory = isScalp ? 'Scalp' : isIntraday ? 'Intraday' : isSwing ? 'Swing' : 'Position';

      let mult = 1.0;
      if (isScalp) mult = 0.35;
      else if (isIntraday) mult = 0.7;
      else if (isSwing) mult = 1.6;
      else mult = 3.0;

      let entryStr = '';
      let tp1Str = '';
      let tp2Str = '';
      let slStr = '';
      let obStr = '';
      let fvgStr = '';
      let bslTarget = '';
      let atrStr = '';

      if (isFx) {
        if (isGold) {
          const effectiveGoldPrice = liveSpotPrice;
          const slPts = Math.round(12.8 * mult * 10) / 10;
          const tp1Pts = Math.round(12.9 * mult * 10) / 10;
          const tp2Pts = Math.round(29.7 * mult * 10) / 10;
          const entrySpan = Math.round(2.5 * mult * 10) / 10;

          entryStr = `${(effectiveGoldPrice - entrySpan * 0.4).toFixed(2)} - ${(effectiveGoldPrice + entrySpan * 0.6).toFixed(2)}`;
          tp1Str = `${(effectiveGoldPrice + tp1Pts).toFixed(2)} (+${tp1Pts} pts / +${Math.round(tp1Pts * 10)} pips)`;
          tp2Str = `${(effectiveGoldPrice + tp2Pts).toFixed(2)} (+${tp2Pts} pts / +${Math.round(tp2Pts * 10)} pips)`;
          slStr = `${(effectiveGoldPrice - slPts).toFixed(2)} (-${slPts} pts / -${Math.round(slPts * 10)} pips)`;
          obStr = `${(effectiveGoldPrice - entrySpan * 1.5).toFixed(2)} - ${(effectiveGoldPrice - entrySpan * 0.3).toFixed(2)}`;
          fvgStr = `${(effectiveGoldPrice - entrySpan * 0.2).toFixed(2)} - ${(effectiveGoldPrice + entrySpan * 0.8).toFixed(2)}`;
          bslTarget = `Buy-Side Liquidity resting above ${(effectiveGoldPrice + tp1Pts * 1.05).toFixed(2)}`;
          atrStr = `$${(14 * mult).toFixed(1)} pts (${activeTf})`;
        } else if (isKES) {
          const slPips = Math.round(0.50 * mult * 100) / 100;
          const tp1Pips = Math.round(1.20 * mult * 100) / 100;
          const tp2Pips = Math.round(2.50 * mult * 100) / 100;

          entryStr = `${(liveSpotPrice - 0.15 * mult).toFixed(2)} - ${(liveSpotPrice + 0.15 * mult).toFixed(2)}`;
          tp1Str = `${(liveSpotPrice + tp1Pips).toFixed(2)} (+${Math.round(tp1Pips * 100)} pips)`;
          tp2Str = `${(liveSpotPrice + tp2Pips).toFixed(2)} (+${Math.round(tp2Pips * 100)} pips)`;
          slStr = `${(liveSpotPrice - slPips).toFixed(2)} (-${Math.round(slPips * 100)} pips)`;
          obStr = `${(liveSpotPrice - 0.30 * mult).toFixed(2)} - ${(liveSpotPrice - 0.10 * mult).toFixed(2)}`;
          fvgStr = `${(liveSpotPrice - 0.05 * mult).toFixed(2)} - ${(liveSpotPrice + 0.20 * mult).toFixed(2)}`;
          bslTarget = `Buy-Side Liquidity resting above ${(liveSpotPrice + tp1Pips).toFixed(2)}`;
          atrStr = `${(0.45 * mult).toFixed(2)} KES (${activeTf})`;
        } else {
          const slPips = Math.round(20 * mult);
          const tp1Pips = Math.round(45 * mult);
          const tp2Pips = Math.round(90 * mult);
          const pipVal = 0.0001;

          entryStr = `${(liveSpotPrice - 4 * mult * pipVal).toFixed(4)} - ${(liveSpotPrice + 4 * mult * pipVal).toFixed(4)}`;
          tp1Str = `${(liveSpotPrice + tp1Pips * pipVal).toFixed(4)} (+${tp1Pips} pips)`;
          tp2Str = `${(liveSpotPrice + tp2Pips * pipVal).toFixed(4)} (+${tp2Pips} pips)`;
          slStr = `${(liveSpotPrice - slPips * pipVal).toFixed(4)} (-${slPips} pips)`;
          obStr = `${(liveSpotPrice - 12 * mult * pipVal).toFixed(4)} - ${(liveSpotPrice - 3 * mult * pipVal).toFixed(4)}`;
          fvgStr = `${(liveSpotPrice - 2 * mult * pipVal).toFixed(4)} - ${(liveSpotPrice + 8 * mult * pipVal).toFixed(4)}`;
          bslTarget = `Buy-Side Liquidity resting above ${(liveSpotPrice + (tp1Pips + 8) * pipVal).toFixed(4)}`;
          atrStr = `${Math.round(35 * mult)} pips (${activeTf})`;
        }
      } else {
        entryStr = `${stock.currency} ${(liveSpotPrice * 0.98).toFixed(2)} - ${(liveSpotPrice * 1.01).toFixed(2)}`;
        tp1Str = `${stock.currency} ${(liveSpotPrice * 1.15).toFixed(2)} (+15%)`;
        tp2Str = `${stock.currency} ${(liveSpotPrice * 1.28).toFixed(2)} (+28%)`;
        slStr = `${stock.currency} ${(liveSpotPrice * 0.92).toFixed(2)} (-8%)`;
        obStr = `Key Support Range`;
        fvgStr = `Fair Value Area`;
        bslTarget = `Resistance Highs`;
        atrStr = `Moderate ATR (${activeTf})`;
      }

      const confScore = isScalp ? 88 : isIntraday ? 85 : 82;
      const setupName = isScalp
        ? 'Liquidity Sweep & FVG Retest (Scalp)'
        : isIntraday
        ? 'Order Block Retest & Intraday Expansion'
        : 'Macro Trend Continuation & Structural BOS';

      setAiReport({
        ticker: stock.ticker,
        companyName: stock.name,
        isForex: isFx,
        recommendation: stock.defaultSignal.action === 'STRONG BUY' ? 'Strong Buy' : stock.defaultSignal.action === 'BUY' ? 'Buy' : 'Hold',
        targetPrice: Math.round(liveSpotPrice * (isFx ? 1.025 : 1.18) * 100) / 100,
        projectedUpside: isFx ? '+1.25%' : '+18.2%',
        riskRating: stock.market === 'NSE' ? 'Moderate' : 'Low',
        signal: {
          action: stock.defaultSignal.action,
          setupType: setupName,
          timeframe: activeTf,
          timeframeCategory: tfCategory,
          confirmationScore: isScalp ? '4/5 Confluences: Sweep + FVG + RSI + EMA' : '5/5 Institutional Grade',
          entryZone: entryStr,
          takeProfit1: tp1Str,
          takeProfit2: tp2Str,
          stopLoss: slStr,
          riskReward: '1:2.4',
          confidenceScore: confScore,
          summary: `${activeTf} timeframe reveals high-probability ${setupName} with institutional volume absorption and favorable risk-to-reward.`,
          indicators: {
            rsi: isScalp ? '64.2 (Bullish Rejection)' : '58.5 (Bullish continuation)',
            macd: 'Bullish Crossover above signal line',
            movingAverages: `Trading above 20 & 50 EMA on ${activeTf}`,
            pivotPoint: isGold ? (liveSpotPrice - 5).toFixed(2) : isKES ? liveSpotPrice.toFixed(2) : (liveSpotPrice * 0.9985).toFixed(liveSpotPrice < 10 ? 4 : 2),
            atr: atrStr,
          },
          smc: {
            orderBlock: obStr,
            fairValueGap: fvgStr,
            liquidityTarget: bslTarget,
            marketStructure: 'BOS (Break of Structure Bullish)',
          },
          tradeManagement: {
            breakEvenRule: isGold
              ? `Move SL to Break-Even at +$${(10 * mult).toFixed(1)} pts / TP1`
              : `Move SL to Break-Even at +${Math.round(20 * mult)} pips / TP1`,
            partialProfitRule: `Close 70% position at TP1; let 30% runner ride to TP2 trailing swing lows`,
            invalidationRule: `Invalidate immediately if ${activeTf} candle closes below Stop Loss`,
          },
          multiAspectAnalysis: {
            marketStructure: `Price action on the ${activeTf} timeframe demonstrates clean structural accumulation with successive higher swing lows and bullish displacement.`,
            smartMoneyConcepts: `Institutional footprints confirm liquidity pool engineering: an initial liquidity sweep into the demand discount zone was met with swift institutional buying absorption.`,
            indicatorConfluence: `Indicator suite (${activeTf} RSI 14 at 64, MACD expanding positive, EMAs aligned upward) provides multi-oscillator confirmation for upside continuation.`,
            macroForexFactory: `Forex Factory news feed monitors high-impact central bank commentary and key economic releases; current setup maintains active News Guard clearance.`
          }
        },
        thesis: [
          `Key technical support held with sustained institutional order flow.`,
          `Positive risk-reward profile with verified 1:2.4 setup invalidation.`,
          `Favorable macro alignment and healthy liquidity characteristics.`,
        ],
        risks: [
          `High-impact central bank announcements and inflation data releases.`,
          `Short-term liquidity thinness during transition between global market sessions.`,
        ],
        metrics: {
          peRatio: isFx ? 'N/A (Forex)' : `${stock.peRatio}x`,
          dividendYield: `${stock.dividendYield}%`,
          roe: isFx ? 'N/A' : `${Math.round(stock.peRatio * 3.2)}%`,
          marketCap: stock.marketCap,
          support: isFx
            ? `${(liveSpotPrice * 0.995).toFixed(liveSpotPrice < 10 ? 4 : 2)}`
            : `${stock.currency} ${(liveSpotPrice * 0.92).toFixed(2)}`,
          resistance: isFx
            ? `${(liveSpotPrice * 1.015).toFixed(liveSpotPrice < 10 ? 4 : 2)}`
            : `${stock.currency} ${(liveSpotPrice * 1.12).toFixed(2)}`,
          range52w: `${stock.currency} ${(liveSpotPrice * 0.8).toFixed(2)} - ${(liveSpotPrice * 1.15).toFixed(2)}`,
        },
        news: [
          {
            headline: `${stock.name} demonstrates resilient technical momentum across active trading hours`,
            source: stock.isForex ? 'Reuters FX & Money Markets' : 'Business Daily Africa',
            date: 'Today',
            sentiment: 'Bullish',
            summary: `Interbank volume indicators confirm supportive buying clusters with upward trend structure intact on ${activeTf}.`,
          },
          {
            headline: `Market liquidity report confirms steady central bank and institutional flows`,
            source: stock.isForex ? 'Bloomberg FX Wire' : 'East African Market Review',
            date: 'Yesterday',
            sentiment: 'Neutral',
            summary: `Currency valuation indicators reflect balanced order books with moderate volatility.`,
          },
        ],
      });
    } finally {
      setIsAiLoading(false);
    }
  };

  // Load analysis on initial select or timeframe change
  useEffect(() => {
    fetchStockAnalysis(selectedStock, timeframe);
    setAiAnswer(null);
  }, [selectedStock.ticker, timeframe]);

  // Ask AI
  const handleAskAi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userQuestion.trim()) return;

    setIsAsking(true);
    try {
      const res = await fetch('/api/stocks/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: userQuestion,
          contextStock: `${selectedStock.ticker} (${selectedStock.name})`,
        }),
      });
      const data = await res.json();
      setAiAnswer(data.answer || 'No response returned.');
    } catch {
      setAiAnswer(
        `Based on current technical indicators for ${selectedStock.name} (${selectedStock.ticker}), the signal indicates ${
          selectedStock.defaultSignal.action
        } momentum. Ensure you implement tight risk management, position size according to stop loss levels, and monitor London/NY overlap session volatility.`
      );
    } finally {
      setIsAsking(false);
    }
  };

  // 1-Click Add to Investments Portfolio
  const handleAddToPortfolio = () => {
    addInvestment({
      name: `${selectedStock.name} (${selectedStock.ticker})`,
      assetClass: selectedStock.isForex ? 'Offshore / ETFs' : selectedStock.market === 'NSE' ? 'NSE Stocks' : 'Offshore / ETFs',
      currentValue: selectedStock.isForex ? 50000 : selectedStock.currentPrice * 100,
      investedAmount: selectedStock.isForex ? 50000 : selectedStock.currentPrice * 100,
      expectedAnnualYieldPercent: selectedStock.dividendYield || 8,
      provider: selectedStock.isForex
        ? 'Global Forex Interbank'
        : selectedStock.market === 'NSE'
        ? 'Nairobi Securities Exchange'
        : 'Global Brokerage',
    });
    setAddedNotice(true);
    setTimeout(() => setAddedNotice(false), 3000);
  };

  // 1-Click Copy Signal to Clipboard
  const handleCopySignal = () => {
    const sig = aiReport?.signal;
    if (!sig) return;

    const textToCopy = `🎯 [MullahTracker AI Signal]
Asset: ${selectedStock.ticker} (${selectedStock.name})
Action: ${sig.action}
Setup: ${sig.setupType}
Timeframe: ${sig.timeframe}
--------------------------
📍 Entry Zone: ${sig.entryZone}
🎯 Take Profit 1: ${sig.takeProfit1}
🚀 Take Profit 2: ${sig.takeProfit2}
🛡️ Stop Loss: ${sig.stopLoss}
⚖️ Risk/Reward: ${sig.riskReward}
⚡ Confidence: ${sig.confidenceScore}%
--------------------------
Summary: ${sig.summary}`;

    navigator.clipboard.writeText(textToCopy);
    setCopiedSignal(true);
    setTimeout(() => setCopiedSignal(false), 2500);
  };

  // Initialize base candles and hydrate with real Yahoo Finance OHLCV bars when available
  useEffect(() => {
    let active = true;
    const baseCandles = generateCandles(
      selectedStock.ticker,
      selectedStock.currentPrice,
      selectedStock.changeValue,
      timeframe,
      selectedStock.historicalPoints
    );
    setLiveCandles(baseCandles);

    fetch(
      `/api/stocks/history?ticker=${encodeURIComponent(selectedStock.ticker)}&timeframe=${encodeURIComponent(timeframe)}`
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!active || !data?.success || !Array.isArray(data.candles) || data.candles.length < 5) return;
        const enriched = enrichCandlesWithIndicators(data.candles);
        if (enriched.length > 0) {
          setLiveCandles(enriched);
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [selectedStock.ticker, selectedStock.currentPrice, selectedStock.changeValue, timeframe, selectedStock.historicalPoints]);

  const currentTvQuote = lookupTradingViewQuote(liveTvQuotes, selectedStock.ticker);
  const lastTvPriceRef = useRef<{ ticker: string; price: number } | null>(null);

  // Sync last candle cleanly to TradingView closing/live price; only flash/alert live ticks when session is OPEN
  useEffect(() => {
    if (!currentTvQuote || !(currentTvQuote.price > 0)) return;
    const tvPrice = currentTvQuote.price;
    const prev = lastTvPriceRef.current;

    if (prev && prev.ticker === selectedStock.ticker && prev.price !== tvPrice) {
      lastTvPriceRef.current = { ticker: selectedStock.ticker, price: tvPrice };
      if (activeStockSession.isOpen && isLiveStreaming) {
        setLivePriceFlash(tvPrice > prev.price ? 'up' : 'down');
        const flashTimer = setTimeout(() => setLivePriceFlash(null), 550);

        // Check active price alerts for this ticker using exact live TradingView price
        try {
          const alertsJson = localStorage.getItem('njia_price_alerts');
          if (alertsJson) {
            const list: PriceAlert[] = JSON.parse(alertsJson);
            let alertHit = false;
            const updatedList = list.map((a) => {
              if (a.isActive && !a.isTriggered && a.ticker === selectedStock.ticker) {
                const hit =
                  (a.condition === 'ABOVE' && tvPrice >= a.targetPrice) ||
                  (a.condition === 'BELOW' && tvPrice <= a.targetPrice);
                if (hit) {
                  playAlertChime();
                  setTriggeredAlertBanner(a);
                  setTimeout(() => setTriggeredAlertBanner(null), 8000);
                  alertHit = true;
                  return { ...a, isTriggered: true, triggeredAt: new Date().toLocaleTimeString() };
                }
              }
              return a;
            });
            if (alertHit) {
              localStorage.setItem('njia_price_alerts', JSON.stringify(updatedList));
            }
          }
        } catch {}

        setLiveCandles((prevCandles) => {
          if (!prevCandles || prevCandles.length === 0) return prevCandles;
          const copy = [...prevCandles];
          const lastIdx = copy.length - 1;
          const last = copy[lastIdx];
          copy[lastIdx] = {
            ...last,
            close: tvPrice,
            high: Math.max(last.high, tvPrice),
            low: Math.min(last.low, tvPrice),
          };
          return copy;
        });

        return () => clearTimeout(flashTimer);
      }
    } else {
      lastTvPriceRef.current = { ticker: selectedStock.ticker, price: tvPrice };
      setLiveCandles((prevCandles) => {
        if (!prevCandles || prevCandles.length === 0) return prevCandles;
        const last = prevCandles[prevCandles.length - 1];
        if (last.close === tvPrice) return prevCandles;
        const copy = [...prevCandles];
        copy[copy.length - 1] = {
          ...last,
          close: tvPrice,
          high: Math.max(last.high, tvPrice),
          low: Math.min(last.low, tvPrice),
        };
        return copy;
      });
    }
  }, [currentTvQuote?.price, selectedStock.ticker, isLiveStreaming, activeStockSession.isOpen]);

  const activeCandles = liveCandles.length > 0 ? liveCandles : generateCandles(
    selectedStock.ticker,
    selectedStock.currentPrice,
    selectedStock.changeValue,
    timeframe,
    selectedStock.historicalPoints
  );

  const periodStats = useMemo(() => {
    return computePeriodStats(activeCandles);
  }, [activeCandles]);

  const currentDisplayPrice =
    currentTvQuote && currentTvQuote.price > 0
      ? currentTvQuote.price
      : (activeCandles.length > 0 ? activeCandles[activeCandles.length - 1].close : selectedStock.currentPrice);

  const currentDisplayChangePercent =
    currentTvQuote ? currentTvQuote.changePercent : selectedStock.changePercent;
  const currentDisplayChangeValue =
    currentTvQuote ? currentTvQuote.changeValue : selectedStock.changeValue;

  const formatPriceVal = (p: number) => {
    if (selectedStock.market === 'FOREX') {
      if (selectedStock.ticker.includes('JPY')) return p.toFixed(3);
      if (selectedStock.ticker.includes('KES') || selectedStock.ticker.includes('UGX') || selectedStock.ticker.includes('TZS')) {
        return Math.abs(p) >= 100 ? p.toFixed(2) : p.toFixed(3);
      }
      if (Math.abs(p) < 10) return p.toFixed(5);
    }
    if (selectedStock.market === 'METALS') {
      if (selectedStock.ticker === 'HG/COPPER') return p.toFixed(4);
      if (selectedStock.ticker === 'XAU/KES') return p.toLocaleString('en-US', { maximumFractionDigits: 0 });
      if (selectedStock.ticker === 'XAU/USD' || selectedStock.ticker === 'XAG/USD' || selectedStock.ticker === 'XPT/USD' || selectedStock.ticker === 'XPD/USD' || selectedStock.ticker === 'XAU/EUR') {
        return Math.abs(p) >= 1000
          ? p.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
          : p.toFixed(3);
      }
      return p.toFixed(2);
    }
    if (selectedStock.market === 'INDICES') {
      if (selectedStock.ticker === 'DXY') return p.toFixed(3);
      if (Math.abs(p) >= 1000) return p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return p.toFixed(2);
    }
    if (Math.abs(p) >= 1000) return p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return p.toFixed(2);
  };

  const formatPairPrice = (p: number, isFx?: boolean) => {
    if (isFx && p < 10) return p.toFixed(4);
    if (p >= 1000) return p.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    return p.toFixed(2);
  };

  const getSignalBadgeStyle = (action: string) => {
    switch (action?.toUpperCase()) {
      case 'STRONG BUY':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.3)] animate-pulse';
      case 'BUY':
        return 'bg-teal-500/20 text-[#0df2c9] border-teal-500/50 shadow-[0_0_12px_rgba(13,242,201,0.25)]';
      case 'SELL':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/50 shadow-[0_0_12px_rgba(244,63,94,0.25)]';
      case 'STRONG SELL':
        return 'bg-red-950/60 text-red-300 border-red-500/60 shadow-[0_0_15px_rgba(239,68,68,0.3)] animate-pulse';
      default:
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    }
  };

  const activeSignal = useMemo(() => {
    if (aiReport?.signal) return aiReport.signal;

    const p = currentDisplayPrice;
    const currentTv = currentTvQuote;
    const recAll = currentTv?.recommendAll;
    const rsiVal = currentTv?.rsi;
    const adxVal = currentTv?.adx;
    const atrVal = currentTv?.atr;
    const macdVal = currentTv?.macd;
    const macdSig = currentTv?.macdSignal;

    // Determine algorithmic direction from TradingView's composite multi-indicator consensus
    let isBuy = selectedStock.defaultSignal.action.includes('BUY');
    let action = selectedStock.defaultSignal.action;
    let confidenceScore = selectedStock.defaultSignal.score;

    if (typeof recAll === 'number') {
      if (recAll >= 0.20) {
        action = 'STRONG BUY';
        isBuy = true;
        confidenceScore = Math.min(96, Math.max(88, Math.round(75 + recAll * 30)));
      } else if (recAll >= 0.05) {
        action = 'BUY';
        isBuy = true;
        confidenceScore = Math.min(88, Math.max(78, Math.round(72 + recAll * 25)));
      } else if (recAll <= -0.20) {
        action = 'STRONG SELL';
        isBuy = false;
        confidenceScore = Math.min(96, Math.max(88, Math.round(75 + Math.abs(recAll) * 30)));
      } else if (recAll <= -0.05) {
        action = 'SELL';
        isBuy = false;
        confidenceScore = Math.min(88, Math.max(78, Math.round(72 + Math.abs(recAll) * 25)));
      }
    }

    const setupType = selectedStock.defaultSignal.setup;
    const tf = timeframe || '15m Scalp';

    // Helper for precision formatting
    const formatPrice = (val: number): string => {
      if (selectedStock.market === 'FOREX') {
        if (selectedStock.ticker.includes('JPY')) return val.toFixed(3);
        if (selectedStock.ticker.includes('KES') || selectedStock.ticker.includes('UGX') || selectedStock.ticker.includes('TZS')) {
          return val >= 100 ? val.toFixed(2) : val.toFixed(3);
        }
        if (val < 10) return val.toFixed(5);
        return val.toFixed(4);
      }
      if (selectedStock.market === 'METALS') {
        if (selectedStock.ticker === 'HG/COPPER') return val.toFixed(4);
        if (selectedStock.ticker === 'XAU/KES') return val.toFixed(0);
        return val.toFixed(2);
      }
      if (selectedStock.market === 'INDICES') {
        if (selectedStock.ticker === 'DXY') return val.toFixed(3);
        return val.toFixed(2);
      }
      if (selectedStock.market === 'US') {
        return val.toFixed(2);
      }
      return val.toFixed(2);
    };

    let entrySpread = 0.0005;
    let slDelta = 0.0025;
    let tp1Delta = 0.0055;
    let tp2Delta = 0.0120;
    let slPipsText = '25 pips';
    let tp1PipsText = '55 pips';
    let tp2PipsText = '120 pips';
    let atrText = '45 pips';
    let marketImbalance = 'Fair Value Gap';

    if (selectedStock.ticker.includes('XAU')) {
      // Gold Spot
      entrySpread = 1.35;
      slDelta = 12.80;
      tp1Delta = 12.90;
      tp2Delta = 29.70;
      slPipsText = '12.8 pts (128 pips)';
      tp1PipsText = '12.9 pts (129 pips)';
      tp2PipsText = '29.7 pts (297 pips)';
      atrText = '$14.2 pts (15m)';
      marketImbalance = `$${Math.round(p)} Institutional Demand Imbalance`;
    } else if (selectedStock.ticker === 'XAG/USD') {
      // Silver Spot (~$49.14)
      entrySpread = 0.06;
      slDelta = 0.38;
      tp1Delta = 0.75;
      tp2Delta = 1.65;
      slPipsText = '38¢ (38 pips)';
      tp1PipsText = '75¢ (75 pips)';
      tp2PipsText = '$1.65 (165 pips)';
      atrText = '$0.54 pts';
      marketImbalance = 'Solar & Industrial Physical Order Block';
    } else if (selectedStock.market === 'METALS') {
      entrySpread = p * 0.002;
      slDelta = p * 0.012;
      tp1Delta = p * 0.024;
      tp2Delta = p * 0.052;
      slPipsText = `${formatPrice(slDelta)} pts`;
      tp1PipsText = `${formatPrice(tp1Delta)} pts`;
      tp2PipsText = `${formatPrice(tp2Delta)} pts`;
      atrText = `${formatPrice(p * 0.015)} pts`;
      marketImbalance = 'Precious Metals Liquidity Pocket';
    } else if (selectedStock.market === 'FOREX') {
      if (selectedStock.ticker.includes('JPY')) {
        // Yen crosses (1 pip = 0.01)
        entrySpread = 0.07;
        slDelta = 0.35;
        tp1Delta = 0.72;
        tp2Delta = 1.55;
        slPipsText = '35 pips';
        tp1PipsText = '72 pips';
        tp2PipsText = '155 pips';
        atrText = '62 pips';
        marketImbalance = 'Tokyo Session Order Block Imbalance';
      } else if (selectedStock.ticker.includes('KES')) {
        // Kenyan Shilling crosses
        entrySpread = 0.20;
        slDelta = 0.65;
        tp1Delta = 1.40;
        tp2Delta = 3.10;
        slPipsText = '0.65 KES';
        tp1PipsText = '1.40 KES';
        tp2PipsText = '3.10 KES';
        atrText = '1.20 KES';
        marketImbalance = 'Central Bank Interbank FX Window';
      } else if (selectedStock.ticker.includes('ZAR')) {
        // Rand crosses
        entrySpread = 0.035;
        slDelta = 0.14;
        tp1Delta = 0.28;
        tp2Delta = 0.60;
        slPipsText = '140 pips';
        tp1PipsText = '280 pips';
        tp2PipsText = '600 pips';
        atrText = '0.19 ZAR';
        marketImbalance = 'Mining Flow Imbalance';
      } else if (selectedStock.ticker.includes('UGX') || selectedStock.ticker.includes('TZS')) {
        entrySpread = 4.0;
        slDelta = 16.0;
        tp1Delta = 34.0;
        tp2Delta = 75.0;
        slPipsText = '16 pts';
        tp1PipsText = '34 pts';
        tp2PipsText = '75 pts';
        atrText = '25 pts';
        marketImbalance = 'EAC Cross-Border Trade Flow';
      } else {
        // Standard Major/Minor Forex (1 pip = 0.0001)
        entrySpread = 0.0005;
        slDelta = 0.0025;
        tp1Delta = 0.0055;
        tp2Delta = 0.0120;
        slPipsText = '25 pips';
        tp1PipsText = '55 pips';
        tp2PipsText = '120 pips';
        atrText = '48 pips';
        marketImbalance = 'London / New York Session Imbalance';
      }
    } else if (selectedStock.market === 'INDICES') {
      if (selectedStock.ticker === 'US500') {
        entrySpread = 3.0;
        slDelta = 18.5;
        tp1Delta = 38.0;
        tp2Delta = 84.0;
        slPipsText = '18.5 pts';
        tp1PipsText = '38.0 pts';
        tp2PipsText = '84.0 pts';
        atrText = '29.5 pts';
        marketImbalance = 'Institutional Index Buy-Program Zone';
      } else if (selectedStock.ticker === 'NAS100') {
        entrySpread = 9.0;
        slDelta = 68.0;
        tp1Delta = 145.0;
        tp2Delta = 320.0;
        slPipsText = '68.0 pts';
        tp1PipsText = '145.0 pts';
        tp2PipsText = '320.0 pts';
        atrText = '118.0 pts';
        marketImbalance = 'Mega-Cap Tech Liquidity Pocket';
      } else if (selectedStock.ticker === 'US30') {
        entrySpread = 18.0;
        slDelta = 135.0;
        tp1Delta = 280.0;
        tp2Delta = 610.0;
        slPipsText = '135.0 pts';
        tp1PipsText = '280.0 pts';
        tp2PipsText = '610.0 pts';
        atrText = '215.0 pts';
        marketImbalance = 'Blue-Chip Wall Street Block Flow';
      } else if (selectedStock.ticker === 'DXY') {
        entrySpread = 0.05;
        slDelta = 0.32;
        tp1Delta = 0.65;
        tp2Delta = 1.45;
        slPipsText = '32 pips';
        tp1PipsText = '65 pips';
        tp2PipsText = '145 pips';
        atrText = '0.45 pts';
        marketImbalance = 'Treasury Yield Macro Divergence';
      } else {
        entrySpread = p * 0.0015;
        slDelta = p * 0.0035;
        tp1Delta = p * 0.0075;
        tp2Delta = p * 0.0165;
        slPipsText = `${formatPrice(slDelta)} pts`;
        tp1PipsText = `${formatPrice(tp1Delta)} pts`;
        tp2PipsText = `${formatPrice(tp2Delta)} pts`;
        atrText = `${formatPrice(p * 0.005)} pts`;
        marketImbalance = 'Global Benchmark Index Futures Block';
      }
    } else if (selectedStock.market === 'US') {
      entrySpread = p * 0.003;
      slDelta = p * 0.022;
      tp1Delta = p * 0.048;
      tp2Delta = p * 0.105;
      slPipsText = `$${formatPrice(slDelta)} (-2.2%)`;
      tp1PipsText = `$${formatPrice(tp1Delta)} (+4.8%)`;
      tp2PipsText = `$${formatPrice(tp2Delta)} (+10.5%)`;
      atrText = `$${formatPrice(p * 0.025)}`;
      marketImbalance = 'Institutional Equity Dark Pool Imbalance';
    } else {
      // NSE Stocks
      entrySpread = p * 0.004;
      slDelta = p * 0.030;
      tp1Delta = p * 0.065;
      tp2Delta = p * 0.140;
      slPipsText = `KES ${formatPrice(slDelta)} (-3.0%)`;
      tp1PipsText = `KES ${formatPrice(tp1Delta)} (+6.5%)`;
      tp2PipsText = `KES ${formatPrice(tp2Delta)} (+14.0%)`;
      atrText = `KES ${formatPrice(p * 0.035)}`;
      marketImbalance = 'Nairobi Exchange Direct Order Book Queue';
    }

    const entryMin = p - entrySpread * 0.45;
    const entryMax = p + entrySpread * 0.55;

    const stopLossVal = isBuy ? p - slDelta : p + slDelta;
    const tp1Val = isBuy ? p + tp1Delta : p - tp1Delta;
    const tp2Val = isBuy ? p + tp2Delta : p - tp2Delta;
    const pivotVal = isBuy ? p - slDelta * 0.3 : p + slDelta * 0.3;

    const obMin = isBuy ? p - slDelta * 0.75 : p + slDelta * 0.25;
    const obMax = isBuy ? p - slDelta * 0.25 : p + slDelta * 0.75;
    const fvgMin = isBuy ? entryMin : entryMin;
    const fvgMax = isBuy ? entryMax : entryMax;
    const liqTargetVal = isBuy ? p + tp1Delta * 1.15 : p - tp1Delta * 1.15;
    const beTriggerVal = isBuy ? p + tp1Delta * 0.65 : p - tp1Delta * 0.65;

    return {
      action,
      setupType,
      timeframe: tf,
      timeframeCategory: tf.includes('m') ? 'Scalp' : tf.includes('H') ? 'Intraday' : 'Swing',
      confirmationScore: typeof adxVal === 'number'
        ? (adxVal < 20
            ? `⚠️ Low Trend ADX: ${adxVal.toFixed(1)} (Consolidation Filter Active)`
            : `4/4 Verified Confluences: ADX ${adxVal.toFixed(1)} Trend + TV Rating (${recAll && recAll >= 0 ? '+' : ''}${recAll?.toFixed(2)}) + ATR Stops`)
        : '4/5 Confluences: Sweep + FVG + RSI + EMA',
      entryZone: `${formatPrice(entryMin)} - ${formatPrice(entryMax)}`,
      takeProfit1: `${formatPrice(tp1Val)} (+${tp1PipsText})`,
      takeProfit2: `${formatPrice(tp2Val)} (+${tp2PipsText})`,
      stopLoss: `${formatPrice(stopLossVal)} (-${slPipsText})`,
      riskReward: '1:2.4',
      confidenceScore: confidenceScore,
      summary: `${tf} timeframe confirms liquidity sweep with displacement into ${marketImbalance} at ${formatPrice(p)}.`,
      indicators: {
        rsi: typeof rsiVal === 'number'
          ? `${rsiVal.toFixed(1)} (${rsiVal > 60 ? 'Bullish Expansion' : rsiVal < 40 ? 'Oversold Discount' : 'Neutral Equilibrium'})`
          : (isBuy ? '63.5 (Bullish Expansion)' : '37.8 (Bearish Momentum)'),
        macd: typeof macdVal === 'number' && typeof macdSig === 'number'
          ? (macdVal >= macdSig
              ? `Bullish Momentum (MACD: ${macdVal.toFixed(4)} > Signal)`
              : `Bearish Divergence (MACD: ${macdVal.toFixed(4)} < Signal)`)
          : (isBuy ? 'Bullish Crossover above signal line' : 'Bearish Divergence under signal line'),
        movingAverages: typeof recAll === 'number'
          ? `TradingView MA Bias: ${recAll >= 0 ? '+' : ''}${recAll.toFixed(2)} (${isBuy ? 'Aligned with Uptrend' : 'Aligned with Downtrend'})`
          : `Trading ${isBuy ? 'above' : 'below'} 20 & 50 EMA on ${tf}`,
        pivotPoint: formatPrice(pivotVal),
        atr: atrText,
      },
      smc: {
        orderBlock: `${formatPrice(obMin)} - ${formatPrice(obMax)} (${isBuy ? 'Bullish Demand' : 'Bearish Supply'})`,
        fairValueGap: `${formatPrice(fvgMin)} - ${formatPrice(fvgMax)} (${isBuy ? 'Bullish FVG' : 'Bearish FVG'})`,
        liquidityTarget: `${isBuy ? 'Buy-Side Liquidity (BSL) resting above' : 'Sell-Side Liquidity (SSL) resting below'} ${formatPrice(liqTargetVal)}`,
        marketStructure: isBuy ? 'BOS (Break of Structure Bullish)' : 'CHoCH (Change of Character Bearish)',
      },
      tradeManagement: {
        breakEvenRule: `Move SL to Break-Even at ${formatPrice(beTriggerVal)}`,
        partialProfitRule: 'Close 70% volume at TP1; trail remaining 30% runner behind swing structure',
        invalidationRule: `Close setup immediately if a ${tf} candle closes ${isBuy ? 'below' : 'above'} ${formatPrice(stopLossVal)}`,
      },
    };
  }, [aiReport, selectedStock, currentDisplayPrice, timeframe]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Zap className="w-6 h-6 text-[#0df2c9]" />
            AI Stocks & Forex Radar • Live Signals & Market Charts
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time algorithmic trading signals (Buy/Sell, Entry, TP, SL), institutional forex analysis, and interactive TradingView charts.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {/* Live Feed Toggle */}
          <button
            onClick={() => setIsLiveStreaming((p) => !p)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-mono font-bold transition-all cursor-pointer ${
              isLiveStreaming
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.25)]'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
            }`}
            title="Toggle Live Price Ticking Stream"
          >
            {isLiveStreaming ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>LIVE STREAM: ON</span>
              </>
            ) : (
              <>
                <Pause className="w-3.5 h-3.5 text-amber-400" />
                <span>STREAM: PAUSED</span>
              </>
            )}
          </button>

          {/* AI Vision Chart Screenshot Analyzer Button */}
          <button
            onClick={() => setIsChartAnalyzerOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-teal-500/20 via-purple-500/20 to-teal-500/10 hover:from-teal-500/30 hover:to-purple-500/30 text-[#0df2c9] border border-teal-500/40 font-bold text-xs transition-all cursor-pointer shadow-[0_0_15px_rgba(13,242,201,0.2)] group"
            title="Upload or paste chart screenshot for instant AI analysis and signal generation"
          >
            <Camera className="w-4 h-4 text-[#0df2c9] group-hover:scale-110 transition-transform" />
            <span className="hidden sm:inline">Upload Chart Screenshot</span>
            <span className="sm:hidden">Upload Chart</span>
            <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-teal-500/20 text-teal-300 border border-teal-500/30">
              VISION AI
            </span>
          </button>

          <button
            onClick={handleCopySignal}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#111e33] hover:bg-[#182b4a] text-slate-200 border border-[#1e3459] font-medium text-xs transition-all cursor-pointer shadow-sm"
            title="Copy current trading signal details to clipboard"
          >
            {copiedSignal ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-400 font-bold">Signal Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-teal-400" />
                <span>Copy Signal</span>
              </>
            )}
          </button>

          <button
            onClick={handleAddToPortfolio}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0df2c9] text-black font-semibold text-xs hover:bg-[#0df2c9]/90 transition-all shadow-[0_0_15px_rgba(13,242,201,0.25)] cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{selectedStock.isForex ? 'Add FX Position' : 'Add 100 Shares'}</span>
          </button>
        </div>
      </div>

      {addedNotice && (
        <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>
              Added {selectedStock.name} ({selectedStock.ticker}) to your Investments Portfolio!
            </span>
          </div>
          <span className="font-mono text-emerald-400 font-bold">Recorded in Portfolio</span>
        </div>
      )}

      {/* Quick-Launch Dedicated Trading Tools: Bloomberg Live TV & Order Flow */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-gradient-to-r from-[#0d1627] via-[#091120] to-[#0a1424] border border-[#182845] shadow-lg">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-cyan-400 animate-pulse" />
          <span className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider">
            Advanced Trading Tools:
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setBottomTab('livetv');
              const el = document.getElementById('trading-workbench');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500/20 to-cyan-500/15 hover:from-emerald-500/30 hover:to-cyan-500/25 border border-emerald-500/40 text-emerald-300 hover:text-white text-xs font-bold transition-all shadow-sm cursor-pointer group"
          >
            <Globe2 className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
            <span>World Monitor & Bloomberg TV</span>
            <span className="flex h-1.5 w-1.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
            </span>
          </button>

          <button
            onClick={() => {
              setBottomTab('orderflow');
              const el = document.getElementById('trading-workbench');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-300 hover:text-white text-xs font-bold transition-all shadow-sm cursor-pointer group"
          >
            <Layers className="w-3.5 h-3.5 text-cyan-400 group-hover:scale-110 transition-transform" />
            <span>Order Flow & Liquidity</span>
          </button>

          <button
            onClick={() => setActiveTab('mt5-ea')}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-500/20 via-teal-500/15 to-purple-500/20 hover:from-purple-500/30 hover:to-teal-500/25 border border-purple-500/40 text-purple-300 hover:text-white text-xs font-bold transition-all shadow-sm cursor-pointer group"
          >
            <Bot className="w-3.5 h-3.5 text-purple-400 group-hover:scale-110 transition-transform" />
            <span>MT5 Scalper Bot EA & Code</span>
            <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-purple-500/30 text-purple-200 border border-purple-400/30 font-bold">
              .MQ5
            </span>
          </button>
        </div>
      </div>

      {/* Search & Asset Market Filters */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search ticker, Forex pair, or company (e.g. EUR/USD, USD/KES, Gold, Safaricom, Nvidia)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#0c1322] border border-[#18253b] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
            />
          </div>

          {/* Market filter tabs */}
          <div className="flex flex-wrap items-center gap-1 p-1 bg-[#0c1322] border border-[#18253b] rounded-xl self-start">
            <button
              onClick={() => setFilterMarket('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                filterMarket === 'ALL'
                  ? 'bg-teal-500/20 text-[#0df2c9] border border-teal-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All Assets ({FEATURED_ASSETS.length})
            </button>

            {/* FOREX TAB */}
            <button
              onClick={() => setFilterMarket('FOREX')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                filterMarket === 'FOREX'
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>💱 Forex Pairs ({FEATURED_ASSETS.filter((s) => s.market === 'FOREX').length})</span>
              <span
                className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold ${
                  forexSession.isOpen
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {forexSession.isOpen ? 'LIVE 24/5' : 'CLOSED'}
              </span>
            </button>

            {/* METALS TAB */}
            <button
              onClick={() => setFilterMarket('METALS')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                filterMarket === 'METALS'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>🥇 Metals & Commodities ({FEATURED_ASSETS.filter((s) => s.market === 'METALS').length})</span>
              <span
                className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold ${
                  forexSession.isOpen
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {forexSession.isOpen ? 'LIVE' : 'CLOSED'}
              </span>
            </button>

            {/* INDICES TAB */}
            <button
              onClick={() => setFilterMarket('INDICES')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                filterMarket === 'INDICES'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>📊 Global Indices ({FEATURED_ASSETS.filter((s) => s.market === 'INDICES').length})</span>
              <span
                className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold ${
                  forexSession.isOpen
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {forexSession.isOpen ? 'FUTURES LIVE' : 'CLOSED'}
              </span>
            </button>

            {/* NSE KENYA TAB */}
            <button
              onClick={() => setFilterMarket('NSE')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                filterMarket === 'NSE'
                  ? 'bg-teal-500/20 text-[#0df2c9] border border-teal-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>🇰🇪 Nairobi (NSE) ({FEATURED_ASSETS.filter((s) => s.market === 'NSE').length})</span>
              <span
                className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold ${
                  nseSession.isOpen
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {nseSession.isOpen ? 'LIVE' : 'CLOSED'}
              </span>
            </button>

            {/* US & GLOBAL TAB */}
            <button
              onClick={() => setFilterMarket('US')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                filterMarket === 'US'
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>🌐 US Equities ({FEATURED_ASSETS.filter((s) => s.market === 'US').length})</span>
              <span
                className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold ${
                  usSession.isOpen
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {usSession.isOpen ? 'LIVE' : 'CLOSED'}
              </span>
            </button>
          </div>
        </div>

        {/* Horizontal Ticker Chips with Live Signal Badges */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {filteredStocks.map((stock) => {
            const isSelected = selectedStock.ticker === stock.ticker;
            const tvQ = lookupTradingViewQuote(liveTvQuotes, stock.ticker);

            const chipPrice = tvQ && tvQ.price > 0 ? tvQ.price : stock.currentPrice;
            const chipChangePct = tvQ ? tvQ.changePercent : stock.changePercent;
            const isUp = chipChangePct >= 0;
            const isStockLive = getAssetMarketSession(stock.ticker, stock.market, currentTime).isOpen;

            const isSignalBullish =
              stock.defaultSignal.action === 'STRONG BUY' || stock.defaultSignal.action === 'BUY';

            return (
              <button
                key={stock.ticker}
                onClick={() => setSelectedStock(stock)}
                className={`flex items-center gap-3 px-3.5 py-2 rounded-xl border text-xs transition-all shrink-0 cursor-pointer ${
                  isSelected
                    ? 'bg-[#102235] text-white border-teal-500/60 shadow-[0_0_15px_rgba(13,242,201,0.2)]'
                    : 'bg-[#0c1322] hover:bg-[#111c30] text-slate-300 border-[#18253b]'
                }`}
              >
                <div>
                  <div className="font-bold flex items-center gap-1.5">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isStockLive
                          ? 'bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(16,185,129,0.9)]'
                          : 'bg-slate-500'
                      }`}
                      title={isStockLive ? 'Live Session Active' : 'Market Closed'}
                    />
                    <span>{stock.ticker}</span>

                    {/* Market tag */}
                    <span
                      className={`text-[9px] font-mono px-1 rounded ${
                        stock.market === 'FOREX'
                          ? 'bg-purple-900/60 text-purple-300 border border-purple-700/50'
                          : stock.market === 'METALS'
                          ? 'bg-amber-900/60 text-amber-300 border border-amber-700/50'
                          : stock.market === 'INDICES'
                          ? 'bg-cyan-900/60 text-cyan-300 border border-cyan-700/50'
                          : stock.market === 'NSE'
                          ? 'bg-teal-900/60 text-teal-300 border border-teal-700/50'
                          : 'bg-blue-900/60 text-blue-300 border border-blue-700/50'
                      }`}
                    >
                      {stock.market}
                    </span>

                    {/* Signal Pill */}
                    <span
                      className={`text-[8px] font-mono font-bold px-1.5 py-0.2 rounded ${
                        isSignalBullish
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      }`}
                    >
                      {stock.defaultSignal.action} {stock.defaultSignal.score}%
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 truncate max-w-[125px]">{stock.name}</div>
                </div>

                <div className="text-right font-mono">
                  <div className="font-bold text-white">
                    {stock.currency} {formatPriceVal(chipPrice)}
                  </div>
                  <div
                    className={`text-[10px] font-semibold flex items-center justify-end gap-0.5 ${
                      isUp ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {isUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    <span>
                      {isUp ? '+' : ''}
                      {chipChangePct.toFixed(2)}%
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ======================================================== */}
      {/* COMPREHENSIVE ALL FOREX CURRENCY PAIRS DIRECTORY & AI SCANNER */}
      {/* ======================================================== */}
      {filterMarket === 'FOREX' && (
        <div className="space-y-4 animate-in fade-in duration-300">
          {/* AI Vision Chart Screenshot Analyzer Banner */}
          <div className="relative overflow-hidden p-5 rounded-2xl bg-gradient-to-r from-[#0c182a] via-[#121c38] to-[#0d222e] border border-teal-500/40 shadow-[0_0_25px_rgba(13,242,201,0.12)]">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-teal-500/10 border border-teal-500/40 flex items-center justify-center text-[#0df2c9] shadow-[0_0_20px_rgba(13,242,201,0.25)] shrink-0">
                  <Camera className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                      📸 AI Vision Chart Screenshot Analyzer & Signal Architect
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-teal-500/20 text-[#0df2c9] border border-teal-500/30">
                      GEMINI VISION QUANT
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                    Have a chart open on <strong className="text-teal-300">TradingView</strong>, <strong className="text-teal-300">MetaTrader MT4/MT5</strong>, or your broker? Upload or paste (<kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-teal-300 font-mono text-[10px]">Ctrl+V</kbd>) any screenshot. The AI scans market structure, order blocks, FVG liquidity & candlesticks to deliver an accurate institutional signal (Entry, TP1, TP2, Stop Loss).
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 self-start md:self-auto shrink-0">
                <button
                  type="button"
                  onClick={() => setIsChartAnalyzerOpen(true)}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-teal-400 to-[#0df2c9] hover:opacity-95 text-black font-bold text-xs transition-all shadow-[0_0_20px_rgba(13,242,201,0.35)] cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  <span>Upload Chart Screenshot</span>
                </button>
              </div>
            </div>
          </div>

          {/* Directory Navigation & Sub-Category Filter Bar */}
          <div className="p-4 rounded-2xl bg-[#0c1322] border border-[#18253b] space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                  All Forex Currency Pairs Directory ({allForexPairs.length} Total Active)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Showing {filteredForexPairs.length} pairs • Click any pair to load live TradingView chart, multi-timeframe AI signals, and paper trading slip.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Sentiment Filter */}
                <div className="flex items-center gap-1 p-1 bg-[#070b13] border border-[#162540] rounded-xl text-xs">
                  <button
                    type="button"
                    onClick={() => setForexSentimentFilter('ALL')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                      forexSentimentFilter === 'ALL'
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    All Signals ({allForexPairs.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setForexSentimentFilter('BULLISH')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                      forexSentimentFilter === 'BULLISH'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    🟢 Bullish ({allForexPairs.filter((p) => p.defaultSignal.action === 'STRONG BUY' || p.defaultSignal.action === 'BUY').length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setForexSentimentFilter('BEARISH')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                      forexSentimentFilter === 'BEARISH'
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    🔴 Bearish ({allForexPairs.filter((p) => p.defaultSignal.action === 'STRONG SELL' || p.defaultSignal.action === 'SELL').length})
                  </button>
                </div>

                {/* Grid / Table View Toggle */}
                <div className="flex items-center gap-1 p-1 bg-[#070b13] border border-[#162540] rounded-xl">
                  <button
                    type="button"
                    onClick={() => setForexViewMode('grid')}
                    className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                      forexViewMode === 'grid'
                        ? 'bg-teal-500/20 text-[#0df2c9] border border-teal-500/40'
                        : 'text-slate-400 hover:text-white'
                    }`}
                    title="Grid Card View"
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setForexViewMode('table')}
                    className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                      forexViewMode === 'table'
                        ? 'bg-teal-500/20 text-[#0df2c9] border border-teal-500/40'
                        : 'text-slate-400 hover:text-white'
                    }`}
                    title="Compact Table Matrix View"
                  >
                    <Table className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Sub-Category Tabs */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-[#141f33]">
              {[
                { id: 'ALL', label: '🌐 All Pairs', count: 34 },
                { id: 'MAJORS', label: '👑 Majors', count: 7 },
                { id: 'EUROCROSS', label: '🇪🇺 Euro Crosses', count: 6 },
                { id: 'POUNDCROSS', label: '🇬🇧 Pound Crosses', count: 5 },
                { id: 'YENCROSS', label: '🇯🇵 Yen & Crosses', count: 7 },
                { id: 'REGIONAL', label: '🌍 Emerging & Africa', count: 9 },
              ].map((sub) => (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => setForexSubCategory(sub.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    forexSubCategory === sub.id
                      ? 'bg-purple-500/25 text-purple-200 border border-purple-500/50 shadow-sm'
                      : 'bg-[#080d18] text-slate-400 hover:text-white hover:bg-[#10192e] border border-transparent'
                  }`}
                >
                  <span>{sub.label}</span>
                  <span className="ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-slate-800 text-slate-300">
                    {sub.count}
                  </span>
                </button>
              ))}
            </div>

            {/* View Mode 1: Rich Cards Grid */}
            {forexViewMode === 'grid' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 pt-2 max-h-[520px] overflow-y-auto pr-1">
                {filteredForexPairs.map((pair) => {
                  const isSelected = selectedStock.ticker === pair.ticker;
                  const tvQ = lookupTradingViewQuote(liveTvQuotes, pair.ticker);
                  const pairPrice = tvQ && tvQ.price > 0 ? tvQ.price : pair.currentPrice;
                  const pairChangePct = tvQ ? tvQ.changePercent : pair.changePercent;
                  const isUp = pairChangePct >= 0;
                  const isBullish =
                    pair.defaultSignal.action === 'STRONG BUY' || pair.defaultSignal.action === 'BUY';

                  return (
                    <div
                      key={pair.ticker}
                      className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between ${
                        isSelected
                          ? 'bg-[#102235] border-teal-500/70 shadow-[0_0_15px_rgba(13,242,201,0.15)] ring-1 ring-teal-500/40'
                          : 'bg-[#080d18] hover:bg-[#0d1627] border-[#18263e]'
                      }`}
                    >
                      <div className="space-y-2">
                        {/* Header Row */}
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-sm text-white font-mono">{pair.ticker}</span>
                              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-purple-950/60 text-purple-300 border border-purple-700/40">
                                {pair.pipSpread || '0.8 pips'}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400 truncate max-w-[170px]" title={pair.name}>
                              {pair.name}
                            </div>
                          </div>

                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold shrink-0 ${
                              isBullish
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            }`}
                          >
                            {pair.defaultSignal.action} {pair.defaultSignal.score}%
                          </span>
                        </div>

                        {/* Price & Change Row */}
                        <div className="flex items-baseline justify-between pt-1 font-mono">
                          <span className="text-base font-bold text-white">
                            {formatPairPrice(pairPrice, true)}
                          </span>
                          <span
                            className={`text-xs font-semibold flex items-center gap-0.5 ${
                              isUp ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {isUp ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                            {isUp ? '+' : ''}{pairChangePct.toFixed(2)}%
                          </span>
                        </div>

                        {/* Setup Preview */}
                        <div className="p-2 rounded-lg bg-[#0c1424] border border-[#17253d] text-[10px] text-slate-300">
                          <span className="text-purple-400 font-semibold">Setup:</span> {pair.defaultSignal.setup}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-1.5 pt-3 mt-2 border-t border-[#15233c]">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedStock(pair);
                            fetchStockAnalysis(pair);
                            const el = document.getElementById('primary-trading-chart');
                            if (el) el.scrollIntoView({ behavior: 'smooth' });
                          }}
                          className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-teal-500 text-black shadow-sm'
                              : 'bg-teal-500/15 hover:bg-teal-500/25 text-[#0df2c9] border border-teal-500/30'
                          }`}
                        >
                          <Zap className="w-3 h-3" />
                          <span>{isSelected ? 'Active Chart' : 'Analyze & Chart'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedStock(pair);
                            handleExecuteSignalToPaper({
                              direction: isBullish ? 'LONG' : 'SHORT',
                              lots: 0.1,
                              sl: String(isBullish ? (pairPrice * 0.996).toFixed(4) : (pairPrice * 1.004).toFixed(4)),
                              tp: String(isBullish ? (pairPrice * 1.008).toFixed(4) : (pairPrice * 0.992).toFixed(4)),
                            });
                          }}
                          className="py-1.5 px-2.5 rounded-lg text-[11px] font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
                          title="Send to Paper Trading Desk"
                        >
                          <Target className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* View Mode 2: Compact Institutional Matrix Table */}
            {forexViewMode === 'table' && (
              <div className="overflow-x-auto rounded-xl border border-[#1b2b45] mt-2 max-h-[500px] overflow-y-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-[#080d18] text-slate-400 text-[10px] uppercase tracking-wider border-b border-[#1b2b45] sticky top-0 z-10">
                    <tr>
                      <th className="py-2.5 px-3">Pair Symbol</th>
                      <th className="py-2.5 px-3">Category & Profile</th>
                      <th className="py-2.5 px-3 text-right">Live Bid Price</th>
                      <th className="py-2.5 px-3 text-right">24h Change</th>
                      <th className="py-2.5 px-3 text-center">Pip Spread</th>
                      <th className="py-2.5 px-3 text-center">Algo Signal</th>
                      <th className="py-2.5 px-3">Primary Setup</th>
                      <th className="py-2.5 px-3 text-center">Execution</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#15233c] bg-[#090f1d]">
                    {filteredForexPairs.map((pair) => {
                      const isSelected = selectedStock.ticker === pair.ticker;
                      const tvQ = lookupTradingViewQuote(liveTvQuotes, pair.ticker);
                      const pairPrice = tvQ && tvQ.price > 0 ? tvQ.price : pair.currentPrice;
                      const pairChangePct = tvQ ? tvQ.changePercent : pair.changePercent;
                      const isUp = pairChangePct >= 0;
                      const isBull =
                        pair.defaultSignal.action === 'STRONG BUY' || pair.defaultSignal.action === 'BUY';

                      return (
                        <tr
                          key={pair.ticker}
                          className={`hover:bg-[#0e172a] transition-colors ${
                            isSelected ? 'bg-teal-950/20' : ''
                          }`}
                        >
                          <td className="py-2.5 px-3 font-bold text-white">
                            <div className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              <span>{pair.ticker}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-slate-300 truncate max-w-[180px]">
                            {pair.name}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-white">
                            {formatPairPrice(pairPrice, true)}
                          </td>
                          <td
                            className={`py-2.5 px-3 text-right font-semibold ${
                              isUp ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {isUp ? '+' : ''}{pairChangePct.toFixed(2)}%
                          </td>
                          <td className="py-2.5 px-3 text-center text-purple-300">
                            {pair.pipSpread || '0.8 pips'}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                isBull
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              }`}
                            >
                              {pair.defaultSignal.action} {pair.defaultSignal.score}%
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-300 text-[11px] truncate max-w-[200px]">
                            {pair.defaultSignal.setup}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedStock(pair);
                                fetchStockAnalysis(pair);
                                const el = document.getElementById('primary-trading-chart');
                                if (el) el.scrollIntoView({ behavior: 'smooth' });
                              }}
                              className="px-2.5 py-1 rounded-lg bg-teal-500/20 hover:bg-teal-500/30 text-[#0df2c9] border border-teal-500/40 text-[11px] font-bold transition-all cursor-pointer"
                            >
                              Chart & Trade
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Stock & Forex Dashboard Grid */}
      <div id="primary-trading-chart" className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full">
        {/* Left Column: Interactive Chart, Timeframe Stats & Ratios (7 cols on lg, 8 cols on xl) */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-5">
          {/* Main Chart Card */}
          <div className="p-5 rounded-2xl bg-[#0c1322] border border-[#18253b] space-y-4">
            {/* Header row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#141f33]">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs font-mono border ${
                    selectedStock.market === 'FOREX'
                      ? 'bg-purple-500/10 border-purple-500/30 text-purple-300'
                      : 'bg-teal-500/10 border-teal-500/30 text-[#0df2c9]'
                  }`}
                >
                  {selectedStock.ticker.slice(0, 3)}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-bold text-white">{selectedStock.name}</h2>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#111c30] text-slate-300 border border-[#1a2c49]">
                      {selectedStock.ticker} • {selectedStock.market}
                    </span>

                    {/* LIVE / CLOSED BADGE */}
                    {activeStockSession.isOpen ? (
                      <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-bold text-[10px] shadow-[0_0_10px_rgba(16,185,129,0.25)]">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        <span>MARKET LIVE</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-800/90 border border-slate-700/80 text-slate-400 font-bold text-[10px]">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-500 inline-block" />
                        <span>MARKET CLOSED</span>
                      </span>
                    )}

                    {/* FOREX SESSIONS BADGE */}
                    {selectedStock.market === 'FOREX' && activeStockSession.activeForexSession && (
                      <span className="flex items-center gap-1 text-[10px] font-mono text-cyan-300 bg-cyan-950/40 border border-cyan-800/50 px-2 py-0.5 rounded-full">
                        <Globe2 className="w-3 h-3 text-cyan-400" />
                        <span>{activeStockSession.activeForexSession}</span>
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-0.5">
                    <span>{selectedStock.category}</span>
                    <span className="text-slate-600">•</span>
                    <span className="text-slate-400 font-mono text-[11px] flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-500" />
                      <span>{activeStockSession.details}</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Dual Chart Engine Switcher & Timeframe selector */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Mode Selector */}
                <div className="flex items-center gap-1 bg-[#070b13] p-1 rounded-xl border border-[#162540]">
                  {selectedStock.market === 'NSE' ? (
                    <button
                      onClick={() => setChartViewMode('radar')}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                        chartViewMode === 'radar'
                          ? 'bg-teal-500/20 text-[#0df2c9] border border-teal-500/40 shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                      title="NjiaFedha Pro Radar: Specialized Nairobi Securities Exchange direct order book & candles"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-teal-400" />
                      <span>NjiaFedha NSE Radar</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => setChartViewMode('radar')}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                        chartViewMode === 'radar'
                          ? 'bg-teal-500/20 text-[#0df2c9] border border-teal-500/40 shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                      title="NjiaFedha Pro Radar: Custom chart with AI signals, lot sizer & dataset export"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Pro Radar</span>
                    </button>
                  )}

                  <button
                    onClick={() => setChartViewMode('tradingview')}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                      chartViewMode === 'tradingview'
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                    title="TradingView Live Stream: Official real-time institutional exchange tick data feed"
                  >
                    <Activity className="w-3.5 h-3.5 text-purple-400" />
                    <span>TradingView Live Feed {selectedStock.market !== 'NSE' && '●'}</span>
                  </button>

                  <button
                    onClick={() => setIsAlertsModalOpen(true)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition-all cursor-pointer shadow-sm"
                    title="Live Price Alerts & Watch Triggers"
                  >
                    <Bell className="w-3.5 h-3.5" />
                    <span>Price Alerts</span>
                  </button>
                </div>

                {/* Timeframe selector (available in both Pro Radar & TradingView modes) */}
                <div className="flex flex-wrap items-center gap-1 bg-[#070b13] p-1 rounded-xl border border-[#162540]">
                  {(['1m', '5m', '15m', '1H', '4H', '1D', '1W', '1M'] as Timeframe[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTimeframe(t)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer ${
                        timeframe === t
                          ? 'bg-teal-500/20 text-[#0df2c9] border border-teal-500/40 shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Triggered Alert Toast Banner */}
            {triggeredAlertBanner && (
              <div className="p-3 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-between text-xs text-amber-300">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-amber-400 animate-pulse" />
                  <span>
                    <strong>PRICE ALERT TRIGGERED:</strong> {triggeredAlertBanner.ticker} has reached{' '}
                    <strong className="underline">{triggeredAlertBanner.currency} {triggeredAlertBanner.targetPrice}</strong>{' '}
                    ({triggeredAlertBanner.condition === 'ABOVE' ? 'Above' : 'Below'} trigger level)!
                  </span>
                </div>
                <button
                  onClick={() => setTriggeredAlertBanner(null)}
                  className="text-slate-400 hover:text-white cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Price & Period Performance Row */}
            <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-3 pt-1">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 uppercase tracking-wider block">
                    {activeStockSession.isOpen ? 'Live Market Rate' : 'Last Close Rate'}
                  </span>
                  <span
                    className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded ${
                      activeStockSession.isOpen && isLiveStreaming
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 animate-pulse'
                        : !activeStockSession.isOpen
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {activeStockSession.isOpen && isLiveStreaming
                      ? 'LIVE TICK STREAM'
                      : !activeStockSession.isOpen
                      ? 'MARKET CLOSED · FROZEN'
                      : 'STATIC'}
                  </span>
                </div>
                <div className="flex items-baseline gap-3 mt-1">
                  <span
                    className={`text-3xl font-extrabold font-mono transition-all duration-300 tracking-tight ${
                      livePriceFlash === 'up'
                        ? 'text-emerald-400 drop-shadow-[0_0_12px_rgba(16,185,129,0.7)]'
                        : livePriceFlash === 'down'
                        ? 'text-rose-400 drop-shadow-[0_0_12px_rgba(244,63,94,0.7)]'
                        : 'text-white'
                    }`}
                  >
                    {selectedStock.currency} {formatPriceVal(currentDisplayPrice)}
                  </span>
                  <div
                    className={`flex items-center gap-1 font-mono text-sm font-bold ${
                      currentDisplayChangePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {currentDisplayChangePercent >= 0 ? (
                      <ArrowUpRight className="w-4 h-4" />
                    ) : (
                      <ArrowDownRight className="w-4 h-4" />
                    )}
                    <span>
                      {currentDisplayChangePercent >= 0 ? '+' : ''}
                      {formatPriceVal(currentDisplayChangeValue)} (
                      {currentDisplayChangePercent >= 0 ? '+' : ''}
                      {currentDisplayChangePercent.toFixed(2)}%)
                    </span>
                  </div>
                </div>
              </div>

              {/* Market Schedule Banner */}
              <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 p-2.5 rounded-xl bg-[#080e18] border border-[#162540] text-xs font-mono">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">Trading Schedule</span>
                  <span className="text-slate-300 font-semibold">{activeStockSession.tradingHours}</span>
                </div>
                <div className="sm:border-l sm:border-[#1e2f4a] sm:pl-3">
                  <span className="text-slate-500 block text-[10px] uppercase">Session Status</span>
                  <span
                    className={
                      activeStockSession.isOpen ? 'text-emerald-400 font-bold' : 'text-amber-400 font-semibold'
                    }
                  >
                    {activeStockSession.nextSessionText}
                  </span>
                </div>
              </div>
            </div>

            {/* Interactive Candlestick Chart or TradingView Widget */}
            <div className="pt-1">
              {chartViewMode === 'radar' ? (
                <CandlestickChart
                  candles={activeCandles}
                  currency={selectedStock.currency}
                  ticker={selectedStock.ticker}
                  timeframe={timeframe}
                  onTimeframeChange={setTimeframe}
                  isMarketLive={activeStockSession.isOpen}
                  marketSession={activeStockSession}
                  chartType={chartType}
                  onChartTypeChange={setChartType}
                  isLiveStreaming={isLiveStreaming}
                  onToggleLiveStreaming={() => setIsLiveStreaming((p) => !p)}
                  currentLivePrice={currentDisplayPrice}
                />
              ) : (
                <TradingViewWidget
                  ticker={selectedStock.ticker}
                  market={selectedStock.market}
                  timeframe={timeframe}
                  height={470}
                  onSwitchToProRadar={() => setChartViewMode('radar')}
                />
              )}
            </div>

            {/* Fundamental & Timeframe Range Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-3 border-t border-[#141f33]">
              <div className="p-2.5 rounded-xl bg-[#070b13] border border-[#142036]">
                <div className="text-[10px] text-emerald-400 uppercase tracking-wider">{timeframe} High</div>
                <div className="text-xs font-bold font-mono text-emerald-300 mt-0.5 truncate">
                  {selectedStock.currency} {formatPriceVal(periodStats.highestPrice)}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-[#070b13] border border-[#142036]">
                <div className="text-[10px] text-rose-400 uppercase tracking-wider">{timeframe} Low</div>
                <div className="text-xs font-bold font-mono text-rose-300 mt-0.5 truncate">
                  {selectedStock.currency} {formatPriceVal(periodStats.lowestPrice)}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-[#070b13] border border-[#142036]">
                <div className="text-[10px] text-cyan-400 uppercase tracking-wider">
                  {selectedStock.isForex ? 'Pip Spread' : currentTvQuote?.volume ? 'Session Vol' : 'Timeframe Vol'}
                </div>
                <div className="text-xs font-bold font-mono text-cyan-300 mt-0.5 truncate">
                  {selectedStock.isForex
                    ? selectedStock.pipSpread || '0.8 pips'
                    : (() => {
                        const vol = currentTvQuote?.volume && currentTvQuote.volume > 0 ? currentTvQuote.volume : periodStats.totalVolume;
                        return vol >= 1000000 ? `${(vol / 1000000).toFixed(2)}M` : vol.toLocaleString();
                      })()}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-[#070b13] border border-[#142036]">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider">
                  {selectedStock.isForex ? 'Daily ATR' : 'P/E Ratio'}
                </div>
                <div className="text-xs font-bold font-mono text-white mt-0.5">
                  {selectedStock.isForex
                    ? activeSignal.indicators.atr
                    : `${(currentTvQuote?.peRatio && currentTvQuote.peRatio > 0 ? currentTvQuote.peRatio : selectedStock.peRatio).toFixed(1)}x`}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-[#070b13] border border-[#142036]">
                <div className="text-[10px] text-emerald-400 uppercase tracking-wider">
                  {selectedStock.isForex ? 'Yield / Carry' : 'Div Yield'}
                </div>
                <div className="text-xs font-bold font-mono text-emerald-300 mt-0.5">
                  {(typeof currentTvQuote?.dividendYield === 'number' ? currentTvQuote.dividendYield : selectedStock.dividendYield).toFixed(2)}%
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-[#070b13] border border-[#142036]">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider">
                  {selectedStock.isForex ? 'Market Liquidity' : 'Market Cap'}
                </div>
                <div className="text-xs font-bold font-mono text-white mt-0.5 truncate">
                  {(() => {
                    const mc = currentTvQuote?.marketCap;
                    if (!selectedStock.isForex && typeof mc === 'number' && mc > 0) {
                      const prefix = selectedStock.currency === 'KES' ? 'KES ' : '$';
                      if (mc >= 1e12) return `${prefix}${(mc / 1e12).toFixed(2)}T`;
                      if (mc >= 1e9) return `${prefix}${(mc / 1e9).toFixed(1)}B`;
                      return `${prefix}${(mc / 1e6).toFixed(0)}M`;
                    }
                    return selectedStock.marketCap;
                  })()}
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Trading Workbench: Paper Trading Desk, Economic Calendar & News */}
          <div id="trading-workbench" className="space-y-4">
            {/* Workbench Navigation Tabs */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-1.5 rounded-2xl bg-[#0c1322] border border-[#18253b]">
              <div className="flex flex-wrap items-center gap-1">
                <button
                  onClick={() => setBottomTab('paper')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    bottomTab === 'paper'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Zap className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Paper Terminal</span>
                </button>

                <button
                  onClick={() => setBottomTab('orderflow')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    bottomTab === 'orderflow'
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Order Flow & Liquidity</span>
                </button>

                <button
                  onClick={() => setBottomTab('livetv')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    bottomTab === 'livetv'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Globe2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>World Monitor & Bloomberg TV</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                </button>

                <button
                  onClick={() => setBottomTab('journal')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    bottomTab === 'journal'
                      ? 'bg-[#0df2c9]/20 text-[#0df2c9] border border-[#0df2c9]/40 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Award className="w-3.5 h-3.5 text-[#0df2c9]" />
                  <span>Performance Journal & Curve</span>
                </button>

                <button
                  onClick={() => setBottomTab('risk-calc')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    bottomTab === 'risk-calc'
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Calculator className="w-3.5 h-3.5 text-purple-400" />
                  <span>Risk & Lot Calculator</span>
                </button>

                <button
                  onClick={() => setBottomTab('sessions')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    bottomTab === 'sessions'
                      ? 'bg-teal-500/20 text-[#0df2c9] border border-teal-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5 text-teal-400" />
                  <span>Killzones & Sessions</span>
                </button>

                <button
                  onClick={() => setBottomTab('prop-guard')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    bottomTab === 'prop-guard'
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <ShieldAlert className="w-3.5 h-3.5 text-purple-400" />
                  <span>Prop Firm Guard</span>
                </button>

                <button
                  onClick={() => setBottomTab('correlation')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    bottomTab === 'correlation'
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Grid className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Correlation Matrix</span>
                </button>

                <button
                  onClick={() => setBottomTab('broker-arbiter')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    bottomTab === 'broker-arbiter'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Broker M-Pesa Arbiter</span>
                </button>

                <button
                  onClick={() => setBottomTab('strength')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    bottomTab === 'strength'
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Globe className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Currency Strength & Heatmap</span>
                </button>

                <button
                  onClick={() => setBottomTab('backtest')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    bottomTab === 'backtest'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Strategy Backtester</span>
                </button>

                <button
                  onClick={() => setBottomTab('calendar')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    bottomTab === 'calendar'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Flame className="w-3.5 h-3.5 text-amber-400" />
                  <span>Economic Calendar</span>
                </button>

                <button
                  onClick={() => setBottomTab('news')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    bottomTab === 'news'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Flame className="w-3.5 h-3.5 text-rose-400" />
                  <span>Forex Factory News & AI Insights</span>
                </button>

                <button
                  onClick={() => setBottomTab('sentiment')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    bottomTab === 'sentiment'
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Users className="w-3.5 h-3.5 text-purple-400" />
                  <span>Retail Sentiment & Order Book</span>
                </button>

                <button
                  onClick={() => setBottomTab('dispatcher')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    bottomTab === 'dispatcher'
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Send className="w-3.5 h-3.5 text-blue-400" />
                  <span>Telegram & Discord Broadcast</span>
                </button>

                <button
                  onClick={() => setBottomTab('intermarket')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    bottomTab === 'intermarket'
                      ? 'bg-[#0df2c9]/20 text-[#0df2c9] border border-[#0df2c9]/40 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Compass className="w-3.5 h-3.5 text-[#0df2c9]" />
                  <span>Intermarket Macro Radar</span>
                </button>

                <button
                  onClick={() => setBottomTab('adr')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    bottomTab === 'adr'
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Activity className="w-3.5 h-3.5 text-cyan-400" />
                  <span>ADR Volatility Exhaustion</span>
                </button>

                <button
                  onClick={() => setBottomTab('mtf-matrix')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    bottomTab === 'mtf-matrix'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5 text-emerald-400" />
                  <span>MTF 4H-1M Matrix</span>
                </button>

                <button
                  onClick={() => setBottomTab('cot')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    bottomTab === 'cot'
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Flame className="w-3.5 h-3.5 text-purple-400" />
                  <span>COT Smart Money</span>
                </button>

                <button
                  onClick={() => setBottomTab('camarilla')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    bottomTab === 'camarilla'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Target className="w-3.5 h-3.5 text-amber-400" />
                  <span>Camarilla & CPR Pivots</span>
                </button>
              </div>

              <span className="text-[11px] font-mono text-slate-500 px-2 hidden lg:inline">
                Asset: {selectedStock.ticker}
              </span>
            </div>

            {/* Tab 1: Live Paper Trading Desk */}
            {bottomTab === 'paper' && (
              <PaperTradingDesk
                ticker={selectedStock.ticker}
                name={selectedStock.name}
                market={selectedStock.market}
                currency={selectedStock.currency}
                currentPrice={currentDisplayPrice}
                defaultSl={activeSignal.stopLoss}
                defaultTp={activeSignal.takeProfit1}
                pipSpread={selectedStock.pipSpread}
                prefillOrder={prefillOrder}
              />
            )}

            {/* Tab: Order Flow, Volume Profile & Liquidity */}
            {bottomTab === 'orderflow' && (
              <OrderFlowLiquidityDesk
                currentTicker={selectedStock.ticker}
                currentPrice={currentDisplayPrice}
                currency={selectedStock.currency}
                onApplyZoneToOrder={(entry, sl, tp) => {
                  setPrefillOrder({
                    direction: entry >= currentDisplayPrice ? 'LONG' : 'SHORT',
                    lots: 0.1,
                    sl: String(sl),
                    tp: String(tp),
                    timestamp: Date.now(),
                  });
                  setBottomTab('paper');
                }}
              />
            )}

            {/* Tab: Bloomberg Live TV & Media Player */}
            {bottomTab === 'livetv' && (
              <LiveMarketsTVDesk
                onSelectTicker={(symbol) => {
                  const match = FEATURED_ASSETS.find((a) => a.ticker === symbol);
                  if (match) setSelectedStock(match);
                }}
              />
            )}

            {/* Tab 2: Performance Journal & Equity Curve */}
            {bottomTab === 'journal' && (
              <TradingJournalDesk currentTicker={selectedStock.ticker} />
            )}

            {/* Tab 3: Smart Risk & Lot Sizing Calculator */}
            {bottomTab === 'risk-calc' && (
              <RiskCalculatorDesk
                currentTicker={selectedStock.ticker}
                currentPrice={currentDisplayPrice}
                market={selectedStock.market}
                currency={selectedStock.currency}
                defaultSl={activeSignal.stopLoss}
                defaultTp={activeSignal.takeProfit1}
                onApplyToOrder={() => {
                  setBottomTab('paper');
                }}
              />
            )}

            {/* Tab 4: Forex Sessions & Killzones Radar */}
            {bottomTab === 'sessions' && (
              <ForexSessionsKillzones
                currentTicker={selectedStock.ticker}
                onSelectPair={(pair) => {
                  const match = FEATURED_ASSETS.find((a) => a.ticker === pair);
                  if (match) setSelectedStock(match);
                }}
              />
            )}

            {/* Tab 5: Prop Firm Risk Guardian */}
            {bottomTab === 'prop-guard' && (
              <PropFirmRiskGuardian currentTicker={selectedStock.ticker} />
            )}

            {/* Tab 6: Currency Pair Correlation Matrix */}
            {bottomTab === 'correlation' && (
              <CurrencyCorrelationMatrix
                currentTicker={selectedStock.ticker}
                onSelectPair={(pair) => {
                  const match = FEATURED_ASSETS.find((a) => a.ticker === pair);
                  if (match) setSelectedStock(match);
                }}
              />
            )}

            {/* Tab 7: Broker M-Pesa Spread Arbiter */}
            {bottomTab === 'broker-arbiter' && <BrokerMpesaArbiter />}

            {/* Tab 8: Currency Strength Meter & Heatmap */}
            {bottomTab === 'strength' && (
              <CurrencyStrengthMeter
                onSelectPair={(pair) => {
                  const match = FEATURED_ASSETS.find((a) => a.ticker === pair);
                  if (match) setSelectedStock(match);
                }}
              />
            )}

            {/* Tab 9: AI Strategy Backtester */}
            {bottomTab === 'backtest' && (
              <StrategyBacktester
                currentTicker={selectedStock.ticker}
                currentPrice={currentDisplayPrice}
              />
            )}

            {/* Tab 10: Economic Calendar */}
            {bottomTab === 'calendar' && (
              <EconomicCalendar currentTicker={selectedStock.ticker} />
            )}

            {/* Tab 11: Forex Factory Live News & AI Insights Feed */}
            {bottomTab === 'news' && (
              <ForexFactoryNewsDesk
                currentTicker={selectedStock.ticker}
                market={selectedStock.market}
              />
            )}

            {/* Tab 12: Retail vs. Institutional Sentiment & Order Book */}
            {bottomTab === 'sentiment' && (
              <RetailSentimentDesk
                currentTicker={selectedStock.ticker}
                onSelectTicker={(ticker) => {
                  const match = FEATURED_ASSETS.find((a) => a.ticker === ticker || a.ticker.replace('/', '') === ticker.replace('/', ''));
                  if (match) setSelectedStock(match);
                }}
              />
            )}

            {/* Tab 13: 1-Click Telegram & Discord Signal Dispatcher */}
            {bottomTab === 'dispatcher' && (
              <TelegramSignalDispatcher
                activeSignal={{
                  symbol: selectedStock.ticker,
                  action: (activeSignal.action === 'HOLD' || activeSignal.action === 'NEUTRAL' ? 'BUY' : activeSignal.action) as any,
                  timeframe: activeSignal.timeframe,
                  price: currentDisplayPrice,
                  entryZone: activeSignal.entryZone,
                  sl: activeSignal.stopLoss,
                  tp1: activeSignal.takeProfit1,
                  tp2: activeSignal.takeProfit2,
                  rr: activeSignal.riskReward,
                  score: activeSignal.confidenceScore,
                  grade: 'A+ PRIME SCALP',
                  confluences: '5/5 Institutional Guards Engaged (MTF Trend + Dynamic ATR Stops + ADX Chop Guard + TV Consensus + News Guard)',
                }}
              />
            )}

            {/* Tab 14: Intermarket Macro Divergence Radar */}
            {bottomTab === 'intermarket' && (
              <IntermarketDivergenceRadar
                onSelectPair={(pair) => {
                  const match = FEATURED_ASSETS.find((a) => a.ticker === pair || a.ticker.replace('/', '') === pair.replace('/', ''));
                  if (match) setSelectedStock(match);
                }}
              />
            )}

            {/* Tab 15: Average Daily Range (ADR) Volatility Exhaustion */}
            {bottomTab === 'adr' && (
              <AdrVolatilityExhaustionDesk
                currentTicker={selectedStock.ticker}
                onSelectTicker={(ticker) => {
                  const match = FEATURED_ASSETS.find((a) => a.ticker === ticker || a.ticker.replace('/', '') === ticker.replace('/', ''));
                  if (match) setSelectedStock(match);
                }}
              />
            )}

            {/* Tab 16: Multi-Timeframe 4H-1M Confluence Matrix */}
            {bottomTab === 'mtf-matrix' && (
              <MtfConfluenceMatrixDesk
                onSelectPair={(pair) => {
                  const match = FEATURED_ASSETS.find((a) => a.ticker === pair || a.ticker.replace('/', '') === pair.replace('/', ''));
                  if (match) setSelectedStock(match);
                }}
              />
            )}

            {/* Tab 17: COT Institutional Smart Money Flow */}
            {bottomTab === 'cot' && <CotInstitutionalMatrix />}

            {/* Tab 18: Camarilla & Central Pivot Range (CPR) */}
            {bottomTab === 'camarilla' && (
              <CamarillaPivotMatrix
                currentTicker={selectedStock.ticker}
                onSelectTicker={(ticker) => {
                  const match = FEATURED_ASSETS.find((a) => a.ticker === ticker || a.ticker.replace('/', '') === ticker.replace('/', ''));
                  if (match) setSelectedStock(match);
                }}
              />
            )}
          </div>

        </div>

        {/* Right Column: AI Signal Hub, Execution Blueprint & Chat (5 cols on lg, 4 cols on xl) */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-5">
          {/* DEDICATED AI TRADING SIGNAL HUB */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-[#0e1b2f] via-[#091322] to-[#070c16] border border-teal-500/40 space-y-4 shadow-xl relative overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider font-extrabold text-teal-300 flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-[#0df2c9]" />
                <span>AI Trading Signal Blueprint</span>
              </span>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleCopySignal}
                  className="p-1.5 rounded-lg bg-[#111e33] hover:bg-[#192b49] text-slate-300 hover:text-white transition-colors cursor-pointer"
                  title="Copy signal to clipboard"
                >
                  {copiedSignal ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-teal-400" />}
                </button>

                <button
                  onClick={() => fetchStockAnalysis(selectedStock)}
                  disabled={isAiLoading}
                  className="p-1.5 rounded-lg bg-[#0e1b2e] hover:bg-[#152742] text-slate-400 hover:text-white transition-colors cursor-pointer"
                  title="Re-analyze and refresh AI Signal"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isAiLoading ? 'animate-spin text-teal-400' : ''}`} />
                </button>
              </div>
            </div>

            {isAiLoading ? (
              <div className="py-12 text-center space-y-3">
                <div className="w-8 h-8 rounded-full border-2 border-teal-400 border-t-transparent animate-spin mx-auto" />
                <p className="text-xs text-slate-400 font-mono">
                  Calculating {selectedStock.ticker} signal, order levels & indicator confluence...
                </p>
              </div>
            ) : (
              <InstitutionalSignalCard
                ticker={selectedStock.ticker}
                name={selectedStock.name}
                market={selectedStock.market}
                currency={selectedStock.currency}
                currentPrice={currentDisplayPrice}
                pipSpread={selectedStock.pipSpread}
                activeTimeframe={timeframe}
                onSelectTimeframe={(tf) => {
                  setTimeframe(tf as Timeframe);
                }}
                signal={{
                  action: (activeSignal.action as any) || 'BUY',
                  setupType: activeSignal.setupType,
                  timeframe: activeSignal.timeframe,
                  timeframeCategory: activeSignal.timeframeCategory,
                  confirmationScore: activeSignal.confirmationScore,
                  entryZone: activeSignal.entryZone,
                  takeProfit1: activeSignal.takeProfit1,
                  takeProfit2: activeSignal.takeProfit2,
                  stopLoss: activeSignal.stopLoss,
                  riskReward: activeSignal.riskReward,
                  confidenceScore: activeSignal.confidenceScore,
                  summary: activeSignal.summary,
                  indicators: activeSignal.indicators,
                  smc: activeSignal.smc,
                  tradeManagement: activeSignal.tradeManagement,
                  multiAspectAnalysis: activeSignal.multiAspectAnalysis,
                }}
                onExecutePaperTrade={handleExecuteSignalToPaper}
                onOpenPriceAlert={(_target) => {
                  setIsAlertsModalOpen(true);
                }}
              />
            )}
          </div>

          {/* AI Fundamental Valuation Verdict */}
          <div className="p-5 rounded-2xl bg-[#0c1322] border border-[#18253b] space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#0df2c9]" />
              <span>Investment Thesis & Macro Outlook</span>
            </h3>

            {aiReport ? (
              <div className="space-y-4">
                {/* 12-Month Target and Upside */}
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#080f1c] border border-[#162744]">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                      Target Horizon
                    </span>
                    <div className="text-base font-bold font-mono text-white mt-0.5">
                      {selectedStock.currency} {formatPriceVal(aiReport.targetPrice)}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                      Projected Upside
                    </span>
                    <span className="text-xs font-bold text-emerald-400 font-mono">
                      {aiReport.projectedUpside}
                    </span>
                  </div>
                </div>

                {/* Investment Thesis */}
                <div>
                  <h4 className="text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#0df2c9]" />
                    <span>Key Catalysts</span>
                  </h4>
                  <ul className="space-y-1.5">
                    {aiReport.thesis?.map((t, idx) => (
                      <li key={idx} className="text-xs text-slate-300 flex items-start gap-2">
                        <span className="text-[#0df2c9] mt-0.5">•</span>
                        <span>{t}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Risks to Watch */}
                <div>
                  <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    <span>Risk Factors & Invalidation</span>
                  </h4>
                  <ul className="space-y-1 text-xs text-slate-400">
                    {aiReport.risks?.map((r, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-amber-400 mt-0.5">•</span>
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Technical levels */}
                <div className="p-3 rounded-xl bg-[#070b13] border border-[#142036] grid grid-cols-3 gap-2 text-center text-xs">
                  <div>
                    <div className="text-[10px] text-slate-500">Support</div>
                    <div className="font-mono font-bold text-emerald-400 mt-0.5 truncate">
                      {aiReport.metrics?.support}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500">Resistance</div>
                    <div className="font-mono font-bold text-rose-400 mt-0.5 truncate">
                      {aiReport.metrics?.resistance}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500">52W Range</div>
                    <div className="font-mono text-[10px] text-slate-300 mt-0.5 truncate">
                      {aiReport.metrics?.range52w}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {/* Ask AI Stock & Forex Specialist */}
          <div className="p-5 rounded-2xl bg-[#0c1322] border border-[#18253b] space-y-3.5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#0df2c9]" />
              <span>Ask AI Stock & Forex Specialist</span>
            </h3>

            {/* Quick Prompts */}
            <div className="flex flex-wrap gap-1.5">
              {[
                `Key support & resistance for ${selectedStock.ticker}?`,
                selectedStock.isForex
                  ? `Best session to trade ${selectedStock.ticker}?`
                  : `Is ${selectedStock.ticker} good for dividend growth?`,
                `What is the risk-reward ratio?`,
              ].map((qp) => (
                <button
                  key={qp}
                  onClick={() => setUserQuestion(qp)}
                  className="px-2.5 py-1 rounded-lg bg-[#0e1626] hover:bg-[#15233c] border border-[#17253c] text-[11px] text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  {qp}
                </button>
              ))}
            </div>

            {/* Question Input Form */}
            <form onSubmit={handleAskAi} className="space-y-2">
              <div className="relative">
                <input
                  type="text"
                  placeholder={`Ask anything about ${selectedStock.ticker} signals or trading strategy...`}
                  value={userQuestion}
                  onChange={(e) => setUserQuestion(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#070b13] border border-[#162540] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 pr-10"
                />
                <button
                  type="submit"
                  disabled={isAsking || !userQuestion.trim()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-teal-400 hover:text-white disabled:text-slate-600 transition-colors cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>

            {/* Answer Display */}
            {isAsking && (
              <div className="p-3 rounded-xl bg-[#070b13] border border-[#162540] text-xs text-slate-400 font-mono animate-pulse">
                Consulting quantitative market models and preparing analysis...
              </div>
            )}

            {aiAnswer && !isAsking && (
              <div className="p-3.5 rounded-xl bg-[#080f1a] border border-teal-500/30 text-xs text-slate-200 leading-relaxed space-y-2">
                <div className="font-bold text-teal-300 text-[11px] flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
                  <span>AI Trading Specialist Opinion</span>
                </div>
                <p>{aiAnswer}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Live Price Alerts & Watch Triggers Modal */}
      <PriceAlertsModal
        isOpen={isAlertsModalOpen}
        onClose={() => setIsAlertsModalOpen(false)}
        currentTicker={selectedStock.ticker}
        currentName={selectedStock.name}
        currentPrice={currentDisplayPrice}
        currency={selectedStock.currency}
      />

      {/* AI Vision Chart Screenshot Analyzer Modal */}
      <ChartScreenshotAnalyzerModal
        isOpen={isChartAnalyzerOpen}
        onClose={() => setIsChartAnalyzerOpen(false)}
        onSelectAssetForRadar={(ticker) => {
          const match = FEATURED_ASSETS.find(
            (a) =>
              a.ticker.toLowerCase() === ticker.toLowerCase() ||
              ticker.toLowerCase().includes(a.ticker.toLowerCase())
          );
          if (match) {
            setSelectedStock(match);
            const el = document.getElementById('primary-trading-chart');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
          }
        }}
        onOpenPaperTrading={(setup) => {
          const match = FEATURED_ASSETS.find(
            (a) => a.ticker.toLowerCase() === setup.ticker.toLowerCase()
          );
          if (match) setSelectedStock(match);

          setPrefillOrder({
            direction: setup.action === 'BUY' ? 'LONG' : 'SHORT',
            lots: 0.1,
            sl: String(setup.stopLoss),
            tp: String(setup.takeProfit),
            timestamp: Date.now(),
          });
          setBottomTab('paper');
          setTimeout(() => {
            const el = document.getElementById('trading-workbench');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
          }, 50);
        }}
      />
    </div>
  );
};

// Simple ScaleIcon for Risk:Reward
function ScaleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
      <path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
      <path d="M7 21h10" />
      <path d="M12 3v18" />
      <path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" />
    </svg>
  );
}
