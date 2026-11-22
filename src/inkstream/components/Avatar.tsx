import React from 'react';
import { Shuffle } from 'lucide-react';
import type { AvatarConfig } from '../shared/types.ts';
import { AVATAR_COLORS } from '../shared/words.ts';

interface AvatarProps {
  config: AvatarConfig;
  size?: number;
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({ config, size = 44, className = '' }) => {
  const color = config?.color || '#2563EB';
  const eyes = config?.eyes ?? 0;
  const mouth = config?.mouth ?? 0;
  const accessory = config?.accessory ?? 0;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 select-none ${className}`}
      aria-hidden="true"
    >
      {/* Head / Body Circle */}
      <circle cx="32" cy="35" r="22" fill={color} stroke="#0F172A" strokeWidth="2.5" />
      {/* Subtle cheek highlight */}
      <ellipse cx="22" cy="27" rx="5" ry="3" fill="#FFFFFF" fillOpacity="0.22" transform="rotate(-20 22 27)" />

      {/* Eyes */}
      {eyes === 0 && (
        <>
          <circle cx="24" cy="33" r="3.2" fill="#0F172A" />
          <circle cx="40" cy="33" r="3.2" fill="#0F172A" />
          <circle cx="25" cy="32" r="1" fill="#FFFFFF" />
          <circle cx="41" cy="32" r="1" fill="#FFFFFF" />
        </>
      )}
      {eyes === 1 && (
        <>
          <path d="M20 33 C22 29, 26 29, 28 33" stroke="#0F172A" strokeWidth="2.6" strokeLinecap="round" />
          <path d="M36 33 C38 29, 42 29, 44 33" stroke="#0F172A" strokeWidth="2.6" strokeLinecap="round" />
        </>
      )}
      {eyes === 2 && (
        <>
          <circle cx="24" cy="33" r="4.5" fill="#FFFFFF" stroke="#0F172A" strokeWidth="2" />
          <circle cx="40" cy="33" r="4.5" fill="#FFFFFF" stroke="#0F172A" strokeWidth="2" />
          <circle cx="25.2" cy="33" r="2" fill="#0F172A" />
          <circle cx="41.2" cy="33" r="2" fill="#0F172A" />
        </>
      )}
      {eyes === 3 && (
        <>
          <circle cx="24" cy="33" r="3" fill="#0F172A" />
          <path d="M36 32 L43 33 L36 35" stroke="#0F172A" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {eyes === 4 && (
        <>
          <path d="M20 30 L28 33" stroke="#0F172A" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M44 30 L36 33" stroke="#0F172A" strokeWidth="2.4" strokeLinecap="round" />
          <circle cx="24" cy="34.5" r="2.4" fill="#0F172A" />
          <circle cx="40" cy="34.5" r="2.4" fill="#0F172A" />
        </>
      )}
      {eyes === 5 && (
        <>
          <rect x="18" y="29" width="11" height="7" rx="2.5" fill="#0F172A" />
          <rect x="35" y="29" width="11" height="7" rx="2.5" fill="#0F172A" />
          <path d="M29 32 L35 32" stroke="#0F172A" strokeWidth="2.4" />
          <path d="M20 31.5 L23 31.5" stroke="#FFFFFF" strokeWidth="1.4" strokeLinecap="round" />
          <path d="M37 31.5 L40 31.5" stroke="#FFFFFF" strokeWidth="1.4" strokeLinecap="round" />
        </>
      )}

      {/* Mouth */}
      {mouth === 0 && (
        <path d="M25 43 Q32 49 39 43" stroke="#0F172A" strokeWidth="2.6" strokeLinecap="round" />
      )}
      {mouth === 1 && (
        <path d="M24 42 Q32 51 40 42 Z" fill="#FFFFFF" stroke="#0F172A" strokeWidth="2.2" strokeLinejoin="round" />
      )}
      {mouth === 2 && (
        <circle cx="32" cy="45" r="3.4" fill="#0F172A" />
      )}
      {mouth === 3 && (
        <path d="M25 45 L39 44" stroke="#0F172A" strokeWidth="2.6" strokeLinecap="round" />
      )}
      {mouth === 4 && (
        <path d="M24 44 Q28 48 32 44 Q36 48 40 44" stroke="#0F172A" strokeWidth="2.4" strokeLinecap="round" />
      )}
      {mouth === 5 && (
        <>
          <path d="M25 43 Q32 48 39 43" stroke="#0F172A" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M33 45.5 Q36 51 39 45.5" fill="#FB7185" stroke="#0F172A" strokeWidth="1.8" />
        </>
      )}

      {/* Accessories */}
      {accessory === 1 && (
        /* Gold Crown */
        <path
          d="M20 17 L23 8 L32 14 L41 8 L44 17 Z"
          fill="#FACC15"
          stroke="#0F172A"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
      )}
      {accessory === 2 && (
        /* Artist Beret */
        <>
          <path
            d="M14 21 C16 10, 44 9, 49 19 C43 22, 22 23, 14 21 Z"
            fill="#1E293B"
            stroke="#0F172A"
            strokeWidth="2.2"
          />
          <path d="M31 11 L33 6" stroke="#0F172A" strokeWidth="2.4" strokeLinecap="round" />
        </>
      )}
      {accessory === 3 && (
        /* Round Glasses */
        <>
          <circle cx="24" cy="33" r="6" stroke="#0F172A" strokeWidth="2.1" fill="#FFFFFF" fillOpacity="0.2" />
          <circle cx="40" cy="33" r="6" stroke="#0F172A" strokeWidth="2.1" fill="#FFFFFF" fillOpacity="0.2" />
          <path d="M30 33 L34 33" stroke="#0F172A" strokeWidth="2.1" />
        </>
      )}
      {accessory === 4 && (
        /* Headphones */
        <>
          <path d="M12 34 C12 16, 52 16, 52 34" stroke="#0F172A" strokeWidth="3.2" fill="none" />
          <rect x="8" y="29" width="6" height="12" rx="3" fill="#334155" stroke="#0F172A" strokeWidth="2" />
          <rect x="50" y="29" width="6" height="12" rx="3" fill="#334155" stroke="#0F172A" strokeWidth="2" />
        </>
      )}
      {accessory === 5 && (
        /* Leaf Sprout */
        <>
          <path d="M32 14 Q32 7 38 6" stroke="#15803D" strokeWidth="2.5" strokeLinecap="round" />
          <ellipse cx="38" cy="7" rx="5" ry="3" fill="#22C55E" stroke="#0F172A" strokeWidth="1.8" transform="rotate(-15 38 7)" />
          <ellipse cx="26" cy="9" rx="4.5" ry="2.6" fill="#22C55E" stroke="#0F172A" strokeWidth="1.8" transform="rotate(25 26 9)" />
        </>
      )}
    </svg>
  );
};

interface AvatarCustomizerProps {
  value: AvatarConfig;
  onChange: (next: AvatarConfig) => void;
}

const EYE_LABELS = ['Classic', 'Happy', 'Wide', 'Wink', 'Focused', 'Shades'];
const MOUTH_LABELS = ['Smile', 'Grin', 'Surprised', 'Neutral', 'Cat', 'Playful'];
const ACCESSORY_LABELS = ['None', 'Crown', 'Beret', 'Glasses', 'Headset', 'Sprout'];

export const AvatarCustomizer: React.FC<AvatarCustomizerProps> = ({ value, onChange }) => {
  const randomize = () => {
    onChange({
      color: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
      eyes: Math.floor(Math.random() * 6),
      mouth: Math.floor(Math.random() * 6),
      accessory: Math.floor(Math.random() * 6),
    });
  };

  const cycle = (field: 'eyes' | 'mouth' | 'accessory', delta: number) => {
    const next = (value[field] + delta + 6) % 6;
    onChange({ ...value, [field]: next });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-5">
        <div className="relative flex items-center justify-center w-24 h-24 rounded-xl bg-slate-50 border border-slate-200 shrink-0">
          <Avatar config={value} size={80} />
          <button
            type="button"
            onClick={randomize}
            title="Randomize avatar"
            className="absolute -bottom-2 -right-2 w-8 h-8 rounded-lg bg-white border border-slate-300 flex items-center justify-center text-slate-700 hover:text-blue-600 hover:border-blue-400 transition-colors cursor-pointer"
          >
            <Shuffle className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 flex flex-col gap-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600 font-medium">Eyes</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => cycle('eyes', -1)}
                className="w-7 h-7 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold cursor-pointer"
                aria-label="Previous eyes"
              >
                &lsaquo;
              </button>
              <span className="w-18 text-center text-xs font-medium text-slate-800">
                {EYE_LABELS[value.eyes]}
              </span>
              <button
                type="button"
                onClick={() => cycle('eyes', 1)}
                className="w-7 h-7 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold cursor-pointer"
                aria-label="Next eyes"
              >
                &rsaquo;
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600 font-medium">Mouth</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => cycle('mouth', -1)}
                className="w-7 h-7 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold cursor-pointer"
                aria-label="Previous mouth"
              >
                &lsaquo;
              </button>
              <span className="w-18 text-center text-xs font-medium text-slate-800">
                {MOUTH_LABELS[value.mouth]}
              </span>
              <button
                type="button"
                onClick={() => cycle('mouth', 1)}
                className="w-7 h-7 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold cursor-pointer"
                aria-label="Next mouth"
              >
                &rsaquo;
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600 font-medium">Hat / Gear</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => cycle('accessory', -1)}
                className="w-7 h-7 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold cursor-pointer"
                aria-label="Previous accessory"
              >
                &lsaquo;
              </button>
              <span className="w-18 text-center text-xs font-medium text-slate-800">
                {ACCESSORY_LABELS[value.accessory]}
              </span>
              <button
                type="button"
                onClick={() => cycle('accessory', 1)}
                className="w-7 h-7 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold cursor-pointer"
                aria-label="Next accessory"
              >
                &rsaquo;
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Color swatches */}
      <div className="flex items-center gap-2 flex-wrap">
        {AVATAR_COLORS.map((hex) => {
          const active = value.color.toLowerCase() === hex.toLowerCase();
          return (
            <button
              key={hex}
              type="button"
              onClick={() => onChange({ ...value, color: hex })}
              className={`w-7 h-7 rounded-lg transition-transform cursor-pointer ${
                active
                  ? 'ring-2 ring-offset-2 ring-slate-900 scale-105'
                  : 'border border-slate-300 hover:scale-105'
              }`}
              style={{ backgroundColor: hex }}
              aria-label={`Select avatar color ${hex}`}
            />
          );
        })}
      </div>
    </div>
  );
};
