import {
  AllLeaderboards,
  GiftContributorRecord,
  PlayerRecord,
} from '../types/game.ts';
import {
  creditInteractiveScoreByTikTokHandle,
  getCurrentUserSessionPrefix,
} from '../../lib/unified-game-auth.ts';

interface StoredLeaderboardData {
  allTime: Record<string, PlayerRecord>;
  today: Record<string, PlayerRecord>;
  todayDateKey: string;
  gifts: Record<string, GiftContributorRecord>;
  discoveredWordsEver: string[];
  statistics: AllLeaderboards['statistics'];
}

function getStorageKey(): string {
  return `lexi_leaderboards_v2_${getCurrentUserSessionPrefix()}`;
}

function getTodayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export class LeaderboardManager {
  private roundPlayers = new Map<string, PlayerRecord>();
  private todayPlayers = new Map<string, PlayerRecord>();
  private allTimePlayers = new Map<string, PlayerRecord>();
  private giftContributors = new Map<string, GiftContributorRecord>();
  private discoveredWordsEver = new Set<string>();
  private todayDateKey = getTodayKey();
  private statistics: AllLeaderboards['statistics'] = {
    totalRoundsPlayed: 0,
    totalWordsDiscovered: 0,
    totalPointsScored: 0,
    highestRoundScore: 0,
    longestWordFound: '',
    totalGiftsReceived: 0,
    totalLikesReceived: 0,
    totalFollowsReceived: 0,
    totalSharesReceived: 0,
    history: [],
  };

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(getStorageKey());
      if (!raw) return;
      const parsed = JSON.parse(raw) as StoredLeaderboardData;
      if (!parsed || typeof parsed !== 'object') return;

      if (parsed.allTime) {
        Object.entries(parsed.allTime).forEach(([k, v]) =>
          this.allTimePlayers.set(k, v)
        );
      }
      const currentTodayKey = getTodayKey();
      if (parsed.todayDateKey === currentTodayKey && parsed.today) {
        Object.entries(parsed.today).forEach(([k, v]) =>
          this.todayPlayers.set(k, v)
        );
      }
      this.todayDateKey = currentTodayKey;

      if (parsed.gifts) {
        Object.entries(parsed.gifts).forEach(([k, v]) =>
          this.giftContributors.set(k, v)
        );
      }
      if (Array.isArray(parsed.discoveredWordsEver)) {
        parsed.discoveredWordsEver.forEach((w) =>
          this.discoveredWordsEver.add(w)
        );
      }
      if (parsed.statistics) {
        this.statistics = {
          ...this.statistics,
          ...parsed.statistics,
          history: Array.isArray(parsed.statistics.history)
            ? parsed.statistics.history
            : [],
        };
      }
    } catch {
      // Ignore storage errors
    }
  }

  private saveToStorage() {
    if (typeof window === 'undefined') return;
    try {
      const payload: StoredLeaderboardData = {
        allTime: Object.fromEntries(this.allTimePlayers.entries()),
        today: Object.fromEntries(this.todayPlayers.entries()),
        todayDateKey: this.todayDateKey,
        gifts: Object.fromEntries(this.giftContributors.entries()),
        discoveredWordsEver: Array.from(this.discoveredWordsEver),
        statistics: this.statistics,
      };
      window.localStorage.setItem(getStorageKey(), JSON.stringify(payload));
    } catch {
      // Ignore storage errors
    }
  }

  private ensurePlayerInMap(
    map: Map<string, PlayerRecord>,
    userId: string,
    username: string,
    nickname?: string,
    avatarUrl?: string
  ): PlayerRecord {
    let rec = map.get(userId);
    if (!rec) {
      rec = {
        userId,
        username: username || userId,
        nickname: nickname || username || userId,
        avatarUrl,
        totalPoints: 0,
        validWordsCount: 0,
        totalSubmissions: 0,
        longestWord: '',
        highestSingleWordScore: 0,
        giftsSentCount: 0,
        giftDiamondsTotal: 0,
        giftPointsContributed: 0,
        likesContributed: 0,
        lastActiveAt: Date.now(),
      };
      map.set(userId, rec);
    } else {
      if (username) rec.username = username;
      if (nickname) rec.nickname = nickname;
      if (avatarUrl) rec.avatarUrl = avatarUrl;
      rec.lastActiveAt = Date.now();
    }
    return rec;
  }

  public registerPlayer(
    userId: string,
    username: string,
    nickname?: string,
    avatarUrl?: string
  ): PlayerRecord {
    const r = this.ensurePlayerInMap(
      this.roundPlayers,
      userId,
      username,
      nickname,
      avatarUrl
    );
    this.ensurePlayerInMap(
      this.todayPlayers,
      userId,
      username,
      nickname,
      avatarUrl
    );
    this.ensurePlayerInMap(
      this.allTimePlayers,
      userId,
      username,
      nickname,
      avatarUrl
    );
    this.saveToStorage();
    return r;
  }

  public recordSubmissionAttempt(
    userId: string,
    username: string,
    nickname?: string,
    avatarUrl?: string
  ) {
    const r = this.ensurePlayerInMap(
      this.roundPlayers,
      userId,
      username,
      nickname,
      avatarUrl
    );
    const t = this.ensurePlayerInMap(
      this.todayPlayers,
      userId,
      username,
      nickname,
      avatarUrl
    );
    const a = this.ensurePlayerInMap(
      this.allTimePlayers,
      userId,
      username,
      nickname,
      avatarUrl
    );
    r.totalSubmissions += 1;
    t.totalSubmissions += 1;
    a.totalSubmissions += 1;
  }

  public isWordEverDiscovered(word: string): boolean {
    return this.discoveredWordsEver.has(String(word || '').toLowerCase());
  }

  public recordValidWord(params: {
    userId: string;
    username: string;
    nickname?: string;
    avatarUrl?: string;
    word: string;
    points: number;
  }): { isNewPersonalHigh: boolean; roundRecord: PlayerRecord } {
    const { userId, username, nickname, avatarUrl, word, points } = params;
    const upperWord = String(word || '').toUpperCase();
    this.discoveredWordsEver.add(upperWord.toLowerCase());

    const r = this.ensurePlayerInMap(
      this.roundPlayers,
      userId,
      username,
      nickname,
      avatarUrl
    );
    const t = this.ensurePlayerInMap(
      this.todayPlayers,
      userId,
      username,
      nickname,
      avatarUrl
    );
    const a = this.ensurePlayerInMap(
      this.allTimePlayers,
      userId,
      username,
      nickname,
      avatarUrl
    );

    const isNewPersonalHigh = points > a.highestSingleWordScore;

    for (const rec of [r, t, a]) {
      rec.totalPoints += points;
      rec.validWordsCount += 1;
      if (upperWord.length > rec.longestWord.length) {
        rec.longestWord = upperWord;
      }
      if (points > rec.highestSingleWordScore) {
        rec.highestSingleWordScore = points;
      }
    }

    this.statistics.totalWordsDiscovered += 1;
    this.statistics.totalPointsScored += points;
    if (upperWord.length > (this.statistics.longestWordFound || '').length) {
      this.statistics.longestWordFound = upperWord;
    }

    this.saveToStorage();

    // Automatically apply score to website account if this TikTok @handle is linked in Player Profiles
    creditInteractiveScoreByTikTokHandle({
      tiktokUsername: username || nickname || userId,
      gameId: 'lexi',
      pointsEarned: points,
      reason: `Lexi word: ${upperWord}`,
    });

    return { isNewPersonalHigh, roundRecord: r };
  }

  public recordGiftContribution(params: {
    userId: string;
    username: string;
    nickname?: string;
    avatarUrl?: string;
    giftName: string;
    repeatCount: number;
    diamondValue: number;
    pointsAwarded: number;
  }) {
    const {
      userId,
      username,
      nickname,
      avatarUrl,
      giftName,
      repeatCount,
      diamondValue,
      pointsAwarded,
    } = params;
    const totalDiamonds = Math.max(1, diamondValue * repeatCount);

    const r = this.ensurePlayerInMap(
      this.roundPlayers,
      userId,
      username,
      nickname,
      avatarUrl
    );
    const t = this.ensurePlayerInMap(
      this.todayPlayers,
      userId,
      username,
      nickname,
      avatarUrl
    );
    const a = this.ensurePlayerInMap(
      this.allTimePlayers,
      userId,
      username,
      nickname,
      avatarUrl
    );

    for (const rec of [r, t, a]) {
      rec.giftsSentCount += repeatCount;
      rec.giftDiamondsTotal += totalDiamonds;
      rec.giftPointsContributed += pointsAwarded;
      rec.totalPoints += pointsAwarded;
    }

    let gifter = this.giftContributors.get(userId);
    if (!gifter) {
      gifter = {
        userId,
        username: username || userId,
        nickname: nickname || username || userId,
        avatarUrl,
        giftsSentCount: 0,
        giftDiamondsTotal: 0,
        giftPointsContributed: 0,
        lastGiftName: giftName,
        lastGiftAt: Date.now(),
      };
      this.giftContributors.set(userId, gifter);
    }
    gifter.giftsSentCount += repeatCount;
    gifter.giftDiamondsTotal += totalDiamonds;
    gifter.giftPointsContributed += pointsAwarded;
    gifter.lastGiftName = giftName;
    gifter.lastGiftAt = Date.now();

    this.statistics.totalGiftsReceived += repeatCount;
    this.statistics.totalPointsScored += pointsAwarded;
    this.saveToStorage();

    if (pointsAwarded > 0) {
      creditInteractiveScoreByTikTokHandle({
        tiktokUsername: username || nickname || userId,
        gameId: 'lexi',
        pointsEarned: pointsAwarded,
        reason: `Lexi gift: ${giftName}`,
      });
    }
  }

  public recordSocialContribution(params: {
    userId: string;
    username: string;
    nickname?: string;
    avatarUrl?: string;
    type: 'like' | 'follow' | 'share';
    count?: number;
    pointsAwarded?: number;
  }) {
    const {
      userId,
      username,
      nickname,
      avatarUrl,
      type,
      count = 1,
      pointsAwarded = 0,
    } = params;

    const r = this.ensurePlayerInMap(
      this.roundPlayers,
      userId,
      username,
      nickname,
      avatarUrl
    );
    const t = this.ensurePlayerInMap(
      this.todayPlayers,
      userId,
      username,
      nickname,
      avatarUrl
    );
    const a = this.ensurePlayerInMap(
      this.allTimePlayers,
      userId,
      username,
      nickname,
      avatarUrl
    );

    for (const rec of [r, t, a]) {
      if (type === 'like') {
        rec.likesContributed += count;
      }
      if (pointsAwarded > 0) {
        rec.totalPoints += pointsAwarded;
      }
    }

    if (type === 'like') this.statistics.totalLikesReceived += count;
    if (type === 'follow') this.statistics.totalFollowsReceived += count;
    if (type === 'share') this.statistics.totalSharesReceived += count;
    if (pointsAwarded > 0) {
      this.statistics.totalPointsScored += pointsAwarded;
      creditInteractiveScoreByTikTokHandle({
        tiktokUsername: username || nickname || userId,
        gameId: 'lexi',
        pointsEarned: pointsAwarded,
        reason: `Lexi ${type} bonus`,
      });
    }
    this.saveToStorage();
  }

  public recordRoundCompleted(params: {
    roundNumber: number;
    mode: string;
    score: number;
    targetScore: number;
    wordsFound: number;
    totalPossibleWords: number;
  }) {
    this.statistics.totalRoundsPlayed += 1;
    if (params.score > this.statistics.highestRoundScore) {
      this.statistics.highestRoundScore = params.score;
    }
    const topRound = this.getRoundLeaderboard(1)[0];
    this.statistics.history = [
      {
        ...params,
        topPlayer: topRound?.nickname || '—',
        endedAt: Date.now(),
      },
      ...(this.statistics.history || []),
    ].slice(0, 25);
    this.saveToStorage();
  }

  public resetRoundStats() {
    this.roundPlayers.clear();
  }

  public resetAllStats() {
    this.roundPlayers.clear();
    this.todayPlayers.clear();
    this.allTimePlayers.clear();
    this.giftContributors.clear();
    this.discoveredWordsEver.clear();
    this.statistics = {
      totalRoundsPlayed: 0,
      totalWordsDiscovered: 0,
      totalPointsScored: 0,
      highestRoundScore: 0,
      longestWordFound: '',
      totalGiftsReceived: 0,
      totalLikesReceived: 0,
      totalFollowsReceived: 0,
      totalSharesReceived: 0,
      history: [],
    };
    this.saveToStorage();
  }

  public removeUserFromLeaderboards(userOrId: string) {
    const clean = String(userOrId || '').trim().toLowerCase().replace(/^@/, '');
    if (!clean) return;
    for (const map of [
      this.roundPlayers,
      this.todayPlayers,
      this.allTimePlayers,
    ]) {
      for (const [key, val] of map.entries()) {
        if (
          key.toLowerCase() === clean ||
          val.username.toLowerCase().replace(/^@/, '') === clean ||
          val.nickname.toLowerCase() === clean
        ) {
          map.delete(key);
        }
      }
    }
    for (const [key, val] of this.giftContributors.entries()) {
      if (
        key.toLowerCase() === clean ||
        val.username.toLowerCase().replace(/^@/, '') === clean
      ) {
        this.giftContributors.delete(key);
      }
    }
    this.saveToStorage();
  }

  public getPlayerStats(userId: string): {
    round: PlayerRecord | null;
    today: PlayerRecord | null;
    allTime: PlayerRecord | null;
  } {
    return {
      round: this.roundPlayers.get(userId) || null,
      today: this.todayPlayers.get(userId) || null,
      allTime: this.allTimePlayers.get(userId) || null,
    };
  }

  public getRoundLeaderboard(limit = 50): PlayerRecord[] {
    return Array.from(this.roundPlayers.values())
      .sort(
        (a, b) =>
          b.totalPoints - a.totalPoints ||
          b.validWordsCount - a.validWordsCount
      )
      .slice(0, limit);
  }

  public getAllLeaderboards(): AllLeaderboards {
    const sortByPoints = (list: PlayerRecord[]) =>
      list
        .slice()
        .sort(
          (a, b) =>
            b.totalPoints - a.totalPoints ||
            b.validWordsCount - a.validWordsCount
        );

    const allTimeList = Array.from(this.allTimePlayers.values());
    const mostWords = allTimeList
      .slice()
      .sort(
        (a, b) =>
          b.validWordsCount - a.validWordsCount ||
          b.totalPoints - a.totalPoints
      )
      .slice(0, 25);

    const highScorers = allTimeList
      .slice()
      .sort(
        (a, b) =>
          b.highestSingleWordScore - a.highestSingleWordScore ||
          b.totalPoints - a.totalPoints
      )
      .slice(0, 25);

    const gifts = Array.from(this.giftContributors.values())
      .sort(
        (a, b) =>
          b.giftDiamondsTotal - a.giftDiamondsTotal ||
          b.giftPointsContributed - a.giftPointsContributed
      )
      .slice(0, 25);

    return {
      round: sortByPoints(Array.from(this.roundPlayers.values())).slice(0, 50),
      today: sortByPoints(Array.from(this.todayPlayers.values())).slice(0, 50),
      allTime: sortByPoints(allTimeList).slice(0, 50),
      gifts,
      mostWords,
      highScorers,
      participatingViewersCount: this.roundPlayers.size,
      statistics: this.statistics,
    };
  }
}

export const leaderboardManager = new LeaderboardManager();
