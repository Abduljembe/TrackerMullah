import { useEffect, useMemo, useState } from 'react';

export interface CalendarNewsEvent {
  id: string;
  title: string;
  country: string;
  flag: string;
  currency: string;
  impact: 'HIGH' | 'MEDIUM' | 'LOW' | 'HOLIDAY' | string;
  time: string;
  date: string;
  isoDate?: string;
  forecast: string;
  previous: string;
  actual?: string;
  isUpcoming: boolean;
  affectedTickers?: string[];
}

export interface NewsGuardEvaluation {
  isLoading: boolean;
  isHazardWindow: boolean;
  severity: 'HIGH_PAUSE' | 'MEDIUM_CAUTION' | 'CLEAR';
  activeHazard: CalendarNewsEvent | null;
  nextHighImpact: CalendarNewsEvent | null;
  minutesToNext: number | null;
  statusLabel: string;
  detailLabel: string;
}

let cachedEvents: CalendarNewsEvent[] = [];
let lastFetchAt = 0;
let inflightPromise: Promise<CalendarNewsEvent[]> | null = null;
const CACHE_TTL_MS = 90_000;

export async function fetchSharedCalendarEvents(force = false): Promise<CalendarNewsEvent[]> {
  const now = Date.now();
  if (!force && cachedEvents.length > 0 && now - lastFetchAt < CACHE_TTL_MS) {
    return cachedEvents;
  }
  if (inflightPromise) return inflightPromise;

  inflightPromise = fetch('/api/forexfactory/calendar')
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      if (data && Array.isArray(data.events)) {
        cachedEvents = data.events;
        lastFetchAt = Date.now();
      }
      return cachedEvents;
    })
    .catch(() => cachedEvents)
    .finally(() => {
      inflightPromise = null;
    });

  return inflightPromise;
}

export function getRelevantCurrenciesForSymbol(symbol: string): string[] {
  const clean = symbol.replace('/', '').toUpperCase();
  if (clean.includes('XAU') || clean.includes('XAG') || clean.includes('WTI') || clean.includes('US500') || clean.includes('NAS100') || clean.includes('US30') || clean.includes('BTC') || clean.includes('ETH') || clean.includes('SOL')) {
    return ['USD'];
  }
  if (clean.includes('GER40') || clean.includes('DAX')) return ['EUR', 'USD'];
  if (clean.includes('UK100')) return ['GBP', 'USD'];
  if (clean.includes('JPN225')) return ['JPY', 'USD'];
  if (clean.includes('KES')) return ['KES', 'USD'];
  if (clean.length >= 6 && !clean.startsWith('R_') && !clean.startsWith('1HZ') && !clean.startsWith('BOOM') && !clean.startsWith('CRASH')) {
    return Array.from(new Set([clean.slice(0, 3), clean.slice(3, 6), 'USD']));
  }
  // Equities & Synthetics watch USD liquidity conditions
  return ['USD'];
}

