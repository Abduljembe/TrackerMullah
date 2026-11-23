export const PROP_GUARD_EVENT = 'njia-prop-guard-updated';

export interface PropGuardConfig {
  accountSize: number;
  currentEquity: number;
  dailyStartingEquity: number;
  maxDailyLossPercent: number;
  maxTotalLossPercent: number;
  riskPerTradeLimitPercent: number;
  consecutiveLosses: number;
  tiltLockExpiresAt: number | null;
  hardLockoutEnabled: boolean;
}

export interface PropBlockStatus {
  blocked: boolean;
  reason?: string;
  isDailyBreached: boolean;
  isTotalBreached: boolean;
  isTiltLocked: boolean;
  tiltSecondsRemaining: number;
  dailyPnL: number;
  dailyLossBufferRemaining: number;
  totalLossBufferRemaining: number;
}

export function emitPropGuardUpdated(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(PROP_GUARD_EVENT));
  }
}

export function loadPropConfig(): PropGuardConfig {
  if (typeof window === 'undefined') {
    return {
      accountSize: 10000,
      currentEquity: 10000,
      dailyStartingEquity: 10000,
      maxDailyLossPercent: 4.0,
      maxTotalLossPercent: 8.0,
      riskPerTradeLimitPercent: 1.5,
      consecutiveLosses: 0,
      tiltLockExpiresAt: null,
      hardLockoutEnabled: true,
    };
  }
  try {
    const accountSize = parseFloat(localStorage.getItem('prop_account_size') || '') || 10000;
    const currentEquity = parseFloat(localStorage.getItem('prop_current_equity') || '') || accountSize;
    const dailyStartingEquity = parseFloat(localStorage.getItem('prop_daily_start_equity') || '') || accountSize;
    const maxDailyLossPercent = parseFloat(localStorage.getItem('prop_max_daily_pct') || '') || 4.0;
    const maxTotalLossPercent = parseFloat(localStorage.getItem('prop_max_total_pct') || '') || 8.0;
    const riskPerTradeLimitPercent = parseFloat(localStorage.getItem('prop_risk_per_trade_pct') || '') || 1.5;
    const consecutiveLosses = parseInt(localStorage.getItem('prop_consecutive_losses') || '0', 10) || 0;
    const tiltRaw = localStorage.getItem('prop_tilt_expires');
    const tiltLockExpiresAt = tiltRaw ? parseInt(tiltRaw, 10) : null;
    const hardRaw = localStorage.getItem('prop_hard_lockout');
    const hardLockoutEnabled = hardRaw === null ? true : hardRaw === 'true';

    return {
      accountSize,
      currentEquity,
      dailyStartingEquity,
      maxDailyLossPercent,
      maxTotalLossPercent,
      riskPerTradeLimitPercent,
      consecutiveLosses,
      tiltLockExpiresAt,
      hardLockoutEnabled,
    };
  } catch {
    return {
      accountSize: 10000,
      currentEquity: 10000,
      dailyStartingEquity: 10000,
      maxDailyLossPercent: 4.0,
      maxTotalLossPercent: 8.0,
      riskPerTradeLimitPercent: 1.5,
      consecutiveLosses: 0,
      tiltLockExpiresAt: null,
      hardLockoutEnabled: true,
    };
  }
}

