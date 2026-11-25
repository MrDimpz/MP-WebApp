import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  HelpCircle,
  KeyRound,
  RotateCcw,
  Shuffle,
  Sparkles,
  Unlock,
} from 'lucide-react';
import { AnagramData, MiniGameStatus } from '../../types';
import { SiblingKeyItem } from './LetterLockGame';
import { sound } from '../../utils/sound';

interface AnagramGameProps {
  data: AnagramData;
  status: MiniGameStatus;
  siblings: SiblingKeyItem[];
  activeKeyId: string;
  onSelectKey: (keyId: string) => void;
  onComplete: (mode: 'solved' | 'revealed', hintsUsed: number) => void;
  onBack: () => void;
}

interface LetterTile {
  id: number;
  char: string;
}

export const AnagramGame: React.FC<AnagramGameProps> = ({
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

  const initialTiles = (): LetterTile[] =>
    data.scrambled
      .toUpperCase()
      .split('')
      .map((char, idx) => ({ id: idx, char }));

  const [bank, setBank] = useState<LetterTile[]>(() =>
    isDone ? [] : initialTiles()
  );
  const [placed, setPlaced] = useState<(LetterTile | null)[]>(() =>
    isDone
      ? target.split('').map((char, id) => ({ id, char }))
      : Array(target.length).fill(null)
  );
  const [lockedIndices, setLockedIndices] = useState<number[]>([]);
  const [shake, setShake] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [showClue, setShowClue] = useState(false);
  const [hintsUsed, setHintsUsed] = useState(0);

  const isFull = placed.every((slot) => slot !== null);

  const nextLockedSibling = siblings.find(
    (s) => s.keyId !== activeKeyId && s.status === 'locked'
  );

  const placeTileFromBank = useCallback(
    (tileId: number) => {
      if (isDone) return;
      const nextEmpty = placed.findIndex((slot) => slot === null);
      if (nextEmpty === -1) return;
      const tile = bank.find((t) => t.id === tileId);
      if (!tile) return;

      sound.tap();
      setFeedback(null);
      setBank((prev) => prev.filter((t) => t.id !== tileId));
      setPlaced((prev) => {
        const next = [...prev];
        next[nextEmpty] = tile;
        return next;
      });
    },
    [bank, isDone, placed]
  );

  const removeSlot = useCallback(
    (slotIdx: number) => {
      if (isDone) return;
      if (lockedIndices.includes(slotIdx)) return;
      const tile = placed[slotIdx];
      if (!tile) return;

      sound.deselect();
      setFeedback(null);
      setPlaced((prev) => {
        const next = [...prev];
        next[slotIdx] = null;
        return next;
      });
      setBank((prev) => [...prev, tile]);
    },
    [isDone, lockedIndices, placed]
  );

  const handleClear = useCallback(() => {
    if (isDone) return;
    const returned: LetterTile[] = [];
    const nextPlaced = placed.map((slot, idx) => {
      if (slot && !lockedIndices.includes(idx)) {
        returned.push(slot);
        return null;
      }
      return slot;
    });
    if (returned.length === 0) return;
    sound.deselect();
    setPlaced(nextPlaced);
    setBank((prev) => [...prev, ...returned]);
    setFeedback(null);
  }, [isDone, lockedIndices, placed]);

  const handleShuffle = useCallback(() => {
    if (isDone) return;
    sound.tap();
    setBank((prev) => {
      const next = [...prev];
      for (let i = next.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [next[i], next[j]] = [next[j], next[i]];
      }
      return next;
    });
  }, [isDone]);

  const handleSubmit = useCallback(() => {
    if (isDone) return;
    if (!isFull) {
      setFeedback('Place all letters before submitting');
      setShake(true);
      sound.error();
      window.setTimeout(() => setShake(false), 340);
      return;
    }

    const attempt = placed.map((t) => t?.char ?? '').join('');
    if (attempt === target) {
      sound.unlock();
      setFeedback(null);
      onComplete('solved', hintsUsed);
    } else {
      setFeedback('Not quite — try rearranging the letters');
      setShake(true);
      sound.error();
      window.setTimeout(() => setShake(false), 340);
    }
  }, [hintsUsed, isDone, isFull, onComplete, placed, target]);

  const handleRevealOneLetter = () => {
    if (isDone) return;
    const targetIdx = target.split('').findIndex((ch, idx) => {
      return !lockedIndices.includes(idx) && placed[idx]?.char !== ch;
    });
    if (targetIdx === -1) {
      handleSubmit();
      return;
    }

    const neededChar = target[targetIdx];
    const nextBank = [...bank];
    const nextPlaced = [...placed];

    const existing = nextPlaced[targetIdx];
    if (existing) {
      nextBank.push(existing);
      nextPlaced[targetIdx] = null;
    }

    const bankMatchIdx = nextBank.findIndex((t) => t.char === neededChar);
    if (bankMatchIdx !== -1) {
      const [chosen] = nextBank.splice(bankMatchIdx, 1);
      nextPlaced[targetIdx] = chosen;
    } else {
      const placedMatchIdx = nextPlaced.findIndex(
        (t, idx) =>
          t !== null &&
          t.char === neededChar &&
          !lockedIndices.includes(idx) &&
          idx !== targetIdx
      );
      if (placedMatchIdx !== -1) {
        nextPlaced[targetIdx] = nextPlaced[placedMatchIdx];
        nextPlaced[placedMatchIdx] = null;
      }
    }

    const nextLocked = [...lockedIndices, targetIdx];
    setBank(nextBank);
    setPlaced(nextPlaced);
    setLockedIndices(nextLocked);
    setHintsUsed((h) => h + 1);
    setFeedback(null);
    sound.tap();

    if (nextPlaced.every((t, idx) => t?.char === target[idx])) {
      sound.unlock();
      onComplete('solved', hintsUsed + 1);
    }
  };

  const handleRevealWord = () => {
    if (isDone) return;
    setBank([]);
    setPlaced(target.split('').map((char, id) => ({ id, char })));
    sound.unlock();
    onComplete('revealed', hintsUsed + 1);
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Escape') {
        onBack();
        return;
      }
      if (isDone) return;

      if (e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        for (let i = placed.length - 1; i >= 0; i--) {
          if (placed[i] !== null && !lockedIndices.includes(i)) {
            removeSlot(i);
            break;
          }
        }
      } else if (e.key === ' ') {
        e.preventDefault();
        handleShuffle();
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        const upper = e.key.toUpperCase();
        const match = bank.find((t) => t.char === upper);
        if (match) {
          placeTileFromBank(match.id);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    bank,
    handleShuffle,
    handleSubmit,
    isDone,
    lockedIndices,
    onBack,
    placeTileFromBank,
    placed,
    removeSlot,
  ]);

  const tileSize =
    target.length >= 8
      ? 'w-11 h-13 sm:w-12 sm:h-15 text-[24px]'
      : 'w-13 h-15 sm:w-15 sm:h-17 text-[31px]';

  return (
    <div className="w-full max-w-xl mx-auto">
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
            Anagram
          </h2>
          <p className="text-xs text-[#5C3A78] dark:text-[#C5B3DA]">
            Unscramble all {target.length} letters to reveal the key word
          </p>
        </div>
      </div>

      {/* Sibling Switcher */}
      {siblings.length > 1 && (
        <div className="mb-5 flex items-center justify-between gap-3">
          <span className="text-xs font-semibold text-[#5C3A78] dark:text-[#C5B3DA]">
            Select Anagram key
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

      {/* Solved Banner or Clue */}
      {isDone ? (
        <div className="mb-7 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/45 border border-emerald-300 dark:border-emerald-500/45 flex flex-wrap items-center justify-between gap-3 animate-band-enter">
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
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 min-h-[36px]">
          {showClue ? (
            <p className="text-sm text-[#4A1C6E] dark:text-[#E2D4F0]">
              <span className="font-bold text-[#2B0938] dark:text-[#F6C915]">Clue:</span>{' '}
              {data.clue}
            </p>
          ) : (
            <p className="text-xs text-[#5C3A78] dark:text-[#C5B3DA]">
              Tap tiles or type directly on your keyboard
            </p>
          )}
          <div className="flex items-center gap-3 shrink-0">
            {!showClue && (
              <button
                type="button"
                onClick={() => {
                  setShowClue(true);
                  setHintsUsed((h) => h + 1);
                  sound.tap();
                }}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#5C3A78] dark:text-[#D6CBE2] hover:text-[#2B0938] dark:hover:text-[#F6C915] transition-colors whitespace-nowrap cursor-pointer"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                Show Clue
              </button>
            )}
            <button
              type="button"
              onClick={handleRevealOneLetter}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#5C3A78] dark:text-[#D6CBE2] hover:text-[#2B0938] dark:hover:text-[#F6C915] transition-colors whitespace-nowrap cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Place 1 Letter
            </button>
            <button
              type="button"
              onClick={handleRevealWord}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#8F6500] dark:text-[#F6C915] hover:opacity-80 transition-opacity whitespace-nowrap cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5" />
              Reveal Word
            </button>
          </div>
        </div>
      )}

      {/* Answer Slots */}
      <div className="bg-[#E9DCFA] dark:bg-[#170428] border-2 border-[#B38CDD] dark:border-[#D4A437]/45 rounded-2xl p-5 sm:p-8 mb-6 shadow-xs">
        <p className="text-xs font-bold uppercase tracking-wider text-[#4A1C6E] dark:text-[#E2D4F0] text-center mb-4">
          Your answer
        </p>
        <div
          className={`flex justify-center flex-wrap gap-2 ${
            shake ? 'animate-tile-shake' : ''
          }`}
        >
          {placed.map((slot, idx) => {
            const isLockedHint = lockedIndices.includes(idx);
            return (
              <button
                key={idx}
                type="button"
                disabled={isDone || !slot || isLockedHint}
                onClick={() => removeSlot(idx)}
                className={`rounded-xl font-mono font-extrabold flex items-center justify-center transition-all duration-150 ${tileSize} ${
                  isDone
                    ? 'bg-[#1F7A4C] text-white border-2 border-[#145333] dark:border-emerald-300 shadow-sm'
                    : slot
                    ? isLockedHint
                      ? 'bg-[#F6C915] text-[#140321] border-2 border-[#A67400] dark:border-white cursor-default shadow-sm'
                      : 'bg-[#2B0938] dark:bg-[#F6C915] text-[#FFE047] dark:text-[#140321] border-2 border-[#F6C915] dark:border-white hover:opacity-90 cursor-pointer animate-tile-pop shadow-sm'
                    : 'bg-[#DCC7F5] dark:bg-[#240A3E] border-2 border-dashed border-[#7E4EA8] dark:border-[#F6C915]/60 text-transparent cursor-default'
                }`}
              >
                {slot?.char ?? '·'}
              </button>
            );
          })}
        </div>

        <div className="h-6 mt-4 flex items-center justify-center">
          {feedback && (
            <span className="text-xs font-bold text-rose-700 dark:text-rose-300">
              {feedback}
            </span>
          )}
        </div>

        {/* Letter Bank */}
        {!isDone && (
          <div className="mt-4 pt-6 border-t border-[#CBB0EC] dark:border-[#D4A437]/25">
            <p className="text-xs font-bold uppercase tracking-wider text-[#4A1C6E] dark:text-[#E2D4F0] text-center mb-4">
              Available letters
            </p>
            <div className="flex justify-center flex-wrap gap-2 min-h-[68px]">
              {bank.length === 0 ? (
                <span className="text-xs text-[#5C3A78] dark:text-[#C5B3DA] self-center">
                  All tiles placed — press Submit to check
                </span>
              ) : (
                bank.map((tile) => (
                  <button
                    key={tile.id}
                    type="button"
                    onClick={() => placeTileFromBank(tile.id)}
                    className={`rounded-xl bg-white dark:bg-[#3E1768] border-2 border-[#7E4EA8] dark:border-[#F6C915]/80 border-b-4 font-mono font-extrabold text-[#1A0424] dark:text-white shadow-sm hover:bg-[#FFF8DC] dark:hover:bg-[#521F8A] dark:hover:border-[#F6C915] hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer ${tileSize}`}
                  >
                    {tile.char}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Action Controls */}
      {!isDone && (
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={handleShuffle}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#D5C0EE] dark:border-[#D4A437]/35 bg-white dark:bg-[#230738] text-sm font-semibold text-[#2B0938] dark:text-[#FAF7FF] hover:bg-[#F3E9FC] dark:hover:bg-[#310C4F] transition-colors whitespace-nowrap cursor-pointer"
          >
            <Shuffle className="w-4 h-4" />
            Shuffle
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#D5C0EE] dark:border-[#D4A437]/35 bg-white dark:bg-[#230738] text-sm font-semibold text-[#2B0938] dark:text-[#FAF7FF] hover:bg-[#F3E9FC] dark:hover:bg-[#310C4F] transition-colors whitespace-nowrap cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            Clear
          </button>
          <button
            type="button"
            disabled={!isFull}
            onClick={handleSubmit}
            className="px-6 py-2.5 rounded-xl bg-[#2B0938] hover:bg-[#3F1054] dark:bg-[#F6C915] dark:hover:bg-[#FFE047] text-[#F6C915] dark:text-[#1D0830] text-sm font-extrabold disabled:opacity-35 transition-colors whitespace-nowrap cursor-pointer shadow-sm"
          >
            Submit
          </button>
        </div>
      )}
    </div>
  );
};
