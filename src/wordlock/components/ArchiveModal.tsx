import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, Lock, Sparkles, X } from 'lucide-react';
import {
  ARCHIVE_DAYS_COUNT,
  DIFFICULTY_CONFIGS,
  DIFFICULTY_ORDER,
  DifficultyId,
  getDailyNumberForDate,
  getProgressKey,
  getRecentDateKeys,
  parseDateKey,
} from '../game/puzzleEngine';
import type { WordlockDayRecord } from '../utils/storage';

interface ArchiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  todayDateKey: string;
  activeDateKey: string;
  activeDifficulty: DifficultyId;
  activeMode: 'daily' | 'unlimited';
  progressMap: Record<string, WordlockDayRecord>;
  onSelectArchiveDay: (dateKey: string, difficulty: DifficultyId) => void;
  onStartUnlimited: (difficulty: DifficultyId) => void;
  darkMode: boolean;
}

export const ArchiveModal: React.FC<ArchiveModalProps> = ({
  isOpen,
  onClose,
  todayDateKey,
  activeDateKey,
  activeDifficulty,
  activeMode,
  progressMap,
  onSelectArchiveDay,
  onStartUnlimited,
  darkMode,
}) => {
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyId>(activeDifficulty);
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>('ALL');

  useEffect(() => {
    if (isOpen) {
      setSelectedDifficulty(activeDifficulty);
    }
  }, [isOpen, activeDifficulty]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const dateKeys = useMemo(
    () => getRecentDateKeys(ARCHIVE_DAYS_COUNT, todayDateKey),
    [todayDateKey]
  );

  const monthGroups = useMemo(() => {
    const groups: { monthKey: string; label: string; dates: string[] }[] = [];
    const byKey = new Map<string, { monthKey: string; label: string; dates: string[] }>();
    for (const dk of dateKeys) {
      const dt = parseDateKey(dk);
      const monthKey = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
      const label = dt.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
      let group = byKey.get(monthKey);
      if (!group) {
        group = { monthKey, label, dates: [] };
        byKey.set(monthKey, group);
        groups.push(group);
      }
      group.dates.push(dk);
    }
    return groups;
  }, [dateKeys]);

  const solvedCount = useMemo(() => {
    return dateKeys.reduce((acc, dk) => {
      const rec = progressMap[getProgressKey(dk, selectedDifficulty)];
      return acc + (rec?.status === 'won' ? 1 : 0);
    }, 0);
  }, [dateKeys, progressMap, selectedDifficulty]);

  const visibleGroups = useMemo(() => {
    if (selectedMonthKey === 'ALL') return monthGroups;
    return monthGroups.filter((g) => g.monthKey === selectedMonthKey);
  }, [monthGroups, selectedMonthKey]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#12031E]/82"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wordlock-archive-title"
      onClick={onClose}
    >
      <div
        className={`relative w-full max-w-3xl max-h-[90dvh] flex flex-col rounded-2xl border-2 shadow-[0_24px_80px_rgba(0,0,0,0.72)] overflow-hidden ${
          darkMode
            ? 'bg-[#1D0731] border-[#D4A437]/50 text-[#F7F3FB]'
            : 'bg-[#FFFFFF] border-[#D5C0EE] text-[#2B0938]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-1 w-full bg-gradient-to-r from-[#2B0938] via-[#F6C915] to-[#2B0938]" />

        {/* Header */}
        <div
          className={`flex items-center justify-between gap-3 px-5 py-4 border-b ${
            darkMode ? 'border-[#D4A437]/25 bg-[#250A3E]' : 'border-[#E5D7F6] bg-[#F7F1FC]'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 ${
                darkMode
                  ? 'bg-[#160524] border-[#D4A437]/40 text-[#F6C915]'
                  : 'bg-white border-[#D5C0EE] text-[#2B0938]'
              }`}
            >
              <CalendarDays className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div
                className={`text-[10px] font-mono uppercase tracking-[0.16em] font-bold ${
                  darkMode ? 'text-[#F6C915]' : 'text-[#8F6500]'
                }`}
              >
                6-Month Vault Archive · {ARCHIVE_DAYS_COUNT} Daily Locks
              </div>
              <h2
                id="wordlock-archive-title"
                className="text-lg sm:text-xl font-extrabold tracking-tight"
              >
                WORDLOCK Daily Archive
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close archive"
            className={`w-8 h-8 rounded-lg flex items-center justify-center border shrink-0 cursor-pointer transition-colors ${
              darkMode
                ? 'border-[#D4A437]/30 bg-[#1B052D] text-[#E7DAF2] hover:border-[#F6C915]'
                : 'border-[#D5C0EE] bg-white text-[#4A1C6E] hover:border-[#2B0938]'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Difficulty Selector + Unlimited CTA */}
        <div
          className={`px-5 py-3 border-b flex flex-wrap items-center justify-between gap-2.5 ${
            darkMode ? 'border-[#D4A437]/20 bg-[#180629]' : 'border-[#EAE0F7] bg-[#FAF6FE]'
          }`}
        >
          <div className="flex flex-wrap items-center gap-1.5">
            {DIFFICULTY_ORDER.map((diffId) => {
              const cfg = DIFFICULTY_CONFIGS[diffId];
              const isSelected = selectedDifficulty === diffId;
              return (
                <button
                  key={diffId}
                  type="button"
                  onClick={() => setSelectedDifficulty(diffId)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[#F6C915] text-[#1D0830] shadow-xs'
                      : darkMode
                        ? 'bg-[#270A42] text-[#D6CBE2] hover:bg-[#351058]'
                        : 'bg-white border border-[#DCCBF2] text-[#4A1C6E] hover:bg-[#F0E5FB]'
                  }`}
                >
                  {cfg.label}{' '}
                  <span className="opacity-75 font-mono text-[10px]">({cfg.rowCount}R)</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2.5">
            <span
              className={`text-xs font-mono font-bold ${
                darkMode ? 'text-emerald-400' : 'text-emerald-700'
              }`}
            >
              {solvedCount}/{ARCHIVE_DAYS_COUNT} Breached
            </span>
            <button
              type="button"
              onClick={() => {
                onStartUnlimited(selectedDifficulty);
                onClose();
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold border transition-colors cursor-pointer ${
                darkMode
                  ? 'border-[#F6C915]/50 bg-[#2C0C4A] text-[#F6C915] hover:bg-[#3B1261]'
                  : 'border-[#2B0938] bg-[#2B0938] text-[#F6C915] hover:opacity-90'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Unlimited Lock
            </button>
          </div>
        </div>

        {/* Month Filter Bar */}
        <div
          className={`px-5 py-2.5 border-b flex items-center gap-1.5 overflow-x-auto wordlock-scroll ${
            darkMode ? 'border-[#D4A437]/15 bg-[#1D0731]' : 'border-[#EFE6FA] bg-white'
          }`}
        >
          <button
            type="button"
            onClick={() => setSelectedMonthKey('ALL')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-bold whitespace-nowrap cursor-pointer transition-colors ${
              selectedMonthKey === 'ALL'
                ? darkMode
                  ? 'bg-[#F6C915]/20 text-[#F6C915] border border-[#F6C915]/50'
                  : 'bg-[#2B0938] text-[#F6C915]'
                : darkMode
                  ? 'text-[#C2B0D8] hover:bg-[#2A0B46]'
                  : 'text-[#5A3E73] hover:bg-[#F3EBFC]'
            }`}
          >
            All 6 Months
          </button>
          {monthGroups.map((group) => (
            <button
              key={group.monthKey}
              type="button"
              onClick={() => setSelectedMonthKey(group.monthKey)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold whitespace-nowrap cursor-pointer transition-colors ${
                selectedMonthKey === group.monthKey
                  ? darkMode
                    ? 'bg-[#F6C915]/20 text-[#F6C915] border border-[#F6C915]/50'
                    : 'bg-[#2B0938] text-[#F6C915]'
                  : darkMode
                    ? 'text-[#C2B0D8] hover:bg-[#2A0B46]'
                    : 'text-[#5A3E73] hover:bg-[#F3EBFC]'
              }`}
            >
              {group.label}
            </button>
          ))}
        </div>

        {/* Archive Days Grid */}
        <div className="wordlock-scroll overflow-y-auto px-5 py-4 space-y-5">
          {visibleGroups.map((group) => (
            <div key={group.monthKey} className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h3
                  className={`text-xs font-mono uppercase tracking-[0.16em] font-bold ${
                    darkMode ? 'text-[#F6C915]' : 'text-[#8F6500]'
                  }`}
                >
                  {group.label}
                </h3>
                <span
                  className={`text-[11px] font-mono ${
                    darkMode ? 'text-[#B8A5D1]' : 'text-[#6D4D8A]'
                  }`}
                >
                  {group.dates.length} locks
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {group.dates.map((dk) => {
                  const dt = parseDateKey(dk);
                  const dailyNum = getDailyNumberForDate(dk);
                  const rec = progressMap[getProgressKey(dk, selectedDifficulty)];
                  const isToday = dk === todayDateKey;
                  const isActive =
                    activeMode === 'daily' &&
                    activeDateKey === dk &&
                    activeDifficulty === selectedDifficulty;
                  const isWon = rec?.status === 'won';
                  const isLost = rec?.status === 'lost';

                  return (
                    <button
                      key={dk}
                      type="button"
                      onClick={() => {
                        onSelectArchiveDay(dk, selectedDifficulty);
                        onClose();
                      }}
                      className={`text-left rounded-xl border p-2.5 transition-all cursor-pointer ${
                        isActive
                          ? darkMode
                            ? 'bg-[#36115B] border-[#F6C915] ring-1 ring-[#F6C915]/50'
                            : 'bg-[#F0E2FD] border-[#2B0938] ring-1 ring-[#2B0938]/30'
                          : isWon
                            ? darkMode
                              ? 'bg-emerald-950/35 border-emerald-500/40 hover:border-emerald-400'
                              : 'bg-emerald-50 border-emerald-400/60 hover:border-emerald-500'
                            : darkMode
                              ? 'bg-[#24093B]/75 border-[#D4A437]/20 hover:border-[#F6C915]/55 hover:bg-[#2E0D4D]'
                              : 'bg-white border-[#DFCEF4] hover:border-[#2B0938]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-mono-tabular text-[11px] font-bold opacity-80">
                          #{dailyNum}
                        </span>
                        {isToday ? (
                          <span className="px-1.5 py-0.5 rounded bg-[#F6C915] text-[#1D0830] text-[9px] font-mono uppercase font-extrabold">
                            Today
                          </span>
                        ) : isWon ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        ) : isLost ? (
                          <Lock className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        ) : null}
                      </div>

                      <div className="text-xs font-bold mt-1">
                        {dt.toLocaleDateString('en-GB', {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short',
                        })}
                      </div>

                      <div
                        className={`text-[10px] font-mono mt-1 ${
                          isWon
                            ? darkMode
                              ? 'text-emerald-300'
                              : 'text-emerald-700'
                            : isLost
                              ? 'text-rose-400'
                              : darkMode
                                ? 'text-[#B5A0CF]'
                                : 'text-[#745691]'
                        }`}
                      >
                        {isWon && rec?.bestClicks != null
                          ? `Solved · ${rec.bestClicks}/${rec.maxClicks} clicks`
                          : isLost
                            ? 'Locked · Retry'
                            : 'Play Lock'}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