export function formatMinutesCountdown(mins: number): string {
  const abs = Math.abs(Math.round(mins));
  if (abs < 1) return 'NOW';
  if (abs < 60) return `${abs}m`;
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function evaluateNewsGuardForSymbol(
  symbol: string,
  events: CalendarNewsEvent[],
  windowMinutes = 30
): Omit<NewsGuardEvaluation, 'isLoading'> {
  if (!events || events.length === 0) {
    return {
      isHazardWindow: false,
      severity: 'CLEAR',
      activeHazard: null,
      nextHighImpact: null,
      minutesToNext: null,
      statusLabel: 'Major Releases Clear',
      detailLabel: 'No high-impact calendar hazards detected in window',
    };
  }

  const nowMs = Date.now();
  const relevantCurrencies = getRelevantCurrenciesForSymbol(symbol);
  const matching = events
    .filter((ev) => {
      const c = (ev.currency || ev.country || '').toUpperCase();
      return relevantCurrencies.includes(c);
    })
    .map((ev) => {
      const evTime = ev.isoDate ? new Date(ev.isoDate).getTime() : NaN;
      const minsDiff = Number.isFinite(evTime) ? (evTime - nowMs) / 60000 : NaN;
      return { ev, minsDiff };
    })
    .filter((x) => Number.isFinite(x.minsDiff));

  // Immediate hazard window: -10m to +windowMinutes around HIGH impact news
  const highHazard = matching
    .filter((x) => String(x.ev.impact).toUpperCase() === 'HIGH' && x.minsDiff >= -10 && x.minsDiff <= windowMinutes)
    .sort((a, b) => Math.abs(a.minsDiff) - Math.abs(b.minsDiff))[0];

  if (highHazard) {
    const cd = highHazard.minsDiff <= 0 ? 'LIVE RELEASE' : `in ${formatMinutesCountdown(highHazard.minsDiff)}`;
    return {
      isHazardWindow: true,
      severity: 'HIGH_PAUSE',
      activeHazard: highHazard.ev,
      nextHighImpact: highHazard.ev,
      minutesToNext: Math.round(highHazard.minsDiff),
      statusLabel: `🔴 ${highHazard.ev.country} ${highHazard.ev.title} (${cd})`,
      detailLabel: `High-impact ${highHazard.ev.country} release within ±${windowMinutes}m — Auto-Pause advised`,
    };
  }

  // Medium impact within 20m caution
  const medHazard = matching
    .filter((x) => String(x.ev.impact).toUpperCase() === 'MEDIUM' && x.minsDiff >= -5 && x.minsDiff <= 20)
    .sort((a, b) => Math.abs(a.minsDiff) - Math.abs(b.minsDiff))[0];

  const nextHigh = matching
    .filter((x) => String(x.ev.impact).toUpperCase() === 'HIGH' && x.minsDiff > windowMinutes)
    .sort((a, b) => a.minsDiff - b.minsDiff)[0];

  if (medHazard) {
    const cd = medHazard.minsDiff <= 0 ? 'NOW' : `in ${formatMinutesCountdown(medHazard.minsDiff)}`;
    return {
      isHazardWindow: false,
      severity: 'MEDIUM_CAUTION',
      activeHazard: medHazard.ev,
      nextHighImpact: nextHigh?.ev || null,
      minutesToNext: nextHigh ? Math.round(nextHigh.minsDiff) : Math.round(medHazard.minsDiff),
      statusLabel: `🟠 ${medHazard.ev.country} ${medHazard.ev.title} (${cd})`,
      detailLabel: 'Medium-impact news nearby; watch spread expansion',
    };
  }

  if (nextHigh) {
    const cd = formatMinutesCountdown(nextHigh.minsDiff);
    return {
      isHazardWindow: false,
      severity: 'CLEAR',
      activeHazard: null,
      nextHighImpact: nextHigh.ev,
      minutesToNext: Math.round(nextHigh.minsDiff),
      statusLabel: `Clear • Next: ${nextHigh.ev.country} ${nextHigh.ev.title} (${cd})`,
      detailLabel: `No red-folder event for ${relevantCurrencies.join('/')} in next ${windowMinutes}m`,
    };
  }

  return {
    isHazardWindow: false,
    severity: 'CLEAR',
    activeHazard: null,
    nextHighImpact: null,
    minutesToNext: null,
    statusLabel: `Clear • ${relevantCurrencies.slice(0, 2).join('/')} Stable`,
    detailLabel: 'No upcoming high-impact events queued',
  };
}

export function useNewsGuard(symbol: string, windowMinutes = 30): NewsGuardEvaluation {
  const [events, setEvents] = useState<CalendarNewsEvent[]>(cachedEvents);
  const [isLoading, setIsLoading] = useState<boolean>(cachedEvents.length === 0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let mounted = true;
    fetchSharedCalendarEvents()
      .then((evs) => {
        if (mounted) {
          setEvents(evs);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (mounted) setIsLoading(false);
      });

    const interval = setInterval(() => {
      setTick((t) => t + 1);
      fetchSharedCalendarEvents().then((evs) => {
        if (mounted) setEvents(evs);
      });
    }, 30_000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return useMemo(() => {
    const res = evaluateNewsGuardForSymbol(symbol, events, windowMinutes);
    return { ...res, isLoading };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, events, windowMinutes, isLoading, tick]);
}
