import React, { useEffect, useState } from 'react';
import { Trophy } from 'lucide-react';
import {
  getInteractiveWinCount,
  subscribeInteractiveWinTally,
} from '@/lib/interactive-win-tally';

interface WinTallyBadgeProps {
  gameId: string;
  winnerName: string;
  /** Optional explicit count override (e.g. synced via overlay snapshot) */
  wins?: number;
  /** Compact inline pill for multi-winner lists */
  compact?: boolean;
  /** Optional label prefix such as "Total Wins" */
  label?: string;
  className?: string;
}

export const WinTallyBadge: React.FC<WinTallyBadgeProps> = ({
  gameId,
  winnerName,
  wins,
  compact = false,
  label,
  className = '',
}) => {
  const [storedWins, setStoredWins] = useState<number>(() =>
    wins !== undefined ? wins : getInteractiveWinCount(gameId, winnerName)
  );

  useEffect(() => {
    if (wins !== undefined) {
      setStoredWins(wins);
      return;
    }
    const refresh = () => setStoredWins(getInteractiveWinCount(gameId, winnerName));
    refresh();
    return subscribeInteractiveWinTally(gameId, refresh);
  }, [gameId, winnerName, wins]);

  const count = Math.max(1, wins !== undefined ? wins : storedWins || 1);
  const winText = count === 1 ? '1 Win' : `${count} Wins`;

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black tracking-wide uppercase bg-amber-500/20 text-amber-300 border border-amber-400/40 whitespace-nowrap shrink-0 ${className}`}
        title={`Session win tally: ${winText}`}
      >
        <Trophy className="w-3 h-3 text-amber-400 shrink-0" />
        <span>{winText}</span>
      </span>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/20 border border-amber-400/45 text-amber-200 shadow-[0_0_16px_rgba(245,158,11,0.2)] ${className}`}
    >
      <Trophy className="w-4 h-4 text-amber-400 shrink-0" />
      <span className="text-xs font-black uppercase tracking-wider text-amber-100">
        {label ? `${label}: ` : 'Win Tally: '}
        <span className="text-amber-300">{winText}</span>
      </span>
    </div>
  );
};
