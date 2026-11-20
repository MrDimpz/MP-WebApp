import React, { useState } from 'react';
import { Difficulty } from '../data/items';
import { DIFFICULTY_CONFIGS } from '../utils/gameLogic';

interface HowToPlayViewProps {
  onStartPlay: () => void;
  onQuickPlay: () => void;
}

export const HowToPlayView: React.FC<HowToPlayViewProps> = ({
  onStartPlay,
  onQuickPlay,
}) => {
  const [simErrorPct, setSimErrorPct] = useState<number>(4);

  const simulatePoints = (diff: Difficulty, errPct: number) => {
    const cfg = DIFFICULTY_CONFIGS[diff];
    if (errPct > cfg.marginPct) return 0;
    const closeness = (cfg.marginPct - errPct) / cfg.marginPct;
    return Math.round(
      cfg.minZonePoints +
        (cfg.maxRoundPoints - cfg.minZonePoints) * Math.pow(closeness, 1.35)
    );
  };

  return (
    <section className="max-w-4xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[#581c6b] dark:text-[#F6C915] mb-1">
            Supermarket Rules &amp; Scoring
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#2B0938] dark:text-white text-balance">
            How TEKSCOdle Works
          </h1>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onQuickPlay}
            className="px-4 py-2.5 text-sm font-bold text-[#2B0938] dark:text-purple-100 bg-purple-100 dark:bg-purple-900/60 hover:bg-purple-200 dark:hover:bg-purple-800/70 border border-purple-200 dark:border-purple-700/70 rounded-xl transition-colors whitespace-nowrap cursor-pointer"
          >
            Quick Play
          </button>
          <button
            type="button"
            onClick={onStartPlay}
            className="px-4 py-2.5 text-sm font-extrabold text-[#1D0830] bg-[#F6C915] hover:bg-[#FFE047] rounded-xl transition-colors whitespace-nowrap cursor-pointer shadow-sm"
          >
            Start 3-Round Game
          </button>
        </div>
      </div>

      {/* Three Round Structure */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white/95 dark:bg-[#220836]/95 border border-purple-200 dark:border-purple-800/70 rounded-2xl p-6 shadow-sm">
          <div className="font-mono text-xs font-bold text-[#581c6b] dark:text-[#F6C915] mb-2">
            01. Express Basket
          </div>
          <h2 className="font-display text-lg font-bold text-[#2B0938] dark:text-white mb-2">
            1 Item
          </h2>
          <p className="text-sm text-slate-600 dark:text-purple-100/80 leading-relaxed">
            Warm up at the express till by pricing a single UK supermarket product down to the penny.
          </p>
        </div>
        <div className="bg-white/95 dark:bg-[#220836]/95 border border-purple-200 dark:border-purple-800/70 rounded-2xl p-6 shadow-sm">
          <div className="font-mono text-xs font-bold text-[#581c6b] dark:text-[#F6C915] mb-2">
            02. Midweek Top-Up
          </div>
          <h2 className="font-display text-lg font-bold text-[#2B0938] dark:text-white mb-2">
            3 Items
          </h2>
          <p className="text-sm text-slate-600 dark:text-purple-100/80 leading-relaxed">
            Mentally tally three distinct products in your basket and submit the combined total cost.
          </p>
        </div>
        <div className="bg-white/95 dark:bg-[#220836]/95 border border-purple-200 dark:border-purple-800/70 rounded-2xl p-6 shadow-sm">
          <div className="font-mono text-xs font-bold text-[#581c6b] dark:text-[#F6C915] mb-2">
            03. The Big Shop
          </div>
          <h2 className="font-display text-lg font-bold text-[#2B0938] dark:text-white mb-2">
            5 Items
          </h2>
          <p className="text-sm text-slate-600 dark:text-purple-100/80 leading-relaxed">
            Five separate items on the conveyor belt. Nail the combined total to lock in a leaderboard-topping finish.
          </p>
        </div>
      </div>

      {/* Proximity Scoring Curve Simulator */}
      <div className="bg-white/95 dark:bg-[#220836]/95 border border-purple-200 dark:border-purple-800/70 rounded-2xl p-6 sm:p-8 space-y-6 shadow-sm">
        <div>
          <h2 className="font-display text-xl font-bold text-[#2B0938] dark:text-white">
            Proximity Scoring &amp; Difficulty Margins
          </h2>
          <p className="text-sm text-slate-600 dark:text-purple-100/80 mt-1 leading-relaxed">
            Points begin as soon as your guess lands within the active difficulty&apos;s error margin (10% away on Medium) and increase smoothly the closer you get to the exact till total. Drag the slider below to preview points at any percentage error.
          </p>
        </div>

        <div className="bg-purple-50/70 dark:bg-[#190529] border border-purple-200 dark:border-purple-800/70 rounded-xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label
              htmlFor="error-sim-slider"
              className="text-sm font-bold text-[#2B0938] dark:text-white"
            >
              Simulated Guess Error
            </label>
            <span className="font-mono text-lg font-extrabold text-[#581c6b] dark:text-[#F6C915] tabular-nums">
              {simErrorPct.toFixed(1)}% away from actual price
            </span>
          </div>
          <input
            id="error-sim-slider"
            type="range"
            min={0}
            max={18}
            step={0.5}
            value={simErrorPct}
            onChange={(e) => setSimErrorPct(parseFloat(e.target.value))}
            className="w-full h-2 bg-purple-200 dark:bg-purple-950 rounded-lg appearance-none cursor-pointer accent-[#F6C915]"
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            {(['easy', 'medium', 'hard'] as Difficulty[]).map((diff) => {
              const cfg = DIFFICULTY_CONFIGS[diff];
              const pts = simulatePoints(diff, simErrorPct);
              const eligible = simErrorPct <= cfg.marginPct;
              return (
                <div
                  key={diff}
                  className="bg-white dark:bg-[#220836] border border-purple-200 dark:border-purple-700/70 rounded-xl p-4"
                >
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-purple-200/75 mb-1">
                    <span className="font-bold text-[#2B0938] dark:text-white">
                      {cfg.label} ({cfg.subtitle})
                    </span>
                    <span className="font-mono">±{cfg.marginPct}%</span>
                  </div>
                  <div
                    className={`font-mono text-2xl font-extrabold tabular-nums ${
                      eligible
                        ? 'text-[#581c6b] dark:text-[#F6C915]'
                        : 'text-slate-400 dark:text-purple-400/50'
                    }`}
                  >
                    {pts.toLocaleString()} pts
                  </div>
                  <div className="text-xs text-slate-500 dark:text-purple-200/75 mt-1">
                    {eligible
                      ? `Max ${cfg.maxRoundPoints.toLocaleString()} pts / round`
                      : `Outside ±${cfg.marginPct}% cutoff`}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Modes & Fun Facts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-white/95 dark:bg-[#220836]/95 border border-purple-200 dark:border-purple-800/70 rounded-2xl p-6 shadow-sm">
          <h2 className="font-display text-lg font-bold text-[#2B0938] dark:text-white mb-2">
            Daily Basket vs. Quick Play
          </h2>
          <p className="text-sm text-slate-600 dark:text-purple-100/80 leading-relaxed">
            <strong>Daily Basket</strong> deals the exact same 1, 3, and 5 item rounds to every shopper worldwide each day and updates your Missing Piece Daily Streak. <strong>Quick Play</strong> drops you immediately into a single rapid-fire random basket with zero setup.
          </p>
        </div>
        <div className="bg-white/95 dark:bg-[#220836]/95 border border-purple-200 dark:border-purple-800/70 rounded-2xl p-6 shadow-sm">
          <h2 className="font-display text-lg font-bold text-[#2B0938] dark:text-white mb-2">
            Aisle Notes &amp; Price Clues
          </h2>
          <p className="text-sm text-slate-600 dark:text-purple-100/80 leading-relaxed">
            Every supermarket item includes its pack size, aisle, and an informative food fact—from Victorian milk deliveries to olive oil harvests—helping you sharpen your everyday grocery instincts.
          </p>
        </div>
      </div>
    </section>
  );
};
