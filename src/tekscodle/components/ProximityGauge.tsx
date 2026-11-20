import React from 'react';
import { RoundResult, formatGBP } from '../utils/gameLogic';

interface ProximityGaugeProps {
  result: RoundResult;
}

export const ProximityGauge: React.FC<ProximityGaugeProps> = ({ result }) => {
  const spanPct = Math.max(25, result.marginPct * 2);
  const signedPct =
    result.actualTotalPence > 0
      ? ((result.guessPence - result.actualTotalPence) / result.actualTotalPence) * 100
      : 0;
  const clampedSigned = Math.max(-spanPct, Math.min(spanPct, signedPct));
  const markerLeftPct = ((clampedSigned + spanPct) / (spanPct * 2)) * 100;
  const zoneWidthPct = ((result.marginPct * 2) / (spanPct * 2)) * 100;
  const zoneLeftPct = 50 - zoneWidthPct / 2;

  const directionText =
    result.diffPence === 0
      ? 'Spot on to the penny'
      : result.diffPence > 0
        ? `${formatGBP(result.diffPence)} too high (+${result.absErrorPct.toFixed(1)}%)`
        : `${formatGBP(Math.abs(result.diffPence))} too low (-${result.absErrorPct.toFixed(1)}%)`;

  return (
    <div className="py-3">
      <div className="flex items-center justify-between text-xs mb-2 gap-2">
        <span className="font-bold text-[#2B0938] dark:text-[#F6C915]">
          {result.ratingLabel}
        </span>
        <span
          className={`font-mono font-semibold tabular-nums ${
            result.diffPence === 0
              ? 'text-[#00539F] dark:text-[#F6C915]'
              : result.inZone
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-rose-600 dark:text-rose-400'
          }`}
        >
          {directionText}
        </span>
      </div>

      <div className="relative h-7 flex items-center">
        <div className="w-full h-2.5 bg-slate-200 dark:bg-purple-950/90 rounded-full overflow-hidden relative border border-transparent dark:border-purple-800/60">
          <div
            className="absolute top-0 bottom-0 bg-[#581c6b]/20 dark:bg-[#F6C915]/25 border-x border-[#581c6b]/45 dark:border-[#F6C915]/60"
            style={{ left: `${zoneLeftPct}%`, width: `${zoneWidthPct}%` }}
          />
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-[#2B0938] dark:bg-[#F6C915]"
            style={{ left: '50%' }}
          />
        </div>

        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-transform duration-200"
          style={{ left: `${markerLeftPct}%` }}
          title={`Your guess: ${formatGBP(result.guessPence)}`}
        >
          <div
            className={`w-4 h-4 rounded-full border-2 border-white dark:border-[#160524] shadow-sm ${
              result.diffPence === 0
                ? 'bg-[#F6C915] ring-2 ring-[#2B0938] dark:ring-[#F6C915]'
                : result.inZone
                  ? 'bg-emerald-500'
                  : 'bg-rose-500'
            }`}
          />
        </div>
      </div>

      <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-purple-200/75 tabular-nums mt-1">
        <span>-{result.marginPct}% cutoff</span>
        <span className="font-semibold text-[#2B0938] dark:text-white">
          Actual {formatGBP(result.actualTotalPence)}
        </span>
        <span>+{result.marginPct}% cutoff</span>
      </div>
    </div>
  );
};
