import { doc, getDoc, onSnapshot, setDoc, Unsubscribe } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase.ts';

export const CLOUD_TRADING_HYDRATED_EVENT = 'mullah-cloud-trading-hydrated';

const SCORECARD_KEY = 'mullah_signal_scorecard_v1';
const PAPER_BALANCE_KEY = 'njia_paper_balance';
const PAPER_POSITIONS_KEY = 'njia_paper_positions';
const PAPER_TRADES_KEY = 'njia_paper_trades';
const CUSTOM_BOTS_KEY = 'njia_custom_scalping_eas';

let pushTimer: ReturnType<typeof setTimeout> | null = null;
let lastHydratedUid: string | null = null;
let activeUnsubscribe: Unsubscribe | null = null;
let lastPushedUpdatedAt = '';

function readJsonArray<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function mergeById<T extends { id?: string }>(cloudArr: T[], localArr: T[], limit: number): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of [...localArr, ...cloudArr]) {
    const id = item?.id ? String(item.id) : '';
    if (id) {
      if (seen.has(id)) continue;
      seen.add(id);
    }
    out.push(item);
    if (out.length >= limit) break;
  }
  return out;
}

function applyCloudTradingSnapshot(data: Record<string, unknown>, preferRemote = false): void {
  if (typeof data.paperBalance === 'number') {
    if (preferRemote || !localStorage.getItem(PAPER_BALANCE_KEY) || data.paperBalance !== 10000) {
      localStorage.setItem(PAPER_BALANCE_KEY, String(data.paperBalance));
    }
  }

  if (Array.isArray(data.paperPositions)) {
    const localPos = readJsonArray<Record<string, unknown>>(PAPER_POSITIONS_KEY);
    const mergedPos = preferRemote
      ? data.paperPositions.slice(0, 100)
      : mergeById(data.paperPositions, localPos, 100);
    localStorage.setItem(PAPER_POSITIONS_KEY, JSON.stringify(mergedPos));
  }

  if (Array.isArray(data.closedTrades)) {
    const localTrades = readJsonArray<Record<string, unknown>>(PAPER_TRADES_KEY);
    const mergedTrades = mergeById(data.closedTrades, localTrades, 200);
    localStorage.setItem(PAPER_TRADES_KEY, JSON.stringify(mergedTrades));
  }

  if (Array.isArray(data.trackedSignals)) {
    const localSigs = readJsonArray<Record<string, unknown>>(SCORECARD_KEY);
    const mergedSigs = mergeById(data.trackedSignals, localSigs, 120);
    localStorage.setItem(SCORECARD_KEY, JSON.stringify(mergedSigs));
  }

  if (Array.isArray(data.customBots)) {
    const localBots = readJsonArray<Record<string, unknown>>(CUSTOM_BOTS_KEY);
    const mergedBots = mergeById(data.customBots, localBots, 40);
    localStorage.setItem(CUSTOM_BOTS_KEY, JSON.stringify(mergedBots));
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CLOUD_TRADING_HYDRATED_EVENT));
    window.dispatchEvent(new CustomEvent('mullah-signal-scorecard-updated'));
    window.dispatchEvent(new CustomEvent('njia-paper-positions-updated'));
  }
}

export async function hydrateTradingCloudState(uid: string): Promise<boolean> {
  if (!uid || !auth.currentUser || auth.currentUser.uid !== uid) return false;
  if (lastHydratedUid === uid && activeUnsubscribe) return true;

  if (activeUnsubscribe) {
    activeUnsubscribe();
    activeUnsubscribe = null;
  }

  const docPath = `users/${uid}/trading/state`;
  try {
    const ref = doc(db, 'users', uid, 'trading', 'state');
    const snap = await getDoc(ref);

    if (snap.exists()) {
      const data = snap.data() as Record<string, unknown>;
      applyCloudTradingSnapshot(data, false);
    } else {
      await pushTradingCloudStateNow(uid);
    }

    // Real-time cross-device sync via onSnapshot
    activeUnsubscribe = onSnapshot(
      ref,
      (liveSnap) => {
        if (!liveSnap.exists() || liveSnap.metadata.hasPendingWrites) return;
        const liveData = liveSnap.data() as Record<string, unknown>;
        if (typeof liveData.updatedAt === 'string' && liveData.updatedAt === lastPushedUpdatedAt) {
          return;
        }
        applyCloudTradingSnapshot(liveData, true);
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, docPath);
      }
    );

    lastHydratedUid = uid;
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, docPath);
  }
}

export async function pushTradingCloudStateNow(explicitUid?: string): Promise<void> {
  const uid = explicitUid || auth.currentUser?.uid;
  if (!uid || !auth.currentUser || auth.currentUser.uid !== uid) return;

  const docPath = `users/${uid}/trading/state`;
  const rawBal = localStorage.getItem(PAPER_BALANCE_KEY);
  const paperBalance = rawBal ? Math.max(0, Number(parseFloat(rawBal) || 10000)) : 10000;

  // Strip non-serializable functions from customBots if any exist
  const customBots = readJsonArray<Record<string, unknown>>(CUSTOM_BOTS_KEY)
    .slice(0, 40)
    .map(({ generateMql5Code: _fn, ...rest }) => rest);

  const updatedAt = new Date().toISOString().slice(0, 64);
  lastPushedUpdatedAt = updatedAt;

  const payload = {
    uid,
    paperBalance,
    paperPositions: readJsonArray(PAPER_POSITIONS_KEY).slice(0, 100),
    closedTrades: readJsonArray(PAPER_TRADES_KEY).slice(0, 200),
    trackedSignals: readJsonArray(SCORECARD_KEY).slice(0, 120),
    customBots,
    updatedAt,
  };

  try {
    const ref = doc(db, 'users', uid, 'trading', 'state');
    await setDoc(ref, payload, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, docPath);
  }
}

export function scheduleTradingCloudPush(): void {
  if (!auth.currentUser) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTradingCloudStateNow().catch(() => {});
  }, 1200);
}

export function resetTradingCloudSession(): void {
  lastHydratedUid = null;
  lastPushedUpdatedAt = '';
  if (activeUnsubscribe) {
    activeUnsubscribe();
    activeUnsubscribe = null;
  }
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
}
