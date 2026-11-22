import fs from 'node:fs';
import path from 'node:path';
import type { LadderMode, LeaderboardEntry } from '../../src/mpwh/shared/types.ts';

const DATA_DIR = path.resolve(process.cwd(), '.relay_data');
const DATA_FILE = path.join(DATA_DIR, 'mpwh_leaderboard.json');
const MAX_STORED_ENTRIES = 500;

let entries: LeaderboardEntry[] = [];

function loadFromDisk(): void {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      entries = [];
      return;
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      entries = parsed
        .filter((e) => e && typeof e.playerName === 'string' && typeof e.score === 'number')
        .map((e) => ({
          ...e,
          pieces: typeof e.pieces === 'number' ? e.pieces : Math.max(5, Math.round(e.score / 45)),
        }));
    }
  } catch (err) {
    console.warn('[MPWH] Could not read leaderboard file, starting fresh:', err);
    entries = [];
  }
}

function saveToDisk(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(entries, null, 2), 'utf8');
  } catch (err) {
    console.warn('[MPWH] Could not persist leaderboard file:', err);
  }
}

loadFromDisk();

function sortEntries(list: LeaderboardEntry[]): LeaderboardEntry[] {
  return [...list].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.guesses !== b.guesses) return a.guesses - b.guesses;
    if (a.durationMs !== b.durationMs) return a.durationMs - b.durationMs;
    return b.createdAt - a.createdAt;
  });
}

export function addLeaderboardEntry(entry: LeaderboardEntry): LeaderboardEntry[] {
  entries.push(entry);
  entries = sortEntries(entries).slice(0, MAX_STORED_ENTRIES);
  saveToDisk();
  return entries;
}

export function getLeaderboard(
  filter: 'all' | LadderMode = 'all',
  limit = 50
): LeaderboardEntry[] {
  const safeLimit = Math.max(1, Math.min(200, Math.floor(limit)));
  const filtered = entries.filter((e) => {
    if (filter === 'all') return true;
    return e.mode === filter;
  });
  return sortEntries(filtered).slice(0, safeLimit);
}
