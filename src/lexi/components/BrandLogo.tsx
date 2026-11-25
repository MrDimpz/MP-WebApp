import React from 'react';
import { Link } from 'react-router';

export const BRAND_LOGO_URL = '/assets/aistudio/3d_logo_944e5372.png';
export const BRAND_NAME = 'The Missing Piece';
export const BRAND_TAGLINE = 'Find Your Space';

interface BrandLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  showTagline?: boolean;
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<BrandLogoProps['size']>, string> = {
  xs: 'w-7 h-7',
  sm: 'w-9 h-9',
  md: 'w-12 h-12',
  lg: 'w-16 h-16',
  xl: 'w-24 h-24',
};

export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 'md',
  showText = false,
  showTagline = false,
  className = '',
}) => {
  return (
    <Link
      to="/"
      title="Return to Home Screen"
      className={`inline-flex items-center gap-3 select-none hover:opacity-90 transition-opacity ${className}`}
    >
      <div
        className={`${SIZE_CLASSES[size]} rounded-full overflow-hidden ring-2 ring-amber-400/80 shadow-[0_0_22px_rgba(250,204,21,0.28)] bg-white shrink-0 flex items-center justify-center`}
      >
        <img
          src={BRAND_LOGO_URL}
          alt={`${BRAND_NAME} — ${BRAND_TAGLINE}`}
          className="w-full h-full object-cover scale-[1.27]"
        />
      </div>

      {showText && (
        <div className="flex flex-col leading-tight">
          <span className="font-display font-extrabold tracking-tight text-[#8F6500] dark:text-amber-300 dark:drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
            {BRAND_NAME}
          </span>
          {showTagline && (
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6B4A8A] dark:text-purple-200/90">
              {BRAND_TAGLINE}
            </span>
          )}
        </div>
      )}
    </Link>
  );
};
