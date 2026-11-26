import React from 'react';

interface PuzzlePoliceCarProps {
  /** Y coordinate (px from top of viewport) where the car's tires roll along the top of the grid */
  roadTopPx: number;
  /** Incrementing key to force a fresh drive-across pass on each win or test dot press */
  runKey: number;
  /** Loop patrol passes while the win modal sticker is open; single pass once closed */
  loop?: boolean;
}

export const PuzzlePoliceCar: React.FC<PuzzlePoliceCarProps> = ({
  roadTopPx,
  runKey,
  loop = true,
}) => {
  // Position container so the car's bottom tire line sits right on `roadTopPx` (top of the grid)
  const carHeightPx = 114;
  const clampedTop = Math.max(4, Math.round(roadTopPx - carHeightPx + 14));

  return (
    <div
      key={runKey}
      aria-hidden="true"
      className="pointer-events-none select-none fixed inset-x-0 z-[60] overflow-hidden"
      style={{ top: `${clampedTop}px`, height: `${carHeightPx + 24}px` }}
    >
      <div
        className={`inline-block pt-4 ${
          loop ? 'animate-puzzle-police-drive' : 'animate-puzzle-police-drive-once'
        }`}
      >
        <div className="animate-puzzle-police-bounce relative w-[250px] sm:w-[310px] drop-shadow-[0_10px_14px_rgba(0,0,0,0.45)]">
          <svg
            viewBox="0 0 360 130"
            className="w-full h-auto overflow-visible"
            role="img"
            aria-label="Puzzle Police car with flashing lights"
          >
            <defs>
              {/* Alternating Red & Blue siren radial glow halos */}
              <radialGradient id="pp-red-glow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#ff1e42" stopOpacity="0.95" />
                <stop offset="45%" stopColor="#ff1e42" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#ff1e42" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="pp-blue-glow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#2563eb" stopOpacity="0.95" />
                <stop offset="45%" stopColor="#38bdf8" stopOpacity="0.48" />
                <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
              </radialGradient>
              <linearGradient id="pp-headlight-beam" x1="0%" y1="50%" x2="100%" y2="50%">
                <stop offset="0%" stopColor="#fef08a" stopOpacity="0.72" />
                <stop offset="55%" stopColor="#fef08a" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#fef08a" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="pp-body-dark" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#1e1b4b" />
                <stop offset="55%" stopColor="#131030" />
                <stop offset="100%" stopColor="#09071a" />
              </linearGradient>
              <linearGradient id="pp-window-glass" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#7dd3fc" stopOpacity="0.9" />
                <stop offset="50%" stopColor="#1e293b" stopOpacity="0.95" />
                <stop offset="100%" stopColor="#0f172a" stopOpacity="0.98" />
              </linearGradient>
            </defs>

            {/* Animated exhaust puffs trailing behind the cruiser */}
            <g fill="#e2e8f0">
              <circle
                cx="30"
                cy="96"
                r="6"
                className="animate-puzzle-police-puff"
              />
              <circle
                cx="18"
                cy="92"
                r="4.5"
                className="animate-puzzle-police-puff"
                style={{ animationDelay: '0.18s' }}
              />
              <circle
                cx="24"
                cy="99"
                r="3.8"
                className="animate-puzzle-police-puff"
                style={{ animationDelay: '0.35s' }}
              />
            </g>

            {/* Forward headlight beam cone */}
            <polygon
              points="300,72 364,54 364,104 300,90"
              fill="url(#pp-headlight-beam)"
            />

            {/* Ground road shadow directly under tires */}
            <ellipse cx="174" cy="112" rx="122" ry="7" fill="#000000" opacity="0.38" />

            {/* Flashing Siren Glow Halos (Alternating Red & Blue) */}
            <circle
              cx="161"
              cy="32"
              r="34"
              fill="url(#pp-red-glow)"
              className="animate-puzzle-police-red"
            />
            <circle
              cx="189"
              cy="32"
              r="34"
              fill="url(#pp-blue-glow)"
              className="animate-puzzle-police-blue"
            />

            {/* Roof Lightbar Mount & Flashing Beacons */}
            <rect x="150" y="34" width="50" height="8" rx="3" fill="#1e293b" stroke="#94a3b8" strokeWidth="1.2" />
            {/* Red Beacon */}
            <rect
              x="152"
              y="26"
              width="20"
              height="10"
              rx="4"
              fill="#ff1e42"
              stroke="#fecdd3"
              strokeWidth="1"
              className="animate-puzzle-police-red"
            />
            {/* Center Chrome Divider */}
            <rect x="172" y="27" width="6" height="9" rx="1.5" fill="#e2e8f0" />
            {/* Blue Beacon */}
            <rect
              x="178"
              y="26"
              width="20"
              height="10"
              rx="4"
              fill="#2563eb"
              stroke="#bae6fd"
              strokeWidth="1"
              className="animate-puzzle-police-blue"
            />

            {/* Main Police Car Body (Rear & Front Navy Quarters) */}
            <path
              d="M 46 66 L 78 64 L 112 40 C 119 36, 128 35, 138 35 L 204 35 C 216 35, 224 38, 232 45 L 254 63 L 296 68 C 304 69, 309 75, 309 84 L 309 98 C 309 102, 305 104, 299 104 L 44 104 C 39 104, 36 101, 36 96 L 36 76 C 36 70, 40 66, 46 66 Z"
              fill="url(#pp-body-dark)"
              stroke="#f6c915"
              strokeWidth="2"
            />

            {/* Crisp White Police Side Doors Panel */}
            <path
              d="M 96 64 L 244 64 L 244 102 L 96 102 Z"
              fill="#f8fafc"
              stroke="#cbd5e1"
              strokeWidth="1"
            />

            {/* Cabin Windows */}
            <path
              d="M 116 42 L 166 42 L 166 61 L 94 61 Z"
              fill="url(#pp-window-glass)"
              stroke="#475569"
              strokeWidth="1.5"
            />
            <path
              d="M 173 42 L 214 42 C 218 42, 222 44, 226 47 L 242 61 L 173 61 Z"
              fill="url(#pp-window-glass)"
              stroke="#475569"
              strokeWidth="1.5"
            />
            {/* Window glass reflection slash */}
            <path d="M 124 44 L 136 44 L 122 59 L 110 59 Z" fill="#ffffff" opacity="0.24" />
            <path d="M 186 44 L 198 44 L 184 59 L 174 59 Z" fill="#ffffff" opacity="0.22" />

            {/* Side Mirror */}
            <rect x="235" y="57" width="12" height="7" rx="3" fill="#1e1b4b" stroke="#f6c915" strokeWidth="1" />

            {/* Battenberg Gold & Blue Checkered Stripe along lower body */}
            <g>
              <rect x="40" y="89" width="265" height="8" fill="#1d4ed8" />
              {[42, 62, 82, 102, 122, 142, 162, 182, 202, 222, 242, 262, 282].map((x) => (
                <rect key={x} x={x} y="89" width="10" height="8" fill="#f6c915" />
              ))}
            </g>

            {/* Bold "PUZZLE POLICE" Lettering Along the Side */}
            <text
              x="170"
              y="83"
              textAnchor="middle"
              fill="#0f172a"
              fontFamily="'Impact', 'Arial Black', system-ui, sans-serif"
              fontWeight="900"
              fontSize="19.5"
              letterSpacing="0.8"
            >
              PUZZLE POLICE
            </text>

            {/* Mini Gold Star Badge on Rear Quarter */}
            <polygon
              points="66,73 68,78 73,78 69,81 71,86 66,83 61,86 63,81 59,78 64,78"
              fill="#f6c915"
            />

            {/* Front Push Bumper / Bullbar */}
            <path
              d="M 307 76 L 315 76 C 317 76, 318 78, 318 81 L 318 98 C 318 100, 316 101, 314 101 L 306 101"
              fill="none"
              stroke="#94a3b8"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
            <line x1="308" y1="84" x2="318" y2="84" stroke="#cbd5e1" strokeWidth="2.5" />
            <line x1="308" y1="92" x2="318" y2="92" stroke="#cbd5e1" strokeWidth="2.5" />

            {/* Headlight & Taillight */}
            <rect x="299" y="72" width="10" height="9" rx="3" fill="#fef08a" stroke="#f59e0b" strokeWidth="1" />
            <rect x="36" y="72" width="8" height="10" rx="2.5" fill="#ef4444" stroke="#fca5a5" strokeWidth="1" />

            {/* Wheel Wells */}
            <circle cx="94" cy="102" r="20" fill="#09071a" />
            <circle cx="256" cy="102" r="20" fill="#09071a" />

            {/* Rear Spinning Wheel */}
            <g transform="translate(94, 102)">
              <g className="animate-[spin_0.34s_linear_infinite]">
                <circle cx="0" cy="0" r="16.5" fill="#18181b" stroke="#52525b" strokeWidth="2.5" />
                <circle cx="0" cy="0" r="9.5" fill="#cbd5e1" stroke="#475569" strokeWidth="1.5" />
                <line x1="-8" y1="0" x2="8" y2="0" stroke="#1e293b" strokeWidth="2.2" />
                <line x1="0" y1="-8" x2="0" y2="8" stroke="#1e293b" strokeWidth="2.2" />
                <line x1="-5.5" y1="-5.5" x2="5.5" y2="5.5" stroke="#1e293b" strokeWidth="1.8" />
                <line x1="-5.5" y1="5.5" x2="5.5" y2="-5.5" stroke="#1e293b" strokeWidth="1.8" />
                <circle cx="0" cy="0" r="3" fill="#f6c915" />
              </g>
            </g>

            {/* Front Spinning Wheel */}
            <g transform="translate(256, 102)">
              <g className="animate-[spin_0.34s_linear_infinite]">
                <circle cx="0" cy="0" r="16.5" fill="#18181b" stroke="#52525b" strokeWidth="2.5" />
                <circle cx="0" cy="0" r="9.5" fill="#cbd5e1" stroke="#475569" strokeWidth="1.5" />
                <line x1="-8" y1="0" x2="8" y2="0" stroke="#1e293b" strokeWidth="2.2" />
                <line x1="0" y1="-8" x2="0" y2="8" stroke="#1e293b" strokeWidth="2.2" />
                <line x1="-5.5" y1="-5.5" x2="5.5" y2="5.5" stroke="#1e293b" strokeWidth="1.8" />
                <line x1="-5.5" y1="5.5" x2="5.5" y2="-5.5" stroke="#1e293b" strokeWidth="1.8" />
                <circle cx="0" cy="0" r="3" fill="#f6c915" />
              </g>
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
};
