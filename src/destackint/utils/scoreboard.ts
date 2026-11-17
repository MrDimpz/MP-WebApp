import { RunningScoreboardPlayer } from '../types';

export function normalizePlayerKey(value: string): string {
  return String(value || '')
    .trim()
    .replace(/^@+/, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export function sortScoreboardPlayers(
  players: RunningScoreboardPlayer[]
): RunningScoreboardPlayer[] {
  return [...players].sort(
    (a, b) =>
      b.totalScore - a.totalScore ||
      b.wordsSolved - a.wordsSolved ||
      a.bestSpeedSeconds - b.bestSpeedSeconds
  );
}

/**
 * Ensures every player name / ID appears at most once on any scoreboard,
 * merging any duplicate entries cleanly while preserving stats and round wins.
 */
export function deduplicateScoreboardPlayers(
  players: RunningScoreboardPlayer[]
): RunningScoreboardPlayer[] {
  const result: RunningScoreboardPlayer[] = [];

  for (const player of players) {
    const idKey = normalizePlayerKey(player.id);
    const nameKey = normalizePlayerKey(player.nickname);

    const existingIdx = result.findIndex((existing) => {
      const exIdKey = normalizePlayerKey(existing.id);
      const exNameKey = normalizePlayerKey(existing.nickname);
      const idMatch = Boolean(
        idKey && exIdKey && idKey !== 'viewer' && exIdKey !== 'viewer' && idKey === exIdKey
      );
      const nameMatch = Boolean(nameKey && exNameKey && nameKey === exNameKey);
      return idMatch || nameMatch;
    });

    if (existingIdx === -1) {
      const canonicalId =
        idKey && idKey !== 'viewer' ? idKey : nameKey || `viewer_${result.length}`;
      result.push({
        ...player,
        id: canonicalId,
      });
    } else {
      const ex = result[existingIdx];
      const keepIncomingMeta = (player.updatedAt || 0) >= (ex.updatedAt || 0);
      const seenAnswers = new Set<string>();
      const mergedAnswers = [...(ex.answers || []), ...(player.answers || [])]
        .filter((ans) => {
          const k = `${ans.wordIndex}:${ans.word}:${ans.timestamp}`;
          if (seenAnswers.has(k)) return false;
          seenAnswers.add(k);
          return true;
        })
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 60);

      result[existingIdx] = {
        ...ex,
        id:
          normalizePlayerKey(ex.id) !== 'viewer'
            ? ex.id
            : normalizePlayerKey(player.id) !== 'viewer'
            ? player.id
            : ex.id,
        nickname: keepIncomingMeta ? player.nickname || ex.nickname : ex.nickname || player.nickname,
        profilePictureUrl: keepIncomingMeta
          ? player.profilePictureUrl || ex.profilePictureUrl
          : ex.profilePictureUrl || player.profilePictureUrl,
        totalScore: ex.totalScore + player.totalScore,
        wordsSolved: ex.wordsSolved + player.wordsSolved,
        bestSpeedSeconds: Math.min(ex.bestSpeedSeconds, player.bestSpeedSeconds),
        totalSpeedSeconds: ex.totalSpeedSeconds + player.totalSpeedSeconds,
        lastPoints: keepIncomingMeta ? player.lastPoints : ex.lastPoints,
        lastSolveTimeSeconds: keepIncomingMeta
          ? player.lastSolveTimeSeconds
          : ex.lastSolveTimeSeconds,
        lastWordIndex: keepIncomingMeta ? player.lastWordIndex : ex.lastWordIndex,
        firstPlaceCount: ex.firstPlaceCount + player.firstPlaceCount,
        roundsWon: (ex.roundsWon || 0) + (player.roundsWon || 0),
        answers: mergedAnswers,
        updatedAt: Math.max(ex.updatedAt || 0, player.updatedAt || 0),
      };
    }
  }

  return sortScoreboardPlayers(result);
}