export function savePropConfig(cfg: PropGuardConfig): void {
  if (typeof window === 'undefined') return;
  try {
    const prev = loadPropConfig();
    const normalizedTilt = cfg.tiltLockExpiresAt && cfg.tiltLockExpiresAt > Date.now() ? cfg.tiltLockExpiresAt : null;
    const prevTilt = prev.tiltLockExpiresAt && prev.tiltLockExpiresAt > Date.now() ? prev.tiltLockExpiresAt : null;
    const didChange =
      prev.accountSize !== cfg.accountSize ||
      prev.currentEquity !== cfg.currentEquity ||
      prev.dailyStartingEquity !== cfg.dailyStartingEquity ||
      prev.maxDailyLossPercent !== cfg.maxDailyLossPercent ||
      prev.maxTotalLossPercent !== cfg.maxTotalLossPercent ||
      prev.riskPerTradeLimitPercent !== cfg.riskPerTradeLimitPercent ||
      prev.consecutiveLosses !== cfg.consecutiveLosses ||
      prev.hardLockoutEnabled !== cfg.hardLockoutEnabled ||
      prevTilt !== normalizedTilt;

    localStorage.setItem('prop_account_size', String(cfg.accountSize));
    localStorage.setItem('prop_current_equity', String(cfg.currentEquity));
    localStorage.setItem('prop_daily_start_equity', String(cfg.dailyStartingEquity));
    localStorage.setItem('prop_max_daily_pct', String(cfg.maxDailyLossPercent));
    localStorage.setItem('prop_max_total_pct', String(cfg.maxTotalLossPercent));
    localStorage.setItem('prop_risk_per_trade_pct', String(cfg.riskPerTradeLimitPercent));
    localStorage.setItem('prop_consecutive_losses', String(cfg.consecutiveLosses));
    localStorage.setItem('prop_hard_lockout', String(cfg.hardLockoutEnabled));
    if (normalizedTilt) {
      localStorage.setItem('prop_tilt_expires', String(normalizedTilt));
    } else {
      localStorage.removeItem('prop_tilt_expires');
    }
    if (didChange) {
      emitPropGuardUpdated();
    }
  } catch {
    // ignore storage limits
  }
}

export function evaluatePropTradeBlock(cfg: PropGuardConfig = loadPropConfig()): PropBlockStatus {
  const dailyPnL = cfg.currentEquity - cfg.dailyStartingEquity;
  const maxDailyLossCash = (cfg.dailyStartingEquity * cfg.maxDailyLossPercent) / 100;
  const dailyLossBufferRemaining = maxDailyLossCash + dailyPnL;
  const isDailyBreached = dailyPnL <= -maxDailyLossCash;

  const totalPnL = cfg.currentEquity - cfg.accountSize;
  const maxTotalLossCash = (cfg.accountSize * cfg.maxTotalLossPercent) / 100;
  const totalLossBufferRemaining = maxTotalLossCash + totalPnL;
  const isTotalBreached = totalPnL <= -maxTotalLossCash;

  const now = Date.now();
  const tiltSecondsRemaining = cfg.tiltLockExpiresAt
    ? Math.max(0, Math.floor((cfg.tiltLockExpiresAt - now) / 1000))
    : 0;
  const isTiltLocked = tiltSecondsRemaining > 0;

  let reason: string | undefined;
  if (isTotalBreached) {
    reason = `Prop Guardian Lock: Total max drawdown (-${cfg.maxTotalLossPercent}%) breached.`;
  } else if (isDailyBreached) {
    reason = `Prop Guardian Lock: Daily loss limit (-${cfg.maxDailyLossPercent}%) breached.`;
  } else if (isTiltLocked) {
    const mins = Math.ceil(tiltSecondsRemaining / 60);
    reason = `Anti-Tilt Cooldown active (${mins}m remaining after ${cfg.consecutiveLosses} consecutive losses).`;
  }

  return {
    blocked: cfg.hardLockoutEnabled && (isDailyBreached || isTotalBreached || isTiltLocked),
    reason,
    isDailyBreached,
    isTotalBreached,
    isTiltLocked,
    tiltSecondsRemaining,
    dailyPnL: Math.round(dailyPnL * 100) / 100,
    dailyLossBufferRemaining: Math.round(dailyLossBufferRemaining * 100) / 100,
    totalLossBufferRemaining: Math.round(totalLossBufferRemaining * 100) / 100,
  };
}

export function syncRealizedTradePnlToProp(realizedPnl: number): PropGuardConfig {
  const cfg = loadPropConfig();
  const nextEquity = Math.round((cfg.currentEquity + realizedPnl) * 100) / 100;
  let consecutiveLosses = cfg.consecutiveLosses;
  let tiltLockExpiresAt = cfg.tiltLockExpiresAt;

  if (realizedPnl < 0) {
    consecutiveLosses += 1;
    if (consecutiveLosses >= 3 && (!tiltLockExpiresAt || tiltLockExpiresAt <= Date.now())) {
      tiltLockExpiresAt = Date.now() + 30 * 60 * 1000;
    }
  } else if (realizedPnl > 0) {
    consecutiveLosses = 0;
  }

  const updated: PropGuardConfig = {
    ...cfg,
    currentEquity: nextEquity,
    consecutiveLosses,
    tiltLockExpiresAt,
  };
  savePropConfig(updated);
  return updated;
}
