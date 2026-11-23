import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase.ts';

export interface MullahMemoryNote {
  id: string;
  text: string;
  createdAt: string;
}

export interface MullahMemoryProfile {
  voiceRate: number;
  voiceName: string;
  briefingMode: 'full' | 'concise';
  favoriteChannel: string;
  preferredRiskPct: number;
  notes: MullahMemoryNote[];
  updatedAt: string;
}

const STORAGE_PREFIX = 'njia_mullah_memory_v1';

export const DEFAULT_MULLAH_MEMORY: MullahMemoryProfile = {
  voiceRate: 1.02,
  voiceName: 'auto',
  briefingMode: 'full',
  favoriteChannel: 'bloomberg',
  preferredRiskPct: 1,
  notes: [],
  updatedAt: new Date(0).toISOString(),
};

function getStorageKey(uid?: string | null): string {
  return `${STORAGE_PREFIX}_${uid || 'guest'}`;
}

export function loadLocalMullahMemory(uid?: string | null): MullahMemoryProfile {
  try {
    const raw = localStorage.getItem(getStorageKey(uid));
    if (!raw) return { ...DEFAULT_MULLAH_MEMORY };
    const parsed = JSON.parse(raw) as Partial<MullahMemoryProfile>;
    return {
      voiceRate:
        typeof parsed.voiceRate === 'number' && parsed.voiceRate >= 0.75 && parsed.voiceRate <= 1.5
          ? parsed.voiceRate
          : DEFAULT_MULLAH_MEMORY.voiceRate,
      voiceName: typeof parsed.voiceName === 'string' && parsed.voiceName ? parsed.voiceName : 'auto',
      briefingMode: parsed.briefingMode === 'concise' ? 'concise' : 'full',
      favoriteChannel: typeof parsed.favoriteChannel === 'string' && parsed.favoriteChannel ? parsed.favoriteChannel : 'bloomberg',
      preferredRiskPct:
        typeof parsed.preferredRiskPct === 'number' && parsed.preferredRiskPct > 0 && parsed.preferredRiskPct <= 10
          ? parsed.preferredRiskPct
          : 1,
      notes: Array.isArray(parsed.notes) ? parsed.notes.slice(0, 30) : [],
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
    };
  } catch {
    return { ...DEFAULT_MULLAH_MEMORY };
  }
}

export function saveLocalMullahMemory(profile: MullahMemoryProfile, uid?: string | null): MullahMemoryProfile {
  const normalized: MullahMemoryProfile = {
    ...profile,
    notes: (profile.notes || []).slice(0, 30),
    updatedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(getStorageKey(uid), JSON.stringify(normalized));
  } catch {}
  return normalized;
}

export async function hydrateMullahMemoryFromCloud(uid: string): Promise<MullahMemoryProfile> {
  const local = loadLocalMullahMemory(uid);
  if (!uid || !auth.currentUser || auth.currentUser.uid !== uid) {
    return local;
  }

  const docPath = `users/${uid}/finance/mullah_memory`;
  try {
    const ref = doc(db, 'users', uid, 'finance', 'mullah_memory');
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, { ...local, uid, updatedAt: new Date().toISOString() }, { merge: true });
      return local;
    }

    const cloud = snap.data() as Partial<MullahMemoryProfile>;
    const seenIds = new Set<string>();
    const mergedNotes: MullahMemoryNote[] = [];
    for (const note of [...(local.notes || []), ...(Array.isArray(cloud.notes) ? cloud.notes : [])]) {
      if (!note?.text) continue;
      const key = note.id || note.text.toLowerCase();
      if (seenIds.has(key)) continue;
      seenIds.add(key);
      mergedNotes.push({
        id: String(note.id || `note-${Date.now()}-${mergedNotes.length}`),
        text: String(note.text).slice(0, 280),
        createdAt: String(note.createdAt || new Date().toISOString()),
      });
      if (mergedNotes.length >= 30) break;
    }

    const useCloudPrimary =
      typeof cloud.updatedAt === 'string' &&
      (!local.updatedAt || new Date(cloud.updatedAt).getTime() >= new Date(local.updatedAt).getTime());

    const merged: MullahMemoryProfile = {
      voiceRate: useCloudPrimary && typeof cloud.voiceRate === 'number' ? cloud.voiceRate : local.voiceRate,
      voiceName: useCloudPrimary && typeof cloud.voiceName === 'string' ? cloud.voiceName : local.voiceName,
      briefingMode: useCloudPrimary && cloud.briefingMode === 'concise' ? 'concise' : local.briefingMode,
      favoriteChannel:
        useCloudPrimary && typeof cloud.favoriteChannel === 'string' ? cloud.favoriteChannel : local.favoriteChannel,
      preferredRiskPct:
        useCloudPrimary && typeof cloud.preferredRiskPct === 'number'
          ? cloud.preferredRiskPct
          : local.preferredRiskPct,
      notes: mergedNotes,
      updatedAt: new Date().toISOString(),
    };

    saveLocalMullahMemory(merged, uid);
    return merged;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, docPath);
    return local;
  }
}

export async function persistMullahMemoryToCloud(profile: MullahMemoryProfile, uid?: string | null): Promise<MullahMemoryProfile> {
  const saved = saveLocalMullahMemory(profile, uid);
  if (!uid || !auth.currentUser || auth.currentUser.uid !== uid) {
    return saved;
  }
  const docPath = `users/${uid}/finance/mullah_memory`;
  try {
    const ref = doc(db, 'users', uid, 'finance', 'mullah_memory');
    await setDoc(ref, { ...saved, uid }, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, docPath);
  }
  return saved;
}
