import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  KeyRound,
  Sparkles,
  Unlock,
} from 'lucide-react';
import { CrosswordData, MiniGameStatus } from '../../types';
import { SiblingKeyItem } from './LetterLockGame';
import { sound } from '../../utils/sound';

interface CrosswordGameProps {
  data: CrosswordData;
  status: MiniGameStatus;
  siblings: SiblingKeyItem[];
  activeKeyId: string;
  onSelectKey: (keyId: string) => void;
  onComplete: (mode: 'solved' | 'revealed', hintsUsed: number) => void;
  onBack: () => void;
}

export const CrosswordGame: React.FC<CrosswordGameProps> = ({
  data,
  status,
  siblings,
  activeKeyId,
  onSelectKey,
  onComplete,
  onBack,
}) => {
  const target = data.word.toUpperCase();
  const isDone = status !== 'locked';

  const layout = useMemo(() => {
    const maxLeft = Math.max(...data.rows.map((r) => r.intersectIndex));
    const maxRight = Math.max(
      ...data.rows.map((r) => r.answer.length - 1 - r.intersectIndex)
    );
    const totalCols = maxLeft + 1 + maxRight;
    return { targetCol: maxLeft, totalCols };
  }, [data.rows]);

  const [entries, setEntries] = useState<string[][]>(() =>
    data.rows.map((r) =>
      isDone ? r.answer.toUpperCase().split('') : Array(r.answer.length).fill('')
    )
  );
  const [activeRow, setActiveRow] = useState(0);
  const [activeCharIdx, setActiveCharIdx] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [checkedWrongCells, setCheckedWrongCells] = useState<Set<string>>(
    () => new Set()
  );

  const solvedRowFlags = useMemo(
    () =>
      data.rows.map(
        (r, idx) => entries[idx].join('') === r.answer.toUpperCase()
      ),
    [data.rows, entries]
  );

  const nextLockedSibling = siblings.find(
    (s) => s.keyId !== activeKeyId && s.status === 'locked'
  );

  const checkCompletion = useCallback(
    (nextEntries: string[][], currentHints: number) => {
      const verticalWord = data.rows
        .map((r, rIdx) => nextEntries[rIdx][r.intersectIndex] ?? '')
        .join('');
      if (verticalWord === target) {
        sound.unlock();
        onComplete('solved', currentHints);
        return true;
      }
      return false;
    },
    [data.rows, onComplete, target]
  );

  const handleInputLetter = useCallback(
    (letter: string) => {
      if (isDone) return;
      const rowDef = data.rows[activeRow];
      const nextEntries = entries.map((r) => [...r]);
      nextEntries[activeRow][activeCharIdx] = letter;

      setCheckedWrongCells((prev) => {
        const next = new Set(prev);
        next.delete(`${activeRow}-${activeCharIdx}`);
        return next;
      });
      setEntries(nextEntries);

      const rowJustSolved =
        nextEntries[activeRow].join('') === rowDef.answer.toUpperCase();
      const finishedAll = checkCompletion(nextEntries, hintsUsed);

      if (!finishedAll) {
        if (rowJustSolved) {
          sound.groupSolved();
          const nextRow = data.rows.findIndex(
            (r, idx) =>
              idx > activeRow &&
              nextEntries[idx].join('') !== r.answer.toUpperCase()
          );
          if (nextRow !== -1) {
            setActiveRow(nextRow);
            setActiveCharIdx(0);
          }
        } else {
          sound.tap();
          if (activeCharIdx < rowDef.answer.length - 1) {
            setActiveCharIdx(activeCharIdx + 1);
          }
        }
      }
    },
    [activeCharIdx, activeRow, checkCompletion, data.rows, entries, hintsUsed, isDone]
  );

  const handleBackspace = useCallback(() => {
    if (isDone) return;
    const nextEntries = entries.map((r) => [...r]);
    if (nextEntries[activeRow][activeCharIdx]) {
      nextEntries[activeRow][activeCharIdx] = '';
      setEntries(nextEntries);
      sound.deselect();
    } else if (activeCharIdx > 0) {
      nextEntries[activeRow][activeCharIdx - 1] = '';
      setEntries(nextEntries);
      setActiveCharIdx(activeCharIdx - 1);
      sound.deselect();
    }
  }, [activeCharIdx, activeRow, entries, isDone]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Escape') {
        onBack();
        return;
      }
      if (isDone) return;

      const rowLen = data.rows[activeRow].answer.length;

      if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setActiveCharIdx((i) => Math.min(rowLen - 1, i + 1));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setActiveCharIdx((i) => Math.max(0, i - 1));
      } else if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const nextRow = (activeRow + 1) % data.rows.length;
        setActiveRow(nextRow);
        setActiveCharIdx(0);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prevRow = (activeRow - 1 + data.rows.length) % data.rows.length;
        setActiveRow(prevRow);
        setActiveCharIdx(0);
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        e.preventDefault();
        handleInputLetter(e.key.toUpperCase());
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeRow, data.rows, handleBackspace, handleInputLetter, isDone, onBack]);

  const handleCheckRow = () => {
    if (isDone) return;
    const wrong = new Set<string>();
    data.rows.forEach((r, rIdx) => {
      const answer = r.answer.toUpperCase();
      entries[rIdx].forEach((ch, cIdx) => {
        if (ch && ch !== answer[cIdx]) {
          wrong.add(`${rIdx}-${cIdx}`);
        }
      });
    });
    setCheckedWrongCells(wrong);
    if (wrong.size > 0) {
      sound.error();
    } else {
      sound.tap();
    }
  };

  const handleRevealCell = () => {
    if (isDone) return;
    const nextEntries = entries.map((r) => [...r]);
    const rowDef = data.rows[activeRow];
    let targetR = activeRow;
    let targetC = activeCharIdx;

    if (nextEntries[targetR][targetC] === rowDef.answer[targetC].toUpperCase()) {
      const interRow = data.rows.findIndex(
        (r, idx) =>
          nextEntries[idx][r.intersectIndex] !==
          r.answer[r.intersectIndex].toUpperCase()
      );
      if (interRow !== -1) {
        targetR = interRow;
        targetC = data.rows[interRow].intersectIndex;
      }
    }

    nextEntries[targetR][targetC] = data.rows[targetR].answer[targetC].toUpperCase();
    const nextHints = hintsUsed + 1;
    setHintsUsed(nextHints);
    setEntries(nextEntries);
    setActiveRow(targetR);
    setActiveCharIdx(targetC);
    setCheckedWrongCells((prev) => {
      const next = new Set(prev);
      next.delete(`${targetR}-${targetC}`);
      return next;
    });

    if (!checkCompletion(nextEntries, nextHints)) {
      sound.tap();
    }
  };

  const handleRevealAll = () => {
    if (isDone) return;
    setEntries(data.rows.map((r) => r.answer.toUpperCase().split('')));
    sound.unlock();
    onComplete('revealed', hintsUsed + 1);
  };

  const cellDim =
    layout.totalCols >= 10
      ? 'w-9 h-9 sm:w-10 sm:h-10 text-[18px]'
      : layout.totalCols >= 8
      ? 'w-10 h-10 sm:w-11 sm:h-11 text-[21px]'
      : 'w-11 h-11 sm:w-12 sm:h-12 text-[24px]';

  return (
    <div className="w-full max-w-3xl mx-auto">
      {/* Sub-header */}
      <div className="flex items-center justify-between gap-4 pb-4 mb-5 border-b border-[#DAC6F0] dark:border-[#D4A437]/25">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-bold text-[#5C3A78] dark:text-[#D6CBE2] hover:text-[#2B0938] dark:hover:text-[#F6C915] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Board
        </button>
        <div className="text-right">
          <h2 className="font-display text-xl font-bold tracking-tight text-[#2B0938] dark:text-[#FAF7FF]">
            Crossword
          </h2>
          <p className="text-xs text-[#5C3A78] dark:text-[#C5B3DA]">
            Solve the across clues to spell the highlighted vertical key word
          </p>
        </div>
      </div>

      {/* Sibling Switcher */}
      {siblings.length > 1 && (
        <div className="mb-5 flex items-center justify-between gap-3">
          <span className="text-xs font-semibold text-[#5C3A78] dark:text-[#C5B3DA]">
            Select Crossword key
          </span>
          <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-[#EDE0FA] dark:bg-[#230738] border border-[#D7C2EF] dark:border-[#D4A437]/25">
            {siblings.map((s) => {
              const isActive = s.keyId === activeKeyId;
              return (
                <button
                  key={s.keyId}
                  type="button"
                  onClick={() => onSelectKey(s.keyId)}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-colors inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-[#2B0938] text-[#F6C915] dark:bg-[#F6C915] dark:text-[#1D0830] shadow-xs'
                      : 'text-[#5C3A78] dark:text-[#D6CBE2] hover:text-[#2B0938] dark:hover:text-white'
                  }`}
                >
                  {s.status !== 'locked' && (
                    <Check className="w-3 h-3 text-emerald-500" />
                  )}
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Completed Banner */}
      {isDone ? (
        <div className="mb-6 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/45 border border-emerald-300 dark:border-emerald-500/45 flex flex-wrap items-center justify-between gap-3 animate-band-enter">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#2E7D52] text-white flex items-center justify-center shrink-0">
              {status === 'solved' ? <Check className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
            </div>
            <div>
              <p className="text-xs font-bold text-[#1E633E] dark:text-emerald-300">
                {status === 'solved' ? 'Key word unlocked' : 'Key word revealed'}
              </p>
              <p className="font-mono text-lg font-bold tracking-widest text-[#2B0938] dark:text-[#FAF7FF]">
                {target}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {nextLockedSibling && (
              <button
                type="button"
                onClick={() => onSelectKey(nextLockedSibling.keyId)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-emerald-600/40 bg-white dark:bg-[#1D0630] text-[#2B0938] dark:text-[#FAF7FF] text-xs font-bold hover:opacity-90 transition-opacity whitespace-nowrap cursor-pointer"
              >
                Next {nextLockedSibling.label}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={onBack}
              className="px-4 py-2 rounded-lg bg-[#2B0938] dark:bg-[#F6C915] text-[#F6C915] dark:text-[#1D0830] text-xs font-extrabold hover:opacity-90 transition-opacity whitespace-nowrap cursor-pointer"
            >
              Place on Board
            </button>
          </div>
        </div>
      ) : (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-[#5C3A78] dark:text-[#C5B3DA]">
            <span className="font-bold text-[#2B0938] dark:text-[#F6C915]">
              Vertical key clue:
            </span>{' '}
            {data.clue} ({target.length})
          </p>
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleCheckRow}
              className="text-xs font-bold text-[#5C3A78] dark:text-[#D6CBE2] hover:text-[#2B0938] dark:hover:text-[#F6C915] transition-colors whitespace-nowrap cursor-pointer"
            >
              Check Letters
            </button>
            <button
              type="button"
              onClick={handleRevealCell}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#5C3A78] dark:text-[#D6CBE2] hover:text-[#2B0938] dark:hover:text-[#F6C915] transition-colors whitespace-nowrap cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Reveal Letter
            </button>
            <button
              type="button"
              onClick={handleRevealAll}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#8F6500] dark:text-[#F6C915] hover:opacity-80 transition-opacity whitespace-nowrap cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5" />
              Reveal Word
            </button>
          </div>
        </div>
      )}

      {/* Split Layout: Intersecting Grid + Clue List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 bg-[#E9DCFA] dark:bg-[#130320] border-2 border-[#B38CDD] dark:border-[#D4A437]/45 rounded-2xl p-4 sm:p-6 overflow-x-auto shadow-xs">
          <div className="inline-flex flex-col gap-1.5 mx-auto min-w-max">
            {data.rows.map((rowDef, rIdx) => {
              const startCol = layout.targetCol - rowDef.intersectIndex;
              const isRowSolved = solvedRowFlags[rIdx];

              return (
                <div key={rIdx} className="flex items-center gap-1">
                  <span className="w-4 text-right font-mono text-xs font-bold text-[#6E4B8A] dark:text-[#B9A4D1] select-none mr-1">
                    {rIdx + 1}
                  </span>
                  {Array.from({ length: layout.totalCols }).map((_, cIdx) => {
                    const charIdx = cIdx - startCol;
                    const isValid =
                      charIdx >= 0 && charIdx < rowDef.answer.length;

                    if (!isValid) {
                      return (
                        <div
                          key={cIdx}
                          className={`${cellDim} shrink-0`}
                          aria-hidden="true"
                        />
                      );
                    }

                    const isIntersection = cIdx === layout.targetCol;
                    const isFocused =
                      !isDone && activeRow === rIdx && activeCharIdx === charIdx;
                    const isRowActive = !isDone && activeRow === rIdx;
                    const isWrong = checkedWrongCells.has(`${rIdx}-${charIdx}`);
                    const value = entries[rIdx][charIdx];

                    return (
                      <button
                        key={cIdx}
                        type="button"
                        disabled={isDone}
                        onClick={() => {
                          setActiveRow(rIdx);
                          setActiveCharIdx(charIdx);
                        }}
                        aria-label={`Row ${rIdx + 1}, letter ${charIdx + 1}${
                          isIntersection ? ', target key column' : ''
                        }`}
                        className={`relative rounded-lg border-2 font-mono font-extrabold flex items-center justify-center transition-colors shrink-0 cursor-pointer ${cellDim} ${
                          isDone && isIntersection
                            ? 'bg-[#1F7A4C] border-[#145333] dark:border-emerald-300 text-white shadow-sm'
                            : isFocused
                            ? 'bg-[#2B0938] dark:bg-[#F6C915] border-[#F6C915] dark:border-white text-[#FFE047] dark:text-[#140321] shadow-sm'
                            : isIntersection
                            ? 'bg-[#FFE673] dark:bg-[#664500] border-[#B37E00] dark:border-[#F6C915] text-[#1A0424] dark:text-[#FFF3B0] shadow-xs'
                            : isRowSolved
                            ? 'bg-emerald-100 dark:bg-emerald-900/75 border-emerald-600 dark:border-emerald-400 text-emerald-950 dark:text-emerald-100'
                            : isRowActive
                            ? 'bg-[#FFFDF5] dark:bg-[#4F1D85] border-[#4A1475] dark:border-[#F6C915] text-[#1A0424] dark:text-white shadow-xs'
                            : 'bg-white dark:bg-[#3A1563] border-[#7E4EA8] dark:border-[#F6C915]/65 text-[#1A0424] dark:text-white shadow-xs'
                        } ${
                          isWrong
                            ? 'ring-2 ring-rose-500 text-rose-700 dark:text-rose-300'
                            : ''
                        }`}
                      >
                        {value}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-center text-xs font-medium text-[#4A1C6E] dark:text-[#D6CBE2]">
            Click any cell and type · Highlighted gold column spells the hidden board word
          </p>

          {/* Compact Touch Keyboard for Mobile / Tablet */}
          {!isDone && (
            <div className="mt-4 pt-4 border-t border-[#CBB0EC] dark:border-[#D4A437]/25 flex flex-col gap-1.5 lg:hidden select-none">
              {[
                ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
                ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
                ['Z', 'X', 'C', 'V', 'B', 'N', 'M', 'BACK'],
              ].map((row, rIdx) => (
                <div key={rIdx} className="flex justify-center gap-1">
                  {row.map((key) =>
                    key === 'BACK' ? (
                      <button
                        key={key}
                        type="button"
                        onClick={handleBackspace}
                        className="h-11 px-3 rounded-md bg-[#2B0938] dark:bg-[#F6C915] text-xs font-extrabold text-[#F6C915] dark:text-[#140321] cursor-pointer"
                      >
                        Del
                      </button>
                    ) : (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleInputLetter(key)}
                        className="h-11 min-w-[26px] flex-1 max-w-[38px] rounded-md bg-white dark:bg-[#3C1666] border-2 border-[#8B5EC0] dark:border-[#F6C915]/65 font-mono text-[16px] font-extrabold text-[#1A0424] dark:text-white shadow-xs cursor-pointer"
                      >
                        {key}
                      </button>
                    )
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Clues List */}
        <div className="lg:col-span-5 bg-white dark:bg-[#210736] border border-[#DAC6F0] dark:border-[#D4A437]/30 rounded-2xl p-5 shadow-xs">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#5C3A78] dark:text-[#F6C915] mb-3">
            Across Clues
          </h3>
          <ol className="divide-y divide-[#EFE5FA] dark:divide-[#D4A437]/20">
            {data.rows.map((rowDef, idx) => {
              const isSelected = !isDone && activeRow === idx;
              const isSolved = solvedRowFlags[idx];
              return (
                <li key={idx}>
                  <button
                    type="button"
                    disabled={isDone}
                    onClick={() => {
                      setActiveRow(idx);
                      const firstEmpty = entries[idx].findIndex((c) => !c);
                      setActiveCharIdx(firstEmpty === -1 ? 0 : firstEmpty);
                    }}
                    className={`w-full text-left py-2.5 px-2.5 -mx-2.5 rounded-lg transition-colors flex items-start gap-2.5 cursor-pointer ${
                      isSelected
                        ? 'bg-[#EFE5FA] dark:bg-[#310E52]'
                        : 'hover:bg-[#F7F2FC] dark:hover:bg-[#290A44]'
                    }`}
                  >
                    <span className="font-mono text-xs font-bold text-[#8F6500] dark:text-[#F6C915] mt-0.5 w-4 shrink-0">
                      {idx + 1}.
                    </span>
                    <span
                      className={`text-sm leading-snug flex-1 ${
                        isSolved
                          ? 'line-through text-[#8D73A8] dark:text-[#866EA1]'
                          : 'text-[#2B0938] dark:text-[#FAF7FF]'
                      }`}
                    >
                      {rowDef.clue}
                    </span>
                    {isSolved && (
                      <Check className="w-4 h-4 text-[#2E7D52] dark:text-emerald-400 shrink-0 mt-0.5" />
                    )}
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </div>
  );
};
