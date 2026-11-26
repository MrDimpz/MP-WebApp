const STORAGE_PREFIX = 'mp_interactive_win_tally_v1_';
const CHANNEL_NAME = 'mp_interactive_win_tally_sync_v1';

export interface WinTallyEntry {
  key: string;
  name: string;
  wins: number;
  avatarUrl?: string;
  lastWonAt: number;
}

type WinTallyMap = Record<string, WinTallyEntry>;

export function normalizeWinnerKey(name: string): string {
  return name.trim().replace(/^@+/, '').toLowerCase();
}

export function cleanWinnerDisplayName(name: string): string {
  const trimmed = name.trim();
  return trimmed.replace(/^@+/, '') || trimmed;
}

function getStorageKey(gameId: string): string {
  return `${STORAGE_PREFIX}${gameId}`;
}

function readMap(gameId: string): WinTallyMap {
  try {
    const raw = window.localStorage.getItem(getStorageKey(gameId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parsed as WinTallyMap;
    }
  } catch {
    // ignore storage errors
  }
  return {};
}

function writeMap(gameId: string, map: WinTallyMap): void {
  try {
    window.localStorage.setItem(getStorageKey(gameId), JSON.stringify(map));
  } catch {
    // ignore storage errors
  }
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const ch = new BroadcastChannel(CHANNEL_NAME);
      ch.postMessage({ gameId, map });
      ch.close();
    }
  } catch {
    // ignore BroadcastChannel errors
  }
  try {
    window.dispatchEvent(new CustomEvent('mp-win-tally-updated', { detail: { gameId } }));
  } catch {
    // ignore
  }
}

export function recordInteractiveWin(
  gameId: string,
  winnerName: string,
  avatarUrl?: string
): number {
  const key = normalizeWinnerKey(winnerName);
  if (!key) return 0;
  const map = readMap(gameId);
  const existing = map[key];
  const nextWins = (existing?.wins ?? 0) + 1;
  map[key] = {
    key,
    name: cleanWinnerDisplayName(winnerName),
    wins: nextWins,
    avatarUrl: avatarUrl || existing?.avatarUrl,
    lastWonAt: Date.now(),
  };
  writeMap(gameId, map);
  return nextWins;
}

export function recordInteractiveWins(
  gameId: string,
  winners: Array<{ name: string; avatarUrl?: string }>
): Record<string, number> {
  const map = readMap(gameId);
  const counts: Record<string, number> = {};
  const seenInRound = new Set<string>();

  for (const w of winners) {
    const key = normalizeWinnerKey(w.name);
    if (!key || seenInRound.has(key)) continue;
    seenInRound.add(key);
    const existing = map[key];
    const nextWins = (existing?.wins ?? 0) + 1;
    map[key] = {
      key,
      name: cleanWinnerDisplayName(w.name),
      wins: nextWins,
      avatarUrl: w.avatarUrl || existing?.avatarUrl,
      lastWonAt: Date.now(),
    };
    counts[key] = nextWins;
  }

  if (seenInRound.size > 0) {
    writeMap(gameId, map);
  }
  return counts;
}

export function getInteractiveWinCount(gameId: string, winnerName: string): number {
  const key = normalizeWinnerKey(winnerName);
  if (!key) return 0;
  const map = readMap(gameId);
  return map[key]?.wins ?? 0;
}

export function getInteractiveWinLeaderboard(gameId: string): WinTallyEntry[] {
  const map = readMap(gameId);
  return Object.values(map).sort((a, b) => b.wins - a.wins || b.lastWonAt - a.lastWonAt);
}

export function resetInteractiveWinTally(gameId: string): void {
  writeMap(gameId, {});
}

export function subscribeInteractiveWinTally(
  gameId: string,
  onChange: () => void
): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === getStorageKey(gameId)) onChange();
  };
  const onCustom = (e: Event) => {
    const detail = (e as CustomEvent<{ gameId?: string }>).detail;
    if (!detail?.gameId || detail.gameId === gameId) onChange();
  };
  window.addEventListener('storage', onStorage);
  window.addEventListener('mp-win-tally-updated', onCustom);

  let ch: BroadcastChannel | null = null;
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      ch = new BroadcastChannel(CHANNEL_NAME);
      ch.onmessage = (ev) => {
        if (ev.data?.gameId === gameId) onChange();
      };
    }
  } catch {
    // ignore
  }

  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener('mp-win-tally-updated', onCustom);
    try {
      ch?.close();
    } catch {
      // ignore
    }
  };
}
