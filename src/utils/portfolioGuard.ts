export interface SimpleOpenPos {
  id?: string;
  ticker: string;
  direction: 'LONG' | 'SHORT' | 'BUY' | 'SELL';
  lots: number;
  pnl?: number;
}

export interface PortfolioExposureReport {
  openCount: number;
  usdNetLots: number;
  stackedDirection: 'LONG' | 'SHORT' | 'NEUTRAL';
  correlatedMatches: Array<{ ticker: string; direction: string; relation: 'SAME_USD' | 'SAME_ASSET' | 'CORRELATED' }>;
  level: 'CLEAR' | 'CAUTION' | 'WARNING';
  message: string;
}

export const PAPER_POSITIONS_EVENT = 'njia-paper-positions-updated';

export function emitPaperPositionsUpdated(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(PAPER_POSITIONS_EVENT));
  }
}

export function loadOpenPaperPositions(): SimpleOpenPos[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('njia_paper_positions');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getCurrencySides(ticker: string, direction: 'LONG' | 'SHORT' | 'BUY' | 'SELL'): { base: string; quote: string; sign: 1 | -1 } {
  const isBuy = direction === 'LONG' || direction === 'BUY';
  const sign: 1 | -1 = isBuy ? 1 : -1;
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

export function evaluatePortfolioExposure(
  proposedTicker: string,
  proposedDirection: 'LONG' | 'SHORT' | 'BUY' | 'SELL',
  proposedLots = 0.1,
  openPositions: SimpleOpenPos[] = loadOpenPaperPositions()
): PortfolioExposureReport {
  const netByCurrency: Record<string, number> = {};

  for (const pos of openPositions) {
    const { base, quote, sign } = getCurrencySides(pos.ticker, pos.direction);
    const lots = Number(pos.lots) || 0.1;
    netByCurrency[base] = (netByCurrency[base] || 0) + sign * lots;
    netByCurrency[quote] = (netByCurrency[quote] || 0) - sign * lots;
  }

  const prop = getCurrencySides(proposedTicker, proposedDirection);
  const propUsdImpact = prop.base === 'USD' ? prop.sign * proposedLots : prop.quote === 'USD' ? -prop.sign * proposedLots : 0;
  const currentUsd = netByCurrency['USD'] || 0;
  const projectedUsd = Number((currentUsd + propUsdImpact).toFixed(2));

  const cleanProposed = proposedTicker.replace('/', '').toUpperCase();
  const correlatedMatches: PortfolioExposureReport['correlatedMatches'] = [];

  for (const pos of openPositions) {
    const cleanExisting = pos.ticker.replace('/', '').toUpperCase();
    const posSides = getCurrencySides(pos.ticker, pos.direction);
    const existingUsdSign = posSides.base === 'USD' ? posSides.sign : posSides.quote === 'USD' ? -posSides.sign : 0;
    const proposedUsdSign = prop.base === 'USD' ? prop.sign : prop.quote === 'USD' ? -prop.sign : 0;

    if (cleanExisting === cleanProposed) {
      correlatedMatches.push({
        ticker: pos.ticker,
        direction: pos.direction,
        relation: 'SAME_ASSET',
      });
    } else if (existingUsdSign !== 0 && proposedUsdSign !== 0 && existingUsdSign === proposedUsdSign) {
      correlatedMatches.push({
        ticker: pos.ticker,
        direction: pos.direction,
        relation: 'SAME_USD',
      });
    } else if (
      (cleanProposed.includes('XAU') && cleanExisting.includes('XAG')) ||
      (cleanProposed.includes('XAG') && cleanExisting.includes('XAU')) ||
      (cleanProposed.includes('US500') && cleanExisting.includes('NAS100')) ||
      (cleanProposed.includes('NAS100') && cleanExisting.includes('US500'))
    ) {
      if (posSides.sign === prop.sign) {
        correlatedMatches.push({
          ticker: pos.ticker,
          direction: pos.direction,
          relation: 'CORRELATED',
        });
      }
    }
  }

  const stackedUsdDir = projectedUsd > 0.05 ? 'LONG' : projectedUsd < -0.05 ? 'SHORT' : 'NEUTRAL';

  if (correlatedMatches.length >= 2 || Math.abs(projectedUsd) >= 0.8) {
    return {
      openCount: openPositions.length,
      usdNetLots: projectedUsd,
      stackedDirection: stackedUsdDir,
      correlatedMatches,
      level: 'WARNING',
      message: `High Concentrated Risk: Stacks ${stackedUsdDir} USD (${projectedUsd >= 0 ? '+' : ''}${projectedUsd}L net) across ${correlatedMatches.length + 1} correlated trades.`,
    };
  }

  if (correlatedMatches.length === 1) {
    const m = correlatedMatches[0];
    return {
      openCount: openPositions.length,
      usdNetLots: projectedUsd,
      stackedDirection: stackedUsdDir,
      correlatedMatches,
      level: 'CAUTION',
      message:
        m.relation === 'SAME_ASSET'
          ? `Active ${m.direction} position already open on ${m.ticker} — adding increases exposure.`
          : `Correlated ${stackedUsdDir} USD exposure with open ${m.direction} ${m.ticker}.`,
    };
  }

  return {
    openCount: openPositions.length,
    usdNetLots: projectedUsd,
    stackedDirection: stackedUsdDir,
    correlatedMatches: [],
    level: 'CLEAR',
    message:
      openPositions.length === 0
        ? 'No conflicting open positions'
        : `Diversified (${openPositions.length} open • Net USD ${projectedUsd >= 0 ? '+' : ''}${projectedUsd}L)`,
  };
}
