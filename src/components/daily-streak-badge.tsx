import React from 'react';
import { Flame } from 'lucide-react';

export type DailyStreakBadgeVariant =
  | 'gold'
  | 'cyan'
  | 'emerald'
  | 'amber-dark'
  | 'light'
  | 'slate';

interface DailyStreakBadgeProps {
  streak: number;
  solvedToday: boolean;
  variant?: DailyStreakBadgeVariant;
  compact?: boolean;
  className?: string;
}

const VARIANT_CLASSES: Record<DailyStreakBadgeVariant, string> = {
  gold: 'bg-amber-400/15 border-amber-400/50 text-amber-300',
  cyan: 'bg-[#19e4ff]/15 border-[#19e4ff]/55 text-[#8aefff]',
  emerald: 'bg-emerald-500/15 border-emerald-400/50 text-emerald-300',
  'amber-dark': 'bg-[#2d0a3d] border-[#f5b82e]/60 text-[#f5b82e]',
  light: 'bg-amber-50 dark:bg-amber-500/15 border-amber-300 dark:border-amber-400/45 text-amber-800 dark:text-amber-300',
  slate: 'bg-slate-900 border-amber-500/50 text-amber-300',
};

const ICON_CLASSES: Record<DailyStreakBadgeVariant, string> = {
  gold: 'text-amber-400 fill-amber-400/80',
  cyan: 'text-[#ffe536] fill-[#ffe536]/80',
  emerald: 'text-emerald-400 fill-emerald-400/80',
  'amber-dark': 'text-[#f5b82e] fill-[#f5b82e]/85',
  light: 'text-amber-500 fill-amber-400/80',
  slate: 'text-amber-400 fill-amber-400/80',
};

export const DailyStreakBadge: React.FC<DailyStreakBadgeProps> = ({
  streak,
  solvedToday,
  variant = 'gold',
  compact = false,
  className = '',
}) => {
  if (!solvedToday || streak <= 0) return null;

  const dayLabel = streak === 1 ? '1 day' : `${streak} days`;

  return (
    <span
      className={`inline-flex items-center gap-1.5 border font-bold whitespace-nowrap shrink-0 select-none shadow-xs ${
        compact ? 'px-2 py-1 rounded-lg text-[11px]' : 'px-2.5 py-1 rounded-xl text-xs'
      } ${VARIANT_CLASSES[variant]} ${className}`}
      title={`Daily Streak: ${dayLabel} (today's puzzle solved)`}
      aria-label={`Daily Streak: ${streak}`}
    >
      <Flame className={`${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} shrink-0 ${ICON_CLASSES[variant]}`} />
      <span>Daily Streak</span>
      <span className="font-mono font-black tabular-nums">{streak}</span>
    </span>
  );
};
