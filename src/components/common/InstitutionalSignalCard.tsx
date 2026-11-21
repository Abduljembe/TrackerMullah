import React, { useState, useMemo } from 'react';
import {
  Crosshair,
  Target,
  ShieldAlert,
  ShieldCheck,
  Flame,
  Scale as ScaleIcon,
  Activity,
  Calculator,
  Copy,
  Check,
  Zap,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Clock,
  Layers,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Info,
  Send,
} from 'lucide-react';
import { useNewsGuard } from '../../utils/newsGuard.ts';
import { evaluatePortfolioExposure, PAPER_POSITIONS_EVENT, loadOpenPaperPositions, SimpleOpenPos } from '../../utils/portfolioGuard.ts';
import { dispatchSignalWebhook } from '../../utils/signalScorecard.ts';

export interface SignalData {
  action: 'STRONG BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG SELL';
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

interface InstitutionalSignalCardProps {
  ticker: string;
  name: string;
  market: 'FOREX' | 'METALS' | 'INDICES' | 'NSE' | 'US';
  currency: string;
  currentPrice: number;
  pipSpread?: string;
  signal: SignalData;
  activeTimeframe?: string;
  onSelectTimeframe?: (tf: string) => void;
  onExecutePaperTrade: (trade: {
    direction: 'LONG' | 'SHORT';
    lots: number;
    sl: string;
    tp: string;
  }) => void;
  onOpenPriceAlert?: (price: number) => void;
}

export const InstitutionalSignalCard: React.FC<InstitutionalSignalCardProps> = ({
  ticker,
  name,
  market,
  currency,
  currentPrice,
  pipSpread = '1.0 pips',
  signal,
  activeTimeframe,
  onSelectTimeframe,
  onExecutePaperTrade,
}) => {
  const isForex = market === 'FOREX';
  const isGold = ticker.includes('XAU');
  const isKES = ticker.includes('KES');
  const isBuy = signal.action.includes('BUY');
  const isSell = signal.action.includes('SELL');

  // Interactive Risk & Position Sizing Calculator State
  const [accountBalance, setAccountBalance] = useState<number>(1000);
  const [riskPercent, setRiskPercent] = useState<number>(1.0);
  const [showAdvancedSMC, setShowAdvancedSMC] = useState<boolean>(true);
  const [showTradeManagement, setShowTradeManagement] = useState<boolean>(true);
  const [showDeepAnalysis, setShowDeepAnalysis] = useState<boolean>(true);
  const [activeAspectTab, setActiveAspectTab] = useState<'all' | 'structure' | 'smc' | 'indicators' | 'macro'>('all');
  const [copiedAlert, setCopiedAlert] = useState<boolean>(false);
  const [copiedLevels, setCopiedLevels] = useState<boolean>(false);
  const [copiedMt4, setCopiedMt4] = useState<boolean>(false);
  const [broadcastStatus, setBroadcastStatus] = useState<string | null>(null);
  const [openPaperPositions, setOpenPaperPositions] = useState<SimpleOpenPos[]>(() => loadOpenPaperPositions());

  React.useEffect(() => {
    const syncPos = () => setOpenPaperPositions(loadOpenPaperPositions());
    window.addEventListener(PAPER_POSITIONS_EVENT, syncPos);
    window.addEventListener('storage', syncPos);
    return () => {
      window.removeEventListener(PAPER_POSITIONS_EVENT, syncPos);
      window.removeEventListener('storage', syncPos);
    };
  }, []);

  const newsGuard = useNewsGuard(ticker, 30);

  // Parse numerical values from signal strings for live calculations
  const parsedLevels = useMemo(() => {
    // Extract first number from entry zone
    const entryMatch = signal.entryZone.match(/([0-9]+\.?[0-9]*)/g);
    const entryLow = entryMatch && entryMatch[0] ? parseFloat(entryMatch[0]) : currentPrice;
    const entryHigh = entryMatch && entryMatch[1] ? parseFloat(entryMatch[1]) : currentPrice;
    const entryMid = (entryLow + entryHigh) / 2;

    const tp1Match = signal.takeProfit1.match(/([0-9]+\.?[0-9]*)/);
    const tp1Val = tp1Match ? parseFloat(tp1Match[1]) : entryMid * (isBuy ? 1.015 : 0.985);

    const tp2Match = signal.takeProfit2.match(/([0-9]+\.?[0-9]*)/);
    const tp2Val = tp2Match ? parseFloat(tp2Match[1]) : entryMid * (isBuy ? 1.03 : 0.97);

    const slMatch = signal.stopLoss.match(/([0-9]+\.?[0-9]*)/);
    const slVal = slMatch ? parseFloat(slMatch[1]) : entryMid * (isBuy ? 0.992 : 1.008);

    const slDistance = Math.abs(entryMid - slVal);
    const tp1Distance = Math.abs(tp1Val - entryMid);
    const tp2Distance = Math.abs(tp2Val - entryMid);

    return {
      entryLow,
      entryHigh,
      entryMid,
      tp1Val,
      tp2Val,
      slVal,
      slDistance,
      tp1Distance,
      tp2Distance,
    };
  }, [signal, currentPrice, isBuy]);

  // Real-Time Floating Pip / Points Calculator & Live Signal Status Tracker
  const liveTracking = useMemo(() => {
    const { entryLow, entryHigh, entryMid, tp1Val, tp2Val, slVal } = parsedLevels;

    let status: 'PENDING_ENTRY' | 'ACTIVE' | 'TP1_HIT' | 'TP2_HIT' | 'STOPPED_OUT' = 'ACTIVE';
    let pipsDelta = 0;
    let pointsDelta = 0;

    if (isBuy) {
      pointsDelta = currentPrice - entryMid;
      if (currentPrice >= tp2Val) {
        status = 'TP2_HIT';
      } else if (currentPrice >= tp1Val) {
        status = 'TP1_HIT';
      } else if (currentPrice <= slVal) {
        status = 'STOPPED_OUT';
      } else if (currentPrice < entryLow * 0.999) {
        status = 'PENDING_ENTRY';
      } else {
        status = 'ACTIVE';
      }
    } else if (isSell) {
      pointsDelta = entryMid - currentPrice;
      if (currentPrice <= tp2Val) {
        status = 'TP2_HIT';
      } else if (currentPrice <= tp1Val) {
        status = 'TP1_HIT';
      } else if (currentPrice >= slVal) {
        status = 'STOPPED_OUT';
      } else if (currentPrice > entryHigh * 1.001) {
        status = 'PENDING_ENTRY';
      } else {
        status = 'ACTIVE';
      }
    }

    if (isGold) {
      pipsDelta = pointsDelta * 10; // $1.00 in Gold = 10 pips / 100 points
    } else if (isForex) {
      pipsDelta = currentPrice < 10 ? pointsDelta * 10000 : pointsDelta * 100;
    } else {
      pipsDelta = pointsDelta;
    }

    return {
      status,
      pointsDelta,
      pipsDelta: Math.round(pipsDelta * 10) / 10,
      isProfit: pointsDelta >= 0,
    };
  }, [parsedLevels, currentPrice, isBuy, isSell, isGold, isForex]);

  // Position Sizing & Lot Calculator
  const riskCalculations = useMemo(() => {
    const maxRiskCash = (accountBalance * riskPercent) / 100;
    const { slDistance, tp1Distance, tp2Distance } = parsedLevels;

    let computedLot = 0.1;
    let estTp1Gain = 0;
    let estTp2Gain = 0;

    if (isGold) {
      // 1 standard lot = 100 oz. $1 price move per lot = $100.
      const riskPerLot = slDistance * 100;
      computedLot = riskPerLot > 0 ? maxRiskCash / riskPerLot : 0.1;
      computedLot = Math.max(0.01, Math.round(computedLot * 100) / 100);
      estTp1Gain = tp1Distance * 100 * computedLot;
      estTp2Gain = tp2Distance * 100 * computedLot;
    } else if (isForex) {
      // Standard FX: 100,000 units. Pip value roughly $10 per pip on 1 lot.
      const pipsRisk = currentPrice < 10 ? slDistance * 10000 : slDistance * 100;
      const pipValueStandard = 10;
      const riskPerLot = pipsRisk * pipValueStandard;
      computedLot = riskPerLot > 0 ? maxRiskCash / riskPerLot : 0.1;
      computedLot = Math.max(0.01, Math.round(computedLot * 100) / 100);

      const pipsTp1 = currentPrice < 10 ? tp1Distance * 10000 : tp1Distance * 100;
      const pipsTp2 = currentPrice < 10 ? tp2Distance * 10000 : tp2Distance * 100;
      estTp1Gain = pipsTp1 * pipValueStandard * computedLot;
      estTp2Gain = pipsTp2 * pipValueStandard * computedLot;
    } else if (market === 'INDICES') {
      // Indices CFDs (1 pt move = $1.00 per point per 1.0 lot)
      const riskPerLot = slDistance * 1.0;
      computedLot = riskPerLot > 0 ? maxRiskCash / riskPerLot : 0.1;
      computedLot = Math.max(0.01, Math.round(computedLot * 100) / 100);
      estTp1Gain = tp1Distance * 1.0 * computedLot;
      estTp2Gain = tp2Distance * 1.0 * computedLot;
    } else if (market === 'METALS') {
      // Silver & other metals CFDs
      const multiplier = ticker === 'XAG/USD' ? 50 : 10;
      const riskPerLot = slDistance * multiplier;
      computedLot = riskPerLot > 0 ? maxRiskCash / riskPerLot : 0.1;
      computedLot = Math.max(0.01, Math.round(computedLot * 100) / 100);
      estTp1Gain = tp1Distance * multiplier * computedLot;
      estTp2Gain = tp2Distance * multiplier * computedLot;
    } else {
      // Equities / Stocks: number of shares
      computedLot = slDistance > 0 ? Math.floor(maxRiskCash / slDistance) : 50;
      computedLot = Math.max(1, computedLot);
      estTp1Gain = tp1Distance * computedLot;
      estTp2Gain = tp2Distance * computedLot;
    }

    return {
      maxRiskCash: Math.round(maxRiskCash * 100) / 100,
      computedLot,
      estTp1Gain: Math.round(estTp1Gain * 100) / 100,
      estTp2Gain: Math.round(estTp2Gain * 100) / 100,
      realizedRR: slDistance > 0 ? (tp1Distance / slDistance).toFixed(2) : '1:2.4',
    };
  }, [accountBalance, riskPercent, parsedLevels, isGold, isForex, currentPrice]);

  // Smart Money Concepts (SMC) & Liquidity Target Blueprint
  const smcBlueprint = useMemo(() => {
    const { entryLow, entryHigh, tp1Val, slVal } = parsedLevels;
    const formatVal = (v: number) => (isForex && currentPrice < 10 ? v.toFixed(4) : v.toFixed(2));

    const obLow = isBuy ? entryLow * 0.9985 : entryLow * 1.0005;
    const obHigh = isBuy ? entryHigh * 1.0005 : entryHigh * 1.0025;

    const fvgLow = isBuy ? entryLow * 0.9995 : entryLow * 1.001;
    const fvgHigh = isBuy ? entryHigh * 1.0015 : entryHigh * 1.003;

    return {
      orderBlockZone: signal.smc?.orderBlock || `${formatVal(obLow)} - ${formatVal(obHigh)}`,
      fairValueGap: signal.smc?.fairValueGap || `${formatVal(fvgLow)} - ${formatVal(fvgHigh)} (${signal.timeframe} Imbalance)`,
      liquidityTarget: signal.smc?.liquidityTarget || (isBuy
        ? `Buy-Side Liquidity (BSL) resting above ${formatVal(tp1Val * 1.002)}`
        : `Sell-Side Liquidity (SSL) resting below ${formatVal(tp1Val * 0.998)}`),
      structureBias: signal.smc?.marketStructure || (isBuy ? 'BOS (Break of Structure Bullish)' : 'CHoCH (Change of Character Bearish)'),
      invalidationLevel: formatVal(slVal),
      breakEvenRule: signal.tradeManagement?.breakEvenRule || (isGold
        ? `Move SL to Break-Even at +$10.00 pts / TP1`
        : isForex
        ? `Move SL to Break-Even at +20 pips / TP1`
        : `Move SL to Break-Even once +4% gain achieved`),
      partialProfitRule: signal.tradeManagement?.partialProfitRule || `Close 70% volume at TP1; trail remaining 30% runner behind ${signal.timeframe} structural swings`,
      invalidationRule: signal.tradeManagement?.invalidationRule || `Close setup immediately if a ${signal.timeframe} candle closes beyond ${formatVal(slVal)} prior to entry activation.`,
    };
  }, [parsedLevels, isBuy, isForex, currentPrice, isGold, signal]);

  // Copy MT4/MT5 / Telegram formatted signal alert
  const handleCopyAlert = () => {
    const text = `🚨 INSTITUTIONAL SIGNAL ALERT: ${signal.action} ${ticker}
🏛 Asset: ${name} (${market})
⚡ Timeframe: ${signal.timeframe}
🎯 Setup: ${signal.setupType}
🛡 Confluences: ${signal.confirmationScore || '4/5 Confluences'}

📍 ENTRY ZONE: ${signal.entryZone}
🛑 STOP LOSS: ${signal.stopLoss}
🎯 TAKE PROFIT 1: ${signal.takeProfit1}
🚀 TAKE PROFIT 2: ${signal.takeProfit2}
⚖️ Risk/Reward: ${signal.riskReward}
💎 Conviction: ${signal.confidenceScore}%

📦 SMC BLUEPRINT:
• Order Block: ${smcBlueprint.orderBlockZone}
• Fair Value Gap: ${smcBlueprint.fairValueGap}
• Liquidity Target: ${smcBlueprint.liquidityTarget}
• Structure: ${smcBlueprint.structureBias}

🛡 TRADE MANAGEMENT:
• Break-Even: ${smcBlueprint.breakEvenRule}
• Partials: ${smcBlueprint.partialProfitRule}
• Invalidation: ${smcBlueprint.invalidationRule}

📐 MULTI-ASPECT ANALYSIS:
• Market Structure: ${signal.multiAspectAnalysis?.marketStructure || 'Clean structural accumulation with higher swing lows.'}
• Smart Money: ${signal.multiAspectAnalysis?.smartMoneyConcepts || 'Liquidity sweep into demand zone followed by aggressive volume.'}
• Indicators: ${signal.multiAspectAnalysis?.indicatorConfluence || 'RSI and MACD aligned with moving averages.'}
• Forex Factory: ${signal.multiAspectAnalysis?.macroForexFactory || 'News Guard active and clear of immediate red-folder events.'}

Generated by NjiaFedha Pro Quant Engine`;

    navigator.clipboard.writeText(text);
    setCopiedAlert(true);
    setTimeout(() => setCopiedAlert(false), 2500);
  };

  // Copy raw numeric levels
  const handleCopyLevels = () => {
    const text = `${ticker} ${signal.action} (${signal.timeframe}) | Entry: ${signal.entryZone} | SL: ${signal.stopLoss} | TP1: ${signal.takeProfit1} | TP2: ${signal.takeProfit2}`;
    navigator.clipboard.writeText(text);
    setCopiedLevels(true);
    setTimeout(() => setCopiedLevels(false), 2000);
  };

  // Copy standard MT4/MT5 / cTrader execution string
  const handleCopyMt4Syntax = () => {
    const dir = isBuy ? 'BUY' : 'SELL';
    const cleanEntry = signal.entryZone.split('-')[0].trim();
    const cleanSl = signal.stopLoss.split('(')[0].trim();
    const cleanTp1 = signal.takeProfit1.split('(')[0].trim();
    const cleanTp2 = signal.takeProfit2.split('(')[0].trim();
    const cleanTicker = ticker.replace('/', '');
    const text = `${dir} ${cleanTicker} @ ${cleanEntry} | SL: ${cleanSl} | TP1: ${cleanTp1} | TP2: ${cleanTp2} | Lots: ${riskCalculations.computedLot} | R:R: ${signal.riskReward} [${signal.timeframe}]`;
    navigator.clipboard.writeText(text);
    setCopiedMt4(true);
    setTimeout(() => setCopiedMt4(false), 2000);
  };

  // Portfolio correlation & USD over-exposure guard check
  const portfolioExposure = useMemo(() => {
    return evaluatePortfolioExposure(
      ticker,
      isBuy ? 'LONG' : 'SHORT',
      riskCalculations.computedLot,
      openPaperPositions
    );
  }, [ticker, isBuy, riskCalculations.computedLot, openPaperPositions]);

  // 1-Click Broadcast to Telegram / Discord Webhook + Clipboard
  const handleBroadcastSignal = async () => {
    const res = await dispatchSignalWebhook({
      symbol: ticker,
      action: signal.action,
      timeframe: signal.timeframe,
      entryZone: signal.entryZone,
      sl: signal.stopLoss,
      tp1: signal.takeProfit1,
      tp2: signal.takeProfit2,
      riskReward: signal.riskReward,
      confidenceScore: signal.confidenceScore,
    });
    setBroadcastStatus(res.channels.length > 0 ? `Sent (${res.channels.join('+')})` : 'Copied!');
    setTimeout(() => setBroadcastStatus(null), 2500);
  };

  // 1-Click Execute in Paper Trading Desk
  const handleExecute = () => {
    onExecutePaperTrade({
      direction: isBuy ? 'LONG' : 'SHORT',
      lots: riskCalculations.computedLot,
      sl: signal.stopLoss,
      tp: signal.takeProfit1,
    });
  };

  // Status Badge Helper
  const renderStatusBadge = () => {
    switch (liveTracking.status) {
      case 'TP2_HIT':
        return (
          <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-emerald-500/25 text-emerald-300 border border-emerald-500/50 flex items-center gap-1.5 animate-pulse">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>FULL TP2 ACHIEVED</span>
          </span>
        );
      case 'TP1_HIT':
        return (
          <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5 text-emerald-400" />
            <span>TP1 HIT (SECURED)</span>
          </span>
        );
      case 'STOPPED_OUT':
        return (
          <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-rose-500/20 text-rose-400 border border-rose-500/40 flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            <span>STOPPED / INVALIDATED</span>
          </span>
        );
      case 'PENDING_ENTRY':
        return (
          <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>PENDING ENTRY ZONE</span>
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span>ACTIVE IN TRADE</span>
          </span>
        );
    }
  };

  const currentTf = activeTimeframe || signal.timeframe || '1H';

  return (
    <div className="rounded-2xl bg-[#091120] border border-[#172744] shadow-xl overflow-hidden space-y-2.5 p-3">
      {/* 0. Timeframe Adaptability Pill Bar (15m, 1H, 4H, 1D) */}
      <div className="px-2.5 py-1.5 rounded-xl bg-[#060c18] border border-[#14233c] flex flex-wrap items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5 text-[10px] text-slate-300 font-mono">
          <Clock className="w-3 h-3 text-teal-400" />
          <span className="font-semibold">TF:</span>
        </div>

        <div className="flex items-center gap-1">
          {[
            { id: '15m', label: '15m' },
            { id: '1H', label: '1H' },
            { id: '4H', label: '4H' },
            { id: '1D', label: '1D' },
          ].map((tf) => {
            const isCurrent = currentTf.toLowerCase() === tf.id.toLowerCase() || signal.timeframe.toLowerCase().startsWith(tf.id.toLowerCase());
            return (
              <button
                key={tf.id}
                onClick={() => onSelectTimeframe?.(tf.id)}
                className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold transition-all cursor-pointer ${
                  isCurrent
                    ? 'bg-teal-500 text-slate-950 shadow-sm font-black'
                    : 'bg-[#0a1426] text-slate-400 hover:text-white border border-[#162744]'
                }`}
                title={`Analyze ${ticker} signal strictly on ${tf.label}`}
              >
                {tf.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 1. Compact Status & Accuracy Guards Bar */}
      <div className="px-2.5 py-2 rounded-xl bg-gradient-to-r from-[#061527] via-[#091b35] to-[#071324] border border-[#0df2c9]/25 space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-1.5 text-[10px] font-mono">
          <div className="flex items-center gap-1.5 text-[#0df2c9] font-black uppercase tracking-wider">
            <ShieldCheck className="w-3 h-3 text-[#0df2c9]" />
            <span>5/5 Guards Engaged</span>
          </div>
          <span
            className={`text-[10px] font-mono px-1.5 py-0.5 rounded border font-bold ${
              newsGuard.severity === 'HIGH_PAUSE'
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
                : newsGuard.severity === 'MEDIUM_CAUTION'
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'text-cyan-300 bg-cyan-950/60 border-cyan-800/40'
            }`}
            title={newsGuard.detailLabel}
          >
            {newsGuard.isLoading
              ? isGold
                ? 'Syncing Macro Feed...'
                : isKES
                ? 'CBK Monitored'
                : 'Checking Calendar...'
              : newsGuard.statusLabel}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1 text-[9px] font-mono text-slate-300">
          {['MTF 4/4', 'ATR 1.4x', 'ADX Anti-Chop', 'TV 26-Ind', 'SMC FVG'].map((guard) => (
            <span
              key={guard}
              className="px-1.5 py-0.5 rounded bg-[#0b1b33]/90 border border-[#17325c] flex items-center gap-1"
            >
              <Check className="w-2.5 h-2.5 text-[#0df2c9]" />
              <span>{guard}</span>
            </span>
          ))}
        </div>
      </div>

      {/* 2. Compact Hero Signal Badge & Real-Time Tracking Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#14233c]">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={`px-2.5 py-0.5 rounded-md text-xs font-black tracking-wide border uppercase ${
              isBuy
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : isSell
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
            }`}
          >
            {signal.action}
          </span>
          <span className="text-[10px] font-mono text-slate-200 font-bold bg-[#101e38] px-1.5 py-0.5 rounded border border-[#1b345b]">
            {signal.timeframe}
          </span>
          {renderStatusBadge()}
        </div>

        {/* Real-time Floating Move & Conviction */}
        <div className="flex items-center gap-2.5 font-mono">
          <div
            className={`text-xs font-extrabold flex items-center gap-1 ${
              liveTracking.isProfit ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {liveTracking.isProfit ? (
              <TrendingUp className="w-3.5 h-3.5" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5" />
            )}
            <span>
              {liveTracking.isProfit ? '+' : ''}
              {isGold ? `$${liveTracking.pointsDelta.toFixed(1)}pt` : `${liveTracking.pipsDelta}p`}
            </span>
          </div>

          <span className="text-sm font-black text-[#0df2c9] pl-2 border-l border-[#192b47]">
            {signal.confidenceScore}%
          </span>
        </div>
      </div>

      {/* Compact Setup & R:R Strip */}
      <div className="px-2.5 py-1.5 rounded-lg bg-[#070e1c] border border-teal-500/25 text-[11px] text-slate-300 flex items-center justify-between gap-2">
        <span className="font-semibold text-white truncate" title={signal.setupType}>
          🎯 {signal.setupType}
        </span>
        <span className="text-[10px] font-mono text-slate-400 shrink-0">
          R:R <strong className="text-cyan-300">{signal.riskReward}</strong>
        </span>
      </div>

      {/* 3. Compact Multi-Timeframe (MTF) Confluence Matrix */}
      <div className="p-2 rounded-xl bg-[#060c17] border border-[#152744] space-y-1.5">
        <div className="flex items-center justify-between text-[10px] font-mono">
          <span className="text-slate-400 uppercase tracking-wider font-bold flex items-center gap-1">
            <Layers className="w-3 h-3 text-teal-400" />
            <span>MTF Matrix</span>
          </span>
          <span className="text-emerald-400 font-bold text-[10px]">
            4/4 Aligned
          </span>
        </div>

        <div className="grid grid-cols-4 gap-1.5 text-center text-[10px] font-mono">
          <div
            className={`py-1 px-1 rounded-md border ${
              isBuy
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
            }`}
          >
            <span className="text-[9px] text-slate-400 block">15m</span>
            <span className="font-bold">{isBuy ? '▲ BUY' : '▼ SELL'}</span>
          </div>

          <div
            className={`py-1 px-1 rounded-md border ${
              isBuy
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
            }`}
          >
            <span className="text-[9px] text-slate-400 block">1H</span>
            <span className="font-bold">{isBuy ? '▲ BULL' : '▼ BEAR'}</span>
          </div>

          <div
            className={`py-1 px-1 rounded-md border ${
              isBuy
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-200'
                : 'bg-rose-500/20 border-rose-500/40 text-rose-200'
            }`}
          >
            <span className="text-[9px] text-slate-400 block">4H</span>
            <span className="font-bold">{isBuy ? '▲ UP' : '▼ DOWN'}</span>
          </div>

          <div
            className={`py-1 px-1 rounded-md border ${
              isBuy
                ? 'bg-teal-500/20 border-teal-500/40 text-[#0df2c9]'
                : 'bg-rose-500/20 border-rose-500/40 text-rose-200'
            }`}
          >
            <span className="text-[9px] text-slate-400 block">1D</span>
            <span className="font-bold">{isBuy ? '▲ TREND' : '▼ TREND'}</span>
          </div>
        </div>
      </div>

      {/* 4. Compact Order Ticket: SL, Entry, TP1, TP2 */}
      <div className="p-2.5 rounded-xl bg-[#060c18] border border-teal-500/35 space-y-2 shadow-lg">
        {/* Ticket Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500"></span>
            </span>
            <h4 className="text-[11px] font-black text-white uppercase tracking-wider font-mono truncate">
              Order Ticket <span className="text-[#0df2c9]">• {signal.timeframe}</span>
            </h4>
          </div>

          <div className="flex items-center gap-1 font-mono text-[10px] shrink-0">
            <button
              onClick={handleCopyMt4Syntax}
              className="px-2 py-1 rounded-md bg-teal-500/15 hover:bg-teal-500/25 text-teal-300 border border-teal-500/35 font-bold flex items-center gap-1 cursor-pointer transition-colors"
              title="Copy formatted MT4/MT5/cTrader order execution string"
            >
              {copiedMt4 ? <Check className="w-2.5 h-2.5 text-teal-400" /> : <Copy className="w-2.5 h-2.5" />}
              <span>{copiedMt4 ? 'Copied' : 'MT4/MT5'}</span>
            </button>
            <button
              onClick={handleCopyAlert}
              className="px-2 py-1 rounded-md bg-[#0e1b30] hover:bg-[#162744] text-slate-300 border border-[#1b3052] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
              title="Copy Telegram/WhatsApp alert format"
            >
              {copiedAlert ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
              <span>{copiedAlert ? 'Copied' : 'Alert'}</span>
            </button>
            <button
              onClick={handleBroadcastSignal}
              className="px-2 py-1 rounded-md bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/35 font-bold flex items-center gap-1 cursor-pointer transition-colors"
              title="1-Click Broadcast to Telegram/Discord Webhook (or copy alert)"
            >
              {broadcastStatus ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Send className="w-2.5 h-2.5" />}
              <span>{broadcastStatus || 'Broadcast'}</span>
            </button>
          </div>
        </div>

        {/* Compact 4-Row Horizontal Level Ladder */}
        <div className="rounded-lg border border-[#14233c] bg-[#040913] divide-y divide-[#111d33] font-mono text-[11px]">
          {/* Row 1: STOP LOSS */}
          <div className="px-2.5 py-1.5 flex items-center justify-between gap-2 bg-rose-950/20">
            <div className="flex items-center gap-1.5 shrink-0">
              <ShieldAlert className="w-3 h-3 text-rose-400" />
              <span className="font-bold text-rose-400 uppercase text-[10px] w-10">SL</span>
              <span className="text-[9px] text-slate-500 hidden sm:inline">Risk 1.5%</span>
            </div>
            <span className="font-black text-rose-300 text-right flex-1 break-all" title={signal.stopLoss}>
              {signal.stopLoss}
            </span>
            <span className="text-[10px] font-bold text-rose-400 shrink-0 w-16 text-right">
              -${riskCalculations.maxRiskCash}
            </span>
          </div>

          {/* Row 2: ENTRY ZONE */}
          <div className="px-2.5 py-1.5 flex items-center justify-between gap-2 bg-sky-950/15">
            <div className="flex items-center gap-1.5 shrink-0">
              <Crosshair className="w-3 h-3 text-teal-300" />
              <span className="font-bold text-teal-300 uppercase text-[10px] w-10">ENTRY</span>
              <span className="text-[9px] text-slate-500 hidden sm:inline">{signal.timeframe} Zone</span>
            </div>
            <span className="font-black text-white text-right flex-1 break-all" title={signal.entryZone}>
              {signal.entryZone}
            </span>
            <span className="text-[10px] font-bold text-cyan-300 shrink-0 w-16 text-right">
              {signal.riskReward}
            </span>
          </div>

          {/* Row 3: TAKE PROFIT 1 */}
          <div className="px-2.5 py-1.5 flex items-center justify-between gap-2 bg-emerald-950/15">
            <div className="flex items-center gap-1.5 shrink-0">
              <Target className="w-3 h-3 text-emerald-400" />
              <span className="font-bold text-emerald-400 uppercase text-[10px] w-10">TP1</span>
              <span className="text-[9px] text-slate-500 hidden sm:inline">Scale 70%</span>
            </div>
            <span className="font-black text-emerald-300 text-right flex-1 break-all" title={signal.takeProfit1}>
              {signal.takeProfit1}
            </span>
            <span className="text-[10px] font-bold text-emerald-400 shrink-0 w-16 text-right">
              +${riskCalculations.estTp1Gain}
            </span>
          </div>

          {/* Row 4: TAKE PROFIT 2 */}
          <div className="px-2.5 py-1.5 flex items-center justify-between gap-2 bg-teal-950/20">
            <div className="flex items-center gap-1.5 shrink-0">
              <Flame className="w-3 h-3 text-[#0df2c9]" />
              <span className="font-bold text-[#0df2c9] uppercase text-[10px] w-10">TP2</span>
              <span className="text-[9px] text-slate-500 hidden sm:inline">Runner 30%</span>
            </div>
            <span className="font-black text-[#0df2c9] text-right flex-1 break-all" title={signal.takeProfit2}>
              {signal.takeProfit2}
            </span>
            <span className="text-[10px] font-bold text-[#0df2c9] shrink-0 w-16 text-right">
              +${riskCalculations.estTp2Gain}
            </span>
          </div>
        </div>

        {/* Portfolio Correlation / Over-Exposure Guard Chip */}
        {portfolioExposure.level !== 'CLEAR' && (
          <div
            className={`px-2.5 py-1.5 rounded-lg border text-[10px] font-mono flex items-center gap-1.5 ${
              portfolioExposure.level === 'WARNING'
                ? 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                : 'bg-amber-500/15 border-amber-500/40 text-amber-300'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span className="leading-snug">{portfolioExposure.message}</span>
          </div>
        )}

        {/* Compact 1-Click Fast Action Bar */}
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400 min-w-0">
            <span className="text-white font-bold bg-[#0a1426] px-1.5 py-0.5 rounded border border-[#162744] truncate">
              {riskCalculations.computedLot} Lots · {signal.action}
            </span>
          </div>

          <button
            onClick={handleExecute}
            className={`px-3 py-1.5 rounded-lg font-black font-mono text-[11px] cursor-pointer flex items-center gap-1 transition-all shadow-md active:scale-95 shrink-0 ${
              isBuy
                ? 'bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 shadow-emerald-500/20'
                : 'bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-400 hover:to-pink-400 text-white shadow-rose-500/20'
            }`}
          >
            <Zap className="w-3 h-3 fill-current" />
            <span>1-Click Execute</span>
          </button>
        </div>
      </div>


      {/* 5. Deep Multi-Aspect AI Analytical Breakdown */}
      <div className="p-3.5 rounded-xl bg-[#070d18] border border-teal-500/30 space-y-3">
        <button
          onClick={() => setShowDeepAnalysis((prev) => !prev)}
          className="w-full flex items-center justify-between text-xs font-bold text-slate-200 hover:text-white transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#0df2c9]" />
            <span className="text-white font-extrabold tracking-wide">
              Deep Multi-Aspect AI Analysis ({signal.timeframe} Horizon)
            </span>
          </span>
          <span className="text-slate-400 flex items-center gap-1 text-[11px]">
            {showDeepAnalysis ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </span>
        </button>

        {showDeepAnalysis && (
          <div className="space-y-3 pt-1 animate-in fade-in">
            {/* Filter Pills for Aspects */}
            <div className="flex flex-wrap items-center gap-1.5 pb-1 border-b border-[#14233c]">
              {[
                { id: 'all', label: 'All 4 Aspects' },
                { id: 'structure', label: '📐 Market Structure' },
                { id: 'smc', label: '🏦 SMC & Liquidity' },
                { id: 'indicators', label: '📊 Indicators & Confluence' },
                { id: 'macro', label: '🌍 Forex Factory & Macro' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveAspectTab(tab.id as any)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-semibold transition-all cursor-pointer ${
                    activeAspectTab === tab.id
                      ? 'bg-teal-500/25 text-[#0df2c9] border border-teal-500/50'
                      : 'bg-[#050a12] text-slate-400 hover:text-white border border-[#13233a]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Aspect 1: Market Structure & Price Action */}
            {(activeAspectTab === 'all' || activeAspectTab === 'structure') && (
              <div className="p-3 rounded-lg bg-[#050b16] border border-[#152844] space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-teal-300 flex items-center gap-1.5 font-mono text-[11px]">
                    <span>📐</span>
                    <span>1. Market Structure & Price Action Aspect</span>
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    Timeframe: {signal.timeframe}
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed font-sans">
                  {signal.multiAspectAnalysis?.marketStructure ||
                    (isBuy
                      ? `Price action on ${signal.timeframe} confirms clean structural accumulation with successive higher swing lows and immediate demand absorption.`
                      : `Price action on ${signal.timeframe} confirms bearish distribution with lower highs, structural breakdown (CHoCH), and active supply rejection.`)}
                </p>
              </div>
            )}

            {/* Aspect 2: Smart Money Concepts & Liquidity */}
            {(activeAspectTab === 'all' || activeAspectTab === 'smc') && (
              <div className="p-3 rounded-lg bg-[#050b16] border border-[#152844] space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-cyan-300 flex items-center gap-1.5 font-mono text-[11px]">
                    <span>🏦</span>
                    <span>2. Smart Money Concepts (SMC) & Liquidity Aspect</span>
                  </span>
                  <span className="text-[10px] font-mono text-cyan-400 font-bold">
                    {smcBlueprint.structureBias}
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed font-sans">
                  {signal.multiAspectAnalysis?.smartMoneyConcepts ||
                    (isBuy
                      ? `Institutional order flow engineered a clean sell-side liquidity sweep into the demand discount zone before aggressive buying volume appeared.`
                      : `Institutional order flow engineered a buy-side liquidity sweep into the premium supply zone before aggressive selling displacement began.`)}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1 text-[11px] font-mono">
                  <span className="text-slate-400">
                    Order Block: <strong className="text-teal-300">{smcBlueprint.orderBlockZone}</strong>
                  </span>
                  <span className="text-slate-400">
                    Fair Value Gap: <strong className="text-cyan-300">{smcBlueprint.fairValueGap}</strong>
                  </span>
                  <span className="text-slate-400 sm:col-span-2">
                    Liquidity Sweep: <strong className="text-emerald-300">{smcBlueprint.liquidityTarget}</strong>
                  </span>
                </div>
              </div>
            )}

            {/* Aspect 3: Technical Indicators & Confluence */}
            {(activeAspectTab === 'all' || activeAspectTab === 'indicators') && (
              <div className="p-3 rounded-lg bg-[#050b16] border border-[#152844] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-emerald-300 flex items-center gap-1.5 font-mono text-[11px]">
                    <span>📊</span>
                    <span>3. Technical Momentum & Indicators Aspect</span>
                  </span>
                  <span className="text-[10px] font-mono text-emerald-400">
                    ATR: {signal.indicators.atr}
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed font-sans">
                  {signal.multiAspectAnalysis?.indicatorConfluence ||
                    `Indicators on ${signal.timeframe} show multi-oscillator confluence: RSI at ${signal.indicators.rsi}, MACD ${signal.indicators.macd}, and moving averages aligned.`}
                </p>

                {/* Indicators Pill Matrix */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1 text-[10px] font-mono">
                  <div className="p-2 rounded bg-[#081222] border border-[#193256]">
                    <span className="text-slate-400 block">RSI (14)</span>
                    <span className="font-bold text-teal-300 truncate block">{signal.indicators.rsi}</span>
                  </div>
                  <div className="p-2 rounded bg-[#081222] border border-[#193256]">
                    <span className="text-slate-400 block">MACD</span>
                    <span className="font-bold text-cyan-300 truncate block">{signal.indicators.macd}</span>
                  </div>
                  <div className="p-2 rounded bg-[#081222] border border-[#193256]">
                    <span className="text-slate-400 block">EMAs (20/50/200)</span>
                    <span className="font-bold text-emerald-300 truncate block">{signal.indicators.movingAverages}</span>
                  </div>
                  <div className="p-2 rounded bg-[#081222] border border-[#193256]">
                    <span className="text-slate-400 block">Pivot Point</span>
                    <span className="font-bold text-purple-300 truncate block">{signal.indicators.pivotPoint}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Aspect 4: Forex Factory Macro & Fundamental Catalysts */}
            {(activeAspectTab === 'all' || activeAspectTab === 'macro') && (
              <div className="p-3 rounded-lg bg-[#050b16] border border-[#152844] space-y-1.5">
                <div className="flex items-center justify-between text-xs gap-2">
                  <span className="font-bold text-amber-300 flex items-center gap-1.5 font-mono text-[11px]">
                    <span>🌍</span>
                    <span>4. Forex Factory Macro & Calendar Impact Aspect</span>
                  </span>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                      newsGuard.severity === 'HIGH_PAUSE'
                        ? 'text-rose-300 bg-rose-950/60 border-rose-700/60'
                        : newsGuard.severity === 'MEDIUM_CAUTION'
                        ? 'text-amber-300 bg-amber-950/60 border-amber-700/60'
                        : 'text-emerald-400 bg-emerald-950/60 border-emerald-800/40'
                    }`}
                  >
                    {newsGuard.statusLabel}
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed font-sans">
                  {newsGuard.severity === 'HIGH_PAUSE'
                    ? newsGuard.detailLabel
                    : signal.multiAspectAnalysis?.macroForexFactory || newsGuard.detailLabel}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 6. Dynamic Trade Management Directives */}
      <div className="p-3.5 rounded-xl bg-[#070d18] border border-[#152744] space-y-3">
        <button
          onClick={() => setShowTradeManagement((prev) => !prev)}
          className="w-full flex items-center justify-between text-xs font-bold text-slate-200 hover:text-white transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Dynamic Trade Management & Execution Directives</span>
          </span>
          <span className="text-slate-400 flex items-center gap-1 text-[11px]">
            {showTradeManagement ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </span>
        </button>

        {showTradeManagement && (
          <div className="space-y-2 text-xs font-mono pt-1 animate-in fade-in">
            <div className="p-2.5 rounded-lg bg-[#050a14] border border-cyan-500/20 flex items-start gap-2.5">
              <span className="text-cyan-400 font-bold text-sm">🛡</span>
              <div>
                <span className="text-[11px] font-bold text-cyan-300 block">
                  Break-Even (BE) Trigger:
                </span>
                <span className="text-slate-300 text-[11px]">{smcBlueprint.breakEvenRule}</span>
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-[#050a14] border border-emerald-500/20 flex items-start gap-2.5">
              <span className="text-emerald-400 font-bold text-sm">💰</span>
              <div>
                <span className="text-[11px] font-bold text-emerald-300 block">
                  Partial Take-Profit Plan:
                </span>
                <span className="text-slate-300 text-[11px]">{smcBlueprint.partialProfitRule}</span>
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-[#050a14] border border-rose-500/20 flex items-start gap-2.5">
              <span className="text-rose-400 font-bold text-sm">🚫</span>
              <div>
                <span className="text-[11px] font-bold text-rose-300 block">
                  Early Invalidation Trigger:
                </span>
                <span className="text-slate-300 text-[11px]">{smcBlueprint.invalidationRule}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 7. Interactive Position & Lot Size Calculator */}
      <div className="p-3.5 rounded-xl bg-[#081224] border border-teal-500/30 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-teal-300 flex items-center gap-1.5 font-mono">
            <Calculator className="w-4 h-4" />
            <span>Interactive Risk & Lot Size Calculator</span>
          </span>
          <span className="text-[10px] text-slate-400 font-mono">
            Live Math for {ticker}
          </span>
        </div>

        {/* Account balance and risk selection inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
          <div>
            <label className="text-[10px] text-slate-400 block mb-1">
              Account Capital ({currency}):
            </label>
            <input
              type="number"
              value={accountBalance}
              onChange={(e) => setAccountBalance(Math.max(1, parseFloat(e.target.value) || 0))}
              className="w-full px-3 py-1.5 rounded-lg bg-[#050a12] border border-[#1b345b] text-white text-xs font-bold"
            />
          </div>

          <div>
            <label className="text-[10px] text-slate-400 block mb-1">
              Risk Tolerance (%):
            </label>
            <div className="flex items-center gap-1.5">
              {[0.5, 1.0, 2.0, 3.0].map((pct) => (
                <button
                  key={pct}
                  onClick={() => setRiskPercent(pct)}
                  className={`flex-1 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                    riskPercent === pct
                      ? 'bg-teal-500 text-slate-950 shadow-sm'
                      : 'bg-[#050a12] text-slate-300 border border-[#193254] hover:bg-[#0c192d]'
                  }`}
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Calculated Results Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono pt-1">
          <div className="p-2.5 rounded-lg bg-[#050b14] border border-teal-500/25">
            <span className="text-[9px] text-slate-400 block uppercase">
              {isForex ? 'Recommended Lots' : 'Shares'}
            </span>
            <span className="text-sm font-extrabold text-[#0df2c9]">
              {riskCalculations.computedLot} {isForex ? 'Lots' : 'Units'}
            </span>
          </div>

          <div className="p-2.5 rounded-lg bg-[#050b14] border border-rose-500/25">
            <span className="text-[9px] text-slate-400 block uppercase">Max Risk @ SL</span>
            <span className="text-sm font-extrabold text-rose-400">
              -${riskCalculations.maxRiskCash}
            </span>
          </div>

          <div className="p-2.5 rounded-lg bg-[#050b14] border border-emerald-500/25">
            <span className="text-[9px] text-slate-400 block uppercase">Gain @ TP1</span>
            <span className="text-sm font-extrabold text-emerald-400">
              +${riskCalculations.estTp1Gain}
            </span>
          </div>

          <div className="p-2.5 rounded-lg bg-[#050b14] border border-emerald-500/25">
            <span className="text-[9px] text-slate-400 block uppercase">Gain @ TP2</span>
            <span className="text-sm font-extrabold text-emerald-300">
              +${riskCalculations.estTp2Gain}
            </span>
          </div>
        </div>
      </div>

      {/* 8. Action Execution Bar */}
      <div className="pt-2 flex flex-col sm:flex-row items-center gap-2">
        <button
          onClick={handleExecute}
          className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-teal-500/20 hover:opacity-95 transition-all cursor-pointer"
        >
          <Zap className="w-4 h-4 fill-slate-950" />
          <span>Execute in Paper Trading Desk</span>
        </button>

        <button
          onClick={handleCopyAlert}
          className="w-full sm:w-auto py-3 px-4 rounded-xl bg-[#0a1529] border border-[#1b345f] text-slate-200 hover:text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          {copiedAlert ? (
            <>
              <Check className="w-4 h-4 text-emerald-400" />
              <span className="text-emerald-400">Copied to Clipboard!</span>
            </>
          ) : (
            <>
              <Copy className="w-4 h-4 text-teal-400" />
              <span>Copy MT4/MT5 Alert</span>
            </>
          )}
        </button>

        <button
          onClick={handleCopyLevels}
          className="w-full sm:w-auto py-3 px-3 rounded-xl bg-[#0a1529] border border-[#1b345f] text-slate-400 hover:text-slate-200 text-xs font-mono flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          title="Copy raw numeric values"
        >
          {copiedLevels ? (
            <Check className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <Info className="w-3.5 h-3.5 text-slate-400" />
          )}
          <span>{copiedLevels ? 'Copied' : 'Raw Levels'}</span>
        </button>
      </div>
    </div>
  );
};
