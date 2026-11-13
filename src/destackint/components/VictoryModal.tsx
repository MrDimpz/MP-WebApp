import React, { useState } from 'react';
import { Trophy, Clock, Lightbulb, Share2, Calendar, Play, CheckCircle2, Flame } from 'lucide-react';
import { GameState, DifficultyMode } from '../types';

interface VictoryModalProps {
  dateStr: string;
  difficulty: DifficultyMode;
  timeSeconds: number;
  hintsUsed: number;
  score: number;
  words: string[];
  setCurrentView: (view: GameState) => void;
  onPlayHardMode: () => void;
}

export const VictoryModal: React.FC<VictoryModalProps> = ({
  dateStr,
  difficulty,
  timeSeconds,
  hintsUsed,
  score,
  words,
  setCurrentView,
  onPlayHardMode,
}) => {
  const [copied, setCopied] = useState(false);

  const formatTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  const modeLabel = difficulty === 'hard' ? 'Hard Mode (6 Layers · 10 Words)' : 'Standard (4 Layers · 6 Words)';

  const handleShare = () => {
    const text = `DeStack ${difficulty === 'hard' ? '🔥 HARD MODE ' : ''}(${dateStr}) Solved! 🟨🟪\n⏱️ Time: ${formatTime(timeSeconds)}\n💡 Hints: ${hintsUsed}\n⭐ Score: ${score}\nPlay DeStack: ${window.location.origin}`;
    if (navigator.share) {
      navigator.share({ title: 'DeStack Score', text }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn">
      <div className="bg-white dark:bg-[#22072b] border border-purple-200 dark:border-purple-800/80 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl text-center relative overflow-hidden">
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-48 bg-amber-400/20 rounded-full blur-3xl pointer-events-none" />

        <img
          src="/assets/aistudio/3d_logo_944e5372.png"
          alt="DeStack Emblem"
          className="w-20 h-20 object-contain mx-auto mb-3 drop-shadow-xl"
        />

        <h2 className="text-3xl font-black text-[#3b0d47] dark:text-white mb-1">
          {difficulty === 'hard' ? '6-Layer Stack Cleared!' : 'Stack Cleared!'}
        </h2>
        <p className="text-xs sm:text-sm font-bold text-amber-600 dark:text-amber-400 mb-5">
          {dateStr} · {modeLabel}
        </p>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="p-3 rounded-2xl bg-purple-50/70 dark:bg-[#310b3e]/70 border border-purple-100 dark:border-purple-800/60">
            <Clock className="w-4 h-4 text-[#581c6b] dark:text-purple-300 mx-auto mb-1" />
            <div className="text-xs text-slate-500 dark:text-purple-200/70">Time</div>
            <div className="text-base font-extrabold text-[#2d0938] dark:text-white font-mono tabular-nums">{formatTime(timeSeconds)}</div>
          </div>

          <div className="p-3 rounded-2xl bg-purple-50/70 dark:bg-[#310b3e]/70 border border-purple-100 dark:border-purple-800/60">
            <Lightbulb className="w-4 h-4 text-amber-500 mx-auto mb-1" />
            <div className="text-xs text-slate-500 dark:text-purple-200/70">Hints</div>
            <div className="text-base font-extrabold text-[#2d0938] dark:text-white font-mono tabular-nums">{hintsUsed}</div>
          </div>

          <div className="p-3 rounded-2xl bg-purple-50/70 dark:bg-[#310b3e]/70 border border-purple-100 dark:border-purple-800/60">
            <Trophy className="w-4 h-4 text-amber-500 mx-auto mb-1" />
            <div className="text-xs text-slate-500 dark:text-purple-200/70">Score</div>
            <div className="text-base font-extrabold text-[#2d0938] dark:text-white font-mono tabular-nums">{score}</div>
          </div>
        </div>

        {/* Words Found List */}
        <div className="mb-5 p-4 rounded-2xl bg-amber-400/15 border border-amber-400/35 text-left">
          <div className="text-xs font-extrabold uppercase tracking-wider text-[#4a1259] dark:text-amber-300 mb-2 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-amber-500" /> Words Unstacked ({words.length})
          </div>
          <div className="flex flex-wrap gap-1.5">
            {words.map((w, idx) => (
              <span key={idx} className="px-2.5 py-1 rounded-lg bg-white dark:bg-[#1a0522] text-[#2d0938] dark:text-amber-300 font-bold text-xs shadow-sm font-mono border border-amber-400/50">
                {w}
              </span>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5">
          {difficulty === 'normal' && (
            <button
              onClick={onPlayHardMode}
              className="w-full py-3.5 bg-[#3b0d47] hover:bg-[#4a1259] text-amber-300 font-black rounded-2xl shadow-[0_4px_0_#190421] transition-all flex items-center justify-center gap-2 border border-amber-400/50 cursor-pointer"
            >
              <Flame className="w-4 h-4 fill-current text-amber-400" /> Challenge 6-Layer Hard Mode (50 Tiles)
            </button>
          )}

          <button
            onClick={handleShare}
            className="w-full py-3.5 bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 hover:from-amber-200 hover:to-amber-400 text-[#2d0938] font-black rounded-2xl shadow-[0_5px_0_#92400e] transition-all flex items-center justify-center gap-2 border border-amber-200 cursor-pointer"
          >
            <Share2 className="w-4 h-4" /> {copied ? 'Copied Score to Clipboard!' : 'Share Score'}
          </button>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              onClick={() => setCurrentView('ARCHIVE')}
              className="py-3 bg-purple-50 dark:bg-[#310b3e] hover:bg-purple-100 dark:hover:bg-purple-900/80 text-[#2d0938] dark:text-white font-bold rounded-2xl transition-colors flex items-center justify-center gap-2 text-xs"
            >
              <Calendar className="w-4 h-4 text-amber-500" /> Archive
            </button>
            <button
              onClick={() => setCurrentView('TITLE')}
              className="py-3 bg-purple-50 dark:bg-[#310b3e] hover:bg-purple-100 dark:hover:bg-purple-900/80 text-[#2d0938] dark:text-white font-bold rounded-2xl transition-colors flex items-center justify-center gap-2 text-xs"
            >
              <Play className="w-4 h-4 text-amber-500" /> Menu
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
