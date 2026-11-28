import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { CrosswordPuzzle, PlacedWord } from '../utils/crosswordGenerator';
import { CheckCircle2, Compass, PanelRightClose, Search, Sparkles, X } from 'lucide-react';

const ESTIMATED_CLUE_ROW_HEIGHT = 76;
const VIRTUAL_OVERSCAN = 12;
const VIRTUALIZE_THRESHOLD = 250;

interface AtlasSidebarProps {
  puzzle: CrosswordPuzzle;
  mode: 'classic' | 'quest';
  onChangeMode: (mode: 'classic' | 'quest') => void;
  activeWord: PlacedWord | null;
  solvedWordIds: Set<string>;
  selectedSectorFilter: number | 'all';
  onChangeSectorFilter: (sectorId: number | 'all') => void;
  onSelectWord: (word: PlacedWord) => void;
  onSolveCurrentSectorDemo: (sectorId: number) => void;
  isDesktopOpen?: boolean;
  onToggleDesktop?: () => void;
  isOpenOnMobile?: boolean;
  onCloseMobile?: () => void;
}

export const AtlasSidebar: React.FC<AtlasSidebarProps> = ({
  puzzle,
  mode,
  onChangeMode,
  activeWord,
  solvedWordIds,
  selectedSectorFilter,
  onChangeSectorFilter,
  onSelectWord,
  onSolveCurrentSectorDemo,
  isDesktopOpen = true,
  onToggleDesktop,
  isOpenOnMobile = false,
  onCloseMobile,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [directionFilter, setDirectionFilter] = useState<'all' | 'across' | 'down' | 'cryptic' | 'unsolved'>('all');
  const [selectedQuestId, setSelectedQuestId] = useState<number>(0);

  // Virtualized scroll state for Classic Mode clue list
  const clueScrollRef = useRef<HTMLDivElement | null>(null);
  const rowHeightsRef = useRef<Map<string, number>>(new Map());
  const measureRafRef = useRef<number | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(640);
  const [measureVersion, setMeasureVersion] = useState(0);

  // Filter clues for Classic Mode
  const filteredWords = useMemo(() => {
    const q = deferredSearchQuery.trim().toLowerCase();
    return puzzle.words.filter((w) => {
      if (selectedSectorFilter !== 'all' && w.sectorId !== selectedSectorFilter) {
        return false;
      }
      if (directionFilter === 'across' && w.direction !== 'across') return false;
      if (directionFilter === 'down' && w.direction !== 'down') return false;
      if (directionFilter === 'cryptic' && !w.isCryptic) return false;
      if (directionFilter === 'unsolved' && solvedWordIds.has(w.id)) return false;

      if (q) {
        const matchNum = String(w.number).includes(q);
        const matchClue = w.clue.toLowerCase().includes(q);
        const matchCat = w.category.toLowerCase().includes(q);
        return matchNum || matchClue || matchCat;
      }
      return true;
    });
  }, [puzzle.words, selectedSectorFilter, directionFilter, solvedWordIds, deferredSearchQuery]);

  // Reset scroll position when filter criteria or puzzle scale changes
  useEffect(() => {
    if (clueScrollRef.current) {
      clueScrollRef.current.scrollTop = 0;
    }
    setScrollTop(0);
  }, [puzzle.scale, selectedSectorFilter, directionFilter, deferredSearchQuery]);

  // Track clue list container height for accurate virtualization
  useEffect(() => {
    const el = clueScrollRef.current;
    if (!el || mode !== 'classic') return;

    const updateHeight = () => {
      if (el.clientHeight > 0) {
        setViewportHeight(el.clientHeight);
      }
    };
    updateHeight();

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(updateHeight);
      ro.observe(el);
      return () => ro.disconnect();
    }
  }, [mode, isDesktopOpen, isOpenOnMobile]);

  useEffect(() => {
    return () => {
      if (measureRafRef.current !== null) {
        cancelAnimationFrame(measureRafRef.current);
      }
    };
  }, []);

  const handleClueScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  const measureRowHeight = useCallback((wordId: string, node: HTMLButtonElement | null) => {
    if (!node) return;
    const h = node.offsetHeight;
    if (h <= 0) return;
    const prev = rowHeightsRef.current.get(wordId);
    if (prev === undefined || Math.abs(prev - h) > 1) {
      rowHeightsRef.current.set(wordId, h);
      if (measureRafRef.current === null) {
        measureRafRef.current = requestAnimationFrame(() => {
          measureRafRef.current = null;
          setMeasureVersion((v) => v + 1);
        });
      }
    }
  }, []);

  const shouldVirtualize = filteredWords.length > VIRTUALIZE_THRESHOLD;

  // Prefix sum of row offsets for instant binary-search virtualization across all 4,200+ clues
  const prefixOffsets = useMemo(() => {
    if (!shouldVirtualize) return null;
    const count = filteredWords.length;
    const offsets = new Float64Array(count + 1);
    const heights = rowHeightsRef.current;
    for (let i = 0; i < count; i++) {
      offsets[i + 1] = offsets[i] + (heights.get(filteredWords[i].id) ?? ESTIMATED_CLUE_ROW_HEIGHT);
    }
    return offsets;
  }, [filteredWords, shouldVirtualize, measureVersion]);

  const { visibleClueList, topSpacerHeight, bottomSpacerHeight } = useMemo(() => {
    if (!shouldVirtualize || !prefixOffsets) {
      return {
        visibleClueList: filteredWords,
        topSpacerHeight: 0,
        bottomSpacerHeight: 0,
      };
    }

    const count = filteredWords.length;
    const totalHeight = prefixOffsets[count];

    // Binary search for first item whose bottom >= scrollTop
    let lo = 0;
    let hi = count;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (prefixOffsets[mid + 1] < scrollTop) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    const startIdx = Math.max(0, lo - VIRTUAL_OVERSCAN);

    // Binary search for first item whose top > scrollTop + viewportHeight
    const viewBottom = scrollTop + viewportHeight;
    lo = startIdx;
    hi = count;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (prefixOffsets[mid] <= viewBottom) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    const endIdx = Math.min(count, lo + VIRTUAL_OVERSCAN);

    return {
      visibleClueList: filteredWords.slice(startIdx, endIdx),
      topSpacerHeight: prefixOffsets[startIdx],
      bottomSpacerHeight: Math.max(0, totalHeight - prefixOffsets[endIdx]),
    };
  }, [filteredWords, shouldVirtualize, prefixOffsets, scrollTop, viewportHeight]);

  const currentQuest = puzzle.quests[selectedQuestId] || puzzle.quests[0];

  const handleWordClick = (w: PlacedWord) => {
    onSelectWord(w);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenOnMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/75 z-40 lg:hidden"
        />
      )}

      <aside
        className={`${
          isOpenOnMobile
            ? 'fixed inset-y-0 right-0 z-50 flex w-full max-w-sm shadow-2xl'
            : isDesktopOpen
            ? 'hidden lg:flex lg:w-80 xl:w-96'
            : 'hidden'
        } h-full bg-white/95 dark:bg-[#190529] border-l border-purple-200 dark:border-purple-900/60 flex-col shrink-0 select-none text-[#2B0938] dark:text-[#F5F3F7]`}
      >
        {/* Mode Switcher Tabs + Collapse / Mobile Close Controls */}
        <div className="p-3 border-b border-purple-200/80 dark:border-purple-900/60 flex items-center gap-2">
          <div className="grid grid-cols-2 gap-1 p-1 bg-purple-100/80 dark:bg-[#11031A] rounded-lg border border-purple-200 dark:border-purple-800/70 flex-1">
            <button
              type="button"
              onClick={() => onChangeMode('quest')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                mode === 'quest'
                  ? 'bg-[#F6C915] text-[#1D0830] shadow-xs'
                  : 'text-[#4a1259] dark:text-purple-200 hover:bg-white/60 dark:hover:bg-purple-900/40'
              }`}
            >
              Quest Mode ({puzzle.quests.length})
            </button>
            <button
              type="button"
              onClick={() => onChangeMode('classic')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                mode === 'classic'
                  ? 'bg-[#F6C915] text-[#1D0830] shadow-xs'
                  : 'text-[#4a1259] dark:text-purple-200 hover:bg-white/60 dark:hover:bg-purple-900/40'
              }`}
            >
              Classic ({puzzle.words.length.toLocaleString()})
            </button>
          </div>

          {onToggleDesktop && (
            <button
              type="button"
              onClick={onToggleDesktop}
              aria-label="Hide Side Clue Bar"
              title="Pop out / Hide Side Clue Bar"
              className="hidden lg:inline-flex p-2 text-[#4a1259] dark:text-purple-300 hover:text-[#2B0938] dark:hover:text-white bg-purple-100/70 dark:bg-[#240938] hover:bg-purple-200/80 dark:hover:bg-purple-900/70 border border-purple-200 dark:border-purple-800/70 rounded-lg transition-colors cursor-pointer shrink-0"
            >
              <PanelRightClose className="w-4 h-4" />
            </button>
          )}

          {onCloseMobile && (
            <button
              type="button"
              onClick={onCloseMobile}
              aria-label="Close Clues Drawer"
              className="lg:hidden p-2 text-[#4a1259] dark:text-purple-300 hover:text-[#2B0938] dark:hover:text-white bg-purple-100/70 dark:bg-[#240938] border border-purple-200 dark:border-purple-800/70 rounded-lg cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* QUEST MODE VIEW */}
        {mode === 'quest' ? (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Quest Selector Dropdown & Sector Progress */}
            <div className="p-3.5 border-b border-purple-200/80 dark:border-purple-900/60 space-y-3 bg-purple-50/70 dark:bg-[#220735]/60">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="quest-select" className="text-xs font-semibold text-[#581c6b] dark:text-purple-300">
                  Active Expedition Quest
                </label>
                <span className="text-xs font-mono-tabular font-bold text-amber-600 dark:text-[#F6C915]">
                  {puzzle.quests.filter((q) => q.wordIds.every((id) => solvedWordIds.has(id))).length} / {puzzle.quests.length} Completed
                </span>
              </div>

              <select
                id="quest-select"
                value={selectedQuestId}
                onChange={(e) => setSelectedQuestId(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs font-semibold bg-white dark:bg-[#11031A] border border-purple-300 dark:border-purple-700/70 rounded-lg text-[#2B0938] dark:text-white focus:outline-none focus:border-[#F6C915] cursor-pointer"
              >
                {puzzle.quests.map((q, idx) => {
                  const doneCount = q.wordIds.filter((id) => solvedWordIds.has(id)).length;
                  const isComplete = doneCount === q.wordIds.length && q.wordIds.length > 0;
                  return (
                    <option key={q.id} value={idx}>
                      {isComplete ? '✓ ' : ''}
                      {q.subtitle} — {q.title} ({doneCount}/{q.wordIds.length})
                    </option>
                  );
                })}
              </select>

              {currentQuest && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-[#3b0d47] dark:text-white">{currentQuest.title}</h3>
                    <button
                      type="button"
                      onClick={() => onSolveCurrentSectorDemo(currentQuest.sectorId)}
                      title="Auto-complete this quest's clues"
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-amber-700 dark:text-[#F6C915] hover:bg-amber-500/20 bg-amber-500/10 border border-amber-500/35 rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Complete Quest</span>
                    </button>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-purple-200/80 leading-relaxed">
                    {currentQuest.description}
                  </p>
                </div>
              )}
            </div>

            {/* Quest Clue Steps List */}
            <div className="flex-1 overflow-y-auto divide-y divide-purple-200/60 dark:divide-purple-900/50 custom-scrollbar">
              {currentQuest?.wordIds.map((wordId, idx) => {
                const w = puzzle.wordMap[wordId];
                if (!w) return null;
                const isSolved = solvedWordIds.has(w.id);
                const isCurrent = activeWord?.id === w.id;

                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => handleWordClick(w)}
                    className={`w-full text-left p-3.5 transition-colors cursor-pointer flex items-start gap-3 ${
                      isCurrent
                        ? 'bg-amber-400/20 dark:bg-[#F6C915]/15 text-[#2B0938] dark:text-white'
                        : isSolved
                        ? 'bg-emerald-50/70 dark:bg-emerald-950/25 text-slate-500 dark:text-purple-300/60 hover:bg-purple-50 dark:hover:bg-purple-900/30'
                        : 'hover:bg-purple-50/80 dark:hover:bg-purple-900/30 text-[#2B0938] dark:text-purple-100'
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      {isSolved ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <span className="inline-flex items-center justify-center w-4 h-4 text-[11px] font-mono-tabular font-bold text-amber-600 dark:text-[#F6C915]">
                          {idx + 1}.
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-2 text-xs font-mono-tabular text-slate-500 dark:text-purple-300/80">
                        <span>
                          {w.number} {w.direction === 'across' ? 'Across' : 'Down'} · {w.category}
                        </span>
                        <span>R{w.row + 1}:C{w.col + 1}</span>
                      </div>
                      <p className={`text-xs leading-relaxed ${isSolved ? 'line-through opacity-70' : 'font-medium'}`}>
                        {w.clue}
                      </p>
                      {isSolved && (
                        <div className="text-[11px] font-mono-tabular font-bold text-emerald-600 dark:text-emerald-400 tracking-wider">
                          {w.word}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          /* CLASSIC CLUES VIEW */
          <div className="flex-1 flex flex-col min-h-0">
            {/* Search & Sector Filter Controls */}
            <div className="p-3 border-b border-purple-200/80 dark:border-purple-900/60 space-y-2.5 bg-purple-50/70 dark:bg-[#220735]/60">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-purple-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search clue number, keyword, or topic..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-[#11031A] border border-purple-300 dark:border-purple-700/70 rounded-lg text-[#2B0938] dark:text-white placeholder-slate-400 dark:placeholder-purple-400/70 focus:outline-none focus:border-[#F6C915]"
                />
              </div>

              <div className="flex items-center gap-2">
                <select
                  aria-label="Filter by Cartographic Sector"
                  value={selectedSectorFilter}
                  onChange={(e) =>
                    onChangeSectorFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))
                  }
                  className="flex-1 px-2.5 py-1.5 text-xs bg-white dark:bg-[#11031A] border border-purple-300 dark:border-purple-700/70 rounded-lg text-[#2B0938] dark:text-white focus:outline-none focus:border-[#F6C915] cursor-pointer"
                >
                  <option value="all">All Sectors ({puzzle.words.length.toLocaleString()} Clues)</option>
                  {puzzle.sectors.map((sec) => (
                    <option key={sec.id} value={sec.id}>
                      {sec.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center gap-1 p-1 bg-purple-100/80 dark:bg-[#11031A] rounded-lg border border-purple-200 dark:border-purple-800/70 overflow-x-auto">
                {(['all', 'across', 'down', 'cryptic', 'unsolved'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setDirectionFilter(f)}
                    className={`px-2 py-1 text-[11px] font-bold rounded transition-colors cursor-pointer capitalize whitespace-nowrap shrink-0 ${
                      directionFilter === f
                        ? 'bg-[#3b0d47] dark:bg-[#F6C915] text-white dark:text-[#1D0830]'
                        : 'text-[#581c6b] dark:text-purple-300 hover:bg-white/60 dark:hover:bg-purple-900/40'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between text-[11px] font-mono-tabular text-slate-500 dark:text-purple-300/80 px-0.5">
                <span>
                  Showing all {filteredWords.length.toLocaleString()}{' '}
                  {filteredWords.length === 1 ? 'clue' : 'clues'}
                </span>
                {filteredWords.length > 0 && (
                  <span>
                    #{filteredWords[0].number} – #{filteredWords[filteredWords.length - 1].number}
                  </span>
                )}
              </div>
            </div>

            {/* Virtualized Full Clue List (all matching clues scrollable) */}
            <div
              ref={clueScrollRef}
              onScroll={handleClueScroll}
              className="flex-1 overflow-y-auto custom-scrollbar"
            >
              {filteredWords.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500 dark:text-purple-300/70 space-y-2">
                  <Compass className="w-6 h-6 mx-auto opacity-60" />
                  <p>No clues match your current filter.</p>
                </div>
              ) : (
                <div>
                  {topSpacerHeight > 0 && (
                    <div aria-hidden="true" style={{ height: topSpacerHeight }} />
                  )}
                  {visibleClueList.map((w) => {
                    const isSolved = solvedWordIds.has(w.id);
                    const isCurrent = activeWord?.id === w.id;

                    return (
                      <button
                        key={w.id}
                        ref={shouldVirtualize ? (node) => measureRowHeight(w.id, node) : undefined}
                        type="button"
                        onClick={() => handleWordClick(w)}
                        className={`w-full text-left px-3.5 py-2.5 border-b border-purple-200/50 dark:border-purple-900/50 transition-colors cursor-pointer flex items-start gap-2.5 ${
                          isCurrent
                            ? 'bg-amber-400/20 dark:bg-[#F6C915]/15 text-[#2B0938] dark:text-white'
                            : isSolved
                            ? 'bg-emerald-50/60 dark:bg-emerald-950/20 text-slate-500 dark:text-purple-300/60 hover:bg-purple-50 dark:hover:bg-purple-900/30'
                            : 'hover:bg-purple-50/80 dark:hover:bg-purple-900/30 text-[#2B0938] dark:text-purple-100'
                        }`}
                      >
                        <span className="font-mono-tabular text-xs font-bold text-amber-600 dark:text-[#F6C915] shrink-0 w-12">
                          {w.number}
                          {w.direction === 'across' ? 'A' : 'D'}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className={`text-xs leading-snug ${isSolved ? 'line-through opacity-70' : 'font-medium'}`}>
                            {w.clue}
                          </p>
                          <div className="mt-1 flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-purple-300/75 font-mono-tabular">
                            <span>{w.category}</span>
                            <span aria-hidden="true">·</span>
                            <span>R{w.row + 1}:C{w.col + 1}</span>
                            {w.isCryptic && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="text-amber-600 dark:text-[#F6C915] font-semibold">Cryptic</span>
                              </>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                  {bottomSpacerHeight > 0 && (
                    <div aria-hidden="true" style={{ height: bottomSpacerHeight }} />
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </aside>
    </>
  );
};
