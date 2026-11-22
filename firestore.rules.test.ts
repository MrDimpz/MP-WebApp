/**
 * Firestore Security Rules Specification Tests
 * Verifies positive and negative access patterns for /leaderboard/{entryId} and /highscores/{scoreId}
 */

export interface LeaderboardTestVector {
  description: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  authUid: string | null;
  entryId: string;
  payload?: Record<string, unknown>;
  expectedAllowed: boolean;
}

export const LEADERBOARD_RULE_TESTS: LeaderboardTestVector[] = [
  {
    description: 'Unauthenticated visitor can list public game leaderboards',
    operation: 'list',
    authUid: null,
    entryId: 'user123_crossword_daily',
    expectedAllowed: true,
  },
  {
    description: 'Signed-in player can create their own valid leaderboard score',
    operation: 'create',
    authUid: 'user123',
    entryId: 'user123_crossword_daily',
    payload: {
      userId: 'user123',
      displayName: 'Puzzle Seeker',
      gameId: 'crossword',
      puzzleId: 'daily-2026-11-09',
      puzzleTitle: 'Standard 20x20 Crossword',
      score: 2850,
      metricLabel: '2,850 pts',
      subMetricLabel: '20x20 · medium · 04:12',
    },
    expectedAllowed: true,
  },
  {
    description: 'Unauthenticated visitor cannot create a leaderboard score',
    operation: 'create',
    authUid: null,
    entryId: 'anon_crossword_daily',
    payload: {
      userId: 'anon',
      displayName: 'Anon',
      gameId: 'crossword',
      puzzleId: 'daily-2026-11-09',
      puzzleTitle: 'Standard 20x20 Crossword',
      score: 2850,
      metricLabel: '2,850 pts',
      subMetricLabel: '20x20 · medium · 04:12',
    },
    expectedAllowed: false,
  },
  {
    description: 'Signed-in player cannot spoof another userId on create',
    operation: 'create',
    authUid: 'user123',
    entryId: 'user999_crossword_daily',
    payload: {
      userId: 'user999',
      displayName: 'Spoofed',
      gameId: 'crossword',
      puzzleId: 'daily-2026-11-09',
      puzzleTitle: 'Standard 20x20 Crossword',
      score: 9999,
      metricLabel: '9,999 pts',
      subMetricLabel: '20x20',
    },
    expectedAllowed: false,
  },
];

export interface OverlaySessionTestVector {
  description: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  authUid: string | null;
  sessionKey: string;
  payload?: Record<string, unknown>;
  expectedAllowed: boolean;
}

export const OVERLAY_SESSION_RULE_TESTS: OverlaySessionTestVector[] = [
  {
    description: 'Studio CEF browser can read exact valid overlay session document by key',
    operation: 'get',
    authUid: null,
    sessionKey: 'destackint__ch_m1abc_x9k2p1',
    expectedAllowed: true,
  },
  {
    description: 'Collection list scraping on overlaySessions is denied',
    operation: 'list',
    authUid: null,
    sessionKey: 'destackint__ch_m1abc_x9k2p1',
    expectedAllowed: false,
  },
  {
    description: 'Host can create valid native map snapshot for overlay session',
    operation: 'create',
    authUid: null,
    sessionKey: 'destackint__ch_m1abc_x9k2p1',
    payload: {
      gameId: 'destackint',
      channel: 'ch_m1abc_x9k2p1',
      streamer: 'mrdimpz',
      hostSessionId: 'host_m1abc_z9q1',
      seq: 1,
      stateHash: '128:1a2b3c_4d5e6f',
      state: { puzzleRoundNonce: 1, scoreboard: [] },
    },
    expectedAllowed: true,
  },
  {
    description: 'Rejects shadow ghost field (isVerified) in overlay session payload',
    operation: 'create',
    authUid: null,
    sessionKey: 'destackint__ch_m1abc_x9k2p1',
    payload: {
      gameId: 'destackint',
      channel: 'ch_m1abc_x9k2p1',
      streamer: 'mrdimpz',
      hostSessionId: 'host_m1abc_z9q1',
      seq: 1,
      stateHash: '128:1a2b3c_4d5e6f',
      state: { puzzleRoundNonce: 1 },
      isVerified: true,
    },
    expectedAllowed: false,
  },
  {
    description: 'Rejects JSON string instead of native Map for state',
    operation: 'create',
    authUid: null,
    sessionKey: 'destackint__ch_m1abc_x9k2p1',
    payload: {
      gameId: 'destackint',
      channel: 'ch_m1abc_x9k2p1',
      streamer: 'mrdimpz',
      hostSessionId: 'host_m1abc_z9q1',
      seq: 1,
      stateHash: '128:1a2b3c_4d5e6f',
      state: '{"bad":true}',
    },
    expectedAllowed: false,
  },
  {
    description: 'Rejects invalid document ID path poisoning',
    operation: 'create',
    authUid: null,
    sessionKey: 'destackint..$bad!',
    expectedAllowed: false,
  },
];

export interface UserProgressTestVector {
  description: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  authUid: string | null;
  targetUserId: string;
  bucketId?: string;
  payload?: Record<string, unknown>;
  expectedAllowed: boolean;
}

export const USER_PROGRESS_RULE_TESTS: UserProgressTestVector[] = [
  {
    description: 'Unauthenticated visitor cannot read another user profile',
    operation: 'get',
    authUid: null,
    targetUserId: 'user123',
    expectedAllowed: false,
  },
  {
    description: 'Signed-in user cannot read another user progress bucket',
    operation: 'get',
    authUid: 'user999',
    targetUserId: 'user123',
    bucketId: 'daily_streaks',
    expectedAllowed: false,
  },
  {
    description: 'Signed-in owner can save valid daily_streaks progress bucket',
    operation: 'create',
    authUid: 'user123',
    targetUserId: 'user123',
    bucketId: 'daily_streaks',
    payload: {
      userId: 'user123',
      bucketId: 'daily_streaks',
      payload: { rebus: { solvedDates: ['2026-11-22'] } },
    },
    expectedAllowed: true,
  },
  {
    description: 'Rejects shadow ghost field (isAdmin) in progress bucket',
    operation: 'create',
    authUid: 'user123',
    targetUserId: 'user123',
    bucketId: 'daily_streaks',
    payload: {
      userId: 'user123',
      bucketId: 'daily_streaks',
      payload: { rebus: { solvedDates: ['2026-11-22'] } },
      isAdmin: true,
    },
    expectedAllowed: false,
  },
  {
    description: 'Rejects unknown bucketId in progress subcollection',
    operation: 'create',
    authUid: 'user123',
    targetUserId: 'user123',
    bucketId: 'arbitrary_bucket',
    payload: {
      userId: 'user123',
      bucketId: 'arbitrary_bucket',
      payload: { foo: 'bar' },
    },
    expectedAllowed: false,
  },
];


