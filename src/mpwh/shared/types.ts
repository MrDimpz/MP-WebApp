import type { DictionaryLanguageCode } from '../../lib/dictionary-languages';

export type LadderMode = 'classic' | 'dual' | 'quad';

export type GameStatus = 'idle' | 'playing' | 'won' | 'gave_up';

export interface GuessEntry {
  word: string;
  order: number;
  isHint: boolean;
  guessedBy?: string;
  timestamp: number;
}

export interface TargetWinner {
  name: string;
  tiktokHandle?: string;
  guessedAt: number;
  isFirst: boolean;
  word: string;
}

export interface LadderTargetView {
  index: number;
  solved: boolean;
  /** True while the 4-second stream-lag buffer is still accepting exact guesses from other players */
  bufferActive: boolean;
  bufferEndsAt: number | null;
  /** Revealed once solved or when round is revealed */
  word: string | null;
  revealedLength: number | null;
  /** Prefix revealed via Letter Clue hint */
  revealedPrefix: string | null;
  /** Longest common prefix shared by closestBefore and closestAfter — auto-filled into the word box */
  sharedPrefix: string;
  solvedAtGuess: number | null;
  winners: TargetWinner[];
  closestBefore: GuessEntry | null;
  closestAfter: GuessEntry | null;
  proximityPct: number;
}

export interface LadderInstanceView {
  boardIndex: number;
  label: string;
  targets: LadderTargetView[];
  solved: boolean;
  /** True only when all targets are solved AND their 4s lag buffers have finished */
  lockedSolved: boolean;
  guessCount: number;
  lastGuessWord: string | null;
}

export interface RoundWinnerSummary {
  name: string;
  tiktokHandle?: string;
  wordsFound: string[];
  firstSolves: number;
  score: number;
  pieces: number;
}

export interface ActivityFeedItem {
  id: string;
  text: string;
  timestamp: number;
  tone: 'neutral' | 'solve' | 'buffer' | 'hint' | 'system';
}

export interface GuessFeedItem {
  id: string;
  playerName: string;
  tiktokHandle?: string;
  avatarUrl?: string;
  word: string;
  alreadyGuessed: boolean;
  status: 'guess' | 'duplicate' | 'solved' | 'buffer';
  timestamp: number;
}

export interface LiveGameStateView {
  channel: string;
  roundId: string;
  roundNumber: number;
  mode: LadderMode;
  language: DictionaryLanguageCode;
  status: GameStatus;
  boards: LadderInstanceView[];
  totalGuesses: number;
  hintsRemaining: number;
  hintsUsed: number;
  startedAt: number | null;
  finishedAt: number | null;
  nextRoundAt: number | null;
  serverNow: number;
  roundWinners: RoundWinnerSummary[];
  recentActivity: ActivityFeedItem[];
  guessFeed: GuessFeedItem[];
}

export interface LeaderboardEntry {
  id: string;
  playerName: string;
  mode: LadderMode;
  score: number;
  pieces: number;
  guesses: number;
  hintsUsed: number;
  durationMs: number;
  wordsFound: number;
  createdAt: number;
}

export interface GuessOutcomePayload {
  accepted: boolean;
  word: string;
  reason?: string;
  matchedWords?: string[];
  wasLagBufferHit?: boolean;
}

export interface MpwhTikTokStatus {
  connected: boolean;
  mode: 'live' | 'test';
  username: string | null;
  chatEventsProcessed: number;
  guessesAccepted: number;
  lastError: string | null;
}

export interface MpwhOverlayState {
  roundId: string;
  roundNumber: number;
  mode: LadderMode;
  language: DictionaryLanguageCode;
  status: GameStatus;
  boards: LadderInstanceView[];
  totalGuesses: number;
  hintsRemaining: number;
  startedAt: number | null;
  finishedAt: number | null;
  nextRoundAt: number | null;
  roundWinners: RoundWinnerSummary[];
  recentActivity: ActivityFeedItem[];
  guessFeed: GuessFeedItem[];
  tiktokConnected: boolean;
  tiktokUsername: string | null;
  updatedAt: number;
}
