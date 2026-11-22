import { useMemo, useState } from 'react';
import { Award, Clock, Puzzle, Trophy } from 'lucide-react';
import type { LadderMode, LeaderboardEntry } from '../shared/types';
import { formatDuration, formatModeLabel, formatRelativeTime } from '../utils/format';

interface LeaderboardViewProps {
  entries: LeaderboardEntry[];
}

export function LeaderboardView({ entries }: LeaderboardViewProps) {
  const [filter, setFilter] = useState<'all' | LadderMode>('all');

  const filtered = useMemo(() => {
    if (filter === 'all') return entries;
    return entries.filter((e) => e.mode === filter);
  }, [entries, filter]);

  const filters: Array<{ id: 'all' | LadderMode; label: string }> = [
    { id: 'all', label: 'All Modes' },
    { id: 'classic', label: 'Classic' },
    { id: 'dual', label: 'Dual Ladder' },
    { id: 'quad', label: 'Quad Hunt' },
  ];

  return (
    <section className="mx-auto w-full max-w-4xl space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-white">
            Word Hunt Extreme Leaderboard
          </h2>
          <p className="mt-1 text-sm text-[#D4C0EC]">
            Top live round scores across Classic, Dual Ladder, and Quad Hunt.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-[#D4A437]/30 bg-[#1B052D] p-1">
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                filter === f.id
                  ? 'bg-[#F6C915] text-[#1D0830]'
                  : 'text-[#D4C0EC] hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-[#D4A437]/30 bg-[#210736]/90 p-10 text-center">
          <Trophy className="mx-auto h-10 w-10 text-[#F6C915]/70" aria-hidden="true" />
          <p className="mt-3 text-base font-bold text-white">
            No completed rounds yet
          </p>
          <p className="mt-1 text-sm text-[#C8B2E4]">
            Finish a live round in {filter === 'all' ? 'any mode' : formatModeLabel(filter)} to claim the #1 spot.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[#D4A437]/30 bg-[#210736]/95 shadow-xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-[11px] font-bold uppercase tracking-wider text-[#C8B2E4]">
                <th className="py-3.5 pl-5 pr-3 w-14">Rank</th>
                <th className="py-3.5 px-3">Player</th>
                <th className="py-3.5 px-3">Mode</th>
                <th className="py-3.5 px-3 text-right">Score</th>
                <th className="py-3.5 px-3 text-right">Pieces</th>
                <th className="py-3.5 px-3 text-right">Guesses</th>
                <th className="py-3.5 pl-3 pr-5 text-right">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/8 text-sm">
              {filtered.map((entry, idx) => (
                <tr
                  key={entry.id}
                  className={
                    idx === 0
                      ? 'bg-[#F6C915]/10'
                      : 'hover:bg-white/[0.03] transition-colors'
                  }
                >
                  <td className="py-3 pl-5 pr-3 font-mono text-xs font-extrabold tabular-nums">
                    {idx < 3 ? (
                      <span
                        className={
                          idx === 0
                            ? 'text-[#F6C915]'
                            : idx === 1
                            ? 'text-slate-200'
                            : 'text-amber-500'
                        }
                      >
                        #{idx + 1}
                      </span>
                    ) : (
                      <span className="text-[#B8A0D6]">#{idx + 1}</span>
                    )}
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2 min-w-0">
                      {idx === 0 && (
                        <Award
                          className="h-4 w-4 text-[#F6C915] shrink-0"
                          aria-hidden="true"
                        />
                      )}
                      <span className="font-bold text-white truncate max-w-[180px]">
                        {entry.playerName}
                      </span>
                      <span className="text-[11px] text-[#B399D6] hidden sm:inline">
                        {formatRelativeTime(entry.createdAt)}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-xs font-semibold text-[#D9C7EE] whitespace-nowrap">
                    {formatModeLabel(entry.mode)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-extrabold tabular-nums text-white">
                    {entry.score.toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-xs font-bold tabular-nums text-[#F6C915]">
                    <span className="inline-flex items-center gap-1 justify-end">
                      <Puzzle className="h-3 w-3" aria-hidden="true" />
                      +{entry.pieces}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-xs tabular-nums text-[#D4C0EC]">
                    {entry.guesses}
                  </td>
                  <td className="py-3 pl-3 pr-5 text-right font-mono text-xs tabular-nums text-[#D4C0EC]">
                    <span className="inline-flex items-center gap-1 justify-end">
                      <Clock className="h-3 w-3 text-[#B399D6]" aria-hidden="true" />
                      {formatDuration(entry.durationMs)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
