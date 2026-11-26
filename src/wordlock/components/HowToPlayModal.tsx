import React, { useEffect } from 'react';
import { BookOpen, KeyRound, Layers, Sparkles, X } from 'lucide-react';

interface HowToPlayModalProps {
  isOpen: boolean;
  onClose: () => void;
  darkMode: boolean;
}

export const HowToPlayModal: React.FC<HowToPlayModalProps> = ({
  isOpen,
  onClose,
  darkMode,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#12031E]/80"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wordlock-help-title"
      onClick={onClose}
    >
      <div
        className={`relative w-full max-w-xl max-h-[88dvh] flex flex-col rounded-2xl border-2 shadow-[0_24px_70px_rgba(0,0,0,0.65)] overflow-hidden ${
          darkMode
            ? 'bg-[#1D0731] border-[#D4A437]/50 text-[#F7F3FB]'
            : 'bg-[#FFFFFF] border-[#D5C0EE] text-[#2B0938]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Starlight Gold accent bar */}
        <div className="h-1 w-full bg-gradient-to-r from-[#2B0938] via-[#F6C915] to-[#2B0938]" />

        {/* Header */}
        <div
          className={`flex items-center justify-between px-5 py-4 border-b ${
            darkMode ? 'border-[#D4A437]/25 bg-[#250A3E]' : 'border-[#E5D7F6] bg-[#F7F1FC]'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <img
              src="/assets/aistudio/3d_logo_944e5372.png"
              alt="The Missing Piece"
              className="w-8 h-8 object-contain"
            />
            <div>
              <div
                className={`text-[10px] font-mono uppercase tracking-[0.18em] font-bold ${
                  darkMode ? 'text-[#F6C915]' : 'text-[#8F6500]'
                }`}
              >
                The Missing Piece · Vault Manual
              </div>
              <h2
                id="wordlock-help-title"
                className="text-lg font-extrabold tracking-tight flex items-center gap-2"
              >
                <BookOpen className="w-4 h-4 text-[#F6C915]" />
                How to Crack WORDLOCK
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close help"
            className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-colors cursor-pointer ${
              darkMode
                ? 'border-[#D4A437]/30 bg-[#1B052D] text-[#E7DAF2] hover:border-[#F6C915] hover:text-[#F6C915]'
                : 'border-[#D5C0EE] bg-white text-[#4A1C6E] hover:border-[#2B0938]'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="wordlock-scroll overflow-y-auto px-5 py-4 space-y-4 text-sm leading-relaxed">
          <p className={darkMode ? 'text-[#E3D7F0]' : 'text-[#44255C]'}>
            Rotate the <strong>4 vertical mechanical conveyor tracks</strong> until{' '}
            <strong>every horizontal row forms a valid 4-letter English word</strong> AND the{' '}
            <strong className={darkMode ? 'text-[#F6C915]' : 'text-[#8F6500]'}>
              center Master Key row
            </strong>{' '}
            locks onto the vault&apos;s secret code before your click budget runs out.
          </p>

          {/* Visual Legend: Master Key Pins */}
          <div
            className={`rounded-xl border p-3.5 space-y-2.5 ${
              darkMode
                ? 'bg-[#260B3F]/80 border-[#D4A437]/25'
                : 'bg-[#F7F1FC] border-[#DFCEF4]'
            }`}
          >
            <div className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-[0.15em] font-bold text-[#F6C915]">
              <KeyRound className="w-3.5 h-3.5" />
              <span className={darkMode ? 'text-[#F6C915]' : 'text-[#8F6500]'}>
                Center Bezel · Master Key Deduction Pins
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <div
                className={`rounded-lg p-2.5 border ${
                  darkMode
                    ? 'bg-[#170626] border-emerald-500/35'
                    : 'bg-white border-emerald-500/40'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-emerald-500">
                  <span className="w-3 h-3 rounded-full bg-emerald-400 inline-block shrink-0" />
                  Emerald Pin
                </div>
                <p className={`mt-1 ${darkMode ? 'text-[#CFC2DF]' : 'text-[#54376E]'}`}>
                  Exact letter in the exact column of the Master Key.
                </p>
              </div>
              <div
                className={`rounded-lg p-2.5 border ${
                  darkMode
                    ? 'bg-[#170626] border-amber-400/35'
                    : 'bg-white border-amber-500/40'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-amber-500">
                  <span className="w-3 h-3 rounded-full bg-amber-400 inline-block shrink-0" />
                  Amber Pin
                </div>
                <p className={`mt-1 ${darkMode ? 'text-[#CFC2DF]' : 'text-[#54376E]'}`}>
                  Letter exists in the Master Key, but in a different column.
                </p>
              </div>
              <div
                className={`rounded-lg p-2.5 border ${
                  darkMode
                    ? 'bg-[#170626] border-slate-500/35'
                    : 'bg-white border-slate-300'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-slate-400">
                  <span className="w-3 h-3 rounded-full bg-slate-500 inline-block shrink-0" />
                  Slate Pin
                </div>
                <p className={`mt-1 ${darkMode ? 'text-[#CFC2DF]' : 'text-[#54376E]'}`}>
                  Letter is not part of the secret Master Key.
                </p>
              </div>
            </div>
          </div>

          {/* Side LED Strips */}
          <div
            className={`rounded-xl border p-3.5 space-y-1.5 ${
              darkMode
                ? 'bg-[#260B3F]/80 border-[#D4A437]/25'
                : 'bg-[#F7F1FC] border-[#DFCEF4]'
            }`}
          >
            <div className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-[0.15em] font-bold">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span className={darkMode ? 'text-[#F6C915]' : 'text-[#8F6500]'}>
                Side Pillar LED Strips
              </span>
            </div>
            <p className={`text-xs ${darkMode ? 'text-[#D6CBE2]' : 'text-[#54376E]'}`}>
              Every horizontal row flanked by glowing <strong>Amber LEDs</strong> is currently a
              valid 4-letter English word. When all rows are valid and the center row locks onto
              all 4 <strong>Emerald</strong> pins, the brass release lever drops and the vault
              breaches.
            </p>
          </div>

          {/* Controls */}
          <div
            className={`rounded-xl border p-3.5 space-y-2 ${
              darkMode
                ? 'bg-[#260B3F]/80 border-[#D4A437]/25'
                : 'bg-[#F7F1FC] border-[#DFCEF4]'
            }`}
          >
            <div className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-[0.15em] font-bold">
              <Layers className="w-3.5 h-3.5 text-[#F6C915]" />
              <span className={darkMode ? 'text-[#F6C915]' : 'text-[#8F6500]'}>
                Controls &amp; Difficulty Tiers
              </span>
            </div>
            <ul className={`text-xs space-y-1.5 list-disc pl-4 ${darkMode ? 'text-[#D6CBE2]' : 'text-[#54376E]'}`}>
              <li>
                <strong>Drag / Flick:</strong> Touch or click-drag any 3D wheel straight up or down
                to spin multiple steps at once (each step costs 1 click).
              </li>
              <li>
                <strong>Tap / Scroll:</strong> Click the upper or lower half of a wheel, use your
                mouse wheel, or press the tactile ▲ / ▼ rocker dock below.
              </li>
              <li>
                <strong>Keyboard:</strong> Press <kbd className="px-1 py-0.5 rounded bg-black/25 font-mono">1</kbd>–<kbd className="px-1 py-0.5 rounded bg-black/25 font-mono">4</kbd> or <kbd className="px-1 py-0.5 rounded bg-black/25 font-mono">←</kbd>/<kbd className="px-1 py-0.5 rounded bg-black/25 font-mono">→</kbd> to choose a wheel, <kbd className="px-1 py-0.5 rounded bg-black/25 font-mono">↑</kbd>/<kbd className="px-1 py-0.5 rounded bg-black/25 font-mono">↓</kbd> to rotate, and <kbd className="px-1 py-0.5 rounded bg-black/25 font-mono">H</kbd> to toggle the bottom dock.
              </li>
              <li>
                <strong>Tiers:</strong> <strong>Easy</strong> (5 rows · 15 clicks),{' '}
                <strong>Standard</strong> (5 rows · 12 clicks), <strong>Hard</strong> (7 rows · 16
                clicks), and <strong>Master</strong> (7 rows · 13 clicks). Includes a full{' '}
                <strong>6-Month Daily Archive</strong> plus Unlimited Locks!
              </li>
            </ul>
          </div>
        </div>

        {/* Footer CTA */}
        <div
          className={`px-5 py-3.5 border-t flex justify-end ${
            darkMode ? 'border-[#D4A437]/25 bg-[#250A3E]' : 'border-[#E5D7F6] bg-[#F7F1FC]'
          }`}
        >
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#F6C915] hover:bg-[#FFE047] text-[#1D0830] font-extrabold text-sm shadow-sm transition-colors cursor-pointer"
          >
            Back to Vault
          </button>
        </div>
      </div>
    </div>
  );
};
