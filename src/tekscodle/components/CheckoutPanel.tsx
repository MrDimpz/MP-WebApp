import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, RotateCcw, Zap } from 'lucide-react';
import { Difficulty } from '../data/items';
import {
  DIFFICULTY_CONFIGS,
  RoundConfig,
  RoundResult,
  formatGBP,
} from '../utils/gameLogic';
import { ProximityGauge } from './ProximityGauge';

interface CheckoutPanelProps {
  round: RoundConfig;
  roundIndex: number;
  totalRounds: number;
  difficulty: Difficulty;
  mode: 'daily' | 'practice' | 'quick';
  cumulativeScore: number;
  revealedResult: RoundResult | null;
  onSubmitGuess: (guessPence: number) => void;
  onNextRound: () => void;
  onNextQuickPlay: () => void;
  onSwitchToFullGame: () => void;
}

export const CheckoutPanel: React.FC<CheckoutPanelProps> = ({
  round,
  roundIndex,
  totalRounds,
  difficulty,
  mode,
  cumulativeScore,
  revealedResult,
  onSubmitGuess,
  onNextRound,
  onNextQuickPlay,
  onSwitchToFullGame,
}) => {
  const cfg = DIFFICULTY_CONFIGS[difficulty];
  const sliderMaxPence =
    round.itemCount === 1
      ? Math.max(1500, Math.ceil((round.actualTotalPence * 1.8) / 100) * 100)
      : round.itemCount === 3
        ? Math.max(2500, Math.ceil((round.actualTotalPence * 1.7) / 100) * 100)
        : Math.max(3500, Math.ceil((round.actualTotalPence * 1.6) / 100) * 100);

  const defaultGuessPence = round.itemCount === 1 ? 200 : round.itemCount === 3 ? 650 : 1200;
  const [inputValue, setInputValue] = useState<string>((defaultGuessPence / 100).toFixed(2));
  const [inputError, setInputError] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setInputValue((defaultGuessPence / 100).toFixed(2));
    setInputError('');
    const timer = window.setTimeout(() => {
      if (!revealedResult && inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      }
    }, 60);
    return () => window.clearTimeout(timer);
  }, [round, defaultGuessPence, revealedResult]);

  const parsedPence = (() => {
    const cleaned = inputValue.replace(/[^0-9.]/g, '');
    const num = parseFloat(cleaned);
    if (Number.isNaN(num) || num < 0) return 0;
    return Math.round(num * 100);
  })();

  const handleNudge = (deltaPence: number) => {
    const next = Math.max(5, Math.min(99999, parsedPence + deltaPence));
    setInputValue((next / 100).toFixed(2));
    setInputError('');
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pence = Number(e.target.value);
    setInputValue((pence / 100).toFixed(2));
    setInputError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedPence <= 0) {
      setInputError('Enter a valid basket price above £0.00.');
      return;
    }
    setInputError('');
    onSubmitGuess(parsedPence);
  };

  if (revealedResult) {
    const isFinalRound = roundIndex + 1 >= totalRounds;
    const nextCount = roundIndex === 0 ? 3 : 5;

    return (
      <aside className="bg-white dark:bg-[#220836] border border-purple-200 dark:border-purple-800/80 rounded-2xl overflow-hidden shadow-lg">
        <div className="bg-gradient-to-r from-[#2B0938] to-[#3B0F54] text-white px-6 py-4 flex items-center justify-between border-b border-[#F6C915]/30">
          <div className="flex items-center gap-2">
            <span className="font-display font-bold text-sm tracking-wide text-[#F6C915]">
              Till Receipt · Round {roundIndex + 1}
            </span>
          </div>
          <span className="font-mono text-xs text-purple-200 tabular-nums">
            {cfg.label} (±{cfg.marginPct}%)
          </span>
        </div>

        <div className="p-6 space-y-4">
          <div className="space-y-2 border-b border-dashed border-purple-200 dark:border-purple-800 pb-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500 dark:text-purple-200/75">Your Basket Guess</span>
              <span className="font-mono font-semibold text-slate-800 dark:text-purple-100 tabular-nums">
                {formatGBP(revealedResult.guessPence)}
              </span>
            </div>
            <div className="flex items-center justify-between text-base">
              <span className="font-bold text-[#2B0938] dark:text-white">Actual Basket Total</span>
              <span className="font-mono text-lg font-extrabold text-[#2B0938] dark:text-[#F6C915] tabular-nums">
                {formatGBP(revealedResult.actualTotalPence)}
              </span>
            </div>
          </div>

          <ProximityGauge result={revealedResult} />

          <div className="pt-3 border-t border-purple-100 dark:border-purple-800/70">
            <div className="flex items-end justify-between mb-4">
              <div>
                <div className="text-xs text-slate-500 dark:text-purple-200/75">Points Earned</div>
                <div
                  className={`font-mono text-3xl font-extrabold tabular-nums leading-none mt-1 ${
                    revealedResult.inZone
                      ? 'text-[#581c6b] dark:text-[#F6C915]'
                      : 'text-slate-400 dark:text-purple-400/60'
                  }`}
                >
                  +{revealedResult.points.toLocaleString()}
                  <span className="text-sm font-medium text-slate-400 dark:text-purple-300/60 ml-1">
                    / {revealedResult.maxPoints.toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-500 dark:text-purple-200/75">
                  {mode === 'quick' ? 'Margin Rule' : 'Session Total'}
                </div>
                <div className="font-mono text-base font-bold text-[#2B0938] dark:text-white tabular-nums mt-1">
                  {mode === 'quick'
                    ? `±${revealedResult.marginPct}%`
                    : `${cumulativeScore.toLocaleString()} pts`}
                </div>
              </div>
            </div>

            {mode === 'quick' ? (
              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={onNextQuickPlay}
                  className="w-full py-3 px-4 bg-[#F6C915] hover:bg-[#FFE047] text-[#1D0830] font-extrabold text-sm rounded-xl transition-colors flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer shadow-sm"
                >
                  <Zap className="w-4 h-4" />
                  <span>Next Quick Basket</span>
                </button>
                <button
                  type="button"
                  onClick={onSwitchToFullGame}
                  className="w-full py-2.5 px-4 bg-purple-50 dark:bg-purple-950/70 hover:bg-purple-100 dark:hover:bg-purple-900/70 text-[#2B0938] dark:text-purple-100 border border-purple-200 dark:border-purple-700/70 font-semibold text-sm rounded-xl transition-colors flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Play 3-Round Daily Challenge</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onNextRound}
                className="w-full py-3 px-4 bg-[#F6C915] hover:bg-[#FFE047] text-[#1D0830] font-extrabold text-sm rounded-xl transition-colors flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer shadow-sm"
              >
                <span>
                  {isFinalRound
                    ? 'View Final Receipt'
                    : `Continue to Round ${roundIndex + 2} (${nextCount} Items)`}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="bg-white dark:bg-[#220836] border border-purple-200 dark:border-purple-800/80 rounded-2xl overflow-hidden shadow-lg">
      <div className="bg-gradient-to-r from-[#23063A] via-[#340A54] to-[#23063A] text-white px-6 py-5 border-b border-[#F6C915]/30">
        <div className="flex items-center justify-between text-xs text-purple-200 mb-1.5">
          <span>
            {mode === 'quick'
              ? 'Quick Play Till'
              : `Round ${roundIndex + 1} of ${totalRounds}`}
          </span>
          <span className="font-mono tabular-nums text-[#F6C915] font-bold">
            {cfg.label} · ±{cfg.marginPct}% zone
          </span>
        </div>
        <h2 className="font-display text-xl font-bold tracking-tight">
          {round.itemCount === 1
            ? 'Guess the item price'
            : `Guess the ${round.itemCount}-item total`}
        </h2>
        <p className="text-xs text-purple-200/85 mt-1 leading-relaxed">
          Score starts at {cfg.marginPct}% away ({cfg.minZonePoints} pts) and climbs to{' '}
          {cfg.maxRoundPoints.toLocaleString()} pts for an exact hit.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-5">
        <div>
          <label
            htmlFor="basket-guess-input"
            className="block text-xs font-bold text-slate-600 dark:text-purple-200 mb-2"
          >
            Your Total Estimate (GBP)
          </label>
          <div className="relative flex items-center">
            <span className="absolute left-4 font-mono text-2xl font-bold text-slate-400 dark:text-purple-300/60 select-none">
              £
            </span>
            <input
              ref={inputRef}
              id="basket-guess-input"
              type="text"
              inputMode="decimal"
              value={inputValue}
              onChange={(e) => {
                const raw = e.target.value;
                if (/^[0-9]*\.?[0-9]{0,2}$/.test(raw)) {
                  setInputValue(raw);
                  setInputError('');
                }
              }}
              placeholder="0.00"
              className="w-full pl-10 pr-4 py-3.5 font-mono text-3xl font-bold text-[#2B0938] dark:text-[#F6C915] tabular-nums bg-[#F8FAFC] dark:bg-[#140421] border border-purple-200 dark:border-purple-700/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F6C915] focus:border-[#F6C915] transition-colors"
            />
          </div>
          {inputError && (
            <p className="text-xs text-rose-600 dark:text-rose-400 font-medium mt-1.5">
              {inputError}
            </p>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-purple-200/75 font-mono tabular-nums mb-1.5">
            <span>£0.25</span>
            <span>Slide to adjust</span>
            <span>{formatGBP(sliderMaxPence)}</span>
          </div>
          <input
            type="range"
            min={25}
            max={sliderMaxPence}
            step={5}
            value={Math.min(sliderMaxPence, Math.max(25, parsedPence))}
            onChange={handleSliderChange}
            aria-label="Adjust basket price estimate"
            className="w-full h-2 bg-purple-100 dark:bg-purple-950 rounded-lg appearance-none cursor-pointer accent-[#F6C915]"
          />
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[-100, -25, -5, 5, 25, 100].map((delta) => {
            const label =
              delta < 0
                ? delta <= -100
                  ? `-£${Math.abs(delta) / 100}`
                  : `-${Math.abs(delta)}p`
                : delta >= 100
                  ? `+£${delta / 100}`
                  : `+${delta}p`;
            return (
              <button
                key={delta}
                type="button"
                onClick={() => handleNudge(delta)}
                className="py-2 px-2 text-xs font-mono font-bold tabular-nums text-[#2B0938] dark:text-purple-100 bg-purple-50 dark:bg-purple-900/50 hover:bg-purple-100 dark:hover:bg-purple-800/70 border border-purple-200/70 dark:border-purple-700/60 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                {label}
              </button>
            );
          })}
        </div>

        <button
          type="submit"
          className="w-full py-3.5 px-4 bg-[#F6C915] hover:bg-[#FFE047] text-[#1D0830] font-extrabold text-sm rounded-xl transition-colors flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer shadow-md"
        >
          <Check className="w-4 h-4" />
          <span>Submit Guess</span>
        </button>

        {mode !== 'quick' && (
          <div className="pt-4 border-t border-purple-100 dark:border-purple-800/70 flex items-center justify-between text-xs text-slate-500 dark:text-purple-200/75">
            <span>Current Session Score</span>
            <span className="font-mono font-bold text-[#2B0938] dark:text-[#F6C915] tabular-nums">
              {cumulativeScore.toLocaleString()} / {cfg.maxTotalPoints.toLocaleString()} pts
            </span>
          </div>
        )}
      </form>
    </aside>
  );
};
